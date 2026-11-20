# Raport securitate 1 — funcțiile apelabile fără cont + search_path

Branch: `redesign/securitate-1` (din `main` `81a887b`). Migrarea e scrisă, **neaplicată**.

## Ce am citit (doar select, producție `ilybohhdeplwcrbpblqw`)

- **Drepturile pe cele 7 funcții** (`pg_proc.proacl`): toate cele 6 SECURITY DEFINER au `anon=X` **explicit**, nu doar prin PUBLIC. 5 din 6 au și `=X` (PUBLIC); `get_public_farmer_card` are doar `anon=X` explicit (PUBLIC fusese deja retras). `merge_clienti_duplicates(uuid, uuid, uuid[], text)` are o singură semnătură și e SECURITY INVOKER.
- **Corpul `bridge_shop_order_to_comenzi()`**: folosește `clienti`, `comenzi` necalificate (din `public`) și `jsonb_array_elements`, `coalesce`, `round` (din `pg_catalog`). Nimic din `extensions`. Nu avea `search_path`.
- **Corpul `merge_clienti_duplicates`**: toate tabelele calificate `public.*`; restul e plpgsql simplu. Nimic din `extensions`.
- **`pg_default_acl` în `public`**, pentru funcții (`f`):
  - `postgres`: `{postgres=X, anon=X, authenticated=X, service_role=X}`;
  - `supabase_admin`: la fel.
  - Valori globale (`defaclnamespace = 0`): niciuna, deci PUBLIC primește EXECUTE din valoarea implicită a PostgreSQL.
- **`grep` în `src/` și `supabase/functions/`**: doar `deliver_and_clone_comanda` e folosită (`src/lib/supabase/queries/comenzi.ts`, din aplicație, cu sesiune). Celelalte 5 nu apar nicăieri în afară de migrări și `src/types/supabase.ts`. Edge functions (`fetch-meteo`, `get-meteo`) nu le folosesc.

## Migrarea

`supabase/migrations/20261120110000_revoke_anon_secdef.sql`:

```sql
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
```

## Drepturile implicite: da, le-am schimbat

Condiția din prompt e îndeplinită: în `pg_default_acl`, rolul `postgres` dă pe funcțiile noi din `public` grant **explicit** lui `authenticated` și `service_role`. Deci scoaterea lui `anon` nu taie aplicația de funcțiile viitoare.

De ce contează: cauza reală nu era doar PUBLIC. Regula implicită dădea `anon=X` **explicit** la fiecare `create function`, așa că recrearea unei funcții o făcea iar apelabilă fără cont.

Ce nu rezolvă regula: PostgreSQL adună regulile pe schemă peste cele globale și nu poate retrage pe schemă un drept dat global. `revoke ... from public` din regula pe schemă nu are efect, iar o funcție nouă va primi tot `EXECUTE` pentru PUBLIC (deci și pentru anon, prin PUBLIC). Două variante pentru mai târziu:

- fiecare migrare care creează o funcție SECURITY DEFINER scrie și `revoke execute ... from public, anon` (simplu, local);
- sau `alter default privileges for role postgres revoke execute on functions from public;` **fără** `in schema`. Asta afectează toate schemele, deci trebuie verificat întâi că nu există funcții noi în alte scheme pe care `authenticated` le folosește doar prin PUBLIC. N-am pus-o, e în afara promptului.

Regula pentru `supabase_admin` n-am atins-o: migrările rulează ca `postgres`.

## Verificarea de după aplicare (o rulați voi)

```sql
select p.proname, has_function_privilege('anon', p.oid, 'execute') anon_poate,
       has_function_privilege('authenticated', p.oid, 'execute') auth_poate
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'deliver_and_clone_comanda','reconcile_unbridged_shop_orders','get_public_farmer_card',
  'bridge_shop_order_to_comenzi','set_shop_order_dup_phone_warning','sync_shop_order_status_from_comanda');
```

Așteptat: `anon_poate = false`, `auth_poate = true` peste tot. Apoi, în demo, „Livrează și programează următoarea” din Livrări merge ca înainte. Opțional: `select proconfig from pg_proc where proname in ('merge_clienti_duplicates','bridge_shop_order_to_comenzi');` arată `search_path=public, pg_temp`.

## Funcțiile de trigger dintre cele 81 (pentru o curățenie viitoare, NU retrase acum)

Cele 81 = 75 de funcții SECURITY DEFINER apelabile de `authenticated` + cele 6 din migrare. Dintre ele, cele cu `()` și `returns trigger`:

Cele 3 din migrarea de azi (rămân pe `authenticated`):
- `bridge_shop_order_to_comenzi`
- `set_shop_order_dup_phone_warning`
- `sync_shop_order_status_from_comanda`

Celelalte 17:
- `check_culturi_suprafata`
- `enforce_association_listed_by_association_only`
- `enforce_produse_association_field_updates`
- `enforce_produse_requires_legal_docs`
- `enforce_superadmin_for_plan_change`
- `enforce_tenant_association_approval_superadmin_only`
- `enforce_vanzari_butasi_items_tenant`
- `handle_auth_user_created`
- `handle_new_auth_user_profile`
- `handle_new_user`
- `protect_profiles_privileged_fields`
- `set_analytics_event_context`
- `set_audit_fields_minimal`
- `set_comenzi_tenant_and_audit`
- `set_sync_audit_fields`
- `set_tenant_id_from_owner`
- `set_vanzari_butasi_tenant_and_public_id`

## De reținut

- `merge_clienti_duplicates` e tot apelabilă de `anon`, dar e SECURITY INVOKER: rulează cu drepturile celui care apelează, sub RLS. Promptul nu cere retragerea; se poate face la curățenia viitoare.
- Migrarea din iunie (`20260617044924`) păstrase intenționat `anon` pe `get_public_farmer_card`. Acum îl retragem pentru că nimic din cod nu o mai folosește. Dacă o pagină publică o va folosi pe viitor, trebuie dat dreptul înapoi explicit.
