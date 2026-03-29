# DOMAIN_RULES

## Main Entities

- `tenants`: farm workspace and billing/demo container
- `profiles`: user profile with tenant and privilege metadata
- `parcele`: farm units such as field, orchard, or solar
- `culturi`: crop rows linked mainly to solar units
- `crops` and `crop_varieties`: catalog/nomenclature for crop and variety suggestions
- `culegatori`: workers/pickers
- `clienti`: buyers/contacts
- `activitati_agricole`: treatments, fertilization, irrigation, pruning, misc activities
- `recoltari`: harvest records
- `miscari_stoc`: stock ledger
- `comenzi`: delivery orders
- `vanzari`: sales
- `vanzari_butasi` and `vanzari_butasi_items`: seedling order workflow
- `cheltuieli_diverse`: operational expenses
- `investitii`: capital-like investments
- `solar_climate_logs`: solar climate telemetry
- `culture_stage_logs`: solar crop stage progression
- `analytics_events`: application and product telemetry
- `alert_dismissals`: dismissed alert tracking
- `integrations_google_contacts`: Google contacts integration state

## Core Business Relationships

- A user belongs to a `profile`.
- A profile points to one current `tenant`.
- Most business rows belong to exactly one tenant.
- A `parcela` can have many `recoltari` and many `activitati_agricole`.
- A solar parcel can have multiple `culturi`.
- A `recoltare` belongs to a parcel and a picker.
- A `comanda` may create or link to a `vanzare`.
- `miscari_stoc` reflect stock deltas caused by harvests, sales, orders, corrections, and transformations.
- `vanzari_butasi` has many `vanzari_butasi_items`.

## Parcel And Solar Rules

- `tip_unitate` distinguishes `camp`, `solar`, `livada`, and `cultura_mare`.
- Solar flows differ from classic parcel flows.
- Solar units can store multiple crop rows instead of one simple crop/variety pair.
- Solar creation/edit flows now save only base unit metadata; adding or editing crops for a solar is done from Solar Details, which is the active source of truth for `culturi`.
- Hidden structured metadata for solar crop rows may be embedded in parcel notes using markers handled by `src/lib/parcele/crop-config.ts`.
- Harvest notes can also embed hidden selected-crop metadata.
- Parcel delete is blocked when linked harvests or agricultural activities exist.

## Harvest Rules

- Harvests are stock-affecting records and should use the RPC-backed flow.
- Harvest quantities are split into `kg_cal1` and `kg_cal2`.
- Harvest creates/updates/deletes can cascade into stock and labor-expense recalculation.
- Labor aggregation can auto-create or update an expense row with category `Manoperă cules`.
- Deleting a harvest may be blocked if downstream stock has already been consumed/sold.

## Stock Rules

- `miscari_stoc` acts as the stock ledger, not a simple snapshot table.
- Available stock is calculated by signed movement aggregation.
- Outflows include sales, free giveaways, losses, and consumption.
- Stock is segmented by:
  - location/parcela
  - product
  - quality (`cal1`, `cal2`)
  - storage (`fresh`, `congelat`, `procesat`)
- Order delivery and sales updates use atomic stock-safe RPCs.
- The reports module now includes an automated stock audit that compares:
  - `recoltari` totals
  - `vanzari` totals
  - ledger movements from `miscari_stoc`
- The reports module also supports multi-granular stock reporting at these safe levels:
  - product
  - product + location
  - product + variety
  - product + variety + location
  - product + location type
- Granular reporting must never infer a finer grain than the source data provides.
- Harvest reporting can use explicit detail from `recoltari` enriched with `culturi` and `parcele`.
- Sales without explicit variety stay aggregated at product level; the app must not invent variety allocations.
- Sales can be shown by location only when the ledger explicitly carries that location through `miscari_stoc`.
- The stock audit section is farm-wide and does not follow the upper report filters (`perioada`, `parcela`, `cultura`) from the same page.
- The stock audit is advisory and rule-based. Current explicit thresholds are:
  - stock sync delta above 1 kg = anomaly
  - stock bucket below 20 kg = warning
  - negative stock bucket = critical
- If `miscari_stoc` is missing/unavailable (or empty while operational records exist), audit output is marked as degraded/partial.

## Sistem Dual de Stoc (`miscari_stoc`)

Tabelul `miscari_stoc` ține în paralel două moduri de contabilizare:

1. `Global` prin `cantitate_cal1` și `cantitate_cal2`, folosit de `getStocGlobal()`.
2. `Per-locație` prin `cantitate_kg`, `locatie_id`, `calitate` și `depozit`, folosit de fluxurile operaționale precum `deliver_order_atomic()`.

**Regula de bază:** orice `INSERT` în `miscari_stoc` trebuie să populeze ambele sisteme, nu doar unul singur.

- RPC-urile critice (`sync_recoltare_stock_movements`, `deliver_order_atomic`, update/delete stock-safe flows) sunt sursa preferată și populează corect datele pentru ambele perspective.
- Helper-ul TypeScript `insertMiscareStoc()` din `src/lib/supabase/queries/miscari-stoc.ts` trebuie să păstreze aceeași regulă pentru ajustările manuale.
- Dacă inserarea reprezintă o singură calitate (`cal1` sau `cal2`), valorile globale și `cantitate_kg` trebuie să fie coerente între ele.
- Dacă un flux scrie doar `cantitate_cal1` / `cantitate_cal2` fără `cantitate_kg`, rapoartele globale și verificările per-locație pot diverge.
- Dacă un flux scrie doar `cantitate_kg` fără `cantitate_cal1` / `cantitate_cal2`, `getStocGlobal()` devine incomplet chiar dacă bucket-urile pe locație par corecte.

## Orders And Sales Rules

- `comenzi` represent open or historical client orders.
- Order statuses include `noua`, `confirmata`, `programata`, `in_livrare`, `livrata`, `anulata`.
- Delivering an order can:
  - deduct stock
  - create a linked sale
  - optionally split remaining quantity into a follow-up order
- `vanzari` create/update/delete flows also use stock-aware RPCs.
- Payments are normalized around statuses like `platit`, `avans`, `restanta`.

## Seedling Sales Rules

- `vanzari_butasi` is a separate commercial workflow from produce sales.
- An order must contain at least one line item.
- Totals, quantities, and derived unit price are recomputed from line items.
- Cancelled seedling orders restrict some edits.

## Finance Rules

- `cheltuieli_diverse` is the OPEX module for current operational costs, not long-lived assets.
- `investitii` is the CAPEX module for longer-lived farm assets or development spending.
- OPEX categories should stay simple and universal:
  - `Îngrășăminte`
  - `Tratamente fitosanitare`
  - `Ambalaje`
  - `Forță de muncă`
  - `Combustibil / energie`
  - `Consumabile`
  - `Transport`
  - `Reparații / întreținere`
  - `Servicii`
  - `Altele`
- CAPEX categories should stay simple and universal:
  - `Material săditor`
  - `Irigații`
  - `Sisteme de susținere`
  - `Construcții`
  - `Echipamente / utilaje`
  - `Depozitare`
  - `Infrastructură`
  - `Solarii / sere`
  - `Îmbunătățiri teren`
  - `Altele`
- Fine-grained product/vendor detail should go primarily in `descriere` / `observații`, not in mandatory deep taxonomies.
- `cheltuieli_diverse.metoda_plata` is part of the intended model, but query code still tolerates environments where that column is not migrated yet.

## Client Rules

- Clients are tenant-scoped.
- Google Contacts sync can create or update clients by matching:
  - `google_resource_name`
  - email
  - phone
- Client deletion is blocked when linked sales, orders, or seedling sales exist.

## Agricultural Activity Rules

- Activities track date, parcel, activity type, product, dosage, pause days, operator, and notes.
- Treatment pause days matter for harvest readiness and alerts.
- Activities without operator after enough time may generate smart alerts.
- When selected parcel `tip_unitate` is `cultura_mare`, activity choices must be limited to: `Arat`, `Discuit`, `Semănat`, `Erbicidat`, `Stropit`, `Recoltat`, `Irigat`.

## Analytics Rules

- Analytics writes must not block UX.
- Page views, form lifecycle, sync results, and integration events are written to `analytics_events`.
- Most tracking is tenant-scoped and user-scoped.
- The safe runtime contract currently relies on the linked-schema subset centered on `event_data`, `module`, `page_url`, `status`, and `session_id`; richer analytics columns from later local migrations should be treated as migration intent until the remote chain is fully caught up.
- Reporting currently reconciles two event styles:
  - `track(...)` for page-view and legacy/simple events
  - `trackEvent(...)` for module/status-aware events
- New product analytics work should prefer the standardized `trackEvent(...)` taxonomy:
  - `module_opened`
  - `form_started`
  - `form_completed`
  - `form_failed`
  - `form_abandoned`
  - `entity_created`
  - `entity_updated`
  - `entity_deleted`
  - `import_completed`
  - `import_failed`
  - `export_completed`
  - `search_performed`
  - `sync_completed`
  - `sync_failed`
- `tenant_metrics_daily` is only a coarse snapshot layer; module usage, funnels, inactive tenants, and failed-action analytics in the admin dashboard still derive from raw `analytics_events`.
- Current analytics naming is transitional rather than fully normalized, so new instrumentation should prefer consistent module-aware events instead of inventing more one-off names.

## Offline And Idempotency Rules

- Some create flows rely on `client_sync_id` and `sync_status`.
- IndexedDB stores pending offline mutations.
- Server-side idempotent upsert is expected for sync replay.
- Conflict states are tracked and can be resolved manually.

## Demo Rules

- Demo mode is tenant-based, not just UI-only.
- Demo tenants can be created as guest accounts.
- Demo records are marked with `data_origin` and/or `demo_seed_id`.
- Demo data can be seeded, reloaded, deleted, and auto-cleaned after expiration.
- Demo workflows must never affect real tenants.

## Admin And Privilege Rules

- Superadmin capability is stored on `profiles.is_superadmin`.
- AI chat daily limit override to 60 applies to superadmins and to the dedicated test account `zmeurel.app@gmail.com`; all other users keep `AI_CHAT_DAILY_LIMIT`.
- Admin pages are protected in layout.
- Service-role operations are used for:
  - cron jobs
  - demo repair/cleanup
  - protected deletes
  - some admin actions

## Reporting And Plan Rules

- Subscription plan logic exists, but current beta config forces effective enterprise behavior.
- Plan-gated logic should still be treated as real domain logic because tests and code paths exist.

## Operational Invariants

- Every business write must preserve tenant isolation.
- Destructive flows must delete child/linked rows before parents.
- When a new tenant-scoped table is added, all destructive flows must be updated together:
  - `farm/reset`
  - `gdpr/farm`
  - demo reset/reload/cleanup
- The canonical delete order is shared in code so destructive routes stay aligned.
- The canonical delete order also covers tenant-scoped catalog/customization tables such as `crops`, `crop_varieties`, `nomenclatoare`, and `activitati_extra_season` when farm data is wiped without deleting the tenant row itself.
- Database schema changes must be implemented via migrations only.
- Business IDs should be generated through the `generate_business_id` RPC helper where that pattern already exists.
- Because linked environments can lag the repaired RPC definition, client helpers may temporarily fall back to a locally generated business ID when the RPC repeats the same prefix/number pair.
- RPCs that accept `tenant_id` or generic target-table inputs must validate ownership/allowlists in SQL; client arguments are not sufficient security boundaries.
- The offline sync layer also keeps a client-side allowlist for RPC target tables, but SQL remains the final enforcement boundary.
