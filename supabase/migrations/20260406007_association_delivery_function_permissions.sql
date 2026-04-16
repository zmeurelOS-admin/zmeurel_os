do $$
begin
  execute 'revoke all on function public.mark_association_order_delivered_atomic(uuid, uuid[]) from public';
  execute 'grant execute on function public.mark_association_order_delivered_atomic(uuid, uuid[]) to authenticated';
  execute 'grant execute on function public.mark_association_order_delivered_atomic(uuid, uuid[]) to service_role';
  perform pg_notify('pgrst', 'reload schema');
end
$$;
