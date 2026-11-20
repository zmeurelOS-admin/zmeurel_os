# Prompt 11 — Securitate: funcțiile apelabile fără cont + search_path

Model: Opus 5.5 · Effort: medium · Mod: normal (fără plan) · Sesiune: NOUĂ · Branch: `redesign/securitate-1` (pornit din `main` `81a887b`) · Rezultat: migrare scrisă (NEAPLICATĂ), branch verde, cu push, fără merge

## Context

Avertismentele de securitate Supabase (20.11) arată:

1. **6 funcții `SECURITY DEFINER` pot fi apelate de rolul `anon`** (fără cont), prin `/rest/v1/rpc/...`:
   - RPC-uri adevărate:
     - `deliver_and_clone_comanda(uuid, numeric, date)`;
     - `reconcile_unbridged_shop_orders(uuid, integer)`;
     - `get_public_farmer_card(uuid)`.
   - Funcții de trigger:
     - `bridge_shop_order_to_comenzi()`;
     - `set_shop_order_dup_phone_warning()`;
     - `sync_shop_order_status_from_comanda()`.

   Le-am citit: primele două opresc orice apel fără `auth.uid()` („Neautorizat”), iar funcțiile de trigger nu pot fi apelate direct. Deci riscul real e mic. Totuși, `get_public_farmer_card` dă oricui numele, localitatea și forma juridică a fermierului după `tenant_id`, iar în cod nu o folosește nimeni. Regula noastră e: **nimic apelabil fără cont dacă nu trebuie**.

   Cauza: migrarea din iunie (`20260617044924_revoke_anon_secdef_functions.sql`) a retras dreptul. Migrările de după au recreat funcțiile, iar o funcție nouă primește automat `EXECUTE` pentru `PUBLIC`.
2. **2 funcții fără `search_path` fix:** `merge_clienti_duplicates`, `bridge_shop_order_to_comenzi`.
3. Nu le atingi:
   - **cele 81 de funcții apelabile de `authenticated`**: sunt RPC-urile aplicației și funcțiile de trigger;
   - **`clienti_merge_audit`**, care are RLS fără politici: e „nimeni nu citește”, intenționat.

## Ce faci

1. **Citești înainte să scrii** (doar `select`, prin Supabase MCP sau SQL editor în citire):
   - corpul funcțiilor `merge_clienti_duplicates` și `bridge_shop_order_to_comenzi`. Verifici că numele folosite sunt fie calificate, fie din `public` / `pg_catalog`, ca `search_path = public, pg_temp` să nu strice nimic. Dacă folosesc ceva din `extensions` (ex. `gen_random_bytes`), pui `public, extensions, pg_temp`;
   - `select * from pg_default_acl where defaclnamespace = 'public'::regnamespace;`: vezi ce drepturi implicite primesc funcțiile noi;
   - `grep` în `src/` și în `supabase/functions/` (dacă există) după cele 6 nume, ca să confirmi că nimic nu le apelează fără cont.
2. **Migrarea** `supabase/migrations/20261120110000_revoke_anon_secdef.sql`, cu conținutul de bază de mai jos (ajustezi doar `search_path` după pasul 1):

   ```sql
   -- Funcțiile SECURITY DEFINER nu mai sunt apelabile fără cont.
   -- Retragem de la PUBLIC și anon; dăm explicit authenticated + service_role,
   -- ca aplicația să meargă la fel (authenticated avea dreptul prin PUBLIC).
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

   alter function public.merge_clienti_duplicates set search_path = public, pg_temp;
   alter function public.bridge_shop_order_to_comenzi() set search_path = public, pg_temp;
   ```

   - Dacă `merge_clienti_duplicates` are mai multe semnături, scrii semnătura exactă.
   - Funcțiile de trigger rulează și fără `EXECUTE` pentru cel care face insert/update: PostgreSQL verifică dreptul doar la `CREATE TRIGGER`. Deci retragerea nu oprește triggerele. Notezi asta în comentariul migrării.
   - **Drepturile implicite, ca să nu se repete:**
     - adaugi `alter default privileges for role postgres in schema public revoke execute on functions from public, anon;` **doar dacă** pasul 1 arată că `authenticated` și `service_role` au grant implicit explicit pe funcții (nu doar prin `PUBLIC`);
     - altfel nu atingi drepturile implicite și scrii în raport de ce.
   - Migrarea e doar pe drepturi și setări de funcții: fără `drop`, fără schimbări de tabele sau date.
3. **NU aplici migrarea.** O aplicăm noi prin MCP, după ce o citim.
4. **Verificarea de după aplicare**, scrisă în raport, ca s-o rulăm noi:

   ```sql
   select p.proname, has_function_privilege('anon', p.oid, 'execute') anon_poate,
          has_function_privilege('authenticated', p.oid, 'execute') auth_poate
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname in (
     'deliver_and_clone_comanda','reconcile_unbridged_shop_orders','get_public_farmer_card',
     'bridge_shop_order_to_comenzi','set_shop_order_dup_phone_warning','sync_shop_order_status_from_comanda');
   ```

   Rezultatul așteptat: `anon_poate = false`, `auth_poate = true` peste tot. Apoi, în demo, „Livrează și programează următoarea” din Livrări merge ca înainte.
5. **Raport scurt** în `docs/redesign/raport-securitate-1.md`:
   - ce ai citit;
   - migrarea;
   - de ce ai pus sau nu drepturile implicite;
   - lista funcțiilor de trigger dintre cele 81 (cele cu `()` și `returns trigger`), pentru o curățenie viitoare în care le retragem și de la `authenticated`. **Nu le retragi acum.**
6. Verificări: `npm run lint` (doar cele 2 erori vechi), `npm run typecheck`, `npm run build`. Apoi `git restore public/sw.js`, commit, `git push origin redesign/securitate-1`. **STOP. Fără merge.**

## Ce face Andrei separat (nu e treaba ta)

Pornește protecția împotriva parolelor compromise din setările de parole ale Supabase Auth.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
