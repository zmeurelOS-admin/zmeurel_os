# Raportul nopții — 19 → 20 noiembrie 2026 (prompt 08)

Stare: **în lucru**. Se actualizează la finalul fiecărui modul. Nimic nu e mergeuit în `main`, niciun PR deschis.
Nimic scris în baza de date din cod: migrarea e doar un fișier.

## 1. Ordinea merge-urilor

Lanț de branch-uri; fiecare pornește din vârful celui dinainte, deci merge-urile se fac pe rând, `--ff-only`.

| # | Modul | Branch | Ultimul commit | Stare |
|---|---|---|---|---|
| 1 | Comenzi (+ migrarea comună, + prețul standard) | `redesign/comenzi` | vezi `git log -1 origin/redesign/comenzi` | **gata, împins** |
| 2 | Livrări | `redesign/livrari` | vezi `git log -1 origin/redesign/livrari` | **gata, împins** |
| 3 | Acasă (telefon) | `redesign/acasa` | vezi `git log -1 origin/redesign/acasa` | **gata, împins** |
| 4 | Clienți + Culegători + Setări | `redesign/clienti-culegatori` | — | neînceput |
| 5 | Cheltuieli + Investiții + Vânzări | `redesign/cheltuieli-vanzari` | — | neînceput |

Preview: `https://zmeurel-git-redesign-<x>-zmeurelos-admins-projects.vercel.app` (`<x>` = numele de după `redesign/`).

## 2. Migrarea de aprobat

**Fișier:** `supabase/migrations/20261120090000_redesign_noapte.sql`. **Neaplicată.** Doar `alter table … add column if not exists`, valori implicite și `check`-uri pe coloanele noi. Fără `update`, `delete`, backfill, `drop`, redenumiri sau indexuri unice. Se poate rula de două ori. Politicile RLS nu se schimbă.

| Tabel | Coloane noi | Ce se aprinde după rulare |
|---|---|---|
| `comenzi` | `prioritara boolean not null default false` | Comutatorul „Prioritară” din formular și din foaia comenzii, steagul pe card, bannerul „N prioritare azi”, bifarea implicită în „Pune în livrare azi”. |
| `clienti` | `latitudine`, `longitudine` (cu `check` pe intervale), `locatie_salvata_la`, `locatie_precizie_m` | Locațiile clienților în Livrări (modulul 2). |
| `vanzari` | `suma_incasata_partial_lei numeric(12,2)` (`check >= 0`), `data_incasare_partiala date` | „A dat doar o parte…” (modulele 2 și 5). |
| `tenant_settings` | `pret_standard_inceput_lei_kg`, `pret_standard_varf_lei_kg`, `pret_standard_mediu_lei_kg`, `pret_standard_perioada` | Setări › Preț standard (modulul 4). Până atunci prețul standard e 35 lei/kg, ca acum. |
| `tenant_settings` | `acasa_perioada_mod`, `extrasezon_inceput_la`, `extrasezon_amanat_pana`, `extrasezon_intrebare_din`, `acasa_extrasezon_afiseaza` | Setări › Ce arată Acasă și cardul „Începem extrasezonul?” (modulele 3 și 4). |

**Cum merge codul cu și fără migrare.** `src/lib/schema-features.ts` face, o dată pe sesiune, câte un `select('<coloană>').limit(1)` pe grup. Eroarea `42703` sau `PGRST204` înseamnă „lipsește”; orice altă eroare reia verificarea. Coloanele noi nu se cer și nu se trimit cât lipsesc.

**De știut:**

- Până la rulare, consola arată 5 cereri cu răspuns 400 la prima pagină deschisă într-o sesiune (verificările). Dispar după migrare.
- **După migrare: regenerați `src/types/supabase.ts`.** Coloanele noi au fost adăugate de mână, nullable.
- `tenant_settings` are `unique (tenant_id)` (migrarea `2026033004`), deci scrierea folosește `upsert` pe `tenant_id`. Politicile din acea migrare folosesc `current_setting('app.current_tenant_id')`; n-am putut verifica din cod că scrierea trece de RLS în producție. Pagina Setări scrie deja acolo `latitudine_default` cu `upsert`, deci probabil merge. **De verificat la prima salvare a prețului standard.**

## 3. Modulul 1 — Comenzi (`redesign/comenzi`)

### Ce e gata

- **Pagina pe zile.** Sus „Azi de livrat” și „Mâine” (kg, comenzi, lei). Segmente Azi / Mâine / Mai târziu / Fără dată. Card nou pe kit: client, localitate, kg, sumă, status, plată, „Din magazin”, „N-a răspuns”, steagul „Prioritară”. Pe „Azi” stau și restanțele (cu eticheta „Restantă · data”) și comenzile deja în livrare.
- **„Comandă nouă”** (56 px), fix deasupra barei de jos, în locul butonului plutitor. „Din mesaj” e sus, lângă ⋯.
- **Formularul în 2 pași**, cu salvare din pasul 2:
  - pasul 1: căutare după nume sau telefon, clienții recenți, „Client nou” (nume + telefon) în pas;
  - pasul 2: plăci 2 / 3 / 4 / 5 / 6 / 8 / 10 kg + „Alta” (`KgField` + tastatura din aplicație), nimic preselectat; Azi / Mâine / Poimâine / Altă zi / Fără dată; adresa din fișa clientului; prețul; nota; „Prioritară” (doar cu coloana);
  - fără câmp de avans; editarea e același formular; închiderea cu ceva nesalvat cere confirmare.
- **Foaia unei comenzi** (atingerea cardului): detalii, Sună, WhatsApp și toate acțiunile.
- **„Pune în livrare azi (n)”**: listă bifabilă, prioritarele sus și bifate, „Rămas în stoc” scade la fiecare bifă, comanda care nu încape e blocată cu „Nu ajunge stocul: lipsesc X kg”, avertizare dacă prioritarele singure depășesc stocul. `STOC_INSUFICIENT` de la server: trimiterea se oprește, spune câte au plecat și reîncarcă stocul.
- **Prețul standard:** `src/lib/pret-standard.ts` → `{ inceput, varf, mediu, perioada, activ, configurabil }`, rezerva 35.
- **Deschidere prin URL:** `?add=1`, `?openForm=1&…` (chatul AI), `?client=<id>&nou=1` (direct la pasul 2), `?edit=<id>`. Legăturile vechi `?filter=…` aleg segmentul potrivit.
- **Campania a ieșit din aplicație** (lista e mai jos).
- `check:kit` acoperă `src/app/(dashboard)/comenzi`, `src/components/comenzi`, `src/lib/comenzi`.

### Ce am ales singur

1. **Ziua livrării se alege și ea** (nimic preselectat, ca la cantitate). „Fără dată” e o alegere explicită. Butonul „Salvează” e inactiv până sunt alese cantitatea și ziua.
2. **Prețul negociat se aplică oricărui client care îl are completat**, nu doar patiseriilor și magazinelor. Un client vechi de tip „persoană” cu preț negociat nu trece dintr-odată pe prețul standard.
3. **„Cadou” și „Consum propriu”** (existau în formularul vechi) s-au mutat în alegerea prețului: Vânzare / Cadou / Consum propriu. Consumul propriu scade din stoc imediat, ca înainte.
4. **Telefonul e opțional la „Client nou”.** Dacă numărul există deja la un client, formularul îl propune pe acela. Asta ține locul dialogului vechi „Telefon folosit de alt client”.
5. **Statusul afișat vine din zi, nu din câmpul `status`:** „Programată”, „Nouă · fără dată”, „Restantă · 5 nov.”, „În livrare”. În baza de date nu s-a schimbat nimic: comenzile noi se salvează tot cu `confirmata`.
6. **„Mai târziu” și „Fără dată” nu au contor în segment**, ca etichetele să încapă la 390 px. Numărul apare deasupra listei.
7. **Căutarea și comenzile livrate, neîncasate și anulate** sunt în meniul ⋯ → o listă cu căutare și pastile (Toate / Active / Livrate / Neîncasate / Anulate), câte 40.
8. **O comandă nouă are mereu client din fișă** (ales sau creat în pas). Numele „scris de mână” rămâne doar la comenzile vechi și la cele din magazin.
9. **Ruta `/api/shop/campaign/[slug]/admin` a fost ștearsă:** o folosea doar pagina de campanie. Ruta publică `/api/shop/campaign/[slug]` (magazinul) e neatinsă.

### Ce am mutat și ce am scos

| Înainte | Acum |
|---|---|
| Fereastra de detalii + foaia de editare separată | Foaia comenzii; „Editează” deschide formularul pe pași. |
| Reprogramarea de pe card | Foaia comenzii → „Mută” (calendar sau „Fără dată”). |
| „Livrată” direct de pe card, cu cantitate și plată | Foaia comenzii → „Am livrat-o deja”. |
| „Marchează încasat”, „Redeschide”, „Șterge” | Foaia comenzii. Ștergerea, anularea și redeschiderea cer confirmare în aceeași foaie. |
| Schimbarea statusului din listă | „Pune în livrare”, „Scoate din livrare”, „Anulează comanda” în foaie. |
| Fereastra „Salvează contactul” după livrare | Foaia comenzii: „Salvează în Clienți” (comenzile fără client) și „Salvează contactul în telefon”. |
| Notificarea „Salvează clientul în telefon” după salvare | Buton pe ecranul „Comandă salvată”. |
| Butonul plutitor cu două opțiuni | „Comandă nouă” (buton mare) și „Din mesaj” (sus). |

**Scoase:**

- sortările (dată plasare, localitate / zonă, cantitate, total) și filele „De livrat / Programate / Livrate / Toate”: locul lor l-au luat zilele și arhiva din ⋯;
- cardul „recoltat azi / necesar azi / disponibil”: au rămas „Azi de livrat” și stocul de la „Pune în livrare azi”;
- gruparea „același checkout din magazin” din fereastra de detalii.

**Campanie — ce am șters (doar cod):**

- `src/app/(dashboard)/comenzi/campanie/` (`page.tsx`, `CampaniePageClient.tsx`, `loading.tsx`);
- `src/app/api/shop/campaign/[slug]/admin/` (ruta și testul ei);
- `src/lib/shop/campaign-admin-queries.ts` și testul lui;
- `src/components/comenzi/ComenziSectionPills.tsx`, `src/app/(dashboard)/comenzi/ComenziSpeedDial.tsx`;
- butoanele „Deschide campania de comenzi” din pagina Comenzi.

**Campanie — ce a rămas (neatins):**

- în baza de date: `shop_campaigns`, `shop_campaign_milestones`, `shop_campaign_milestone_rewards`, vederea `campaign_leaderboard`, `campaign_id` pe comenzile magazinului și funcțiile care îl primesc;
- magazinul public: `src/app/comanda/` (`CampaignMeter`, `CampaignMilestones`, `CampaignRules`, `SeasonLeaderboard`), `/api/shop/campaign/[slug]`, `/api/shop/b2c/order`, `/api/shop/b2c/check-recent-order`, `src/lib/shop/campaign-mock.ts`;
- regula de cache pentru `/api/shop/campaign/` din `next.config`.

Comenzile venite din campanie apar ca orice comandă.

**Alte fișiere șterse:** `ViewComandaDialog`, `ComandaFormSummary`, `lib/comenzi/magazin-groups.ts` (rămăseseră fără importuri), testul vechi `ComenziPageClient.test.tsx` (testa pagina dinainte).

### Ce așteaptă migrarea

- Tot ce ține de „Prioritară”.
- Prețul standard pe perioade (până atunci 35 lei/kg).

### Ce n-am terminat și de ce

- **Notificările push pentru prioritare** (07:00 și 18:00): în afara nopții, conform promptului.
- **Test de componentă pentru pagina nouă.** Există teste pentru logică (`lib/comenzi/__tests__/day-view.test.ts`, 21 de teste; `lib/__tests__/redesign-settings.test.ts`, 16 teste) și testul „Din mesaj” (trece neschimbat). Pagina, formularul și foile au fost verificate doar în browser.
- **`UnifiedOrderCard`, `EditOrderSheet`, `PaymentStatusToggle`** au rămas în `src/components/comenzi` doar pe acest branch (le folosea Livrări). Sunt șterse pe `redesign/livrari`.
- **Mesajele WhatsApp cu text** („am primit comanda”, „va fi livrată la adresa…”), care înainte se deschideau la schimbarea statusului, lipsesc pe acest branch. Revin pe `redesign/livrari`, ca butoane în foaia comenzii și în meniul opririi.
- **Ramurile de eroare** (`STOC_INSUFICIENT` la trimiterea în livrare, salvare fără internet) nu au fost provocate în browser.

### Verificare

- `typecheck`, `check:kit` (59 de fișiere), `build`: trec. `lint`: aceleași 2 erori vechi, în fișiere neatinse (`analytics-magazin/page.tsx`, `ui/app-date-picker.tsx`).
- `test:critical:unit`: 326 din 328. Cele două picate sunt expirările cunoscute din `integrations/google`; rulate singure: 19 din 19.
- Local (Chromium, `next dev --webpack`), cont demo creat prin `/start`, 390×844:
  - pagina, noapte și zi: nimic nu iese din cadru; toate țintele din pagină au cel puțin 48 px (singura mai mică e clopoțelul din antetul comun, 36 px);
  - comandă nouă cap-coadă (client → 5 kg → Mâine → „Comandă salvată”): salvată o singură dată, apare pe „Mâine”;
  - pasul 2: tot conținutul și „Salvează comanda” (56 px) se văd fără derulare;
  - „Alta”: tastatura (taste de 60 px) și butonul se văd fără derulare;
  - „Pune în livrare azi”: o comandă bifată și trimisă; stocul a scăzut din 339 în 315 kg, comanda a devenit „În livrare”;
  - foaia unei comenzi și editarea (valorile salvate apar în formular);
  - `?openForm=1&client_label=…&cantitate_kg=7.5&data_livrare=…`: adresa se curăță, formularul pornește cu numele în căutare și cu 7,5 kg și ziua puse.
- Desktop 1280 px: pagina se încarcă, coloană centrată. Atât.
- **Neverificat local:** foile pe „zi” (doar pagina), „Din mesaj” cu un mesaj real (cere cheia AI), mutarea pe altă zi, livrarea directă, anularea, redeschiderea, ștergerea, „Client nou”, `?client=<id>&nou=1`, `?edit=<id>`.

### De știut

- **`npm run dev` (Turbopack) întoarce 404 pe `/start` și `/login` pe această mașină**; `/` merge. Cu `next dev --webpack` totul merge. Nu vine din schimbările de azi (rutele acelea nu au fost atinse). Am adăugat configurația `dev-webpack` în `.claude/launch.json` (fișier local, necomis).
- Cardul „beta” deschis acoperă butonul fix de jos până e închis (cunoscut de la Recoltări).

### De verificat pe telefon — Comenzi

Preview: `https://zmeurel-git-redesign-comenzi-zmeurelos-admins-projects.vercel.app/comenzi`. **Salvările doar în cont demo.**

| # | Unde | Ce verificați |
|---|---|---|
| 1 | Pagina, zi și noapte | Cele două carduri de sus, segmentele (toate patru etichetele se citesc întregi), cardurile de comandă. |
| 2 | „Comandă nouă” → un client recent | Trece direct la detalii. Nimic nu e preselectat; „Salvează” e inactiv până alegeți cantitatea și ziua. |
| 3 | Pasul 2 → „Alta” | Tastatura din aplicație; tastatura telefonului NU se deschide. „Folosește X kg” vă întoarce cu cantitatea pusă. |
| 4 | Pasul 2 → „Altă zi” | Calendarul; zilele trecute nu se pot alege. |
| 5 | Pasul 2 → Preț → „Schimbă” | Vânzare / Cadou / Consum propriu; „Standard: 35 lei/kg”. La o patiserie apare și „Negociat”. |
| 6 | Pasul 1 → „Client nou”, cu numărul unui client existent | Apare „Numărul e deja la …” cu „Folosește clientul existent”. |
| 7 | Cu ceva completat → X sau „înapoi” pe Android | „Renunți la comandă?”. „Continuă” păstrează tot. |
| 8 | „Salvează comanda” apăsat de două ori repede | O singură comandă. |
| 9 | Un card → foaia comenzii | Detaliile, Sună, WhatsApp. „Editează” deschide formularul cu valorile salvate. |
| 10 | Foaia → „Mută” | O zi sau „Fără dată”; comanda trece în segmentul potrivit. |
| 11 | „Pune în livrare azi (n)” | „Rămas în stoc” scade la fiecare bifă; o comandă mai mare decât restul e blocată, cu motivul scris. „Trimite în Livrări” le mută. |
| 12 | Foaia unei comenzi în livrare → „Scoate din livrare” | Revine în listă ca „Programată”. |
| 13 | ⋯ → „Neîncasate”, „Livrate”, „Caută o comandă” | Lista cu pastile și căutare; „Înapoi la zile”. |
| 14 | „Din mesaj” cu un mesaj lipit | Extrage datele și creează comanda, ca înainte. |
| 15 | Chatul AI → o comandă dictată | Formularul se deschide cu datele puse. |
| 16 | `/comenzi/campanie` scris de mână | Pagină inexistentă (404). |

## 4. Modulul 2 — Livrări (`redesign/livrari`)

### Ce e gata

- **Ecranul din mașină.** Sus progresul: „x din y livrate”, kg rămase, lei de încasat. **Următoarea oprire** mare: numărul pe traseu, client, adresă, cantitate, suma de încasat, nota, „N-a răspuns” cu ora, apoi **Sună / Navighează / Livrat** (56 px). Sub ea, restul opririlor numerotate; cele livrate azi, strânse într-un rând care se deschide.
- **Confirmarea livrării** (foaie de jos): Cash / Transfer / Nu a plătit; suma încasată precompletată cu totalul; livrare parțială (restul rămâne într-o comandă nouă, ca înainte); „Da, livrat”. Folosește `set_comanda_delivered`, neschimbat.
- **După apel.** „Sună” pornește apelul; la întoarcerea în aplicație apare „Cum a fost apelul?”: „A răspuns, merg” / „Nu a răspuns” (cu „Mut-o la finalul traseului”, pornit) / „Mută pe altă zi” (Mâine / Poimâine / Altă dată + notă). Aceleași acțiuni sunt în meniul opririi („Mai multe pentru această oprire” sau atingerea unei opriri din listă).
- **Păstrate:** „N-a răspuns” (`last_call_status`), „Copiază pentru livrarea următoare” (`deliver_and_clone_comanda`), scoaterea din traseu înapoi la Comenzi, editarea (deschide formularul din Comenzi), anunțul pe WhatsApp cu textul de dinainte.
- **Navigare.** Google Maps implicit; Waze pentru o singură oprire, din „Setările traseului” (ținut minte pe telefon). „Pornește în Maps” trimite câte 9 opriri, apoi următoarele 9. „Navighează” e inactiv, cu „fără locație încă”, cât clientul n-are locație.
- **Aranjarea traseului:** săgeți mari sus / jos pe fiecare oprire; ordinea se salvează în `ordine_livrare` (aceeași pe orice telefon).
- **Optimizarea:** `POST /api/livrari/optimizeaza` apelează OpenRouteService (Vroom) doar de pe server. Fără cheie întoarce 503, iar ecranul spune „Optimizarea nu e configurată încă”.
- Tema coral (`zmeurel-orders.module.css`) a dispărut cu totul; Livrări are zi și noapte din tokeni.

### Ce așteaptă migrarea sau cheia ORS

| Ce | De ce depinde | Până atunci |
|---|---|---|
| „Salvează locația de aici”, precizia afișată, „Livrezi aici și de acum?” | coloanele de locație din `clienti` | Comutatorul nu apare; aplicația nu cere locația telefonului. |
| „Navighează” și „Pornește în Maps” | locațiile salvate | Inactive, cu motivul scris. Rămâne „Caută adresa pe hartă” în meniul opririi. |
| „A dat X lei, rest Y lei” | coloanele de plată parțială din `vanzari` | O sumă mai mică decât totalul trece vânzarea ca neîncasată, simplu. |
| Optimizarea traseului | locațiile **și** `ORS_API_KEY` în Vercel | Butonul e inactiv, cu motivul scris; se aranjează cu săgețile. |

**Cheia ORS.** Variabila `ORS_API_KEY` (cheie HeiGIT / OpenRouteService), pusă doar în mediul de server din Vercel. Adresa serviciului e `https://api.heigit.org/vroom/v0`: vechiul `api.openrouteservice.org/optimization` a fost retras în 2026 ([anunțul](https://ask.openrouteservice.org/t/deprecating-api-openrouteservice-org-in-favour-of-api-heigit-org/7912)). Se poate schimba cu `ORS_OPTIMIZATION_URL`, fără cod nou. **Apelul real nu a fost încercat** (nu am cheie): e verificat doar cu teste pe un serviciu simulat. La primul traseu optimizat, dacă apare „Serviciul de rutare nu a răspuns”, primul lucru de verificat e adresa.

### Ce am ales singur

1. **Cash și Transfer se salvează la fel** (vânzare încasată). Nu există o coloană pentru felul plății și nu era în migrare. Alegerea e pe ecran, cum s-a decis, dar azi nu se păstrează nicăieri. **De hotărât:** o coloană nouă sau două opțiuni în loc de trei.
2. **„Livrate azi” se numără după ultima modificare a comenzii** (`updated_at`), fiindcă nu există o coloană cu momentul livrării. O comandă livrată ieri și modificată azi ar apărea la azi.
3. **Ora de la „N-a răspuns” se ține pe telefon** (`localStorage`), nu în baza de date: există doar marcajul, fără oră. Pe alt telefon apare „N-a răspuns”, fără oră.
4. **„Caută adresa pe hartă”** în meniul opririi, când clientul nu are locație dar comanda are adresă. Deschide căutarea în Google Maps, nu navigarea la punct fix. „Navighează” rămâne inactiv, cum s-a decis.
5. **Telefonul din fișa clientului** e folosit când comanda nu are unul scris (și în Comenzi). Comenzile demo, de exemplu, nu au telefon pe comandă.
6. **Mesajele WhatsApp cu text** nu se mai deschid singure la schimbarea statusului (cu „Pune în livrare azi” ar fi fost câte o fereastră pe comandă). Sunt butoane: „Confirmă comanda pe WhatsApp” / „Anunță livrarea pe WhatsApp” în foaia comenzii și în meniul opririi. Textele sunt cele vechi.
7. **Traseul nu se optimizează sub două opriri cu locație**, iar opririle fără locație rămân la final, în ordinea lor.
8. **Comenzile de azi care nu sunt încă în livrare** apar ca o notă cu legătură spre Comenzi, nu ca listă desfăcută.
9. **Aranjarea traseului** e o vedere a paginii (nu o foaie), cu „Gata”. Tragerea cu degetul a fost scoasă: au rămas săgețile.

### Ce am mutat și ce am scos

| Înainte | Acum |
|---|---|
| Card cu toate butoanele pe el (`UnifiedOrderCard`) | Următoarea oprire mare + meniul opririi. |
| Fereastră de confirmare cu „Livrat parțial →” | Foaia „Confirmi livrarea?”, cu „Livrare parțială” ca comutator. |
| „Reordonează” prin tragere | „Aranjează traseul” cu săgeți. |
| „Retrimite la comenzi” | „Scoate din traseu (înapoi la Comenzi)” în meniul opririi. |
| Schimbarea datei de pe card | „Mută pe altă zi” (comanda devine „Programată” și iese din traseu). |
| Foaia de editare din Livrări | „Editează comanda” deschide formularul din Comenzi (`/comenzi?edit=<id>`). |
| Butonul de reîncărcare din antet | „Setările traseului” → „Reîncarcă livrările”. |
| Insigna „✅ Livrate N” (toate, de când lumea) | „x din y livrate” azi. |

**Șterse:** `UnifiedOrderCard`, `EditOrderSheet`, `PaymentStatusToggle` (cu testele lor), testul paginii vechi, `lib/livrari/types.ts` (fără importuri), `styles/zmeurel-orders.module.css`.

### Ce n-am terminat și de ce

- **Apelul real către OpenRouteService** și **tot ce ține de locații** nu au putut fi încercate: lipsesc coloanele și cheia. Logica lor e acoperită de teste (`lib/livrari/__tests__/route.test.ts`, 14 teste; `api/livrari/__tests__/optimizeaza.test.ts`, 9 teste).
- **„Cum a fost apelul?”** depinde de întoarcerea în aplicație după un apel real; în browserul de desktop nu se poate provoca.
- **Test de componentă** pentru pagină și pentru foaia opririi: nu există; verificate doar în browser.

### Verificare

- `typecheck`, `check:kit` (68 de fișiere), `build`: trec. `lint`: aceleași 2 erori vechi.
- `test:critical:unit`: 349 din 351; cele două picate sunt expirările cunoscute din `integrations/google`.
- Local, cont demo, 390×844, **pe noapte**:
  - ecranul principal: nimic nu iese din cadru; toate țintele au cel puțin 48 px; „Livrat” are 56 px;
  - meniul opririi: toate acțiunile prezente, „Navighează” inactiv cu motivul scris;
  - confirmarea livrării: suma precompletată (456 lei); cu 400 lei scris apare „Mai puțin decât totalul: vânzarea se trece ca neîncasată”; după „Da, livrat”: „5 din 5”, „Traseul e gata”;
  - aranjarea: săgeata „mai jos” a mutat prima oprire pe locul 2;
  - `POST /api/livrari/optimizeaza` fără cheie: 503 `ORS_NOT_CONFIGURED`.
- **Neverificat local:** tema de zi (doar noaptea), desktopul, „Mută pe altă zi”, „Copiază pentru livrarea următoare”, „Nu a răspuns”, livrarea parțială, „Pornește în Maps”, Waze.

### De verificat pe telefon — Livrări

Preview: `https://zmeurel-git-redesign-livrari-zmeurelos-admins-projects.vercel.app/livrari`. **Livrările de probă doar în cont demo.**

| # | Unde | Ce verificați |
|---|---|---|
| 1 | Seara, în mașină, pe „Noapte” | Suma de încasat și adresa se citesc dintr-o privire; butoanele se nimeresc fără să vă uitați lung. |
| 2 | „Sună” → vorbiți → vă întoarceți în aplicație | Apare „Cum a fost apelul?”. |
| 3 | „Nu a răspuns”, cu „Mut-o la finalul traseului” pornit | Oprirea coboară ultima și are eticheta „N-a răspuns · ora”. |
| 4 | „Mută pe altă zi” → Mâine, cu o notă | Comanda dispare din traseu și apare în Comenzi, la Mâine, cu nota. |
| 5 | „Livrat” → „Da, livrat” | Oprirea trece la livrate; următoarea devine oprirea mare. |
| 6 | „Livrat” cu o sumă mai mică decât totalul | Vânzarea apare ca neîncasată (în Comenzi → ⋯ → Neîncasate). |
| 7 | „Livrat” → „Livrare parțială” | Restul apare ca o comandă nouă în Comenzi. |
| 8 | Meniul opririi → „Copiază pentru livrarea următoare” | Comanda de azi e livrată, iar una nouă apare la ziua aleasă. |
| 9 | „Aranjează traseul” | Săgețile mută opririle; „Gata”; ordinea rămâne și după reîncărcare. |
| 10 | „Setările traseului” → Waze | „Navighează” deschide Waze (după migrare, la un client cu locație). |
| 11 | Android, o foaie deschisă → „înapoi” | Se închide foaia, nu se schimbă pagina. |
| 12 | **După migrare:** „Da, livrat” la un client fără locație | Comutatorul „Salvează locația de aici” e pornit și arată precizia. După salvare, „Navighează” devine activ. |
| 13 | **După migrare:** livrare la peste 150 m de locația salvată | „Livrezi aici și de acum?” → „Da, actualizează” / „Nu, doar de data asta”. |
| 14 | **După migrare și cheie:** „Aranjează traseul” → „Optimizează traseul” | Opririle se așază pe drum, pornind de unde sunteți; cele fără locație rămân la final. |

## 5. Modulul 3 — Acasă (`redesign/acasa`)

### Ce e gata

- **Pe telefon (sub 768 px)**, Acasă e nouă, pe kit. **Pe desktop, grila editabilă e neschimbată**: în `dashboard/page.tsx` s-a înlocuit doar blocul de telefon.
- **Antet:** „Acasă” și data (din CSS, corect de la prima randare), pastila perioadei („Sezon · zmeură” / „Extrasezon · butași și lucrări”), vremea pe scurt în dreapta: temperatura și o singură notă (ploaie sau vânt în sezon; îngheț sau brumă în extrasezon).
- **Sezon:** „De livrat azi” (kg, comenzi, câte prioritare) lângă „În stoc, calitatea 1”; banda „Lipsesc X kg — notează recoltarea sau mută comenzi” când stocul nu acoperă ce nu e încă în livrare; „De făcut azi”: ⚠ „Nu recolta: parcelă” (pauză după tratament, cu zilele rămase), livrări în drum, comenzi de pus în livrare, recoltarea de azi (nenotată / notată, cu kg), tratamente de făcut (cu fereastra meteo de stropit); jos „Sezonul <an>, până azi”: recoltat și încasat.
- **Extrasezon:** „Butași de livrat săpt. asta” (buc, comenzi, prima dată) lângă „Rest de încasat” (lei, vânzări); banda „De pregătit” pe soiuri; avertizarea de îngheț; „De făcut”: comenzi de butași de pregătit, încasări restante, comenzi de fructe încă deschise, lucrări planificate (din Activități, cu dată în viitor), tratamente; jos „Sezonul <an> încheiat” și „Detalii în Rapoarte”.
- **Fiecare rând și fiecare card duce în modulul lui.**
- **Perioada:** sezonul începe la prima recoltare din an; extrasezonul doar după „Da, începem”. Cardul „Începem extrasezonul?” apare din 25 octombrie; „Mai am de cules” îl amână 7 zile („Bine. Te întreb din nou pe …”).
- **Scoase de pe telefon:** scurtăturile „Intră direct în fluxuri”, recomandările generice, „Recente”, instantaneul comercial, „pulsul fermei”, cardul financiar. „Adaugă widget” era deja doar pe desktop. Componentele lor rămân: le folosește desktopul.

### Ce am ales singur

1. **„Rest de încasat” vine din Vânzări** (fructe), aceeași socoteală ca „Neîncasat” din Vânzări și Clienți (`src/lib/vanzari/incasari.ts`). Avansurile de la butași nu intră aici.
2. **Nu există stoc de butași în baza de date.** Banda arată ce e **de pregătit pe soiuri** (din comenzile de butași deschise), nu stocul rămas.
3. **„Săptămâna asta” ține până duminică** și cuprinde și comenzile de butași rămase din urmă (data trecută, nelivrate).
4. **Lipsa de stoc se judecă pe comenzile care nu sunt încă în livrare**: cele din livrare au deja kilogramele puse deoparte.
5. **Tratamentele „de făcut”** sunt parcelele pe care motorul existent al dashboardului le marchează „în curând” sau „întârziat”. Nu am scris alt calcul.
6. **„Sezonul, pe scurt”** numără de la 1 ianuarie: recoltat (toate calitățile) și încasat din fructe, pe data încasării.
7. **Vântul** se semnalează de la 6 m/s (~22 km/h); **bruma** de la minima de 3° pentru mâine, **înghețul** de la 0°.
8. **Onboardingul** („Bun venit”) și starea de încărcare au rămas cele ale paginii.

### De știut: o eroare veche, găsită în trecere

Pagina veche Vânzări socotește **„neplatit” ca încasat**: verifică dacă statusul *conține* „platit”. O livrare cu „Nu a plătit” apare acolo, azi, ca încasată. Socoteala nouă potrivește statusul exact. **Pe acest branch pagina Vânzări e încă cea veche**; se repară la modulul 5. Acasă folosește deja socoteala corectă.

### Ce așteaptă migrarea

- **Cardul „Începem extrasezonul?”**, amânarea și forțarea perioadei din Setări.
- Până atunci: **Sezon dacă există o recoltare în anul curent și e înainte de 1 noiembrie, altfel Extrasezon**, fără întrebare. Azi (19 noiembrie) Acasă arată Extrasezon.

### Ce n-am terminat și de ce

- **Vederea de sezon nu a putut fi văzută în browser:** fără migrare, după 1 noiembrie perioada e mereu extrasezon. E acoperită de teste (`lib/__tests__/acasa.test.ts`, 17 teste, din care 8 pentru perioadă).
- **Cardul de întrebare** și cele două răspunsuri: doar în teste (logica) și în cod (scrierea); cer migrarea.
- Pagina încarcă în continuare toate datele dashboardului și pe telefon (inclusiv cele folosite doar de desktop). Nu am separat încărcările, ca să nu ating desktopul.

### Verificare

- `typecheck`, `check:kit` (69 de fișiere), `build`: trec. `lint`: aceleași 2 erori vechi. `test:critical:unit`: 366 din 368 (aceleași două expirări Google).
- Local, cont demo, 390×844, ziua: extrasezon cu date reale (rest de încasat 456 lei dintr-o vânzare, 6 comenzi de fructe deschise, două lucrări planificate, sezonul pe scurt). Nimic nu iese din cadru; toate țintele din pagină au cel puțin 48 px.
- **Neverificat local:** noaptea, vederea de sezon, desktopul (nu a fost atins, dar nici deschis după schimbare).

### De verificat pe telefon — Acasă

Preview: `https://zmeurel-git-redesign-acasa-zmeurelos-admins-projects.vercel.app/dashboard`.

| # | Unde | Ce verificați |
|---|---|---|
| 1 | Acasă pe telefon, zi și noapte | Antetul spune „Acasă”; pastila „Extrasezon · butași și lucrări”; vremea în dreapta. |
| 2 | Cardurile de sus | „Butași de livrat săpt. asta” duce în Material săditor; „Rest de încasat” duce în Vânzări. Cifrele sunt cele pe care le știți. |
| 3 | „De făcut” | Fiecare rând duce în modulul lui. Lucrările planificate sunt cele din Activități cu dată în viitor. |
| 4 | Desktop, `/dashboard` | Arată exact ca înainte: salutul, grila, „Editează”. |
| 5 | Fereastră între 768 și 1023 px | Grila de desktop, cu salutul în antet. |
| 6 | **După migrare:** Setări › Ce arată Acasă → „Sezon” | Acasă arată „De livrat azi”, stocul și „De făcut azi”. |
| 7 | **După migrare:** perioada „Automat”, după 25 octombrie, cu recoltări în an | Apare „Începem extrasezonul?”. „Mai am de cules” îl ascunde 7 zile; „Da, începem” trece pe extrasezon. |
