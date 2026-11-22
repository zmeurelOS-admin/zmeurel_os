# Raport 27 — Reparații mici după 26, igiena bazei, plasă de teste e2e

Branch: `redesign/mici-27`, pornit din `main` (`e85656a`). Fără merge. Două migrări scrise, **neaplicate**.
Din baza de date am citit doar cu `select` (`pg_proc`, `pg_constraint`, `pg_index`, `pg_policies`, `pg_class`,
`information_schema`, rânduri ale demo-urilor mele). Cronurile nu au fost apelate. `public/sw.js` nu e atins
(modificarea locală din el nu e a mea și nu e comisă).

## Rezumat pentru Andrei

1. **Raportul public**: soiurile apar o singură dată, cu virgulă („Zmeure Delniwa, Zmeure Maravilla · parcelele Delniwa Nord și Maravilla”). Același rând e pe pagină, în PDF și pe afiș.
2. **Numele fermei**: în raport (pagină, PDF, afiș) apare „Ferma demo” în loc de „tenant_demo_…”. Orice alt nume intern „tenant_…” devine „Ferma”. Regula e într-un singur helper, folosit deja de Acasă, Mai mult, Setări și invitație, iar acum și de cronul actelor.
3. **Reîncărcarea demo-ului** șterge întâi analiza demo (cu parcelele și substanțele ei), apoi pune una nouă. Analizele omului nu se ating. N-a fost nevoie de SQL. Am verificat în browser.
4. **`get_public_farmer_card`** spune „Atestat de producător”. Nu întorcea numărul și nici poza atestatului, dar întorcea `full_name` și `logo_url`, așa că i le-am scos. Aplicația nu cheamă funcția, deci magazinul nu se strică. Migrarea e `20261122120000`.
5. **Data culesului**: pe lista de parcele, eticheta „fără dată de cules” deschide foaia „Când începe culesul?” de pe fișă. Pe fișă și în foaia mementoului apare mesajul cerut când nicio parcelă nu are dată. Fără card nou în Acasă.
6. **Indexuri**: 24 noi, pe cheile străine și `tenant_id` fără index. Mesajul commit-ului spune greșit 25. Migrarea e `20261122121000`.
7. **`is_legal_docs_complete`** răspunde acum doar proprietarului, membrilor activi, asociației, superadminului și serverului. Ceilalți primesc `false`. Asociația și declanșatorul pe `produse` merg ca azi.
8. **`clienti_merge_audit`** rămâne fără politici: îl scrie doar scriptul de mentenanță, cu service role, iar aplicația nu-l citește.
9. **Smoke e2e**: `npm run test:e2e:smoke` cuprinde 7 pași pe un demo nou și trece de două ori la rând local, în ~55 s. Nu rulează în CI.
10. **Ordinea migrărilor**: oricare, înainte sau după merge. Aplicația merge la fel cu sau fără ele.

## 1. Ce am schimbat

### A1. Soiurile dublate (`b137d74`)

- Cauza: în demo (și la alte ferme) `parcele.cultura` și `parcele.soi_plantat` au același text („Zmeure Maravilla”). Raportul punea lista culturilor și, lângă ea, lista soiurilor, fără separator.
- `src/lib/analize/raport.ts`: `RaportAnaliza.cultura` devine `soiuri: string[]`, din `soiuriRaport` (nou, exportat). Pentru fiecare parcelă face o etichetă: dacă soiul conține cultura, rămâne soiul; dacă invers, cultura; altfel „cultură soi”. Etichetele se deduplică fără diacritice și majuscule și se leagă cu virgulă. `textParceleRaport` e folosit de pagină, PDF și afiș.
- Teste (`raport.test.ts`): cazul din producție, majuscule și diacritice diferite, doar cultura sau doar soiul, fără nimic, plus PDF-ul și afișul fără dublură.

### A2. Numele fermei (`c5d118f`)

- `src/lib/tenant/farm-display-name.ts`: `farmDisplayName` transformă acum și orice `tenant_…` în „Ferma”. Nou: `farmDisplayNameOrFallback(nume, { demo })`, care întoarce mereu un text („Ferma demo” pentru demo, „Ferma” altfel).
- `raport-server.ts` citește și `tenants.is_demo` și trimite numele afișat. `construiesteRaport` aplică și el regula, ca apărare.
- Am căutat restul locurilor vizibile. Acasă (`FarmSwitcher`), Mai mult, Setări (`farm-profile-server`), layout-ul și invitația operatorului foloseau deja `farmDisplayName`, deci primesc automat și regula `tenant_…`. Cronul `farmer-legal-docs-check` folosea `nume_ferma` brut; acum trece prin helper. Notificările din cronurile de dimineață și de seară nu conțin numele fermei. Magazinul și asociația n-au fost atinse (sunt pe lista „Ce NU atingi”).
- Teste: `farm-display-name.test.ts` și `raport.test.ts`.

### A3. Analiza orfană la reîncărcarea demo-ului (`792bd3e`)

- Reîncărcarea (`/api/demo/reload` → `reloadDemoDataForTenant` → `deleteDemoRows`) e în TypeScript, nu în SQL. `seed_demo_for_tenant` / `delete_demo_for_tenant` nu sunt folosite de această rută, deci **n-a fost nevoie de migrare**.
- `src/lib/demo/demo-analize.ts`: `deleteDemoAnalize`, chemată în `deleteDemoRows` înainte de parcele. Tabelul analizelor n-are `data_origin`, așa că analiza demo se recunoaște după textele puse doar de seed (`DEMO_ANALIZA_NOTA`, `DEMO_ANALIZA_CE_S_A_ANALIZAT`, acum constante folosite și la seed). Se șterge doar dacă **toate** parcelele ei sunt parcele demo care se șterg acum, sau dacă nu mai are nicio parcelă (cele rămase orfane de la reîncărcările vechi). Parcelele și substanțele pleacă în cascadă. Fișierele PV / buletin se șterg doar de sub prefixul fermei. Fără tabele, nu face nimic. Aceleași verificări de acces ca înainte: doar proprietarul, `validateSameOriginMutation`.
- Logica e pură (`analizeDemoDeSters`) și testată: analiza seed-ului, cea orfană, cea a omului, cea legată și de o parcelă reală (`src/lib/__tests__/demo-analize-stergere.test.ts`).
- **Verificat în browser** pe demo-ul `8306e96f-b7e1-48d9-82b7-22a965917576`: înainte de „Reîncarcă exemplele” exista analiza `65622e68…` (2 parcele). După, ea a dispărut, iar în loc a apărut `2f1af0b3…`, cu 2 parcele și 2 substanțe.

### A4. `get_public_farmer_card` (`c8c6cb6`, migrarea `20261122120000`)

- Definiția din producție întorcea `tenant_id, farm_name, full_name, locality, logo_url, legal_badge`. **Nu** întorcea numărul (`certificate_number`) și nici poza (`certificate_photo_url`) atestatului.
- `full_name` (numele persoanei) și `logo_url` nu sunt pe lista câmpurilor publice permise, așa că le-am scos. Au rămas `tenant_id` (parametrul primit), `farm_name`, `locality` și `legal_badge` („Atestat de producător” / PFA / II / SRL). Seria, valabilitatea și telefonul sunt permise, dar funcția nu le întorcea și nu le-am adăugat.
- **Magazinul nu se strică**: niciun `rpc('get_public_farmer_card')` în `src`. Nicio funcție și nicio vedere din bază nu o folosește (verificat în `pg_proc.prosrc` și `pg_views`). Am actualizat tipurile din `src/types/supabase.ts`.
- Fiindcă se schimbă coloanele întoarse, funcția se recreează (`drop` + `create`). Drepturile rămân ca în producție (`authenticated`, `service_role`).

### B. Data culesului, la vedere (`82a5016`)

- `src/lib/analize/cules.ts`: `faraDataCules`, `nicioParcelaCuDataCules`, plus textele `ETICHETA_FARA_DATA_CULES` și `MESAJ_FARA_DATA_CULES` (testate în `cules.test.ts`).
- `src/lib/analize/useEstimariCules.ts` (nou): estimările pentru lista de parcele, cu aceleași interogări și același cache ca mementoul, dar fără analize.
- **Lista de parcele**: o parcelă de vânzare fără dată (nici pusă de mână, nici din prima recoltare de anul trecut) are eticheta „fără dată de cules”, în card. E un buton separat de rând (nu unul în altul), cu ținta de 48 px și textul de 15 px, ca în regulile kitului. Atins, duce la `/parcele/<id>?cules=1`. Operatorul fără drept de scriere vede eticheta, dar nu o poate atinge.
- **Fișa parcelei** (`CulesSiAnalizaParcela`): `?cules=1` deschide foaia „Când începe culesul?” (dacă utilizatorul poate scrie), apoi parametrul pleacă din adresă. Dacă nicio parcelă de vânzare nu are dată, proprietarul vede „Pune data culesului pe parcele ca să primești mementoul.”
- **Foaia „Analiza dinainte de cules”** (`MementoAcasa`): când mementoul nu pornește fiindcă nicio parcelă nu are dată (`motiv: fara_data`), foaia se poate deschide din notificare (`/dashboard?memento=analize`). Arată mesajul și butonul „Mergi la parcele”. Fără card nou în Acasă.
- Verificat în browser (demo `8306e96f…`): am golit data de pe „Mure Thornfree”, iar eticheta a apărut doar pe ea. Atinsă, a deschis foaia pe fișă, iar `?cules=1` a dispărut. `check:kit` trece.

### C. Igiena bazei (`e6cbcdd`, migrarea `20261122121000`)

**C1. Indexurile adăugate (24).** Am pornit de la toate cheile străine cu o singură coloană și toate coloanele `tenant_id` din `public`, fără niciun index care să înceapă cu ele (`pg_constraint` + `pg_index`, 22.11.2026).

| Index | De ce |
|---|---|
| `ai_conversations (tenant_id)`, `capcane_montate (tenant_id)`, `capcane_verificari (tenant_id)`, `etape_cultura (tenant_id)` | RLS pe `tenant_id = current_tenant_id()` la fiecare citire; ștergerea fermei caută după el |
| `comenzi (client_id)` | comenzile unui client, ștergerea / unirea clienților |
| `comenzi (produs_id)` | stocul pe produs, ștergerea unui produs |
| `comenzi (parent_comanda_id)` parțial | livrarea parțială (comanda părinte) |
| `comenzi (linked_vanzare_id)` parțial | legătura cu vânzarea făcută la livrare |
| `vanzari (produs_id)` | stocul și rapoartele pe produs |
| `analize_fructe_parcele (parcela_id)` | fișa parcelei, cascada la ștergerea parcelei |
| `capcane_montate (aplicare_id)`, `capcane_verificari (aplicare_id)` parțiale | capcanele unei aplicări |
| `aplicari_tratament (produs_id / cultura_id / plan_linie_id / stoc_mutatie_id)` parțiale | catalogul, cultura, planul, mișcarea de stoc |
| `aplicari_tratament_produse (stoc_mutatie_id)` parțial | ștergerea mișcării de stoc |
| `planuri_tratament_linii (produs_id)` parțial, `parcele_planuri (plan_id)` | planurile de tratament |
| `culture_stage_logs (unitate_id)`, `solar_climate_logs (unitate_id)` | jurnalele pe solar |
| `vanzari_butasi (parcela_sursa_id)` parțial | ștergerea parcelei-sursă |
| `consent_events (order_id)` parțial | ștergerea comenzii (GDPR) |
| `tenants (owner_user_id)` | `isFarmOwner`, `is_tenant_owner()` din RLS, ștergerea contului |

Lăsate deoparte, intenționat:
- `created_by` / `updated_by` (cerința) și `audit_logs.actor_user_id`;
- tabelele asociației (`association_members.invited_by`, `association_product_offers.*`) și ale magazinului (`shop_campaign_adjustments.campaign_id`, `shop_campaign_milestones.reached_by_order_id`), care nu se ating în acest prompt;
- `stock_reservations.*` (moștenire);
- `farm_invites.used_by_user_id` și `alert_dismissals.user_id` (căutate mereu cu `tenant_id`, au deja indexuri compuse).

Fără `concurrently` (migrarea rulează în tranzacție). Tabelele au sub 2.000 de rânduri, deci indexurile se fac într-o clipă.

**C2. `is_legal_docs_complete`.** Răspunsul adevărat îl primesc:
- serverul (service role / editorul SQL: fără utilizator în JWT, dar nu `anon`);
- proprietarul fermei;
- membrii activi (`farm_members.is_active`);
- membrii asociației (aceeași regulă ca `list_association_farmer_legal_status`);
- superadminul.

Ceilalți primesc `false`. Cine o cheamă: cele 3 rute ale asociației (`/api/association/producers`, `/products`, `/products/create`), cu sesiunea staff-ului, care e în `association_members`, și declanșatorul `produse_legal_docs_guard` (`enforce_produse_requires_legal_docs`), unde `auth.uid()` e al celui care scrie în `produse` (proprietar, operator, asociație sau service role la seed). Toți intră în regula de mai sus, deci nimic nu se strică. Am verificat trupul funcției cu un `select` în producție (rulează, întoarce `false` pentru o fermă inexistentă).

**C3. `clienti_merge_audit`**: neschimbat. RLS e pornit, fără politici. În el scrie doar `merge_clienti_duplicates`, chemată de `scripts/dedupe-clienti-merge.ts` cu service role. Aplicația nu îl citește (niciun `from('clienti_merge_audit')` în `src`). Are 234 de rânduri. Observație, neschimbată: `merge_clienti_duplicates` e `SECURITY INVOKER` și are `EXECUTE` pentru `authenticated`. Un apel cu sesiunea unui utilizator ar pica la `insert` în audit (RLS fără politici) și s-ar anula cu totul, deci e inofensiv.

**C4. Politicile care ar beneficia de `(select …)`** (doar listate, nu schimbate). Din cele 280 de politici din `public`:
- 177 cheamă `current_tenant_id()` fără `(select …)`;
- 4 cheamă `auth.uid()` fără `(select …)` (`profiles_insert_own` și `notificari_preferinte_insert_own` / `_select_own` / `_update_own`).

Celelalte 60 cu `auth.*()` sunt deja învelite.

### D. Plasa de teste e2e (`2068d0a`)

- `playwright.smoke.config.ts` (nou), `e2e/smoke/demo.ts` (pornirea demo-ului, ieșirea din cont, filtrul de erori), `e2e/smoke/pasi-principali.spec.ts` (cei 7 pași, în serie, pe aceeași pagină și același demo). Scriptul: `npm run test:e2e:smoke`.
- Rulează pe build-ul de producție (`next start -p 3000`; folosește serverul dacă rulează deja). Profilul e Pixel 7, iar pasul 7 trece pe 375 × 812.
- Demo-ul se creează doar din interfață: contextul pornește fără cookie-uri, apoi `/start` → „Continuă fără cont” → „Fructe de pădure”. Testele scriu doar în acest demo. La final: `POST /api/auth/sign-out`.
- Pașii:
  1. Acasă fără erori de consolă din aplicație. Se filtrează rețeaua, `_vercel/insights` și `speed-insights`, care local dau 404.
  2. Recoltare: primul culegător, o parcelă fără pauză de tratament, 7 kg → „Salvat” → rândul „<culegător>, 7 kg” în listă.
  3. Comandă: primul client recent, 5 kg, azi → „Pune în livrare azi” (doar ea) → Livrări, „Livrat”, Cash, „Da, livrat” → stocul cal. 1 de pe Comenzi scade exact cu 5.
  4. Vânzare rapidă: 3 kg → „Vândut și încasat”.
  5. Cheltuială fără bon: Ambalaje, 42 lei → „Salvat” → rândul în listă.
  6. Analize: „Ultima analiză: Conform”, raportul din aplicație, linkul public deschis într-un context **fără cookie-uri** → 200. Arată „Conform” și „Ferma demo” (fără `tenant_`), cu soiurile o singură dată.
  7. Bara de jos pe 375 px: 5 linkuri.
- **Nu rulează în CI**: CI rulează doar `check.yml`, `e2e-checkout.yml`, `ai-chat-gate.yml` și `rls-tests.yml`. `playwright.config.ts` ignoră acum `smoke/**`, ca `npm run test:e2e` să nu-l ia de două ori.
- **Timpul**: 53,4 s și 53,2 s (7/7, de două ori la rând), plus ~3 s pornirea Playwright.

## 2. Migrările (scrise, NEAPLICATE) și ordinea lor

Amândouă se pot aplica înainte sau după merge, în orice ordine. Aplicația merge la fel cu sau fără ele.

| Migrarea | Aplicația fără ea | Când |
|---|---|---|
| `20261122120000_card_public_atestat.sql` | Merge (funcția nu e chemată din aplicație). Fără ea, funcția spune încă „Certificat producător” și întoarce `full_name` / `logo_url`. | Oricând |
| `20261122121000_igiena_indexuri_acte.sql` | Merge, doar mai lent la volum mare. `is_legal_docs_complete` rămâne deschisă oricărui cont logat. | Oricând |

Ordinea recomandată: `20261122120000`, apoi `20261122121000`. Dacă `20261122110000` / `20261122111000` (promptul 26) n-ar fi aplicate, indexul pe `analize_fructe_parcele` ar pica. În producție sunt aplicate (verificat 22.11.2026).

### `supabase/migrations/20261122120000_card_public_atestat.sql`

```sql
-- Promptul 27, A4: `get_public_farmer_card` spune „Atestat de producător”, nu „Certificat producător”, și întoarce
-- doar câmpuri publice permise.
--
-- NEAPLICATĂ: o rulează Andrei. Se poate aplica înainte sau după merge (aplicația nu cheamă funcția: niciun
-- `rpc('get_public_farmer_card')` în `src`, nicio altă funcție sau vedere din bază nu o folosește — verificat în
-- `pg_proc.prosrc` și `pg_views` pe 22.11.2026). Nu atinge date.
--
-- Definiția de pornire (producție, `pg_get_functiondef`, 22.11.2026) întorcea:
--   tenant_id, farm_name, full_name, locality, logo_url, legal_badge
-- Nu întorcea numărul atestatului (`certificate_number`) și nici poza (`certificate_photo_url`).
-- Câmpurile publice permise: numele fermei, localitatea, seria, valabilitatea, telefonul.
--   * `full_name` (numele persoanei din actele fermei) și `logo_url` nu sunt pe listă: ies.
--   * `legal_badge` rămâne (e eticheta formei juridice, cea care devine „Atestat de producător”).
--   * `tenant_id` rămâne (e chiar parametrul primit, nu o dată nouă).
--
-- Fiindcă se schimbă coloanele întoarse, funcția se recreează (`drop` + `create`; `create or replace` nu poate
-- scoate coloane). Drepturile rămân ca în producție: `authenticated` și `service_role`, fără `anon` / `PUBLIC`.
--
-- Anulare: definiția veche e în `20260406003_farmer_legal_docs_and_publication_guard.sql`.

begin;

drop function if exists public.get_public_farmer_card(uuid);

create function public.get_public_farmer_card(p_tenant_id uuid)
returns table (
  tenant_id uuid,
  farm_name text,
  locality text,
  legal_badge text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    t.id as tenant_id,
    t.nume_ferma as farm_name,
    coalesce(nullif(btrim(fld.locality), ''), nullif(btrim(t.localitate), '')) as locality,
    case fld.legal_type
      when 'certificat_producator' then 'Atestat de producător'
      when 'pfa' then 'PFA'
      when 'ii' then 'Întreprindere individuală'
      when 'srl' then 'SRL'
      else null
    end as legal_badge
  from public.tenants t
  join public.farmer_legal_docs fld
    on fld.tenant_id = t.id
  where t.id = p_tenant_id
    and fld.legal_docs_complete = true;
$function$;

revoke execute on function public.get_public_farmer_card(uuid) from public, anon;
grant execute on function public.get_public_farmer_card(uuid) to authenticated, service_role;

commit;
```

### `supabase/migrations/20261122121000_igiena_indexuri_acte.sql`

```sql
-- Promptul 27, C: igiena bazei de date. Doar aditiv: indexuri noi și `is_legal_docs_complete` restrânsă.
-- Nu atinge date. Nu modifică funcțiile `SECURITY DEFINER` chemate de aplicație și nici politicile RLS.
--
-- NEAPLICATĂ: o rulează Andrei. Se poate aplica înainte sau după merge: aplicația merge la fel cu sau fără ea
-- (indexurile doar grăbesc; `is_legal_docs_complete` întoarce același rezultat tuturor celor care o cheamă azi).
-- Se poate rula de mai multe ori (`if not exists`, `create or replace`).
-- Pornită din producție, doar cu citire (`pg_constraint`, `pg_index`, `pg_proc`, `pg_policies`), pe 22.11.2026.
--
-- ── C1. Indexuri pe cheile străine fără niciun index care să înceapă cu ele ─────────────────────────────────
-- De ce: filtrele aplicației și ale RLS (`tenant_id = current_tenant_id()`), join-urile, iar la ștergerea
-- rândului părinte (o parcelă, o comandă, o fermă) Postgres caută copiii după cheie: fără index, citește tot tabelul.
-- Fără `concurrently` (migrarea rulează într-o tranzacție); tabelele sunt mici (sub 2.000 de rânduri azi).
-- Pentru coloanele aproape mereu goale, index parțial (`where … is not null`): mai mic, folosit la fel.
-- Lăsate deoparte, intenționat: `created_by` / `updated_by` (cerința), `audit_logs.actor_user_id` (la fel),
-- tabelele asociației și ale magazinului (nu se ating în promptul 27), `stock_reservations` (moștenire),
-- `farm_invites.used_by_user_id` și `alert_dismissals.user_id` (căutate mereu împreună cu `tenant_id`, au deja
-- indexuri compuse).

begin;

-- tenant_id fără index (RLS filtrează pe el la fiecare citire; ștergerea fermei caută după el).
create index if not exists ai_conversations_tenant_id_idx on public.ai_conversations (tenant_id);
create index if not exists capcane_montate_tenant_id_idx on public.capcane_montate (tenant_id);
create index if not exists capcane_verificari_tenant_id_idx on public.capcane_verificari (tenant_id);
create index if not exists etape_cultura_tenant_id_idx on public.etape_cultura (tenant_id);

-- Comenzi: fișa clientului (comenzile unui client), stocul pe produs, livrarea parțială (comanda părinte),
-- legătura cu vânzarea creată la livrare.
create index if not exists comenzi_client_id_idx on public.comenzi (client_id);
create index if not exists comenzi_produs_id_idx on public.comenzi (produs_id);
create index if not exists comenzi_parent_comanda_id_idx on public.comenzi (parent_comanda_id) where parent_comanda_id is not null;
create index if not exists comenzi_linked_vanzare_id_idx on public.comenzi (linked_vanzare_id) where linked_vanzare_id is not null;

-- Vânzări pe produs (stoc, rapoarte).
create index if not exists vanzari_produs_id_idx on public.vanzari (produs_id);

-- Analizele la fructe: fișa parcelei (analizele unei parcele) și ștergerea parcelei (cascadă).
create index if not exists analize_fructe_parcele_parcela_id_idx on public.analize_fructe_parcele (parcela_id);

-- Tratamente: capcanele unei aplicări, produsul (catalog), cultura, linia de plan, mișcarea de stoc.
create index if not exists capcane_montate_aplicare_id_idx on public.capcane_montate (aplicare_id) where aplicare_id is not null;
create index if not exists capcane_verificari_aplicare_id_idx on public.capcane_verificari (aplicare_id) where aplicare_id is not null;
create index if not exists aplicari_tratament_produs_id_idx on public.aplicari_tratament (produs_id) where produs_id is not null;
create index if not exists aplicari_tratament_cultura_id_idx on public.aplicari_tratament (cultura_id) where cultura_id is not null;
create index if not exists aplicari_tratament_plan_linie_id_idx on public.aplicari_tratament (plan_linie_id) where plan_linie_id is not null;
create index if not exists aplicari_tratament_stoc_mutatie_id_idx on public.aplicari_tratament (stoc_mutatie_id) where stoc_mutatie_id is not null;
create index if not exists aplicari_tratament_produse_stoc_mutatie_id_idx on public.aplicari_tratament_produse (stoc_mutatie_id) where stoc_mutatie_id is not null;
create index if not exists planuri_tratament_linii_produs_id_idx on public.planuri_tratament_linii (produs_id) where produs_id is not null;
create index if not exists parcele_planuri_plan_id_idx on public.parcele_planuri (plan_id);

-- Parcelele (solarii): jurnalele pe unitate și butașii pe parcela-sursă.
create index if not exists culture_stage_logs_unitate_id_idx on public.culture_stage_logs (unitate_id);
create index if not exists solar_climate_logs_unitate_id_idx on public.solar_climate_logs (unitate_id);
create index if not exists vanzari_butasi_parcela_sursa_id_idx on public.vanzari_butasi (parcela_sursa_id) where parcela_sursa_id is not null;

-- GDPR: consimțămintele unei comenzi (ștergerea comenzii caută după ele).
create index if not exists consent_events_order_id_idx on public.consent_events (order_id) where order_id is not null;

-- Proprietarul fermei: `isFarmOwner`, `is_tenant_owner()` din RLS, ștergerea contului.
create index if not exists tenants_owner_user_id_idx on public.tenants (owner_user_id);

-- ── C2. `is_legal_docs_complete(p_tenant_id)`: doar cine are nevoie ────────────────────────────────────────
-- Înainte: orice cont logat afla dacă actele oricărei ferme sunt complete. Acum răspunsul adevărat îl primesc:
--   * serverul (service role) și editorul SQL: fără utilizator în JWT, dar nu `anon` (seed-ul demo, rutele admin);
--   * proprietarul fermei;
--   * membrii activi ai fermei (`farm_members.is_active`): operatorul care activează un produs trece prin
--     declanșatorul `produse_legal_docs_guard`;
--   * membrii asociației (`association_members`, aceeași regulă ca `list_association_farmer_legal_status`):
--     rutele `/api/association/producers`, `/api/association/products`, `/api/association/products/create`
--     o cheamă cu sesiunea staff-ului pentru ferma producătorului;
--   * superadminul (`is_superadmin()`).
-- Oricine altcineva primește `false`.
-- Cine o cheamă (verificat 22.11.2026): cele 3 rute ale asociației (sesiunea utilizatorului) și declanșatorul
-- `enforce_produse_requires_legal_docs` (SECURITY DEFINER; `auth.uid()` rămâne al celui care scrie în `produse`).
-- Nicio altă funcție, vedere sau pagină publică.

create or replace function public.is_legal_docs_complete(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case
    when (auth.uid() is null and coalesce(auth.role(), '') <> 'anon')
      or exists (select 1 from public.tenants t where t.id = p_tenant_id and t.owner_user_id = auth.uid())
      or exists (
        select 1
        from public.farm_members fm
        where fm.tenant_id = p_tenant_id
          and fm.user_id = auth.uid()
          and coalesce(fm.is_active, false) = true
      )
      or exists (select 1 from public.association_members am where am.user_id = auth.uid())
      or public.is_superadmin(auth.uid())
    then coalesce((
      select fld.legal_docs_complete
      from public.farmer_legal_docs fld
      where fld.tenant_id = p_tenant_id
    ), false)
    else false
  end;
$function$;

revoke execute on function public.is_legal_docs_complete(uuid) from public, anon;
grant execute on function public.is_legal_docs_complete(uuid) to authenticated, service_role;

-- ── C3. `clienti_merge_audit`: neschimbat ──────────────────────────────────────────────────────────────────
-- RLS pornit, fără politici. Scrie în el doar `merge_clienti_duplicates`, chemată de scriptul de mentenanță
-- `scripts/dedupe-clienti-merge.ts` cu service role (care ocolește RLS). Aplicația nu îl citește (niciun
-- `from('clienti_merge_audit')` în `src`). Deci rămâne doar pentru service role, cum a fost gândit în
-- `20260705120000_clienti_merge_audit.sql`.

commit;
```

## 3. Ce n-am putut testa

- **Migrările**: neaplicate. Am verificat doar că trupul noii `is_legal_docs_complete` rulează (un `select`) și că toate coloanele indexate există. Efectul real (asociația pe sesiunea staff-ului, declanșatorul pe `produse` pentru un operator) n-a putut fi rulat fără migrare.
- **Mesajul „Pune data culesului pe parcele…”** cu toate parcelele fără dată: n-am golit în browser datele tuturor parcelelor demo (unele au și recoltări de anul trecut). E acoperit de testele unitare (`nicioParcelaCuDataCules`) și de typecheck. Eticheta și deschiderea foii au fost verificate în browser.
- **Foaia mementoului deschisă din notificare** în cazul „fără dată”: n-am trimis notificări (cronurile nu se apelează).
- **PDF-ul și afișul** n-au fost tipărite. Rândul lor e testat unitar și vine din aceeași funcție ca pagina, verificată în browser.
- **Cronul `farmer-legal-docs-check`** (numele prin helper): neapelat, verificat doar prin typecheck.

## 4. Verificări

- `npm run lint`: 0 erori, 4 avertizări, toate în fișiere neatinse (`src/app/api/chat/chat-post-handler.ts`, `src/app/livrator/livrari/LivratorLivrariClient.tsx`).
- `npm run typecheck`: trece.
- `npm run check:kit`: OK, 260 de fișiere, fără abateri.
- `npm run test:critical:unit`: 121 de fișiere, 1.009 teste, toate trec.
- `npm run build`: trece (după bucățile A–C; D nu atinge codul aplicației).
- `npm run test:e2e:smoke`: 7/7, de două ori (53,4 s și 53,2 s).

**Test în browser** (doar demo-uri noi, create după delogarea contextului; `/start` ducea întâi la `/acces-oprit`, deci contextul Playwright avea o sesiune veche, pe care am închis-o înainte):
- `8306e96f-b7e1-48d9-82b7-22a965917576` (explorarea, B, A3 și raportul din aplicație);
- `97ab11ac-d4bb-472c-80fb-817c8a957165`, `4e81f505-23f3-4cb4-b62f-6efafaf6d619`, `81fdb7b2-caf1-498a-b62d-4967fb316efd` (rulările smoke; prima s-a oprit la pasul 5, din cauza unui selector, reparat apoi).

Toate sunt `@demo.zmeurel.local` și pleacă cu cronul de curățare după 24 h. Am ieșit din cont la final.

## 5. Commit-urile

| Hash | Ce |
|---|---|
| `b137d74` | A1 — soiurile o singură dată |
| `c5d118f` | A2 — numele intern al fermei |
| `792bd3e` | A3 — analiza demo la reîncărcare |
| `c8c6cb6` | A4 — migrarea `get_public_farmer_card` |
| `82a5016` | B — data culesului la vedere |
| `e6cbcdd` | C — migrarea de igienă (24 de indexuri; mesajul spune greșit 25) |
| `2068d0a` | D — setul smoke |
| commitul raportului | acest fișier |
