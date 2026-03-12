# Audit Part 3 - Module Dashboard (read-only)

Data audit: 2026-03-07  
Scope: `src/app/(dashboard)`

## 1) Activitati agricole (`/activitati-agricole`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/activitati-agricole/page.tsx`, `src/app/(dashboard)/activitati-agricole/ActivitatiAgricolePageClient.tsx`
- componente: `src/components/activitati-agricole/AddActivitateAgricolaDialog.tsx`, `EditActivitateAgricolaDialog.tsx`, `ActivitateAgricolaCard.tsx`, `ConfirmDeleteActivitateDialog.tsx`
- queries: `src/lib/supabase/queries/activitati-agricole.ts`, `parcele.ts` (pentru select parcela)
CRUD:
- Create/Read/Update/Delete există (`create|get|update|deleteActivitateAgricola`).
DELETE:
- Confirmare UI: da (`ConfirmDeleteDialog`) + soft delete cu Undo 5s în client.
- Cascade/validare: fără cascade explicite în query; ștergerea e directă la nivel de activitate.
Search/filtrare:
- Da, căutare pe: `tip_activitate`, `produs_folosit`, `doza`, `observatii`, `operator`, `id_activitate`.

## 2) Admin (`/admin`, `/admin/analytics`, `/admin/audit`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/admin/page.tsx`, `admin/analytics/page.tsx`, `admin/analytics/AnalyticsAdminClient.tsx`, `admin/audit/page.tsx`
- componente: `src/components/admin/AdminTenantsPlanTable.tsx`, `AnalyticsDashboard.tsx`
- queries/RPC: acces direct Supabase în pagini + RPC `set_tenant_plan`
CRUD:
- Nu e CRUD business pe entitățile operaționale; există update de plan tenant (admin operation).
DELETE:
- N/A pentru modulele operaționale.
Search/filtrare:
- Filtrare/tabele în admin (tenanti/analytics), nu search CRUD clasic pe module agricole.

## 3) Cheltuieli (`/cheltuieli`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/cheltuieli/page.tsx`, `CheltuialaPageClient.tsx`
- componente: `src/components/cheltuieli/AddCheltuialaDialog.tsx`, `EditCheltuialaDialog.tsx`, `ViewCheltuialaDialog.tsx`, `CheltuialaCard.tsx`
- queries: `src/lib/supabase/queries/cheltuieli.ts`, `manopera-auto.ts` (marcare auto-manoperă)
CRUD:
- Create/Read/Update/Delete există (`create|get|update|deleteCheltuiala`).
DELETE:
- Confirmare UI: da (`ConfirmDeleteDialog`) + Undo 5s.
- Cascade/validare: fără validări de integritate suplimentare în query; delete direct pe `cheltuieli`.
Search/filtrare:
- Da, căutare pe `categorie`.

## 4) Clienti (`/clienti`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/clienti/page.tsx`, `ClientPageClient.tsx`
- componente: `src/components/clienti/AddClientDialog.tsx`, `EditClientDialog.tsx`, `ClientCard.tsx`, `ClientDetailsDrawer.tsx`
- queries: `src/lib/supabase/queries/clienti.ts`, `comenzi.ts` (detalii comenzi client)
CRUD:
- Create/Read/Update/Delete există (`create|get|update|deleteClienti`).
DELETE:
- Confirmare UI: da (`ConfirmDeleteDialog`) + Undo 5s.
- Validare în query: da, blochează delete dacă există legături în `vanzari`, `comenzi`, `vanzari_butasi`.
- Cascade: nu; se oprește cu eroare descriptivă.
Search/filtrare:
- Da, căutare pe `nume_client`, `telefon`, `email`, `adresa`, `observatii`.

## 5) Comenzi (`/comenzi`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/comenzi/page.tsx`, `ComenziPageClient.tsx`, `loading.tsx`
- componente: `src/components/comenzi/ViewComandaDialog.tsx` + formulare/dialoguri în `ComenziPageClient.tsx`
- queries: `src/lib/supabase/queries/comenzi.ts`, `clienti.ts`, `stoc.ts`
CRUD:
- Create/Read/Update/Delete există (`create|get|update|deleteComanda`).
- În plus: `deliverComanda` și `reopenComanda`.
DELETE:
- Confirmare UI: da (`ConfirmDeleteDialog`) + Undo 5s.
- Cascade logică în query: la delete comandă, dacă există `linked_vanzare_id`, se șterge întâi vânzarea legată (`deleteVanzare`), iar stocul aferent se curăță prin fluxul de vânzare.
Search/filtrare:
- Da, căutare pe nume client + telefon.
- Quick filters: `azi`, `viitoare`, `restante`, `livrate`, `anulate`, `toate` + tab active/istoric.

## 6) Culegatori (`/culegatori`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/culegatori/page.tsx`, `CulegatorPageClient.tsx`
- componente: `src/components/culegatori/AddCulegatorDialog.tsx`, `EditCulegatorDialog.tsx`, `CulegatorCard.tsx`
- queries: `src/lib/supabase/queries/culegatori.ts`
CRUD:
- Create/Read/Update/Delete există (`create|get|update|deleteCulegator`).
DELETE:
- Confirmare UI: da (`ConfirmDeleteDialog`) + Undo 5s.
- Validare în query: blochează delete dacă există `recoltari` legate.
- Cascade: nu.
Search/filtrare:
- Nu există câmp de search/filter în pagina client.

## 7) Dashboard (`/dashboard`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/dashboard/page.tsx`
- componente: `src/components/dashboard/*`, `PageHeader`, `AppShell`
- queries: `activitati-agricole.ts`, `cheltuieli.ts`, `comenzi.ts`, `parcele.ts`, `recoltari.ts`, `vanzari.ts`
CRUD:
- Nu; doar agregare și afișare KPI.
DELETE:
- N/A.
Search/filtrare:
- Nu are search textual; are doar filtre logice interne pe date/status.

## 8) Investitii (`/investitii`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/investitii/page.tsx`, `InvestitiiPageClient.tsx`
- componente: `src/components/investitii/AddInvestitieDialog.tsx`, `EditInvestitieDialog.tsx`, `InvestitieCard.tsx`
- queries: `src/lib/supabase/queries/investitii.ts`
CRUD:
- Create/Read/Update/Delete există (`create|get|update|deleteInvestitie`).
DELETE:
- Confirmare UI: da (`DeleteConfirmDialog`).
- Cascade/validare: nu există validări suplimentare în query; delete direct.
Search/filtrare:
- Da, căutare pe `categorie`, `furnizor`, `descriere`.

## 9) Parcele (`/parcele`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/parcele/page.tsx` (renderizează `src/components/parcele/ParcelePageClient.tsx`), `src/app/(dashboard)/parcele/loading.tsx`
- componente: `src/components/parcele/ParcelePageClient.tsx`, `ParceleList.tsx`, `ParcelaCard.tsx`, `AddParcelDrawer.tsx`, `EditParcelDialog.tsx`, `DeleteConfirmDialog.tsx`
- queries: `src/lib/supabase/queries/parcele.ts`, plus read din `recoltari.ts`, `vanzari.ts`, `cheltuieli.ts`, `activitati-agricole.ts`
CRUD:
- Create/Read/Update/Delete există pe `parcele`.
DELETE:
- Confirmare UI: da + Undo 5s în `ParcelePageClient`.
- Validare în query: blochează delete dacă există `recoltari` sau `activitati_agricole` legate.
- Cascade: nu.
Search/filtrare:
- Nu există search textual explicit în `ParcelePageClient`.

## 10) Planuri (`/planuri`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/planuri/page.tsx`
- componente: `AppShell`, `PageHeader`, `Button`
- queries: fără query operațional specific.
CRUD:
- Nu (pagină informativă/planuri).
DELETE:
- N/A.
Search/filtrare:
- Nu.

## 11) Rapoarte (`/rapoarte`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/rapoarte/page.tsx`, `RapoartePageClient.tsx`
- componente: `KpiCard`, `PerformanceTable`, `ProfitSummaryCard`, controale select/input
- queries: date primite din page (recoltări/vânzări/cheltuieli/parcele/culegători), fără mutații
CRUD:
- Nu; doar read + export (CSV/XLS).
DELETE:
- N/A.
Search/filtrare:
- Da, filtrare pe perioadă, cultură, parcelă, tip raport, interval custom (`customFrom/customTo`).

## 12) Recoltari (`/recoltari`, `/recoltari/new`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/recoltari/page.tsx`, `RecoltariPageClient.tsx`, `loading.tsx`, `new/page.tsx`
- componente: `src/components/recoltari/AddRecoltareDialog.tsx`, `EditRecoltareDialog.tsx`, `ViewRecoltareDialog.tsx`, `RecoltareCard.tsx`, `DeleteConfirmDialog`
- queries: `src/lib/supabase/queries/recoltari.ts`, `parcele.ts`, `culegatori.ts`, `manopera-auto.ts`, `miscari-stoc.ts`
CRUD:
- Create/Read/Update/Delete există (`create|get|update|deleteRecoltare`).
DELETE:
- Confirmare UI: da (`DeleteConfirmDialog`) + Undo 5s.
- Cascade logică internă: șterge mișcările de stoc legate (`deleteMiscariStocByReference`), apoi sincronizează auto-manoperă pe datele afectate.
Search/filtrare:
- Da, căutare pe nume parcelă și `observatii`.

## 13) Settings (`/settings`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/settings/page.tsx`
- componente: `FarmSwitcher`, `AppDialog`, controale UI
- queries/RPC: apeluri Supabase auth + endpoint-uri pentru ștergere fermă/cont
CRUD:
- Nu e CRUD pe module agricole; e management cont/fermă.
DELETE:
- Confirmare dublă (step 1 + step 2 cu text de confirmare) pentru ștergere fermă și cont.
Search/filtrare:
- Nu.

## 14) Stoc (`/stoc`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/stoc/page.tsx`, `StocPageClient.tsx`, `loading.tsx`
- componente: form în `StocPageClient.tsx`
- queries: `src/lib/supabase/queries/stoc.ts`
CRUD:
- Read + Create (ajustare stoc): `getStocGlobal`, `createAjustareStoc`.
- Update/Delete dedicate pe ajustări nu există în modul.
DELETE:
- N/A în UI pentru ajustări existente.
Search/filtrare:
- Nu există search/filter listă; doar formular de ajustare.

## 15) Stocuri (`/stocuri`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/stocuri/page.tsx`, `StocuriPageClient.tsx`
- componente: carduri + filtre `Select`
- queries: `src/lib/supabase/queries/miscari-stoc.ts` (`getStocuriPeLocatii`), `comenzi.ts`
CRUD:
- Doar Read (inventar agregat pe locații).
DELETE:
- N/A.
Search/filtrare:
- Da, filtre pe `locatie`, `produs`, `depozit`, `calitate`.

## 16) UI template demo (`/ui-template-demo`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/ui-template-demo/page.tsx`
- componente: demo controls (`AppDialog`, `AppDrawer`, etc.)
- queries: nu.
CRUD:
- Nu.
DELETE:
- N/A.
Search/filtrare:
- Nu.

## 17) Vanzari (`/vanzari`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/vanzari/page.tsx`, `VanzariPageClient.tsx`, `loading.tsx`
- componente: `src/components/vanzari/AddVanzareDialog.tsx`, `EditVanzareDialog.tsx`, `ViewVanzareDialog.tsx`, `VanzareCard.tsx`
- queries: `src/lib/supabase/queries/vanzari.ts`, `clienti.ts`, `miscari-stoc.ts`
CRUD:
- Create/Read/Update/Delete există (`create|get|update|deleteVanzare`).
DELETE:
- Confirmare UI: da (`ConfirmDeleteDialog`) + Undo 5s.
- Cascade logică internă: delete pe vânzare șterge și mișcările de stoc legate prin `deleteMiscariStocByReference`.
Search/filtrare:
- Da, căutare pe nume client, `status_plata`, `observatii_ladite`.

## 18) Vanzari butasi (`/vanzari-butasi`)
Fișiere implicate:
- page/client: `src/app/(dashboard)/vanzari-butasi/page.tsx`, `VanzariButasiPageClient.tsx`
- componente: `src/components/vanzari-butasi/AddVanzareButasiDialog.tsx`, `EditVanzareButasiDialog.tsx`, `ViewVanzareButasiDialog.tsx`, `VanzareButasiCard.tsx`
- queries: `src/lib/supabase/queries/vanzari-butasi.ts`
CRUD:
- Create/Read/Update/Delete există (`create|get|update|deleteVanzareButasi`).
DELETE:
- Confirmare UI: da (`DeleteConfirmDialog`) + Undo 5s.
- Cascade/validare: fără validări relaționale suplimentare în query.
Search/filtrare:
- Da, search pe `client`, `status`, `observatii`, `locatie_livrare`, `soi` item.
- Filtre suplimentare: `toate`, `active`, `with-avans`, `rest`.

---

## Verificări explicite cerute

### A) Vânzări: la edit/delete se actualizează stocul?
- Da.
- `createVanzare` inserează mișcare stoc tip `vanzare` cu cantitate negativă.
- `updateVanzare` (când se schimbă `cantitate_kg`) șterge mișcarea veche și inserează una nouă.
- `deleteVanzare` șterge întâi mișcările de stoc legate.

### B) Comenzi: există conversie comandă -> vânzare?
- Da.
- `deliverComanda` creează vânzare (`createVanzare`), pune comanda pe `livrata`, setează `linked_vanzare_id`, poate crea comandă rest pentru cantitatea rămasă.
- În livrare se aplică și scăderea din stoc (`applyStockOutflowForVanzare`, insert în `miscari_stoc`).

### C) Recoltări: există cheltuieli automate manoperă?
- Da.
- În `recoltari.ts`, după create/update/delete se apelează `scheduleAutoManoperaSync`, care rulează `upsertManoperaCheltuiala` pentru datele afectate.

### D) Delete client: ce se întâmplă cu comenzile/vânzările lui?
- Clientul NU se șterge dacă are legături.
- `deleteClienti` verifică existența în `vanzari`, `comenzi`, `vanzari_butasi`; dacă există, aruncă eroare și oprește delete.
- Nu există cascade automate de tip „șterge client -> șterge comenzi/vânzări”.

## Verdict scurt
- Modulele operaționale au CRUD consistent + confirmări la delete în UI.
- Pentru entitățile critice există protecții explicite la delete (client, parcelă, culegător), iar fluxurile de stoc sunt sincronizate la vânzări/comenzi/recoltări.
- Din perspectiva logicii observate, lanțul „comandă -> vânzare -> stoc” și „recoltare -> stoc + manoperă” este implementat.
