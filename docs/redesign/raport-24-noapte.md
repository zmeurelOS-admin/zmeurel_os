# Raport 24 — Noapte: securitate, drepturi, kit, curățenie

Branch: `redesign/noapte-24`, pornit din `main` (`1732880`, conține promptul 23). Fără merge. Două migrări scrise,
**neaplicate**. Din baza de date am citit doar cu `select` (`pg_proc`, `pg_policies`, `information_schema`, numărători).

## Rezumat pentru Andrei

1. **Livratorul putea marca livrată orice comandă din orice fermă** (ruta lua doar `order_id`, fără fermă). Reparat: doar comenzile fermei lui, „în livrare”, de azi.
2. **Un operator putea reîncărca sau șterge datele demo, lega Google Contacts și citi/schimba actele fermei** în ferma în care lucrează (rutele cu service role luau ferma din apartenență). Reparat: doar proprietarul.
3. **Comenzile din magazin (PATCH) se scriau cu service role fără drepturi**: un operator doar-citire le putea schimba. Reparat: aceeași regulă ca RLS (Comenzi sau Livrări „Scrie”).
4. **Orice cont logat putea marca orice cerere „anunță-mă” din magazin.** Reparat: doar superadmin, ca RLS.
5. **13 funcții SQL `SECURITY DEFINER` primeau ferma ca parametru și nu verificau apelantul** (scriau/ștergeau în stocul oricărei ferme, scriau comenzi în orice magazin, ștergeau vânzări). Migrare neaplicată: le scoate dreptul pentru utilizatori; aplicația nu le cheamă așa.
6. **RLS: orice operator (și doar-citire) putea scrie prin API vânzări, cheltuieli, investiții, actele fermei, culturile parcelelor.** Și **orice proprietar putea adăuga ca operator în ferma lui orice cont** (după id), mutându-l pe tăcute acolo. Migrare neaplicată care le leagă de drepturi.
7. Ruta moartă `/api/farm-members/invite-operator` (lega orice cont existent după email, fără acordul lui) e ștearsă.
8. **De hotărât:** citirea fără drept pe modul (operatorul vede vânzările și sumele, clienții, actele fermei), Material săditor (aceeași problemă de scriere, în afara promptului), limita AI din „Din mesaj” care nu funcționează (§7).
9. **Nefăcut în noaptea asta:** măsurarea vitezei (partea 4) și trecerea prin desktop (partea 5). Sesiunea s-a întrerupt după partea 1 și am reluat dimineață; n-am creat niciun demo și n-am testat nimic în browser.
10. Toate verificările trec (§10). Migrările: întâi `20261122090000`, apoi `20261122091000`; aplicația merge și fără ele.

## 1. Rutele server cu service role

Am citit toate cele 78 de rute din `src/app/api`, paginile și `src/lib` care cheamă `getSupabaseAdmin()` / `createServiceRoleClient()`
(95 de fișiere). Helper nou, comun: `src/lib/farm-members/actor-auth.ts` (`resolveFarmActor`, `actorCanWrite`): ferma din
sesiune, ca în `current_tenant_id()` și `proxy.ts` (apartenența de operator, apoi ferma proprie), plus drepturile pe module.
Rutele de proprietar folosesc `isFarmOwner` / `getFarmOwnerContext`, ca în promptul 23.

| Ruta | Cine are voie | Verificarea găsită | Stare |
|---|---|---|---|
| `GET /api/farm-members`, `PATCH [id]/access`, `PATCH [id]/deactivate`, `POST [id]/regenerate-token`, `POST create-invite`, `POST invite-livrator` | proprietar | `getFarmOwnerContext` + filtru pe fermă | OK |
| `POST /api/farm-members/invite-operator` | proprietar | lega ca operator orice cont existent, după email, fără acceptul lui; nechemată de nicăieri | **șters** |
| `POST /api/invite/accept` | anonim cu token | token exact, marcat atomic, fără fermă din corp | **reparat**: linkul de reconectare nu mai intră în contul unui operator activ în altă fermă (`hasActiveMembershipElsewhere`) |
| `/auth/callback` → `acceptFarmInviteForUser` | logat cu token | token valid, nefolosit, cu drepturi | OK |
| `POST /api/farm/reset`, `PATCH/DELETE /api/gdpr/farm` | proprietar (+ parolă) | `isFarmOwner` (promptul 23) | OK |
| `DELETE /api/gdpr/account` | orice logat | șterge doar ferma proprie | OK |
| `POST /api/demo/reload`, `/reset`, `/seed` | proprietar | ferma din apartenență, fără verificare de proprietar | **reparat** (`isFarmOwner`) |
| `POST /api/auth/destructive-step-up` | logat, cu parolă | rate limit, parola verificată | OK |
| `POST /api/auth/beta-guest`, `/beta-signup` | anonim | origine + limită pe IP (în memorie) | OK (limita în memorie se resetează la fiecare instanță; notă) |
| `POST /api/auth/leave-demo`, `/sign-out` | logat | doar sesiunea proprie | OK |
| `GET /api/livrator/session` | token livrator | token activ, rol livrator | OK |
| `POST /api/livrator/deliver` | token livrator | **orice comandă, după id**, din orice fermă, în orice stare | **reparat**: ferma din token, `in_livrare`, azi |
| `/livrator/livrari` (pagină) | cookie cu token | comenzile de azi „în livrare” ale fermei lui | OK |
| `GET/PUT /api/legal-docs`, `POST /api/legal-docs/upload` | proprietar | ferma din apartenență (operatorul vedea CNP-ul nu, dar numele, telefonul, poza) | **reparat** (`isFarmOwner`) |
| `GET /api/integrations/google/connect`, `GET callback`, `POST sync-now` | proprietarul fermei cu Google | doar tenantul fix, fără proprietar | **reparat** (un operator își putea lega contul Google, iar sincronizarea ar fi lucrat pe contactele lui) |
| `POST /api/integrations/google/push-client` | membru al fermei cu Google | ferma din corp comparată cu cea din sesiune | OK |
| `/api/integrations/google/import` | — | dezactivată (410) | OK |
| `PATCH /api/shop/b2c/orders/[id]` | proprietar, operator cu Comenzi/Livrări „Scrie” | ferma din sesiune, **fără drepturi**, scriere cu service role | **reparat** (`actorCanWrite(actor, 'comenzi', 'livrari')`) |
| `PATCH /api/shop/b2c/notify/[id]` | superadmin (ca în RLS) | orice cont logat | **reparat** |
| `POST /api/shop/b2c/orders/reorder` | logat | RPC cu verificări, clientul utilizatorului | OK |
| `POST /api/shop/order`, `b2c/order`, `b2c/check-recent-order`, `b2c/customer*`, `b2c/interest`, `b2c/notify`, `GET campaign/[slug]` | anonim (magazinul) | ferma din `SHOP_TENANT_ID` sau validată (fermă aprobată); limite pe IP | OK (magazinul neatins) |
| `/api/association/*` (15 rute) | membrii asociației, pe roluri | `getAssociationRole` | OK, neatinse (asociația e în afara promptului) |
| `PATCH /api/admin/tenant-association`, `/tenant-plan` | superadmin | `isSuperAdmin` + clientul utilizatorului (RLS) | OK |
| `/api/cron/*` (8 rute) | cron | `CRON_SECRET`; fără variabilă → refuz; nimic înainte de verificare | OK (n-am apelat niciun cron) |
| `POST /api/paste-to-*`, `/api/parse-order` | logat cu „Scrie” pe modul | `resolvePasteToXWriteAccess` | OK (vezi §7: limita persistentă din „Din mesaj” nu funcționează) |
| `/api/chat`, `/chat/count`, `/chat/usage` | logat | profilul propriu | OK, neatinse |
| `/api/push/*`, `/api/notifications`, `/api/profile/phone` | logat | doar rândurile proprii | OK |
| `POST /api/share/contact` | anonim | nu scrie nimic | OK |
| `POST /api/livrari/optimizeaza` | logat | doar serviciul extern de rute | OK |
| Pagini: `clienti/page`, `acces-oprit`, `comanda`, `AnalyticsDashboard`; `proxy.ts` | — | citesc doar rândurile utilizatorului / fermei lui, sau sunt superadmin / magazin | OK |
| `src/lib/notifications/*`, `src/lib/shop/*`, `src/lib/association/*` | chemate din cron / rute verificate | — | OK |

**Operator dezactivat, livrator, operator ascuns:** toate rutele de proprietar trec prin `isFarmOwner` / `getFarmOwnerContext`
(ferma trebuie să fie a lui), deci niciunul nu trece. Livratorul n-are sesiune Supabase; tokenul lui merge doar pe rutele
`/api/livrator/*`.

**Teste noi** (fiecare reparație: cererea unui operator / a unui străin → 403 sau 404, nimic scris):
`src/app/api/livrator/__tests__/deliver.route.test.ts`, `src/app/api/demo/__tests__/owner-only.route.test.ts`,
`src/app/api/legal-docs/__tests__/owner-only.route.test.ts`, `src/app/api/shop/b2c/notify/__tests__/patch.route.test.ts`,
cazuri noi în `shop/b2c/orders/[id]`, în cele 3 teste Google și în `invite/accept`, plus
`src/lib/__tests__/farm-actor-auth.test.ts` și `operator-link-elsewhere.test.ts`. Testul comenzilor din magazin nu rula deloc
(paranteze drepte în cale); l-am pus în `vitest.critical.config.ts` și am reparat un caz care pica deja pe `main`.

### Funcțiile SQL `SECURITY DEFINER`

95 de funcții în `public`, toate deținute de `postgres`, toate cu `search_path`. **Niciuna nu mai e apelabilă de `anon`**
(migrarea din `raport-securitate-1` e aplicată). Am citit corpul fiecăreia apelabile de `authenticated`.

| Funcții | Verificarea | Stare |
|---|---|---|
| `sync_recoltare_stock_movements`, `consume_active_stock_reservations_for_comanda`, `reserve_sellable_cal1_stock`, `list_sellable_cal1_buckets_for_reservation`, `resolve_recoltare_stock_identity`, `resolve_zmeura_produs_id`, `tenant_has_core_data`, `validate_suprafata_culturi` | niciuna: primesc ferma / id-ul ca parametru | **migrare**: fără `EXECUTE` pentru `authenticated` (le cheamă doar alte funcții definer și triggere) |
| `check_recent_shop_order`, `place_preorder_atomic` | doar `auth.role()` / nimic | **migrare**: doar `service_role` (rutele magazinului le cheamă cu service role) |
| `create_vanzare_with_stock`, `update_vanzare_with_stock`, `delete_vanzare_with_stock` | sesiune + fermă, fără drept: un operator doar-citire putea șterge vânzări | **migrare**: fără `EXECUTE` (aplicația nu le mai cheamă; ștergerea vine prin `delete_comanda_atomic` / `reopen_comanda_atomic`, care verifică proprietarul) |
| restul RPC-urilor aplicației (comenzi, livrări, recoltări, stoc, tratamente, plăți, `upsert_with_idempotency`, …) | `auth.uid()` + `current_tenant_id()` + `is_tenant_owner` / `operator_can_write` | OK |
| `get_public_farmer_card`, `is_legal_docs_complete` | publice prin natura lor (cardul fermierului, starea actelor pentru asociație) | OK, lăsate |
| `check_and_log_ai_usage` (3 parametri) | `auth.uid() = p_user_id`, dar ferma e liberă | OK pentru securitate; **bug**: vezi §7 |
| `user_can_manage_tenant`, `delete_demo_for_tenant`, `update_my_farm_name`, `get_association_role`, `is_superadmin` | proprietar / propriul utilizator | OK |
| funcțiile de trigger | rulează fără `EXECUTE` | OK |

## 2. RLS pentru operatori

Citit din `pg_policies` pe toate cele 72 de tabele din `public` (toate au RLS).
„Fermă” = `tenant_id = current_tenant_id()`; „P” = `is_tenant_owner`; „OW(x)” = `operator_can_write('x')`.

| Tabel | Citire | Scriere azi | Modulul din aplicație | După migrare |
|---|---|---|---|---|
| `recoltari` | fermă | P ∨ OW(recoltari); ștergere P | Recoltări | neschimbat |
| `comenzi` | fermă (+ asociația) | P ∨ OW(comenzi); ștergere P | Comenzi | neschimbat |
| `clienti` | fermă | P ∨ OW(clienti); ștergere P | Clienți | neschimbat |
| `culegatori` | fermă | P ∨ OW(culegatori); ștergere P | Culegători | neschimbat |
| `parcele` | fermă | P ∨ OW(parcele); ștergere P | Parcele | neschimbat |
| `produse` | fermă (+ asociația) | P ∨ OW(produse); ștergere P | Produse | neschimbat |
| `activitati_agricole` | fermă | P ∨ OW(activitati); ștergere P | Lucrări | neschimbat |
| `aplicari_tratament*`, `planuri_tratament*`, `parcele_planuri`, `capcane_*`, `produse_fitosanitare` | fermă | P ∨ OW(tratamente); ștergere P | Tratamente | neschimbat |
| `stock_reservations` | fermă | P ∨ OW(comenzi) | Comenzi | neschimbat |
| `shop_orders` | fermă | P ∨ OW(comenzi) ∨ OW(livrari) | Comenzi, Livrări | neschimbat |
| `ajustari_stoc`, `shop_order_erp_links` | fermă | doar RPC | Stocuri | neschimbat |
| `tenant_settings` | fermă | P | Setări | neschimbat |
| **`vanzari`** | fermă | **orice membru** | Vânzări (proprietar) | **P** |
| **`cheltuieli_diverse`** | fermă | **orice membru** | Cheltuieli (proprietar) + manopera automată din Recoltări | **P**, sau OW(recoltari) doar pe rândul „Manoperă cules” |
| **`investitii`** | fermă | **orice membru** | Investiții (proprietar) | **P** |
| **`miscari_stoc`** | fermă | **orice membru** | ledger vechi, scris doar de RPC definer | **P** |
| **`culturi`, `etape_cultura`, `culture_stage_logs`, `solar_climate_logs`, `stadii_fenologice_parcela`, `configurari_parcela_sezon`** | fermă | **orice membru** | fișa parcelei | **P ∨ OW(parcele)** |
| **`activitati_extra_season`** | fermă | **orice membru** | Lucrări | **P ∨ OW(activitati)**; ștergere P |
| **`farmer_legal_docs`** | fermă (+ superadmin) | **orice membru** (rol `public`) | Actele fermei | **P** (+ superadmin) |
| **`shop_campaigns`** | fermă (+ anonim, active) | **orice membru** | magazin (proprietar) | **P** |
| **`nomenclatoare`, `crops`, `crop_varieties`, `farmer_weekly_summary_runs`** | fermă | **orice membru** | nescrise din aplicație | **P** (+ superadmin unde exista) |
| **`farm_members`, `farm_invites`** | proprietar; membrul își vede rândul | **proprietarul scrie orice rând în ferma lui** | Echipa (doar prin rute server) | **proprietarul doar citește**; scrie doar serverul |
| `vanzari_butasi`, `vanzari_butasi_items` | fermă | orice membru | Material săditor | **neatins** (în afara promptului) — de hotărât |
| `alert_dismissals`, `ai_conversations`, `ai_usage_log`, `notifications`, `push_subscriptions`, `notificari_preferinte`, `profiles` | rândurile proprii | rândurile proprii | — | neschimbat |
| `meteo_cache` | fermă | fermă | Acasă (meteo) | neschimbat (oricine din fermă poate ține meteo în memorie) |

Testul RLS (`src/tests/rls/`, `npm run test:rls`) cere o bază în care migrarea e aplicată, deci n-am adăugat cazuri; verificarea
de după aplicare e la finalul fișierului de migrare.

### Citirea fără drept pe modul (neschimbată — decizia ta)

| Ce citește un operator prin API | Ce ar strica o restrângere | Recomandarea mea |
|---|---|---|
| `clienti` (fără Clienți) | Comenzi și Livrări arată numele, telefonul și adresa clientului; Vânzarea rapidă alege clientul | Lasă așa. |
| `produse`, `parcele`, `culegatori` | Comenzi, Recoltări și Tratamente au nevoie de liste | Lasă așa. |
| **`vanzari`** (sume, plăți, toată istoria) | Comenzi arată starea plății comenzii livrate (vânzarea legată) | **Restrânge la proprietar** sau prin RPC care întoarce doar starea plății pe comandă. Banii fermei sunt vizibili oricărui operator. |
| **`cheltuieli_diverse`, `investitii`** | nimic din modulele operatorului | **Restrânge la proprietar.** |
| **`farmer_legal_docs`** (nume, telefon, poza certificatului) | nimic (ruta e deja doar a proprietarului) | **Restrânge la proprietar.** |
| `tenants` (rândul fermei) | operatorul nu-l poate citi azi; de aceea vede „Ferma ta” pe Mai mult | Dă-i citire pe `id`, `nume_ferma` (sau trimite numele din layout). |

### Livratorul

Fără cont: tokenul din `farm_members.invite_token` (rol `livrator`, activ). Atinge doar `/livrator/<token>`, `/api/livrator/session`
(cookie `httpOnly`, cale `/livrator`, 7 zile), pagina `/livrator/livrari` (comenzile din magazin ale fermei lui, „în livrare”,
de azi, cu numele, telefonul și adresa clientului) și `/api/livrator/deliver` (reparat). Tokenul nu expiră singur; „Retrimite”
îl schimbă, „Dezactivează” îl oprește. Comenzile B2B (`comenzi`) nu ajung la livrator.

## 3. Kitul

- Toate folderele din listă erau deja în `KIT_RULE_DIRS` (Tratamente, Stocuri, Produse, Rapoarte, Parcele, Lucrări, Echipa, Actele
  fermei, Cheltuieli, Investiții, Vânzări, Mai mult, Notificări, Setări, `/invite`, `/acces-oprit`).
- **Adăugat:** `src/components/legal-docs` (bannerul cu actele lipsă), fără abateri.
- **Lăsat afară:** `src/components/notifications` (clopoțelul și panoul de pe desktop, bannerul de push): 17 abateri (tokeni vechi,
  text de 10–12 px, `z-[80]`). Repararea ar schimba vizibil desktopul, care nu se reface acum.
- **ARIA:** am căutat în toate folderele din kit butoane doar-iconiță fără etichetă, comutatoare fără `role="switch"` /
  `aria-checked`, tab-uri fără `tablist`. N-am găsit nimic de reparat (`ToggleRow`, `CheckRow`, `Segments`, `FilterPills` sunt corecte).
- `npm run check:kit`: OK, 237 de fișiere.

## 4. Viteza

**Nefăcut.** Măsurarea cere build local, un demo nou și browserul; n-am ajuns la ea. Nimic schimbat în paginile principale.

## 5. Desktopul

**Nefăcut.** N-am trecut prin module la 1280 / 1024 px. Niciun screenshot în `docs/redesign/screenshots/24/`.

## 6. Curățenia

**Șterse** (fără import, rută sau test; `knip` + `git grep` în `src`, `e2e`, `tests`, `scripts`):
`src/components/app/DialogInitialDataSkeleton.tsx`, `NumericField.tsx`, `PerformanceTable.tsx`, `StickyActionBar.tsx`,
`module-list-chrome.tsx`, `useMobileScrollRestore.ts`; `src/components/ui/ResponsiveFormContainer.tsx`;
`src/lib/design-tokens.ts`, `src/lib/ui/app-select-utils.ts`, `src/lib/utils/area.ts`; `src/test/helpers/select-app-option.ts`;
ruta `/api/farm-members/invite-operator`.

**Listate, neșterse:**
- `src/app/head.tsx` (convenție veche, ignorată de App Router; aproape sigur moartă);
- formularele vechi din Produse (`AddProdusDialog`, `EditProdusDialog`, `ProductAssociationOfferBlock`, `ProdusFormSummary`), păstrate intenționat pentru magazinul nou;
- fișiere nefolosite din magazin și asociație (`src/components/shop/association/marketplace/*`, `AssociationHeroVisual`, `AssociationLogo`, `offer-queries.ts`, `order-summary-print.ts`, `src/app/comanda/manifest.ts`) — în afara promptului;
- 138 de exporturi nefolosite (în mare parte variante shadcn, constante, helperi din chat) — fără risc, neatinse;
- scripturile din `scripts/` și `scripts/qa/` (unelte manuale).

**Dependențe nefolosite** (neschimbate): `react-hook-form`, `@hookform/resolvers`, `shadcn` (dev). Lipsește din `package.json`: `server-only` (raportul 22).

**Lint:** de la 9 la 4 avertismente. Rămase: 3 în `chat-post-handler.ts` (chatul AI, neatins) și `<img>` în
`LivratorLivrariClient.tsx` (trecerea la `next/image` poate schimba aspectul).

## 7. Resturile

**Făcut:**
- **Bannerul cu actele lipsă** are test fără demo: regula din layout e acum `bannerActeDinLayout` (`src/lib/acte/stare.ts`), iar
  `src/lib/acte/__tests__/banner-layout.test.tsx` randează bannerul pentru: acte lipsă (text + link), nimic salvat, acte validate
  (fără banner), operator (fără banner), date complete dar nevalidate.

**Găsit acum, de hotărât:**
- **Limita AI din „Din mesaj” nu funcționează.** `parse-order` cheamă `check_and_log_ai_usage` cu clientul service role;
  funcția cere `auth.uid() = p_user_id`, iar cu service role `auth.uid()` e `null` → `UNAUTHORIZED` → ruta „lasă să treacă”.
  Reparația: apelul cu clientul utilizatorului. Atinge zona AI, deci n-am făcut-o.
- Testul `src/app/api/parse-order/__tests__/route.test.ts` pică deja pe `main` (11 cazuri) și nu e în `test:critical:unit`.
- Material săditor: aceeași problemă de RLS ca vânzările (orice operator scrie).

**Din raportul 22 §4 și raportul 23 §6, rămase** (fiecare cere o decizie sau atinge zone excluse): chatul AI fără buton;
`?edit=<id>` din chat; fișierele din `bonuri` fără rând; datoriile peste 30 de zile; „Șterge datele fermei” pe `/api/farm/reset`;
plata culegătorilor în Rapoarte; „Cine” la Lucrări pentru operator; stadiile pe an calendaristic; Cash / Transfer, „Livrate azi”,
ora de la „N-a răspuns” (migrări); push la 07:00 / 18:00; `clienti.whatsapp_b2b_message` fără migrare; `DEMO_CLEANUP_MODE`;
tipurile din `src/types/supabase.ts` (de regenerat); verificările din `schema-features`; teste de componentă pentru Livrări;
widgetul beta; „Ferma ta” pe Mai mult pentru operator (vezi §2); `ERR_SSL_PROTOCOL_ERROR` local după redirect.

### Triggerul `on_auth_user_created` (nu l-am schimbat)

Azi face o fermă pentru orice cont nou, iar acceptarea linkului o șterge imediat (`removeAutoCreatedTenants`). Ce s-ar face:
în funcția triggerului, un `if new.email ilike '%@operator.zmeurel.local' then return new; end if;` înainte de inserarea în
`tenants`, plus profilul cu `tenant_id = null` și `exclude_from_analytics = true` scris tot acolo. **Riscul:** funcția rulează la
fiecare înscriere (Google, email, demo); o greșeală oprește toate înscrierile. Codul aplicației trebuie să rămână (conturile ascunse
create înainte de migrare), iar `ensureTenantForUser` nu trebuie chemat pentru aceste conturi. Recomandarea mea: o migrare
separată, testată întâi pe un branch Supabase.

## 8. Migrările (neaplicate)

**Ordinea:** `20261122090000_secdef_interne_fara_authenticated.sql`, apoi `20261122091000_rls_scrieri_dupa_drepturi.sql`.
Sunt independente; ordinea doar urmează partea 1 → partea 2.

**Aplicația merge fără ele** (exact ca azi) și cu ele: nimic din aplicație nu cheamă funcțiile scoase cu sesiunea utilizatorului,
iar scrierile restrânse sunt cele pe care interfața oricum nu le dă operatorului. După aplicare: verificările de la finalul fiecărui
fișier, apoi regenerarea tipurilor nu e necesară (doar drepturi și politici).

### `supabase/migrations/20261122090000_secdef_interne_fara_authenticated.sql`

```sql
-- Funcțiile SECURITY DEFINER care primesc ferma ca parametru și NU verifică cine le cheamă
-- nu mai sunt apelabile direct de utilizatorii logați (`authenticated`). Rămân pentru `service_role`.
--
-- NEAPLICATĂ: o rulează Andrei. Promptul 24, partea 1.
--
-- De ce: toate rulează ca `postgres` (ocolesc RLS) și au `EXECUTE` pentru `authenticated`. Oricine are un cont
-- (inclusiv un demo de 30 de secunde) le putea chema prin PostgREST (`/rest/v1/rpc/...`) cu ferma altcuiva:
--   - sync_recoltare_stock_movements: ȘTERGE și scrie rânduri în `miscari_stoc` pentru orice fermă;
--   - consume_active_stock_reservations_for_comanda: scrie în `miscari_stoc` și `stock_reservations` pentru orice fermă;
--   - reserve_sellable_cal1_stock: scrie rezervări de stoc pentru orice fermă;
--   - list_sellable_cal1_buckets_for_reservation: citește stocul oricărei ferme;
--   - resolve_recoltare_stock_identity: citește cultura/soiul parcelelor oricărei ferme;
--   - resolve_zmeura_produs_id, tenant_has_core_data: află date despre orice fermă;
--   - validate_suprafata_culturi: citește suprafața oricărei parcele (după id);
--   - check_recent_shop_order: caută comenzile din magazin ale oricărei ferme după telefon (produse, sumă);
--   - place_preorder_atomic: scrie comenzi în magazinul oricărei ferme, ocolind validările rutei;
--   - create_vanzare_with_stock, update_vanzare_with_stock, delete_vanzare_with_stock: verifică ferma, dar nu
--     și dreptul: un operator doar-citire putea crea, schimba sau ȘTERGE vânzări (bani).
--
-- Cine le folosește azi (verificat în cod și în `pg_proc`, 22.11.2026):
--   - aplicația NU le cheamă cu sesiunea utilizatorului. `check_recent_shop_order` și `place_preorder_atomic`
--     sunt chemate de rutele magazinului cu service role (`getSupabaseAdmin()`), care rămâne cu drept.
--   - celelalte sunt chemate doar din alte funcții SECURITY DEFINER (deliver_order_atomic, delete_comanda_atomic,
--     reopen_comanda_atomic, set_*_in_delivery_with_reservation, promote_shop_order_to_comanda, seed_demo_for_tenant,
--     cultura_recoltare_stoc) sau din triggere (check_culturi_suprafata). Acelea rulează ca `postgres`, deci
--     apelul din interior nu are nevoie de dreptul lui `authenticated`.
--   - `vanzari` se scriu în aplicație prin set_comanda_delivered, livreaza_si_copiaza_comanda, mark_comanda_incasata,
--     adauga_plata_vanzare (neatinse) și prin `setVanzareStatusPlata` (update direct, proprietar).
--
-- Aplicația merge fără migrare (comportamentul de azi) și cu ea (nimic din aplicație nu le cheamă ca utilizator).
-- Dacă o pagină ar avea nevoie de una dintre ele pe viitor: funcția trebuie întâi să verifice `auth.uid()`,
-- `current_tenant_id()` și dreptul, apoi primește din nou `EXECUTE`.
--
-- Doar drepturi: fără schimbări de corp, fără tabele, fără date. Se poate rula de mai multe ori.
-- Anulare: `grant execute on function <semnătura> to authenticated;` pentru fiecare.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname in (
        'sync_recoltare_stock_movements',
        'consume_active_stock_reservations_for_comanda',
        'reserve_sellable_cal1_stock',
        'list_sellable_cal1_buckets_for_reservation',
        'resolve_recoltare_stock_identity',
        'resolve_zmeura_produs_id',
        'tenant_has_core_data',
        'validate_suprafata_culturi',
        'check_recent_shop_order',
        'place_preorder_atomic',
        'create_vanzare_with_stock',
        'update_vanzare_with_stock',
        'delete_vanzare_with_stock'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.signature);
    execute format('grant execute on function %s to service_role', fn.signature);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Verificarea de după aplicare:
--   select p.oid::regprocedure, has_function_privilege('authenticated', p.oid, 'execute') as auth_poate
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname in ('sync_recoltare_stock_movements', 'place_preorder_atomic', ...);
-- Așteptat: auth_poate = false. Apoi în demo: o comandă din magazin, „Pune în livrare”, livrarea, ștergerea unei
-- comenzi livrate merg ca înainte.
```

### `supabase/migrations/20261122091000_rls_scrieri_dupa_drepturi.sql`

```sql
-- RLS: scrierile urmează drepturile pe module (promptul 24, partea 2).
--
-- NEAPLICATĂ: o rulează Andrei, după migrarea 20261122090000 (independente, dar așa am testat logica).
--
-- Regula de azi pe aceste tabele era doar `tenant_id = current_tenant_id()`. Pentru un operator,
-- `current_tenant_id()` întoarce ferma în care lucrează, deci ORICE operator (și unul doar-citire, și unul
-- fără niciun drept pe modul) putea scrie direct prin API (cheia publică + sesiunea lui):
--   - vânzări, cheltuieli, investiții (bani; module doar ale proprietarului);
--   - `miscari_stoc` (ledgerul vechi), actele fermei, campaniile magazinului, nomenclatoarele;
--   - culturile, etapele, jurnalele de solar, stadiile și configurările de sezon ale parcelelor (fără „Scrie” pe Parcele);
--   - `farm_members` / `farm_invites`: orice proprietar putea adăuga în ferma lui ORICE utilizator ca operator
--     (după id). `current_tenant_id()` preferă apartenența de operator, deci contul acela ar fi fost mutat pe
--     tăcute în ferma lui (vedea și scria acolo). Aplicația nu scrie niciodată aceste tabele cu sesiunea
--     utilizatorului: doar rutele server, cu service role.
--
-- Ce NU se schimbă: citirea (toate politicile SELECT rămân). Politicile superadminului și ale asociației rămân.
-- Material săditor (`vanzari_butasi*`) NU e atins aici (în afara promptului): vezi raportul.
--
-- Cine scrie azi, din aplicație, în tabelele atinse (verificat în cod):
--   - vanzari: `setVanzareStatusPlata` (pagina Vânzări, doar proprietar). Restul prin RPC SECURITY DEFINER.
--   - cheltuieli_diverse: Cheltuieli (proprietar) și cheltuiala automată „Manoperă cules” scrisă după o recoltare
--     (`queries/manopera-auto.ts`), deci și de operatorul cu „Scrie” pe Recoltări. Politica de mai jos îl lasă
--     să scrie DOAR acel rând automat.
--   - investitii, shop_campaigns, farmer_legal_docs: doar proprietarul (operatorul n-are aceste module).
--   - miscari_stoc, farmer_weekly_summary_runs, crops, crop_varieties, nomenclatoare, activitati_extra_season:
--     aplicația nu le scrie direct (doar RPC SECURITY DEFINER, cron sau demo cu service role).
--   - culturi, etape_cultura, culture_stage_logs, solar_climate_logs, stadii_fenologice_parcela,
--     configurari_parcela_sezon: fișa parcelei (Parcele).
--
-- Aplicația merge fără migrare (ca azi). Cu migrarea: proprietarul nu vede nicio diferență; operatorul fără
-- drept primește `42501` acolo unde interfața oricum nu-l lasă.
-- Aditivă pentru date: doar politici. Se poate rula de mai multe ori (drop if exists + create).

-- ─── Doar proprietarul ────────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'vanzari',
    'investitii',
    'miscari_stoc',
    'farmer_weekly_summary_runs',
    'nomenclatoare'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))
         with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_delete', t);
  end loop;
end $$;

-- crops / crop_varieties: aceleași trei politici de fermă; cele ale superadminului rămân.
do $$
declare
  t text;
begin
  foreach t in array array['crops', 'crop_varieties'] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))
         with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))',
      t || '_delete', t);
  end loop;
end $$;

-- shop_campaigns: politica de update avea alt nume.
drop policy if exists "authenticated can update own campaigns" on public.shop_campaigns;
drop policy if exists shop_campaigns_insert on public.shop_campaigns;
drop policy if exists shop_campaigns_update on public.shop_campaigns;
drop policy if exists shop_campaigns_delete on public.shop_campaigns;
create policy shop_campaigns_insert on public.shop_campaigns for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));
create policy shop_campaigns_update on public.shop_campaigns for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));
create policy shop_campaigns_delete on public.shop_campaigns for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

-- farmer_legal_docs: politicile „_own” (rol public) devin ale proprietarului; cele ale superadminului rămân.
drop policy if exists farmer_legal_docs_insert_own on public.farmer_legal_docs;
drop policy if exists farmer_legal_docs_update_own on public.farmer_legal_docs;
drop policy if exists farmer_legal_docs_delete_own on public.farmer_legal_docs;
create policy farmer_legal_docs_insert_own on public.farmer_legal_docs for insert to authenticated
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));
create policy farmer_legal_docs_update_own on public.farmer_legal_docs for update to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id))
  with check (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));
create policy farmer_legal_docs_delete_own on public.farmer_legal_docs for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

-- ─── Cheltuieli: proprietarul; operatorul cu „Scrie” pe Recoltări doar rândul automat de manoperă ────
-- Categoria și marcajul sunt cele din `src/lib/supabase/queries/manopera-auto.ts`
-- (`AUTO_MANOPERA_CATEGORY`, `AUTO_MANOPERA_DESCRIPTION_MARKER`).

drop policy if exists cheltuieli_diverse_insert on public.cheltuieli_diverse;
drop policy if exists cheltuieli_diverse_update on public.cheltuieli_diverse;
drop policy if exists cheltuieli_diverse_delete on public.cheltuieli_diverse;
create policy cheltuieli_diverse_insert on public.cheltuieli_diverse for insert to authenticated
  with check (
    tenant_id = public.current_tenant_id()
    and (
      public.is_tenant_owner(tenant_id)
      or (
        public.operator_can_write('recoltari')
        and categorie = 'Manoperă cules'
        and descriere like '[AUTO_MANOPERA]%'
      )
    )
  );
create policy cheltuieli_diverse_update on public.cheltuieli_diverse for update to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_tenant_owner(tenant_id)
      or (
        public.operator_can_write('recoltari')
        and categorie = 'Manoperă cules'
        and descriere like '[AUTO_MANOPERA]%'
      )
    )
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (
      public.is_tenant_owner(tenant_id)
      or (
        public.operator_can_write('recoltari')
        and categorie = 'Manoperă cules'
        and descriere like '[AUTO_MANOPERA]%'
      )
    )
  );
create policy cheltuieli_diverse_delete on public.cheltuieli_diverse for delete to authenticated
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_tenant_owner(tenant_id)
      or (
        public.operator_can_write('recoltari')
        and categorie = 'Manoperă cules'
        and descriere like '[AUTO_MANOPERA]%'
      )
    )
  );

-- ─── Fișa parcelei: proprietarul sau operatorul cu „Scrie” pe Parcele ─────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'culturi',
    'etape_cultura',
    'culture_stage_logs',
    'solar_climate_logs',
    'stadii_fenologice_parcela',
    'configurari_parcela_sezon'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (tenant_id = public.current_tenant_id()
                     and (public.is_tenant_owner(tenant_id) or public.operator_can_write(''parcele'')))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (tenant_id = public.current_tenant_id()
                and (public.is_tenant_owner(tenant_id) or public.operator_can_write(''parcele'')))
         with check (tenant_id = public.current_tenant_id()
                     and (public.is_tenant_owner(tenant_id) or public.operator_can_write(''parcele'')))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (tenant_id = public.current_tenant_id()
                and (public.is_tenant_owner(tenant_id) or public.operator_can_write(''parcele'')))',
      t || '_delete', t);
  end loop;
end $$;

-- ─── Lucrările din afara sezonului: proprietarul sau operatorul cu „Scrie” pe Lucrări ─────────────

drop policy if exists activitati_extra_season_insert on public.activitati_extra_season;
drop policy if exists activitati_extra_season_update on public.activitati_extra_season;
drop policy if exists activitati_extra_season_delete on public.activitati_extra_season;
create policy activitati_extra_season_insert on public.activitati_extra_season for insert to authenticated
  with check (tenant_id = public.current_tenant_id()
              and (public.is_tenant_owner(tenant_id) or public.operator_can_write('activitati')));
create policy activitati_extra_season_update on public.activitati_extra_season for update to authenticated
  using (tenant_id = public.current_tenant_id()
         and (public.is_tenant_owner(tenant_id) or public.operator_can_write('activitati')))
  with check (tenant_id = public.current_tenant_id()
              and (public.is_tenant_owner(tenant_id) or public.operator_can_write('activitati')));
create policy activitati_extra_season_delete on public.activitati_extra_season for delete to authenticated
  using (tenant_id = public.current_tenant_id() and public.is_tenant_owner(tenant_id));

-- ─── Echipa: proprietarul citește; scrie doar serverul (service role) ─────────────────────────────

drop policy if exists "only owner can manage farm_members" on public.farm_members;
drop policy if exists farm_members_owner_select on public.farm_members;
create policy farm_members_owner_select on public.farm_members for select to authenticated
  using (tenant_id in (select t.id from public.tenants t where t.owner_user_id = (select auth.uid())));

drop policy if exists "only owner can manage farm_invites" on public.farm_invites;
drop policy if exists farm_invites_owner_select on public.farm_invites;
create policy farm_invites_owner_select on public.farm_invites for select to authenticated
  using (tenant_id in (select t.id from public.tenants t where t.owner_user_id = (select auth.uid())));

-- „member can read own row” pe farm_members rămâne.

notify pgrst, 'reload schema';

-- Verificarea de după aplicare (în demo, cu un operator din link fără Parcele și fără Recoltări):
--   - proprietarul: o vânzare rapidă, o cheltuială, o investiție, o cultură nouă în fișa parcelei, actele: merg;
--   - operatorul cu „Scrie” pe Recoltări: o recoltare se salvează, iar rândul „Manoperă cules” apare în Cheltuieli;
--   - același operator, prin API: `insert` în `vanzari` / `investitii` / `culturi` → 42501.
```

## 9. Ce n-am putut testa

- **Nimic în browser.** Sesiunea s-a întrerupt după prima bucată; n-am creat niciun demo, deci nu există tenant de notat și nici
  operatori ascunși de dezactivat. Toate reparațiile sunt acoperite de teste unitare.
- **Migrările**: n-au rulat pe nicio bază (regula: nu le aplic). Am verificat doar cu `select` că tabelele, coloanele și numele
  politicilor înlocuite există. Recomand aplicarea întâi pe un branch Supabase.
- **Google Contacts cap-coadă** (cere contul real al fermei cu Google).
- **Livratorul pe telefon**: doar prin test.
- **Viteza** (partea 4) și **desktopul** (partea 5): nefăcute.

## 10. Verificările

Rulate pe codul final:

| Comanda | Rezultat |
|---|---|
| `npm run lint` | 0 erori, 4 avertismente (erau 9) |
| `npm run typecheck` | trece (după ștergerea folderului local `.next/dev/types`, rămas dintr-un `npm run dev` vechi cu ruta ștearsă; nu e în git) |
| `npm run check:kit` | OK, 237 de fișiere |
| `npm run test:critical:unit` | 111 fișiere, 901 teste, toate trec (pe `main`: 103 / 848) |
| `npm run build` | trece |

`public/sw.js` nu e comis. N-am apelat niciun cron. N-am aplicat nicio migrare. N-am scris nimic în baza de date.

## 11. Commit-uri

| Hash | Ce |
|---|---|
| `469f1b4` | fix(securitate): rutele cu service role verifică ferma și proprietarul |
| `14f69a5` | feat(db): migrări neaplicate — funcții definer interne și scrieri RLS după drepturi |
| `ba339fe` | chore(kit): bannerul cu actele lipsă intră în verificarea kitului |
| `d35c0c5` | test(acte): bannerul din layout testat fără demo |
| `6c210d8` | chore(lint): 5 avertismente mecanice reparate |
| `2f7d897` | chore: 11 fișiere nefolosite șterse |
| *(acest commit)* | docs: raportul 24 |
