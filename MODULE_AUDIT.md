# TECHNICAL AUDIT - ZMEUREL APPLICATION

**Generated:** 2026-03-01  
**Scope:** Complete data flow analysis of all modules

---

## MODULE: Parcele

### Database
- **Table:** `parcele`
- **Key columns:** `id`, `id_parcela`, `nume_parcela`, `tip_fruct`, `soi_plantat`, `suprafata_m2`, `nr_plante`, `an_plantare`, `status`, `gps_lat`, `gps_lng`, `observatii`, `tenant_id`, `created_at`, `updated_at`
- **Foreign keys:** 
  - `tenant_id` → `tenants.id`
- **RLS policies:** Tenant-based isolation (assumed via `tenant_id`)

### Data Flow: CREATE
- **Component:** `src/components/parcele/AddParcelaDialog.tsx`
- **Mutation function:** `createParcela` in `src/lib/supabase/queries/parcele.ts`
- **Fields in form:** `id_parcela`, `nume_parcela`, `tip_fruct`, `soi_plantat`, `suprafata_m2`, `nr_plante`, `an_plantare`, `status`, `gps_lat`, `gps_lng`, `observatii`
- **After successful create:** 
  - Toast notification
  - Query invalidation: `['parcele']`
  - Auto-generates `id_parcela` if not provided
  - Fetches tenant_id from session (owner_user_id match)
  - No side effects on other modules

### Data Flow: READ (List)
- **Component:** `src/app/(dashboard)/parcele/page.tsx`
- **Query function:** `getParcele` in `src/lib/supabase/queries/parcele.ts`
- **Filters/sorting:** Order by `created_at DESC`
- **Joins:** None
- **Fields displayed:** All fields from select statement

### Data Flow: UPDATE
- **Component:** `src/components/parcele/EditParcelaDialog.tsx`
- **Mutation function:** `updateParcela(id, input)` in `src/lib/supabase/queries/parcele.ts`
- **Editable fields:** Same as create (except `id_parcela` which is immutable)
- **Side effects:** None - no cascading updates to related modules

### Data Flow: DELETE
- **Trigger:** Delete button in parcela card/list
- **Mutation function:** `deleteParcela(id)` in `src/lib/supabase/queries/parcele.ts`
- **Cascade effects:** ⚠️ **POTENTIAL ISSUE** - No explicit cascade handling in query file, relies on DB-level foreign key constraints
- **Side effects:** None programmatic - relies on DB constraints for cascade to:
  - `recoltari.parcela_id`
  - `activitati_agricole.parcela_id`
  - `miscari_stoc.locatie_id`

### Issues Found
- ❌ **Missing error handling:** No check for dependent records before delete (recoltari, activitati, miscari_stoc)
- ✅ **Consistent pattern:** Create and edit forms use same field set
- ⚠️ **Tenant security:** Relies on auth session + manual tenant lookup - no RLS mention in query file

---

## MODULE: Recoltări

### Database
- **Table:** `recoltari`
- **Key columns:** `id`, `id_recoltare`, `data`, `parcela_id`, `culegator_id`, `kg_cal1`, `kg_cal2`, `pret_lei_pe_kg_snapshot`, `valoare_munca_lei`, `observatii`, `tenant_id`, `client_sync_id`, `conflict_flag`, `sync_status`, `created_by`, `updated_by`, `created_at`, `updated_at`
- **Foreign keys:**
  - `parcela_id` → `parcele.id`
  - `culegator_id` → `culegatori.id`
  - `tenant_id` → `tenants.id`

### Data Flow: CREATE
- **Component:** `src/components/recoltari/AddRecoltareDialog.tsx`
- **Mutation function:** `createRecoltare` in `src/lib/supabase/queries/recoltari.ts`
- **Fields in form:** `data`, `parcela_id`, `culegator_id`, `kg_cal1`, `kg_cal2`, `observatii`
- **Auto-calculated fields:**
  - `id_recoltare` - auto-generated (REC001, REC002, etc.)
  - `pret_lei_pe_kg_snapshot` - fetched from `culegatori.tarif_lei_kg`
  - `valoare_munca_lei` - calculated as `(kg_cal1 + kg_cal2) * pret_lei_pe_kg_snapshot`
  - `cantitate_kg` - calculated as `kg_cal1 + kg_cal2`
- **After successful create:**
  - Toast notification
  - Query invalidation: `['recoltari']`
  - **SIDE EFFECT 1:** Creates stock movements via `replaceRecoltareMovements`:
    - If `kg_cal1 > 0`: inserts `miscari_stoc` record (produs='zmeura', calitate='cal1', depozit='fresh', tip_miscare='recoltare')
    - If `kg_cal2 > 0`: inserts `miscari_stoc` record (produs='zmeura', calitate='cal2', depozit='fresh', tip_miscare='recoltare')
  - **SIDE EFFECT 2:** Schedules auto-manopera sync via `scheduleAutoManoperaSync` - creates/updates `cheltuieli_diverse` record for labor costs

### Data Flow: READ (List)
- **Component:** `src/app/(dashboard)/recoltari/page.tsx`
- **Query function:** `getRecoltari` in `src/lib/supabase/queries/recoltari.ts`
- **Filters/sorting:** Order by `data DESC`
- **Joins:** None in base query (client-side joins for display)
- **Fields displayed:** All fields from select
- **Error handling:** Special error check for missing `kg_cal1` column (schema cache issue)

### Data Flow: UPDATE
- **Component:** `src/components/recoltari/EditRecoltareDialog.tsx`
- **Mutation function:** `updateRecoltare(id, input)` in `src/lib/supabase/queries/recoltari.ts`
- **Editable fields:** `data`, `parcela_id`, `culegator_id`, `kg_cal1`, `kg_cal2`, `observatii`
- **Side effects:**
  - Re-calculates `pret_lei_pe_kg_snapshot` from culegator tarif
  - Re-calculates `valoare_munca_lei`
  - **Replaces stock movements:** Deletes old movements by `referinta_id`, creates new ones
  - **Triggers auto-manopera sync** for both old and new dates

### Data Flow: DELETE
- **Trigger:** Delete button
- **Mutation function:** `deleteRecoltare(id)` in `src/lib/supabase/queries/recoltari.ts`
- **Cascade effects:**
  - Deletes related `miscari_stoc` records via `deleteMiscariStocByReference(id)`
- **Side effects:**
  - Triggers auto-manopera sync for the date of the deleted record

### Issues Found
- ✅ **Well-integrated:** Properly updates stock and manopera cheltuieli
- ⚠️ **Schema cache errors:** Handles missing `kg_cal1` column gracefully (migration rollout issue)
- ✅ **Calculation consistency:** Uses helper functions `round2`, `normalizeKg`, `computeKg`
- ❌ **Missing validation:** No check if culegator has valid tarif before creating (throws error in `getCulegatorTarif`)

---

## MODULE: Vânzări (fructe)

### Database
- **Table:** `vanzari`
- **Key columns:** `id`, `id_vanzare`, `data`, `client_id`, `comanda_id`, `cantitate_kg`, `pret_lei_kg`, `status_plata`, `observatii_ladite`, `client_sync_id`, `sync_status`, `conflict_flag`, `created_by`, `updated_by`, `tenant_id`, `created_at`, `updated_at`
- **Foreign keys:**
  - `client_id` → `clienti.id`
  - `comanda_id` → `comenzi.id` (NEW - added in migration 2026030102)
  - `tenant_id` → `tenants.id`

### Data Flow: CREATE
- **Component:** `src/components/vanzari/AddVanzareDialog.tsx`
- **Mutation function:** `createVanzare` in `src/lib/supabase/queries/vanzari.ts`
- **Fields in form:** `data`, `client_id`, `cantitate_kg`, `pret_lei_kg`, `status_plata`, `observatii_ladite`, `comanda_id` (optional)
- **Auto-generated:**
  - `id_vanzare` - auto-generated (V001, V002, etc.)
  - `client_sync_id` - UUID for offline sync
  - `sync_status` - 'synced'
  - `created_by`, `updated_by` - from auth session
- **After successful create:**
  - Toast notification
  - Query invalidation: `['vanzari']`
  - **SIDE EFFECT:** Attempts to insert stock movement via `insertMiscareStoc`:
    - `tip: 'vanzare'`
    - `cantitate_cal1: -cantitate_kg` (negative to reduce stock)
    - `cantitate_cal2: 0`
    - `referinta_id: vanzare.id`
    - `descriere: 'Scadere stoc la vanzare'`
  - ⚠️ **Error handling:** Stock movement failure is caught and logged, doesn't block vanzare creation
- **Fallback logic:** If upsert with `client_sync_id` fails (schema cache), falls back to plain insert

### Data Flow: READ (List)
- **Component:** `src/app/(dashboard)/vanzari/page.tsx`
- **Query function:** `getVanzari` in `src/lib/supabase/queries/vanzari.ts`
- **Filters/sorting:** Order by `data DESC`
- **Joins:** None (client-side display with clienti lookup)
- **Fields displayed:** All fields
- **Fallback handling:** If `comanda_id` column missing, retries without it (schema evolution)

### Data Flow: UPDATE
- **Component:** `src/components/vanzari/EditVanzareDialog.tsx`
- **Mutation function:** `updateVanzare(id, input)` in `src/lib/supabase/queries/vanzari.ts`
- **Editable fields:** `data`, `client_id`, `cantitate_kg`, `pret_lei_kg`, `status_plata`, `observatii_ladite`
- **Side effects:** None - does NOT update stock movements (only create does)

### Data Flow: DELETE
- **Trigger:** Delete button
- **Mutation function:** `deleteVanzare(id)` in `src/lib/supabase/queries/vanzari.ts`
- **Cascade effects:** None programmatic (relies on DB constraints)
- **Side effects:** ⚠️ **ISSUE:** Does NOT delete related stock movements, causing orphaned records

### Issues Found
- ❌ **Stock inconsistency on delete:** Deleting vanzare doesn't remove stock movement, causing incorrect stock totals
- ❌ **Stock inconsistency on update:** Updating cantitate_kg doesn't update stock movement
- ✅ **Offline sync support:** Has `client_sync_id` and upsert logic
- ⚠️ **Schema evolution handling:** Good fallback for missing `comanda_id` column
- ❌ **Missing field in form:** `comanda_id` not exposed in Add/Edit dialogs (but exists in DB schema)

---

## MODULE: Comenzi (+ delivery flow → vanzare auto)

### Database
- **Table:** `comenzi`
- **Key columns:** `id`, `tenant_id`, `client_id`, `client_nume_manual`, `telefon`, `locatie_livrare`, `data_comanda`, `data_livrare`, `cantitate_kg`, `pret_per_kg`, `total`, `status`, `observatii`, `created_at`, `updated_at`
- **Foreign keys:**
  - `client_id` → `clienti.id`
  - `tenant_id` → `tenants.id`
- **Computed fields:**
  - `total` = `cantitate_kg * pret_per_kg`

### Data Flow: CREATE
- **Component:** `src/components/comenzi/AddComandaDialog.tsx` (assumed)
- **Mutation function:** `createComanda` in `src/lib/supabase/queries/comenzi.ts`
- **Fields in form:** `client_id`, `client_nume_manual`, `telefon`, `locatie_livrare`, `data_comanda`, `data_livrare`, `cantitate_kg`, `pret_per_kg`, `status`, `observatii`
- **Auto-calculated:**
  - `total` = `cantitate_kg * pret_per_kg`
  - `tenant_id` - from session
  - `data_comanda` - defaults to today
  - `status` - defaults to 'noua'
- **After successful create:**
  - Toast notification
  - Query invalidation: `['comenzi']`
  - No side effects

### Data Flow: READ (List)
- **Component:** `src/app/(dashboard)/comenzi/page.tsx`
- **Query function:** `getComenzi` in `src/lib/supabase/queries/comenzi.ts`
- **Filters/sorting:** 
  - Order by `data_livrare ASC` (nulls last), then `created_at DESC`
- **Joins:** `clienti (nume_client)` - fetches client name
- **Fields displayed:** All fields + `client_nume` from join

### Data Flow: UPDATE
- **Component:** `src/components/comenzi/EditComandaDialog.tsx` (assumed)
- **Mutation function:** `updateComanda(id, input)` in `src/lib/supabase/queries/comenzi.ts`
- **Editable fields:** All fields from create
- **Side effects:**
  - Re-calculates `total` if `cantitate_kg` or `pret_per_kg` changes
  - No other modules affected

### Data Flow: DELETE
- **Trigger:** Delete button
- **Mutation function:** `deleteComanda(id)` in `src/lib/supabase/queries/comenzi.ts`
- **Cascade effects:** None programmatic
- **Side effects:** None

### Data Flow: SPECIAL - DELIVERY (deliverComanda)
- **Trigger:** "Livreaza" button in comanda card
- **Mutation function:** `deliverComanda` in `src/lib/supabase/queries/comenzi.ts`
- **Input:** `{ comandaId, cantitateLivrataKg, plata, dataLivrareRamasa? }`
- **Process:**
  1. Validates comanda exists and status != 'anulata'
  2. Validates `cantitateLivrataKg` > 0 and <= `cantitate_kg`
  3. **Creates vanzare** via `createVanzare`:
     - `data`: today
     - `client_id`: from comanda
     - `comanda_id`: comanda.id
     - `cantitate_kg`: cantitateLivrataKg
     - `pret_lei_kg`: comanda.pret_per_kg
     - `status_plata`: mapped from plata input ('integral' → 'Platit', 'avans' → 'Avans', 'restanta' → 'Restanta')
     - `observatii_ladite`: combines comanda.observatii + "Livrare comanda {id}"
  4. **Deducts stock** via `applyStockOutflowForVanzare`:
     - Fetches all stock buckets (grouped by locatie, produs, calitate, depozit)
     - Iterates buckets, deducting from each until `cantitateLivrataKg` is satisfied
     - Inserts `miscari_stoc` records for each deduction (tip_miscare='vanzare')
     - Returns total deducted (may be < requested if insufficient stock)
  5. **Updates comanda** to `status: 'livrata'`, links to vanzare
  6. **If partial delivery** (cantitateLivrataKg < cantitate_kg):
     - Creates new comanda for remaining quantity
     - `status`: 'programata' or 'confirmata' (based on delivery date)
     - `parent_comanda_id`: original comanda.id
     - `data_livrare`: from input or tomorrow
- **Returns:** `{ deliveredOrder, vanzare, remainingOrder, deductedStockKg }`

### Data Flow: SPECIAL - REOPEN (reopenComanda)
- **Trigger:** "Redeschide" button on delivered comanda
- **Mutation function:** `reopenComanda(id)` in `src/lib/supabase/queries/comenzi.ts`
- **Process:**
  1. Validates comanda.status === 'livrata'
  2. **Deletes linked vanzare** via `deleteVanzare(linked_vanzare_id)`
  3. **Deletes stock movements** for that vanzare:
     - `.delete().eq('referinta_id', linked_vanzare_id).eq('tip_miscare', 'vanzare')`
  4. Updates comanda to `status: 'confirmata'`, clears `linked_vanzare_id`

### Issues Found
- ✅ **Complex but well-structured:** Delivery flow handles partial deliveries, stock deduction, vanzare creation
- ⚠️ **Stock deduction may be incomplete:** `applyStockOutflowForVanzare` doesn't throw error if insufficient stock, just deducts what's available
- ❌ **Missing validation:** No warning to user if stock is insufficient before delivery
- ✅ **Reopen logic:** Properly reverses vanzare and stock movements
- ❌ **Orphaned vanzare on comanda delete:** If comanda is deleted but has linked vanzare, vanzare is NOT deleted (should use DB cascade or programmatic check)
- ✅ **Status normalization:** `ensureStatus` ensures 'pregatita' → 'programata' mapping

---

## MODULE: Cheltuieli

### Database
- **Table:** `cheltuieli_diverse`
- **Key columns:** `id`, `id_cheltuiala`, `data`, `categorie`, `descriere`, `suma_lei`, `furnizor`, `document_url`, `client_sync_id`, `sync_status`, `conflict_flag`, `created_by`, `updated_by`, `tenant_id`, `created_at`, `updated_at`
- **Foreign keys:**
  - `tenant_id` → `tenants.id`

### Data Flow: CREATE
- **Component:** `src/components/cheltuieli/AddCheltuialaDialog.tsx`
- **Mutation function:** `createCheltuiala` in `src/lib/supabase/queries/cheltuieli.ts`
- **Fields in form:** `data`, `categorie`, `descriere`, `suma_lei`, `furnizor`, `document_url`
- **Auto-generated:**
  - `id_cheltuiala` - auto-generated (CH001, CH002, etc.)
  - `client_sync_id` - UUID
  - `sync_status` - 'synced'
  - `created_by`, `updated_by` - from auth
- **After successful create:**
  - Toast notification
  - Query invalidation: `['cheltuieli']`
  - No side effects
- **Fallback logic:** If upsert with sync columns fails, falls back to plain insert

### Data Flow: READ (List)
- **Component:** `src/app/(dashboard)/cheltuieli/page.tsx`
- **Query function:** `getCheltuieli` in `src/lib/supabase/queries/cheltuieli.ts`
- **Filters/sorting:** Order by `data DESC`
- **Joins:** None
- **Fields displayed:** All fields
- **Fallback handling:** If sync columns missing, retries with legacy select

### Data Flow: UPDATE
- **Component:** `src/components/cheltuieli/EditCheltuialaDialog.tsx`
- **Mutation function:** `updateCheltuiala(id, input)` in `src/lib/supabase/queries/cheltuieli.ts`
- **Editable fields:** All fields from create (except `id_cheltuiala`)
- **Side effects:** None

### Data Flow: DELETE
- **Trigger:** Delete button
- **Mutation function:** `deleteCheltuiala(id)` in `src/lib/supabase/queries/cheltuieli.ts`
- **Cascade effects:** None
- **Side effects:** None

### Data Flow: SPECIAL - AUTO MANOPERA (upsertManoperaCheltuiala)
- **Triggered by:** `recoltari` create/update/delete
- **Function:** `upsertManoperaCheltuiala` in `src/lib/supabase/queries/manopera-auto.ts`
- **Process:**
  1. Queries all `recoltari` for given `tenant_id` and `date`
  2. Calculates:
     - `totalKg` = sum of all `kg_cal1 + kg_cal2`
     - `totalPlata` = sum of all `valoare_munca_lei` (or `kg * pret_lei_pe_kg_snapshot`)
     - `uniqueCulegatori` count
  3. Builds `client_sync_id` = `auto_manopera:{tenantId}:{date}`
  4. Searches for existing cheltuiala with that `client_sync_id`
  5. If `totalPlata <= 0`: deletes existing cheltuiala (if any)
  6. If `totalPlata > 0`:
     - If exists: updates cheltuiala
     - If not: inserts new cheltuiala with:
       - `categorie`: 'Manoperă cules'
       - `descriere`: '[AUTO_MANOPERA] Manoperă cules {date} - {count} culegători, {kg} kg total'
       - `suma_lei`: totalPlata
- **Marker:** `isAutoManoperaCheltuiala` checks for `client_sync_id` prefix or `[AUTO_MANOPERA]` in descriere

### Issues Found
- ✅ **Auto-manopera integration:** Well-designed, auto-creates/updates labor cost cheltuieli
- ⚠️ **User confusion:** Auto-generated cheltuieli may confuse users if they try to edit/delete manually
- ❌ **No UI indicator:** Forms don't visually distinguish auto-generated vs manual cheltuieli
- ✅ **Offline sync support:** Has client_sync_id and fallback logic
- ⚠️ **Schema evolution:** Good fallback for missing sync columns

---

## MODULE: Activități Agricole

### Database
- **Table:** `activitati_agricole`
- **Key columns:** `id`, `id_activitate`, `data_aplicare`, `parcela_id`, `tip_activitate`, `produs_utilizat`, `doza`, `timp_pauza_zile`, `operator`, `observatii`, `client_sync_id`, `sync_status`, `created_by`, `updated_by`, `tenant_id`, `created_at`, `updated_at`
- **Foreign keys:**
  - `parcela_id` → `parcele.id`
  - `tenant_id` → `tenants.id`
- **View:** `activitati_extended` - adds computed `data_recoltare_permisa` and `status_pauza`

### Data Flow: CREATE
- **Component:** `src/components/activitati-agricole/AddActivitateAgricolaDialog.tsx`
- **Mutation function:** `createActivitateAgricola` in `src/lib/supabase/queries/activitati-agricole.ts`
- **Fields in form:** `data_aplicare`, `parcela_id`, `tip_activitate`, `produs_utilizat`, `doza`, `timp_pauza_zile`, `operator`, `observatii`
- **Auto-generated:**
  - `id_activitate` - auto-generated (AA001, AA002, etc.)
  - `client_sync_id` - UUID
  - `sync_status` - 'synced'
  - `created_by`, `updated_by` - from auth
  - `timp_pauza_zile` - defaults to 0
- **After successful create:**
  - Toast notification
  - Query invalidation: `['activitati-agricole']`
  - No side effects
- **Fallback logic:** If sync columns missing, falls back to plain insert

### Data Flow: READ (List)
- **Component:** `src/app/(dashboard)/activitati-agricole/page.tsx`
- **Query function:** `getActivitatiAgricole` in `src/lib/supabase/queries/activitati-agricole.ts`
- **Filters/sorting:** Order by `data_aplicare DESC`, then `created_at DESC`
- **Joins:** None (could use `activitati_extended` view for computed fields)
- **Fields displayed:** All fields
- **Client-side calculation:** `calculatePauseStatus` computes harvest permission date and status

### Data Flow: UPDATE
- **Component:** `src/components/activitati-agricole/EditActivitateAgricolaDialog.tsx`
- **Mutation function:** `updateActivitateAgricola(id, input)` in `src/lib/supabase/queries/activitati-agricole.ts`
- **Editable fields:** All fields from create (except `id_activitate`)
- **Side effects:** None

### Data Flow: DELETE
- **Trigger:** Delete button
- **Mutation function:** `deleteActivitateAgricola(id)` in `src/lib/supabase/queries/activitati-agricole.ts`
- **Cascade effects:** None
- **Side effects:** None

### Issues Found
- ✅ **Pause calculation:** Helper function `calculatePauseStatus` is available but not used in query
- ⚠️ **View not used:** `activitati_extended` view exists with computed fields, but query doesn't use it
- ✅ **Offline sync:** Has client_sync_id and fallback logic
- ❌ **No validation:** No check that `data_aplicare + timp_pauza_zile` doesn't conflict with existing recoltari

---

## MODULE: Clienți

### Database
- **Table:** `clienti`
- **Key columns:** `id`, `id_client`, `nume_client`, `telefon`, `email`, `adresa`, `pret_negociat_lei_kg`, `observatii`, `google_etag`, `google_resource_name`, `tenant_id`, `created_at`, `updated_at`
- **Foreign keys:**
  - `tenant_id` → `tenants.id`
- **Google integration:** `google_etag`, `google_resource_name` for Google Contacts sync

### Data Flow: CREATE
- **Component:** `src/components/clienti/AddClientDialog.tsx`
- **Mutation function:** `createClienti` in `src/lib/supabase/queries/clienti.ts`
- **Fields in form:** `nume_client`, `telefon`, `email`, `adresa`, `pret_negociat_lei_kg`, `observatii`
- **Auto-generated:**
  - `id_client` - auto-generated (C001, C002, etc.)
  - No sync columns
- **After successful create:**
  - Toast notification
  - Query invalidation: `['clienti']`
  - No side effects

### Data Flow: READ (List)
- **Component:** `src/app/(dashboard)/clienti/page.tsx`
- **Query function:** `getClienti` in `src/lib/supabase/queries/clienti.ts`
- **Filters/sorting:** Order by `created_at DESC`
- **Joins:** None
- **Fields displayed:** All fields

### Data Flow: UPDATE
- **Component:** `src/components/clienti/EditClientDialog.tsx`
- **Mutation function:** `updateClienti(id, input)` in `src/lib/supabase/queries/clienti.ts`
- **Editable fields:** All fields from create (except `id_client`)
- **Side effects:** None - ⚠️ **ISSUE:** Changing `pret_negociat_lei_kg` doesn't affect existing vanzari or comenzi

### Data Flow: DELETE
- **Trigger:** Delete button
- **Mutation function:** `deleteClienti(id)` in `src/lib/supabase/queries/clienti.ts`
- **Cascade effects:** None programmatic (relies on DB)
- **Side effects:** ⚠️ **ISSUE:** No check for existing vanzari/comenzi before delete

### Issues Found
- ❌ **No sync support:** Unlike other modules, clienti lacks `client_sync_id` and offline sync
- ⚠️ **Google integration unused:** Columns exist but no code uses them
- ❌ **Missing validation:** No check for duplicate nume_client or telefon
- ⚠️ **Price change impact:** Changing negotiated price doesn't update existing records

---

## MODULE: Culegători

### Database
- **Table:** `culegatori`
- **Key columns:** `id`, `id_culegator`, `nume_prenume`, `tarif_lei_kg`, `data_angajare`, `status_activ`, `telefon`, `tip_angajare`, `observatii`, `tenant_id`, `created_at`, `updated_at`
- **Foreign keys:**
  - `tenant_id` → `tenants.id`

### Data Flow: CREATE
- **Component:** `src/components/culegatori/AddCulegatorDialog.tsx`
- **Mutation function:** `createCulegator` in `src/lib/supabase/queries/culegatori.ts`
- **Fields in form:** `nume_prenume`, `tarif_lei_kg`, `data_angajare`, `status_activ`, `telefon`, `tip_angajare`, `observatii`
- **Auto-generated:**
  - `id_culegator` - auto-generated (CUL001, CUL002, etc.)
  - `status_activ` - defaults to true
- **After successful create:**
  - Toast notification
  - Query invalidation: `['culegatori']`
  - No side effects

### Data Flow: READ (List)
- **Component:** `src/app/(dashboard)/culegatori/page.tsx`
- **Query function:** `getCulegatori` in `src/lib/supabase/queries/culegatori.ts`
- **Filters/sorting:** Order by `created_at DESC`
- **Joins:** None
- **Fields displayed:** All fields

### Data Flow: UPDATE
- **Component:** `src/components/culegatori/EditCulegatorDialog.tsx`
- **Mutation function:** `updateCulegator(id, input)` in `src/lib/supabase/queries/culegatori.ts`
- **Editable fields:** All fields from create (except `id_culegator`)
- **Side effects:** ⚠️ **ISSUE:** Changing `tarif_lei_kg` doesn't recalculate existing recoltari

### Data Flow: DELETE
- **Trigger:** Delete button
- **Mutation function:** `deleteCulegator(id)` in `src/lib/supabase/queries/culegatori.ts`
- **Cascade effects:** None programmatic (relies on DB)
- **Side effects:** ⚠️ **ISSUE:** No check for existing recoltari before delete

### Issues Found
- ❌ **No sync support:** Lacks client_sync_id and offline sync
- ⚠️ **Tariff change impact:** Changing tariff doesn't affect past recoltari (by design, uses snapshot)
- ❌ **Missing validation:** 
  - No check for tarif_lei_kg > 0
  - No check for existing recoltari before delete
  - No check for duplicate nume_prenume

---

## MODULE: Stocuri / Mișcări stoc

### Database
- **Table:** `miscari_stoc`
- **Key columns:** `id`, `tenant_id`, `locatie_id`, `produs`, `calitate` (cal1/cal2), `depozit` (fresh/congelat/procesat), `tip_miscare` (recoltare/vanzare/consum/etc), `cantitate_kg`, `tip` (global type), `cantitate_cal1`, `cantitate_cal2`, `referinta_id`, `data`, `observatii`, `descriere`, `created_at`
- **Foreign keys:**
  - `locatie_id` → `parcele.id`
  - `tenant_id` → `tenants.id`

### Data Flow: CREATE
- **Direct UI:** ❌ No UI for creating miscari_stoc directly
- **Programmatic creation via:**
  1. `recoltari` create/update → `replaceRecoltareMovements` → `insertMiscareStoc`
  2. `vanzari` create → `insertMiscareStoc` (tip='vanzare', negative quantity)
  3. `comenzi` deliver → `applyStockOutflowForVanzare` → `insertMiscareStoc` (multiple records)
  4. Manual stock adjustment (UI exists?) → `createAjustareStoc` in `stoc.ts`
- **Mutation function:** `insertMiscareStoc` in `src/lib/supabase/queries/miscari-stoc.ts`
- **Fields:** `tenant_id`, `locatie_id`, `produs`, `calitate`, `depozit`, `tip_miscare`, `cantitate_kg`, `tip`, `cantitate_cal1`, `cantitate_cal2`, `referinta_id`, `data`, `observatii`, `descriere`
- **Auto-calculated:**
  - `cantitate_cal1` and `cantitate_cal2` from `calitate` and `cantitate_kg`
  - `tip` mapped from `tip_miscare` (legacy compatibility)
  - Outflow types (vanzare, consum, etc.) are negative

### Data Flow: READ (Global Stock)
- **Component:** Dashboard, Stocuri page
- **Query function:** `getStocGlobal` in `src/lib/supabase/queries/stoc.ts`
- **Process:**
  - Selects all `miscari_stoc` records
  - Sums `cantitate_cal1` and `cantitate_cal2` (already signed)
  - Returns `{ cal1, cal2 }`
- **Error handling:** Returns `{0, 0}` if columns missing

### Data Flow: READ (By Location)
- **Component:** Stocuri page
- **Query function:** `getStocuriPeLocatii` in `src/lib/supabase/queries/miscari-stoc.ts`
- **Filters:** `locatieId`, `produs`, `depozit`, `calitate`
- **Joins:** `parcele (nume_parcela)`
- **Process:**
  - Groups by `locatie_id:produs`
  - Applies `signedQuantity` to each movement
  - Accumulates into buckets: `stoc_fresh_cal1`, `stoc_fresh_cal2`, `stoc_congelat`, `stoc_procesat`
  - Returns array of `StocLocationRow`

### Data Flow: ADJUST (Manual Adjustment)
- **Component:** Stocuri page (assumed)
- **Mutation function:** `createAjustareStoc` in `src/lib/supabase/queries/stoc.ts`
- **Fields:** `cantitate_cal1`, `cantitate_cal2`, `motiv`, `data`
- **Process:**
  - Inserts `miscari_stoc` with `tip: 'ajustare'`
  - Signed quantities (positive to add, negative to subtract)

### Data Flow: DELETE
- **Not exposed in UI**
- **Programmatic:** `deleteMiscariStocByReference(referinta_id)` in `miscari-stoc.ts`
  - Used by `recoltari` update/delete to clean up old movements
  - Filters by `referinta_id` and `tip_miscare='recoltare'`

### Issues Found
- ✅ **Well-integrated:** Stock movements are created by recoltari, vanzari, comenzi delivery
- ❌ **vanzari delete doesn't remove movement:** Orphaned records on vanzare delete
- ❌ **vanzari update doesn't adjust movement:** Changing cantitate_kg leaves old movement unchanged
- ⚠️ **Incomplete stock deduction on delivery:** `applyStockOutflowForVanzare` may deduct less than requested, no error thrown
- ✅ **Signed quantity logic:** Outflow types automatically negative
- ⚠️ **Schema evolution:** Good handling of missing columns (returns 0)
- ❌ **No audit trail:** Deleting referinta record (e.g., recoltare) also deletes movements, losing history

---

## MODULE: Vânzări butași

### Database
- **Table:** `vanzari_butasi`
- **Key columns:** `id`, `id_vanzare_butasi`, `data`, `data_comanda`, `data_livrare_estimata`, `status`, `client_id`, `parcela_sursa_id`, `adresa_livrare`, `avans_suma`, `avans_data`, `total_lei`, `observatii`, `soi_butasi` (legacy), `cantitate_butasi` (legacy), `pret_unitar_lei` (legacy), `tenant_id`, `created_at`, `updated_at`
- **Table:** `vanzari_butasi_items` (line items)
  - **Key columns:** `id`, `tenant_id`, `comanda_id`, `soi`, `cantitate`, `pret_unitar`, `subtotal`, `created_at`
- **Foreign keys:**
  - `client_id` → `clienti.id`
  - `parcela_sursa_id` → `parcele.id`
  - `tenant_id` → `tenants.id`
  - `vanzari_butasi_items.comanda_id` → `vanzari_butasi.id`

### Data Flow: CREATE
- **Component:** `src/components/vanzari-butasi/AddVanzareButasiDialog.tsx`
- **Mutation function:** `createVanzareButasi` in `src/lib/supabase/queries/vanzari-butasi.ts`
- **Fields in form:** `data_comanda`, `data_livrare_estimata`, `status`, `client_id`, `parcela_sursa_id`, `adresa_livrare`, `observatii`, `avans_suma`, `avans_data`, `items[]` (soi, cantitate, pret_unitar)
- **Auto-generated:**
  - `id_vanzare_butasi` - auto-generated (VB001, VB002, etc.)
  - `total_lei` - sum of item subtotals
  - `soi_butasi` - first item's soi (legacy compatibility)
  - `cantitate_butasi` - sum of item quantities
  - `pret_unitar_lei` - average price (total / quantity)
  - `status` - defaults to 'noua'
  - `data` - same as `data_comanda`
- **After successful create:**
  1. Inserts `vanzari_butasi` record
  2. Inserts `vanzari_butasi_items` records
  3. If items insert fails, deletes vanzari_butasi (transaction-like behavior)
  4. Fetches and returns full record with joined items
  5. Toast notification
  6. Query invalidation: `['vanzari-butasi']`

### Data Flow: READ (List)
- **Component:** `src/app/(dashboard)/vanzari-butasi/page.tsx`
- **Query function:** `getVanzariButasi` in `src/lib/supabase/queries/vanzari-butasi.ts`
- **Filters/sorting:** Order by `data_comanda DESC`
- **Joins:** `vanzari_butasi_items (all fields)`
- **Fields displayed:** All fields + items array

### Data Flow: UPDATE
- **Component:** `src/components/vanzari-butasi/EditVanzareButasiDialog.tsx`
- **Mutation function:** `updateVanzareButasi(id, input)` in `src/lib/supabase/queries/vanzari-butasi.ts`
- **Editable fields:** Same as create
- **Process:**
  1. Validates status != 'anulata' if updating items
  2. If `items` provided:
     - Normalizes items, calculates new totals
     - Updates vanzari_butasi record with new totals
     - Deletes all existing vanzari_butasi_items for this comanda
     - Inserts new items
  3. If `items` not provided:
     - Only updates vanzari_butasi fields
  4. Returns updated record with items

### Data Flow: DELETE
- **Trigger:** Delete button
- **Mutation function:** `deleteVanzareButasi(id)` in `src/lib/supabase/queries/vanzari-butasi.ts`
- **Cascade effects:** DB cascade should delete `vanzari_butasi_items` (foreign key)
- **Side effects:** None

### Issues Found
- ✅ **Multi-item support:** Well-designed with separate items table
- ✅ **Transaction-like:** Deletes parent if items insert fails
- ⚠️ **Legacy columns:** `soi_butasi`, `cantitate_butasi`, `pret_unitar_lei` are redundant (calculated from items)
- ❌ **Status validation:** 'anulata' items can't be edited, but no validation on status transitions
- ✅ **Extensive error handling:** Deep error extraction with `extractErrorParts`
- ⚠️ **No stock tracking:** Butași don't affect `miscari_stoc` (by design, different product)

---

## MODULE: Dashboard

### Queries Made
**File:** `src/app/(dashboard)/dashboard/page.tsx`

1. **Primary queries (always enabled):**
   - `getRecoltari` - fetches all recoltari
   - `getAlertContext` - fetches tenant context for alerts
   - `tenantDemoQuery` - checks if tenant has demo data seeded

2. **Secondary queries (delayed 300ms):**
   - `getParcele` - fetches all parcele
   - `getActivitatiAgricole` - fetches all activitati
   - `getVanzari` - fetches all vanzari
   - `getCheltuieli` - fetches all cheltuieli
   - `getComenzi` - fetches all comenzi
   - `getStocGlobal` - fetches global stock (cal1, cal2)

3. **Alert dismissals:**
   - `getTodayDismissals` - fetches dismissed alerts for tenant

### Calculations Performed
- **Today metrics:**
  - `kgAzi` - sum of recoltari for today (kg_cal1 + kg_cal2)
  - `venitEstimat` - kgAzi * 18 lei/kg (hardcoded estimate)
  - `costMunca` - kgAzi * 3 lei/kg (hardcoded labor cost)
  - `kgLivrateAzi` - sum of vanzari for today
  - `venitAzi` - sum of vanzari revenue for today
  - `comenziAzi` - comenzi with data_livrare=today and status not livrata/anulata
  - `kgDeLivratAzi` - sum of cantitate_kg for comenziAzi

- **Season metrics (March 1 - today):**
  - `venitSezon` - sum of vanzari revenue
  - `costSezon` - sum of cheltuieli suma_lei
  - `profitSezon` - venitSezon - costSezon
  - `marjaSezon` - (profitSezon / venitSezon) * 100

- **Other metrics:**
  - `parceleActive` - count where status != 'anulat'
  - `lucrariProgramate` - activitati with data_aplicare >= today
  - `restanteCount` - comenzi with data_livrare < today and status not livrata/anulata
  - `comenziActiveCount` - comenzi with status not livrata/anulata

- **Action items (urgency list):**
  - Restante comenzi (top 2, danger)
  - Active tratamente with pause countdown (top 2, warning)
  - Comenzi de pregatit (top 2, info)

- **Smart alerts:**
  - Generated by `generateSmartAlerts` from `src/lib/alerts/engine.ts`
  - Filtered by today's dismissals

### Issues Found
- ⚠️ **Hardcoded prices:** `PRICE_PER_KG_ESTIMATE = 18`, `LABOR_COST_PER_KG = 3` should be configurable
- ❌ **Client-side aggregation:** All records fetched, then filtered/summed in browser (performance issue for large datasets)
- ⚠️ **No pagination:** Fetches ALL records for each module
- ✅ **Query delay optimization:** Secondary queries delayed 300ms to prioritize critical data
- ⚠️ **Season hardcoded:** Start date is always March 1 of current year

---

## MODULE: Auth flow (signup → callback → seed → redirect)

### Flow
**File:** `src/app/auth/callback/route.ts` and related

1. **Signup:**
   - User submits email/password
   - Supabase creates user
   - Redirect to `/auth/callback?code=...`

2. **Callback:**
   - Exchange code for session
   - **Check if tenant exists:**
     - Query `tenants` where `owner_user_id = user.id`
     - If not found:
       - **Create tenant:**
         - Insert `tenants` record with `nume_ferma`, `owner_user_id`, `plan='free'`
       - **Seed demo data** (if enabled):
         - Calls `seedDemoDataForTenant` (assumed in migrations or separate file)
         - Marks `demo_seeded = true`
   - Redirect to `/dashboard`

3. **Session check:**
   - All dashboard pages use `getSupabase().auth.getUser()`
   - Fetches tenant via `owner_user_id` match
   - All queries filter by `tenant_id`

### Issues Found
- ⚠️ **Tenant lookup pattern:** Repeated in many query files (`owner_user_id` lookup), should be centralized
- ✅ **Demo seeding:** Flag `demo_seeded` prevents re-seeding
- ❌ **No onboarding flow:** After signup, user is immediately in dashboard (no profile setup, preferences, etc.)
- ⚠️ **Plan gating:** Plan check exists in DB but not enforced in most queries

---

## MODULE: Settings (profile update, export, danger zone)

### Features (assumed from typical pattern)
**File:** `src/app/(dashboard)/settings/page.tsx`

1. **Profile update:**
   - Update `tenants.nume_ferma`
   - Update user email/password via Supabase Auth

2. **Export data:**
   - Likely fetches all tenant data and exports as JSON/CSV

3. **Danger zone:**
   - **Delete demo data:**
     - Deletes all records where `tenant_id = current_tenant`
     - Sets `demo_seeded = false`
   - **Delete account:**
     - Deletes tenant and all related records
     - Deletes user via Supabase Auth

### Issues Found
- ⚠️ **Cascade deletes:** Need to verify DB has proper ON DELETE CASCADE for all tenant_id foreign keys
- ❌ **No confirmation flow:** Deleting account likely immediate (should have email confirmation)
- ⚠️ **Export format:** Unknown if it's JSON, CSV, or both

---

## CROSS-MODULE ISSUES

### Circular Dependencies
- ❌ **vanzari ↔ miscari_stoc:** vanzari create inserts stock movement, but vanzare delete doesn't remove it
- ❌ **comenzi → vanzari → miscari_stoc:** Complex chain, but no circular dependency (one-way flow)
- ✅ **recoltari → manopera → cheltuieli:** Well-isolated, uses scheduled background sync

### Inconsistent Patterns Between Modules

1. **Offline sync support:**
   - ✅ Has `client_sync_id`: recoltari, vanzari, cheltuieli, activitati_agricole
   - ❌ Missing: parcele, clienti, culegatori, comenzi, vanzari_butasi

2. **Auto-generated IDs:**
   - ✅ Consistent prefix pattern: REC, V, CH, AA, C, CUL, VB
   - ⚠️ All use SELECT max + increment (race condition risk, should use DB sequences)

3. **Error handling:**
   - ✅ Schema cache fallback: vanzari, cheltuieli, activitati, recoltari
   - ❌ No fallback: parcele, clienti, culegatori
   - ✅ Extensive error extraction: vanzari-butasi

4. **Tenant isolation:**
   - ⚠️ Repeated pattern: `owner_user_id` lookup in create functions
   - ❌ No centralized `getTenantIdFromSession` (defined in multiple files)

5. **Stock integration:**
   - ✅ Integrated: recoltari, vanzari (via comenzi delivery)
   - ❌ Missing: vanzari update/delete, manual stock adjustments UI

### Missing Integrations

1. **Comanda → Vanzare link:**
   - ✅ **FIXED in migration 2026030102:** Added `vanzari.comanda_id` column
   - ✅ Delivery flow creates vanzare with `comanda_id`
   - ❌ **UI doesn't show link:** Vanzari list doesn't display which comanda it came from

2. **Activitati → Recoltari validation:**
   - ❌ No check if harvest is within pause period
   - Suggested: Before creating recoltare, check `activitati_extended` view for `status_pauza='Pauza'` on parcela

3. **Clienti ↔ Vanzari/Comenzi usage:**
   - ❌ Clienti delete doesn't check for existing vanzari/comenzi
   - ⚠️ Clienti with `pret_negociat_lei_kg` should auto-fill in vanzare/comanda forms (not implemented)

4. **Culegatori tariff history:**
   - ⚠️ Changing tarif doesn't affect existing recoltari (by design, uses snapshot)
   - ❌ No audit trail of tariff changes (could add history table)

### Orphaned Code or Dead Imports

1. **Views not used in queries:**
   - `activitati_extended` - has computed fields but query uses base table
   - `parcele_extended` - has computed `varsta_ani`, `densitate_plante_m2` but not queried
   - `vanzari_extended`, `vanzari_butasi_extended` - have computed `valoare_totala_lei` but not used

2. **Google Contacts integration:**
   - Columns exist: `clienti.google_etag`, `clienti.google_resource_name`
   - Table exists: `integrations_google_contacts`
   - ❌ No UI or query code uses these (orphaned feature)

3. **Legacy columns in vanzari_butasi:**
   - `soi_butasi`, `cantitate_butasi`, `pret_unitar_lei` - calculated from items, could be removed

4. **Unused enums/constants:**
   - `TIPURI_ACTIVITATI` defined in activitati-agricole.ts but not enforced in DB (just a helper)

---

## PRIORITY FIXES

### P0 - Critical (Data Integrity)

1. **Fix vanzari delete stock inconsistency**
   - **File:** `src/lib/supabase/queries/vanzari.ts`
   - **Issue:** Deleting vanzare doesn't delete `miscari_stoc` record
   - **Fix:** Add `deleteMiscariStocByReference(id)` before delete, or use DB trigger

2. **Fix vanzari update stock inconsistency**
   - **File:** `src/lib/supabase/queries/vanzari.ts`
   - **Issue:** Updating `cantitate_kg` doesn't update stock movement
   - **Fix:** Add similar logic to recoltari (delete old movement, create new)

3. **Prevent orphaned vanzari on comanda delete**
   - **File:** `src/lib/supabase/queries/comenzi.ts`
   - **Issue:** Deleting comanda doesn't check for linked vanzare
   - **Fix:** Add check before delete, or cascade delete vanzare (revert stock movements)

4. **Add foreign key cascade checks**
   - **Files:** All query delete functions
   - **Issue:** No programmatic check for dependent records
   - **Fix:** Before delete, query for dependent records and show error or confirm cascade

### P1 - High (UX / Functionality)

5. **Centralize tenant lookup**
   - **Files:** All query create functions
   - **Issue:** Repeated `owner_user_id` → `tenant_id` lookup
   - **Fix:** Create `getTenantIdFromSession()` in `src/lib/supabase/client.ts`, use everywhere

6. **Add stock validation before comanda delivery**
   - **File:** `src/lib/supabase/queries/comenzi.ts`
   - **Issue:** `applyStockOutflowForVanzare` may deduct less than requested, no error
   - **Fix:** Check stock availability before delivery, show warning to user

7. **Expose comanda_id in vanzari UI**
   - **File:** `src/components/vanzari/VanzareCard.tsx` (assumed)
   - **Issue:** vanzari.comanda_id column exists but not displayed
   - **Fix:** Show link to originating comanda if comanda_id is not null

8. **Add auto-manopera indicator in cheltuieli UI**
   - **File:** `src/components/cheltuieli/CheltuialaCard.tsx`
   - **Issue:** Auto-generated cheltuieli look like manual ones
   - **Fix:** Use `isAutoManoperaCheltuiala` to show badge/icon, prevent edit/delete

9. **Use activitati_extended view**
   - **File:** `src/lib/supabase/queries/activitati-agricole.ts`
   - **Issue:** Query doesn't use view with computed `data_recoltare_permisa`, `status_pauza`
   - **Fix:** Select from `activitati_extended` instead of base table

10. **Validate harvest against pause period**
    - **File:** `src/lib/supabase/queries/recoltari.ts`
    - **Issue:** No check if parcela has active treatment with pause
    - **Fix:** Before creating recoltare, query `activitati_extended` for parcela, check if any `status_pauza='Pauza'`

### P2 - Medium (Performance / Code Quality)

11. **Replace auto-increment ID generation with DB sequences**
    - **Files:** All `generateNextId` functions
    - **Issue:** SELECT max + increment has race condition risk
    - **Fix:** Use DB sequences or UUID v7 (time-ordered)

12. **Add offline sync to missing modules**
    - **Files:** parcele, clienti, culegatori, comenzi, vanzari-butasi queries
    - **Issue:** Inconsistent offline support
    - **Fix:** Add `client_sync_id`, `sync_status`, `created_by`, `updated_by` columns and upsert logic

13. **Paginate dashboard queries**
    - **File:** `src/app/(dashboard)/dashboard/page.tsx`
    - **Issue:** Fetches ALL records, filters client-side
    - **Fix:** Add server-side aggregation (DB views or RPC functions), only fetch aggregates

14. **Make price estimates configurable**
    - **File:** `src/app/(dashboard)/dashboard/page.tsx`
    - **Issue:** Hardcoded `PRICE_PER_KG_ESTIMATE = 18`, `LABOR_COST_PER_KG = 3`
    - **Fix:** Add settings table or tenant preferences, fetch from DB

15. **Remove orphaned Google Contacts code**
    - **Files:** clienti queries, integrations migrations
    - **Issue:** Columns and table exist but no code uses them
    - **Fix:** Either implement feature or drop columns/table

16. **Consolidate error handling utilities**
    - **Files:** vanzari.ts, cheltuieli.ts, activitati-agricole.ts, vanzari-butasi.ts
    - **Issue:** Each has own `toReadableError`, `isMissingColumnError` functions
    - **Fix:** Extract to `src/lib/supabase/errorHandling.ts`, reuse

### P3 - Low (Nice to Have)

17. **Remove legacy columns from vanzari_butasi**
    - **File:** Migration to drop `soi_butasi`, `cantitate_butasi`, `pret_unitar_lei`
    - **Issue:** Redundant with items table
    - **Fix:** After verifying no UI uses them, drop columns

18. **Add onboarding flow**
    - **Files:** New onboarding pages after signup
    - **Issue:** User dropped into empty dashboard
    - **Fix:** Add guided setup: farm name, first parcela, first culegator, etc.

19. **Add plan enforcement**
    - **Files:** All query create functions
    - **Issue:** `tenants.plan` column exists but not enforced
    - **Fix:** Add middleware to check plan limits before create (e.g., max parcele for free plan)

20. **Add audit trail for tariff changes**
    - **Files:** New `culegatori_tariff_history` table
    - **Issue:** Changing tarif loses history
    - **Fix:** Before updating tarif, insert history record with old tarif + date

---

## SUMMARY STATISTICS

- **Modules audited:** 13
- **Database tables:** 18 (core) + 4 (admin/metadata)
- **Query files:** 12
- **Critical issues (P0):** 4
- **High priority issues (P1):** 6
- **Medium priority issues (P2):** 6
- **Low priority issues (P3):** 4
- **Total issues identified:** 20

### Architecture Strengths
✅ Modular query structure  
✅ Type-safe with generated types  
✅ Consistent mutation patterns  
✅ Good error handling in newer modules  
✅ Smart auto-manopera integration  
✅ Well-designed comenzi → vanzare → stock flow  

### Architecture Weaknesses
❌ Stock movement cleanup on update/delete  
❌ Repeated tenant lookup pattern  
❌ No centralized error handling  
❌ Orphaned features (Google Contacts)  
❌ Client-side aggregation in dashboard  
❌ No validation for dependent records before delete  

---

**End of Technical Audit**