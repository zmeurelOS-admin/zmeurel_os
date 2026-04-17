# MODULES.md — Module Zmeurel OS
_Last updated: 2026-03-21_

---

## 1. Dashboard
| Câmp | Valoare |
|------|---------|
| Route | `/dashboard` |
| Page file | `src/app/(dashboard)/dashboard/page.tsx` |
| Client | `src/app/(dashboard)/dashboard/page.tsx` (`'use client'`, fără wrapper `DashboardHome`) |
| Tabele Supabase | `recoltari`, `vanzari`, `cheltuieli_diverse`, `investitii`, `parcele`, `culegatori`, `comenzi` |
| Query keys | `queryKeys.recoltari`, `queryKeys.parcele`, `queryKeys.activitati`, `queryKeys.vanzari`, `queryKeys.cheltuieli`, `queryKeys.comenzi`, `queryKeys.stocuriLocatiiRoot` |

**Componente cheie:**
- `MeteoDashboardCard` — cardul meteo activ al dashboard-ului
- `TaskList` — lista activă „Todo azi”
- `DashboardWidgets` — widget-uri configurabile (`KpiSummaryWidget`, `ComenziRecenteWidget`, `ActivitatiPlanificateWidget`, `RecoltariRecenteWidget`, `StocuriCriticeWidget`, `SumarVenituriWidget`)
- `WelcomeCard` — card onboarding pentru ferme fără parcele
- `src/lib/dashboard/engine.ts` — layer logic Dashboard 2.0 (`DashboardRawData`, `ParcelDashboardState`, tasks/alerts/summary/weather builders)

---

## 2. Parcele (Plots/Fields)
| Câmp | Valoare |
|------|---------|
| Route | `/parcele`, `/parcele/[id]` |
| Page file | `src/app/(dashboard)/parcele/page.tsx` |
| Client | `src/components/parcele/ParcelePageClient.tsx` |
| Tabele Supabase | `parcele`, `culturi`, `activitati_agricole` (referințe), `recoltari` (referințe) |
| Query keys | `queryKeys.parcele` (+ chei derivate pentru culturi/counts) |

**Componente cheie:**
- `ParceleList` — lista de terenuri cu carduri expandabile pe mobil și rânduri full-width expandabile pe desktop; acțiunile de editare/istoric/activitate rămân disponibile, iar detaliile de culturi se deschid inline sub rândul selectat
- `ParcelePageClient` (din `src/components/parcele/`) — pagina principală terenuri cu `ConfirmDeleteDialog`, `AddActivitateAgricolaDialog`, `AddCulturaDialog`, `AddMicroclimatDialog`, `DesfiinteazaCulturaDialog`; query parcele folosește fallback de schemă în `queries/parcele.ts` pentru medii linked rămase în urmă
- `AddParcelDrawer` — creare teren nou (drawer); formular simplificat cu câmpuri: Tip unitate, Nume teren, Suprafață, Status, Stadiu, Observații. Câmpurile Tip cultură, Soi plantat, An plantare și secțiunea Culturi în solar au fost eliminate.
- `EditParcelDialog` — editare teren existent; formular simplificat identic cu `AddParcelDrawer`
- `ParcelaCard` — neutilizat în pagina principală; UI alternativ vechi
- `AddCulturaDialog` — dialog adăugare cultură în solar (câmpuri: Tip plantă, Soi, Suprafață ocupată, Nr. plante, etc.); salvează în tabela `culturi` cu `solar_id`
- `CulturiBara` — bară vizuală suprafață ocupată vs totală în solar
- `ParceleLayout` — wrapper layout
- `StickyActionBar` (parcele) — bară acțiuni sticky
- **Detalii solar** (`/parcele/[id]`) — secțiune "Culturi în solar" cu lista culturilor (filtrate strict pe `solar_id`) și buton "+ Adaugă cultură"; secțiunile climat și etape de cultură sunt prezente pentru toate tipurile de teren

**Query keys:** `queryKeys.parcele`, `queryKeys.parcela(id)`, `queryKeys.culturi(solarId)`

**Coloane `parcele`:** id_parcela, tenant_id, nume_parcela, tip_fruct, soi_plantat, suprafata_m2, nr_plante, an_plantare, status, GPS, cultura, soi, nr_randuri, distanta_intre_randuri, sistem_irigare, data_plantarii, stadiu, client_sync_id

---

## 3. Recoltări (Harvests)
| Câmp | Valoare |
|------|---------|
| Route | `/recoltari`, `/recoltari/new` |
| Page file | `src/app/(dashboard)/recoltari/page.tsx` |
| Client | `src/app/(dashboard)/recoltari/RecoltariPageClient.tsx` |
| Tabele Supabase | `recoltari`, `miscari_stoc` (via RPC), `cheltuieli_diverse` (manoperă auto), `parcele` (FK) |
| Query keys | `queryKeys.recoltari` |
| RPCs | `create_recoltare_with_stock`, `update_recoltare_with_stock`, `delete_recoltare_with_stock` |

**Componente cheie:**
- `ViewRecoltareDialog` — vizualizare detalii
- Formularul de creare la `/recoltari/new`

**Coloane `recoltari`:** id_recoltare, tenant_id, parcela_id, data, culegator_id, kg_cal1, kg_cal2, pret_cal1, pret_cal2, observatii, client_sync_id

**Note:** Recoltarea creează automat o cheltuială de manoperă via `upsertManoperaCheltuiala`.

---

## 4. Activități Agricole
| Câmp | Valoare |
|------|---------|
| Route | `/activitati-agricole` |
| Page file | `src/app/(dashboard)/activitati-agricole/page.tsx` (**REAL** — conține implementarea completă) |
| ⚠️ Dead code | `src/app/(dashboard)/activitati-agricole/ActivitatiAgricolePageClient.tsx` — UI static vechi, neutilizat |
| Tabele Supabase | `activitati_agricole`, `parcele` (FK) |
| Query keys | `queryKeys.activitatiAgricole`, `queryKeys.activitatiByParcela(id)` |

**Componente cheie:**
- `ActivitateAgricolaCard` — display activitate cu calcul pauze recoltare
- `ConfirmDeleteActivitateDialog` — confirmare ștergere

**Tipuri activități:** Tratament fitosanitar, Fertilizare, Irigare, Cosit, Altele

**Coloane `activitati_agricole`:** id_activitate, tenant_id, parcela_id, tip_activitate, data_aplicare, produs_folosit, cantitate, unitate_masura, observatii, timp_pauza_zile, client_sync_id

---

## 4B. Tratamente & Fertilizare (Fundație DB)
| Câmp | Valoare |
|------|---------|
| Route | UI dedicat în lucru; fără rută activă în faza de fundație |
| Scope curent | DB-only, paralel cu `activitati_agricole`, `culture_stage_logs`, `etape_cultura` |
| Tabele Supabase | `produse_fitosanitare`, `planuri_tratament`, `planuri_tratament_linii`, `parcele_planuri`, `stadii_fenologice_parcela`, `aplicari_tratament` |
| Tip acces | tenant-scoped pentru toate tabelele operaționale; `produse_fitosanitare` permite bibliotecă shared (`tenant_id = NULL`) + produse private pe tenant |

**Note cheie:**
- Faza 1A nu înlocuiește `activitati_agricole` și nu migrează date existente; istoricul generic rămâne funcțional.
- Faza 1A nu înlocuiește `culture_stage_logs` sau `etape_cultura`; `stadii_fenologice_parcela` este sursă nouă, paralelă, orientată pe planificare fenologică anuală.
- Triggerul standard pentru tabelele noi este `public.touch_updated_at()`.
- Seed-ul pentru `produse_fitosanitare` este global (`tenant_id = NULL`) și idempotent.

---

## 5. Vânzări (Sales)
| Câmp | Valoare |
|------|---------|
| Route | `/vanzari` |
| Page file | `src/app/(dashboard)/vanzari/page.tsx` |
| Client | `src/app/(dashboard)/vanzari/VanzariPageClient.tsx` |
| Tabele Supabase | `vanzari`, `miscari_stoc` (via RPC), `clienti` (FK), `comenzi` (FK) |
| Query keys | `queryKeys.vanzari` |
| RPCs | `create_vanzare_with_stock`, `update_vanzare_with_stock`, `delete_vanzare_with_stock` |

**Coloane `vanzari`:** id_vanzare, tenant_id, data, client_id, comanda_id, cantitate_kg, pret_lei_kg, status_plata ['platit'|'restanta'|'avans'], observatii_ladite, client_sync_id

---

## 6. Vânzări Butași (Seedling Sales)
| Câmp | Valoare |
|------|---------|
| Route | `/vanzari-butasi` |
| Page file | `src/app/(dashboard)/vanzari-butasi/page.tsx` |
| Client | `src/app/(dashboard)/vanzari-butasi/VanzariButasiPageClient.tsx` |
| Tabele Supabase | `vanzari_butasi`, `vanzari_butasi_items`, `clienti` (FK), `parcele` (FK sursă) |
| Query keys | `queryKeys.vanzariButasi` |

**Coloane `vanzari_butasi`:** id, tenant_id, data, status ['noua'|'confirmata'|'pregatita'|'livrata'|'anulata'], client_id, client_nume_manual, parcela_sursa_id, adresa_livrare, avans_suma, total_lei, observatii, data_comanda, data_livrare_estimata

**Coloane `vanzari_butasi_items`:** id, vanzare_butasi_id, soi, cantitate, pret_unitar

---

## 7. Cheltuieli (Expenses)
| Câmp | Valoare |
|------|---------|
| Route | `/cheltuieli` |
| Page file | `src/app/(dashboard)/cheltuieli/page.tsx` |
| Client | `src/app/(dashboard)/cheltuieli/CheltuialaPageClient.tsx` |
| Tabele Supabase | `cheltuieli_diverse` |
| Query keys | `queryKeys.cheltuieli` |

**Coloane `cheltuieli_diverse`:** id_cheltuiala, tenant_id, data, categorie, descriere, suma_lei, furnizor, metoda_plata, document_url, client_sync_id, sync_status

**Note:** Include cheltuieli de manoperă create automat din recoltări (tip = 'manopera_auto').

---

## 8. Investiții (Capital Investments)
| Câmp | Valoare |
|------|---------|
| Route | `/investitii` |
| Page file | `src/app/(dashboard)/investitii/page.tsx` |
| Client | `src/app/(dashboard)/investitii/InvestitiiPageClient.tsx` |
| Tabele Supabase | `investitii` |
| Query keys | `queryKeys.investitii` |

**Categorii:** Material săditor, Irigații, Sisteme susținere, Construcții, Echipamente/utilaje, Depozitare, Infrastructură, Solarii/sere, Îmbunătățiri teren, Altele

**Coloane `investitii`:** id_investitie, tenant_id, data, categorie, descriere, suma_lei, furnizor, client_sync_id

---

## 9. Comenzi (Orders)
| Câmp | Valoare |
|------|---------|
| Route | `/comenzi` |
| Page file | `src/app/(dashboard)/comenzi/page.tsx` |
| Client | `src/app/(dashboard)/comenzi/ComenziPageClient.tsx` |
| Tabele Supabase | `comenzi`, `vanzari` (livrare), `miscari_stoc` (via RPC), `clienti` (FK) |
| Query keys | `queryKeys.comenzi`, `queryKeys.comenziStockSummaryAzi` |
| RPCs | `deliver_comanda_with_stock`, `delete_comanda_atomic`, `reopen_comanda_atomic` |

**Statusuri comandă:** noua, confirmata, programata, in_livrare, livrata, anulata

**Coloane `comenzi`:** id, tenant_id, client_id, client_nume_manual, telefon, locatie_livrare, data_comanda, data_livrare, cantitate_kg, pret_per_kg, total, status, plata ['integral'|'avans'|'restanta']

---

## 10. Clienți (Customers)
| Câmp | Valoare |
|------|---------|
| Route | `/clienti` |
| Page file | `src/app/(dashboard)/clienti/page.tsx` |
| Client | `src/app/(dashboard)/clienti/ClientPageClient.tsx` |
| Tabele Supabase | `clienti`, `vanzari` (impact), `comenzi` (impact), `vanzari_butasi` (impact) |
| Query keys | `queryKeys.clienti` |

**Componente cheie:**
- `ClientDetailsDrawer` — drawer lateral cu detalii + acțiuni
- `AddClientDialog` / `EditClientDialog`

**Coloane `clienti`:** id_client, tenant_id, id_client (business), nume_client, telefon, email, adresa, pret_negociat_lei_kg, observatii

---

## 11. Culegători (Pickers/Harvesters)
| Câmp | Valoare |
|------|---------|
| Route | `/culegatori` |
| Page file | `src/app/(dashboard)/culegatori/page.tsx` |
| Client | `src/app/(dashboard)/culegatori/CulegatorPageClient.tsx` |
| Tabele Supabase | `culegatori`, `recoltari` (impact check) |
| Query keys | `queryKeys.culegatori` |

**Coloane `culegatori`:** id_culegator, tenant_id, id_culegator (business, CUL prefix), nume_prenume, tarif_lei_kg, data_angajare, status_activ, telefon, tip_angajare, observatii

**Clarificare P2:** itemul de sidebar `👷 Manoperă` mapează la ruta `/culegatori`. Pe desktop, modulul folosește DataTable prin `ResponsiveDataView`, iar cardurile mobile rămân neschimbate.

---

## 12. Stocuri (Inventory)
| Câmp | Valoare |
|------|---------|
| Route | `/stocuri` |
| Page file | `src/app/(dashboard)/stocuri/page.tsx` |
| Client | `src/app/(dashboard)/stocuri/StocuriPageClient.tsx` |
| Tabele Supabase | `miscari_stoc` (read-only; writes via RPC în alte module) |
| Query keys | `queryKeys.stocGlobal`, `queryKeys.stocGlobalCal1`, `queryKeys.stocuriLocatiiRoot`, `queryKeys.stocuriLocatii(key)`, `queryKeys.miscariStoc` |

**Coloane `miscari_stoc`:** id, tenant_id, tip_miscare, cantitate_kg, calitate ['cal1'|'cal2'], locatie, produs, depozit, tip_depozitare ['fresh'|'congelat'|'procesat'], sursa_id, sursa_tip, data, observatii

**Clarificare P2:** pe desktop, `stocuri` se afișează read-only în DataTable (fără `Acțiuni`), deoarece mutațiile de stoc rămân indirecte prin Recoltări / Comenzi / Vânzări. Tabelul desktop agregă pe produs și afișează `Produs`, `Cantitate`, `Unitate`, `Ultimul update`.

---

## 13. Rapoarte (Reports)
| Câmp | Valoare |
|------|---------|
| Route | `/rapoarte` |
| Page file | `src/app/(dashboard)/rapoarte/page.tsx` |
| Client | `src/app/(dashboard)/rapoarte/RapoartePageClient.tsx` |
| Tabele Supabase | `recoltari`, `vanzari`, `cheltuieli_diverse`, `investitii` (calcule profit) |
| Query keys | Multiple (recoltari, vanzari, cheltuieli, investitii) |

---

## 14. Setări (Settings)
| Câmp | Valoare |
|------|---------|
| Route | `/settings` |
| Page file | `src/app/(dashboard)/settings/page.tsx` |
| Tabele Supabase | `profiles`, apeluri `/api/farm/reset`, `/api/gdpr/*` |

**Funcționalități:**
- Resetare date fermă
- Ștergere cont (GDPR)
- Integrare Google Contacts

---

## 15. Admin
| Câmp | Valoare |
|------|---------|
| Route | `/admin`, `/admin/analytics`, `/admin/audit` |
| Guard | `src/app/(dashboard)/admin/layout.tsx` — verifică `isSuperAdmin` |
| Tabele Supabase | `analytics_events` (service role), `tenant_metrics_daily`, `tenants`, `profiles` |

**Componente cheie:**
- `AdminAnalyticsDashboardView` + `loadAnalyticsDashboardData` — dashboard analytics desktop (`src/components/admin/analytics/`, `src/lib/admin/analytics-dashboard-data.ts`); Tech Health: `AdminAnalyticsSentrySection` + `getSentryTechHealth()` (snapshot config, fără API Sentry)
- `AdminTenantsPlanTable` — gestionare planuri tenants

---

## Tabele Supabase — Inventar complet

| Tabel | Modul principal |
|-------|-----------------|
| `profiles` | Auth/Middleware |
| `tenants` | Multi-tenancy |
| `parcele` | Parcele |
| `culturi` | Parcele (sere) |
| `activitati_agricole` | Activități Agricole |
| `recoltari` | Recoltări |
| `vanzari` | Vânzări |
| `vanzari_butasi` | Vânzări Butași |
| `vanzari_butasi_items` | Vânzări Butași |
| `comenzi` | Comenzi |
| `clienti` | Clienți |
| `culegatori` | Culegători |
| `cheltuieli_diverse` | Cheltuieli |
| `investitii` | Investiții |
| `miscari_stoc` | Stocuri |
| `crops` | Catalog culturi |
| `crop_varieties` | Varietăți culturi |
| `alert_dismissals` | Alerte |
| `analytics_events` | Admin Analytics |
| `google_oauth_tokens` | Integrare Google |
| `google_contacts_imports` | Import Google |
| `tenant_metrics_daily` | Admin Metrici |
| `solar_stages` | Tracking Sere |
| `solar_climate` | Tracking Sere |
| `ai_conversations` | Chat Widget |

---

## AI Chat Widget

| Câmp | Valoare |
|------|---------|
| API route | `/api/chat` (POST) |
| API file | `src/app/api/chat/route.ts` |
| Component | `src/components/ChatWidget.tsx` |
| Montat în | `src/app/(dashboard)/layout.tsx` |
| Model AI | `gemini-2.0-flash` via `@ai-sdk/google` |
| Tabel Supabase | `ai_conversations` |
| Coloane profiles necesare | `ai_messages_count`, `last_ai_usage_date` |

**Funcționalități:**
- Streaming text cu `useChat` din `ai/react`
- Keyword detection pentru 6 categorii (tratamente, clienți, cheltuieli, recoltare, comenzi, stocuri)
- Intent detection: returnează JSON `open_form` fără streaming — nu inserează date direct
- Page context dinamic per rută (parcele, comenzi, recoltări, cheltuieli, clienți, culegători)
- Session memory: ultimele 3 schimburi din `ai_conversations`
- Proactive alerts: parcele fără activitate 7+ zile (prima mesaj din sesiune)
- Voice input: Web Speech API `ro-RO`, zero dependențe noi
- Rate limit: 20 mesaje/zi per utilizator

**Documentație completă:** `docs/ai-chat-widget.md`
## Tratamente & Fertilizare (Faza 2D-2)

Schema DB: `produse_fitosanitare`, `planuri_tratament`, `planuri_tratament_linii`,
`parcele_planuri`, `stadii_fenologice_parcela`, `aplicari_tratament`.

Queries: `src/lib/supabase/queries/tratamente.ts`
Helpers: `src/lib/tratamente/` (phi-checker, rotatie-frac, cupru-cumulat, doza-calculator,
stadiu-ordering, generator, phi-guard, scheduler)

Cron: `/api/cron/tratamente-scan` rulează de 2x/zi și trimite notificări push pentru
aplicări planificate azi sau mâine.

Status:
- fundația DB + queries + helpers + engine generator + PHI guard + notificări complete
- bibliotecă produse fitosanitare CRUD livrată
- CRUD planuri tratament livrat prin wizard 3 pași:
  - `/tratamente/planuri` listă cu căutare, filtre și arhivare/dezarhivare
  - `/tratamente/planuri/nou` creare plan nou sau duplicare (`?duplicate_from=...`)
  - `/tratamente/planuri/[planId]/editeaza` editare cu prefill complet
  - `src/components/tratamente/plan-wizard/PlanWizard.tsx` este componenta generică reutilizabilă
- hub global livrat la `/tratamente` pentru aplicări cross-parcel:
  - tab-uri `Astăzi / Săptămâna asta / Toate`
  - KPI-uri pentru programări, PHI warning, fereastră meteo și aplicări efectuate
  - meteo deduplicat per parcelă și quick actions reutilizând flow-urile existente de detaliu aplicare
- salvarea finală a planului este atomică prin RPC `public.upsert_plan_tratament_cu_linii(...)`
- `planuri_tratament.arhivat` există pentru listare și excludere din selecțiile noi
