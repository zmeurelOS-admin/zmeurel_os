# Audit Part 2 - SQL (supabase/migrations)

Audit facut read-only pe toate fisierele din `supabase/migrations/`.

## 1) Tabele (nume + are tenant_id? + are RLS?)
Nota: pentru cateva tabele vechi, `tenant_id` este inferat din policies/indexuri dinamice, nu din `CREATE TABLE` direct in aceste migrari.

| Tabel | tenant_id | RLS |
|---|---|---|
| `activitati_agricole` | Da (inferat: policies pe `tenant_id`) | Da |
| `alert_dismissals` | Da | Da |
| `analytics_events` | Da | Da |
| `audit_logs` | Nu (`target_tenant_id` separat) | Da |
| `cheltuieli` | Neclear in aceste migrari | Nu apare `ENABLE RLS` in aceste fisiere |
| `cheltuieli_diverse` | Da (inferat: policies/index pe `tenant_id`) | Da |
| `clienti` | Da (inferat: policy/index pe `tenant_id`) | Da (din policy loop dinamic) |
| `comenzi` | Da | Da |
| `culegatori` | Da (inferat: index dinamic `(tenant_id, demo_seed_id)`) | Neconfirmat in aceste migrari |
| `feedback` | Da | Da |
| `integrations_google_contacts` | Da | Da |
| `investitii` | Da (inferat: index dinamic `(tenant_id, demo_seed_id)`) | Neconfirmat in aceste migrari |
| `miscari_stoc` | Da | Da |
| `parcele` | Da (inferat: policies/query pe `tenant_id`) | Da (din policy loop dinamic) |
| `profiles` | Nu | Nu |
| `recoltari` | Da | Da |
| `tenant_metrics_daily` | Nu | Da |
| `tenants` | Nu (`owner_user_id`) | Da |
| `vanzari` | Da | Da |
| `vanzari_butasi` | Da (inferat: trigger/query pe `tenant_id`) | Neconfirmat in aceste migrari |
| `vanzari_butasi_items` | Da | Da |

## 2) FK-uri (tabel -> referinta)

- `activitati_agricole.created_by -> auth.users(id)`
- `activitati_agricole.updated_by -> auth.users(id)`
- `alert_dismissals.tenant_id -> public.tenants(id)`
- `alert_dismissals.user_id -> auth.users(id)`
- `analytics_events.tenant_id -> public.tenants(id)`
- `analytics_events.user_id -> auth.users(id)`
- `audit_logs.actor_user_id -> auth.users(id)`
- `audit_logs.target_tenant_id -> public.tenants(id)`
- `cheltuieli.created_by -> auth.users(id)`
- `cheltuieli.updated_by -> auth.users(id)`
- `cheltuieli_diverse.created_by -> auth.users(id)`
- `cheltuieli_diverse.updated_by -> auth.users(id)`
- `clienti.created_by -> auth.users(id)`
- `clienti.updated_by -> auth.users(id)`
- `comenzi.tenant_id -> public.tenants(id)`
- `comenzi.client_id -> public.clienti(id)`
- `comenzi.linked_vanzare_id -> public.vanzari(id)`
- `comenzi.parent_comanda_id -> public.comenzi(id)`
- `feedback.tenant_id -> public.tenants(id)`
- `feedback.user_id -> auth.users(id)`
- `integrations_google_contacts.tenant_id -> public.tenants(id)`
- `integrations_google_contacts.user_id -> auth.users(id)`
- `miscari_stoc.tenant_id -> public.tenants(id)`
- `miscari_stoc.locatie_id -> public.parcele(id)`
- `parcele.created_by -> auth.users(id)`
- `parcele.updated_by -> auth.users(id)`
- `recoltari.created_by -> auth.users(id)`
- `recoltari.updated_by -> auth.users(id)`
- `vanzari.comanda_id -> public.comenzi(id)`
- `vanzari.created_by -> auth.users(id)`
- `vanzari.updated_by -> auth.users(id)`
- `vanzari_butasi_items.tenant_id -> public.tenants(id)`
- `vanzari_butasi_items.comanda_id -> public.vanzari_butasi(id)`

## 3) Functii RPC (nume + ce face)

- `admin_count_audit_logs`: returneaza numarul total de randuri din `audit_logs` pentru superadmin.
- `admin_list_audit_logs`: listeaza paginat logurile de audit pentru superadmin.
- `admin_list_tenants`: listeaza tenantii cu plan, owner si cateva metrici agregate.
- `admin_set_tenant_plan`: actualizeaza planul unui tenant (cu validare) si scrie audit log.
- `bucharest_today`: returneaza data curenta in timezone Europe/Bucharest.
- `delete_demo_for_tenant`: sterge datele demo ale tenantului si reseteaza flagurile de seed.
- `enforce_vanzari_butasi_items_tenant`: valideaza ca `tenant_id` din item corespunde comenzii parinte.
- `integrations_google_contacts_set_updated_at`: seteaza `updated_at = now()` la update.
- `is_superadmin`: verifica daca userul are `profiles.is_superadmin = true`.
- `recoltari_sync_cantitate_kg`: sincronizeaza `cantitate_kg = kg_cal1 + kg_cal2`.
- `refresh_tenant_metrics_daily`: calculeaza/actualizeaza snapshot-ul zilnic agregat in `tenant_metrics_daily`.
- `seed_demo_for_tenant`: populeaza date demo pentru un tenant gol, cu guard-uri de autorizare/idempotenta.
- `set_analytics_event_context`: completeaza automat `user_id`, `tenant_id`, `metadata`, `created_at` la insert in analytics.
- `set_audit_fields_minimal`: completeaza campuri audit (`created_*`, `updated_*`) la insert/update.
- `set_comenzi_tenant_and_audit`: completeaza tenant/audit si recalculeaza `total` pentru comenzi.
- `set_sync_audit_fields`: completeaza campuri sync/audit (`client_sync_id`, `sync_status`, `updated_*`).
- `set_vanzari_butasi_tenant_and_public_id`: seteaza tenantul si genereaza ID public secvential pe tenant.
- `tenant_has_core_data`: verifica daca tenantul are deja date operationale de baza.
- `update_my_farm_name`: permite owner-ului sa-si actualizeze `nume_ferma` cu validare.
- `upsert_with_idempotency`: face upsert pe tabele suportate folosind `client_sync_id` (idempotent/conflict-aware).
- `user_can_manage_tenant`: verifica daca un user poate administra un tenant (owner sau membership optional).

## 4) Trigger-e (nume + tabel)

- `recoltari_set_audit_fields_minimal` -> `public.recoltari`
- `vanzari_set_audit_fields_minimal` -> `public.vanzari`
- `activitati_agricole_set_audit_fields_minimal` -> `public.activitati_agricole`
- `clienti_set_audit_fields_minimal` -> `public.clienti`
- `parcele_set_audit_fields_minimal` -> `public.parcele`
- `cheltuieli_set_audit_fields_minimal` -> `public.cheltuieli`
- `cheltuieli_diverse_set_audit_fields_minimal` -> `public.cheltuieli_diverse`
- `trg_recoltari_sync_cantitate_kg` -> `public.recoltari`
- `analytics_events_set_context` -> `public.analytics_events`
- `recoltari_set_sync_audit_fields` -> `public.recoltari`
- `vanzari_set_sync_audit_fields` -> `public.vanzari`
- `activitati_agricole_set_sync_audit_fields` -> `public.activitati_agricole`
- `cheltuieli_diverse_set_sync_audit_fields` -> `public.cheltuieli_diverse`
- `trg_integrations_google_contacts_updated_at` -> `public.integrations_google_contacts`
- `vanzari_butasi_items_enforce_tenant` -> `public.vanzari_butasi_items`
- `comenzi_set_tenant_and_audit` -> `public.comenzi`
- `vanzari_butasi_set_tenant_and_public_id` -> `public.vanzari_butasi`

## 5) RLS policies (tabel + tip + conditie rezumat)

### `activitati_agricole`
- `select/insert/update`: tenant owner (`tenant_id = tenantul lui auth.uid()`) prin policy loop dinamic.
- `update`: policy suplimentara `activitati_agricole_owner_update` (tenant + `created_by` = user).
- `select/insert/update/delete`: policy dinamic superadmin (`public.is_superadmin()`).

### `alert_dismissals`
- `select`: userul vede propriile dismissals (si superadmin in varianta noua).
- `insert`: userul poate insera doar pentru propriul `user_id` + tenantul lui.
- `delete`: userul sterge doar propriile dismissals pe tenantul lui.
- (migrare compat veche are si varianta `user_id = auth.uid()` fara filtru tenant explicit).

### `analytics_events`
- `insert`: doar evenimentele propriului user in tenantul pe care il detine.
- `select`: doar superadmin (in versiunea initiala era `service_role`).
- `select/insert/update/delete`: in plus exista politici dinamice superadmin pe tabele cu `tenant_id`.

### `audit_logs`
- `select/insert/update/delete`: doar superadmin (`public.is_superadmin()`).

### `cheltuieli_diverse`
- `select/insert/update`: tenant owner (policy loop dinamic).
- `update`: policy suplimentara `cheltuieli_diverse_owner_update` (tenant + `created_by`).
- `select/insert/update/delete`: policy dinamic superadmin.

### `clienti`
- `select/insert/update`: tenant owner (policy loop dinamic).
- `select/insert/update/delete`: policy dinamic superadmin.

### `comenzi`
- `select/insert/update/delete`: tenant owner (`tenant_id = tenantul lui auth.uid()`).
- `select/insert/update/delete`: superadmin (`public.is_superadmin()`).

### `feedback`
- `insert`: userul poate insera feedback propriu daca e owner tenant sau superadmin.
- `select`: doar superadmin.

### `integrations_google_contacts`
- `select/insert/update/delete`: permis doar unui email admin hardcodat + `auth.uid() = user_id` (iar la insert/update si tenantul userului).

### `miscari_stoc`
- `select/insert/update/delete`: doar tenant owner (`tenant_id = tenantul lui auth.uid()`).
- `select/insert/update/delete`: policy dinamic superadmin (pe tabele cu `tenant_id`).

### `parcele`
- `select/insert/update`: tenant owner (policy loop dinamic).
- `select/insert/update/delete`: policy dinamic superadmin.

### `recoltari`
- `select/insert/update`: tenant owner (policy loop dinamic).
- `update`: policy suplimentara `recoltari_owner_update` (tenant + `created_by`).
- `select/insert/update/delete`: policy dinamic superadmin.

### `tenant_metrics_daily`
- `select`: superadmin.
- `insert/update/delete`: superadmin (in migrarea completa din 2026022612).

### `tenants`
- `select`: owner sau superadmin.
- `insert`: owner (si, in alta migrare, owner sau superadmin).
- `update`: superadmin (`tenants_superadmin_update`) + owner (`tenants_owner_update`).
- `delete`: superadmin.

### `vanzari`
- `select/insert/update`: tenant owner (policy loop dinamic).
- `update`: policy suplimentara `vanzari_owner_update` (tenant + `created_by`).
- `select/insert/update/delete`: policy dinamic superadmin.

### `vanzari_butasi_items`
- `select/delete`: tenant owner.
- `insert/update`: tenant owner + validare ca item-ul apartine unei comenzi din acelasi tenant.

## Observatie finala
Exista politici generate dinamic (mai ales in `2026022501_*` si `2026022611_*`), deci numarul efectiv de policies in DB depinde de ce tabele aveau deja coloana `tenant_id` la momentul rularii migrarii.
