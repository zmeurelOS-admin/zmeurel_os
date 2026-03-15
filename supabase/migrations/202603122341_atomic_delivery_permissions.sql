do $$
begin
  execute 'revoke all on function public.resolve_recoltare_stock_identity(uuid, text, uuid) from public';
  execute 'revoke all on function public.sync_recoltare_stock_movements(uuid, uuid, uuid, date, numeric, numeric, text) from public';

  execute 'revoke all on function public.create_recoltare_with_stock(date, uuid, uuid, numeric, numeric, text, uuid) from public';
  execute 'grant execute on function public.create_recoltare_with_stock(date, uuid, uuid, numeric, numeric, text, uuid) to authenticated';
  execute 'grant execute on function public.create_recoltare_with_stock(date, uuid, uuid, numeric, numeric, text, uuid) to service_role';

  execute 'revoke all on function public.update_recoltare_with_stock(uuid, date, uuid, uuid, numeric, numeric, text) from public';
  execute 'grant execute on function public.update_recoltare_with_stock(uuid, date, uuid, uuid, numeric, numeric, text) to authenticated';
  execute 'grant execute on function public.update_recoltare_with_stock(uuid, date, uuid, uuid, numeric, numeric, text) to service_role';

  execute 'revoke all on function public.delete_recoltare_with_stock(uuid) from public';
  execute 'grant execute on function public.delete_recoltare_with_stock(uuid) to authenticated';
  execute 'grant execute on function public.delete_recoltare_with_stock(uuid) to service_role';

  execute 'revoke all on function public.deliver_order_atomic(uuid, numeric, text, date) from public';
  execute 'grant execute on function public.deliver_order_atomic(uuid, numeric, text, date) to authenticated';
  execute 'grant execute on function public.deliver_order_atomic(uuid, numeric, text, date) to service_role';

  perform pg_notify('pgrst', 'reload schema');
end
$$;
