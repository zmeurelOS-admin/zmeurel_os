# AUDIT COMPLET ZMEUREL OS

Data audit: 2026-03-31  
Mod: read-only (fara modificari de cod)

## 1. IDENTITATE VIZUALA & DESIGN SYSTEM

### ✅ Ce e implementat si functioneaza
- Exista `src/lib/design-tokens.ts` cu tokeni expliciti:
  - `colors`: `primary`, `primaryLight`, `primaryDark`, `coral`, `green`, `yellow`, `blue`, `gray`, `dark`, `bg`, etc.
  - `spacing`: `xs=4`, `sm=8`, `md=12`, `lg=16`, `xl=20`, `xxl=24`
  - `radius`: `sm=8`, `md=12`, `lg=14`, `xl=16`, `full=9999`
  - `emoji`: set dedicat pentru module/stari.
- `src/app/globals.css` are design system extins in variabile CSS:
  - `:root` cu variabile semantice (`--background`, `--primary`, `--agri-*`, `--status-*`, `--fab-*`, etc.)
  - `.dark` cu override complet pentru tema dark.
- `tailwind.config.ts` are `darkMode: 'class'`, deci dark mode este controlat explicit.
- Exista script anti-flash dark mode in `src/app/layout.tsx` (seteaza clasa `dark` inainte de hydration).

### ⚠️ Ce e partial implementat sau inconsistent
- `tailwind.config.ts` are `theme.extend: {}` (fara culori/radius custom in config). Majoritatea tokenilor sunt in CSS vars, nu in Tailwind extend.
- Hardcoded brand colors in TS/TSX inca exista:
  - 32 aparitii pentru `#2D6A4F|#F16B6B|#1B4332|#40916C|#312E3F`
  - in 17 fisiere distincte.
- Indicator dark mode vs clase hardcoded:
  - `dark:` apare de 146 ori (bun),
  - dar `bg-white|bg-slate|text-black` apare de 77 ori (uneori paired cu dark, uneori nu perfect).

### ❌ Ce lipseste complet
- Nu exista conventie centralizata impusa automat (lint rule) care sa blocheze hardcoded brand colors in componente.

### 📝 Observatii si recomandari scurte
- Mentineti CSS vars ca sursa unica de adevar, dar adaugati mapare minima in `tailwind.config.ts` pentru tokenii critici.
- Introduceti regula lint pentru hardcoded colors de brand in TSX.

#### Emoji consistency (sidebar vs design-tokens)
- Sidebar (`src/components/layout/Sidebar.tsx`) foloseste emoji diferite fata de `design-tokens`:
  - Exemplu: Dashboard `🏡` (sidebar) vs `📊` (token), Recoltari `🧺` vs `🫐`, Comenzi `📋` vs `📦`.
- Concluzie: semantic, sunt coerente pe intentie, dar nu sunt sincronizate 1:1.

---

## 2. STRUCTURA NAVIGARE

### ✅ Ce e implementat si functioneaza
- Sidebar desktop clar structurat (`hidden ... md:flex`):
  - top: Dashboard
  - grup `Fermă`: Parcele, Recoltari, Activitati Agricole, Culegatori
  - grup `Comercial`: Comenzi, Vanzari, Clienti, Produse, Stocuri
  - grup `Finante`: Cheltuieli, Investitii
  - footer: Asistent AI, Setari, Profil.
- Bottom navbar mobil (`md:hidden`) cu tab-uri:
  - Acasa, Activitati, Recoltari, Comenzi, + `Mai mult`.
- FAB AI:
  - definit in `src/components/ui/AiFab.tsx`
  - apare doar pe mobil (`lg:hidden`).
- Layout switch desktop/mobil este clar in `src/app/(dashboard)/layout.tsx`:
  - desktop: Sidebar + AiPanel
  - mobil: BottomTabBar + AiFab + ManualAddFab.

### ⚠️ Ce e partial implementat sau inconsistent
- `MoreMenuDrawer` include mai multe item-uri decat bara de jos (normal), dar exista diferente de taxonomie:
  - in drawer: include si `vanzari-butasi`, `rapoarte`, admin items (conditional superadmin), etc.
- In drawer, label-ul "Ajutor" trimite la `/termeni` (posibila nealiniere naming vs ruta).

### ❌ Ce lipseste complet
- Nu exista un singur "navigation source of truth" JSON partajat de Sidebar + BottomTabBar + MoreMenuDrawer (sunt structuri separate in cod).

### 📝 Observatii si recomandari scurte
- Extracti configuratia de navigare intr-un registru unic (cu flags pe breakpoint/role), apoi randati diferit per context.

---

## 3. DASHBOARD

### ✅ Ce e implementat si functioneaza
- Dashboard principal este in `src/app/(dashboard)/dashboard/page.tsx` (client component complet).
- Widget-uri/sectiuni vizibile:
  - `WelcomeCard` (onboarding),
  - `MeteoDashboardCard` + "Meteo pe scurt",
  - alerte "Ce cere atentie acum",
  - "Poti face acum" (smart actions),
  - `TaskList`,
  - "Terenuri de urmarit",
  - widget-uri configurabile (`KpiSummary`, `ComenziRecente`, `RecoltariRecente`, `StocuriCritice`, `SumarVenituri`, `ActivitatiPlanificate`),
  - grid editabil desktop (react-grid-layout).
- Zero-value hiding este implementat:
  - KPI items filtreaza `metricValue !== 0`,
  - widget visibility foloseste `isWidgetEmpty(...)`.
- Sparklines:
  - folosite in `DashboardWidgets` (`SumarVenituriWidget`) si in `RecoltariPageClient`.

### ⚠️ Ce e partial implementat sau inconsistent
- Exista mix intre date "dashboard relevant parcels" si date tenant-wide (corect documentat in cod), dar poate crea confuzie UX fara explicatii consistente peste tot.

### ❌ Ce lipseste complet
- Nu exista un mini-dashboard standardizat, uniform, in toate modulele (unele au KPI/summary, altele nu).

### 📝 Observatii si recomandari scurte
- Standardizati un "module summary strip" reutilizabil (2-4 KPI cards) pentru consistenta intre module.

---

## 4. MODULE — LAYOUT DESKTOP vs MOBIL

### ✅ Ce e implementat si functioneaza
- Module cu pattern modern `ResponsiveDataView` + `MobileEntityCard`:
  - Cheltuieli, Clienti, Stocuri, Culegatori, Vanzari, Comenzi.
- Module predominant `MobileEntityCard`/card-grid:
  - Recoltari, Activitati Agricole, Investitii, Produse, Vanzari Butasi.
- Parcele:
  - are rendering dedicat in `src/components/parcele/ParcelePageClient.tsx`,
  - mobil cu `MobileEntityCard`,
  - desktop cu randuri/coloane custom (nu `ResponsiveDataView`).
- Dialog forms:
  - multe dialog-uri folosesc pattern `grid gap-4 md:grid-cols-2` (1 col mobil, 2 col desktop), ceea ce e corect responsive.
- Actiuni:
  - in modulele cu tabel desktop exista coloana de actiuni cu `sticky: 'right'` in mai multe pagini (`comenzi`, `clienti`, `cheltuieli`, `vanzari`, `culegatori`).

### ⚠️ Ce e partial implementat sau inconsistent
- Investitii si Produse nu folosesc acelasi pattern de desktop table ca restul modulelor comerciale.
- "Solarii" si "Culturi" nu sunt module separate in navigare; sunt subflow-uri in Parcele/Detalii parcela.

### ❌ Ce lipseste complet
- Nu exista modul dedicat distinct "Solarii" in meniu principal.
- Nu exista componenta unificata de "actions rail" comuna tuturor modulelor.

### 📝 Observatii si recomandari scurte
- Decideti explicit: Produse/Investitii raman card-grid pe desktop sau migreaza la `ResponsiveDataView` pentru consistenta.

---

## 5. REGULI & PATTERNS EXISTENTE

### ✅ Ce e implementat si functioneaza
- Documentatie ampla in `docs/`: `PATTERNS.md`, `STRUCTURE.md`, `MODULES.md`, `AUDIT.md`, `BUGS_AND_TASKS.md`, etc.
- Pattern-ul App Router "thin page + PageClient" este predominant respectat.
- Evidenta migration chain:
  - total migrari: **127**
  - ultimele 10 (descrescator lexical):
    1. `2026033005_create_meteo_cache.sql`
    2. `2026033004_parcele_scop_operational_dashboard.sql`
    3. `2026033004_create_tenant_settings.sql`
    4. `2026033003_add_lat_long_to_parcele.sql`
    5. `2026033002_culturi_interval_tratament_zile.sql`
    6. `2026033001_parcele_rol_column.sql`
    7. `20260329001_create_produse.sql`
    8. `20260328123000_profiles_add_dashboard_layout.sql`
    9. `20260328011_add_fk_cascade_policies.sql`
    10. `20260328010_refresh_stale_views.sql`
- RLS/policies:
  - aparitii `create policy|alter policy` in migrari: **255**.

### ⚠️ Ce e partial implementat sau inconsistent
- Documentatia este bogata, dar unele pagini din docs par usor in urma fata de starea actuala (ex: referinte mai vechi la anumite componente sau structuri).
- Exista mentionat "dead code" in docs si se confirma in repo (ex: `ActivitatiAgricolePageClient.tsx` vechi).

### ❌ Ce lipseste complet
- Nu exista un raport automatizat de "docs drift" care sa compare claims din docs cu codul curent.

### 📝 Observatii si recomandari scurte
- Introduceti un checklist periodic "docs parity" pe module critice.

---

## 6. AI CHAT ASSISTANT

### ✅ Ce e implementat si functioneaza
- Structura este modularizata (nu monolitica):
  - `route.ts`, `chat-post-handler.ts`, `contract-helpers.ts`, `flow-detection.ts`, `extractors.ts`, `signal-detectors.ts`, `conversation-memory.ts`, `date-helpers.ts`, `utils.ts`, `ai-usage-limit.ts`, plus endpointuri `usage`/`count`.
- Model folosit:
  - `AI_GEMINI_MODEL` fallback `gemini-2.5-flash`,
  - model simplu optional `AI_GEMINI_SIMPLE_MODEL`.
- Rate limiting:
  - env `AI_CHAT_DAILY_LIMIT`,
  - RPC `check_and_increment_ai_usage`,
  - endpointuri dedicate pentru usage/count.
- Flows suportate in contract/open_form:
  - `cheltuiala`, `investitie`, `recoltare`, `activitate`, `comanda`, `client`.

### ⚠️ Ce e partial implementat sau inconsistent
- Logica din `chat-post-handler.ts` este foarte lunga/complexa (modularizata, dar orchestratorul ramane mare).
- Exista dualitate legacy `prefill` vs `prefill_data` (compatibilitate), ceea ce creste complexitatea.

### ❌ Ce lipseste complet
- Nu exista folder `src/app/api/ai/`; totul este sub `src/app/api/chat/` (functional, dar naming-ul cerut in prompt nu exista literal).

### 📝 Observatii si recomandari scurte
- Continuati decompozitia orchestratorului in "decision stages" separate + test harness pe fiecare stage.

---

## 7. PWA & MOBILE

### ✅ Ce e implementat si functioneaza
- PWA configurat in `next.config.js` cu `next-pwa`, `runtimeCaching` explicit:
  - public pages: `NetworkFirst`,
  - API GET: `NetworkOnly`,
  - navigare generala: `NetworkOnly`,
  - static assets: `StaleWhileRevalidate`,
  - imagini: `CacheFirst`.
- Manifest prezent (`src/app/manifest.ts`) cu `display: standalone`, `start_url: /dashboard`, icon set complet.
- Safe area insets utilizate consistent (`env(safe-area-inset-*)`) in `globals.css`, tab bar, dialog/sheet/footer etc.
- Dark mode sync script inline exista in `src/app/layout.tsx` (in `<head>`).

### ⚠️ Ce e partial implementat sau inconsistent
- Strategia API GET `NetworkOnly` este sigura la consistenta, dar reduce beneficiul offline pentru endpointuri ce ar putea fi cache-abile.

### ❌ Ce lipseste complet
- Nu exista o documentatie tehnica scurta, centralizata, strict pentru strategia de cache PWA curenta (in cod exista, dar nu ca one-pager dedicat).

### 📝 Observatii si recomandari scurte
- Adaugati "PWA cache matrix" documentat pe rute/endpoints pentru debugging mai usor.

---

## 8. SECURITATE & STOCK

### ✅ Ce e implementat si functioneaza
- Advisory locks sunt prezente in migrari (`pg_advisory_xact_lock`, `hashtext`) pe fluxuri stock/order critice.
- Functii/migrari stock/stoc sunt numeroase (match in mai multe migrari, incluzand hardening si verificari downstream).
- `SUPABASE_SERVICE_ROLE_KEY` apare doar in `src/lib/supabase/admin.ts` (server-only helper), nu in componente client.
- Headers de securitate in `next.config.js`:
  - `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

### ⚠️ Ce e partial implementat sau inconsistent
- Din cauza migrarilor cu SQL dinamic (`execute format(...)`), sumarul exact "policies per table" nu este trivial de extras static fara parser SQL dedicat.

### ❌ Ce lipseste complet
- Nu exista in repo un raport automat "RLS coverage per table" generat periodic.

### 📝 Observatii si recomandari scurte
- Generati un artefact de audit SQL (policy matrix) la fiecare release major.

---

## 9. PRODUSE MODULE

### ✅ Ce e implementat si functioneaza
- Modul exista:
  - `src/app/(dashboard)/produse/ProdusePageClient.tsx`
  - query layer `src/lib/supabase/queries/produse.ts`.
- CRUD implementat (`get/create/update/delete`).
- Supabase Storage pentru imagini este implementat:
  - bucket `produse-photos`,
  - upload + resize + public URL,
  - delete foto.
- UI include Add/Edit dialogs si carduri produs.

### ⚠️ Ce e partial implementat sau inconsistent
- Integrarea cu Comenzi/Vanzari este limitata:
  - in `comenzi.ts` exista camp `produs` la nivel textual/stock context,
  - in `vanzari.ts` nu apare integrare directa cu tabela `produse` (no match pe query file scanat).
- Rezulta ca "catalog produse" nu pare inca sursa canonica obligatorie pentru fluxurile comerciale.

### ❌ Ce lipseste complet
- Nu exista dovada unei legaturi FK ferme intre `comenzi/vanzari` si `produse` (pe scanul actual de query layer).

### 📝 Observatii si recomandari scurte
- Daca obiectivul e un catalog unificat, merita migrare treptata spre referinta `produs_id` in fluxurile comerciale.

---

## 10. LANDING PAGE & LEGAL

### ✅ Ce e implementat si functioneaza
- Landing page exista in `src/app/page.tsx` cu sectiuni multiple:
  - Hero, Problems, Solution, Testimonials, HowItWorks, Modules, FarmTypes, Story, About, Demo, Mobile, Install, FAQ, Beta, Footer, WhatsAppButton.
- Open Graph + Twitter metadata sunt setate pe landing:
  - titlu, descriere, imagine, locale/siteName.
- Rute legale exista:
  - `/termeni`
  - `/confidentialitate`.

### ⚠️ Ce e partial implementat sau inconsistent
- Paginile legale au continut placeholder:
  - "Pagina este in constructie".

### ❌ Ce lipseste complet
- Continut legal complet (termeni/confidentialitate reale, finale) lipseste.

### 📝 Observatii si recomandari scurte
- Prioritizati publicarea textelor legale finale inainte de scale/commercial rollout.

---

## SCOR GENERAL

**8.1 / 10**

Motivare scurta:
- arhitectura buna, modularizare avansata, multi-tenant/RLS matur, dashboard si mobile UX solide;
- scade scorul pe inconsistente de pattern intre module, hardcoded design remnants, si continut legal incomplet.

---

## TOP 10 PRIORITATI (ordonate)

1. Finalizare continut legal real pentru `/termeni` si `/confidentialitate`.
2. Unificare navigation config (Sidebar + BottomTabBar + MoreMenu) intr-o sursa comuna.
3. Reducere hardcoded brand colors; enforce via lint rule.
4. Uniformizare layout module desktop (decizie clara pentru Produse/Investitii).
5. Clarificare si standardizare emoji map (design tokens vs sidebar/nav runtime).
6. Consolidare integrarii `produse` in fluxurile Comenzi/Vanzari (spre `produs_id` canonic).
7. Extragere raport automat RLS coverage/policies per table.
8. Simplificare suplimentara a orchestratorului AI (`chat-post-handler.ts`) prin separare pe stadii.
9. Document "PWA cache matrix" pentru operare/debug.
10. Curatare tehnica progresiva a zonelor legacy/dead code mentionate in docs.

