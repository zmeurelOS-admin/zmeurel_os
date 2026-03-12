create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.profiles
  where id = auth.uid()
$$;

grant execute on function public.current_tenant_id()
to authenticated;

notify pgrst, 'reload schema';
