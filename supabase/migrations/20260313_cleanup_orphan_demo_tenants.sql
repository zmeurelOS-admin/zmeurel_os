-- Cleanup orphan demo tenants (one-time migration).
-- Deletes all tenant data + tenant rows for guest users (@demo.zmeurel.local)
-- EXCEPT the protected superadmin account.
--
-- Run manually or as part of migration if needed.
-- Safe to run multiple times (idempotent via LEFT JOIN / NOT EXISTS patterns).

do $$
declare
  v_tenant_id uuid;
  v_user_id uuid;
begin
  -- For each demo tenant (user email ends with @demo.zmeurel.local)
  -- and was NOT converted (still has guest_mode metadata)
  for v_tenant_id, v_user_id in
    select t.id, t.user_id
    from public.tenants t
    join auth.users u on u.id = t.user_id
    where u.email ilike '%@demo.zmeurel.local'
      and u.email not ilike 'popa.andrei.sv@gmail.com'
  loop
    -- Child tables first to avoid FK violations
    delete from public.vanzari_butasi_items where tenant_id = v_tenant_id;
    delete from public.miscari_stoc          where tenant_id = v_tenant_id;
    delete from public.alert_dismissals      where tenant_id = v_tenant_id;
    delete from public.comenzi               where tenant_id = v_tenant_id;
    delete from public.vanzari_butasi        where tenant_id = v_tenant_id;
    delete from public.vanzari               where tenant_id = v_tenant_id;
    delete from public.recoltari             where tenant_id = v_tenant_id;
    delete from public.cheltuieli_diverse    where tenant_id = v_tenant_id;
    delete from public.activitati_agricole   where tenant_id = v_tenant_id;
    delete from public.investitii            where tenant_id = v_tenant_id;
    delete from public.clienti              where tenant_id = v_tenant_id;
    delete from public.culegatori            where tenant_id = v_tenant_id;
    delete from public.parcele               where tenant_id = v_tenant_id;
    delete from public.tenants               where id = v_tenant_id;

    raise notice 'Deleted demo tenant % for user %', v_tenant_id, v_user_id;
  end loop;
end;
$$;
