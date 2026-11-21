# Raportul promptului 19: Stocuri, Produse, Rapoarte

Branch: `redesign/stocuri-produse-rapoarte`, pornit din `main` `f79a50a`. Push făcut, fără merge.
Mockup: `docs/redesign/mockups/stoc-parcele-echipa.html`, capitolul 1.

## Ce s-a schimbat, pe module

### Stocuri (`/stocuri`), commit `bfda767`

- Cifra mare „Zmeură cal. I disponibilă · n kg” vine din `get_sellable_cal1_stock_summary` (`disponibil_cal1_kg`), cu „poți pune în livrare acum” dedesubt (sau „comenzile depășesc ce ai recoltat” / „nimic de pus în livrare acum”).
- Descompunerea arată doar ce dă funcția: **Recoltat cal. I** (`recoltat_cal1_kg`), **Livrat** (`consumat_definitiv_cal1_kg`), **În livrare** (`rezervat_activ_cal1_kg`), **Ajustări**. Funcția nu întoarce ajustările separat, așa că ele se scot din cifrele ei (`stoc_cal1_ledger_kg − recoltat + livrat`). E exact suma din `ajustari_stoc`, iar totalul se leagă de cifra mare: `recoltat − livrat − în livrare + ajustări = disponibil` (funcția pură `descompunereStoc`, cu test).
- **Abatere de la mockup:** funcția din bază nu taie pe sezon (recoltatul e pe toată perioada), deci rândul se numește „Recoltat cal. I”, nu „Recoltat în sezon”. Promptul cere să nu se inventeze altă formulă.
- Rândul „Cal. II în sezon” e informativ: suma `kg_cal2` din recoltări, de la `inceputSezon` până azi, cu aceeași regulă de produs ca stocul (dacă ferma are zmeură, numără doar zmeura; cultura vine din parcelă: `cultura`, altfel `tip_fruct`).
- Istoricul ajustărilor e grupat pe zile („Azi”, „Ieri”, „Luni 9.11”), cu motivul, nota și kg.
- **„Ajustează stocul”** e un `StepForm` în 2 pași: (1) motivul, pe plăci mari, cu toate tipurile din `AJUSTARE_STOC_TIPURI` (inclusiv „Altul”); (2) kg pe `NumericKeypad` + `KgField` (pornește gol) și „Notă (opțional)”. Are confirmare la închiderea fără salvare și ecran de reușită.
- Regula „nu sub 0” există deja în `create_ajustare_stoc` pentru orice scădere (`STOC_INSUFICIENT`). În formular apare înainte de salvare („Ai doar 256 kg disponibile. Nu poți scădea mai mult.”), cu butonul oprit; serverul o verifică oricum.
- Dialogul vechi `AjustareStocDialog` a fost șters.

### Produse (`/produse`), commit `a18867b`

- Lista: file Active / Inactive (cu numărul fiecăreia), căutare fără diacritice (apare de la 6 produse în sus), rânduri cu nume, „Casoletă 350 g · procesat” / „kg · fruct” și preț. Dedesubt, nota despre prețul la comenzi, cu link spre Setări › Prețul standard.
- Formularul `ProdusForm` (`StepForm` cu un singur pas) servește și la produs nou, și la editare. Câmpuri: nume, „Se vinde la”, gramaj (doar când unitatea nu e kg), preț, categorie, comutatorul „Activ”.
- Unitățile vin din constrângerea reală `produse_unitate_vanzare_check` (`kg, buc, ladă, casoletă, palet, cutie`). Plăcile arată kg / casoletă / ladă / bucată; dacă produsul are deja cutie sau palet, apare și acea placă.
- Categoriile vin din `produse_categorie_check` (Fruct / Legumă / Procesat / Altele). **Abatere de la mockup:** „Butași” nu e o categorie validă în bază, așa că nu apare.
- Ștergerea cere confirmare în formular (nimic nu se deschide peste `StepForm`). Mai întâi se numără `comenzi.produs_id` și `vanzari.produs_id` (`getUtilizareProdus`). Cheile străine sunt `ON DELETE SET NULL`, deci baza n-ar bloca ștergerea, dar istoricul ar rămâne fără produs. Un produs folosit primește mesajul „Produsul apare în 3 comenzi și 2 vânzări. Nu se poate șterge; îl poți doar dezactiva.” și butonul „Dezactivează produsul”.
- Decizia 3: pozele, linkul de magazin și blocul „Asociație” nu se mai afișează. Formularul nou nu trimite câmpurile `poza_*`, `association_category` sau `approximate_weight`, deci datele lor rămân neatinse. Codul vechi (`AddProdusDialog`, `EditProdusDialog`, `ProductAssociationOfferBlock`, `ProdusFormSummary`) rămâne în repo, cu un comentariu care spune de ce, și e trecut în `KIT_RULE_PENDING_FILES`.
- `createProdus` primește acum și `status` opțional, ca un produs nou să poată porni inactiv.

### Rapoarte (`/rapoarte`), commit `3e403fa`

- Perioada are trei variante: Luna / Sezonul / Anul. Sezonul folosește `inceputSezon`.
- Sus e profitul („Profit în sezonul 2026”, încasat − cheltuieli, fără investiții). Dedesubt, plăcile Încasat, Cheltuieli, Recoltat (kg) și Investiții · separat, plus un rând cu investițiile pe categorii.
- Graficul „Încasat și cheltuieli, pe luni” e făcut din bare HTML (fără bibliotecă nouă), cu toate lunile din perioadă și text pentru cititoarele de ecran.
- Listele se comută între Parcele, Culegători și Clienți. Parcele: kg și kg/plantă din `nr_plante`. Culegători: kg și plata (`valoare_munca_lei`, ca în modulul Culegători). Clienți: încasat.
- Parcelele personale (`rol = 'personal'`, prin `normalizeParcelaRol`) nu intră la „Recoltat”. În lista Parcele apar la sfârșit, cu „Personal · nu intră la kg recoltate”. Venitul nu e legat de parcelă, deci n-are ce scoate acolo.
- Banii trec doar prin funcțiile existente: `ziuaVenitului` + `vanzareTotal` (încasat), `butasiRevenueDate` (material săditor livrat), `calculateProfit`, `investitiiInPerioada`. Calculele stau în funcții pure în `src/lib/rapoarte/raport.ts`, cu teste.
- **Exportă** (iconița ⇩ din antet) deschide un `BottomSheet` cu:
  - raportul perioadei în **Excel** (fișier `.xls` din HTML, formatul de până acum) sau **PDF** (fereastra de tipărire). Conține: pe scurt, lunile, parcelele, culegătorii, clienții, cheltuielile pe categorii și investițiile pe categorii;
  - **Registrul de tratamente** pentru perioadă, în Excel sau PDF, cu ambele surse: aplicările făcute din `aplicari_tratament` (un rând pe parcelă și produs) și activitățile vechi de tip tratament (`tipDinActivitateVeche`, marcate „(din Activități)”). Coloane: data, parcela, metoda, produsul, substanța activă, doza, cantitatea, pauza (zile), „Se poate recolta de la”. Pauza și ziua permisă folosesc aceeași regulă de zile ca peste tot. Dacă rândul aplicării nu are substanța salvată, o ia din catalog după `produs_id`.
- Textul din exporturi e acum scăpat (`escapeHtml`); înainte nu era.

### Corecturi după testul în demo, commit `6fc14e0`

- „0 kg” fără semn în descompunere.
- „kg · fruct” cu literă mică, ca în mockup.
- Substanța activă din catalog în registru.
- Bara de cheltuieli din grafic se vede și noaptea (`bg-fg-subtle`).

### Mai mult

Intrările spre Stocuri, Produse și Rapoarte au doar titlu, fără text dedesubt, deci n-a fost nimic de actualizat.

### Kitul

`KIT_RULE_DIRS` include acum `src/app/(dashboard)/{stocuri,produse,rapoarte}`, `src/components/{stocuri,produse,rapoarte}` și `src/lib/{stocuri,produse,rapoarte}`. Testele noi (`src/lib/stocuri/__tests__`, `src/lib/produse/__tests__`) sunt adăugate în `vitest.critical.config.ts`.

## Migrarea

Nu a fost nevoie. Nimic nu s-a aplicat în bază. Din baza de producție am rulat doar `select`-uri pe catalog (constrângerile `produse`, cheile străine spre `produse`, existența funcției de stoc) și o numărătoare pe `produse.unitate_vanzare`.

## Filtre și funcții vechi scoase

- **Rapoarte:**
  - perioada „Săpt.” (mockup-ul și decizia cer Luna / Sezonul / Anul);
  - filtrele Cultură, Parcelă și „tip raport” (cu tabelul și graficul lui). Nu încăpeau firesc în ecranul nou; listele Parcele / Culegători / Clienți și exportul acoperă ce arătau;
  - tabelele de productivitate (kg/zi pe parcelă și pe culegător);
  - toate exporturile **CSV** (raport, „sezon complet”, tratamente), conform deciziei 4;
  - din `page.tsx` nu se mai citesc `activitati_agricole` pe server: registrul le citește la deschiderea foii, cu aceeași cheie ca jurnalul Tratamente.
- **Stocuri:**
  - eticheta „OK / Atenție / Critic” (pragurile `STOCK_AUDIT_*`), care nu e în mockup;
  - nota „Stocul este afișat ca total pe fermă…”;
  - **data** ajustării: pasul 2 cere doar kg și notă, deci ajustarea se salvează cu ziua de azi (`bucharest_today()` pe server). Înainte se putea alege altă zi.
- **Produse:**
  - tabelul de desktop cu panoul de detalii;
  - filtrul pe categorie și fila „Toate”;
  - câmpul „Descriere” (nu e în mockup; datele rămân în bază, iar căutarea încă îl folosește).

## Ce n-am putut testa

- **Ramura „produs folosit” la ștergere**, în demo: comenzile din demo n-au `produs_id`, iar ca s-o forțez ar fi trebuit să creez o comandă. Interogarea de numărare a mers (a întors 0 fără eroare), iar mesajul are teste unitare.
- **Dialogul real de tipărire (PDF):** l-am verificat prin captură. Documentul se construiește corect pentru raport și registru (stil, rânduri, substanța), dar fereastra de tipărire nu s-a deschis.
- **Descărcarea reală a fișierului `.xls`:** am verificat conținutul Blob-ului (tabelele și rândurile corecte), nu fișierul salvat pe disc sau deschis în Excel.
- **Plata culegătorilor** se ia din `valoare_munca_lei` salvat pe recoltare. Plățile marcate separat în Culegători nu intră aici.
- `ajustari_stoc` **n-are cheie de idempotență**. Formularul nu retrimite aceeași cheie după o salvare reușită, dar un răspuns pierdut pe rețea urmat de „Salvează” din nou ar putea dubla ajustarea. Rezolvarea ar cere o migrare (`client_sync_id`), pe care n-am scris-o, fiindcă promptul nu o cerea.
- **Ieșirea din demo** prin „Creează-ți ferma →” s-a blocat în browserul din aplicație, în pasul de pe client dinainte de POST (dezabonarea de la notificări). Am trimis POST-ul `/api/auth/leave-demo` direct. Nu e cod din acest branch, dar e de verificat pe un telefon real.

## Verificarea în demo (cont nou, „Fructe de pădure”, 390×844, zi și noapte; desktop 1280×800)

- **Stocuri:** 324 − 66 − 0 − 2 = 256 kg. „Pierdere 2 kg” cu nota „mucegăite” a scăzut disponibilul cu 2 și apare în istoric la „Azi”. „Corecție în minus 300 kg” a fost refuzată frumos, cu butonul oprit. Confirmarea „Renunți la ajustare?” merge.
- **Produse:** „Gem de zmeură” (casoletă 350 g, 25,5 lei, procesat) adăugat, editat la 27 lei, apoi dezactivat (apare la Inactive). Câmpurile de magazin nu apar. Confirmarea de ștergere spune „Nu apare în nicio comandă sau vânzare”; am renunțat, n-am șters.
- **Rapoarte:**
  - Luna: 1.971 − 610 = 1.361;
  - Sezonul: 1.971 − 4.230 = − 2.259;
  - Anul: 1.971 − 5.475 = − 3.504;
  - investițiile (13.860 lei) stau separat;
  - în export, Excel-ul raportului e complet. Registrul are 14 rânduri: 6 „(din Activități)” și 8 aplicări noi, inclusiv Switch cu pauză 3 zile, recoltare de la 23.11.2026.
- **Desktop 1280×800:** toate trei ecranele merg, iar butonul principal stă în pagină.
- **Consola:** doar erorile CSP vechi pentru scripturile Vercel Analytics.

## Verificările

| Verificare | Rezultat |
| --- | --- |
| `npm run lint` | 0 erori (10 avertismente, toate în fișiere neatinse) |
| `npm run typecheck` | trece |
| `npm run check:kit` | OK, 187 fișiere, fără abateri |
| `npm run test:critical:unit` | 88 fișiere, 674 teste, toate trec |
| `npm run build` | trece |

## Commit-urile

| Hash | Ce |
| --- | --- |
| `bfda767` | feat(stocuri): Stocuri pe kit, „Ajustează stocul” în 2 pași |
| `a18867b` | feat(produse): Produse pe kit, ștergere doar fără comenzi/vânzări |
| `3e403fa` | feat(rapoarte): Rapoarte pe kit, „Exportă” cu Excel, PDF și registrul de tratamente |
| `6fc14e0` | fix(redesign): ajustări după trecerea prin demo |
| (acest fișier) | docs(redesign): raportul promptului 19 |
