# Audit schemă public + seed demo + meteo (2026-03-31)

## 1. Sursa schemei (dump DB)

Comanda:

`npx supabase db dump --schema public -f docs/schema_dump.sql`

**Status:** cu **Docker** pornit, dump-ul este generat în **`docs/schema_dump.sql`** (schema `public` din DB-ul remote link-at).

Exemple de inspectare:

```bash
grep -n 'CREATE TABLE.*parcele' docs/schema_dump.sql
grep -n 'CREATE TABLE.*recoltari' docs/schema_dump.sql
```

**Sursă complementară:** `src/types/supabase.ts` + `supabase/migrations/`.

Rezumat **NOT NULL fără default** (după tipurile `Insert` — coloane fără `?`):

| Tabel | Coloane obligatorii tip Insert |
|-------|----------------------------------|
| `parcele` | `an_plantare`, `id_parcela`, `nume_parcela`, `suprafata_m2`, `status_operational`, `stadiu` |
| `clienti` | `id_client`, `nume_client` (+ altele după versiune) |
| `culegatori` | `id_culegator`, `nume_prenume` |
| `recoltari` | `data`, `id_recoltare`, `tenant_id` implicit; `client_sync_id` are default din trigger dacă lipsește |
| `comenzi` | Depinde de versiune; seed trimite set complet |
| `vanzari` | `client_sync_id`, `id_vanzare`, `cantitate_kg`, `data`, `pret_lei_kg`, `tenant_id` |
| `cheltuieli_diverse` | `id_cheltuiala`, `data`, `categorie`, `suma_lei` |
| `investitii` | `id_investitie`, `data`, `suma_lei`, `categorie` |
| `activitati_agricole` | `id_activitate`, `data_aplicare`, `tip_activitate` |

Tabelul `produse` nu apare în `src/types/supabase.ts` (tipuri nelinkate / regenerate parțial); schema funcțională este în `supabase/migrations/20260329001_create_produse.sql` + `2026040104_produse_demo_seed_columns.sql` (`data_origin`, `demo_seed_id`).

**FK:** Parcele → `tenants`. Recoltări → `parcele`, `culegatori`. Comenzi → `clienti`. Vânzări → `clienti`, `comenzi`. etc. (vezi `Relationships` în `supabase.ts`.)

**Triggers `recoltari` (migrări):**

- `trg_recoltari_sync_cantitate_kg` (BEFORE INSERT/UPDATE) — completează `cantitate_kg` din `kg_cal1`+`kg_cal2`; **nu** ridică `Neautorizat`.
- `recoltari_set_sync_audit_fields` (BEFORE INSERT/UPDATE) — setează `client_sync_id`, `sync_status`, `created_by`/`updated_by` din `auth.uid()` când e null; **nu** ridică `Neautorizat` pentru `INSERT` cu service role.

Mesajul **`Neautorizat` (P0001)** provine din funcții **`SECURITY DEFINER`** care fac `raise exception 'Neautorizat'` când `auth.uid() IS NULL` (ex.: `create_recoltare_with_stock`), **nu** din trigger-ele de mai sus. Seed-ul curent **nu** mai apelează aceste RPC-uri; folosește insert direct + mișcări `miscari_stoc`.

## 2. Ce trimite seed-ul (berries)

**Client:** `createServiceRoleClient()` (service role), în `seedDemoDataForTenant`.

**Ordine inserări:** `deleteDemoRows` (ordine inversă FK) → `parcele` → `clienti` → `culegatori` → `produse` → loop `recoltari` (insert + stoc) → `comenzi` → loop `vanzari` + `miscari_stoc` → `cheltuieli_diverse` → `investitii` → `activitati_agricole` → `culturi` (doar solar).

**RPC:** Nu pentru insert-uri principale; `generateBusinessId` este singurul RPC folosit pentru ID-uri de afaceri.

**Parcele (berries):** `id_parcela`, `nume_parcela`, `tip_unitate`, `cultura`, `tip_fruct`, `soi_plantat`, `suprafata_m2`, `an_plantare`, `status`, `rol`, `status_operational`, `stadiu`, `apare_in_dashboard`, `contribuie_la_productie`, `latitudine`, `longitudine`, `observatii`, `data_origin`, `demo_seed_id`.

**Mismatch-uri remediate în iterațiile anterioare:**

- `produse`: lipsea `data_origin`/`demo_seed_id` în DB — migrare `2026040104_*`.
- `recoltari`: RPC cu `auth.uid()` — înlocuit cu insert + `miscari_stoc` direct.
- Markere `[DEMO_FIXTURE_V2]` în câmpuri vizibile — eliminate; tracking pe `data_origin` / `demo_seed_id`.

## 3. Meteo — diagnostic 401 + CORS

### Observație din browser

Apel către `…/functions/v1/get-meteo` de pe `https://www.zmeurel.ro` → preflight CORS + 401.

### Cauze probabile

1. **`get-meteo` nu era definit în repo**; clientul (`useMeteo`) încearcă `fetch-meteo`, apoi fallback **`get-meteo`**. Dacă pe proiect există doar o funcție deploy-ată greșit sau **deloc** `get-meteo`, gateway-ul Supabase poate returna **401/404 fără headere CORS** ale handlerului → browser raportează „blocked by CORS policy”.
2. Handlerul `fetch-meteo` are CORS pe `OPTIONS` și pe răspunsuri JSON; **401 de la gateway** (înainte de Edge Function) nu poate fi controlat din codul funcției.

### Fix aplicat în cod

- **`supabase/functions/_shared/meteo-handler.ts`:** logică comună; CORS include și `x-supabase-authorization`.
- **`supabase/functions/fetch-meteo/index.ts`** și **`supabase/functions/get-meteo/index.ts`:** ambele apelează `handleMeteoRequest`.
- **`src/hooks/useMeteo.ts`:** trimite explicit `Authorization: Bearer <access_token>` din `getSession()`; încearcă `fetch-meteo` apoi `get-meteo`.

### Ce trebuie făcut pe Supabase (manual)

Deploy **ambele** funcții după merge:

```bash
npx supabase functions deploy fetch-meteo --project-ref ilybohhdeplwcrbpblqw
npx supabase functions deploy get-meteo --project-ref ilybohhdeplwcrbpblqw
```

**Secrets** (Dashboard → Edge Functions → Secrets sau CLI):

- `OPENWEATHER_API_KEY` sau `OPENWEATHERMAP_API_KEY` — obligatoriu pentru prognoză proaspătă (altfel răspuns `available: false` cu mesaj în JSON, dar **nu** CORS).
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — injectate automat de Supabase la runtime pentru funcții.

**Notă API:** Handlerul folosește `api.openweathermap.org/data/3.0/onecall` — necesită cheie cu acces One Call 3.0; dacă planul e invalid, vezi erori în body JSON, nu neapărat CORS.

### Coordonate meteo

Edge function citește prima parcelă **`rol = 'comercial'`** cu `latitudine` și `longitudine` **NOT NULL** (apoi fallback `tenant_settings`). Seed-ul setează coordonate Suceava și `rol`/`apare_in_dashboard`/`contribuie_la_productie` pentru parcele comerciale.

## 4. Race `/start`

Îmbunătățiri: mesaje de eroare agregate pe tabele, reset `chosenDemoType` la eroare / retry, toate cardurile rămân dezactivate cât timp `pendingAction !== null`.

## 5. Verificare finală

- `npx supabase db push` — dacă există migrări noi locale.
- `npx tsc --noEmit`

---

*Document incremental: regenerați dump-ul DB când Docker e disponibil și înlocuiți secțiunea 1 cu output real `CREATE TABLE` dacă este necesar.*
