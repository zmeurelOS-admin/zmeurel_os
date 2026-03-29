alter table public.tenant_metrics_daily enable row level security;

drop policy if exists tenant_metrics_daily_superadmin_select on public.tenant_metrics_daily;
create policy tenant_metrics_daily_superadmin_select
  on public.tenant_metrics_daily
  for select
  using (
    exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and is_superadmin = true
    )
  );

drop policy if exists tenant_metrics_daily_superadmin_insert on public.tenant_metrics_daily;
drop policy if exists tenant_metrics_daily_service_insert on public.tenant_metrics_daily;
create policy tenant_metrics_daily_service_insert
  on public.tenant_metrics_daily
  for insert
  with check (false);

drop policy if exists tenant_metrics_daily_superadmin_update on public.tenant_metrics_daily;
drop policy if exists tenant_metrics_daily_service_update on public.tenant_metrics_daily;
create policy tenant_metrics_daily_service_update
  on public.tenant_metrics_daily
  for update
  using (false);

drop policy if exists tenant_metrics_daily_superadmin_delete on public.tenant_metrics_daily;

notify pgrst, 'reload schema';
