-- Funcțiile SECURITY DEFINER nu mai sunt apelabile fără cont.
-- Retragem de la PUBLIC și anon; dăm explicit authenticated + service_role,
-- ca aplicația să meargă la fel (authenticated avea dreptul prin PUBLIC).
--
-- Funcțiile de trigger (cele cu `()` și `returns trigger`) rulează și fără
-- EXECUTE pentru cel care face insert/update: PostgreSQL verifică dreptul doar
-- la CREATE TRIGGER. Retragerea nu oprește triggerele.
--
-- Doar drepturi și setări de funcții: fără drop, fără tabele, fără date.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.deliver_and_clone_comanda(uuid, numeric, date)',
    'public.reconcile_unbridged_shop_orders(uuid, integer)',
    'public.get_public_farmer_card(uuid)',
    'public.bridge_shop_order_to_comenzi()',
    'public.set_shop_order_dup_phone_warning()',
    'public.sync_shop_order_status_from_comanda()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- Ambele folosesc doar nume din public (calificate sau nu) și din pg_catalog;
-- nimic din extensions.
alter function public.merge_clienti_duplicates(uuid, uuid, uuid[], text) set search_path = public, pg_temp;
alter function public.bridge_shop_order_to_comenzi() set search_path = public, pg_temp;

-- Drepturile implicite pentru funcțiile noi create de postgres în public dau
-- EXECUTE explicit lui anon (pe lângă authenticated și service_role), așa că o
-- funcție recreată ajunge din nou la anon. Scoatem anon de aici;
-- authenticated și service_role își păstrează grantul implicit explicit.
-- Notă: `from public` într-o regulă pe schemă nu are efect (dreptul PUBLIC vine
-- din valorile globale, nu din cele pe schemă); îl lăsăm pentru claritate.
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;
