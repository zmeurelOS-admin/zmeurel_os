alter table public.alert_dismissals enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'alert_dismissals'
  loop
    execute format(
      'drop policy if exists %I on public.alert_dismissals',
      policy_row.policyname
    );
  end loop;
end
$$;

create policy alert_dismissals_select
on public.alert_dismissals
for select
using (
  user_id = auth.uid()
  and tenant_id = (
    select t.id
    from public.tenants t
    where t.owner_user_id = auth.uid()
  )
);

create policy alert_dismissals_insert
on public.alert_dismissals
for insert
with check (
  user_id = auth.uid()
  and tenant_id = (
    select t.id
    from public.tenants t
    where t.owner_user_id = auth.uid()
  )
);

create policy alert_dismissals_delete
on public.alert_dismissals
for delete
using (
  user_id = auth.uid()
  and tenant_id = (
    select t.id
    from public.tenants t
    where t.owner_user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
