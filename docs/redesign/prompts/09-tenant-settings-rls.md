# Prompt 09 — Corectură: RLS pe `tenant_settings` + salvarea setărilor

Model: Opus 5.5 · Effort: medium · Mod: normal (fără plan) · Sesiune: NOUĂ · Branch: `redesign/cheltuieli-vanzari` (vârful lanțului) · Rezultat: o migrare nouă, scrisă și **neaplicată**, plus erorile de salvare vizibile

## Problema (verificată prin citire în producție, 20.11.2026)

Politicile RLS de pe `public.tenant_settings` folosesc un model vechi, pe care aplicația nu îl setează niciodată:

- `Users can view own tenant settings` (SELECT): `tenant_id = current_setting('app.current_tenant_id', true)::uuid`
- `Users can update own tenant settings` (UPDATE): aceeași condiție
- `Users can insert own tenant settings` (INSERT, with check): aceeași condiție

Cererile din aplicație nu setează `app.current_tenant_id`. Urmările:

- citirea întoarce mereu 0 rânduri (azi tabelul are **0 rânduri** în producție; nici `latitudine_default` din Setări nu s-a salvat vreodată);
- insert / upsert pică pe RLS.

Prețul standard, „Ce arată Acasă” și cardul „Începem extrasezonul?” nu s-ar salva nici după migrarea `20261120090000_redesign_noapte.sql`.

Celelalte tabele folosesc `current_tenant_id()`. Modelul din `clienti` / `comenzi`:
- SELECT: `tenant_id = current_tenant_id()`
- INSERT / UPDATE: `(tenant_id = current_tenant_id()) and (is_tenant_owner(tenant_id) or operator_can_write('<tabel>'))`

Există și `unique (tenant_id)` (`tenant_settings_tenant_id_key`), deci `upsert` pe `tenant_id` e corect.

## Ce faci

1. **Migrare nouă**, separată: `supabase/migrations/20261120100000_tenant_settings_rls.sql`.
   - `drop policy if exists` pe cele trei politici de mai sus și `create policy` noi, pe modelul de mai sus:
     - `tenant_settings_select`: `tenant_id = current_tenant_id()`;
     - `tenant_settings_insert` și `tenant_settings_update`: `(tenant_id = current_tenant_id()) and is_tenant_owner(tenant_id)` (setările fermei le schimbă doar proprietarul; operatorii doar le citesc). La UPDATE, aceeași condiție și în `with check`.
     - Fără politică de DELETE.
   - Verifici prin citire (migrările din repo) că `current_tenant_id()` și `is_tenant_owner(uuid)` există cu exact aceste semnături.
   - Fără `update` / `delete` pe date, fără alte tabele. Antet cu explicația. Idempotent.
   - **Nu o aplici.**
2. **Erorile de salvare se văd.** În `src/lib/farm-settings.ts` și în ecranele care scriu în `tenant_settings` (Setări › Preț standard, Ce arată Acasă, cardul „Începem extrasezonul?” din Acasă, `latitudine_default` din Setări): dacă scrierea pică (RLS, rețea), utilizatorul vede un mesaj clar („Nu s-a putut salva. Încearcă din nou.”), iar ecranul nu arată valoarea ca salvată. Fără eșecuri tăcute. Un test pentru cazul de eroare.
3. Raportul: adaugi în `docs/redesign/raport-noapte.md` o secțiune „Corectura de dimineață”: migrarea nouă, de ce trebuie rulată **împreună** cu prima și ce s-a schimbat în cod.
4. Verificări: `npm run lint` (doar cele 2 erori vechi), `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit`, `npm run build`. Apoi `git restore public/sw.js`, commit, `git push origin redesign/cheltuieli-vanzari`. **STOP. Fără merge.**

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
