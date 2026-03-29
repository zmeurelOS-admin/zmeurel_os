do $$
begin
  execute 'revoke all on function public.delete_comanda_atomic(uuid, uuid) from public';
  execute 'grant execute on function public.delete_comanda_atomic(uuid, uuid) to authenticated';
  execute 'grant execute on function public.delete_comanda_atomic(uuid, uuid) to service_role';
  execute 'revoke all on function public.reopen_comanda_atomic(uuid, uuid) from public';
  execute 'grant execute on function public.reopen_comanda_atomic(uuid, uuid) to authenticated';
  execute 'grant execute on function public.reopen_comanda_atomic(uuid, uuid) to service_role';
exception
  when undefined_function then
    null;
end;
$$;

notify pgrst, 'reload schema';
