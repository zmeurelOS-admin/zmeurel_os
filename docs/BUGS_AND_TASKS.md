# BUGS_AND_TASKS.md — Zmeurel OS
_Last updated: 2026-03-21_

---

## Sarcini recente completate

### Task — AI Chat Widget rewrite (2026-03-21)
**Status:** ✅ DONE
**Fișiere modificate:** `src/app/api/chat/route.ts`, `src/components/ChatWidget.tsx`
**Documentație:** `docs/ai-chat-widget.md`, secțiune adăugată în `CLAUDE.md`

**Ce s-a schimbat:**
- Model: `gemini-1.5-flash` → `gemini-2.0-flash`
- Keyword detection (6 grupuri) cu query-uri paralele filtrate pe tenant
- Intent detection (open_form) pentru cheltuieli/recoltare/activitate agricolă — returnează JSON fără streaming, AI nu inserează date
- Page context per rută (parcele/comenzi/recoltari/cheltuieli/clienti/culegatori)
- Session memory din `ai_conversations` (ultimele 3 schimburi)
- Proactive alerts: parcele fără activitate 7+ zile (prima mesaj din sesiune)
- Voice input via Web Speech API ro-RO (zero dependențe noi)
- Widget redesign: buton cu logo SVG, teaser bubble, `next/image`, mic button

**SQL necesar în Supabase:**
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_messages_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_ai_usage_date date;

CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  mesaj_user text,
  raspuns_ai text,
  pathname text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own ai_conversations" ON ai_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_conversations" ON ai_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS ai_conversations_user_tenant_idx ON ai_conversations(user_id, tenant_id, created_at DESC);
NOTIFY pgrst, 'reload schema';
```

---

## Bug-uri pendinte

### Bug #1 — Parcele: Lipsă buton ștergere
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** High
**Route:** `/parcele`

**Problemă:**
Parcelele adăugate nu pot fi șterse din UI. Butonul `-` din `ParcelaCard` este doar collapse/expand, nu ștergere. Componenta `DeleteConfirmDialog` există în `src/components/parcele/DeleteConfirmDialog.tsx` și funcția `deleteParcela()` există în `src/lib/supabase/queries/parcele.ts`, dar nu sunt conectate la interfața utilizator.

**Fix aplicat:**
`ParcelaPageClient.tsx` folosea deja `CompactListCard` cu `ActionIcons` care renderiza butonul de ștergere. `DeleteConfirmDialog` era deja conectat cu verificare `getParcelaDeleteImpact`, mutație și toast. Conexiunea era deja completă.

---

### Bug #2 — FAB ➕ vizibil pe pagini admin
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Medium
**Route:** `/admin/*`

**Problemă:**
Butonul FAB verde (Floating Action Button) apare și pe `/admin/analytics` și `/admin/tenants` unde nu are sens funcțional.

**Fix aplicat:**
În `src/components/app/BottomTabBar.tsx`, funcția `shouldHideCenterAction` extinsă să returneze `true` și pentru `pathname.startsWith('/admin')`.

**Fișiere modificate:**
- `src/components/app/BottomTabBar.tsx`

---

### Bug #3 — Adaugă activitate / Adaugă recoltare: navigare în loc de dialog inline
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Medium
**Route:** `/parcele`

**Problemă:**
Nu existau butoane "Adaugă activitate" / "Adaugă recoltare" în cardul parcelei. Fix-ul le adaugă ca dialog inline cu parcela pre-selectată și disabled.

**Fix aplicat:**
1. `ParcelaCard.tsx` — adăugat secțiune "Acțiuni rapide" expand/collapse cu butoane "Adaugă activitate" și "Adaugă recoltare"; noi props `onAddActivitate`, `onAddRecoltare`
2. `AddActivitateAgricolaDialog.tsx` — adăugat props `parcelaId` și `parcelaDisabled`; selectul de teren devine disabled când `parcelaDisabled=true`
3. `AddRecoltareDialog.tsx` — adăugat props `parcelaId` și `parcelaDisabled`; Select-ul de parcelă devine disabled când `parcelaDisabled=true`
4. `ParcelaPageClient.tsx` — adăugat state `addActivitateParcelaId` și `addRecoltareParcelaId`; importuri dinamice pentru ambele dialoguri; dialoguri montate condiționat

**Fișiere modificate:**
- `src/components/parcele/ParcelaCard.tsx`
- `src/components/activitati-agricole/AddActivitateAgricolaDialog.tsx`
- `src/components/recoltari/AddRecoltareDialog.tsx`
- `src/app/(dashboard)/parcele/ParcelaPageClient.tsx`

---

### Bug #4 — Dashboard: Unități active afișate în coloană unică
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Low
**Route:** `/dashboard`

**Problemă:**
Lista "Unități active" era afișată ca single column. Fix-ul o schimbă în grid 2 coloane + detalii în AppDialog la tap.

**Fix aplicat:**
În `src/app/(dashboard)/dashboard/page.tsx`:
1. Containerul "Unități active" schimbat din `display: 'grid'` (1 col) în `className="grid grid-cols-2 gap-2"`
2. Cardurile compactate (min-height 80px, font-size redus)
3. Tap pe card deschide `AppDialog` cu detalii complete (suprafață, plante, ultima activitate, ultima recoltare) + 3 butoane: "Detalii complete", "Adaugă activitate", "Adaugă recoltare"

**Fișiere modificate:**
- `src/app/(dashboard)/dashboard/page.tsx`

---

### Bug #5 — Dashboard: Data "Ultima activitate" afișată ca ISO string raw
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Low
**Route:** `/dashboard`

**Problemă:**
Data ultimei activități era afișată cu format prescurtat (ex: "17 mar") fără an, sau ca ISO raw în alte contexte.

**Fix aplicat:**
În `src/app/(dashboard)/dashboard/page.tsx`, funcția `formatDateLabel()` extinsă cu `year: 'numeric'` în `Intl.DateTimeFormat` options, producând format "17 mar 2026".

**Fișiere modificate:**
- `src/app/(dashboard)/dashboard/page.tsx`

---

### Bug #6 — Terenuri: lipsă buton ștergere
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** High
**Route:** `/parcele`

**Problemă:**
Butonul de ștergere lipsea din lista de terenuri (Terenuri = `ParcelePageClient` din `src/components/parcele/`). `ConfirmDeleteDialog`, `deleteMutation` și `scheduleDelete` existau deja în `ParcelePageClient.tsx`, dar `ParceleList.tsx` nu accepta prop `onDelete` și nu randă buton "Șterge". Starea `deleteOpen` era prezentă dar niciodată deschisă.

**Fix aplicat:**
1. `ParceleList.tsx` — adăugat prop opțional `onDelete?: (parcela: Parcela) => void`; adăugat buton "Șterge" cu stil destructive (roșu) în secțiunea expandată de acțiuni
2. `ParcelePageClient.tsx` — pasat `onDelete` prop la `ParceleList` care setează `selectedParcela` și deschide `deleteOpen`

**Fișiere modificate:**
- `src/components/parcele/ParceleList.tsx`
- `src/components/parcele/ParcelePageClient.tsx`

---

### Bug #7 — Adaugă activitate / Adaugă recoltare din lista și detaliile unui teren navighează la modul în loc de dialog inline
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Medium
**Route:** `/parcele`, `/parcele/[id]`

**Problemă:**
1. `ParcelePageClient.tsx` — `onAddActivity` și `onAddHarvest` pasate la `ParceleList` foloseau `router.push` spre alte pagini în loc de dialog inline
2. `/parcele/[id]/page.tsx` (detalii teren) — nu exista niciun buton "Adaugă activitate" / "Adaugă recoltare"; utilizatorul era forțat să navigheze manual

**Fix aplicat:**
1. `ParcelePageClient.tsx` — adăugate state-uri `addActivitateParcelaId` și `addRecoltareParcelaId`; `onAddActivity`/`onAddHarvest` setează aceste state-uri în loc de `router.push`; adăugate dynamic imports `AddActivitateAgricolaDialog` și `AddRecoltareDialog` montate cu `parcelaId` + `parcelaDisabled`
2. `/parcele/[id]/page.tsx` — adăugate dynamic imports `AddActivitateAgricolaDialog` și `AddRecoltareDialog`; adăugate butoane "+ Activitate" și "+ Recoltare" în header-ul paginii de detalii; dialoguri montate cu `parcelaId={parcelaId}` și `parcelaDisabled`

**Fișiere modificate:**
- `src/components/parcele/ParcelePageClient.tsx`
- `src/app/(dashboard)/parcele/[id]/page.tsx`

---

### Task #8 — Redesign secțiune expandată ParcelaCard: butoane acțiuni compacte pe un singur rând
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Medium
**Route:** `/parcele`

**Problemă:**
Secțiunea expandată din `ParceleList.tsx` folosea un grid de butoane text-only cu înălțime mare (min-h-10, multiple rânduri), ocupând mult spațiu vertical.

**Fix aplicat:**
Înlocuit grid-ul de acțiuni cu un singur rând de butoane compacte (icon + label scurt), folosind `flex` cu `flex-1` pe fiecare buton:
1. **Detalii** — `Eye` icon, fond albastru (opțional, când `onOpen` e pasat)
2. **Editează** — `Pencil` icon, fond amber
3. **Activitate** — `Leaf` icon, fond emerald (deschide AddActivitateAgricolaDialog)
4. **Recoltare** — `ShoppingBasket` icon, fond sky (deschide AddRecoltareDialog)
5. **Șterge** — `Trash2` icon, fond roșu (opțional, când `onDelete` e pasat)

Secțiunea expandată e acum semnificativ mai scurtă (un singur rând de butoane, padding redus `py-2.5`). Toate callback-urile existente sunt păstrate. Min-height 44px per buton pentru touch target corect pe mobile.

De asemenea, eliminat blocul de statistici (grid 2x2) și textele "Ultima recoltare / Ultima activitate" din secțiunea expandată — info-ul e deja vizibil în card-ul colapsat (statusShort).

**Fișiere modificate:**
- `src/components/parcele/ParceleList.tsx`

---

## Task-uri noi descoperite

### Bug #10 — Navigator LockManager timeout pe mobile/PWA
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Critical
**Route:** Global (toate paginile)

**Problemă:**
Clientul Supabase browser folosea Web Locks API (Navigator LockManager) pentru sincronizarea token-ului de autentificare între tab-uri. Pe mobile/PWA cu multiple tab-uri sau service worker activ, achiziționarea lock-ului putea bloca până la 10000ms, cauzând timeout-uri și erori de autentificare.

**Fix aplicat:**
În `src/lib/supabase/client.ts`, adăugat opțiunea `lock` în `auth` config pentru a bypasa complet Web Locks API — funcția ignoră mecanismul de lock și apelează `fn()` direct:
```ts
lock: <R,>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn()
```
Fix-ul se aplică doar clientului browser (singleton). Clientul server (`server.ts`) și cel admin (`admin.ts`) nu folosesc browser APIs, nu necesitau modificare.

**Fișiere modificate:**
- `src/lib/supabase/client.ts`

---

### Bug #11 — Activități agricole: lipsă butoane Editează și Șterge
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** High
**Route:** `/activitati-agricole`

**Problemă:**
Cardurile din lista de activități agricole nu aveau butoane de editare și ștergere. Funcțiile `openEditDialog` și `openDeleteDialog` existau deja în `page.tsx` și erau complet implementate (cu state, lazy dialogs, mutații), dar erau suprimate cu `void openEditDialog` / `void openDeleteDialog` și niciodată apelate din UI.

**Fix aplicat:**
1. Eliminat liniile `void openEditDialog` și `void openDeleteDialog` care suprimau funcțiile
2. Adăugat butoane "✏️ Editează" și "🗑️ Șterge" în secțiunea `{isExpanded ? (...) : null}` a fiecărui card de activitate. Butoanele folosesc `flex: 1`, `minHeight: 40`, culori din design tokens (`yellowLight`/`coralLight`), apelează `openEditDialog(a)` și `openDeleteDialog(a)` cu `stopPropagation`.

**Fișiere modificate:**
- `src/app/(dashboard)/activitati-agricole/page.tsx`

---

### Bug #12 — Comenzi: carduri cu lățime incompletă (stats grid și butoane restânse la zona text)
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Medium
**Route:** `/comenzi`

**Problemă:**
În `ComenziPageClient.tsx`, stats grid-ul (CANTITATE / PREȚ / TOTAL / LIVRARE), butonul "canDeliver" și secțiunea expandată erau imbricate în `<div style={{ flex: 1, minWidth: 0 }}>` — div-ul de conținut text din flex row-ul `[icon | text content]`. Asta le restângea la lățimea textului (lățimea cardului minus icon minus gap), nu la lățimea întregului card.

**Fix aplicat:**
Mutat stats grid-ul și toate secțiunile ulterioare în afara div-ului `flex: 1` și în afara flex row-ului exterior, devenind frați ai flex row-ului în containerul cardului — ocupând astfel lățimea completă a cardului. Eliminat 2 `</div>` orfane din finalul funcției ComandaCard.

**Fișiere modificate:**
- `src/app/(dashboard)/comenzi/ComenziPageClient.tsx`

---

### Task #9 — Detalii teren: butoane acțiuni orizontale compacte + eliminare card duplicat "Ultima activitate"
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Medium
**Route:** `/parcele/[id]`

**Probleme:**
1. Butoanele de acțiuni din detaliile terenului (Editează / + Activitate / + Recoltare / Adaugă cultură) erau aranjate vertical pe coloana din dreapta, ocupând mult spațiu și fără touch targets mobile adecvate.
2. Exista un card "Ultima activitate" în rândul de KPI-uri de la top, care duplica informația deja prezentă în secțiunea "Activități recente" de mai jos.

**Fix aplicat:**
1. **FIX 1 — Butoane orizontale compacte:** Înlocuit coloana verticală de butoane cu un singur rând orizontal de butoane compacte (icon + label scurt), sub informațiile principale ale terenului, separate de un border-top. Același stil ca secțiunea expandată din `ParceleList.tsx`: `flex min-h-[44px] flex-1 flex-col items-center justify-center`, culori: Editează (amber), Activitate (emerald), Recoltare (sky), Cultură (violet, doar pentru solarii). Icons: `Pencil`, `Leaf`, `ShoppingBasket`, `Plus` din lucide-react.
2. **FIX 2 — Eliminat card duplicat:** Eliminat blocul condițional `{latestActivitate ? (...) : null}` cu cardul "Ultima activitate" din rândul de stats. Actualizat condiția rândului de stats să nu mai depindă de `latestActivitate`. Eliminat variabila `latestActivitate` nefolosită.

**Fișiere modificate:**
- `src/app/(dashboard)/parcele/[id]/page.tsx`

---

---

### Feature #13 — Modal onboarding la prima autentificare
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** High
**Route:** `/dashboard`

**Implementare:**
- `src/components/app/OnboardingModal.tsx` — dialog la prima intrare a unui tenant nou
- localStorage key: `zmeurel_onboarding_shown_{tenantId}` — setat la închidere indiferent de acțiune
- Buton "Da, sună-mă" → validare număr român (07xx, 10 cifre) + update `tenants.contact_phone` via `getSupabase()` browser client
- Buton "Nu acum" → închide fără salvare, setează localStorage
- Montat în `src/app/(dashboard)/dashboard/page.tsx`
- DB migration: `supabase/migrations/20260320_tenant_contact_phone.sql` (adaugă `contact_phone` și `onboarding_shown_at` pe `tenants`)

**Fișiere create/modificate:**
- `supabase/migrations/20260320_tenant_contact_phone.sql` (nou)
- `src/components/app/OnboardingModal.tsx` (nou)
- `src/app/(dashboard)/dashboard/page.tsx` (import + mount)

---

### Feature #14 — Banner feedback persistent pe dashboard
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Medium
**Route:** `/dashboard`

**Implementare:**
- `src/components/app/FeedbackBanner.tsx` — banner verde non-intruziv sub header dashboard
- Vizibil dacă: NU a dat dismiss (`zmeurel_feedback_banner_dismissed` localStorage) ȘI NU a trimis telefon (`zmeurel_phone_submitted_{tenantId}`)
- Buton "Scrie pe WhatsApp →" → deschide `https://wa.me/40752953048?...` în tab nou
- Buton X → salvează dismiss în localStorage, nu mai apare niciodată
- Montat în `src/app/(dashboard)/dashboard/page.tsx` sub `<OnboardingModal />`

**Fișiere create/modificate:**
- `src/components/app/FeedbackBanner.tsx` (nou)
- `src/app/(dashboard)/dashboard/page.tsx` (import + mount)

---

### Feature #15 — Admin tenants: coloană Telefon contact
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Low
**Route:** `/admin`

**Implementare:**
- `AdminTenantRow` extins cu `contact_phone?: string | null`
- `AdminTenantsPlanTable` — adăugat coloana "Telefon contact" (arată valoarea sau `—`)
- `src/app/(dashboard)/admin/page.tsx` — fetch suplimentar din `tenants` cu `getSupabaseAdmin()` pentru `contact_phone`, merge în rows

**Fișiere modificate:**
- `src/components/admin/AdminTenantsPlanTable.tsx`
- `src/app/(dashboard)/admin/page.tsx`

---

### Feature #16 — Dashboard: secțiune "Primii pași" pentru utilizatori noi
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Critical
**Route:** `/dashboard`

**Problemă:**
Utilizatorii noi (fără parcele, activități sau recoltări) vedeau un dashboard cu valori 0 și niciun ghidaj. `WelcomeCard` exista dar nu oferea pași concreți de pornire.

**Fix aplicat:**
În `src/app/(dashboard)/dashboard/page.tsx`:
- Adăugat variabila `showGettingStarted` (true când `coreSettled && parcele.length === 0 && activitati.length === 0 && recoltari.length === 0 && !hideOnboarding`)
- Adăugat secțiune "Primii pași" cu 3 carduri ghidate (MapPin → `/parcele`, Leaf → `/activitati-agricole`, ShoppingBasket → `/recoltari`), afișate condiționat sub `WelcomeCard`

**Fișiere modificate:**
- `src/app/(dashboard)/dashboard/page.tsx`

---

### Fix #17 — Comenzi: validare Zod schema + erori inline
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Critical
**Route:** `/comenzi`

**Problemă:**
Formularul de creare/editare comenzi folosea validare manuală cu `toast.error()` la submit, fără schema Zod și fără mesaje de eroare inline sub câmpuri.

**Fix aplicat:**
În `src/app/(dashboard)/comenzi/ComenziPageClient.tsx`:
- Adăugat `import { z } from 'zod'`
- Definit `comandaSchema` cu validări pentru `clientName`, `cantitate_kg`, `pret_per_kg`, `data_livrare`
- Adăugat tipul `ComandaValidationErrors` și funcția `validateComandaForm`
- Integrat în `ComandaDialog`: state `validationErrors`, reset la deschidere/închidere dialog, validare înainte de submit cu early return la erori, mesaje de eroare `<p className="text-xs text-red-600">` sub fiecare câmp invalid

**Fișiere modificate:**
- `src/app/(dashboard)/comenzi/ComenziPageClient.tsx`

---

### Fix #18 — Empty states specifice pe tab-uri Comenzi + Parcele detail + Stocuri
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Important
**Route:** `/comenzi`, `/parcele/[id]`, `/stocuri`

**Problemă:**
1. Tab-urile "Livrate" și "Toate" din Comenzi nu aveau mesaj empty state specific
2. Pagina de detalii parcelă nu arăta empty state când nu existau activități sau recoltări
3. Pagina Stocuri nu explica de ce stocul e gol (auto-populat din recoltări)

**Fix aplicat:**
1. `ComenziPageClient.tsx` — mesaje `title`/`description` diferite per tab activ (`activeTab === 'livrate'` / `'toate'` / default)
2. `parcele/[id]/page.tsx` — secțiunile "Activități recente" și "Recoltări recente" afișează empty state cu icon și buton de acțiune când `isFetched && length === 0`
3. `StocuriPageClient.tsx` — `<EmptyState description="Stocul se completează automat din recoltări...">` adăugat

**Fișiere modificate:**
- `src/app/(dashboard)/comenzi/ComenziPageClient.tsx`
- `src/app/(dashboard)/parcele/[id]/page.tsx`
- `src/app/(dashboard)/stocuri/StocuriPageClient.tsx`

---

### Fix #19 — `/recoltari/new` convertit în redirect la dialog inline
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Important
**Route:** `/recoltari/new`

**Problemă:**
`/recoltari/new` era un formular full-page orfan cu HTML brut (`<input>`, `<select>`, gradient roșu) inconsistent cu restul aplicației. `AddRecoltareDialog` exista deja ca dialog inline.

**Fix aplicat:**
- `src/app/(dashboard)/recoltari/new/page.tsx` — rescris ca redirect server-side: `redirect('/recoltari?addNew=true')`
- `src/app/(dashboard)/recoltari/RecoltariPageClient.tsx` — `addFromQuery` detectează acum și `?addNew=true`; efectul de cleanup șterge și parametrul `addNew` din URL

**Fișiere modificate:**
- `src/app/(dashboard)/recoltari/new/page.tsx`
- `src/app/(dashboard)/recoltari/RecoltariPageClient.tsx`

---

### Fix #20 — Vânzări: `status_plata` afișat cu badge colorat în panoul desktop
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** Minor
**Route:** `/vanzari`

**Problemă:**
Panoul `<aside>` desktop afișa `status_plata` ca string brut din baza de date (`'platit'`, `'restanta'`, `'avans'`), în loc de badge formatat ca pe mobile.

**Fix aplicat:**
În `src/app/(dashboard)/vanzari/VanzariPageClient.tsx` — înlocuit `{desktopSelectedVanzare.status_plata || '-'}` cu `<span>` colorat:
- `'platit'` → `bg-emerald-100 text-emerald-800` "Plătit"
- `'restanta'` → `bg-red-100 text-red-800` "Restanță"
- `'avans'` → `bg-amber-100 text-amber-800` "Avans"
- altele → `bg-gray-100 text-gray-700`

**Fișiere modificate:**
- `src/app/(dashboard)/vanzari/VanzariPageClient.tsx`

---

### Feature #21 — Admin: Tabel contact Beta useri
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** High
**Route:** `/admin`

**Implementare:**
- `src/components/admin/BetaUsersContactTable.tsx` (nou) — tabel client cu coloane: Nume fermă, Email, Telefon, Data înregistrării, Ultima activitate, Acțiuni (Phone / WhatsApp / "Fără telefon" badge)
- `cleanPhoneForWhatsApp(phone)` elimină non-cifre, înlocuiește 0 inițial cu 40; mesaj WA pre-encodat în română
- Sortat descrescător după `last_activity_at`
- `src/app/(dashboard)/admin/page.tsx` — extins cu query `analytics_events` pentru ultima activitate per tenant; construit `betaContactRows: BetaUserContactRow[]`; montat `<BetaUsersContactTable rows={betaContactRows} />` după tabelul de planuri

**Fișiere create/modificate:**
- `src/components/admin/BetaUsersContactTable.tsx` (nou)
- `src/app/(dashboard)/admin/page.tsx`

---

### Feature #22 — Highlight vizual pauze pesticide active
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** High
**Route:** `/activitati-agricole`, `/parcele`, `/dashboard`

**Implementare:**
- `src/lib/pause-helpers.ts` (nou) — wrappere peste `computeActivityRemainingDays`: `isPauseActive`, `getPauseRemainingDays`, `getPauseUrgency` (urgent=1-2 zile/portocaliu, active=>2 zile/roșu, none)
- `/activitati-agricole/page.tsx` — carduri tratament cu border/bg urgency-based, badge "⏳ Pauză activă — X zile rămase"
- `ParceleList.tsx` — prop opțional `activePauseByParcelaId`; border/bg roșu sau portocaliu per parcelă; badge "🚫 Pauză X zile" lângă titlu
- `ParcelePageClient.tsx` — computație `activePauseByParcelaId` via useMemo; pasat la `ParceleList`
- `/dashboard/page.tsx` — secțiune "⚠️ Atenție — Pauze pesticide active" DEASUPRA "Unități active"; `AlertCard` per parcelă afectată; ascunsă când nu există pauze

**Fișiere create/modificate:**
- `src/lib/pause-helpers.ts` (nou)
- `src/app/(dashboard)/activitati-agricole/page.tsx`
- `src/components/parcele/ParceleList.tsx`
- `src/components/parcele/ParcelePageClient.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`

---

### Feature #23 — Sheet detalii activitate pe pagina teren
**Status:** ✅ DONE: 2026-03-20
**Prioritate:** High
**Route:** `/parcele/[id]`

**Implementare:**
- `src/components/ui/sheet.tsx` (nou) — Bottom Sheet construit pe `@radix-ui/react-dialog`; variante side: bottom/top/left/right; buton X built-in; max-h-[90svh] overflow-y-auto
- `src/components/activitati-agricole/ActivityDetailSheet.tsx` (nou) — sheet cu toate câmpurile activității, banner pauză activă (roșu/portocaliu) în top, footer cu butoane Editează + Șterge; lazy-loads `EditActivitateAgricolaDialog`; `deleteMutation` cu AlertDialog confirmare + invalidare cache
- `/parcele/[id]/page.tsx` — state `selectedActivitate` + `activitySheetOpen`; tap pe card deschide Sheet; carduri cu border/bg urgency-based + badge pauză inline; `<ActivityDetailSheet>` montat înainte de `</AppShell>`

**Fișiere create/modificate:**
- `src/components/ui/sheet.tsx` (nou)
- `src/components/activitati-agricole/ActivityDetailSheet.tsx` (nou)
- `src/app/(dashboard)/parcele/[id]/page.tsx`

---

---

### Bug #24 — Dialog/Sheet de adăugare nu se închide (recoltare + activitate + comenzi + cheltuieli)
**Status:** ✅ DONE: 2026-03-21
**Prioritate:** Critical
**Route:** `/recoltari`, `/activitati-agricole`, `/comenzi`, `/cheltuieli`, toate paginile cu FAB

**Simptome:**
1. După salvare cu succes, dialogul rămânea deschis și toast-ul apărea repetat la fiecare click
2. Butonul „Anulează" nu reacționa
3. Dialogul nu putea fi închis nici manual (click afară / swipe down)
4. Reproductibil când dialogul era deschis via URL param `?add=1` (din sidebar, din FAB de pe Dashboard sau alte pagini)

**Root cause — 3 bug-uri independente:**

**Bug A: `open={addOpen || addFromQuery}` în paginile cu URL trigger**
Când utilizatorul salva și se apela `setAddOpen(false)`, `addFromQuery` rămânea `true` (URL-ul nu fusese curățat încă din cauza asincronicității). Rezultat: `addOpen || addFromQuery = false || true = true` → dialogul rămânea deschis. Orice click pe Salvează declanșa o nouă mutație și un nou toast.

**Bug B: `history.back()` fără verificarea stării history**
`dialog.tsx` apela `window.history.back()` la orice închidere de dialog dacă `addedHistoryEntryRef.current = true`, indiferent dacă entry-ul `__zmeurelDialog` mai exista în history sau fusese înlocuit de `router.replace`. Rezultat: `history.back()` naviga la `/recoltari?add=1`, `addFromQuery` devenea `true` din nou → dialog se re-deschidea automat → buclă infinită.

**Bug C: `setDialogOpen` instabilă în componentele dialog**
`setDialogOpen` era o funcție inline recreată la fiecare render. Deoarece era în deps array-ul `useEffect` din `Dialog`, la fiecare re-render al formularului (typen în câmpuri), event listener-ul `popstate` era șters și nu era re-înregistrat. Rezultat: butonul hardware back nu mai închidea dialogul după prima tastare.

**Pre-existing TypeScript error fix:**
`ActivityDetailSheet.tsx` referea `queryKeys.activitatiByParcela()` care nu există — înlocuit cu `queryKeys.activitati`.

**Fișiere verificate — componente afectate:**
- `AddRecoltareDialog.tsx` — Bug C ✓ (fix aplicat)
- `AddActivitateAgricolaDialog.tsx` — Bug C ✓ (fix aplicat)
- `AddVanzareDialog.tsx` — Bug C ✓ (fix aplicat)
- `AddVanzareButasiDialog.tsx` — Bug C ✓ (fix aplicat)
- `AddInvestitieDialog.tsx` — Bug C ✓ (fix aplicat)
- `RecoltariPageClient.tsx` — Bug A + B ✓ (fix aplicat)
- `CheltuialaPageClient.tsx` — Bug A ✓ (fix aplicat)
- `ComenziPageClient.tsx` — Bug A ✓ (fix aplicat)
- `dialog.tsx` — Bug B ✓ (fix aplicat)

**Fișiere verificate — neafectate:**
- `AddCheltuialaDialog.tsx` — folosește `onOpenChange` direct (fully controlled, fără `setDialogOpen` wrapper) ✓
- `AddClientDialog.tsx` — fully controlled ✓
- `AddCulegatorDialog.tsx` — fully controlled ✓
- `AddParcelDrawer.tsx` — fully controlled ✓
- `activitati-agricole/page.tsx` — `open={addOpen}` fără `addFromQuery`, FAB via `triggerAddAction()` ✓
- `ActivitatiAgricolePageClient.tsx` — dead code, nu e importat nicăieri

**Fix aplicat — 3 modificări:**

**Fix 1 — `src/components/ui/dialog.tsx`:**
```tsx
// Înainte:
if (addedHistoryEntryRef.current) {
  addedHistoryEntryRef.current = false
  window.history.back()
}
// După:
if (addedHistoryEntryRef.current) {
  addedHistoryEntryRef.current = false
  if (window.history.state?.__zmeurelDialog) {
    window.history.back()
  }
}
```
`history.back()` se apelează doar dacă history entry-ul curent conține `__zmeurelDialog: true`. Dacă entry-ul a fost înlocuit de `router.replace` (curățare URL), `history.back()` NU se mai apelează.

**Fix 2 — `RecoltariPageClient.tsx`, `CheltuialaPageClient.tsx`, `ComenziPageClient.tsx`:**
```tsx
// Înainte: effect-ul curăța URL dar nu seta addOpen
useEffect(() => {
  if (!addFromQuery) return
  // router.replace(...)
}, [addFromQuery, ...])
// Dialog: open={addOpen || addFromQuery}

// După: effect-ul transferă addFromQuery → addOpen
useEffect(() => {
  if (!addFromQuery) return
  setAddOpen(true)          // ← ADĂUGAT
  // router.replace(...)
}, [addFromQuery, ...])
// Dialog: open={addOpen}   // ← ELIMINAT || addFromQuery
```
`addFromQuery` transferat în `addOpen` înainte de curățarea URL-ului. Dialogul e controlat exclusiv de `addOpen`, care poate fi setat la `false` de `setAddOpen(false)`.

**Fix 3 — `AddRecoltareDialog.tsx`, `AddActivitateAgricolaDialog.tsx`, `AddVanzareDialog.tsx`, `AddVanzareButasiDialog.tsx`, `AddInvestitieDialog.tsx`:**
```tsx
// Înainte:
const setDialogOpen = (nextOpen: boolean) => { ... }
// După:
const setDialogOpen = useCallback((nextOpen: boolean) => { ... }, [isControlled, onOpenChange])
```
`setDialogOpen` stabilizat cu `useCallback`. `onOpenChange = setAddOpen` (din `useState`) este stabil → `setDialogOpen` rămâne stabil → event listener-ul `popstate` din `Dialog` nu mai e șters la re-renderele formularului.

**Fișiere modificate:**
- `src/components/ui/dialog.tsx`
- `src/app/(dashboard)/recoltari/RecoltariPageClient.tsx`
- `src/app/(dashboard)/cheltuieli/CheltuialaPageClient.tsx`
- `src/app/(dashboard)/comenzi/ComenziPageClient.tsx`
- `src/components/recoltari/AddRecoltareDialog.tsx`
- `src/components/activitati-agricole/AddActivitateAgricolaDialog.tsx`
- `src/components/vanzari/AddVanzareDialog.tsx`
- `src/components/vanzari-butasi/AddVanzareButasiDialog.tsx`
- `src/components/investitii/AddInvestitieDialog.tsx`
- `src/components/activitati-agricole/ActivityDetailSheet.tsx` (fix pre-existing TS error: `queryKeys.activitatiByParcela` → `queryKeys.activitati`)

---

---

### Fix #25 — Formular Adaugă teren: simplificat (eliminare Tip cultură / Soi plantat / An plantare / Culturi în solar)
**Status:** ✅ DONE: 2026-03-21
**Prioritate:** High
**Route:** `/parcele`

**Problemă:**
Formularul `AddParcelDrawer` (și `EditParcelDialog`) conținea câmpuri redundante care complicau adăugarea unui teren nou: Tip cultură, Soi plantat, An plantare, și întreaga secțiune "Culturi în solar" (Cultură, Soi, Nr. plante per rând, butoane Șterge/+ Adaugă cultură). Aceste câmpuri blocau salvarea dacă nu erau completate (validare Zod `min(1)`).

**Fix aplicat:**
1. `ParcelForm.tsx` — eliminat câmpurile Tip cultură (cu logica de select/custom crop), Soi plantat (cu logica de select/custom variety), An plantare, secțiunea "Date solar" cu crop_rows. Păstrate: Tip unitate, Nume teren, Suprafață (m²), Status, Stadiu, Observații.
2. Schema Zod (`parcelFormSchema`) — `tip_fruct` și `an_plantare` devin `z.string()` (fără `min(1)`, fără `.refine()`). Eliminat importuri neutilizate (`useQuery`, `Controller`, `useFieldArray`, `Input`, `UnitateTip`, `queryKeys`, `getCropVarietiesForCrop`, `getCropsForUnitType`).
3. `AddParcelDrawer.tsx` — eliminat logica `getNormalizedCropRows`, `ensureCropForUnitType`, `ensureCropVarietyForCrop`, `buildParcelaObservatii`. Mutația `createParcela` trimite doar câmpurile de bază + `an_plantare: new Date().getFullYear()` (valoare default, câmp obligatoriu în DB).
4. `EditParcelDialog.tsx` — eliminat logica `getNormalizedCropRows`, `ensureCropForUnitType`, `ensureCropVarietyForCrop`, `buildParcelaObservatii`, `getParcelaCropRows`, `stripHiddenAgricultureMetadata`. Mutația `updateParcela` trimite doar câmpurile de bază.

**Fișiere modificate:**
- `src/components/parcele/ParcelForm.tsx`
- `src/components/parcele/AddParcelDrawer.tsx`
- `src/components/parcele/EditParcelDialog.tsx`

---

### Bug #26 — Terenuri/Parcele nu apar la navigare (cache staleTime + refetchOnMount)
**Status:** ✅ DONE: 2026-03-21
**Prioritate:** High
**Route:** `/parcele`

**Problemă:**
Datele existente din DB nu apăreau în UI la prima navigare pe pagina de terenuri. Datele apăreau doar după o mutație (ex: adăugare teren nou) care triggera un refetch. Cauza: `refetchOnMount: false` (setată global în `providers.tsx`) și `staleTime: 30000` pe query-ul principal.

**Fix aplicat:**
Adăugat `refetchOnMount: true` explicit pe query-ul `queryKeys.parcele` din `ParcelePageClient.tsx`. Aceasta suprascrie default-ul global și garantează că datele sunt reîncărcate la fiecare navigare.

**Fișiere modificate:**
- `src/components/parcele/ParcelePageClient.tsx`

---

### Feature #27 — Pagina detalii solar: secțiune Culturi cu dialog Adaugă cultură
**Status:** ✅ DONE: 2026-03-21
**Prioritate:** High
**Route:** `/parcele/[id]`

**Implementare:**
Pagina de detalii a unui solar nu afișa culturile din tabela `culturi`. A fost adăugată o secțiune "Culturi în solar" vizibilă doar pentru unități de tip `solar`.

1. `query-keys.ts` — adăugat `culturi: (solarId: string) => ['culturi', solarId]` pentru query key distinct per solar.
2. `/parcele/[id]/page.tsx` — adăugat import `getCulturiForSolar`, import dinamic `AddCulturaDialog`, state `addCulturaOpen`, query `culturiQuery` cu `refetchOnMount: true`. Secțiunea "Culturi în solar" afișează lista culturilor (tip plantă, soi, nr. plante, badge Activă/Desființată) și butonul "+ Adaugă cultură" care deschide `AddCulturaDialog`. La `onCreated`, se invalidează `queryKeys.culturi(parcelaId)`.
3. Culturile sunt filtrate strict pe `solar_id` al solarului curent — nu pot apărea culturi de la alte solarii.

**Fișiere modificate:**
- `src/lib/query-keys.ts`
- `src/app/(dashboard)/parcele/[id]/page.tsx`

---

## Legendă
- **OPEN** — neprelucrat
- **IN PROGRESS** — în lucru
- ✅ **DONE: YYYY-MM-DD** — rezolvat
