-- =============================================================================
-- ARyzz AI Solutions — core schema
-- Money is stored as integer "sen" (1 MYR = 100 sen) in *_cents columns.
-- All timestamps are timestamptz (UTC); display uses Asia/Kuala_Lumpur.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Utilities
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Per-year sequential document numbers, e.g. INV-2026-0001.
create table public.document_counters (
  prefix text not null,
  year int not null,
  last_value int not null default 0,
  primary key (prefix, year)
);

create or replace function public.next_document_number(p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from (now() at time zone 'Asia/Kuala_Lumpur'))::int;
  v_next int;
begin
  insert into public.document_counters as dc (prefix, year, last_value)
  values (p_prefix, v_year, 1)
  on conflict (prefix, year) do update set last_value = dc.last_value + 1
  returning last_value into v_next;
  return p_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  company_name text,
  role text not null default 'client' check (role in ('client', 'admin')),
  stripe_customer_id text unique,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Business settings (single row, id = 1)
-- ---------------------------------------------------------------------------
create table public.business_settings (
  id int primary key default 1 check (id = 1),
  business_name text not null default 'ARyzz AI Solutions',
  legal_name text,
  registration_no text,
  email text,
  phone text,
  whatsapp text,
  address text,
  bank_name text,
  bank_account_name text,
  bank_account_no text,
  duitnow_id text,
  sst_registered boolean not null default false,
  sst_number text,
  sst_rate numeric(5, 2) not null default 0 check (sst_rate >= 0 and sst_rate <= 100),
  invoice_due_days int not null default 7 check (invoice_due_days between 0 and 90),
  quote_validity_days int not null default 14 check (quote_validity_days between 1 and 180),
  invoice_footer text,
  booking_config jsonb not null default jsonb_build_object(
    'enabled', true,
    'slot_minutes', 30,
    'days', jsonb_build_array(1, 2, 3, 4, 5),
    'start', '10:00',
    'end', '17:00',
    'min_notice_hours', 24,
    'max_days_ahead', 21,
    'blackout_dates', jsonb_build_array()
  ),
  auto_payment_reminders boolean not null default true,
  updated_at timestamptz not null default now()
);
create trigger business_settings_updated_at before update on public.business_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Service catalogue (editable packages)
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category text not null check (category in ('website', 'ai', 'maintenance')),
  name text not null,
  tagline text,
  description text,
  -- price_min_cents is the "from"/base price; null max = open-ended.
  price_min_cents bigint check (price_min_cents is null or price_min_cents >= 0),
  price_max_cents bigint check (price_max_cents is null or price_max_cents >= 0),
  price_notes text,
  billing_type text not null default 'one_time' check (billing_type in ('one_time', 'monthly')),
  -- direct: customer can buy/subscribe online at price_min_cents.
  -- quote : customer requests a quotation first.
  purchase_mode text not null default 'quote' check (purchase_mode in ('direct', 'quote')),
  deposit_percent int not null default 50 check (deposit_percent between 1 and 100),
  deliverables jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  revisions_included int not null default 2 check (revisions_included >= 0),
  timeline_text text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_price_range check (
    price_max_cents is null or price_min_cents is null or price_max_cents >= price_min_cents
  ),
  constraint services_direct_needs_price check (
    purchase_mode = 'quote' or (price_min_cents is not null and price_min_cents > 0)
  )
);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Leads / project requests
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  company text,
  source text not null default 'quote_request'
    check (source in ('quote_request', 'contact', 'booking', 'dashboard', 'manual')),
  service_id uuid references public.services (id) on delete set null,
  budget text,
  timeline text,
  website_url text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_status_idx on public.leads (status, created_at desc);
create index leads_email_idx on public.leads (lower(email));
create index leads_user_idx on public.leads (user_id);
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- Admin-only data about a lead (kept out of the client-visible leads row).
create table public.lead_insights (
  lead_id uuid primary key references public.leads (id) on delete cascade,
  ai_score int check (ai_score between 0 and 100),
  ai_summary text,
  ai_qualification jsonb,
  internal_notes text,
  updated_at timestamptz not null default now()
);
create trigger lead_insights_updated_at before update on public.lead_insights
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  lead_id uuid references public.leads (id) on delete set null,
  client_id uuid references public.profiles (id) on delete set null,
  client_email text not null,
  client_name text,
  service_id uuid references public.services (id) on delete set null,
  title text not null,
  summary text,
  line_items jsonb not null default '[]'::jsonb,
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  payment_schedule jsonb not null default
    '[{"label":"Deposit","percent":50},{"label":"Final payment on completion","percent":50}]'::jsonb,
  deliverables jsonb not null default '[]'::jsonb,
  exclusions jsonb not null default '[]'::jsonb,
  revisions_included int not null default 2 check (revisions_included >= 0),
  timeline_text text,
  recommended_service_id uuid references public.services (id) on delete set null,
  valid_until date,
  terms text,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'declined', 'expired', 'cancelled')),
  sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  decline_reason text,
  project_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotes_totals check (total_cents = subtotal_cents - discount_cents + tax_cents)
);
create index quotes_client_idx on public.quotes (client_id);
create index quotes_email_idx on public.quotes (lower(client_email));
create trigger quotes_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Projects (an engagement / order) and delivery tracking
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  client_id uuid not null references public.profiles (id) on delete restrict,
  quote_id uuid references public.quotes (id) on delete set null,
  service_id uuid references public.services (id) on delete set null,
  name text not null,
  description text,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'planning', 'in_progress', 'review', 'completed', 'on_hold', 'cancelled')),
  progress int not null default 0 check (progress between 0 and 100),
  start_date date,
  due_date date,
  revisions_included int not null default 2 check (revisions_included >= 0),
  live_url text,
  staging_url text,
  total_cents bigint not null default 0 check (total_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_client_idx on public.projects (client_id);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.quotes
  add constraint quotes_project_fk foreign key (project_id) references public.projects (id) on delete set null;

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  description text,
  sort_order int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index milestones_project_idx on public.milestones (project_id, sort_order);

create table public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 10000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);
create index project_updates_project_idx on public.project_updates (project_id, created_at desc);

create table public.revision_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  details text not null check (char_length(details) between 1 and 10000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'rejected')),
  counts_toward_limit boolean not null default true,
  admin_response text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index revision_requests_project_idx on public.revision_requests (project_id);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  bucket text not null default 'project-files',
  path text not null unique,
  filename text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  mime_type text,
  kind text not null default 'asset' check (kind in ('asset', 'deliverable', 'other')),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index files_owner_idx on public.files (owner_id);
create index files_project_idx on public.files (project_id);

-- ---------------------------------------------------------------------------
-- Billing
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete restrict,
  service_id uuid references public.services (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  plan_name text not null,
  status text not null
    check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  price_cents bigint not null check (price_cents >= 0),
  currency text not null default 'myr',
  interval text not null default 'month',
  stripe_subscription_id text unique,
  stripe_customer_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_client_idx on public.subscriptions (client_id);
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  client_id uuid not null references public.profiles (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  quote_id uuid references public.quotes (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  kind text not null default 'manual'
    check (kind in ('deposit', 'milestone', 'final', 'full', 'subscription', 'manual')),
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  currency text not null default 'myr' check (currency = 'myr'),
  line_items jsonb not null default '[]'::jsonb,
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  amount_paid_cents bigint not null default 0 check (amount_paid_cents >= 0),
  amount_refunded_cents bigint not null default 0 check (amount_refunded_cents >= 0),
  sequence int,
  due_date date,
  issued_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  notes text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_invoice_id text unique,
  hosted_invoice_url text,
  invoice_pdf_url text,
  last_reminder_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_totals check (total_cents = subtotal_cents - discount_cents + tax_cents)
);
create index invoices_client_idx on public.invoices (client_id, created_at desc);
create index invoices_project_idx on public.invoices (project_id, sequence);
create index invoices_status_idx on public.invoices (status, due_date);
create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  invoice_id uuid references public.invoices (id) on delete set null,
  client_id uuid references public.profiles (id) on delete set null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'myr',
  method text not null default 'stripe',
  provider text not null check (provider in ('stripe', 'manual')),
  provider_payment_id text unique,
  reference text,
  status text not null default 'succeeded'
    check (status in ('succeeded', 'partially_refunded', 'refunded')),
  refunded_cents bigint not null default 0 check (refunded_cents >= 0),
  receipt_url text,
  recorded_by uuid references public.profiles (id) on delete set null,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index payments_client_idx on public.payments (client_id, paid_at desc);
create index payments_invoice_idx on public.payments (invoice_id);
create index payments_paid_at_idx on public.payments (paid_at);

-- Webhook idempotency log.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  note text
);

-- ---------------------------------------------------------------------------
-- Consultations
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  company text,
  topic text not null,
  notes text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  meeting_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);
-- One active booking per slot (prevents double-booking races).
create unique index bookings_active_slot_idx on public.bookings (start_at) where status = 'confirmed';
create index bookings_user_idx on public.bookings (user_id);
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Notifications, expenses, marketing content, logs
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  incurred_on date not null,
  category text not null,
  description text not null,
  vendor text,
  amount_cents bigint not null check (amount_cents > 0),
  project_id uuid references public.projects (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index expenses_date_idx on public.expenses (incurred_on);

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  client_name text,
  summary text not null,
  description text,
  image_url text,
  live_url text,
  tags jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger portfolio_items_updated_at before update on public.portfolio_items
  for each row execute function public.set_updated_at();

-- Only genuine testimonials: published entries require recorded consent.
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_title text,
  company text,
  quote text not null check (char_length(quote) between 10 and 2000),
  rating int check (rating between 1 and 5),
  project_id uuid references public.projects (id) on delete set null,
  submitted_by uuid references public.profiles (id) on delete set null,
  consent_to_publish boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint testimonials_publish_requires_consent check (not is_published or consent_to_publish)
);

create table public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  task text not null,
  context_ref text,
  model text,
  input_tokens int,
  output_tokens int,
  output text,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null
);

-- ---------------------------------------------------------------------------
-- Document number defaults
-- ---------------------------------------------------------------------------
create or replace function public.assign_document_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nested IFs: PL/pgSQL resolves NEW.<field> only when a statement runs, and
  -- payments has receipt_number rather than number.
  if tg_table_name = 'payments' then
    if new.receipt_number is null or new.receipt_number = '' then
      new.receipt_number := public.next_document_number('RCT');
    end if;
  else
    if new.number is null or new.number = '' then
      new.number := public.next_document_number(
        case tg_table_name when 'quotes' then 'Q' when 'invoices' then 'INV' when 'projects' then 'PRJ' else 'DOC' end
      );
    end if;
  end if;
  return new;
end;
$$;

alter table public.quotes alter column number set default '';
alter table public.invoices alter column number set default '';
alter table public.projects alter column number set default '';
alter table public.payments alter column receipt_number set default '';

create trigger quotes_number before insert on public.quotes
  for each row execute function public.assign_document_number();
create trigger invoices_number before insert on public.invoices
  for each row execute function public.assign_document_number();
create trigger projects_number before insert on public.projects
  for each row execute function public.assign_document_number();
create trigger payments_number before insert on public.payments
  for each row execute function public.assign_document_number();
