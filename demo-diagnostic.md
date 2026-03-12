# Demo Data Diagnostic

## 1) `src/app/auth/callback/route.ts` (citit complet)

- `seed_demo_for_tenant` este apelat la **linia 250**:
  - `await supabase.rpc('seed_demo_for_tenant', { p_tenant_id: tenantStatus.id })`
- Parametrul trimis este:
  - `p_tenant_id: tenantStatus.id` (linia 251)
- După `ensureTenantForUser`:
  - se citește tenantul curent: `select('id, demo_seeded').eq('owner_user_id', user.id).single()` (liniile 237-241)
  - dacă `!tenantStatus.demo_seeded`, rulează RPC seed (liniile 249-253)
  - altfel face skip (`tenant.demo_seed_skip`, liniile 263-267)
- Există `try/catch`:
  - pentru `ensureTenantForUser` (liniile 210-227)
  - pentru seeding (liniile 236-281)
  - plus `try/catch` global în handler (liniile 316-448)
- Erorile **nu sunt înghițite silențios**: sunt logate + capturate (Sentry) și urmează redirect cu cod eroare.

## 2) Definiția SQL `seed_demo_for_tenant` în migrări

Fișierul cel mai nou care o redefinește:  
`supabase/migrations/2026030403_seed_demo_service_role_auth_guard.sql`

- Semnătură:
  - `create or replace function public.seed_demo_for_tenant(p_tenant_id uuid) returns jsonb` (liniile 4-7)
- Guard-uri:
  - `p_tenant_id` obligatoriu, altfel `TENANT_REQUIRED` (31-33)
  - autorizare (`service_role` sau `user_can_manage_tenant`), altfel `UNAUTHORIZED` (40-49)
  - dacă `demo_seeded = true` => return `status: already_seeded` (57-63)
  - dacă `tenant_has_core_data(...)` => return `status: skipped_existing_data` (65-70)
- Tabele populate (insert demo):
  - `parcele` (75-108)
  - `culegatori` (110-136)
  - `clienti` (138-164)
  - `recoltari` (166-175)
  - `cheltuieli_diverse` (177-184)
  - `vanzari` (186-193)
  - `comenzi` (195-202)
- Actualizare flags tenant după seed:
  - `demo_seeded = true`, `demo_seed_id = v_seed_id`, `demo_seeded_at = now()` (204-210)
- Return:
  - returnează `jsonb` (`status: seeded` etc., 212-216)
  - în cazuri invalide/unauthorized aruncă excepții (`raise exception`).

## 3) Tabelul `tenants`

- Coloanele există în migrarea:
  - `supabase/migrations/2026022706_demo_seed_first_signup.sql`:
  - `demo_seeded` (linia 7)
  - `demo_seeded_at` (linia 9)
- După seed, funcția setează:
  - `demo_seeded = true`
  - `demo_seeded_at = now()`
  (confirmat în SQL: 2026030403 liniile 206-208; și 2026022706 liniile 423-425)
- Verificare valoare efectivă în DB runtime:
  - nu poate fi confirmată doar din cod (fără query în baza live).

## 4) Toate aparițiile `seed_demo` (`rg -n "seed_demo" src/ supabase/`)

- `src/app/auth/callback/route.ts:250`
- `supabase/migrations/2026022710_demo_seed_realistic_refresh.sql:4`
- `supabase/migrations/2026022710_demo_seed_realistic_refresh.sql:311`
- `supabase/migrations/2026022706_demo_seed_first_signup.sql:161`
- `supabase/migrations/2026022706_demo_seed_first_signup.sql:523`
- `supabase/migrations/2026030402_demo_seed_today_dataset.sql:4`
- `supabase/migrations/2026030402_demo_seed_today_dataset.sql:211`
- `supabase/migrations/2026030403_seed_demo_service_role_auth_guard.sql:4`
- `supabase/migrations/2026030403_seed_demo_service_role_auth_guard.sql:220`
- `supabase/migrations/2026030403_seed_demo_service_role_auth_guard.sql:221`

## 5) API routes pentru seed demo

- Calea `src/app/api/demo/seed/` **există ca director**, dar nu conține fișier `route.ts` (nici alt fișier).
- `src/app/api/demo/reset/` există de asemenea ca director gol.
- Rezultat: nu există endpoint API activ care să execute seed demo.
- Căutarea în `src` pentru `/api/demo/seed` nu a găsit apelanți.

## 6) VERDICT (de ce nu apare demo-ul)

În codul actual, callback-ul **apelează corect** `seed_demo_for_tenant` (route.ts:250), deci lipsa demo data nu este din "apel lipsă".

Cauzele probabile reale, pe baza codului:

1. `seed_demo_for_tenant` face skip dacă tenantul e deja marcat `demo_seeded=true` sau dacă detectează date existente (`tenant_has_core_data`), deci nu va insera demo din nou.
2. Endpointul `DELETE /api/gdpr/farm` șterge datele operaționale, dar **nu resetează** `tenants.demo_seeded/demo_seeded_at`; asta poate lăsa tenantul gol dar marcat ca seeded, iar callback-ul va face skip la seed.
3. Nu există API route `src/app/api/demo/seed/route.ts` care să permită reseed manual din app (directorul există, dar e gol).

Concluzie exactă: fluxul de apel există, dar starea tenantului (`demo_seeded` / `tenant_has_core_data`) poate bloca inserarea; în plus, ștergerea datelor fermei fără reset de flag creează un scenariu în care dashboard-ul rămâne gol.
