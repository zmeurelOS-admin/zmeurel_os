-- Funcțiile de trigger SECURITY DEFINER nu se mai pot apela direct (RPC) de niciun rol al aplicației.
--
-- NEAPLICATĂ: o rulează Andrei, după merge.
--
-- Lista e luată din baza de producție pe 21.11.2026, nu ghicită:
--   select p.oid::regprocedure
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef and p.prorettype = 'trigger'::regtype;
-- Atunci: 20 de funcții, toate fără argumente. anon nu le mai putea executa (migrarea
-- 20261120110000_revoke_anon_secdef.sql și cele dinainte), authenticated încă putea.
--
-- Execuția unui trigger nu verifică EXECUTE pentru cel care face insert/update: PostgreSQL verifică
-- dreptul doar la CREATE TRIGGER. Triggerele (inclusiv cele de pe auth.users) merg mai departe.
-- service_role și postgres își păstrează dreptul. Niciuna nu e apelată cu `.rpc(...)` din aplicație
-- (verificat cu grep în src/ și scripts/).
--
-- Doar drepturi: fără drop, fără tabele, fără date.

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.bridge_shop_order_to_comenzi()',
    'public.check_culturi_suprafata()',
    'public.enforce_association_listed_by_association_only()',
    'public.enforce_produse_association_field_updates()',
    'public.enforce_produse_requires_legal_docs()',
    'public.enforce_superadmin_for_plan_change()',
    'public.enforce_tenant_association_approval_superadmin_only()',
    'public.enforce_vanzari_butasi_items_tenant()',
    'public.handle_auth_user_created()',
    'public.handle_new_auth_user_profile()',
    'public.handle_new_user()',
    'public.protect_profiles_privileged_fields()',
    'public.set_analytics_event_context()',
    'public.set_audit_fields_minimal()',
    'public.set_comenzi_tenant_and_audit()',
    'public.set_shop_order_dup_phone_warning()',
    'public.set_sync_audit_fields()',
    'public.set_tenant_id_from_owner()',
    'public.set_vanzari_butasi_tenant_and_public_id()',
    'public.sync_shop_order_status_from_comanda()'
  ] loop
    -- O funcție dispărută între timp nu oprește migrarea.
    if to_regprocedure(f) is null then
      raise notice 'lipsește, sărită: %', f;
      continue;
    end if;
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- merge_clienti_duplicates: semnătura exactă din pg_proc. Nu e SECURITY DEFINER, dar avea EXECUTE pentru
-- PUBLIC și anon. Aplicația nu o apelează deloc acum (doar tipurile generate o au); când o va apela, va fi
-- ca utilizator logat. Rămân authenticated și service_role.
revoke execute on function public.merge_clienti_duplicates(uuid, uuid, uuid[], text) from public, anon;
grant execute on function public.merge_clienti_duplicates(uuid, uuid, uuid[], text) to authenticated, service_role;

-- Verificare după aplicare (trebuie să nu întoarcă niciun rând):
--   select p.oid::regprocedure
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef and p.prorettype = 'trigger'::regtype
--     and (has_function_privilege('anon', p.oid, 'EXECUTE')
--          or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
