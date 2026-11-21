# Raport: Promptul 22, corecturi adunate (rulare de noapte)

Branch: `redesign/corecturi-noapte` (din `main` `32c0522`), cu push după fiecare bucată. Fără merge.
**O migrare nouă, neaplicată.** Aplicația merge și fără ea (detalii la „Migrarea”).
Din baza de date am citit doar cu `select`: `pg_get_functiondef` pentru `create_ajustare_stoc` și `set_comanda_delivered`,
coloanele lui `ajustari_stoc`, indexurile pe `client_sync_id`, coloanele probate de `schema-features`, cheile străine spre
`tenants`, și numărătorile de la testele din demo. Testele pe ecran le-am făcut într-un cont demo nou
(`/start` → „Continuă fără cont” → „Fructe de pădure”), pe build de producție local (`next build` + `next start`), la 375×812.

## Pe scurt

1. **Idempotență**: ajustările de stoc, vânzarea rapidă și „Din mesaj” trimit acum cheia formularului. Pentru ajustări e
   nevoie de migrarea de mai jos; până atunci formularul se poartă ca înainte.
2. **Stocul vechi din Stocuri avea două cauze.** Prima e cea din prompt (chei diferite). A doua era mai mare:
   `refetchOnMount: false`, pus pe toată aplicația, făcea ca o pagină închisă în momentul schimbării să arate date vechi
   la revenire, până la 10 minute. Am reprodus-o în demo (252 kg pe ecran, 251 kg în realitate) și am reparat-o.
3. **Acasă**: de la **69 de cereri la 21** (22 la prima deschidere pe un browser nou). Fără RPC nou, fără migrare.
4. **Trei lucruri cer decizia ta** (nu le-am atins):
   - antetele puse de `proxy.ts` nu ajung la layout: `tenantId`, numele fermei, rolul de operator și drepturile lui vin
     `null` în browser (secțiunea 3.4);
   - chatul AI nu are niciun buton de deschidere în aplicația de acum (secțiunea 5);
   - testul foii „Din mesaj” nu rula deloc din cauza unui model greșit în configul vitest; l-am reparat (secțiunea 1c).

## 1. Idempotență (`client_sync_id`)

### a) Ajustările de stoc (commit `2ca1b69`)

- Migrarea `supabase/migrations/20261121190000_ajustari_stoc_client_sync_id.sql` (SQL complet la final):
  coloana `client_sync_id uuid null`, indexul unic parțial pe `(tenant_id, client_sync_id)`, iar `create_ajustare_stoc`
  primește `p_client_sync_id uuid default null`. Varianta veche (4 parametri) se șterge în aceeași migrare.
- Am pornit de la definiția din producție, citită cu `pg_get_functiondef`. E identică cu cea din
  `20260711100000_unified_order_stock_phase2.sql`. Am adăugat două lucruri: căutarea după cheie, imediat după lacătul
  de stoc, și coloana nouă la inserare. Verificările au rămas (sesiune, tenant, proprietar sau operator cu scriere pe
  `comenzi`, tipul, semnul, „nu sub 0”, `SECURITY DEFINER`, `search_path`).
- Promptul spune „fără o a doua mișcare în `miscari_stoc`”. Funcția nu scrie în `miscari_stoc`, nici în producție, nici
  în migrare: disponibilul se calculează din `ajustari_stoc`. „O singură ajustare” înseamnă deci un singur rând acolo.
- Aplicația: `AjustareStocForm` trimite `form.clientSyncId`; `createAjustareStoc` îl pune în `p_client_sync_id`.
  **Fără migrare**, PostgREST răspunde `PGRST202` (funcția nu are parametrul), iar salvarea pleacă din nou, fără cheie,
  ca înainte. Rezultatul se ține minte pe sesiune, deci a doua ajustare nu mai încearcă cu cheia. N-am adăugat o
  verificare în `schema-features`, ca să nu apară o cerere în plus la fiecare deschidere.
- Garda din memorie a formularului (o cheie salvată nu mai pleacă a doua oară) a rămas, pentru perioada fără migrare.
- `src/types/supabase.ts`: coloana și parametrul, adăugate de mână.
- Test: `src/lib/supabase/queries/__tests__/ajustari-stoc-cheie.test.ts` (aceeași cheie de două ori → un rând; chei
  diferite → două; fără migrare → salvează fără cheie; `23505` pe cheie → recitește rândul; altă eroare rămâne eroare).

### b) Vânzarea rapidă (commit `2d4a919`)

- `saveVanzareRapida` primește `clientSyncId` și îl trimite ca `client_sync_id` pe comanda „La poartă”. Coloana și
  indexul există în producție (`comenzi_tenant_client_sync_id_uq`, verificat).
- `createComanda` caută deja rândul după cheie înainte de inserare și tratează `23505` ca reușită. Vânzarea rapidă
  continuă de acolo: comanda găsită deja livrată → se întoarce vânzarea ei; nelivrată, cu alte cifre → se aduce la zi
  și se livrează.
- **Vânzarea** o scrie serverul, în `set_comanda_delivered`, cu `gen_random_uuid()` drept cheie. N-am schimbat
  RPC-ul: o comandă are o singură vânzare (`linked_vanzare_id`), iar o comandă deja livrată întoarce vânzarea
  existentă. Cheia comenzii o acoperă deci și pe ea.
- Teste noi în `src/lib/vanzari/__tests__/vanzare-rapida.test.ts` (aceeași cheie de două ori, cu răspunsul primei
  cereri pierdut → o comandă, o vânzare).

### c) „Din mesaj” (commit `d7fc64d`)

- Comanda propusă și clientul nou din mesaj primesc câte o cheie. Cheile sunt aceleași cât e deschisă foaia, pentru
  același mesaj, și la reîncercare. Alt mesaj înseamnă altă comandă, deci alte chei. La închidere se golesc.
- Teste noi în `ComenziDinMesajSheet.test.tsx` (reîncercare → un client, o comandă; foaie redeschisă → altă cheie).
- **Găsit în trecere:** modelul `src/app/(dashboard)/comenzi/__tests__/*.test.tsx` din `vitest.critical.config.ts` nu
  potrivea nimic, fiindcă parantezele erau citite ca grup. Testul foii „Din mesaj” nu rula deloc. L-am scris
  `src/app/[(]dashboard[)]/…`; cele 9 teste vechi trec. Am trecut regula și în `CLAUDE.md`.

## 2. Stocul se reîmprospătează peste tot

### Helper-ul (commit `31fdf66`)

- `invalidateStock(queryClient)` și lista `STOCK_QUERY_KEYS`, în `src/lib/query-keys.ts`: `stocGlobal`,
  `stocGlobalCal1`, `ajustariStoc`, `stocuriLocatiiRoot` (acoperă și `stocuriLocatii(...)`), `miscariStoc`,
  `comenziStockSummaryAzi`, `dashboard`. Altă cheie care să citească stocul n-am găsit.
- Peste el: `invalidateDupaRecoltare` (`src/lib/recoltari/invalidate.ts`: + `recoltari`, `cheltuieli`) și
  `invalidateDupaComanda` (`src/components/comenzi/useComandaActions.ts`: + `comenzi`, `comenziManualInLivrare`,
  `vanzari`).

| Unde se schimbă stocul | Ce cheamă acum |
|---|---|
| Recoltare creată sau modificată (`RecoltareStepForm`) | `invalidateDupaRecoltare` |
| Recoltare ștearsă (`useRecoltareDeleteWithUndo`) | `invalidateDupaRecoltare` |
| Comandă creată sau modificată (`ComandaStepForm`, „Din mesaj”) | `invalidateDupaComanda` |
| Livrare, încasare, redeschidere, ștergere (`useComandaActions`) | `invalidateDupaComanda` |
| „Pune în livrare azi” (`PuneInLivrareSheet`) | `invalidateDupaComanda` |
| „Livrează și copiază” (`StopSheet`) | `invalidateDupaComanda` |
| Vânzare rapidă (`VanzareRapidaForm`, și la eroare) | `invalidateDupaComanda` |
| Ajustare de stoc (`AjustareStocForm`) | `invalidateStock` |
| Chatul AI: recoltare | `invalidateDupaRecoltare` (înainte: fără `stocGlobalCal1`, `ajustariStoc`, `comenziStockSummaryAzi`) |
| Chatul AI: comandă | `invalidateDupaComanda` (înainte: doar `comenzi`, `dashboard`, `clienti`) |

- Coada offline din `syncEngine` nu mai există în cod (`src/lib/offline` are doar `generateClientId.ts`), deci acolo
  nu e nimic de schimbat.
- Material săditor și Asociația n-au fost atinse.
- Test: `src/lib/recoltari/__tests__/invalidate.test.ts` (helper-ul invalidează lista completă; la fel cele două de
  deasupra lui).

### A doua cauză: `refetchOnMount: false` (commit `dba2444`)

- `invalidateQueries` reîncarcă doar interogările de pe ecran. Pe celelalte doar le marchează. Cu `refetchOnMount: false`
  pus pe toată aplicația (`providers.tsx`), marcajul era ignorat la redeschiderea paginii: se arătau datele din memorie.
- **Reprodus în demo, înainte de reparație:** Stocuri 252 kg → Vânzări → vânzare rapidă de 1 kg („Rămas în stoc: 251 kg”)
  → înapoi în Stocuri, prin meniu: **252 kg**, cu „Livrat − 70 kg”. Cheia corectă fusese invalidată.
- **Reparația:** `refetchOnMount: (query) => query.state.isInvalidated`. O pagină redeschisă arată tot datele din
  memorie, fără altă cerere, în afară de cazul în care interogarea a fost invalidată între timp. Setările stau acum în
  `src/lib/query-defaults.ts`.
- **După reparație, același drum:** Stocuri 251 kg → vânzare de 1 kg → înapoi în Stocuri: **250 kg**, „Livrat − 72 kg”.
- Urmarea e pe toată aplicația, nu doar la stoc: orice listă schimbată din altă pagină se reîncarcă la revenire.
  Numărul de cereri la o deschidere obișnuită nu crește.
- Test: `src/lib/__tests__/query-defaults.test.ts`.

## 3. Acasă mai rapidă

### 3.1 Cifrele

Măsurat cu `performance.getEntriesByType('resource')`, filtrat pe `supabase.co`, la încărcarea `/dashboard`, cont demo nou.

| Tip de cerere | Înainte | După, prima deschidere pe un browser | După, următoarele |
|---|---:|---:|---:|
| `auth/v1/user` (cine sunt) | 15 | 0 | 0 |
| `farm_members` (sunt operator?) | 13 | 1 | 1 |
| `tenants` (ferma mea) | 13 | 1 | 1 |
| verificări de structură (`schema-features`) | 8 | 1 | 0 |
| `profiles.tenant_id` (pentru meteo) | 1 | 0 | 0 |
| `profiles` (preferințele paginii) | 1 | 1 | 1 |
| `analytics_events` (două evenimente scrise) | 2 | 2 | 2 |
| date: `recoltari`, `parcele`, `comenzi`, `vanzari`, `vanzari_butasi`, `cheltuieli_diverse`, `produse`, `aplicari_tratament`, `tenant_settings`, `culturi`, stocul (RPC), `activitati_agricole` ×2, `shop_orders` ×2 | 15 | 15 | 15 |
| meteo (funcția `fetch-meteo`) | 1 | 1 | 1 |
| **Total** | **69** | **22** | **21** |

Cifrele de pe ecran sunt aceleași înainte și după: 189 kg de livrat azi · 6 comenzi; stocul cal. 1; pauza la Maravilla
până luni 23.11; „6 comenzi de pus în livrare”; „Recoltarea de azi: nenotată”; sezonul 2026: 540 kg recoltat. Stocul și
încasările s-au mișcat doar cu testele mele (258 → 250 kg; 1.971 → 2.181 lei).

### 3.2 Timpul

- **Înainte** (mod dev): cererile de date veneau în cascadă, pe ~3,0 s. Fiecare interogare aștepta întâi cele trei
  cereri de rezolvare a tenantului, iar o parte așteptau și verificările de structură.
- **După** (build de producție local): toate cererile de date pleacă deodată. De la prima la ultima: ~0,65–0,8 s.
  Ultimul răspuns de date a venit la **1,96 s** de la navigare (2,10 s cu meteo); pagina HTML sosise la 0,78 s.
- **Ce n-am putut măsura cum trebuie:** panoul de browser era în fundal pe toată durata rulării, iar acolo pagina nu
  desenează cadre singură (am forțat cadrele cu capturi de ecran). Cifra de 1,96 s include întârzierea asta. Pe un
  telefon real, pe Vercel, n-am măsurat. Te rog să te uiți tu o dată pe telefon.

### 3.3 Ce am făcut

1. **Tenantul se rezolvă o singură dată** (commit `8f10d5f`). `getTenantId` făcea trei cereri înaintea fiecărei
   interogări. Acum, în browser, utilizatorul vine din sesiunea locală (`getSession`, fără rețea), iar tenantul se ține
   în modul: pe utilizator, cel mult 10 minute, golit la delogare și la acceptarea invitației. Întrebările „sunt
   operator?” și „am fermă?” pleacă deodată. Un „fără tenant” sau o eroare nu se țin minte. **Pe server nu se ține
   nimic.** Securitatea e aceeași: accesul îl hotărăște RLS, nu `tenant_id`-ul trimis de client.
   Test: `src/lib/tenant/__tests__/tenant-cache.test.ts`.
2. **Structura bazei de date se verifică o dată pe browser** (commit `5d0b2a8`). Cele 8 coloane probate există toate
   în producție (verificat). Ce s-a găsit rămâne în `localStorage`; ce lipsește se caută întâi printr-o singură cerere
   (coloanele cerute prin `tenants`, fiecare tabel având o singură legătură spre el), apoi, doar dacă aceea nu trece,
   pe rând. Test: `src/lib/__tests__/schema-features-cache.test.ts`.
3. **Analytics și meteo** (commit `f89a8fa`). Evenimentele iau utilizatorul din sesiunea locală. Meteo nu mai citește
   `profiles`: funcția își ia singură tenantul din profil, iar cel din corp era doar comparat cu acela.
4. **RPC agregat: n-a fost nevoie.** Ținta s-a atins din primii trei pași ai promptului, deci nu există migrare pentru Acasă.

### 3.4 De hotărât: antetele din `proxy.ts` nu ajung la layout

- `proxy.ts` creează răspunsul (`NextResponse.next({ request: { headers } })`) la început și abia apoi pune
  `x-zmeurel-user-id`, `x-zmeurel-tenant-id`, `x-zmeurel-member-role`, `x-zmeurel-member-modules`,
  `x-zmeurel-access-*`. Next copiază antetele în răspuns în momentul creării (`handleMiddlewareField`), deci ce se
  adaugă după aceea nu mai pleacă spre pagină.
- **Verificat local, în dev și în build de producție**, pe contul demo: layout-ul primește
  `"tenantId":null,"farmName":null,"memberRole":null,"memberAccess":[],"accessLevel":null`. Pe Vercel n-am putut
  verifica, dar codul Next e același.
- **Ce înseamnă azi:** layout-ul cheamă `auth.getUser()` a doua oară la fiecare pagină; `DashboardAuthContext` nu știe
  ferma, numele ei, dacă e aprobată la asociație, nici că utilizatorul e operator. Deci un operator vede în aplicație
  butoanele și meniul proprietarului (serverul și RLS îl opresc la scriere), iar bannerul cu actele lipsă nu apare
  niciodată. Raportul 21 a notat că bannerul și operatorul real n-au putut fi testate; aceasta e probabil cauza.
- **De ce nu l-am reparat:** reparația e de trei rânduri, dar pornește dintr-odată lucruri care n-au rulat niciodată
  în producție și atinge zonele pe care mi-ai spus să nu le ating (Asociația, Admin, desktopul). Cere un test cu un
  operator real și cu o fermă de asociație.
- **Reparația propusă**, la sfârșitul lui `proxy()`, în locul lui `return supabaseResponse`:

  ```ts
  const response = NextResponse.next({ request: { headers: requestHeaders } })
  supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
  return response
  ```

- **Ce câștigă Acasă după ea:** `Providers` dă deja tenantul primit de la server funcțiilor de query
  (`primeTenantIdCache`), deci ar dispărea și ultimele două cereri de rezolvare: 19 cereri, respectiv 20 la prima deschidere.

## 4. Resturile din rapoartele 15–21

### Reparate acum

| Ce | Commit |
|---|---|
| **Ecranul de final după „Salvează fără bon”** (Cheltuieli și Investiții, același formular). Nu era făcut: spunea „fără bon” doar pe ramura fără internet. După o urcare picată și „Salvează fără bon” arăta doar „Ambalaje · 12,50 lei”. Acum: „… · fără bon. Poza o adaugi din „Editează”.” Test în `src/lib/__tests__/bonuri.test.ts`. | `b3a9473` |
| Sugestiile chatului AI apar și pe `/lucrari` și `/tratamente` (aveau doar cheia veche `/activitati-agricole`). | `b9fa039` |
| Vânzarea rapidă și „Din mesaj” fără cheie (raportul 17), ajustările fără cheie (raportul 19). | secțiunea 1 |

### Rămase, cu recomandare

| Ce | Recomandare |
|---|---|
| Antetele din proxy (3.4) | Prompt separat, cu test pe un operator real. |
| Chatul AI fără buton de deschidere (secțiunea 5) | Hotărăște unde stă butonul (Acasă? Mai mult?). |
| `?edit=<id>` din chat nu deschide cheltuiala (`raport-noapte.md:489`) | Mic, dar are sens abia după ce chatul se poate deschide. |
| `server-only` e importat, dar lipsește din `package.json` | Merge și așa (îl rezolvă Next). De adăugat când mai umbli la dependențe. |
| Fișierele din `bonuri` rămase fără rând (`raport-poza-bon.md:107`) | Un cron de curățenie; cere decizie. |
| Datoriile mai vechi de 30 de zile nu mai dau notificări (`raport-notificari-zilnice.md:115`) | Decizie de produs. |
| „Șterge datele fermei” folosește `/api/farm/reset`, nu `gdpr/farm` (`raport-setari.md:41`) | Decizie. |
| Plata culegătorilor în Rapoarte vine doar din `valoare_munca_lei` (`raport-stocuri-produse-rapoarte.md:83`) | Decizie de produs. |
| „Cine” la Lucrări: operatorul nu vede lista echipei (`raport-parcele-lucrari.md:246`) | Decizie. |
| Parcele: stadiile se socotesc pe an calendaristic (`parcela-stadii.ts`), restul pe sezon | De confirmat dacă e intenționat. |
| Cash / Transfer se salvează la fel; „Livrate azi” după `updated_at`; ora de la „N-a răspuns” stă în `localStorage` (`raport-noapte.md:190–192`) | Fiecare cere o coloană nouă, deci o migrare. |
| Push pentru comenzile prioritare la 07:00 și 18:00 (`raport-noapte.md:115`) | Nefăcut; decizie. |
| `clienti.whatsapp_b2b_message` nu apare în nicio migrare și nici în tipurile din producție (`raport-noapte.md:379`) | Salvarea din importul de clienți pică probabil. Cere migrare. |
| Migrarea `20261121090000_revoke_trigger_functions.sql`, marcată neaplicată în fișier | De verificat dacă ai aplicat-o. |
| `DEMO_CLEANUP_MODE=sterge` în Vercel | Din cod nu se vede. Fără ea, curățarea demo-urilor doar numără. |
| Tipurile `src/types/supabase.ts` | De regenerat după ce aplici migrarea de aici. |
| Cele 8 verificări din `schema-features` | Toate coloanele există în producție. Se pot scoate, cu tot cu ramurile „fără coloană”. Nu mai costă nimic la încărcare, deci nu e grabă. |
| Livrări nu are teste de componentă | Prioritate, nu reparație. |
| Widgetul beta desfăcut acoperă butonul de jos (`raport-noapte.md:139`) | De văzut pe telefon înainte de orice schimbare. |

N-am atins: istoricul de etape al culturilor din solar, Asociația, Material săditor, desktopul, `/start`, Login, Admin.

## 5. Teste în contul demo

| Test | Rezultat |
|---|---|
| Ajustare de stoc, dublu-click pe „Salvează” (Pierdere, 2 kg) | **Un singur rând** în `ajustari_stoc` (`select count(*)` = 1, `−2,00`). Stocul 258 → 256, „Pierdere − 2 kg” în listă. În rețea: cererea cu cheie → 404 (`PGRST202`, fără migrare), apoi aceeași fără cheie → 200. |
| Vânzare rapidă reîncercată (3 kg; am lăsat cererea `POST comenzi` să ajungă la server și am aruncat răspunsul) | Formularul a arătat „Nu s-a salvat”. La a doua apăsare **n-a mai plecat niciun `POST comenzi`**: comanda a fost găsită după cheie și livrată. În bază: o comandă cu acea cheie, `livrata / 3.00`, o vânzare. |
| Stocuri după o schimbare făcută din altă pagină | Înainte 252 kg (greșit), după 250 kg (corect). Vezi secțiunea 2. |
| Acasă: numărul de cereri și cifrele | Vezi secțiunea 3. |

### Ce n-am putut testa

- **Recoltarea din chatul AI → Stocuri.** Chatul nu se poate deschide: `openAiPanel` și `setAiPanelOpen` nu sunt
  chemate de nicăieri (doar `AiPanel` și `DashboardShellSlots` citesc starea). Butonul (`src/components/ui/AiFab.tsx`)
  a fost șters în commit-ul `c7963d6`, din 4 aprilie 2026. Am acoperit drumul prin test (`invalidateDupaRecoltare`
  invalidează tot ce citește Stocuri) și prin testul de pe ecran cu vânzarea, care trece prin același helper.
- **Idempotența ajustărilor pe server** (aceeași cheie de două ori, cu răspunsul pierdut): netestată până la aplicarea
  migrării. Fără migrare, acest caz rar face încă două ajustări, ca înainte.
- **Clientul nou din „Din mesaj”** și reîncercarea lui: doar prin teste (extragerea cere apel la modelul AI).
- **Timpul de încărcare pe telefon real**: vezi 3.2.
- „Creează-ți ferma →” din bannerul demo rămâne blocat în browserul de test (așteaptă dezabonarea de la push), ca în
  raportul 19. Am ieșit din demo-ul vechi trimițând formularul direct.

## 6. Verificări

Rulate pe codul final:

| Comandă | Rezultat |
|---|---|
| `npm run lint` | 0 erori, 9 avertismente vechi (variabile nefolosite, în fișiere neatinse) |
| `npm run typecheck` | trece |
| `npm run check:kit` | OK, 235 de fișiere, fără abateri |
| `npm run test:critical:unit` | 99 de fișiere, 809 teste, toate trec (pe `main`: 94 de fișiere; +4 fișiere noi și testul „Din mesaj”, care acum rulează) |
| `npm run build` | trece |

`public/sw.js` nu e comis. N-am apelat niciun cron. N-am aplicat nicio migrare. În bază am scris doar prin aplicație,
în contul demo (o ajustare, patru vânzări rapide).

## 7. Migrarea

**Una singură:** `supabase/migrations/20261121190000_ajustari_stoc_client_sync_id.sql`. Nu depinde de altă migrare.

**Merge aplicația fără ea? Da.** O poți aplica înainte sau după merge:

- cod nou, fără migrare: prima ajustare din sesiune face o cerere în plus (cea cu cheie, respinsă), apoi totul merge ca înainte;
- cod vechi, cu migrare: merge, fiindcă parametrul nou are valoare implicită;
- după migrare regenerează tipurile.

```sql
-- Cheia de idempotență (`client_sync_id`) pentru ajustările de stoc.
--
-- NEAPLICATĂ: o rulează Andrei, după merge. Independentă de celelalte migrări.
--
-- De ce: „Ajustează stocul” se ferea de dublură doar în memoria formularului. Dacă răspunsul se pierdea pe
-- drum (rețea slabă) și omul apăsa din nou „Salvează” după o reîncărcare, ajustarea se scria a doua oară.
-- Cu cheia: a doua cerere cu aceeași cheie primește rândul deja scris, fără altă ajustare.
--
-- Ce face:
--   1. `ajustari_stoc.client_sync_id uuid null` (rândurile existente rămân `null`, fără update);
--   2. index unic PARȚIAL pe `(tenant_id, client_sync_id) where client_sync_id is not null`
--      (aceeași formă ca la comenzi / clienți / culegători / investiții, migrarea 20261121140000);
--   3. `create_ajustare_stoc` primește `p_client_sync_id uuid default null`. Corpul e cel din producție
--      (citit cu `pg_get_functiondef` pe 21.11.2026), cu două adaosuri: căutarea după cheie, imediat după
--      lacătul de stoc, și coloana nouă la inserare. Verificările rămân: sesiune, tenant, drepturi
--      (proprietar sau operator cu scriere pe `comenzi`), tipul, semnul, „nu sub 0”.
--      Funcția nu scrie în `miscari_stoc` (nici înainte, nici acum): disponibilul e derivat din
--      `ajustari_stoc`, deci „o singură ajustare” înseamnă un singur rând aici.
--
-- Semnătura se schimbă (4 → 5 parametri), deci varianta veche se șterge aici, ca să nu rămână două
-- overload-uri (PostgREST n-ar ști pe care s-o aleagă). Aplicația veche, care trimite 4 parametri cu nume,
-- merge mai departe pe varianta nouă: al cincilea are valoare implicită.
--
-- Aditivă pentru date: o coloană nulă și un index. Se poate rula de două ori.
--
-- Anulare:
--   drop function if exists public.create_ajustare_stoc(text, numeric, text, date, uuid);
--   (se recreează varianta cu 4 parametri din 20260711100000_unified_order_stock_phase2.sql, cu grant-urile ei)
--   drop index if exists public.ajustari_stoc_tenant_client_sync_id_uq;
--   (coloana poate rămâne.)

alter table public.ajustari_stoc add column if not exists client_sync_id uuid null;

create unique index if not exists ajustari_stoc_tenant_client_sync_id_uq
  on public.ajustari_stoc (tenant_id, client_sync_id)
  where client_sync_id is not null;

comment on column public.ajustari_stoc.client_sync_id is
  'Cheia de idempotență a formularului (aceeași la reîncercare). create_ajustare_stoc întoarce rândul existent pentru o cheie deja scrisă.';

drop function if exists public.create_ajustare_stoc(text, numeric, text, date);

create or replace function public.create_ajustare_stoc(
  p_tip text,
  p_delta_kg numeric,
  p_motiv text default null,
  p_data date default null,
  p_client_sync_id uuid default null
)
returns public.ajustari_stoc
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_delta numeric := round(coalesce(p_delta_kg, 0)::numeric, 2);
  v_summary record;
  v_available numeric;
  v_row public.ajustari_stoc;
begin
  if v_user_id is null then
    raise exception 'Neautorizat';
  end if;

  select public.current_tenant_id()
  into v_tenant_id;

  if v_tenant_id is null then
    raise exception 'Tenant invalid pentru utilizatorul curent.';
  end if;

  if not (public.is_tenant_owner(v_tenant_id) or public.operator_can_write('comenzi')) then
    raise exception 'forbidden_read_only';
  end if;

  if p_tip is null or p_tip not in ('congelat', 'procesat', 'pierdere', 'consum_propriu', 'corectie_plus', 'corectie_minus', 'altul') then
    raise exception 'Tip ajustare invalid.';
  end if;

  if v_delta = 0 then
    raise exception 'Cantitatea ajustării trebuie să fie diferită de 0.';
  end if;

  if p_tip = 'corectie_plus' and v_delta <= 0 then
    raise exception 'Ajustarea de tip corectie_plus trebuie să aibă cantitate pozitivă.';
  end if;

  if p_tip <> 'corectie_plus' and v_delta >= 0 then
    raise exception 'Ajustarea de tip % este o scădere: cantitatea trebuie să fie negativă.', p_tip;
  end if;

  perform pg_advisory_xact_lock(hashtext('stock-mutation'), hashtext(v_tenant_id::text));

  -- Reîncercarea aceleiași salvări: ajustarea există deja, o întoarcem pe ea. Căutarea e după lacăt (două
  -- cereri simultane cu aceeași cheie se așază la rând) și înainte de „nu sub 0” (prima a scăzut deja stocul).
  if p_client_sync_id is not null then
    select *
    into v_row
    from public.ajustari_stoc
    where tenant_id = v_tenant_id
      and client_sync_id = p_client_sync_id;

    if found then
      return v_row;
    end if;
  end if;

  if v_delta < 0 then
    select *
    into v_summary
    from public.get_sellable_cal1_stock_summary(v_tenant_id);

    v_available := round(coalesce(v_summary.disponibil_cal1_kg, 0)::numeric, 2);

    if v_available + v_delta < 0 then
      raise exception 'STOC_INSUFICIENT'
        using
          detail = format('necesar=%s;disponibil=%s', abs(v_delta), v_available),
          errcode = 'P0001';
    end if;
  end if;

  insert into public.ajustari_stoc (
    tenant_id,
    data,
    delta_kg,
    tip,
    motiv,
    created_by,
    client_sync_id
  )
  values (
    v_tenant_id,
    coalesce(p_data, public.bucharest_today()),
    v_delta,
    p_tip,
    nullif(btrim(coalesce(p_motiv, '')), ''),
    v_user_id,
    p_client_sync_id
  )
  returning *
  into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_ajustare_stoc(text, numeric, text, date, uuid) from public;
revoke all on function public.create_ajustare_stoc(text, numeric, text, date, uuid) from anon;
grant execute on function public.create_ajustare_stoc(text, numeric, text, date, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
```

## 8. Commit-uri

| Commit | Ce |
|---|---|
| `2ca1b69` | feat(stocuri): cheie de idempotență la ajustările de stoc (migrare + RPC cu `p_client_sync_id`) |
| `2d4a919` | feat(vanzari): vânzarea rapidă trimite cheia formularului pe comanda „La poartă” |
| `d7fc64d` | feat(comenzi): „Din mesaj” salvează cu chei stabile; modelul de test cu `(dashboard)` reparat |
| `31fdf66` | fix(stoc): un singur helper, `invalidateStock` |
| `8f10d5f` | perf(acasa): tenantul se rezolvă o singură dată în browser |
| `5d0b2a8` | perf(acasa): structura bazei de date se verifică o dată pe browser, într-o singură cerere |
| `f89a8fa` | perf(acasa): analytics și meteo fără cereri în plus |
| `dba2444` | fix(stoc): o interogare invalidată se reîncarcă la redeschiderea paginii; `CLAUDE.md` |
| `b3a9473` | fix(cheltuieli): ecranul de final spune „fără bon” și după „Salvează fără bon” |
| `b9fa039` | fix(ai): sugestiile chatului și pe `/lucrari` și `/tratamente` |
| *(acest commit)* | raportul |
