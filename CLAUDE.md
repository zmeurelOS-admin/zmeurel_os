# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run build        # next build --webpack (runs check-env.js first)
npm run check        # lint + typecheck + build (full CI gate)
npm run check:kit    # regulile kitului de componente (tokeni canonici, text ≥ 13 px, straturi)
npm run test:critical:unit  # testele unitare (vitest, `vitest.critical.config.ts`; fișierele noi de test se adaugă în `include`; un folder cu paranteze se scrie `[(]dashboard[)]`)
npm run test:e2e:smoke  # setul smoke (e2e/smoke, playwright.smoke.config.ts): după `npm run build`, pe `next start`; creează singur un demo nou din /start, scrie doar în el, iese din cont; nu rulează în CI
npm run test:e2e     # Playwright e2e tests (`e2e/admin-access.spec.ts`: acces admin; dacă DB-ul blochează `is_superadmin` via service role, setează E2E_SUPERADMIN_EMAIL/PASSWORD în `.env.local`)
```

CI runs `lint` + `typecheck` on every PR. Always run both before committing. Testele unitare sunt cu vitest (`npm run test:critical:unit`, lista de fișiere în `include` din `vitest.critical.config.ts`); e2e cu Playwright (`npm run test:e2e`).

## Architecture Overview

**Zmeurel OS** is a multi-tenant agricultural SaaS (berry farms, greenhouses). The stack is Next.js 16 App Router, React 19, TypeScript, Supabase (PostgreSQL + Auth), TailwindCSS 4, shadcn/ui, TanStack Query v5, Framer Motion, Sentry, `@ai-sdk/google`, Zustand 5, `next-themes`, and `driver.js`.

### Route Groups

- `src/app/(auth)/` — login, reset-password, update-password (public)
- `src/app/(dashboard)/` — all protected pages; layout in `layout.tsx`
- `src/app/(onboarding)/start/` — demo + sign-up entry point
- `src/app/api/` — API routes (auth, admin, cron, demo, farm, gdpr)
- `src/app/admin/` — superadmin pages; protected by `src/app/(dashboard)/admin/layout.tsx`

### Auth & Middleware

`src/proxy.ts` intercepts every request (Next.js 16: use this file only; do not add `middleware.ts` alongside it):
1. Validates Supabase session cookie
2. Resolves `tenant_id` from `profiles` table
3. Injects `x-zmeurel-user-id`, `x-zmeurel-user-email`, `x-zmeurel-tenant-id` request headers
4. Redirects unauthenticated users to `/login`, users without a tenant to `/start` (operatorul din link fără apartenență activă merge pe `/acces-oprit`)

La intrare, `proxy()` șterge orice antet `x-zmeurel-*` venit din browser (excepțiile, cum e `x-zmeurel-step-up-token`, sunt în `src/lib/auth/proxy-headers.ts`), iar răspunsul spre pagină se creează abia la final, cu antetele puse de proxy și cookie-urile sesiunii (Next copiază antetele la crearea răspunsului). Orice ieșire nouă din `proxy()` folosește `continueRequest()` sau `redirectTo(..., supabaseResponse)`.

Demo users exit to real signup via native `POST /api/auth/leave-demo` (form from banner or `/settings`), which signs out on the server and returns `303` to `/start`. Delogare generală pe server: `POST /api/auth/leave-demo` (demo) și `POST /api/auth/sign-out` (redirect `303`, implicit `/`, opțional `?next=/login`). UI folosește formulare POST, nu doar `signOut()` în client.

The dashboard layout (`src/app/(dashboard)/layout.tsx`) reads these headers to avoid a second DB call for user identity.

### Multi-tenancy

Every data row belongs to a tenant. The tenant is resolved from `profiles.tenant_id` (the current user's profile row). Two helpers are critical:

- `getTenantId(supabase)` — throws if not found; use in mutations
- `getTenantIdOrNull(supabase)` — returns null silently; **always use this in page server components** to avoid throwing into the error boundary

All query functions in `src/lib/supabase/queries/` call `getTenantId(supabase)` internally and accept the singleton browser client via `getSupabase()`.

### Supabase Clients

- **Browser (singleton)**: `getSupabase()` from `src/lib/supabase/client.ts`. Use in client components and query functions.
- **Server (per-request)**: `createClient()` from `src/lib/supabase/server.ts`. Use in server components and API routes.
- **Service role (admin)**: `getSupabaseAdmin()` from `src/lib/supabase/admin.ts`. Use only in admin server components/API routes where RLS must be bypassed.

### Data Fetching Pattern

Client pages follow a two-file pattern:
- `page.tsx` — thin server component that just renders the client component
- `*PageClient.tsx` — `'use client'` component with all React Query hooks and mutations

„Activități agricole” s-a redenumit **Lucrări**: `src/app/(dashboard)/lucrari/` (tabelul rămâne `activitati_agricole`, cheia modulului pentru operatori rămâne `activitati`). `/activitati-agricole` e doar o redirecționare la `/lucrari`, cu parametrii păstrați (precompletările din chatul AI). Tratamentele vechi din acel tabel se văd în Tratamente, „importate”; în Lucrări apar doar lucrările (`src/lib/lucrari/tipuri.ts` mapează tipurile vechi pe cele 8 noi, doar la afișare). Fișa parcelei e `/parcele/[id]`; `/parcele?selected=<id>` duce acolo.

**Analizele la fructe** (promptul 26) stau în Tratamente, tab-ul „Analize” (`/tratamente?tab=analize`; `&noua=1&parcele=<id,id>` deschide „Analiză nouă”, `&raport=<id>` raportul). Tabelele `analize_fructe`, `analize_fructe_parcele`, `analize_fructe_substante` (migrarea `20261122110000`), fișierele în bucketul privat `analize` (`<tenant>/...`). Drepturile: citește proprietarul și operatorul cu „Tratamente” (funcția SQL `operator_can_read('tratamente')`), scrie cine are `operator_can_write('tratamente')`. Fără tip de analiză: ce s-a analizat se scrie din buletin (`ce_s_a_analizat`). Logica e în `src/lib/analize/` (pură, testată), ecranele în `src/components/analize/`. **Raportul public** e `/a/[token]`: server component cu service role (`src/lib/analize/raport-server.ts`), doar pentru `status = 'conform'` și `public_activ`, altfel 404; `noindex`; ruta e în `isPurePublicNoAuthBypassRoute` din `proxy.ts` (fără sesiune, cookie-urile se șterg). Orice câmp nou al raportului trece prin `construiesteRaport` (`src/lib/analize/raport.ts`), care alege doar ce e permis: numărul și poza atestatului, poza PV-ului, nota și numele inspectorului nu apar niciodată. Actul fermei se numește „Atestat de producător” (valabil până la …); în bază rămân `certificat_producator` și `certificate_*` (textele în `src/lib/acte/atestat.ts`).

**Magazia** (promptul 28): stocul produselor de tratament, `/tratamente/magazie` (rândul „Magazia: N produse · M pe terminate” sus în Tratamente → Aplicări și în Mai mult; nu e tab), fișa produsului `/tratamente/magazie/[produsId]`. Migrarea `20261122130000_magazia.sql`: `magazie_produse` (unitatea `kg` / `l` / `buc` și pragul „pe terminate”, pe **(fermă, produs)**, nu pe `produse_fitosanitare`, fiindcă produsele din catalog sunt comune tuturor fermelor) și `magazie_miscari` (`intrare` +, `iesire_tratament` −, `corectie` ±, în unitatea produsului). Ieșirile le scrie **doar triggerul** `magazie_sincronizeaza_iesire` (pe `aplicari_tratament_produse` și pe starea / data din `aplicari_tratament`): un rând pe produsul aplicării, doar la tratament făcut, cu ziua ≥ prima intrare / corecție a produsului (tratamentele vechi nu scad), ml → l și g → kg; altfel rândul se șterge. Nu folosi `stoc_mutatie_id` și nu scrie în `miscari_stoc` (acela e stocul de fructe). Operatorul nu citește `magazie_miscari` (RLS doar proprietarul): stocul și mișcările vin prin RPC-urile `magazie_stoc()`, `magazie_miscari_produs(id)`, `magazie_iesiri_aplicari()`, cu prețurile `null` pentru operator; el inserează intrări / corecții doar fără preț și fără cheltuială (fără `select()` după insert). „+ Am cumpărat” cu „Trece și la cheltuieli” creează și cheltuiala (`Îngrășăminte` pentru îngrășăminte, altfel `Tratamente`), cu a doua cheie `cheieDerivata(client_sync_id)`; bonul stă în `bonuri/<tenant>/magazie/<cheie>.jpg`. Logica pură e în `src/lib/magazie/` (aceleași reguli ca SQL-ul, testate), datele în `src/lib/supabase/queries/magazie.ts`, ecranele în `src/components/magazie/`. Cheile de query stau sub `['tratamente', 'magazie', …]`: invalidarea lui `tratamente` reîncarcă și magazia. Linia „Tratamente: X lei” din Rapoarte e **informativă** (cumpărăturile sunt deja la cheltuieli; nu scade din profit). Notificarea „pe terminate” pleacă lunea în cronul de dimineață (`magazie_pe_terminate`, comutatorul `magazie`). Fără migrare: Magazia arată „după actualizarea bazei de date”, restul merge ca înainte.

**Capcanele** (promptul 29): tab-ul „Capcane” din Tratamente (`/tratamente?tab=capcane`; `&verifica=1` deschide „Verifică acum”), fișa grupului `/tratamente/capcane/[grupId]` (graficul pe săptămâni cu linia pragului și tratamentele parcelei, verificările, „Scoate capcanele”, „Fă un tratament pe …” = `/tratamente?parcela=<id>`). Refolosește tabelele vechi `capcane_montate` (un rând = un **grup**: capcane de același tip pe o parcelă, `nr_bucati`) și `capcane_verificari` (o verificare a grupului = câte un rând pe capcană, `capcana_nr`, aceeași dată și aceeași cheie); migrarea `20261123100000_capcane.sql` adaugă intervalele, `data_schimb_atractant`, `client_sync_id`, `atractant_schimbat`, triggerul `capcane_dupa_verificare` (mută `data_urmatoarea_verificare = ultima verificare + interval` și ziua atractantului; aplicația nu le scrie la verificare), `tenant_settings.prag_capcane` și politicile bucketului privat `capcane` (`<tenant>/...`). Tipurile `drosophila` / `lipicioasa_galbena` / `feromoni` / `alta`, starea `activa` / `scoasa`; valorile vechi (`drosophila_otet`, `feromonala`, `activ`, `scos` …) rămân valide și se citesc prin `normalizeTip` / `normalizeStatus`. Montarea pe mai multe parcele face câte un grup pe parcelă, cu cheia derivată `cheieGrup(cheie, index)`. „Peste prag” = capturile grupului din săptămâna verificării (luni–duminică) ≥ prag × `nr_bucati`, iar la „doar în coacere” parcela e în coacere: stadiul `parga` / `maturitate` valabil în ziua aceea sau ziua ≥ culesul estimat (`estimeazaCules`) − 7. Implicit doar Drosophila: 1 / capcană / săptămână, în coacere. Logica pură e în `src/lib/capcane/` (testată), datele în `src/lib/supabase/queries/capcane.ts`, ecranele în `src/components/capcane/`; cheile de query sub `['tratamente', 'capcane', …]`. Mementoul „Verifică capcanele” pleacă în cronul de dimineață proprietarului **și** operatorilor activi cu „Scrie” pe Tratamente (`destinatariMementoCapcane`, cheia `capcane:<fermă>:<zi>:<utilizator>`, `trimiteNotificareUtilizator`); cardul „Verificare azi” stă în Acasă. Alerta „Peste prag” o trimite `POST /api/capcane/alerta` după salvare, doar proprietarului, recalculată pe server (o dată pe grup și săptămână, `capcane-prag:<grup>:<luni>`). Comutatoarele: `capcane` și `capcane_prag` (al doilea nu apare la operator). Registrul de tratamente (Rapoarte → Exportă) are „Monitorizare cu capcane”. Fără migrare: tab-ul arată „după actualizarea bazei de date”, cronul și registrul nu au capcane.

**Planul pe stadii** (promptul 30): tab-ul „Plan” din Tratamente (`/tratamente?tab=plan`; taburile sunt Aplicări · Plan · Capcane · Analize), „Planul întreg” `/tratamente/plan/[planId]`. Refolosește tabelele vechi: `planuri_tratament` (planul, pe cultură, `cultura_tip`), `planuri_tratament_linii` (linia: `stadiu_trigger`, `cohort_trigger`, `scop`, `metoda_aplicare`, `regula_repetare` + `interval_repetare_zile` + `numar_repetari_max`), `planuri_tratament_linie_produse` (mai multe produse pe linie; **liniile vechi țin produsul pe linie**, `produs_id` / `produs_nume_manual`, și `produseLinie` îl citește de acolo), `parcele_planuri` (planul pe parcelă și an, un singur plan activ pe parcelă și an). Aplicarea făcută din plan are `plan_linie_id` + `sursa = 'din_plan'` și produsele `plan_linie_produs_id` (`aplicariDeSalvat({ planLinieId })`). **Nu folosi RPC-ul `upsert_plan_tratament_cu_linii` la editare**: șterge și recreează liniile, iar aplicările pierd `plan_linie_id`; liniile se modifică pe loc (`src/lib/supabase/queries/plan.ts`), cu id-uri derivate din cheia formularului la creare (`idDerivat`, fără dublare). Migrarea `20261123120000_plan_stadii.sql` adaugă doar `planuri_linii_sarite` („Sar peste”, pe linie, parcelă și an), `planuri_linii_exceptii` (linia nu se aplică pe o parcelă) și `planuri_anuntate` (ce a anunțat cronul, o dată pe linie, parcelă, an și repetare) și cere `operator_can_read('tratamente')` la citirea planurilor. „Ce urmează” (`calculeazaPlan`, `src/lib/plan/urmeaza.ts`): stadiul de acum al parcelei (ultima înregistrare de pe fișă, pe cohorte la zmeura remontantă) → liniile acelui stadiu sunt „acum” dacă n-au aplicare în sezon, nici sărire, nici excepție; „repetă la N zile, de M ori” = după o aplicare linia reapare peste N zile cât timp parcela e în stadiu, până la M aplicări în total. Atingerea unei intervenții deschide formularul de tratament completat (`ciornaDinLinie`, prop-ul `plan` pe `TratamentStepForm`: „Completat din …”, „Salvează · făcut”, „Sar peste”, verificările: magazie, maxim pe sezon, interval, pauza față de cules). „Plan nou”: din ce s-a aplicat anul trecut (`grupeazaAnTrecut`: pe stadiul parcelei din ziua aplicării) sau de la zero; septembrie–decembrie se face pentru anul următor (`anPlanNou`). Aplicația nu vine cu planuri-model. „A început …?” (`intrebariParcela`): pe fișa parcelei și în tab, când se apropie ziua de anul trecut a stadiului următor (sau culesul estimat); „Da, de azi” notează stadiul, „Încă nu” amână 3 zile (în `localStorage`); nu pleacă pe telefon. Notificarea „E timpul pentru <stadiu> la <parcele> · N intervenții” pleacă în cronul de dimineață proprietarului și operatorilor cu „Scrie” pe Tratamente (`mementoPlanFerma`, cheia `plan:<fermă>:<zi>:<utilizator>`, comutatorul `plan`). Logica pură e în `src/lib/plan/` (testată), datele în `src/lib/supabase/queries/plan.ts` și `usePlan`, ecranele în `src/components/plan/`; cheile de query sub `['tratamente', 'plan', …]`. Fără migrare: planul merge, doar „Sar peste”, excepțiile și notificarea lipsesc.

**Cultura vine din parcele** (promptul 31): nicăieri nu se scrie „zmeură” fix. Culturile fermei = culturile distincte din parcelele active (`parcele.cultura`, altfel `tip_fruct`), prin `culturileFermei` (`src/lib/parcele/culturi-ferma.ts`, testată): „Zmeure Delniwa”, „Zmeură”, „zmeura” = `zmeur`; acordul vine de acolo („Zmeură cal. I disponibilă”, „Afine cal. I disponibile”, `numeProdusProaspat` = „Afine proaspete”). Fără parcele: Stocuri, Acasă și Comenzi arată „Adaugă întâi o parcelă” (`/parcele?nou=1` deschide formularul). Stocul: o cultură = cifra din `get_sellable_cal1_stock_summary` cu eticheta culturii; mai multe culturi = Stocuri cu o filă pe cultură (`Segments`), din `stoc_cal1_pe_cultura` + `stocPeCultura` (`src/lib/stocuri/pe-cultura.ts`; ce n-are cultură merge la cultura principală, zmeura dacă există), totul în `useStocFerma`. Comanda întreabă cultura doar la mai multe culturi; `comenzi.produs_id` = produsul culturii, asigurat de `asiguraProdusCultura` (`src/lib/supabase/queries/produse-cultura.ts`, chemată și la salvarea unei parcele): un produs existent care se potrivește („Zmeură proaspătă”) rămâne cel folosit. Migrarea `20261124100000_stoc_pe_cultura.sql` (neaplicată la scriere): `ajustari_stoc.cultura`, `stoc_cal1_pe_cultura`, `create_ajustare_stoc(…, p_cultura)`, sumarul fără comenzile / ajustările altor culturi la o fermă cu zmeură. Fără migrare: o singură cifră, ca înainte.

**Contul nou și „Primii pași”** (promptul 31): ferma o creează triggerul `on_auth_user_created` (`handle_auth_user_created`); după cont (email: `/login?mode=register`, Google: callback-ul, dacă ferma e creată de cel mult 15 minute și n-are localitate) vine o singură întrebare, `/start/ferma`: numele (`/api/gdpr/farm`) și localitatea (`tenants.localitate`). Fără „Ce cultivi?”, fără parcelă sau produs implicit. În Acasă, `PrimiiPasi` (doar proprietar, nu demo): numele fermei, prima parcelă, culegătorii, „Pune prețul la <cultura>” (inactiv până la prima parcelă); se bifează din date (`pasiPrimii`, `src/lib/dashboard/primii-pasi.ts`), „Ascunde” = `localStorage` pe utilizator.

**Demo-ul** (promptul 31): `/start` = demo întâi (Fructe de pădure, Solarii: singurele seed-uri care umplu modulele refăcute), cont nou a doua opțiune; `?demo=1` deschide direct tipul. După „Pornește demo-ul”, ecranul de așteptare bifează pașii (cont, date, apoi parcele / recoltări / comenzi numărate real, `asteaptaDemoGata` din `src/lib/demo/demo-gata.ts`, cu limită de timp și „Încearcă din nou”) și intră în Acasă cu `window.location.assign` (memoria aplicației pornește goală). Textele noi iau numele aplicației din `APP_NAME` (`src/lib/brand.ts`).

**Mementoul dinainte de cules**: culesul pe parcelă vine din data pusă de mână pe fișa parcelei (`configurari_parcela_sezon.data_inceput_cules`, pe sezon), altfel din prima recoltare de anul trecut mutată în anul curent (`estimeazaCules`, `src/lib/analize/cules.ts`). Calendarul (21 / 14 / 7 / 3 zile, apoi zilnic; amânare 1 / 3 / 7; oprire la o analiză prelevată în fereastra sezonului, la „Nu fac analize anul acesta” sau din comutator) e `calculeazaMemento` (`src/lib/analize/memento.ts`), folosit și de cron, și de cardul din Acasă (`MementoAcasa`), și de fișa parcelei, și de avertizarea din formularul de tratament. Doar proprietarul primește. Setările stau în `notificari_preferinte.tipuri` (`analize`, `analize_zile`, `analize_zilnic`), starea pe sezon în `memento_analize_sezon` (migrarea `20261122111000`). Butoanele din notificare (`data.push_actions`: „Am trimis” = deep link, „Amână 3 zile” = `POST /api/analize/memento/amana` cu cookie-ul sesiunii) se tratează în `public/push-handlers.js` (sursa importată de `sw.js`; `public/sw.js` nu se comite).

Drepturile operatorilor (`src/lib/farm-members/access.ts`): Tratamentele au modulul lor, `tratamente` (Nu / Citește / Scrie, ruta `/tratamente`), separat de Lucrări (`activitati`). Drepturile salvate se citesc **doar** prin `resolveFarmMemberAccess`: un rând vechi cu `activitati` și fără `tratamente` primește `tratamente: read` (fără update în `farm_members`); „Nu” explicit se scrie cu `toStoredFarmMemberAccess` ca `{ module: 'tratamente', level: 'none' }`, ignorat de baza de date. Operatorul invitat intră **doar din link** (`/invite/<token>` → „Intră în fermă”): cont ascuns `op-<uuid>@operator.zmeurel.local`, fără parolă, sesiune pornită pe server (`src/lib/farm-members/operator-link*.ts`, `POST /api/invite/accept` cu doar tokenul); Google rămâne a doua variantă. Linkurile stau în `farm_invites`, o folosire, 7 zile; „Retrimite linkul” face un link de reconectare (`used_by_user_id` pus de la creare, `modules_access` gol) în același utilizator și închide sesiunile vechi. Aplicația nu trimite email la `@operator.zmeurel.local`. Nivelul de acces al operatorului se calculează în `DashboardAuthProvider` din drepturi și ruta curentă; `/mai-mult` și `/notificari` sunt permise oricărui operator. Rutele care șterg, golesc sau redenumesc ferma verifică proprietarul (`isFarmOwner`, `ownedTenantIdForDeletion` din `src/lib/tenant/account-deletion.ts`), nu `getTenantId*`, care pentru un operator întoarce ferma în care lucrează. La fel rutele demo, actele fermei și Google Contacts. O rută care scrie cu service role și pe care o poate folosi și un operator verifică modulul cu `resolveFarmActor` + `actorCanWrite` (`src/lib/farm-members/actor-auth.ts`), ca politica RLS a tabelului. Livratorul (token) atinge doar comenzile fermei lui, „în livrare”, de azi. Echipa e `/settings/echipa` (logica în `src/lib/echipa`); „Documente legale” sunt **Actele fermei**, `/settings/ferma/acte` (`/settings/documente-legale` redirecționează); ce lipsește vine dintr-o singură funcție, `stareActe` (`src/lib/acte/stare.ts`), folosită de ecran, banner și Setări.

TanStack Query defaults (`QUERY_DEFAULT_OPTIONS` din `src/lib/query-defaults.ts`, puse în `src/app/providers.tsx`):
```ts
staleTime: 60_000, gcTime: 10 * 60_000,
refetchOnWindowFocus: false, refetchOnReconnect: false, retry: 1,
refetchOnMount: (query) => query.state.isInvalidated
```
`refetchOnMount`: o pagină redeschisă arată datele din memorie fără altă cerere, în afară de cazul în care interogarea a fost invalidată cât pagina era închisă (atunci se reîncarcă). Nu pune `refetchOnMount: false` pe o interogare: invalidările făcute din altă pagină s-ar pierde.

Tenantul în browser: `getTenantId` / `getTenantIdOrNull` îl rezolvă o singură dată pe utilizator și îl țin în modul (cel mult 10 minute; `resetTenantIdCache()` la delogare și la acceptarea invitației). Pe server nu se ține nimic. Ce coloane noi există (`schema-features`) se ține minte în `localStorage`.

Tot ce schimbă stocul cheamă `invalidateStock(queryClient)` (`src/lib/query-keys.ts`, lista `STOCK_QUERY_KEYS`), direct sau prin `invalidateDupaRecoltare` / `invalidateDupaComanda`. O cheie nouă care citește stocul se adaugă în listă.

All query keys are defined in `src/lib/query-keys.ts`.

### Idempotency (fără coadă offline)

Nu există coadă offline: o salvare fără internet pică, iar formularul păstrează ce s-a scris și cheia, ca „Salvează” apăsat din nou să nu dubleze. Formularele de creare trimit un `client_sync_id` (UUID; `form.clientSyncId` din `useStepForm`, altfel `generateClientId()` din `src/lib/offline/generateClientId.ts`), același cât e deschis formularul și la reîncercare. Serverul deduplică pe el; `23505` pe indexul cheii înseamnă că rândul există deja și se tratează ca reușită (se recitește rândul).

- `recoltari`, `vanzari`, `cheltuieli_diverse`, `activitati_agricole`: `client_sync_id uuid not null default gen_random_uuid()` + index unic pe `(client_sync_id)`. Recoltările trec prin RPC-ul `create_recoltare_idempotent`.
- `comenzi`, `clienti`, `culegatori`, `investitii` (migrarea `20261121140000`): `client_sync_id uuid null` + index unic parțial pe `(tenant_id, client_sync_id)`. Helper-ele din `src/lib/supabase/idempotency.ts` (`cheieDeTrimis`, `findByClientSyncId`, `isClientSyncConflict`); cheia pleacă doar când coloana există (`schema-features`, grupul `cheiIdempotenta`). Vânzarea rapidă și „Din mesaj” trimit și ele cheia pe comandă (și pe clientul nou).
- `ajustari_stoc` (migrarea `20261121190000`): aceeași formă, iar RPC-ul `create_ajustare_stoc` primește `p_client_sync_id` și întoarce rândul existent pentru o cheie deja scrisă. Fără migrare, PostgREST răspunde `PGRST202` și `createAjustareStoc` trimite din nou, fără cheie.
- Plățile parțiale ale unei vânzări: RPC `adauga_plata_vanzare` cu cheia plății (`vanzari.plati_aplicate`), migrarea `20261121120000`.

### UI Layout

- Desktop: sidebar (`src/components/layout/Sidebar.tsx`) + scrollable main area
- Mobile: full-width content + bottom tab bar (`src/components/app/BottomTabBar.tsx`). E2E care deschide meniul „Mai mult”: după `goto` folosește `waitUntil: 'load'` (sau echivalent) ca să nu se facă click înainte de hidratarea React pe tab bar.
- Pages wrap content in `<AppShell header={<PageHeader ... />}>` from `src/components/app/`
- KPI cards use `<KpiCard>` from `src/components/app/KpiCard.tsx`
- shadcn/ui components live in `src/components/ui/`; no `Alert` component exists, only `alert-dialog`
- Design tokens: vezi `docs/redesign/tokens.md` (set canonic pe roluri în `src/styles/theme.css`; clase `bg-surface`, `text-fg`, `border-border`, `shadow-1`, `rounded-card`, `h-touch`; scara de straturi `z-bar` / `z-nav` / `z-fab` / `z-overlay` / `z-modal` / `z-popover` / `z-toast`). Numele vechi (`--agri-*`, `--text-primary`, `--surface-card`, `--status-*`, `--soft-*`) sunt aliasuri pentru modulele nerefăcute; nu le folosi în cod nou.

### Global State / Contexts

- `DashboardAuthContext` — provides `{ userId, email, isSuperAdmin }` from server; access via `useDashboardAuth()`
- `AddActionContext` — registers the page-level "add" action for the floating action button; access via `useAddAction()`
- Both are provided by `<Providers>` in `src/app/providers.tsx`

### Admin Section

`src/app/(dashboard)/admin/layout.tsx` enforces `isSuperAdmin` before rendering any admin page. The `isSuperAdmin()` helper queries `profiles.is_superadmin`. Admin pages use `getSupabaseAdmin()` for analytics queries and `createClient()` for tenant_metrics_daily.

### Analytics

Fire-and-forget tracking — never `await` these calls in business logic:

- `track(eventName, eventData?)` from `src/lib/analytics/track.ts` — uses `createClient()`
- `trackEvent({ eventName, moduleName?, status?, metadata? })` from `src/lib/analytics/trackEvent.ts` — uses `getSupabase()`; also supports legacy `trackEvent(eventType, module, metadata?)` string overloads
- `useTrackModuleView(moduleName)` from `src/lib/analytics/useTrackModuleView.ts` — hook that fires `view_module` once on mount

Events are stored in `public.analytics_events`. Key columns: `event_name`, `module`, `status` (`success|failed|abandoned|started`), `session_id`, `metadata`.

### Cron Jobs (Vercel, `vercel.json`)

Toate orele sunt UTC (România = UTC+2 iarna, UTC+3 vara):

- `06:00 zilnic` — sincronizarea contactelor Google (`/api/cron/sync-google-contacts`)
- `03:00 zilnic` — agregarea metricilor pe fermă (`/api/cron/admin-metrics-daily`, RPC `refresh_tenant_metrics_daily`)
- `04:00 luni` — rezumatul săptămânal pentru fermieri (`/api/cron/farmer-weekly-summary`)
- `04:30 luni` — verificarea documentelor legale (`/api/cron/farmer-legal-docs-check`)
- `05:00 zilnic` — mementourile de livrare pentru butași (`/api/cron/butasi-delivery-reminders`)
- `05:00 zilnic` — notificările de dimineață: ger, comenzi de mâine, bani de încasat, tratamentele planificate, „Verifică capcanele”, „E timpul pentru…” din planul pe stadii, mementoul analizei dinainte de cules, iar lunea „produse pe terminate” din Magazie (`/api/cron/notificari-dimineata`; 8:00 vara, 7:00 iarna; mementoul analizei și magazia doar proprietarului, cheile `analize:<fermă>:<zi>` și `magazie:<fermă>:<zi>`; capcanele și planul și operatorilor cu „Scrie” pe Tratamente, cheile `capcane:<fermă>:<zi>:<utilizator>` și `plan:<fermă>:<zi>:<utilizator>`)
- `17:00 zilnic` — notificările de seară (`/api/cron/notificari-seara`)
- `04:00 zilnic` — Curățarea demo-urilor (`/api/cron/demo-tenant-cleanup`; regula în `src/lib/tenant/demo-cleanup.ts`, citirea și ștergerea în `demo-cleanup-server.ts`):
  - o fermă e demo **doar** dacă emailul proprietarului din `auth.users` (fără majuscule și spații) se termină în `@demo.zmeurel.local` și `tenants.created_at` e mai vechi de 24 h. `is_demo` / `expires_at` nu decid nimic. `@example.test` nu se șterge de aici;
  - operatorii din link (`@operator.zmeurel.local`) legați doar de ferma demo nu sunt semn de fermă reală și se șterg după rândul din `tenants`; orice alt membru rămâne semn;
  - nu intră niciodată: ferme fără proprietar sau cu proprietar fără email, superadmini, `DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS`, ferme de asociație (`is_association_approved` sau proprietar în `association_members`), proprietari cu mai multe ferme;
  - `DEMO_CLEANUP_MODE`: lipsă sau orice altă valoare decât `sterge` = **probă** (doar numără: JSON cu `mod: "proba"`, câte ferme, câte fișiere din `bonuri`, primele 20 de emailuri demo, semnele de fermă reală; se vede și în jurnalele Vercel, `[demo-tenant-cleanup] proba`). `sterge` = șterge efectiv. Se trece pe `sterge` doar după ce proba din jurnale a fost citită;
  - în `sterge`: maximum 50 de ferme pe rulare (cele mai vechi), reverificare înainte de fiecare ștergere; o fermă cu semn de fermă reală (`semneFermaReala`) nu se atinge: se sare, apare în răspuns la `sariteFermaReala` și în Sentry, iar restul lotului se șterge; o fermă care dă eroare la ștergere nu le oprește pe celelalte (raportată prin `captureApiError`);
  - proba locală, doar citire, fără ruta de cron: `scripts/demo-cleanup-proba.ts` (rularea e scrisă în antetul fișierului);
  - ordinea pentru o fermă: fișierele din `bonuri/{tenant_id}/` → tabelele doar-demo (`DEMO_ONLY_DELETE_ORDER`: lanțul de tratamente cu chei `RESTRICT`, `ai_usage_log`) → `deleteTenantScopedData` → rândul din `tenants` (restul pleacă în cascadă) → utilizatorul din `auth` (în cascadă: `profiles`, `notifications`, `push_subscriptions`, `notificari_preferinte`).

### Database Migrations

Migrations live in `supabase/migrations/` as `.sql` files. Run them manually in the Supabase dashboard SQL editor or via the Supabase CLI. The generated TypeScript types are in `src/types/supabase.ts`.

Orice funcție nouă `SECURITY DEFINER` din `public` se încheie în aceeași migrare cu `revoke execute on function ... from public, anon;` și `grant execute on function ... to authenticated, service_role;` (sau doar `service_role`, dacă nu e RPC al aplicației). Funcțiile noi primesc implicit `EXECUTE` pentru `PUBLIC`.

### Key Conventions

- All user-facing text is in Romanian
- Page server components must use `getTenantIdOrNull` (not `getTenantId`) to avoid throwing
- After mutations that affect cached data, call the appropriate `queryClient.invalidateQueries({ queryKey: queryKeys.X })`
- Conflict errors (status 409 / code `23505`) from Supabase are treated as success (idempotent creates)
- Form dialogs track `open_create_form` → `create_success`/`create_failed`/`form_abandoned` lifecycle using a `submittedRef` + `hasOpenedRef` pattern

## Kitul de componente (`src/components/kit/`)

Baza modulelor refăcute (Recoltări, apoi Comenzi + Livrări). Totul se importă din `@/components/kit`. Pagina vie, zi și noapte: `/admin/kit` (doar superadmin). Referință: `docs/redesign/tokens.md`.

**Ce există**

- Butonul rămâne unul singur, `ui/button.tsx`. Pentru kit: variantele `primary` / `neutral` / `danger` / `quiet`, mărimile `touch` (48) / `touch-lg` (56) / `icon-touch`, prop-ul `loading`. Variantele și mărimile vechi sunt pentru modulele nerefăcute.
- Primitive: `Tile` + `TileGroup`, `Segments`, `FilterPills`, `StatTile`, `StatHero`, `StatusPill`, `EmptyState`, `BigInput` + `BigTextarea`, `ListRow`, `ToggleRow`, `CheckRow`, `Notice`, `ProgressBar`, `ActionCard`.
- Compuse: `BottomSheet`, `StepForm` + `useStepForm`, `CalendarSheet` + `CalendarPanel`, `NumberStepper`, `NumericKeypad`, `KgField` + `useKeypadFields`, `SummaryRow` + `SummaryList`, `SuccessScreen`.

**Reguli pentru kit și pentru modulele refăcute**

- Doar tokenii canonici din `tokens.md`: fără hex, fără `dark:`, fără `--agri-*` / `--text-primary` / `--surface-card` / `--status-*` / `--soft-*`, fără `text-[...]` sub 13 px și fără `text-xs`, fără z-index numeric (`z-[...]`, `z-40` și mai mari, `zIndex` în `style`); doar clasele de strat.
- Scara de text 26 / 22 / 19 / 17 / 15 / 13 (+ 64 cifra mare), din `kitText` (`kit/text.ts`). 13 e doar text ajutător, niciodată textul unui element apăsabil. Câmpurile au minimum 16 px (folosim 17).
- Ținte de atingere de cel puțin 48 px, acțiunea principală 56 px, prin `h-touch` / `h-touch-lg` (citesc `--touch-control-h*`: densitate, vizibilitate ridicată). Excepție: tastele `NumericKeypad` au 60 px, fix.
- Foile și ferestrele se deschid în portal, peste bara de jos (`z-modal`): `BottomSheet` și `StepForm`, nu `createPortal` și nu `ui/sheet` direct (`ui/sheet` singur nu ascunde butonul plutitor și nu ascultă „înapoi” pe Android).
- Text în română; ARIA corect: roluri `radio` / `checkbox` / `switch` / `tablist`, `aria-pressed` / `aria-checked`, etichete pe butoanele doar-iconiță.
- Fiecare componentă e exportată din `src/components/kit/index.ts`.

**Formulare pe pași**

- `useStepForm` ține navigarea, resetul la deschidere, ciclul de analytics (`open_create_form` → `create_success` / `create_failed` / `form_abandoned`) și cheia de idempotență. Modulul nu mai scrie `submittedRef` / `hasOpenedRef`.
- `form.clientSyncId` se trimite ca `client_sync_id` la creare. E aceeași cât e deschis formularul (și la reîncercarea după eroare) și alta la `form.restart()` și la următoarea deschidere. La o cheie nouă, modulul își golește câmpurile.
- După salvare: `form.markSuccess()`; la eroare: `form.markFailed()`. Cu `mode: 'edit'` sau `analytics: false` nu se trimite niciun eveniment.
- Tastatura din aplicație se pune în `dock` (zona fixă a carcasei), ca să rămână întreagă pe ecran. Câmpul de kg (`KgField`) pornește gol, fără valoare propusă.
- Un calendar într-un pas se pune cu `CalendarPanel`, în pagină; `CalendarSheet` e pentru paginile obișnuite.
- Nimic nu se deschide peste un `StepForm` (nici `BottomSheet`, nici alt dialog): două ferestre suprapuse se închid amândouă la „înapoi” pe Android. Alegerile dintr-un pas (dată, listă, notă) țin locul conținutului pasului și se închid cu `onBack`; o foaie se închide înainte să se deschidă formularul.
- Închiderea cu ceva nesalvat: `closeGuard` pe `StepForm` (X, Esc, „înapoi”). Întoarce `true` și modulul arată confirmarea în pas; închiderea hotărâtă de modul se face cu `onOpenChange(false)`.
- O valoare care există deja (editare, cantitate dictată) intră în `KgField` cu `fields.setValue`, nu ca propunere.
- Resetul câmpurilor la o cheie nouă (`form.clientSyncId`) poate rula de două ori pentru aceeași deschidere: trebuie să dea același rezultat de fiecare dată.
- Model de urmat: Recoltări (`src/app/(dashboard)/recoltari/`, `src/components/recoltari/`).

**Verificare automată**

`npm run check:kit` (`scripts/check-kit-rules.mjs`) pică la orice abatere de la regulile de mai sus în folderele din `KIT_RULE_DIRS` (`scripts/kit-rules.mjs`): kitul, `/admin/kit` și toate modulele refăcute (Recoltări, Comenzi, Livrări, Acasă pe telefon, Clienți, Culegători, Cheltuieli + Investiții, Vânzări, Mai mult, Notificări, Setări, Tratamente (cu Analizele la fructe, raportul public `/a/[token]`, Magazia, Capcanele și Planul pe stadii), Stocuri, Produse, Rapoarte, Parcele, Lucrări, Echipa, Actele fermei, acceptarea invitației, prima pagină, `/start`, Login și paginile de parolă, „Planul tău”), cu folderele lor din `src/app/(dashboard)`, `src/components` și `src/lib`. Fișierele vechi rămase într-un folder verificat stau în `KIT_RULE_PENDING_FILES`. Folderul fiecărui modul refăcut se adaugă pe listă când începe refacerea lui. Testele kitului sunt în `src/components/kit/__tests__/` și rulează cu `npm run test:critical:unit`.

## AI Chat Widget

- **Model**: `gemini-2.5-flash` (configurabil via `AI_GEMINI_MODEL` env var) prin `@ai-sdk/google`
- **Files**: `src/app/api/chat/route.ts`, `src/components/ai/AiBottomSheet.tsx`
- **New table**: `ai_conversations` — columns: `id uuid PK`, `tenant_id uuid`, `user_id uuid`, `mesaj_user text`, `raspuns_ai text`, `pathname text`, `created_at timestamptz`
- **Rate limit**: 20 msg/zi pentru utilizatori normali, 60 msg/zi pentru superadmin și contul de test `zmeurel.app@gmail.com`. Configurabil via `AI_CHAT_DAILY_LIMIT`. Contorizarea folosește `profiles.ai_messages_count` + `profiles.last_ai_usage_date` și se resetează zilnic în timezone `Europe/Bucharest`.
- **„Din mesaj” (`/api/parse-order`, `/api/paste-to-*`, prin `src/lib/ai/paste-to-x-handler-factory.ts`)**: limită separată de chat, `check_and_log_ai_usage` (20 cereri / 10 min pe utilizator, 100 / oră pe fermă, fixate în funcție; `feature` = `parse_order` sau `paste_to_<modul>`). Se cheamă cu sesiunea utilizatorului (`createClient()`), nu cu service role; dacă limita nu se poate verifica, cererea e refuzată (503, `AI_LIMIT_UNAVAILABLE`).
- **Profiles columns required**: `ai_messages_count integer DEFAULT 0`, `last_ai_usage_date date`
- **Max input**: last 4 messages kept; last user message truncated to 500 chars; system prompt ~300 tokens
- **Keyword detection**: active — queries `activitati_agricole`, `clienti`, `cheltuieli_diverse`, `recoltari`, `comenzi`, `miscari_stoc` only when message matches relevant keywords
- **Session memory**: last 3 exchanges loaded from `ai_conversations` table on each request
- **Proactive alerts**: on first message of session, checks parcele with no activity in last 7 days
- **Voice input**: Web Speech API `ro-RO` — zero new dependencies; shown only if browser supports it
- **Logo**: `/public/icons/icon.svg` rendered via `next/image`
- **Form prefill** (open_form intent): returns non-streaming JSON `{ action: 'open_form', form, message, prefill }` — agent does NOT INSERT data; routes user to `/cheltuieli`, `/recoltari`, or `/activitati-agricole` with URL params
- **Env vars AI**:
  - `GOOGLE_GENERATIVE_AI_API_KEY`
  - `AI_GEMINI_MODEL`
  - `AI_GEMINI_SIMPLE_MODEL` — model alternativ pentru mesaje scurte `<180` chars
  - `AI_CHAT_DAILY_LIMIT`
  - `AI_CHAT_MAX_OUTPUT_TOKENS` — default `220`
  - `AI_CHAT_USAGE_LOG` — `true/false`, default `false`
- **Relevant RPCs**:
  - `check_and_increment_ai_usage` — rate limiting atomic
  - `resolve_recoltare_stock_identity` — determinare produs din parcelă/cultură
- See `docs/ai-chat-widget.md` for full documentation

## Known Issues

Fixed in audit sprint:

- Structured extraction din AI chat nu mai sare peste fallback-ul deterministic când `generateObject` eșuează.
- Voice input oferă acum feedback clar la erori, timeout de 15 secunde și ascunde microfonul pe browsere fără suport.
- Date sensibile (`telefon`, `pret_negociat_lei_kg`) nu mai sunt trimise către model în canonical candidates.
- `ai_conversations` are cleanup automat pentru intrările mai vechi de 90 de zile prin cron.
- `activitati_extended` și `parcele_extended` au fost reîmprospătate pentru a include coloanele noi din schema curentă.
- Sistemul dual de contabilizare din `miscari_stoc` este documentat, iar ajustările manuale populează coerent atât `cantitate_kg`, cât și `cantitate_cal1` / `cantitate_cal2`.
