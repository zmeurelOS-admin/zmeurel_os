create or replace function public.current_tenant_id()
returns uuid
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id
  from public.profiles
  where id = auth.uid()
  limit 1;

  return v_tenant_id;
end;
$$;

notify pgrst, 'reload schema';
