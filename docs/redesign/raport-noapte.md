# Raportul nopții — 19 → 20 noiembrie 2026 (prompt 08)

Stare: **în lucru**. Se actualizează la finalul fiecărui modul. Nimic nu e mergeuit în `main`, niciun PR deschis.
Nimic scris în baza de date din cod: migrarea e doar un fișier.

## 1. Ordinea merge-urilor

Lanț de branch-uri; fiecare pornește din vârful celui dinainte, deci merge-urile se fac pe rând, `--ff-only`.

| # | Modul | Branch | Ultimul commit | Stare |
|---|---|---|---|---|
| 1 | Comenzi (+ migrarea comună, + prețul standard) | `redesign/comenzi` | vezi `git log -1 origin/redesign/comenzi` | **gata, împins** |
| 2 | Livrări | `redesign/livrari` | — | neînceput |
| 3 | Acasă (telefon) | `redesign/acasa` | — | neînceput |
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
- **`UnifiedOrderCard`, `EditOrderSheet`, `PaymentStatusToggle`** rămân în `src/components/comenzi` până la modulul 2 (le folosește Livrări) și sunt exceptate din `check:kit` prin `KIT_RULE_PENDING_FILES`.
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
