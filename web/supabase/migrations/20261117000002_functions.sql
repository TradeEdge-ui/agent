-- =============================================================================
-- Business-logic functions. Anything that moves money or changes several
-- tables at once lives here so it runs in a single transaction.
--
-- Security model:
--   * Functions callable by signed-in clients check auth.uid() themselves.
--   * Payment-recording functions are executable ONLY by service_role (used by
--     the verified Stripe webhook) — never by anon/authenticated users.
--   * Admin-only functions check public.is_admin().
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create or replace function public.notify_admins(p_title text, p_body text, p_link text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, title, body, link)
  select id, p_title, p_body, p_link from public.profiles where role = 'admin';
$$;

create or replace function public.notify_user(p_user_id uuid, p_title text, p_body text, p_link text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, title, body, link)
  values (p_user_id, p_title, p_body, p_link);
$$;

create or replace function public.format_myr(p_cents bigint)
returns text
language sql
immutable
as $$
  select 'RM' || to_char(p_cents / 100.0, 'FM999,999,990.00');
$$;

-- Attach previously-submitted leads/quotes/bookings to an account once its
-- email address has been verified.
create or replace function public.link_user_records(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.leads set user_id = p_user_id
    where user_id is null and lower(email) = lower(p_email);
  update public.quotes set client_id = p_user_id
    where client_id is null and lower(client_email) = lower(p_email);
  update public.bookings set user_id = p_user_id
    where user_id is null and lower(email) = lower(p_email);
end;
$$;

-- ---------------------------------------------------------------------------
-- Auth hooks: create profile on signup, link records on email confirmation
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, company_name)
  values (
    new.id,
    new.email,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 40), ''),
    nullif(left(coalesce(new.raw_user_meta_data ->> 'company_name', ''), 160), '')
  )
  on conflict (id) do nothing;

  if new.email_confirmed_at is not null then
    perform public.link_user_records(new.id, new.email);
  end if;
  return new;
end;
$$;

create or replace function public.handle_user_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    perform public.link_user_records(new.id, new.email);
  end if;
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_user_confirmed();

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window). Returns true when the call is allowed.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.rate_limits as rl (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rl.count + 1 end,
    window_start = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then now() else rl.window_start end
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Split an amount across a percentage schedule. The last instalment absorbs
-- rounding so the parts always sum exactly to the total.
-- ---------------------------------------------------------------------------
create or replace function public.split_by_percent(p_total bigint, p_percents numeric[])
returns bigint[]
language plpgsql
immutable
as $$
declare
  v_parts bigint[] := '{}';
  v_alloc bigint := 0;
  v_n int := coalesce(array_length(p_percents, 1), 0);
  v_amt bigint;
begin
  for i in 1 .. v_n loop
    if i = v_n then
      v_amt := p_total - v_alloc;
    else
      v_amt := round(p_total * p_percents[i] / 100.0);
    end if;
    v_alloc := v_alloc + v_amt;
    v_parts := v_parts || v_amt;
  end loop;
  return v_parts;
end;
$$;

-- Creates the invoice schedule for a project: first instalment is issued
-- (status open), the rest are drafts the admin issues as milestones are hit.
create or replace function public.create_invoice_schedule(
  p_client_id uuid,
  p_project_id uuid,
  p_quote_id uuid,
  p_title text,
  p_net_cents bigint,
  p_tax_rate numeric,
  p_tax_cents bigint,
  p_labels text[],
  p_percents numeric[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int := array_length(p_percents, 1);
  v_net bigint[];
  v_tax bigint[];
  v_first uuid;
  v_id uuid;
  v_kind text;
  v_due_days int;
  v_label text;
begin
  if v_n is null or v_n = 0 then
    raise exception 'Payment schedule is empty';
  end if;
  if (select sum(x) from unnest(p_percents) x) <> 100 then
    raise exception 'Payment schedule must add up to 100%%';
  end if;
  if exists (select 1 from unnest(p_percents) x where x <= 0) then
    raise exception 'Each instalment must be greater than 0%%';
  end if;

  select invoice_due_days into v_due_days from public.business_settings where id = 1;
  v_due_days := coalesce(v_due_days, 7);

  v_net := public.split_by_percent(p_net_cents, p_percents);
  v_tax := public.split_by_percent(p_tax_cents, p_percents);

  for i in 1 .. v_n loop
    v_kind := case when v_n = 1 then 'full' when i = 1 then 'deposit' when i = v_n then 'final' else 'milestone' end;
    v_label := coalesce(nullif(p_labels[i], ''), 'Instalment ' || i);
    insert into public.invoices (
      client_id, project_id, quote_id, kind, title, status, line_items,
      subtotal_cents, discount_cents, tax_rate, tax_cents, total_cents,
      sequence, due_date, issued_at
    ) values (
      p_client_id, p_project_id, p_quote_id, v_kind,
      left(p_title || ' — ' || v_label, 300),
      case when i = 1 then 'open' else 'draft' end,
      jsonb_build_array(jsonb_build_object(
        'description', p_title || ' — ' || v_label || ' (' || p_percents[i]::text || '%)',
        'quantity', 1,
        'unit_price_cents', v_net[i]
      )),
      v_net[i], 0, p_tax_rate, v_tax[i], v_net[i] + v_tax[i],
      i,
      case when i = 1 then ((now() at time zone 'Asia/Kuala_Lumpur')::date + v_due_days) else null end,
      case when i = 1 then now() else null end
    ) returning id into v_id;
    if i = 1 then
      v_first := v_id;
    end if;
  end loop;
  return v_first;
end;
$$;

-- ---------------------------------------------------------------------------
-- Client: accept / decline a quotation
-- ---------------------------------------------------------------------------
create or replace function public.accept_quote(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes;
  v_project_id uuid;
  v_invoice_id uuid;
  v_labels text[];
  v_percents numeric[];
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into q from public.quotes where id = p_quote_id for update;
  if not found or q.client_id is distinct from auth.uid() then
    raise exception 'Quotation not found' using errcode = 'P0002';
  end if;
  if q.status <> 'sent' then
    raise exception 'This quotation is no longer open for acceptance';
  end if;
  if q.valid_until is not null and q.valid_until < (now() at time zone 'Asia/Kuala_Lumpur')::date then
    raise exception 'This quotation has expired. Please ask us for an updated quote.';
  end if;
  if q.total_cents <= 0 then
    raise exception 'This quotation has no payable amount';
  end if;

  select array_agg(coalesce(e ->> 'label', '') order by ord), array_agg((e ->> 'percent')::numeric order by ord)
    into v_labels, v_percents
    from jsonb_array_elements(q.payment_schedule) with ordinality as t(e, ord);

  insert into public.projects (client_id, quote_id, service_id, name, description, status, revisions_included, total_cents)
  values (q.client_id, q.id, q.service_id, q.title, q.summary, 'awaiting_payment', q.revisions_included, q.total_cents)
  returning id into v_project_id;

  v_invoice_id := public.create_invoice_schedule(
    q.client_id, v_project_id, q.id, q.title,
    q.subtotal_cents - q.discount_cents, q.tax_rate, q.tax_cents,
    v_labels, v_percents
  );

  update public.quotes
     set status = 'accepted', accepted_at = now(), project_id = v_project_id
   where id = q.id;

  if q.lead_id is not null then
    update public.leads set status = 'won' where id = q.lead_id;
  end if;

  perform public.notify_admins(
    'Quotation accepted: ' || q.number,
    coalesce(q.client_name, q.client_email) || ' accepted "' || q.title || '" (' || public.format_myr(q.total_cents) || ').',
    '/admin/projects/' || v_project_id
  );

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'quote.accepted', 'quote', q.id::text, jsonb_build_object('project_id', v_project_id));

  return jsonb_build_object('project_id', v_project_id, 'invoice_id', v_invoice_id);
end;
$$;

create or replace function public.decline_quote(p_quote_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotes;
begin
  select * into q from public.quotes where id = p_quote_id for update;
  if not found or q.client_id is distinct from auth.uid() then
    raise exception 'Quotation not found' using errcode = 'P0002';
  end if;
  if q.status <> 'sent' then
    raise exception 'This quotation is no longer open';
  end if;
  update public.quotes
     set status = 'declined', declined_at = now(), decline_reason = left(p_reason, 2000)
   where id = q.id;
  perform public.notify_admins(
    'Quotation declined: ' || q.number,
    coalesce(nullif(left(p_reason, 300), ''), 'No reason given.'),
    '/admin/quotes/' || q.id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Client: buy a fixed-price package directly (price always read from DB)
-- ---------------------------------------------------------------------------
create or replace function public.create_direct_order(p_service_id uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.services;
  st public.business_settings;
  v_uid uuid := auth.uid();
  v_project_id uuid;
  v_invoice_id uuid;
  v_tax_rate numeric := 0;
  v_tax bigint := 0;
  v_open int;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  select * into s from public.services where id = p_service_id;
  if not found or not s.is_active or s.purchase_mode <> 'direct' or s.billing_type <> 'one_time'
     or s.price_min_cents is null or s.price_min_cents <= 0 then
    raise exception 'This package cannot be purchased online. Please request a quotation.';
  end if;

  select count(*) into v_open from public.projects
   where client_id = v_uid and status = 'awaiting_payment';
  if v_open >= 3 then
    raise exception 'You have several unpaid orders. Please pay or contact us before placing another.';
  end if;

  select * into st from public.business_settings where id = 1;
  if st.sst_registered then
    v_tax_rate := st.sst_rate;
    v_tax := round(s.price_min_cents * st.sst_rate / 100.0);
  end if;

  insert into public.projects (client_id, service_id, name, description, status, revisions_included, total_cents)
  values (v_uid, s.id, s.name, nullif(left(coalesce(p_notes, ''), 5000), ''), 'awaiting_payment', s.revisions_included, s.price_min_cents + v_tax)
  returning id into v_project_id;

  if s.deposit_percent >= 100 then
    v_invoice_id := public.create_invoice_schedule(
      v_uid, v_project_id, null, s.name, s.price_min_cents, v_tax_rate, v_tax,
      array['Full payment'], array[100]::numeric[]);
  else
    v_invoice_id := public.create_invoice_schedule(
      v_uid, v_project_id, null, s.name, s.price_min_cents, v_tax_rate, v_tax,
      array['Deposit', 'Balance on completion'],
      array[s.deposit_percent, 100 - s.deposit_percent]::numeric[]);
  end if;

  perform public.notify_admins(
    'New online order: ' || s.name,
    'A client placed an order for ' || s.name || ' (' || public.format_myr(s.price_min_cents + v_tax) || '). Awaiting payment.',
    '/admin/projects/' || v_project_id
  );

  return jsonb_build_object('project_id', v_project_id, 'invoice_id', v_invoice_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Apply a confirmed payment to an invoice (shared by Stripe + manual paths)
-- ---------------------------------------------------------------------------
create or replace function public.apply_payment(
  p_invoice_id uuid,
  p_amount bigint,
  p_currency text,
  p_method text,
  p_provider text,
  p_provider_payment_id text,
  p_reference text,
  p_receipt_url text,
  p_paid_at timestamptz,
  p_recorded_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
  v_payment_id uuid;
  v_new_paid bigint;
  v_was_paid boolean;
begin
  select * into inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found';
  end if;

  v_was_paid := inv.status = 'paid';

  insert into public.payments (
    invoice_id, client_id, amount_cents, currency, method, provider,
    provider_payment_id, reference, receipt_url, recorded_by, paid_at
  ) values (
    inv.id, inv.client_id, p_amount, lower(p_currency), p_method, p_provider,
    p_provider_payment_id, p_reference, p_receipt_url, p_recorded_by, coalesce(p_paid_at, now())
  ) returning id into v_payment_id;

  v_new_paid := inv.amount_paid_cents + p_amount;

  update public.invoices
     set amount_paid_cents = v_new_paid,
         status = case when status = 'void' then 'void' when v_new_paid >= total_cents then 'paid' else status end,
         paid_at = case when v_new_paid >= total_cents and paid_at is null then coalesce(p_paid_at, now()) else paid_at end,
         issued_at = coalesce(issued_at, now())
   where id = inv.id;

  -- First instalment paid => project can start.
  if inv.project_id is not null and v_new_paid >= inv.total_cents and inv.kind in ('deposit', 'full') then
    update public.projects
       set status = 'planning',
           start_date = coalesce(start_date, (now() at time zone 'Asia/Kuala_Lumpur')::date)
     where id = inv.project_id and status = 'awaiting_payment';
  end if;

  perform public.notify_user(
    inv.client_id,
    'Payment received for ' || inv.number,
    'Thank you! We have received ' || public.format_myr(p_amount) || '.',
    '/dashboard/invoices/' || inv.id
  );
  perform public.notify_admins(
    'Payment received: ' || public.format_myr(p_amount),
    'Invoice ' || inv.number || ' via ' || p_method || '.',
    '/admin/invoices/' || inv.id
  );

  if v_was_paid or inv.status = 'void' or lower(p_currency) <> inv.currency or v_new_paid > inv.total_cents then
    perform public.notify_admins(
      'Check payment on ' || inv.number,
      'This invoice received more than its total or a currency mismatch. Review and refund the excess in Stripe if needed.',
      '/admin/invoices/' || inv.id
    );
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (p_recorded_by, 'payment.recorded', 'invoice', inv.id::text,
          jsonb_build_object('payment_id', v_payment_id, 'amount_cents', p_amount, 'provider', p_provider, 'method', p_method));

  return v_payment_id;
end;
$$;

-- Called only by the verified Stripe webhook (service_role).
create or replace function public.record_stripe_payment(
  p_event_id text,
  p_event_type text,
  p_invoice_id uuid,
  p_amount bigint,
  p_currency text,
  p_payment_intent_id text,
  p_method text,
  p_receipt_url text,
  p_paid_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int;
begin
  insert into public.stripe_events (id, type) values (p_event_id, p_event_type)
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'duplicate_event';
  end if;

  if p_payment_intent_id is not null and exists (
    select 1 from public.payments where provider_payment_id = p_payment_intent_id
  ) then
    update public.stripe_events set processed_at = now(), note = 'duplicate payment' where id = p_event_id;
    return 'duplicate_payment';
  end if;

  if p_invoice_id is null or not exists (select 1 from public.invoices where id = p_invoice_id) then
    perform public.notify_admins(
      'Unmatched Stripe payment',
      'Stripe reported a payment of ' || public.format_myr(p_amount) || ' (' || coalesce(p_payment_intent_id, 'no id') || ') that does not match an invoice. Check the Stripe dashboard.',
      '/admin/invoices'
    );
    update public.stripe_events set processed_at = now(), note = 'invoice not found' where id = p_event_id;
    return 'invoice_not_found';
  end if;

  perform public.apply_payment(
    p_invoice_id, p_amount, p_currency, coalesce(p_method, 'stripe'), 'stripe',
    p_payment_intent_id, null, p_receipt_url, p_paid_at, null
  );

  update public.invoices set stripe_payment_intent_id = p_payment_intent_id where id = p_invoice_id;
  update public.stripe_events set processed_at = now() where id = p_event_id;
  return 'recorded';
end;
$$;

-- Admin records a bank transfer / DuitNow / cash payment they have verified.
create or replace function public.record_manual_payment(
  p_invoice_id uuid,
  p_amount bigint,
  p_method text,
  p_reference text,
  p_paid_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invoices;
begin
  if not public.is_admin() then
    raise exception 'Admin only' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_method not in ('bank_transfer', 'duitnow', 'cash', 'cheque', 'other') then
    raise exception 'Invalid payment method';
  end if;
  select * into inv from public.invoices where id = p_invoice_id;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if inv.status not in ('open', 'draft') then
    raise exception 'Only open invoices can receive payments';
  end if;
  return public.apply_payment(
    p_invoice_id, p_amount, 'myr', p_method, 'manual', null, left(p_reference, 200), null, p_paid_at, auth.uid()
  );
end;
$$;

-- Stripe charge.refunded (service_role only). Refunds themselves are always
-- initiated by the owner in the Stripe dashboard — never automatically.
create or replace function public.record_stripe_refund(
  p_event_id text,
  p_payment_intent_id text,
  p_refunded_total bigint
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int;
  pay public.payments;
  v_delta bigint;
begin
  insert into public.stripe_events (id, type) values (p_event_id, 'charge.refunded')
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'duplicate_event';
  end if;

  select * into pay from public.payments where provider_payment_id = p_payment_intent_id for update;
  if not found then
    update public.stripe_events set processed_at = now(), note = 'payment not found' where id = p_event_id;
    return 'payment_not_found';
  end if;

  v_delta := greatest(p_refunded_total - pay.refunded_cents, 0);
  update public.payments
     set refunded_cents = p_refunded_total,
         status = case when p_refunded_total >= amount_cents then 'refunded' else 'partially_refunded' end
   where id = pay.id;

  if pay.invoice_id is not null and v_delta > 0 then
    update public.invoices set amount_refunded_cents = amount_refunded_cents + v_delta where id = pay.invoice_id;
  end if;

  perform public.notify_admins(
    'Refund recorded: ' || public.format_myr(v_delta),
    'Receipt ' || pay.receipt_number || ' was refunded in Stripe.',
    case when pay.invoice_id is null then '/admin/invoices' else '/admin/invoices/' || pay.invoice_id end
  );
  if pay.client_id is not null and v_delta > 0 then
    perform public.notify_user(pay.client_id, 'Refund processed',
      'A refund of ' || public.format_myr(v_delta) || ' has been issued to your original payment method.',
      '/dashboard/invoices');
  end if;

  update public.stripe_events set processed_at = now() where id = p_event_id;
  return 'recorded';
end;
$$;

-- Upsert the local mirror of a Stripe subscription (service_role only).
create or replace function public.upsert_stripe_subscription(
  p_client_id uuid,
  p_service_id uuid,
  p_project_id uuid,
  p_plan_name text,
  p_stripe_subscription_id text,
  p_stripe_customer_id text,
  p_status text,
  p_price_cents bigint,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_canceled_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_prev_status text;
begin
  select id, status into v_id, v_prev_status from public.subscriptions
   where stripe_subscription_id = p_stripe_subscription_id for update;

  if v_id is null then
    insert into public.subscriptions (
      client_id, service_id, project_id, plan_name, status, price_cents,
      stripe_subscription_id, stripe_customer_id, current_period_end,
      cancel_at_period_end, canceled_at
    ) values (
      p_client_id, p_service_id, p_project_id, p_plan_name, p_status, p_price_cents,
      p_stripe_subscription_id, p_stripe_customer_id, p_current_period_end,
      coalesce(p_cancel_at_period_end, false), p_canceled_at
    ) returning id into v_id;

    if p_status in ('active', 'trialing') then
      perform public.notify_admins('New subscription: ' || p_plan_name,
        public.format_myr(p_price_cents) || '/month.', '/admin/subscriptions');
      perform public.notify_user(p_client_id, 'Subscription active: ' || p_plan_name,
        'Thank you for subscribing. Your plan renews monthly.', '/dashboard/subscriptions');
    end if;
  else
    update public.subscriptions
       set status = p_status,
           price_cents = p_price_cents,
           current_period_end = p_current_period_end,
           cancel_at_period_end = coalesce(p_cancel_at_period_end, false),
           canceled_at = p_canceled_at,
           stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id)
     where id = v_id;

    if v_prev_status is distinct from p_status then
      if p_status = 'canceled' then
        perform public.notify_admins('Subscription cancelled: ' || p_plan_name, 'A maintenance plan has ended.', '/admin/subscriptions');
        perform public.notify_user(p_client_id, 'Subscription ended: ' || p_plan_name,
          'Your plan has been cancelled. You can resubscribe anytime.', '/dashboard/subscriptions');
      elsif p_status in ('past_due', 'unpaid') then
        perform public.notify_admins('Subscription payment issue: ' || p_plan_name, 'Status: ' || p_status, '/admin/subscriptions');
        perform public.notify_user(p_client_id, 'Payment issue on ' || p_plan_name,
          'We could not collect your latest payment. Please update your payment method.', '/dashboard/subscriptions');
      elsif p_status = 'active' and v_prev_status in ('incomplete', 'past_due', 'unpaid') then
        perform public.notify_user(p_client_id, 'Subscription active: ' || p_plan_name, 'Your plan is active.', '/dashboard/subscriptions');
      end if;
    end if;
  end if;
  return v_id;
end;
$$;

-- Mirror a paid Stripe subscription invoice as a local invoice + payment.
create or replace function public.record_subscription_invoice(
  p_event_id text,
  p_stripe_invoice_id text,
  p_stripe_subscription_id text,
  p_amount bigint,
  p_currency text,
  p_payment_ref text,
  p_hosted_url text,
  p_pdf_url text,
  p_description text,
  p_paid_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int;
  sub public.subscriptions;
  v_invoice_id uuid;
begin
  insert into public.stripe_events (id, type) values (p_event_id, 'invoice.paid')
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'duplicate_event';
  end if;

  if exists (select 1 from public.invoices where stripe_invoice_id = p_stripe_invoice_id) then
    update public.stripe_events set processed_at = now(), note = 'invoice already recorded' where id = p_event_id;
    return 'duplicate_invoice';
  end if;

  select * into sub from public.subscriptions where stripe_subscription_id = p_stripe_subscription_id;
  if not found then
    -- Raise so the transaction (including the event row) rolls back and
    -- Stripe retries after the subscription has been synced.
    raise exception 'Subscription % not synced yet', p_stripe_subscription_id;
  end if;

  if p_amount <= 0 then
    update public.stripe_events set processed_at = now(), note = 'zero amount invoice' where id = p_event_id;
    return 'zero_amount';
  end if;

  insert into public.invoices (
    client_id, subscription_id, project_id, kind, title, status, line_items,
    subtotal_cents, tax_rate, tax_cents, total_cents, issued_at, due_date,
    stripe_invoice_id, hosted_invoice_url, invoice_pdf_url
  ) values (
    sub.client_id, sub.id, sub.project_id, 'subscription',
    left(coalesce(nullif(p_description, ''), sub.plan_name || ' — monthly'), 300),
    'open',
    jsonb_build_array(jsonb_build_object('description', coalesce(nullif(p_description, ''), sub.plan_name), 'quantity', 1, 'unit_price_cents', p_amount)),
    p_amount, 0, 0, p_amount, coalesce(p_paid_at, now()), (coalesce(p_paid_at, now()) at time zone 'Asia/Kuala_Lumpur')::date,
    p_stripe_invoice_id, p_hosted_url, p_pdf_url
  ) returning id into v_invoice_id;

  perform public.apply_payment(
    v_invoice_id, p_amount, p_currency, 'stripe', 'stripe', p_payment_ref, null, p_hosted_url, p_paid_at, null
  );

  update public.stripe_events set processed_at = now() where id = p_event_id;
  return 'recorded';
end;
$$;

-- ---------------------------------------------------------------------------
-- Client: cancel own upcoming consultation
-- ---------------------------------------------------------------------------
create or replace function public.cancel_my_booking(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or b.user_id is distinct from auth.uid() then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if b.status <> 'confirmed' or b.start_at <= now() then
    raise exception 'This booking can no longer be cancelled online';
  end if;
  update public.bookings set status = 'cancelled' where id = b.id;
  perform public.notify_admins('Consultation cancelled by client', b.name || ' cancelled their ' ||
    to_char(b.start_at at time zone 'Asia/Kuala_Lumpur', 'DD Mon YYYY HH24:MI') || ' booking.', '/admin/bookings');
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.accept_quote(uuid) to authenticated;
grant execute on function public.decline_quote(uuid, text) to authenticated;
grant execute on function public.create_direct_order(uuid, text) to authenticated;
grant execute on function public.record_manual_payment(uuid, bigint, text, text, timestamptz) to authenticated;
grant execute on function public.cancel_my_booking(uuid) to authenticated;
grant execute on function public.format_myr(bigint) to anon, authenticated;
-- Trigger functions run with the table owner's rights; no grants needed.

grant execute on all functions in schema public to service_role;
