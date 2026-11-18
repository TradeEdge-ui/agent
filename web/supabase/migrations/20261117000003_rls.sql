-- =============================================================================
-- Row Level Security. Every table has RLS enabled; anything not explicitly
-- allowed is denied. Server code that must bypass RLS (verified webhooks,
-- public form submissions after validation, cron) uses the service role key,
-- which never reaches the browser.
-- =============================================================================

alter table public.document_counters enable row level security;
alter table public.profiles enable row level security;
alter table public.business_settings enable row level security;
alter table public.services enable row level security;
alter table public.leads enable row level security;
alter table public.lead_insights enable row level security;
alter table public.quotes enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.project_updates enable row level security;
alter table public.revision_requests enable row level security;
alter table public.files enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.stripe_events enable row level security;
alter table public.bookings enable row level security;
alter table public.notifications enable row level security;
alter table public.expenses enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.testimonials enable row level security;
alter table public.ai_logs enable row level security;
alter table public.audit_log enable row level security;
alter table public.rate_limits enable row level security;

-- Tables nobody should touch through the public API.
revoke all on public.document_counters, public.rate_limits, public.stripe_events from anon, authenticated;

-- ---------------------------------------------------------------- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
-- Users may edit only harmless columns of their own row; role and Stripe IDs
-- can only change via the service role (see scripts/make-admin.mjs).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone, company_name, marketing_opt_in) on public.profiles to authenticated;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ------------------------------------------------------- business_settings
create policy settings_read on public.business_settings for select to anon, authenticated using (true);
create policy settings_admin_update on public.business_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- services
create policy services_read on public.services for select to anon, authenticated
  using (is_active or public.is_admin());
create policy services_admin_insert on public.services for insert to authenticated with check (public.is_admin());
create policy services_admin_update on public.services for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy services_admin_delete on public.services for delete to authenticated using (public.is_admin());

-- ------------------------------------------------------------------- leads
create policy leads_select on public.leads for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy leads_admin_insert on public.leads for insert to authenticated with check (public.is_admin());
create policy leads_admin_update on public.leads for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy leads_admin_delete on public.leads for delete to authenticated using (public.is_admin());

create policy lead_insights_admin on public.lead_insights for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------ quotes
create policy quotes_select on public.quotes for select to authenticated
  using ((client_id = auth.uid() and status <> 'draft') or public.is_admin());
create policy quotes_admin_insert on public.quotes for insert to authenticated with check (public.is_admin());
create policy quotes_admin_update on public.quotes for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy quotes_admin_delete on public.quotes for delete to authenticated
  using (public.is_admin() and status = 'draft');

-- ---------------------------------------------------------------- projects
create policy projects_select on public.projects for select to authenticated
  using (client_id = auth.uid() or public.is_admin());
create policy projects_admin_insert on public.projects for insert to authenticated with check (public.is_admin());
create policy projects_admin_update on public.projects for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy milestones_select on public.milestones for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid()));
create policy milestones_admin_write on public.milestones for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy updates_select on public.project_updates for select to authenticated
  using (public.is_admin() or (not is_internal and exists (
    select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())));
create policy updates_client_insert on public.project_updates for insert to authenticated
  with check (
    public.is_admin()
    or (author_id = auth.uid() and not is_internal and exists (
      select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid()))
  );
create policy updates_admin_modify on public.project_updates for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy updates_admin_delete on public.project_updates for delete to authenticated using (public.is_admin());

create policy revisions_select on public.revision_requests for select to authenticated
  using (public.is_admin() or exists (
    select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid()));
create policy revisions_client_insert on public.revision_requests for insert to authenticated
  with check (
    public.is_admin()
    or (requested_by = auth.uid() and status = 'open' and admin_response is null and exists (
      select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid()
        and p.status in ('planning', 'in_progress', 'review')))
  );
create policy revisions_admin_update on public.revision_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------- files
create policy files_select on public.files for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());
create policy files_insert on public.files for insert to authenticated
  with check (
    public.is_admin()
    or (owner_id = auth.uid() and uploaded_by = auth.uid() and kind = 'asset'
        and split_part(path, '/', 1) = auth.uid()::text
        and (project_id is null or exists (
          select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())))
  );
create policy files_delete on public.files for delete to authenticated
  using (public.is_admin() or (owner_id = auth.uid() and uploaded_by = auth.uid()));

-- ----------------------------------------------------------------- billing
create policy invoices_select on public.invoices for select to authenticated
  using ((client_id = auth.uid() and status <> 'draft') or public.is_admin());
create policy invoices_admin_insert on public.invoices for insert to authenticated with check (public.is_admin());
create policy invoices_admin_update on public.invoices for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy invoices_admin_delete on public.invoices for delete to authenticated
  using (public.is_admin() and status = 'draft');

create policy payments_select on public.payments for select to authenticated
  using (client_id = auth.uid() or public.is_admin());
-- Payments are only ever written by security-definer functions.
revoke insert, update, delete on public.payments from anon, authenticated;

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (client_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- ---------------------------------------------------------------- bookings
create policy bookings_select on public.bookings for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy bookings_admin_update on public.bookings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------- notifications
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_admin_insert on public.notifications for insert to authenticated
  with check (public.is_admin());

-- ------------------------------------------------------------------- admin
create policy expenses_admin on public.expenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy ai_logs_admin on public.ai_logs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy audit_admin_read on public.audit_log for select to authenticated using (public.is_admin());
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- ------------------------------------------------------- marketing content
create policy portfolio_read on public.portfolio_items for select to anon, authenticated
  using (is_published or public.is_admin());
create policy portfolio_admin_write on public.portfolio_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy testimonials_read on public.testimonials for select to anon, authenticated
  using ((is_published and consent_to_publish) or submitted_by = auth.uid() or public.is_admin());
create policy testimonials_client_insert on public.testimonials for insert to authenticated
  with check (
    public.is_admin()
    or (submitted_by = auth.uid() and not is_published)
  );
create policy testimonials_admin_update on public.testimonials for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy testimonials_admin_delete on public.testimonials for delete to authenticated
  using (public.is_admin());
