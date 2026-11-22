-- Funcțiile SECURITY DEFINER care primesc ferma ca parametru și NU verifică cine le cheamă
-- nu mai sunt apelabile direct de utilizatorii logați (`authenticated`). Rămân pentru `service_role`.
--
-- NEAPLICATĂ: o rulează Andrei. Promptul 24, partea 1.
--
-- De ce: toate rulează ca `postgres` (ocolesc RLS) și au `EXECUTE` pentru `authenticated`. Oricine are un cont
-- (inclusiv un demo de 30 de secunde) le putea chema prin PostgREST (`/rest/v1/rpc/...`) cu ferma altcuiva:
--   - sync_recoltare_stock_movements: ȘTERGE și scrie rânduri în `miscari_stoc` pentru orice fermă;
--   - consume_active_stock_reservations_for_comanda: scrie în `miscari_stoc` și `stock_reservations` pentru orice fermă;
--   - reserve_sellable_cal1_stock: scrie rezervări de stoc pentru orice fermă;
--   - list_sellable_cal1_buckets_for_reservation: citește stocul oricărei ferme;
--   - resolve_recoltare_stock_identity: citește cultura/soiul parcelelor oricărei ferme;
--   - resolve_zmeura_produs_id, tenant_has_core_data: află date despre orice fermă;
--   - validate_suprafata_culturi: citește suprafața oricărei parcele (după id);
--   - check_recent_shop_order: caută comenzile din magazin ale oricărei ferme după telefon (produse, sumă);
--   - place_preorder_atomic: scrie comenzi în magazinul oricărei ferme, ocolind validările rutei;
--   - create_vanzare_with_stock, update_vanzare_with_stock, delete_vanzare_with_stock: verifică ferma, dar nu
--     și dreptul: un operator doar-citire putea crea, schimba sau ȘTERGE vânzări (bani).
--
-- Cine le folosește azi (verificat în cod și în `pg_proc`, 22.11.2026):
--   - aplicația NU le cheamă cu sesiunea utilizatorului. `check_recent_shop_order` și `place_preorder_atomic`
--     sunt chemate de rutele magazinului cu service role (`getSupabaseAdmin()`), care rămâne cu drept.
--   - celelalte sunt chemate doar din alte funcții SECURITY DEFINER (deliver_order_atomic, delete_comanda_atomic,
--     reopen_comanda_atomic, set_*_in_delivery_with_reservation, promote_shop_order_to_comanda, seed_demo_for_tenant,
--     cultura_recoltare_stoc) sau din triggere (check_culturi_suprafata). Acelea rulează ca `postgres`, deci
--     apelul din interior nu are nevoie de dreptul lui `authenticated`.
--   - `vanzari` se scriu în aplicație prin set_comanda_delivered, livreaza_si_copiaza_comanda, mark_comanda_incasata,
--     adauga_plata_vanzare (neatinse) și prin `setVanzareStatusPlata` (update direct, proprietar).
--
-- Aplicația merge fără migrare (comportamentul de azi) și cu ea (nimic din aplicație nu le cheamă ca utilizator).
-- Dacă o pagină ar avea nevoie de una dintre ele pe viitor: funcția trebuie întâi să verifice `auth.uid()`,
-- `current_tenant_id()` și dreptul, apoi primește din nou `EXECUTE`.
--
-- Doar drepturi: fără schimbări de corp, fără tabele, fără date. Se poate rula de mai multe ori.
-- Anulare: `grant execute on function <semnătura> to authenticated;` pentru fiecare.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'sync_recoltare_stock_movements',
        'consume_active_stock_reservations_for_comanda',
        'reserve_sellable_cal1_stock',
        'list_sellable_cal1_buckets_for_reservation',
        'resolve_recoltare_stock_identity',
        'resolve_zmeura_produs_id',
        'tenant_has_core_data',
        'validate_suprafata_culturi',
        'check_recent_shop_order',
        'place_preorder_atomic',
        'create_vanzare_with_stock',
        'update_vanzare_with_stock',
        'delete_vanzare_with_stock'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.signature);
    execute format('grant execute on function %s to service_role', fn.signature);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Verificarea de după aplicare:
--   select p.oid::regprocedure, has_function_privilege('authenticated', p.oid, 'execute') as auth_poate
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname in ('sync_recoltare_stock_movements', 'place_preorder_atomic', ...);
-- Așteptat: auth_poate = false. Apoi în demo: o comandă din magazin, „Pune în livrare”, livrarea, ștergerea unei
-- comenzi livrate merg ca înainte.
