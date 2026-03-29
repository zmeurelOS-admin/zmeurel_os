# ANALYTICS_AUDIT

## Verdict

Analytics-ul actual este suficient de bun pentru beta ca sistem de observabilitate de produs, dar nu este încă un model matur sau scalabil pe termen lung. Aplicația poate răspunde deja la câteva întrebări utile despre utilizare, module populare, succesul unor formulare și sănătatea offline sync, însă taxonomia de evenimente este mixtă, acoperirea pe module este inegală, iar dashboard-ul admin încă agregă prea mult direct din `analytics_events`.

Pe scurt:

- util pentru beta
- incomplet pentru funnels și feature adoption coerente
- acceptabil ca performanță azi
- insuficient pregătit pentru volum mai mare fără agregări suplimentare

## Current Implementation Inventory

### Storage And Data Model

- Product analytics este stocat în `public.analytics_events`.
- Există și un strat de agregare zilnică în `public.tenant_metrics_daily`.
- `analytics_events` are coloane evoluate incremental:
  - `event_name`
  - `event_type`
  - `module`
  - `metadata`
  - `status`
  - `session_id`
  - plus coloane legacy/paralele precum `event_data` și `page_url`
- În schema linked folosită azi pentru tipuri generate și validare de build, subsetul sigur confirmat este:
  - `event_name`
  - `event_data`
  - `module`
  - `page_url`
  - `status`
  - `session_id`
  - `tenant_id`
  - `user_id`
- Din cauza drift-ului de migrații remote, codul analytics rulează acum pe acest subset comun, iar eventualele coloane `metadata` / `event_type` trebuie tratate ca intenție de schemă locală până la repararea lanțului de migrații.
- Lanțul local de migrații a fost între timp reparat pentru a redeveni pushable din perspectivă de naming și structură, dar proiectul linked încă trebuie resincronizat efectiv cu o sesiune DB validă.
- `tenant_metrics_daily` conține snapshot-uri coarse:
  - tenanți activi
  - parcele
  - recoltări
  - vânzări
  - kg recoltate
  - venit agregat

### Tracking Helpers

Repo-ul folosește două helper-e client-side diferite:

- `src/lib/analytics/track.ts`
  - legacy/simple helper
  - scrie `event_name`, `event_data`, `page_url`, `session_id`
  - rulează pe subsetul comun confirmat între schema linked și migrațiile locale
  - nu folosește sistematic coloana `module`
- `src/lib/analytics/trackEvent.ts`
  - helper-ul mai structurat
  - scrie `event_name`, `module`, `event_data`, `status`, `session_id`
  - compatibilitatea de schemă este izolată în `src/lib/analytics/schema.ts`

Ambele sunt fire-and-forget și înghit erorile intenționat, ceea ce este corect pentru UX, dar poate ascunde degradări de tracking.

### Global Tracking

- `src/components/app/PageViewTracker.tsx` trimite `page_view` pentru toate rutele.
- `src/lib/analytics/useTrackModuleView.ts` standardizează module views prin `module_opened`.
- `src/app/layout.tsx` include separat:
  - `@vercel/analytics`
  - `@vercel/speed-insights`
- `src/components/app/MonitoringInit.tsx` și Sentry nu fac parte din product analytics.

### Admin Analytics

- `src/app/(dashboard)/admin/analytics/page.tsx` protejează accesul server-side pentru superadmin.
- `src/components/admin/AnalyticsDashboard.tsx`:
  - citește `tenant_metrics_daily`
  - citește număr de useri și tenanți
  - citește raw `analytics_events` pe ultimele 30 zile
  - derivă în componentă:
    - DAU / WAU
    - active tenants
    - module usage
    - create funnel
    - inactive tenants
    - top failed actions
    - secțiune AI bazată pe `ai_chat_decision` cu KPI-uri pragmatice (`open_form`, clarificări, `llm_fallback`, `save_hint`, `continuation`), distribuții pe flow și decision mode, fricțiune pe flow, usage LLM și tabel recent fără text brut
  - filtrele AI sunt ținute intenționat mici: interval (`7d`/`30d`), `flow`, `decision mode`

## Event Taxonomy Assessment

## What Exists Today

Taxonomia actuală combină cel puțin trei stiluri:

- legacy action naming:
  - `vanzare_add`
  - `parcela_edit`
  - `cheltuiala_delete`
- generic lifecycle naming:
  - `open_create_form`
  - `create_success`
  - `create_failed`
  - `form_abandoned`
  - `delete_item`
- feature-specific custom naming:
  - `butasi_order_created`
  - `butasi_order_status_changed`
  - `export_raport`
  - `open_dashboard`
  - `view_rapoarte`

### Strengths

- există deja noțiunea de `module`
- există deja noțiunea de `status`
- există `session_id`, care poate ajuta la funnels și analiză de sesiune
- există semnale bune pentru create flows și offline sync

### Problems

- `track(...)` și `trackEvent(...)` coexistă și produc evenimente cu forme diferite
- `event_type` duplică practic `event_name` în implementarea curentă
- unele view events istorice sunt `page_view`, `view_module` sau `open_dashboard`, în timp ce convenția nouă folosește `module_opened`
- unele module emit lifecycle generic, altele emit nume bespoke
- unele acțiuni cheie există doar ca event legacy, fără `module` explicit

### Taxonomy Verdict

Taxonomia este acum parțial standardizată în codul nou și modificat recent, dar coexistă încă cu evenimente legacy istorice. Convenția singulară pentru lucru nou există acum, însă reporting-ul trebuie încă să accepte o perioadă de tranziție.

## Feature Coverage Assessment

### Better Covered

- `recoltari`
- `vanzari`
- `activitati`
- `cheltuieli`
- `parcele`
- `vanzari-butasi`
- `dashboard`
- `auth`
- `rapoarte`
- offline sync

### Partial Coverage

- `comenzi`
  - are add/edit/delete/search
  - nu are funnel complet standardizat
- `culturi`
  - are create success/failed/abandoned în Solar Details
- `settings`
  - are export events, dar nu o taxonomie mai largă de usage

### Weak Or Missing Coverage

- `stocuri`
  - are acum în principal `module_opened`, dar nu are încă evenimente de acțiune deoarece ruta este aproape read-only
- `planuri`
  - are acum `module_opened`, dar nu are flows comerciale active în beta
- majoritatea fluxurilor de settings care nu sunt export

### Coverage Improved After Taxonomy Standardization

- `clienti`
  - `module_opened`
  - `form_started`
  - `entity_created`
  - `entity_updated`
  - `entity_deleted`
  - `import_started`
  - `import_completed`
  - `import_failed`
- `culegatori`
  - `module_opened`
  - `form_started`
  - `entity_created`
  - `entity_updated`
  - `entity_deleted`
- `investitii`
  - `module_opened`
  - `form_started`
  - `entity_created`
  - `entity_updated`
  - `entity_deleted`
- `stocuri`
  - `module_opened`
- `planuri`
  - `module_opened`

## Beta Usefulness Assessment

## Insights Already Possible Today

Sistemul actual poate răspunde rezonabil la:

- care module sunt vizualizate mai des
- câți utilizatori activi există azi sau în ultimele 7 zile
- câți tenanți activi există în ultimele 7 zile
- ce create flows sunt începute, finalizate sau abandonate pentru modulele deja instrumentate
- unde apar acțiuni eșuate în create flows și offline sync
- cât de des este folosit exportul
- câți utilizatori pornesc demo-ul
- unde există feedback submit / feedback click

## What It Cannot Answer Reliably Yet

- retenție reală pe cohorte
- “returning users” într-un model clar și stabil
- adoption complet pe module precum `clienti`, `investitii`, `culegatori`, `stocuri`
- funnel coerent pentru toate create/edit/delete flows
- top friction points pentru majoritatea formularelor
- care feature produce cel mai mult “value realized”, nu doar usage
- comparații curate între module, deoarece naming-ul nu este uniform

## KPI Usefulness For Beta

### KPI-uri deja bune pentru beta

- DAU
- WAU
- active tenants 7d
- module views
- create success vs abandoned pentru modulele instrumentate
- top failed actions
- sync failed / sync success
- export usage

### KPI-uri care lipsesc pentru decizii mai bune

- active users by module
- create/update/delete success rate per module
- search usage per module într-un format coerent
- onboarding funnel real
- form completion time / session-depth proxies
- top error categories normalizate
- value KPIs:
  - orders delivered
  - harvests logged
  - sales recorded
  - expenses recorded
  - crops added in solar details

## Admin Analytics Performance And Scaling

## Current Behavior

`AnalyticsDashboard` citește raw `analytics_events` pe 30 zile și agregă în memorie pentru:

- module usage
- create funnel
- inactive tenants
- top failed actions
- DAU / WAU

`tenant_metrics_daily` este folosit doar pentru snapshot-uri coarse, nu pentru analytics de produs.

## Performance Assessment

Pentru beta, această abordare este acceptabilă. Pentru volum mai mare, devine hotspot clar.

### Main Scaling Risk

Cel mai mare risc este scanarea raw a `analytics_events` pe 30 zile cu agregare în componentă server-side. Chiar dacă accesul este admin-only și server-side, costul va crește cu:

- mai mulți utilizatori
- mai mulți tenanți
- mai multe evenimente per sesiune
- mai mult tracking pe module noi

### Most Expensive Pattern

- un singur request admin citește multe rânduri brute
- KPI-urile sunt derivate la request-time
- nu există rollup dedicat pentru:
  - module usage daily
  - funnel daily
  - failed actions daily

## Scalability Path

## Safe Evolution For Beta

Fără redesign mare, următorii pași siguri sunt:

1. standardizarea tuturor evenimentelor noi pe helper-ul `trackEvent(...)`
2. documentarea convenției de naming și a câmpurilor standard
3. repararea lanțului de migrații remote, apoi realinierea tipurilor Supabase cu schema analytics dorită complet
4. păstrarea `tenant_metrics_daily` pentru snapshot-uri coarse

## Recommended Post-Beta Evolution

Adăugarea unor agregări zilnice dedicate, nu mutarea completă a analytics-ului într-un alt sistem.

Tabele sau rollup-uri recomandate:

- `analytics_module_usage_daily`
- `analytics_funnel_daily`
- `analytics_failures_daily`
- eventual `analytics_feature_value_daily`

Acestea ar trebui populate din cron/job-uri server-side și folosite de dashboard-ul admin înaintea raw scans.

## Recommended Event Naming Convention

### Preferred Pattern

Convenția adoptată pentru codul nou și standardizat recent este o taxonomie generică cu `module`, `status` și metadata explicită:

- `module_opened`
- `form_started`
- `form_completed`
- `form_failed`
- `form_abandoned`
- `entity_created`
- `entity_updated`
- `entity_deleted`
- `search_performed`
- `export_completed`
- `sync_completed`
- `sync_failed`
- `auth_logged_in`
- `auth_registered`
- `demo_started`

### Field Guidance

- `module`: modul funcțional, de ex. `recoltari`, `vanzari`, `clienti`
- `status`: `started`, `success`, `failed`, `abandoned` unde are sens
- `metadata`:
  - `entity_type`
  - `surface`
  - `report_type`
  - `error_message`
  - `rows`
  - `source`

Nu este nevoie de un refactor imediat al datelor istorice. Convenția se aplică deja pe evenimentele noi și pe o parte din modulele migrate, iar dashboard-ul admin tratează încă și naming-ul legacy pentru compatibilitate.

## Product Analytics vs Monitoring Boundaries

### Product Analytics

- `analytics_events`
- tenant-scoped și user-scoped
- usage, funnels, actions, success/failure, adoption

### Operational Monitoring

- Sentry
- excepții, warnings, diagnostics
- nu trebuie confundat cu KPI-urile de produs

### Traffic / Web Performance

- Vercel Analytics
- Vercel Speed Insights
- utile pentru trafic și web vitals, nu pentru funnels pe tenant

## Low-Risk Improvements Identified

Au fost făcute deja îmbunătățiri low-risk de standardizare:

- naming legacy din `trackEvent(...)` este normalizat spre evenimente canonice
- dashboard-ul admin acceptă atât naming-ul nou, cât și o parte din evenimentele legacy
- modulele `clienti`, `culegatori`, `investitii`, `stocuri` și `planuri` au acoperire mai bună

Următoarele îmbunătățiri sigure rămân:

- migrarea treptată a ultimelor evenimente `track(...)` cu valoare mare către `trackEvent(...)`
- menținerea tipurilor generate Supabase sincronizate cu migrațiile analytics și cu proiectul Supabase linked
- agregări zilnice suplimentare pentru admin analytics înainte de scale-up

## AI Beta Threshold Signals

- Secțiunea AI din `/admin/analytics` include acum praguri locale, pragmatice pentru beta, pe KPI-uri de sănătate:
  - `llm_fallback_rate`
  - `clarification_rate`
  - `open_form_rate`
  - `save_hint_rate`
  - `continuation_rate`
- UI-ul marchează fiecare KPI cu `Bun / Atenție / Risc`, include o legendă scurtă și un sumar „Necesită atenție acum”.
- Aceste praguri sunt orientative pentru hardening operațional în beta și nu trebuie tratate ca SLA final enterprise.

## Final Recommendation

Analytics-ul curent este bun suficient pentru beta dacă obiectivul este:

- să vedem ce module se folosesc
- să vedem ce create flows merg sau se abandonează
- să vedem dacă offline sync produce probleme

Nu este încă bun suficient pentru:

- growth analytics matur
- comparații curate între toate modulele
- dashboard admin care să scaleze elegant cu volum mare

Cel mai bun următor pas este standardizarea taxonomiei pentru evenimentele noi și mutarea treptată a KPI-urilor admin către agregări zilnice dedicate.
