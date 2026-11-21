# Prompt 19 — Stocuri, Produse, Rapoarte pe kit

Model: Opus 5.5 · Effort: high · Mod: normal (fără plan) · Sesiune: NOUĂ · Branch: `redesign/stocuri-produse-rapoarte` (pornit din `main` `f79a50a`) · Rezultat: branch verde, cu push, fără merge

## Cum lucrezi

- Lucrezi singur, fără plan și fără să ceri aprobare. Ce te blochează sari, notezi în raport și continui.
- Commit-uri mici, câte unul pe modul (Stocuri, Produse, Rapoarte) sau pe bucată logică, cu push după fiecare. Calculele stau în funcții pure, cu teste unitare.
- Pe kit (`src/components/kit`), cu regulile din `CLAUDE.md` (tokeni canonici, 48/56 px, `StepForm`, `BottomSheet`, noapte, text ≥ 13 px). Model: Recoltări și Tratamente. Adaugi folderele modulelor în `KIT_RULE_DIRS`.
- Dacă îți trebuie o migrare (nu mă aștept), o scrii și **nu o aplici**; doar aditivă.

## Mockup-ul aprobat

`git show origin/redesign/prompturi-11-12:docs/redesign/mockups/stoc-parcele-echipa.html > /tmp/mockup.html` și îl deschizi în browser. Capitolul **1 · Stocuri, Produse, Rapoarte** (ecranele Stocuri, Ajustează stocul, Produse, Produs nou / editare, Rapoarte). Urmezi ecranele și textele. Cifrele sunt de exemplu.

## Deciziile lui Andrei (21.11, toate recomandările acceptate)

1. **Stocul** e doar pentru **zmeură cal. I** (ce intră în comenzi). Merele, murele etc. nu au stoc acum.
2. **Cal. II** apare **informativ** (rând separat, „nu intră în comenzi”), fără să intre în disponibil.
3. **Produse:** imaginile, „magazin public” / linkul de magazin și blocul „Asociație” (`ProductAssociationOfferBlock`) se **ascund** până la magazinul nou. Datele din bază rămân neatinse, iar codul lor nu se șterge (doar nu se mai afișează; un comentariu scurt spune de ce).
4. **Exporturi în Rapoarte:** un singur buton „Exportă” (iconița ⇩ din antet) care deschide o foaie cu **Excel** și **PDF** pentru perioada aleasă, plus **„Registrul de tratamente”**. CSV-ul se scoate.

## Ce faci

### Stocuri (`/stocuri`)
- Sus, cifra mare: „Zmeură cal. I disponibilă · <n> kg”, din `get_sellable_cal1_stock_summary` (`disponibil_cal1_kg`), cu „poți pune în livrare acum”.
- Dedesubt, descompunerea: recoltat în sezon, livrat, în livrare, ajustări (din aceeași funcție / `ajustari_stoc`), astfel încât să se lege la cifra mare. Dacă funcția din bază nu dă exact aceste componente, le afișezi pe cele pe care le dă, fără să inventezi o formulă paralelă.
- Rândul „Cal. II”, informativ (suma `kg_cal2` din recoltări, cu aceeași regulă de sezon `inceputSezon`).
- Istoricul ajustărilor, pe zile, cu motivul și nota.
- **„Ajustează stocul”** în 2 pași (`StepForm`): (1) motivul, plăci mari cu tipurile existente (`AJUSTARE_STOC_TIP_LABELS`); (2) kg pe `NumericKeypad` / `KgField` (pornește gol) + notă opțională. Corecția în minus nu poate duce disponibilul sub 0 (dacă regula există deja în bază, o respecți și afișezi mesajul frumos). Înlocuiește `AjustareStocDialog` vechi.

### Produse (`/produse`)
- Lista: file Active / Inactive, căutare, rânduri cu nume, unitate (+ gramaj), categorie, preț. Notă scurtă că prețul la comenzi vine din „Prețul standard” din Setări.
- Formular produs (nou / editare) pe kit: nume, „se vinde la” (kg / casoletă / ladă / bucată, din valorile reale ale coloanei), gramaj, preț, categorie, comutator „Activ”. Ștergerea cu confirmare; un produs folosit în comenzi sau vânzări se poate doar dezactiva (verifici cheile străine și afișezi mesajul potrivit).
- Ascunzi câmpurile de magazin și asociație (decizia 3).

### Rapoarte (`/rapoarte`)
- Perioada: Luna / Sezonul / Anul (sezonul = `inceputSezon`, aceeași regulă ca în rest).
- Sus profitul (încasat − cheltuieli, fără investiții), apoi plăcile: Încasat, Cheltuieli, Recoltat (kg), Investiții (separat, cum e deja din promptul 17).
- Graficul „Încasat și cheltuieli, pe luni” ca bare HTML (fără bibliotecă nouă).
- Liste comutate Parcele / Culegători / Clienți: kg pe parcelă (cu kg/plantă din `nr_plante`), kg și plată pe culegător, încasat pe client. Parcelele „personale” (`rol = 'personal'`) nu intră la kg vândute / venit.
- **Toate calculele de bani** trec prin funcțiile existente (`ziuaVenitului`, `investitiiInPerioada`, `calculateProfit`), nu calcule noi.
- **Exportă** (decizia 4): Excel (formatul HTML-`.xls` existent e bun) și PDF (fereastra de tipărire existentă); **„Registrul de tratamente”** pentru perioadă, cu **ambele surse**: aplicările noi (`aplicari_tratament` + produse, prin `src/lib/tratamente`) și activitățile vechi de tip tratament. Coloane: data, parcela, metoda, produsul, substanța, doza, cantitatea, pauza, data de la care se poate recolta. CSV scos.
- Filtrele vechi (cultură, parcelă, tip raport) le păstrezi doar dacă încap firesc în ecranul nou; altfel le scoți și notezi.

### În tot
- Desktopul doar „să meargă” (nimic stricat la 1280×800).
- Mai mult: intrările spre Stocuri, Produse, Rapoarte rămân; dacă textele lor de sub titlu sunt depășite, le actualizezi.

## Ce NU faci

- Mediul local folosește **baza de PRODUCȚIE**. Din bază doar citești (`select`). Testele manuale se fac **doar într-un cont demo nou**.
- Nu aplici migrări, nu apelezi cronuri, nu schimbi variabile de mediu.
- Nu atingi `public/sw.js` și nu slăbești `.claude/settings.json`.
- Nu ștergi codul magazinului / asociației; nu atingi Parcele, Activități, Echipa, Documente (vin în prompturile 20 și 21).

## Verificare în demo (la final), la 390×844, zi și noapte

- Stocuri: cifra mare se leagă de descompunere; o ajustare „Pierdere 2 kg” scade disponibilul cu 2 și apare în istoric; o corecție în minus peste disponibil e refuzată frumos.
- Produse: un produs nou, editat, dezactivat; câmpurile de magazin nu apar.
- Rapoarte: Luna / Sezonul / Anul; profitul = încasat − cheltuieli; investițiile separat; exportul Excel, PDF și registrul de tratamente (cu un rând nou și unul vechi).
- O trecere la 1280×800.

## Raportul

- ce ai schimbat, pe module, cu commit;
- migrarea (dacă a fost cazul), cu SQL complet;
- ce filtre / funcții vechi ai scos și de ce;
- ce n-ai putut testa;
- verificările: lint, typecheck, check:kit, test:critical:unit, build;
- lista commit-urilor, cu hash.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
