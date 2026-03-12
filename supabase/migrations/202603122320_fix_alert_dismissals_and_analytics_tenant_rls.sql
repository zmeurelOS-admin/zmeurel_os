alter table public.alert_dismissals enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists alert_dismissals_select on public.alert_dismissals;
create policy alert_dismissals_select
on public.alert_dismissals
for select
to authenticated
using (
  user_id = auth.uid()
  and tenant_id = public.current_tenant_id()
);

drop policy if exists alert_dismissals_insert on public.alert_dismissals;
create policy alert_dismissals_insert
on public.alert_dismissals
for insert
to authenticated
with check (
  user_id = auth.uid()
  and tenant_id = public.current_tenant_id()
);

drop policy if exists alert_dismissals_delete on public.alert_dismissals;
create policy alert_dismissals_delete
on public.alert_dismissals
for delete
to authenticated
using (
  user_id = auth.uid()
  and tenant_id = public.current_tenant_id()
);

create or replace function public.set_analytics_event_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Neautorizat';
  end if;

  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if new.tenant_id is null then
    new.tenant_id := public.current_tenant_id();
  end if;

  if new.metadata is null then
    new.metadata := '{}'::jsonb;
  end if;

  if new.created_at is null then
    new.created_at := now();
  end if;

  return new;
end;
$$;

drop policy if exists analytics_events_insert_own_tenant on public.analytics_events;
create policy analytics_events_insert_own_tenant
on public.analytics_events
for insert
to authenticated
with check (
  user_id = auth.uid()
  and tenant_id = public.current_tenant_id()
);

notify pgrst, 'reload schema';
