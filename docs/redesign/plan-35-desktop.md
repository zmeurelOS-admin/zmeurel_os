# Planul promptului 35 — desktopul refăcut pentru ecran mare

Promptul: `docs/redesign/prompts/35-desktop.md`. Prototipul aprobat: `docs/redesign/mockups/desktop-prototip.html`
(hibridul: Acasă și Bani ca în B, modulele ca în A, cu „Tabel”). Am citit `CLAUDE.md`, `docs/redesign/` (tokens,
`raport-34-final.md`, `plan-34-final.md`) și codul atins: `src/lib/navigatie/meniu.ts`, `Sidebar.tsx`, `AppShell.tsx`,
`PageHeader.tsx`, layout-ul `(dashboard)`, `/dashboard` + `Acasa.tsx` + `lib/dashboard/acasa.ts`, `StepForm.tsx` +
`KgField` / `NumericKeypad`, `ComandaStepForm` + `ComandaSheet`, `RapoartePageClient` + `lib/rapoarte/raport.ts`,
`TratamentePageClient`, paginile cu liste, `e2e/smoke/*`. **N-am scris cod.**

## Pe scurt

- **Telefonul nu se schimbă.** Tot ce e nou are prefixul `lg:` (≥ 1024 px) sau rulează doar când
  `(min-width: 1024px)` e adevărat. Sub 1024 px, DOM-ul și comportamentul rămân cele din `main` (`43b5db4`), cu o
  singură excepție de discutat: gruparea barei laterale între 768 și 1023 px (întrebarea 1).
- **Nicio migrare.** Tot ce cere promptul se poate calcula din tabelele și interogările existente. Profitul pe parcelă
  și registrul de încasări și plăți au limite (nu există `parcela_id` pe vânzări / cheltuieli, nici număr de document);
  le spun la §8 și le pun la întrebările 7–9.
- **Niciun pachet nou.** Tabelul folosește `@tanstack/react-table` (deja instalat); graficele sunt SVG propriu (ca
  `GraficLuni` din Rapoarte); CSV-ul îl scriu eu (20 de rânduri); exportul de registru folosește `lib/rapoarte/export.ts`.
- **Fără logică dublată.** Fișele din dreapta sunt aceleași componente ca foile de pe telefon, scoase din `BottomSheet`
  într-o componentă „conținut” pe care o folosesc și foaia, și panoul. Formularele rămân aceleași componente; se schimbă
  doar carcasa (`StepForm`) pe desktop.
- **Branch** `redesign/35-desktop` din `origin/main` (`2d84a06`). Commit + push după fiecare secțiune, fără merge.
  Fișierele adăugate pe nume (fără `git commit -a`), fără `public/sw.js`.
- **Ordinea de lucru:** §1 → §4 (tiparul, cu §9 carcasa) → §5 → §2 → §3 → §8 → §6 → §7 → §9 (formularele pe o
  pagină) → §10 → testele e2e → raportul. Tiparul listă + detaliu și panoul de formular vin devreme pentru că toate
  modulele de după le folosesc; căutarea vine după Comenzi, ca să aibă unde deschide o comandă.
- **Înainte de fiecare push:** `npm run test:critical:unit`, `npm run lint`, `npm run typecheck`, `npm run check:kit`,
  `npm run build` (`check:server-supabase-boundaries` pică deja pe `main`, îl notez separat). La final
  `npm run test:e2e:smoke` + testele noi de desktop.

---

## Principii comune (valabile la toate secțiunile)

1. **Pragul**: `lg` = 1024 px, ca în prompt. Bara laterală apare deja de la `md` (768 px, promptul 34); restul
   (lățimea, antetul nou, listă + detaliu, panoul de formular, Acasă B) doar de la `lg`.
2. **Aspectul din CSS, comportamentul din JS.** Coloanele se fac cu clase `lg:` (fără „pâlpâire” la încărcare, fără
   diferență între server și client). Doar ce *face* un clic diferă (pe telefon deschide foaia, pe desktop pune `?id=`)
   folosește un hook nou `useEsteDesktop()` (`src/lib/ui/useEsteDesktop.ts`, `matchMedia('(min-width: 1024px)')`,
   `useSyncExternalStore`, pe server `false`). Pe telefon hook-ul întoarce `false`, deci ramura de telefon e codul de
   azi neatins.
3. **Elementul ales stă în URL**: `?id=<uuid>` (cu `router.replace`, ca să nu umple istoricul la săgeți; un clic cu
   mouse-ul face `router.push`, ca „înapoi” din browser să revină la elementul de dinainte). Excepție: Parcele păstrează
   `/parcele/[id]` (adresa există peste tot în aplicație, inclusiv în notificări); pe desktop pagina aceea arată lista +
   fișa. Parametrii vechi rămân: `?client=` la Clienți e citit ca `?id=`.
4. **Lățimea**: conținutul pe toată lățimea, cu limita `max-w-desktop` = **1600 px** (token nou în `globals.css`,
   `--container-desktop: 100rem`). În modulele refăcute, `max-w-modul` devine `max-w-modul lg:max-w-desktop`.
5. **Tokeni și straturi**: doar tokenii canonici, fără hex, fără `dark:`. Panoul de formular e `z-modal` (prin
   `ui/dialog`, ca acum). Zi și noapte verificate cu capturi.
6. **Drepturile**: aceleași funcții ca azi (`vedeIntrarea`, `isPathAllowedForAccess`, `resolveFarmMemberAccess`,
   proprietarul pentru bani). Nimic nou nu citește bani ocolind RLS-ul; cifrele de bani din Acasă se calculează doar
   dacă `memberRole !== 'operator'`, iar pentru operator interogările de bani nu pornesc deloc (`enabled: false`).

---

## §1 Carcasa desktop

**Ce fac**

- **Gruparea barei laterale** în `src/lib/navigatie/meniu.ts`: funcție nouă `meniuDesktop(ctx): GrupMeniu[]`, cu
  aceleași intrări și aceeași funcție de vizibilitate (`vedeIntrarea`); bara de jos (`meniuPrincipal`) și „Mai mult”
  (`grupuriMeniu`) **nu se ating**. Ordinea propusă:
  - sus: **Acasă**;
  - **Vânzări**: Comenzi și livrări · Clienți · Stocuri · Vânzări · Produse · Material săditor;
  - **Ferma**: Parcele · Tratamente · Recoltări · Lucrări · Culegători;
  - **Bani** (doar proprietarul): Bani și rapoarte (`/rapoarte`) · Cheltuieli · Investiții;
  - **Asociația** (doar `associationRole`): „Gustă din Bucovina” (`/asociatie`);
  - **Admin** (doar superadmin): ca acum;
  - jos: Setări (nu pentru operator; operatorul are „Mai mult”, ca acum), „Planul tău”, „Scrie-mi…” (nu superadmin),
    apoi contul și butonul de restrângere. Clopoțelul rămâne sus, lângă logo (unde e din 34).
- **Livrări**: recomand o singură intrare, **„Comenzi și livrări”** → `/comenzi`, activă și pe `/livrari`. În antetul
  ambelor pagini, pe desktop, un comutator `Comenzi · Livrări azi` trece între cele două rute (ambele rămân, telefonul
  nu se schimbă). Motiv: pe desktop comenzile și livrările sunt aceeași treabă (prototipul le unește), iar pagina
  Livrări (ordinea traseului, livratorul) rămâne cum e, fără rescriere. Întrebarea 2.
- **Magazia**: fără rând separat în bară; `Tratamente` e activ și pe `/tratamente/magazie` (`hrefActiv` primește o
  regulă, ca la Investiții). Pe desktop, Magazia apare ca a cincea filă în Tratamente (§7, întrebarea 10).
- **Bara laterală** (`Sidebar.tsx`): lățimea 232 px (azi 240), restrânsă 64 px (ca acum, ținută în `localStorage`);
  grupurile cu titlu mic, ca în prototip. Zona asociației (`/asociatie/*`) rămâne cu lista ei (`AssociationSidebar`).
- **Antetul paginii pe desktop**: componentă nouă `AntetDesktop` (în kit, `src/components/kit/AntetDesktop.tsx`), randată
  de `PageHeader` doar la `lg` (`hidden lg:flex`; antetul de azi primește `lg:hidden`):
  - stânga: titlul (22 px) + un rând de context (15 px, `subtitle`, ex. „6 comenzi deschise · 63 kg”);
  - dreapta: câmpul de căutare globală (§2), comutatoarele paginii (`Listă / Tabel`, `Comenzi / Livrări azi`), acțiunea
    principală („+ Comandă”, „+ Tratament” …).
  - `PageHeader` primește prop-urile noi `actiune?: { label; onClick; icon? }` și `comutatoare?: ReactNode`. Modulele
    refăcute trec acolo butonul pe care azi îl au în bara fixă de jos (`AppShell bottomBar`). `useAddAction`
    (Material săditor) rămâne și se afișează în același loc.
- **Fără buton plutitor pe desktop**: `UnifiedMobileFab` e deja `md:hidden`; bara fixă de jos din `AppShell` e deja
  `md:hidden`. Verific că nicio pagină nu rămâne fără acțiunea principală pe desktop (lista la §10).
- **Conținutul**: `AppShell` primește `lg:max-w-desktop` în loc de `max-w-md sm:max-w-full`, cu marginile 24 px.

**Fișiere**

- modificate: `src/lib/navigatie/meniu.ts`, `src/components/layout/Sidebar.tsx`, `src/components/app/PageHeader.tsx`,
  `src/components/layout/CompactPageHeader.tsx` (`lg:hidden`), `src/components/app/AppShell.tsx`, `src/app/globals.css`
  (`--container-desktop`), `src/components/kit/index.ts`;
- noi: `src/components/kit/AntetDesktop.tsx`, `src/lib/ui/useEsteDesktop.ts`;
- teste: `src/lib/navigatie/__tests__/meniu.test.ts` (extins: `meniuDesktop` pentru proprietar, operator cu 2 module,
  operator fără parcele / tratamente, superadmin, cont de asociație; „Bani” lipsește la operator; bara de jos și
  „Mai mult” neschimbate — aceleași aserțiuni ca înainte), `e2e/smoke/desktop.spec.ts` (actualizat la grupurile noi).

---

## §2 Căutarea globală

**Ce fac**

- Câmp în `AntetDesktop` („Caută comandă, client, parcelă…  Ctrl K”) + scurtătura **Ctrl K / ⌘ K** oriunde în
  aplicație (doar la `lg`; pe telefon nu se înregistrează nimic). Se deschide o fereastră de căutare
  (`CautareGlobala`, peste `ui/dialog`, `z-modal`, „înapoi” / Esc o închid ca pe orice fereastră din 34).
- **Fără căutare pe server.** Datele vin din interogările existente, cu aceleași chei React Query (dacă pagina le-a
  încărcat deja, nu se mai cere nimic): `getComenzi`, `getClienți`, `getParcele`, `getCulegatori`. Pornesc doar la
  prima deschidere a căutării (`enabled: deschis`), apoi stau în memorie după regulile din `QUERY_DEFAULT_OPTIONS`.
- **Ce caută**:
  - comenzi: numele clientului (sau `client_nume_manual`), telefonul, numărul scurt (`numar_comanda_scurt`), adresa;
  - clienți: nume, telefon, localitate / adresă;
  - parcele: nume, cultură / soi;
  - culegători: nume, telefon;
  - paginile din meniu (din `meniuDesktop`, deci doar cele vizibile utilizatorului): „Magazia”, „Registrul de
    tratamente”, „Setări › Echipa” etc.
- **Potrivirea**: fără diacritice și fără majuscule („stefan” găsește „Ștefan”), pe începutul cuvintelor întâi, apoi
  oriunde; telefoanele fără spații. Cel mult 5 rezultate pe grup, grupurile în ordinea: Pagini, Comenzi, Clienți,
  Parcele, Culegători. Săgeți sus / jos, Enter deschide.
- **Unde duce Enter**: comanda → `/comenzi?id=<id>`; clientul → `/clienti?id=<id>`; parcela → `/parcele/<id>`;
  culegătorul → `/culegatori?id=<id>`; pagina → adresa ei. Pe desktop, `?id=` deschide lista + fișa (§4).
- **Drepturile operatorului**: un grup se caută doar dacă `isPathAllowedForAccess('/comenzi' | '/clienti' | …)`;
  interogarea grupului interzis nici nu pornește.

**Fișiere**

- noi: `src/lib/cautare/globala.ts` (pur: normalizarea, potrivirea, ordonarea, gruparea, drepturile pe grup),
  `src/components/app/CautareGlobala.tsx` (fereastra + scurtătura; aici și nu în kit, fiindcă citește date), câmpul
  din `AntetDesktop`;
- teste: `src/lib/cautare/__tests__/globala.test.ts` (diacritice, telefon cu spații, ordinea, limita pe grup, operator
  fără Comenzi nu primește grupul Comenzi, paginile ascunse nu apar).

---

## §3 Acasă pe desktop (varianta B)

**Ce fac**

Pe `/dashboard`, la `lg`, o grilă nouă `AcasaDesktop`; sub `lg` rămâne exact coloana de azi (`Acasa` + mementourile).
Cele două sunt randate cu `lg:hidden` / `hidden lg:block` peste **aceleași interogări** din `dashboard/page.tsx` (nu
se încarcă nimic de două ori). Fără widgeturi mutabile, fără „Editează”.

- **Rândul de cifre** (`StatTile`, 5 coloane):
  1. **Venit sezon** (lei, încasat) + comparația cu aceeași perioadă de anul trecut („+12% față de 2025”), doar dacă
     anul trecut are date;
  2. **Recoltat** (kg, sezon) + comparația;
  3. **De încasat** (lei) + „N peste 30 zile” (`neincasatePeste30`, sursa din notificări);
  4. **Stoc cal. I** (kg, `useStocFerma`) + „X kg comandate” (comenzile deschise);
  5. **Cheltuieli sezon** + „profit Y lei”.
  Sezonul = `inceputSezon` (prima recoltare din an, regula existentă din `lib/sezon.ts`); anul trecut = `inceputSezonAn(an − 1, …, aceeași zi)`.
  Venitul și profitul = `sumarRaport` din `lib/rapoarte/raport.ts` (aceeași regulă ca Rapoartele). **Operatorul** nu
  vede plăcile 1, 3, 5 (rămân recoltat și stoc, fiecare doar dacă are dreptul pe modulul lui).
- **Recolta pe săptămâni**: bare pe săptămânile sezonului curent, cu anul trecut ca linie / bare estompate dacă există;
  sub 2 săptămâni de date: starea goală „Graficul apare după primele recoltări din sezon”.
- **De făcut azi**: **aceleași surse** ca pe telefon (comenzile de livrat, capcanele, tratamentele planificate /
  întârziate și pauzele, lucrările planificate, neîncasate ≥ 30 de zile, înghețul, „Primii pași”, analiza dinainte de
  cules, extrasezonul). Ca să nu dublez logica, scot din `Acasa.tsx` partea care construiește rândurile într-un hook
  `useDeFacutAzi(props)` (sau funcție pură în `lib/dashboard/acasa.ts`) pe care o folosesc ambele vederi; componentele
  care sunt deja carduri (`MementoAcasa`, `MementoCapcaneAcasa`, `NeincasatePeste30Acasa`, `PrimiiPasi`) se pun ca
  atare în coloana „De făcut azi” pe desktop.
- **Producție pe parcelă**: `peParcele` (Rapoarte), sezonul curent, bare orizontale.
- **Comenzile pe zilele următoare**: azi + 6 zile, câte comenzi și kg pe zi (din `comenzi`), clic → `/comenzi` cu
  filtrul zilei.
- **Vremea pe 3 zile**: `PrognozaZile` existent; fără loc → `PuneLoculFermei`.
- **Ultimele înregistrări**: ultimele 6 din recoltări, tratamente, lucrări, plus încasări și cheltuieli doar la
  proprietar; funcție pură `ultimeleInregistrari`.
- **Interogări noi pe pagină**: doar cheltuielile (`getCheltuieli`), pentru placa 5, numai pentru proprietar și numai
  pe desktop (`enabled: proprietar && esteDesktop`). Restul există deja pe pagină.
- **Stări goale utile**: fiecare card fără date are un rând care spune ce lipsește și unde se adaugă („Nicio recoltare
  în sezonul acesta · + Recoltare”), nu zero-uri.

**Fișiere**

- noi: `src/components/acasa/AcasaDesktop.tsx`, `src/lib/dashboard/acasa-desktop.ts` (pur: cifrele sezonului cu
  comparația, săptămânile de recoltă, comenzile pe zile, ultimele înregistrări), componenta de kit `GraficBare`
  (`src/components/kit/GraficBare.tsx`: bare verticale / orizontale, serie de comparație, etichete, `role="img"` +
  tabel ascuns pentru cititoarele de ecran);
- modificate: `src/app/(dashboard)/dashboard/page.tsx`, `src/components/acasa/Acasa.tsx` (doar extragerea rândurilor
  „De făcut azi”, fără schimbare pe telefon), `src/app/(dashboard)/dashboard/loading.tsx` (scheletul pe desktop);
- teste: `src/lib/dashboard/__tests__/acasa-desktop.test.ts` (sezonul de la prima recoltare; fără recoltări în an →
  1 ianuarie; comparația doar cu date anul trecut; parcelele personale scoase din recoltat; săptămânile ISO peste
  schimbarea anului; ultimele înregistrări fără bani pentru operator); testele existente ale Acasei rămân verzi.

---

## §4 Listă + detaliu — tiparul comun

**Ce fac**

- **`VedereListaDetaliu`** (kit, `src/components/kit/VedereListaDetaliu.tsx`):
  - props: `elemente`, `idAles`, `onAlege(id)`, `randeazaRand(el, ales)`, `randeazaFisa(el)`, `filtre?` (chip-uri,
    `FilterPills`), `cautare?` (câmp în capul listei, filtrare locală), `gol` (`EmptyState`), `faraSelectie` (ce arată
    dreapta când nu e nimic ales: primul element pe desktop sau un mesaj — recomand primul element din listă);
  - la `lg`: două coloane, lista 380 px (cu derulare proprie), fișa în rest (derulare proprie), ambele cât ecranul sub
    antet; sub `lg` randează doar lista (exact ca acum: pagina își păstrează foaia).
  - **Tastatura**: ↑ / ↓ mută selecția când focusul e în listă (`role="listbox"`, `aria-activedescendant`), Enter
    trece focusul în fișă.
  - **URL**: hook `useIdDinUrl(nume = 'id')` → `[id, alege(id, { push })]`; un id care nu mai există (șters) trece
    la primul element fără eroare.
- **Comutatorul Listă / Tabel** (`Segments`, în `AntetDesktop`), ținut în URL (`?vedere=tabel`), doar la `lg`.
- **`TabelDate`** (kit, `src/components/kit/TabelDate.tsx`, peste `@tanstack/react-table`): coloane sortabile (clic pe
  cap, `aria-sort`), rând de totaluri jos (funcție pe coloană), selecție multiplă (bife, „Toate”), bară de acțiuni în
  bloc care apare la selecție, „Exportă CSV”, clic pe rând → deschide fișa (trece în Listă cu `?id=`).
- **Exportul CSV**: `src/lib/export/csv.ts` (pur) — separator `;`, zecimale cu virgulă, BOM UTF-8 (se deschide direct în
  Excel în română), numele fișierului `comenzi-2026-11-28.csv`; descărcare cu `Blob` + `<a download>`.
- **Fișa din dreapta**: componenta de conținut scoasă din foaia de pe telefon (vezi fiecare modul). Acțiunile sunt
  butoane în capul fișei (`AntetFisa` în kit: titlu, rând de context, butoane). Sub-ecranele foilor (ex. „Mută ziua”,
  „Șterge?”) se deschid în fișă, în locul conținutului, cu „Înapoi” — fără fereastră peste fereastră.

**Fișiere**

- noi (kit): `VedereListaDetaliu.tsx`, `TabelDate.tsx`, `AntetFisa.tsx`; noi (lib): `src/lib/export/csv.ts`,
  `src/lib/ui/useIdDinUrl.ts`; exporturi în `src/components/kit/index.ts`; pagina `/admin/kit` primește exemple;
- teste: `src/components/kit/__tests__/VedereListaDetaliu.test.tsx` (selecția din URL, săgețile, id inexistent),
  `TabelDate.test.tsx` (sortare, totaluri, selecție, export apelat cu rândurile selectate),
  `src/lib/export/__tests__/csv.test.ts` (ghilimele, `;` în text, zecimale, diacritice).

---

## §5 Comenzi și Livrări

**Ce fac**

- **Listă + detaliu** pe `/comenzi` la `lg`:
  - filtre: **Toate · Azi · Mâine · Săptămâna · De pregătit · În livrare · Neîncasate** (din `lib/comenzi/day-view`
    și `comandaPlata`; cifra lângă fiecare);
  - rândul: client, ziua · ora · adresa, kg, starea (`StatusPill`);
  - fișa: **conținutul din `ComandaSheet`** scos în `ComandaFisa` (vederea `detalii` + sub-vederile `muta`, `livreaza`,
    `sterge`, `redeschide`, `anuleaza`), cu `useComandaActions` neschimbat. `ComandaSheet` = `BottomSheet` +
    `ComandaFisa` (telefonul identic). În capul fișei: **Pune în livrare / Marchează livrată / Încasează / Editează /
    WhatsApp** (aceleași condiții ca în foaie). Sub cifre: istoricul (creată, modificată, în livrare, livrată — din
    coloanele existente `created_at`, `updated_at`, `status`, `data_livrare`; fără tabel de istoric nou), clientul pe
    scurt (comenzi în an, kg, ultima comandă, din `comenzi` filtrate pe client) și **livrările de azi în ordine**
    (`ordine_livrare`, cu link „Livrări azi”).
- **Tabel**: # · client · telefon · livrare · adresă · kg · lei/kg · total · plată · stare; totaluri kg și lei; în bloc
  **„Pune în livrare”** pentru comenzile selectate care pot trece (de azi / mâine, nelivrate).
  - În bloc = aceeași acțiune ca butonul din fișă, chemată pe rând, comandă cu comandă; la prima care pică pe stoc
    (`parseStocInsuficient`) mă opresc și arăt „3 puse în livrare · Mega Image n-a intrat: lipsesc 4 kg”. Nimic nou
    pe server.
- **Regulile rămân** (sunt în acțiunile existente, nu le ating): livrată = nu se mai modifică; în livrare nu trece
  peste stoc; „La poartă” livrată pe loc; avans la livrare.
- **Livrări azi** (`/livrari`): pe desktop, pagina pe toată lățimea, cu lista traseului în stânga și fișa comenzii
  alese (aceeași `ComandaFisa`) în dreapta; ordinea traseului (tragere) și linkul livratorului rămân cum sunt.
- **Acțiunea principală**: „+ Comandă” în antet; „Din mesaj” lângă ea.

**Fișiere**

- noi: `src/components/comenzi/ComandaFisa.tsx`, `src/components/comenzi/ComenziDesktop.tsx` (lista + tabelul),
  `src/lib/comenzi/tabel.ts` (pur: coloanele, totalurile, CSV-ul, care comenzi pot intra în bloc);
- modificate: `ComandaSheet.tsx` (devine învelișul), `ComenziPageClient.tsx`, `LivrariPageClient.tsx`;
- teste: `src/lib/comenzi/__tests__/tabel.test.ts` (filtrele, totalurile, eligibilitatea în bloc: livrată / anulată /
  din altă zi nu intră), testele existente ale comenzilor rămân verzi.

---

## §6 Parcele

**Ce fac**

- **Listă + fișă** la `lg` pe `/parcele` și `/parcele/[id]`: lista (nume, cultură · plante · suprafață, kg anul acesta,
  filtre Toate · Comerciale · Personale) în stânga; în dreapta **conținutul din `ParcelaFisaClient`** scos în
  `ParcelaFisa` (stadiul acum pe lăstari, cifrele, jurnalul, sezonul pe lăstari, analiza / culesul, capcanele etc.).
  `/parcele/[id]` pe telefon = exact pagina de azi.
- **Cifrele**: recoltat (an), kg / plantă (existente pe fișă) și **profitul pe parcelă**, estimat (aceeași funcție ca la
  §8, întrebarea 7). Dacă nu aprobi estimarea, placa nu apare.
- **Acțiunile** în capul fișei: + Tratament, + Lucrare, + Recoltare, Stadiul (aceleași formulare, deschise în panoul
  din dreapta).
- **Recolta pe săptămâni** pe parcelă: `GraficBare` cu aceeași funcție ca în Acasă, filtrată pe parcelă.
- **Tabel**: parcelă · cultură · plante · suprafață · stadiu · recoltat · ultima lucrare; CSV. Fără acțiuni în bloc (nu
  au sens aici).

**Fișiere**

- noi: `src/components/parcele/ParcelaFisa.tsx`, `src/components/parcele/ParceleDesktop.tsx`;
- modificate: `ParceleListClient.tsx`, `parcele/[id]/ParcelaFisaClient.tsx` (devine învelișul paginii de telefon);
- teste: săptămânile pe parcelă intră în testul de la §3; tabelul (coloanele, ultima lucrare) în
  `src/lib/parcele/__tests__/tabel.test.ts`.

---

## §7 Tratamente

**Ce fac**

- Taburile **Aplicări · Plan · Capcane · Analize** rămân, iar pe desktop **Magazia** e a cincea filă (link spre
  `/tratamente/magazie`, care pe desktop arată tot antetul cu file; întrebarea 10). Fiecare filă = listă + detaliu:
  - **Aplicări**: lista din jurnal (`construiesteJurnal`), fișa = conținutul foii de azi (din `TratamentePageClient`,
    `BottomSheet` de la rândul 618) scos în `AplicareFisa`: produse, pauza, apă, stadiul, „Magazia · ce a scăzut”
    (`magazie_iesiri_aplicari`), „Pe sezon · 2 din 3 aplicări permise”; butoane Repetă, Editează, Marchează făcut;
  - **Plan**: lista liniilor („Ce urmează” sus), fișa liniei (produse, repetare, parcele, „Sar peste”, „Fă acum”);
  - **Capcane**: lista grupurilor, fișa = conținutul din `/tratamente/capcane/[grupId]` (graficul, verificările);
  - **Analize**: lista analizelor, fișa = `RaportAnalizaView`;
  - **Magazia**: lista produselor (`RandMagazie`), fișa = conținutul din `/tratamente/magazie/[produsId]`.
- **Tabel la Aplicări**: data · parcele · tip · produse · stare; CSV. **„Registrul de tratamente”** în antet deschide
  exportul existent (`ExportRaportSheet` cu registrul ales).
- **Calendarul parcele × săptămâni** (varianta B): recomand să-l fac la final, ca a treia vedere a filei Aplicări
  (`Listă · Tabel · Calendar`), dacă ajung; e o funcție pură peste jurnal (întrebarea 11).

**Fișiere**

- noi: `src/components/tratamente/AplicareFisa.tsx`, `src/components/tratamente/TratamenteDesktop.tsx`,
  `src/components/capcane/GrupFisa.tsx`, `src/components/magazie/ProdusFisa.tsx`, `src/components/plan/LinieFisa.tsx`
  (fiecare scos din pagina / foaia de azi, folosit de ambele), opțional `src/lib/tratamente/calendar.ts`;
- modificate: `TratamentePageClient.tsx`, `CapcaneTab.tsx`, `PlanTab.tsx`, `AnalizeTab.tsx`,
  `tratamente/magazie/*`, `tratamente/capcane/[grupId]/*`;
- teste: tabelul aplicărilor și (dacă îl fac) calendarul în `src/lib/tratamente/__tests__/`.

---

## §8 Bani și rapoarte (varianta B), doar proprietarul

**Ce fac**

- **`/rapoarte` la `lg`** (titlul în bară: „Bani și rapoarte”; pe telefon rămâne „Rapoarte”):
  - cifrele anului: **venit, cheltuieli, profit, investiții** (`sumarRaport`, perioada `an`; comutatorul
    Lună · Sezon · An existent rămâne);
  - **graficul venit și cheltuieli pe luni** (`luniRaport` existent; desenul trece pe `GraficBare`);
  - **profitul pe parcelă**, estimat (întrebarea 7). Ce se poate și ce nu:
    - nu există `parcela_id` pe `vanzari`, `comenzi` sau `cheltuieli_diverse`; există pe `recoltari` (kg și
      `valoare_munca_lei`), pe `investitii` și, indirect, pe aplicările de tratament (parcelele aplicării + prețurile din
      Magazie);
    - propunerea: **venit estimat** = kg parcelei × prețul mediu încasat pe kg în perioadă; **cheltuieli directe** =
      plata culesului din recoltările parcelei + costul tratamentelor din Magazie (împărțit pe parcelele aplicării după
      suprafață); **restul cheltuielilor** (fără parcelă) pe un rând separat „Comune, neîmpărțite pe parcele”, nu
      repartizate în ascuns. Coloanele: parcelă · kg · venit estimat · cheltuieli directe · rezultat. Scris clar
      „estimat” în titlu și o frază dedesubt cu regula.
  - **registrul de încasări și plăți pe lună** (vizualizare): încasările = vânzările încasate (la `data_incasare`, plus
    plățile parțiale) și materialul săditor livrat; plățile = cheltuielile (și investițiile, întrebarea 8). Coloanele:
    data · explicație (client / furnizor + categorie) · încasări · plăți · sold cumulat în lună. **Nu există număr de
    document** în bază (doar poza bonului): coloana „Document” lipsește, iar rândul cu poză are link „Bonul”.
    Soldul pornește de la 0 la începutul lunii (nu știm casa de la început; întrebarea 9).
  - **„Registre și exporturi”**: exporturile existente (`ExportRaportSheet`: raportul, registrul de tratamente) +
    „Registrul de încasări și plăți · <luna>” exportat în `.xls` cu `documentHtml` din `lib/rapoarte/export.ts`
    (aceeași cale ca registrul de tratamente, efort mic). Exportul anual complet / pentru contabil rămâne pentru
    promptul următor.
- **Vânzări, Cheltuieli, Investiții**: listă + detaliu + Tabel (tiparul §4). Fișele = conținutul foilor de azi scos în
  `VanzareFisa`, `CheltuialaFisa` (cu fila Investiții pe aceeași pagină, ca acum). Tabel: dată · client / furnizor ·
  categorie · sumă · plată / metodă; totaluri; CSV; în bloc doar „Exportă” (nu adaug acțiuni noi de bani în bloc).
- **Operatorul** nu ajunge aici (regula de acces existentă pe `/rapoarte`, `/vanzari`, `/cheltuieli`); grupul „Bani”
  nu apare în bara lui.

**Fișiere**

- noi: `src/lib/rapoarte/profit-parcela.ts`, `src/lib/rapoarte/registru-casa.ts` (pure),
  `src/components/rapoarte/BaniDesktop.tsx`, `src/components/vanzari/VanzareFisa.tsx`,
  `src/components/cheltuieli/CheltuialaFisa.tsx`;
- modificate: `RapoartePageClient.tsx`, `VanzariPageClient.tsx`, `CheltuieliPageClient.tsx`,
  `src/lib/rapoarte/export.ts` (documentul registrului de casă);
- teste: `src/lib/rapoarte/__tests__/profit-parcela.test.ts` (prețul mediu, parcelele personale, tratament pe 2 parcele
  împărțit după suprafață, parcelă fără suprafață, rândul „Comune”), `registru-casa.test.ts` (încasare parțială,
  vânzare neîncasată nu intră, ordinea pe zi, soldul cumulat, luna fără mișcări).

---

## §9 Formularele pe desktop

**Ce fac — în doi pași, ca să nu dublez nicio logică**

1. **Carcasa în dreapta, pentru toate cele 24 de formulare deodată** (o schimbare în `StepForm.tsx`): la `lg`,
   `DialogContent` devine un panou lipit de marginea dreaptă, **480 px**, cât tot ecranul, cu un fundal estompat ușor
   peste rest (focusul rămâne în panou, Esc / X / „înapoi” trec prin `closeGuard`, ca acum). Sub `lg` clasele de azi
   rămân neschimbate (ecran plin pe telefon, card de 480 px între 768 și 1023 px).
2. **Pașii ca secțiuni pe o singură pagină**: variantă de randare în `StepForm`, nu componentă nouă.
   - API nou, opțional: `sectiuni?: { key: string; titlu: string; continut: ReactNode; gata?: boolean }[]`. Modulul
     care o dă construiește conținutul fiecărui pas exact cu componentele de pas de azi (ex. `ComandaClientStep`,
     `ComandaDetaliiStep`) — se schimbă doar „care pas se randează”, din `if (form.stepKey === …)` în listă.
   - Pe desktop `StepFormFrame` le arată una sub alta, cu titlul fiecăreia, fără „Pasul x din y” și fără bara de
     progres; „Salvează” jos (butonul principal al ultimului pas), activ doar când toate secțiunile sunt `gata`.
     `form.next()` pe desktop derulează la secțiunea următoare în loc să schimbe pagina (pașii care „merg mai departe
     la alegere”, ca alegerea clientului, rămân corecți). Pasul de recapitulare se sare pe desktop (secțiunile sunt
     recapitularea).
   - Alegerile dintr-un pas (data, prețul, nota, care azi țin locul pasului) se deschid în secțiunea lor, în locul
     conținutului, cu „Înapoi” — aceeași regulă ca pe telefon, doar mai mică.
   - `useStepForm`, `clientSyncId`, `markSuccess` / `markFailed`, analytics, `closeGuard`, ecranul de reușită: neatinse.
   - Fără `sectiuni`, formularul merge pe pași, în panou (pasul 1 de mai sus) — nimic nu se strică dacă un modul nu e
     trecut încă.
3. **Tastatura numerică**: pe desktop `NumericKeypad` nu se desenează, iar tastele fizice (cifre, virgulă / punct,
   Backspace, Enter) ajung în același `fields.press` cât câmpul activ (`KgField`) are focus; `KgField` arată cursor ca un
   câmp normal. Asta se face în kit (`NumericKeypad` + `KgField`), deci niciun modul nu se schimbă pentru asta.

**Ce formulare trec pe o pagină (recomandarea mea, întrebarea 12)**

- **Da, în promptul acesta** (cele din §5–§8 și cele scurte): Comandă, Tratament, Cheltuială / Investiție, Lucrare,
  Vânzare rapidă, Client, Culegător, Parcelă, Stadiu, Produs, Am cumpărat (Magazia), Analiză nouă, Montează capcane,
  Linia de plan.
- **Rămân pe pași, în panou**:
  - **Recoltarea pe culegători** (`RecoltareStepForm`): e o buclă „culegător → kg → Salvează + următorul”, gândită pentru
    cântar; pe o pagină ar deveni un tabel de cântăriri, adică alt ecran. Pe desktop rămâne pe pași, cu tastele fizice;
  - **Verifică capcanele** (câte capturi pe fiecare capcană, pe rând), **Plan nou** (pașii depind de „din anul trecut /
    de la zero” și generează conținutul), **Am numărat** (inventar pe rând), **Rezultatul analizei**, **Invită operator**,
    **Ajustare / Pierdere stoc**, **Microclimat**, **Cultură în solar**: pe pași, în panou. Le trec pe o pagină într-un
    prompt următor, dacă vrei.

**Fișiere**

- modificate: `src/components/kit/StepForm.tsx`, `src/components/kit/lib/step-form.ts`, `KgField.tsx`,
  `NumericKeypad.tsx`, `src/components/ui/dialog.tsx` (doar o variantă de poziționare „dreapta” la `lg`, dacă nu se poate
  din clase), formularele din lista „Da” (doar alegerea pasului randat → `sectiuni`);
- teste: `src/components/kit/__tests__/StepForm.test.tsx` (extins: cu `sectiuni` pe desktop toate secțiunile sunt în
  pagină, „Salvează” blocat până la `gata`, `next()` nu schimbă pagina, `closeGuard` la Esc; pe telefon neschimbat),
  `KgField.test.tsx` (tastele fizice pe desktop, nimic pe telefon).

---

## §10 Restul modulelor

| Modul | Pe desktop | Fișa / sursa |
|---|---|---|
| Clienți | listă + fișă + Tabel (nume, telefon, localitate, comenzi în an, kg, de încasat; CSV) | conținutul foii din `ClientPageClient` → `ClientFisa`; `?client=` = `?id=` |
| Culegători | listă + fișă + Tabel (nume, telefon, kg sezon, de plătit; CSV) | foaia din `CulegatorPageClient` → `CulegatorFisa` |
| Recoltări | Tabel pe toată lățimea (data, parcelă, culegător, cal. I, cal. II, lei; totaluri; CSV) + fișa zilei / culegătorului în dreapta | `CulegatorCantaririSheet` → conținut |
| Lucrări | listă + fișă + Tabel (data, parcele, ce, cine, stare) | foaia din `LucrariPageClient` → `LucrareFisa` |
| Stocuri | pagina pe toată lățimea, pe două coloane (cifrele pe cultură stânga, mișcările / ajustările dreapta) | fără fișă nouă |
| Produse | Tabel (produs, cultură, preț, unitate, activ) + fișa produsului în dreapta | `ProdusForm` în panou |
| Material săditor | listă + fișă + Tabel | `DeliverSheet` și foaia de detalii → conținut |
| Setări | două coloane: meniul setărilor (stânga, 300 px, din `SetariPageClient`) + pagina aleasă (dreapta); fiecare sub-pagină `/settings/*` arată meniul alături | `SetariUi` (`ScreenBody`) primește `lg:` |
| Notificări | listă + detaliu (gruparea din `group.ts` în stânga, notificarea cu acțiunile ei în dreapta) | — |
| Asociația | doar carcasa nouă: toată lățimea și antetul desktop; ecranele asociației rămân cum sunt (zona `/asociatie` are bara ei) | întrebarea 13 |
| Admin | carcasa nouă, fără alte schimbări | — |

Fiecare modul păstrează pe telefon foaia de azi (învelișul `BottomSheet` + conținutul scos). Folderele noi intră în
`KIT_RULE_DIRS` dacă nu sunt deja (toate de mai sus sunt deja verificate).

---

## Teste

- **Unitare** (în `include` din `vitest.critical.config.ts`): `meniu.test.ts` (extins), `globala.test.ts`,
  `acasa-desktop.test.ts`, `profit-parcela.test.ts`, `registru-casa.test.ts`, `csv.test.ts`, `comenzi/tabel.test.ts`,
  `parcele/tabel.test.ts`, kit: `VedereListaDetaliu`, `TabelDate`, `StepForm` (extins), `KgField` (extins).
- **E2E desktop** (nou: `e2e/smoke/desktop-35.spec.ts`, proiect nou în `playwright.smoke.config.ts`: `desktop-1280` și
  `desktop-1440`, viewport fix, aceleași `pornesteDemoNou` / `iesiDinCont`; **nu scrie nimic** în demo):
  - fiecare ecran din §3–§8 se deschide (Acasă, Comenzi, Livrări, Parcele, Tratamente cu cele 5 file, Rapoarte,
    Vânzări, Cheltuieli);
  - lista + fișa: clic pe al doilea rând → `?id=` în URL, fișa arată elementul; ↓ mută selecția; „înapoi” din browser
    revine la primul;
  - comutatorul Tabel: apar coloanele și rândul de totaluri; sortarea pe o coloană schimbă ordinea; „Exportă” pornește
    o descărcare (`page.waitForEvent('download')`, fișierul nu se păstrează);
  - căutarea globală: Ctrl K, numele unei comenzi din demo → Enter → `/comenzi?id=…`; numele unei parcele → fișa ei;
  - panoul de formular: „+ Comandă” deschide panoul în dreapta (lățime ~480 px, lipit de margine), Esc îl închide fără
    salvare; din nou, X îl închide; nicio comandă nouă în listă;
  - „text în chenar” (`cautaTextIesit` din 34) pe fiecare ecran nou, la 1280 și 1440.
- **Telefonul neatins**: `pasi-principali.spec.ts` (19), `inapoi-foi.spec.ts`, `text-in-chenar.spec.ts` la 360 —
  neschimbate, trebuie să treacă așa cum sunt. `desktop.spec.ts` din 34 se actualizează la grupurile noi (testează
  desktopul, nu telefonul).
- **Capturi** pentru raport: fiecare ecran atins la 1280 și 1440 (zi; noapte pentru Acasă, Comenzi, Bani) + aceleași
  ecrane la 360 px, ca dovadă că telefonul e la fel.

## Riscuri

1. **Scoaterea conținutului din foi** (Comandă, Client, Aplicare, Parcelă…) atinge cod mult folosit pe telefon. Le fac
   ca mutare pură (aceleași props, același JSX), cu testele existente rulate după fiecare și cu smoke-ul de telefon la
   final. Dacă o foaie are logică legată de `open` (reset la deschidere), fișa primește o `key` pe id.
2. **Volumul**: promptul e mare (10 secțiuni, ~25 de ecrane). Dacă mă opresc la limita de utilizare, ordinea de mai sus
   lasă la final ce e mai puțin folosit (§10 Notificări / Material săditor / Produse, calendarul tratamentelor); restul
   notat în raport.
3. **`useEsteDesktop` la hidratare**: pe server e `false`, deci primul clic după încărcare pe un desktop foarte lent ar
   putea deschide foaia de telefon. Aspectul nu e afectat (e din CSS). Accept riscul; hook-ul se rezolvă înainte de
   prima interacțiune în practică.
4. **Panoul de formular peste lista + fișa**: un formular deschis din fișă (ex. „Editează”) acoperă fișa. E voit (focus
   pe formular, fără fereastră peste fereastră); după salvare fișa se reîncarcă din invalidări.
5. **Profitul pe parcelă estimat** poate fi citit ca cifră exactă. De aceea „estimat” în titlu, regula sub tabel și
   rândul „Comune, neîmpărțite”.
6. **Bara laterală între 768 și 1023 px** — vezi întrebarea 1.
7. **Datele mari** (o fermă cu mii de comenzi): lista și tabelul randează tot ce întoarce interogarea de azi; dacă
   tabelul trece de ~500 de rânduri, randez pe pagini de 100 (fără bibliotecă nouă).

## Raportul de la final

`docs/redesign/raport-35-desktop.md`, pe secțiuni: ce s-a făcut, commit-urile, testele (unitare, e2e la 1280 / 1440,
smoke-ul de telefon la 360), ce n-am putut testa, capturile (1280, 1440, 360) și ce a rămas, în ordine.

---

## Întrebări

1. **Gruparea barei laterale între 768 și 1023 px.** Bara apare de la 768 px din promptul 34. Promptul spune „sub `lg`
   totul rămâne ca acum”, dar e aceeași componentă.
   **Recomand: gruparea nouă (Vânzări · Ferma · Bani) oriunde apare bara, adică de la 768 px**; tot restul (lățimea,
   listă + detaliu, panoul, Acasă B) doar de la 1024 px. Două ordini ale aceluiași meniu, după lățimea ferestrei, ar
   încurca. Telefonul (sub 768 px) rămâne neatins oricum.
2. **Livrări în bara laterală**: separat sau în Comenzi?
   **Recomand: o intrare „Comenzi și livrări”** (→ `/comenzi`, activă și pe `/livrari`), cu comutatorul
   `Comenzi · Livrări azi` în antet. Ambele pagini rămân; pe telefon nimic nu se schimbă.
3. **Ordinea grupurilor**: Acasă · Vânzări · Ferma · Bani · Asociația · (Admin) · Setări jos?
   **Recomand: da**, ca în prototip. Alternativ Ferma înaintea Vânzărilor dacă dimineața începi cu parcelele.
4. **Lățimea maximă a conținutului: 1600 px?**
   **Recomand: 1600 px.** La 1440 px se folosește tot ecranul; pe monitoare de 1920+ px rândurile nu se întind la
   nesfârșit.
5. **Ce arată fișa când nu e nimic ales** (intri pe `/comenzi` fără `?id=`)?
   **Recomand: primul element din filtrul curent**, ales automat (fără să scrie în istoric). Dreapta goală ar fi spațiu
   pierdut.
6. **Panoul de formular: 480 px, cu fundal estompat peste rest?**
   **Recomand: da, 480 px, modal** (focusul rămâne în formular, Esc / „înapoi” merg ca acum). Un panou nemodal, lângă
   care să poți folosi lista, ar cere altă logică de închidere și de nesalvat.
7. **Profitul pe parcelă (Bani și fișa parcelei)**: estimat ca la §8 (venit = kg × prețul mediu; directe = cules +
   tratamente din Magazie; restul pe rândul „Comune”), fără migrare? Sau migrare aditivă `parcela_id` pe
   `cheltuieli_diverse` (și alegerea parcelei în formularul de cheltuială)?
   **Recomand: estimat, fără migrare, acum.** `parcela_id` pe cheltuieli poate veni într-un prompt separat, cu
   formularul lui; cifrele de azi se îmbunătățesc atunci singure.
8. **Investițiile în registrul de încasări și plăți**: intră ca plăți?
   **Recomand: da**, sunt bani ieșiți din casă; marcate „Investiție” în explicație.
9. **Soldul din registru**: cumulat de la 0 la începutul fiecărei luni sau fără coloana „Sold”?
   **Recomand: fără „Sold” acum**, doar totalurile lunii (încasări, plăți, diferența). Un sold real cere soldul casei de
   la început, pe care nu-l avem; un sold de la 0 ar putea fi luat drept casa reală.
10. **Magazia ca a cincea filă pe desktop** (pe telefon a rămas „nu e tab”, decizia din 28)?
    **Recomand: da, doar pe desktop**, cum e în prototip; pe telefon rămâne rândul „Magazia: N produse”.
11. **Calendarul tratamentelor (parcele × săptămâni)**: îl fac?
    **Recomand: da, la final, ca a treia vedere în Aplicări**; dacă nu ajung, rămâne primul în lista din raport.
12. **Formularele pe o pagină**: lista „Da” / „Rămân pe pași” de la §9 e bună?
    **Recomand: da.** Recoltarea pe culegători rămâne pe pași (în panou, cu tastele fizice): e făcută pentru cântar.
13. **Asociația pe desktop**: doar carcasa nouă (toată lățimea, antetul) sau și listă + detaliu pe ecranele ei?
    **Recomand: doar carcasa** în promptul acesta (prototipul o lasă „amânată”); listă + detaliu pentru membri / comenzi
    / produse ale asociației într-un prompt dedicat.
14. **Titlul „Bani și rapoarte”**: doar în bara laterală și antetul de desktop, iar pe telefon rămâne „Rapoarte”?
    **Recomand: da**; pe telefon numele din „Mai mult” nu se schimbă (regula „telefonul rămâne la fel”).
15. **Exportul CSV**: separator `;` și virgulă zecimală (Excel în română) sau CSV „internațional” (`,` și punct)?
    **Recomand: `;` și virgulă**, cu BOM: se deschide corect cu dublu-clic în Excel-ul unui fermier din România.
