# Planul promptului 34 — final: corecturile de pe ferma reală + desktopul pe interfața nouă

Promptul: `docs/redesign/prompts/34-final.md`. Am citit `CLAUDE.md`, `docs/redesign/` (tokens, audit, progres,
raport-25 pentru desktop, raport-30 … raport-33) și codul atins de fiecare secțiune. **N-am scris cod.**

## Pe scurt

- **Nicio migrare.** Toate secțiunile merg pe coloanele existente (detalii la §7 și §8). Dacă alegi altfel la
  întrebările 6 sau 8, scriu migrarea aditivă și o pun aici înainte de cod.
- **Cauza blocării de la §5 e găsită în cod**: fiecare foaie închisă din buton, după salvare sau din „Esc” lasă în urmă
  o intrare de istoric pentru aceeași adresă. După 3 foi, „înapoi” trebuie apăsat de 4 ori ca să iasă din pagină;
  primele 3 apăsări nu fac nimic vizibil.
- **`package.json`**: scot `react-grid-layout` și `react-resizable`. Motivul: le folosește doar editarea grilei de pe
  `/dashboard` (`DashboardEditableGrid.tsx`, `grid-compact.ts`), care se șterge la §10. Altă schimbare în
  `package.json` nu fac.
- **Branch** `redesign/34-final` din `origin/main` (`a5b60e1`). Commit + push după fiecare secțiune, fără merge.
  Commit-urile adaugă fișierele pe nume (fără `git commit -a`), fără `public/sw.js`.
- **Ordinea de lucru** (nu cea din prompt): §3 → §1 + §2 → §6 → §5 → §7 → §8 → §9 (reparațiile) → §4 → §10 →
  §9 (testul, la 360 și 1440 px) → raportul. §3 întâi pentru că scoate locul lăsat liber pentru bula beta în 18 ecrane,
  care se schimbă oricum la §6 și §10. Testul de la §9 vine după §10, fiindcă rulează și la 1440 px.
- **Înainte de fiecare push**: `npm run test:critical:unit`, `npm run check:critical`, `npm run build`. La final și
  `npm run test:e2e:smoke` și testele noi (`next start`, demo nou din `/start`).

---

## §3 Scot punctul verde „Ești în beta”

**Ce fac**
- Scot `BetaWidget` din `DashboardShellFloatingOverlays`; rămâne doar panoul AI.
- Șterg `src/components/beta-widget.tsx`: nu-l mai folosește nimeni. Șterg și CSS-ul `.beta-widget`, dacă există în
  `globals.css`.
- În Mai mult există deja rândul „Ajutor · Scrie-mi pe WhatsApp” (`SUPPORT_WHATSAPP_URL`). Îl redenumesc
  „Scrie-mi o problemă sau o sugestie” (dedesubt: „pe WhatsApp”) și îl ascund pentru superadmin. Nu adaug un al
  doilea rând.
- Cele 18 ecrane cu buton mare fixat jos lasă azi 72 px liberi în stânga, pentru bulă (`pl-18`). Scot spațiul acela.
  Butonul ia toată lățimea, cu aceeași margine în ambele părți. Wrapper-ul îl mut în `AppShell` (vezi §6), deci
  ecranele trimit doar butonul.

**Fișiere**
- Șterse: `src/components/beta-widget.tsx`.
- Modificate:
  - `src/components/layout/DashboardShellSlots.tsx`;
  - `src/app/(dashboard)/mai-mult/MaiMultPageClient.tsx` (de la §10, rândul vine din sursa comună);
  - cele 18 ecrane cu `pl-18`: Cheltuieli, Clienți, Comenzi, Culegători, Lucrări, Parcele (listă și fișă), Produse,
    Recoltări, Echipa, Stocuri, Tratamente, fișa capcanelor, Magazia, fișa produsului din Magazie, Planul întreg,
    Vânzări, Actele fermei.

**Teste**
- Mai mult: rândul apare pentru proprietar și operator și lipsește pentru superadmin. Test de componentă nou, în
  `include`.

**Riscuri**
- Superadminul nu mai are rândul de sugestii. E intenționat: ești chiar tu.

---

## §1 Lăstari: „Tai tot / Păstrez” la rândurile vechi

**De ce lipsesc butoanele azi**
- `stadiiPeLastari` (`src/lib/parcele/lastari.ts`): în `an1_an2`, rândurile fără cohortă nu sunt ale niciunui lăstar.
  Dacă parcela are doar rânduri vechi, ele se citesc ca un singur stadiu „fără lăstar” (`lastar: null`).
- Foaia Stadiul (`StadiuStepForm.tsx:95`) caută stadiul lăstarului ales (`primocane`). Nu-l găsește, deci
  `actiuniCiclu` primește `null` și nu întoarce nimic.
- Același lucru se întâmplă când parcela are rânduri pe floricane (de aici modul `an1_an2`), dar „După recoltare” a
  fost salvat fără cohortă.

**Ce fac**
- Funcție pură nouă, `stadiuPentruCiclu(stadii, mod, lastar)`. În `an1_an2`, pentru `primocane`, ia ultimul rând dintre
  cele cu cohorta `primocane` **sau fără cohortă** (aceeași ordine, `comparaRanduri`). Pentru `floricane`, doar
  rândurile `floricane`. În celelalte moduri întoarce stadiul obișnuit.
- `stadiuCurentParcela` întoarce un câmp nou, `ciclu: { floricane?, primocane? }`. Foaia îl folosește **doar** pentru
  butoanele ciclului. Datele nu se rescriu, iar textul de pe card și planul rămân pe regulile de acum.
- Corectez și regula care citește rândurile vechi. Azi, după „Tai tot” (un rând `taiat` pe primocane, cu cohortă),
  ambii lăstari rămân fără stadiu. `stadiiPeLastari` cade atunci înapoi pe rândul vechi fără cohortă, iar cardul
  arată mai departe „După recoltare”. Regula nouă: rândurile vechi se citesc „ca până acum” doar cât parcela **nu are
  niciun rând cu cohortă**.

**Fișiere**
- Modificate:
  - `src/lib/parcele/lastari.ts`;
  - `src/lib/parcele/stadiu-curent.ts`;
  - `src/components/parcele/StadiuStepForm.tsx` (prop-ul `ciclu`, transmis de fișă);
  - `src/app/(dashboard)/parcele/[id]/ParcelaFisaClient.tsx`;
  - `src/components/parcele/useStadiiParcele.ts`, doar dacă tipul o cere.

**Teste** (`src/lib/parcele/__tests__/lastari.test.ts`, extins)
- `an1_an2` cu un singur rând vechi `post_recoltare` fără cohortă: pe primocane apar `tai_tot` + `pastrez`, pe
  floricane nimic.
- Rânduri pe floricane + „După recoltare” fără cohortă: la fel.
- După „Tai tot” (un `taiat` primocane mai nou): butoanele dispar, iar cardul nu mai arată „După recoltare” de pe
  rândul vechi.
- Modurile `an1` / `an2` rămân neschimbate (testele existente).

**Riscuri**
- Dacă `parcele.mod_lastari` nu e pus și parcela n-are rânduri pe floricane, modul calculat e `an1`, iar ciclul nu
  apare (așa e regula din 33). La ferma ta, butoanele apar doar dacă e ales „An 1 + an 2”. Pentru asta trebuie
  aplicată migrarea `20261125110000`. Verific, doar prin citire, dacă e aplicată și scriu rezultatul în raport.

## §2 „Lăstar an 1: Tăiat” pe fișa parcelei

**Ce e azi**
- Rândul `taiat` apare doar în **jurnalul** fișei, ca „Lăstar an 1: Tăiat”, sub ziua lui.
- Pe cardul stadiului, un `taiat` ca ultim rând înseamnă „fără stadiu”: lăstarul dispare din text, iar dacă ambii sunt
  fără stadiu, cardul spune „Fără stadiu notat”.

**Ce propun** (întrebarea 1)
- Jurnalul rămâne cum e.
- Pe card, lăstarul tăiat se vede cu data, până la următorul stadiu al lui. Exemple: „An 2: În repaus · An 1: tăiat pe
  12 oct.” sau „Lăstar an 1: tăiat pe 12 oct.”.
- Planul, notificările și „A început…?” tratează `taiat` ca acum (fără stadiu).
- Funcția pură e `textStadiiLastari`, cu o intrare nouă „tăiat la zi”.

**Fișiere**
- Modificate: `lastari.ts`, `stadiu-curent.ts`.

**Teste**
- Textul cardului cu un lăstar tăiat, cu doi lăstari dintre care unul tăiat, și după un stadiu nou al lăstarului
  tăiat (eticheta dispare).

---

## §6 Fișa parcelei

**1. Titlurile tăiate**
- `ListRow` (kit) are titlul pe un rând, cu „…” (`truncate`).
- Propun (întrebarea 2): titlul trece pe **cel mult două rânduri** (`line-clamp-2`, `break-words`), peste tot, nu doar
  pe fișă. Același lucru l-ar cere oricum testul de la §9, pe toate ecranele.
- Detaliul rămâne pe cel mult două rânduri. Rândul crește pe înălțime (`min-h-[68px]` rămâne minimul).
- Actualizez comentariul din `ListRow` și testul kitului.

**2. Notița albastră dublată**
- `CulesSiAnalizaParcela.tsx` arată „Pune data culesului pe parcele…” doar când nicio parcelă nu are dată
  (`faraNicioData`). Pe fișă, asta înseamnă că nici parcela deschisă n-are dată, deci rândul „Pune data culesului”
  e deja acolo.
- Scot notița de pe fișă (un prop `ascundeNotitaFaraData`, folosit doar pe fișă). Mementoul din Acasă rămâne.

**3. „+ Lucrare / + Tratament” acoperă jurnalul**
- Azi fiecare ecran ghicește spațiul de jos (`pb-28` în `ScreenBody` + `pb-28` / `sm:pb-32` în `AppShell`).
- Cu text mare și zona sigură, nu ajunge.
- `AppShell` (`bottomBarFixed`) măsoară bara fixă (`ResizeObserver`) și pune jos spațiu de
  `înălțimea barei + 12 px + bara de jos (--app-nav-clearance, care include zona sigură) + 16 px`.
- Ecranele nu mai pun `pb-28` de mână acolo unde au bară fixă.
- Wrapper-ul barei (lățimea coloanei, marginile) stă în `AppShell` (vezi §3).

**Fișiere**
- Modificate:
  - `src/components/kit/ListRow.tsx`;
  - `src/components/kit/__tests__/` (testul `ListRow`);
  - `src/components/analize/CulesSiAnalizaParcela.tsx`;
  - `src/components/app/AppShell.tsx`;
  - `ParcelaFisaClient.tsx` și ecranele cu `bottomBarFixed` (aceleași 18 de la §3).

**Teste**
- Kit: titlul `ListRow` are `line-clamp-2`, nu `truncate`.
- `CulesSiAnalizaParcela`: pe fișă, fără dată, apare doar rândul.
- E2E (în testul de la §9): pe fișă, la 360 px și cu text mare, după derularea până jos, `Segments` „Jurnal / Sezon” și
  ultimul rând din jurnal nu se suprapun cu bara fixă (comparația dreptunghiurilor).

**Riscuri**
- Rândurile cu nume lungi (clienți, produse) devin mai înalte. E o schimbare vizibilă în toate modulele refăcute.

---

## §5 Blocarea la „înapoi”

**Ce am găsit (din cod)**

Mecanismul e în `src/components/ui/dialog.tsx` (rădăcina lui `BottomSheet` și `StepForm`), plus
`useGuardedOpenChange` din `StepForm.tsx` și `src/lib/ui/dialog-history.ts`.

1. **Foile lasă intrări în istoric.** La deschidere, foaia face `history.pushState` (o intrare nouă, aceeași adresă).
   La închiderea din buton, X, salvare sau Esc, doar scoate marcajul (`stripDialogHistoryMarker` = `replaceState`), iar
   intrarea **rămâne**. Comentariul spune de ce: un `history.back()` ar fi putut închide pagina-părinte.
   - Pe fișă, „⋯” → X lasă 1 intrare; „⋯” → „Editează” → salvează lasă 2; „Actualizează” (Stadiul) → salvează lasă 1.
   - După trei foi, primele 3 „înapoi” trec doar prin intrări cu aceeași adresă (Next nu schimbă nimic pe ecran), iar
     abia a 4-a iese din fișă. Asta e „blocarea”.
2. **Ascultătorul se pierde.** Când părintele dă un `onOpenChange` nou la fiecare randare (funcție scrisă direct în
   JSX, de ex. foaia „Cum lucrezi lăstarii” de pe fișă), efectul din `ui/dialog` se reia. La reluare iese devreme,
   pentru că intrarea „există deja”, și **nu mai pune ascultătorul**. „Înapoi” consumă atunci intrarea, iar foaia rămâne
   deschisă.
3. **O navigare cu foaia deschisă** (de ex. „Vezi toate notificările” din foaia clopoțelului) lasă intrarea foii în
   urma paginii noi. Din pagina nouă, „înapoi” cere două apăsări.

Tragerea în jos nu există azi (`ui/sheet` nu are gest). Am verificat doar butoanele, salvarea, Esc și „înapoi”.

**Ce propun** (întrebarea 3)

Un singur mecanism, în `ui/dialog`, care nu mai scrie în istoric:
- **Unde browserul are `CloseWatcher`** (Chrome / Edge pe Android și pe desktop, inclusiv aplicația instalată): fiecare
  foaie deschisă își face un „close watcher”. Gestul „înapoi” de pe Android (și Esc pe desktop) închide **doar foaia de
  deasupra**, fără nicio intrare în istoric. Orice închidere lasă istoricul exact cum l-a găsit.
- **Unde nu există** (Safari pe iPhone, Firefox): fără intrări în istoric. „Înapoi” se comportă ca pe o pagină
  obișnuită: iese din ecran, iar foaia se închide odată cu el. În aplicația instalată pe iPhone nu există gestul
  „înapoi”, deci nu se pierde nimic acolo.
- `closeGuard` din `StepForm` rămâne: o închidere oprită refac watcher-ul, ca următorul „înapoi” să ajungă tot la
  confirmare. Esc vine pe două căi (Radix + `CloseWatcher`); a doua cerere se ignoră cât închiderea e în curs.
- Scot `stripDialogHistoryMarker`, `DIALOG_HISTORY_MARKER` (`dialog-history.ts` se șterge), apelul din
  `dialog-form-actions.tsx` și prop-ul `disableHistory` (`AppDrawer`). Logica nouă stă într-un hook,
  `src/lib/ui/useInchideLaInapoi.ts`, cu `onOpenChange` ținut într-un `ref`, ca o funcție nouă să nu mai scoată
  ascultătorul.

**Reproducere și test** (`e2e/smoke/inapoi-foi.spec.ts`, Pixel 7, în demo-ul smoke)
- `/parcele` → fișa Maravilla 1 (în demo-ul Fructe de pădure).
- „⋯” → X; „⋯” → „Editează” → X; „Actualizează” → Esc.
- Apoi `page.goBack()` o singură dată: adresa trebuie să fie `/parcele` din prima. **Testul îl scriu întâi și îl văd
  picând pe codul de azi**; reproducerea o pun în raport.
- Testul încă o dată, cu salvarea unui stadiu în foaie (scriere doar în demo).
- O foaie deschisă + Esc (cererea de închidere pe desktop): foaia se închide, adresa nu se schimbă.
- Test unitar pentru hook: cu și fără `CloseWatcher` (simulat), nicio chemare `pushState` / `back`.

**Fișiere**
- Noi: `src/lib/ui/useInchideLaInapoi.ts`, `e2e/smoke/inapoi-foi.spec.ts`, testul unitar al hook-ului.
- Modificate: `src/components/ui/dialog.tsx`, `src/components/kit/StepForm.tsx`, `src/components/ui/dialog-form-actions.tsx`,
  `src/components/app/AppDrawer.tsx`.
- Șterse: `src/lib/ui/dialog-history.ts`. Linia lui din `check-brand` (`__zmeurelDialog`) dispare.

**Riscuri**
- `ui/dialog` e folosit și de modulele vechi (Asociație, Admin, Material săditor), care primesc același comportament.
  E mai bun, dar se schimbă peste tot.
- `page.goBack()` din Playwright nu e o „cerere de închidere”: „înapoi” cu foaia deschisă îl verific cu Esc. Gestul
  real de pe Android îl poți confirma doar tu, pe telefon (scris în raport).
- „Înapoi” nu închide foaia pe telefoanele cu browser fără `CloseWatcher`. Varianta cu istoric reparat e
  alternativa de la întrebarea 3.

---

## §7 Lucrări → „Altele”

**Cum salvez textul, fără migrare**
- `tip_activitate` primește `Altele: <ce ai scris>`, de exemplu `Altele: Plasă de umbrire: demontat și legat`.
  Coloana n-are listă de valori (am verificat migrările).
- `tipLucrareDin` recunoaște întâi prefixul `altele:` → `altele`, ca euristicile („curăț” → tăiere, „udat” → irigație)
  să nu reclasifice textul liber.
- `tipDinActivitateVeche` (Tratamente) nu-l ia drept tratament: potrivește doar valori exacte și `tratament*`. Pun și
  un test.
- Titlul în jurnal (fișa parcelei, Lucrări, Acasă) = textul de după prefix. Lucrările „Altele” vechi rămân ca acum:
  „Altele”, plus textul vechi dedesubt, unde există (`tipOriginalPentruAltele`).

**Ce fac**
- `CiornaLucrare` are câmpul nou `ceAiFacut`. La „Altele”, pasul 2 are câmpul obligatoriu „Ce ai făcut?” (`BigInput`,
  80 de caractere, primul în pas). `ceLipsesteLucrare` întoarce `'ceAiFacut'`, iar „Salvează” e inactiv până îl scrii.
- La editarea unei lucrări „Altele” noi, câmpul vine completat. La una veche, vine cu textul vechi, dacă există, și e
  tot obligatoriu.
- **Alegeri rapide în pasul 1**: sub plăci, „Folosite des” cu cel mult 5 texte. Le derivă `alegeriRapideAltele` (pură)
  din lucrările fermei deja încărcate (cheia `lucrari`): grupate fără diferențe de majuscule și diacritice, ordonate
  după câte apariții, apoi după cea mai nouă. O alegere pune tipul „Altele” + textul și trece la pasul 2. Fără tabel
  nou.
- Fără tip fix nou pentru plasă (întrebarea 4).

**Fișiere**
- Modificate:
  - `src/lib/lucrari/tipuri.ts` (`tipLucrareDin`, `titluAltele`, `VALOARE_LUCRARE_DB` → `valoareTipActivitate(ciorna)`);
  - `src/lib/lucrari/formular.ts`, `src/lib/lucrari/jurnal.ts`;
  - `src/lib/parcele/jurnal-parcela.ts`, `src/lib/dashboard/acasa.ts` (titlul lucrării planificate);
  - `src/components/lucrari/LucrareStepForm.tsx`.
- Nou: `alegeriRapideAltele`, în `src/lib/lucrari/altele.ts`.

**Teste**
- `tipuri`:
  - prefixul se citește `altele`, inclusiv cu „curățat”, „udat” sau „tratament” în text;
  - un „Altele” vechi rămâne „Altele”.
- `formular`: rândul salvat are `tip_activitate` = `Altele: …`, iar fără text nu se poate salva.
- `altele`: top 5 (frecvență, egalitate, diacritice, rânduri vechi ignorate).
- Componentă: pasul 2 cere textul la „Altele”, iar o alegere rapidă completează.

**Riscuri**
- Locurile care afișează `tip_activitate` brut (chatul AI, exportul vechi) arată „Altele: Plasă…”. E lizibil, așa că
  le las.

---

## §8 Tratament → „La sol”

**Ce e azi**
- **Formularul** (`PasDetalii.tsx` → `DetaliiSol`):
  - parcelele, apoi pe fiecare produs „cât în total”, cu `NumberStepper` (pas 1, max 100 000) și unitatea
    Kilograme / Litri;
  - nu există tone, nici doză la ha, nici conversie afișată;
  - „g/plantă” există doar la Fertirigare.
- **Produsul**:
  - din catalog sau din „Folosite recent”;
  - „Nu e în listă” creează un **produs al fermei** în catalog (nume, tip, pauză);
  - nu se poate scrie un nume doar pentru tratamentul acesta.
- **Salvarea** (`aplicariDeSalvat`):
  - totalul se împarte pe parcele după suprafață (la suprafețe lipsă, în părți egale);
  - pe rând: `cantitate_totala` = partea parcelei, `unitate_cantitate` = `kg` / `l`, `cantitate_text` = „X kg”;
  - `doza_*` rămân goale.
- **Registrul** (`registru-tratamente.ts`):
  - Cantitatea apare corect: „X kg” / „X l”.
  - Doza rămâne goală la sol.
  - Tot aici, o greșeală mai veche: la stropire „la ha” cu pulbere, `doza_l_per_ha` ține kg/ha, dar registrul scrie
    „l/ha”.
- **Jurnalul** (fișa, Tratamente): „<produs> X kg”.
- **Magazia**: triggerul scade doar produsele cu `produs_id` din magazie, după `unitate_cantitate` (kg / l). Un produs
  scris de mână nu atinge magazia.

**Ce fac (fără migrare)**
- **Cum scrii cantitatea** (`Segments`): „Pe parcele (total)” / „La ha”.
- **Unitatea**: kg / t / l. Tonele doar la solide; în bază se scriu în kg (`unitate_cantitate` nu acceptă `t`, iar
  constrângerea n-o ating).
- **La ha**: `doza_l_per_ha` = cantitatea la ha, în unitatea mare (kg/ha sau l/ha), cum se scrie deja la stropirea „la
  ha”. Totalul = doza × suprafața parcelelor; pe parcelă, după suprafața ei. Fără suprafață pusă, „La ha” e inactiv,
  cu mesajul de la stropire.
- **Conversia afișată**, sub câmp: „3 t/ha × 0,25 ha = 750 kg” sau „750 kg pe 0,25 ha = 3 t/ha”. Pe fiecare parcelă,
  partea ei, ca la stropire.
- **Produs scris de mână** (doar la „La sol”):
  - în alegerea produsului, „Scrie numele” (de ex. „Gunoi de grajd”), cu alegerea rapidă „Gunoi de grajd”;
  - se salvează ca `produs_nume_manual`, fără catalog și fără magazie, cum se salvează deja produsele „recente” fără
    catalog;
  - pauza e 0, iar avertizările de catalog nu se aplică.
- **`cantitate_text`**: textul omului, de ex. „1,5 t (3 t/ha)”, ca să rămână cum a scris.
- **Registrul**:
  - doza la sol: „3 t/ha” sau „3 kg/ha”, după unitate;
  - cantitatea: kg sub 1 000, t de la 1 000 („1,5 t”);
  - repar și „l/ha” → „kg/ha” la stropirea cu pulbere.
- **„Repetă”** (`ciornaDinTratament`): citește modul (total / la ha) și unitatea înapoi.

**Fișiere**
- Modificate:
  - `src/lib/tratamente/formular.ts` (`ProdusCiorna`: `modSol`, `unitateSol`; `ceLipseste`, `aplicariDeSalvat`,
    `ciornaDinTratament`);
  - `src/lib/tratamente/doze.ts` (`formatCantitateSol`, conversiile);
  - `src/components/tratamente/PasDetalii.tsx`, `AlegeProdus.tsx`, `TratamentStepForm.tsx` (rezumatul);
  - `src/lib/rapoarte/registru-tratamente.ts`;
  - `src/lib/tratamente/jurnal.ts` (textul cu t).

**Teste**
- `formular`:
  - total în t → kg pe parcele;
  - la ha → total și părți după suprafață;
  - fără suprafață → „La ha” refuzat;
  - produs manual (`produs_id` null, `produs_nume_manual` pus);
  - „Repetă”.
- `registru`: „3 t/ha” / „1,5 t”; „kg/ha” la stropirea cu pulbere.
- Componentă: conversia afișată.

**Riscuri**
- Rândurile vechi „La sol” se citesc ca înainte (total, kg / l).

---

## §9 Textul care iese din chenar

**Reparațiile știute**
- **„Ce fel de produs”** (`AlegeProdus.tsx`, formularul „Produs nou”):
  - plăcile trec pe 2 coloane (`columns={2}`);
  - în kit, titlul plăcii mici primește `break-words` și `min-w-0`, ca un cuvânt lung să nu iasă din placă niciodată
    (fără despărțire în silabe).
- **„Cantitate” în „Am cumpărat”** (`KgField size="md"`, pe două coloane cu „Preț total”):
  - la `md`, eticheta trece deasupra valorii, valoarea are `min-w-0`;
  - cifrele se micșorează după lungime: până la 6 caractere 22 px, peste 6 caractere 19 px, peste 8 caractere 17 px;
  - ramura `hero` (Recoltări) nu se schimbă.
- **„Sigur?”** (întrebarea 5):
  - peste prag, „Salvează” arată în pas „Sigur? 846.488 kg de <produs>” cu „Da, salvez” / „Corectez”;
  - pragurile propuse: **kg > 2.000**, **l > 500**, **buc > 500** (`src/lib/magazie/praguri.ts`, testat).

**Testul** (`e2e/smoke/text-in-chenar.spec.ts`, în demo-ul smoke)
- Proiecte: 360 × 800 normal, 360 × 800 cu „Mărimea: Mare” (`localStorage.ui_preferences = {"density":"large"}`
  înainte de prima pagină) și 1440 × 900 (după §10).
- Ecranele:
  - Acasă, Livrări, Recoltări, Comenzi, Mai mult;
  - Tratamente pe cele 4 taburi, Magazia, Parcele + fișa Maravilla 1, Lucrări, Echipa, Setări.
- Foile, deschise și închise fără salvare, cu toți pașii prin care se trece fără să scrii:
  - Recoltare nouă, Comandă nouă, Lucrare nouă (cu „Altele”), Tratament nou (cu „La sol”);
  - Am cumpărat (cu 846488 în cantitate), Produs nou, Stadiul.
- Verificarea, într-un `page.evaluate`, pe elementele vizibile: butoane, linkuri, `role=radio|checkbox|tab|switch`,
  câmpuri, `h1–h3`, titlurile `ListRow` / `Tile` / `StatTile` / `KgField`. Pică dacă:
  - textul e tăiat: `text-overflow: ellipsis` sau `overflow` ascuns, cu `scrollWidth > clientWidth + 1`; sau
    `-webkit-line-clamp`, cu `scrollHeight > clientHeight + 1`, unde derularea nu e permisă;
  - textul iese din chenar: dreptunghiul textului (`Range.getBoundingClientRect`) depășește chenarul elementului cu
    mai mult de 1 px;
  - pagina se derulează pe orizontală.
- Excepțiile stau într-o listă din test (selector + motiv), goală la început; adaug doar ce e intenționat și scriu în
  raport.
- Raportul de eșec: ecranul, selectorul, textul, cât depășește. Repar tot ce găsește, apoi îl rulez până trece.

**Fișiere**
- Modificate: `src/components/kit/Tile.tsx`, `src/components/kit/KgField.tsx`, `src/components/tratamente/AlegeProdus.tsx`,
  `src/components/magazie/AmCumparatStepForm.tsx`, plus ce găsește testul.
- Noi: `src/lib/magazie/praguri.ts` (+ test), `e2e/smoke/text-in-chenar.spec.ts`, `e2e/smoke/text-in-chenar.ts`
  (verificarea, refolosită).

**Riscuri**
- Testul poate găsi multe în modulele refăcute (titluri `truncate` în `ScreenHeader`, `StatusPill`, `FilterPills`).
  Le repar pe rând; dacă sunt foarte multe, scriu în raport ce a rămas, în ordine.
- 3 proiecte × ~20 de ecrane: rulează câteva minute, local, nu în CI.

---

## §4 Invitația de instalare

**Ce fac**
- **Refolosesc logica**, nu aspectul (cel din magazin are culorile magazinului și `z-[70]`).
  - Scot din `PWAInstallPrompt.tsx` în `src/lib/pwa/instalare.ts`: `esteInstalata()` (display-mode standalone +
    `navigator.standalone`), `esteIphone()`, prinderea `beforeinstallprompt` și `cereInstalarea()`.
  - Magazinul importă aceleași funcții. Cheile (`pwa_dismissed`, 90 de zile), întârzierea și textele lui rămân
    neschimbate.
  - `public/sw.js` nu-l ating.
- **Când apare banda** (întrebarea 7):
  - doar cont real, nu demo;
  - și pentru operator: lucrează tot de pe telefon;
  - de la a doua zi de folosire **sau** după prima salvare: prima zi și prima salvare stau în `localStorage`
    (`zmeurel_instalare`), iar salvarea o semnalează `form.markSuccess()` din `useStepForm`, un singur loc pentru
    toate formularele refăcute;
  - nu apare dacă aplicația e instalată.
- **Unde apare banda**:
  - doar pe telefon (sub 768 px) și doar pe Acasă. Acasă n-are buton mare fixat jos, deci banda nu acoperă nimic;
  - stă deasupra barei de jos (`z-fab`); butonul „+” urcă cu înălțimea ei (variabila `--banda-instalare-h`).
- **Banda**: „Pune Caietul pe ecranul telefonului” + „Instalează” + X.
  - Pe Android, cu promptul prins: promptul sistemului.
  - Pe iPhone: o foaie cu „Apasă Distribuie (pătratul cu săgeata) → Adaugă pe ecranul principal”.
  - Pe Android fără prompt: „meniul ⋮ → Instalează aplicația”.
  - X sau „Nu acum” = ascunsă 30 de zile.
- **În Mai mult**: rândul „Instalează aplicația”, cât aplicația nu e instalată (și în demo), care deschide același
  lucru.

**Fișiere**
- Noi: `src/lib/pwa/instalare.ts` (+ test), `src/components/pwa/BandaInstalare.tsx`, `src/components/pwa/FoaieInstalare.tsx`.
- Modificate: `src/components/pwa/PWAInstallPrompt.tsx` (doar importurile), `src/app/(dashboard)/layout.tsx`
  (ascultătorul `beforeinstallprompt`, pus devreme), `src/components/kit/StepForm.tsx` (`useStepForm.markSuccess`), Acasă,
  `MaiMultPageClient.tsx`, `UnifiedMobileFab.tsx`.

**Teste**
- `instalare`: demo → nu; prima zi → nu; a doua zi → da; după o salvare → da; închisă acum 10 zile → nu; acum 31 de
  zile → da; instalată → nu.
- Componentă: Android cu prompt / iPhone cu foaia.
- Magazinul: testul existent, dacă există; altfel unul mic, că `PWAInstallPrompt` se arată ca înainte.

**Riscuri**
- `beforeinstallprompt` vine o singură dată pe încărcare. Ascultătorul trebuie pus în layout, nu în bandă.
- N-am cum testa promptul real de instalare în Playwright. Îl verifici tu pe telefon.

---

## §10 Desktopul pe interfața nouă

**Ce e azi**
- Bara laterală (`Sidebar.tsx`, 645 de linii) are propria listă: „Dashboard”, grupurile Fermă / Comercial /
  Finanțe / Administrare, cu emoji.
- `PageHeader` → `CompactPageHeader` desenează la `lg` antetul verde, cu „Comenzi · Livrări · Recoltări · Clienți”,
  clopoțelul, butonul de adăugare și contul.
- Ecranele cu `ScreenHeader` (Tratamente, Parcele, Setări …) n-au pe desktop nici clopoțel, nici cont.
- `/dashboard` (1.810 linii) are două stive: `AcasaMobile` sub 768 px și grila veche de carduri + „Editează” peste.
- Coloana modulelor e `max-w-xl` (576 px) sau `max-w-2xl` (672 px), în ~30 de locuri.
- `BottomSheet` pe desktop e o foaie lipită de jos, lată de 448 px.

**Ce fac**
1. **O singură sursă de navigație**: `src/lib/navigatie/meniu.ts` (date pure + reguli).
   - **Principale**: Acasă · Livrări · Recoltări · Comenzi.
   - **Grupurile din Mai mult**:
     - „Ferma”: Tratamente, Magazia, Parcele, Lucrări, Stocuri, Produse, Material săditor, Rapoarte;
     - „Bani și oameni”: Vânzări, Cheltuieli, Investiții, Clienți, Culegători;
     - Asociația (dacă ai rol) și Admin (superadmin);
     - la final: Planul tău, Setări, „Scrie-mi o problemă sau o sugestie”, „Instalează aplicația”.
   - Regulile pentru operator (`operatorTabs`, `isPathAllowedForAccess`) și pentru superadmin stau tot aici.
   - Iconițele, într-un singur loc (`src/components/app/navigatie-iconite.tsx`). Bara de jos își păstrează semnele
     de azi.
   - O folosesc `BottomTabBar`, `MaiMultPageClient` și bara laterală.
2. **Bara laterală nouă** (`Sidebar.tsx`, rescrisă pe kit):
   - sus `LogoCuNume` („Caietul Fermei”) și clopoțelul;
   - apoi Acasă · Livrări · Recoltări · Comenzi, apoi grupurile „Ferma” / „Bani și oameni” cu aceleași nume ca în
     Mai mult;
   - jos Setări, „Scrie-mi…” și contul (`UserProfileMenu`: ferma, ieșirea din cont).
   - Fără emoji, fără grupurile vechi, fără acordeon. Restrângerea la 64 px o păstrez (există deja).
   - În spațiul asociației (`/asociatie/*`), `AssociationSidebar` rămâne cum e (Asociația nu e în revamp).
3. **Antetul**:
   - `PageHeader` / `CompactPageHeader` desenează pe desktop la fel ca pe telefon: titlu + subtitlu, pe tokeni, fără
     fundalul verde;
   - fără chipurile rapide și fără „Editează”. Clopoțelul și contul stau în bara laterală, deci sunt pe **toate**
     ecranele, inclusiv cele cu `ScreenHeader`;
   - butonul de adăugare din antet (`useAddAction`, folosit doar de Material săditor) rămâne în antet.
4. **`/dashboard`** = aceeași Acasă ca pe telefon, **o coloană de 720 px** (întrebarea 9).
   - `AcasaMobile` se redenumește `Acasa`.
   - Pagina păstrează doar ce trebuie pentru Acasă: comenzi, recoltări, lucrări, vânzări, butași, stoc, parcele și
     stadii, vremea, tratamente, plus Memento, Capcane, Neîncasate, Primii pași.
   - Pleacă grila, editarea layout-ului, dialogul „Adaugă widget” și interogările folosite doar de cardurile vechi
     (cheltuieli, produse, solar, `shop_orders` pentru „Magazinul meu”, preferințele de layout).
   - Titlul: „Acasă” + data, pe orice ecran (salutul dispare).
5. **Coloana modulelor**:
   - un token, `--container-modul: 45rem` (720 px), în `@theme`, deci clasa `max-w-modul`;
   - îl folosesc `AppShell`, `ScreenHeader`, `ScreenBody` și cele ~30 de locuri cu `max-w-xl` / `max-w-2xl` din modulele
     refăcute, ca antetul, corpul și bara fixă să aibă aceeași lățime;
   - îl adaug în `docs/redesign/tokens.md`.
6. **`BottomSheet` pe desktop** (`md:`): dialog centrat pe ecran, lat de 32 rem, colțuri rotunjite, fără mâner, cu
   aceeași animație ca `StepForm`. Pe telefon rămâne foaie de jos.
7. **Șterg** (verificat cu `grep`: nu le mai folosește nimic după 1–4):
   - `src/components/dashboard/`: `DashboardCard.tsx`, `DashboardEditableGrid.tsx`, `DashboardStaticWidgetGrid.tsx`,
     `DashboardV2Sections.tsx`, `DashboardWidgets.tsx`, `MeteoDashboardCard.tsx`, `Sparkline.tsx`, `TaskList.tsx`
     (tot folderul);
   - `src/lib/dashboard/`: `layout.ts`, `grid-config.ts`, `grid-compact.ts`, `attention.ts`, `context.ts`,
     `recommendations.ts`, `microclimate.ts`, cu testele lor (`grid-compact.test.ts`, `recommendations.test.ts`).
     `engine.ts` rămâne doar cu `buildParcelDashboardStates` / `ParcelDashboardState`, folosite de Acasă; scot alertele,
     sarcinile și golirea widgeturilor, cu partea lor din `engine.test.ts`;
   - `src/lib/supabase/queries/profile-dashboard.ts`. Coloana din `profiles` rămâne în bază, nu o ating;
   - `src/components/layout/DashboardSidebarSkeleton.tsx`, înlocuit cu un schelet pe tokeni în `DashboardSidebarLoader`;
   - din `PageHeader.tsx`: `QUICK_NAV_ITEMS`, `expandRightSlotOnMobile`, `stackMobileRightSlotBelowTitle`. Din
     `CompactPageHeader.tsx`: ramura `lg` verde;
   - din `DashboardContentShell.tsx`: variantele folosite doar de dashboard, dacă nu le mai folosesc Asociația sau
     Admin (verific);
   - CSS-ul din `globals.css`: `dashboard-premium-*`, `dashboard-grid-layout`, `--dashboard-stack-gap`, stilurile
     `react-grid-layout`;
   - `react-grid-layout` și `react-resizable` din `package.json` (motivul e sus).

**Teste**
- Unitar `meniu.ts`:
  - proprietarul vede aceleași rânduri în bara laterală și în Mai mult;
  - operatorul (doar Recoltări) → Recoltări (+ Mai mult pe telefon);
  - superadminul → Admin, fără „Scrie-mi…”;
  - asociația → rândul ei.
- Testele existente ale barei de jos (`BottomTabBar.operator.test.tsx`) rămân verzi.
- E2E `e2e/smoke/desktop.spec.ts` (1440 × 900, demo-ul smoke):
  - pe `/dashboard`, Acasă nouă (perioada, „De livrat azi”);
  - nu apar „Dashboard”, „Operațional și recent”, „Recomandări pentru azi”, „Editează”;
  - fiecare legătură din bara laterală duce la ruta ei, cu titlul ei;
  - clopoțelul și contul se deschid;
  - o foaie (Stocuri → „Ajustează”) e centrată pe ecran.
- Testul de la §9, rulat și la 1440 px.

**Riscuri**
- **„Magazinul meu”** (linkul spre `/magazin/<fermă>`) există azi doar pe cardul vechi de pe desktop. Pe telefon
  nu l-a avut niciodată. Dacă cardul pleacă, linkul dispare (întrebarea 10).
- Paginile Asociației și Admin folosesc același `PageHeader`: își pierd și ele antetul verde pe desktop. Rămân
  funcționale.
- Desktopul pierde graficul de venituri și „Ce ai de făcut azi” în varianta veche. E ce cere promptul.
- Fereastra clopoțelului (din 33) se deschide acum din bara laterală, deci trebuie să se deschidă spre dreapta. O
  verific în testul de desktop.

---

## Raportul de la final

`docs/redesign/raport-34-final.md`:
- pe secțiuni: ce s-a schimbat, commit-urile, „nicio migrare” (sau SQL-ul, dacă se schimbă ceva la întrebări),
  testele;
- ce n-am putut testa: gestul „înapoi” pe telefon, promptul real de instalare, iPhone;
- capturi la 360 px și 1440 px în `docs/redesign/screenshots/34/`;
- dacă mă opresc la limită: ce e gata și ce rămâne, în ordine.

---

## Întrebări

1. **§2 — „Tăiat” pe card.** Lăstarul tăiat apare pe cardul stadiului cu data („An 1: tăiat pe 12 oct.”), până la
   următorul stadiu, sau doar în jurnal, ca azi?
   **Recomand: pe card, cu data, și în jurnal.** Altfel, după „Tai tot”, cardul spune „Fără stadiu notat” și pare că
   nu s-a salvat.
2. **§6 — titlurile `ListRow` pe două rânduri peste tot**, sau doar pe fișa parcelei?
   **Recomand: peste tot.** Testul de la §9 le-ar găsi oricum tăiate pe celelalte ecrane, iar fermierul trebuie să
   poată citi titlul întreg.
3. **§5 — cum închide „înapoi” o foaie.**
   (a) `CloseWatcher`, fără istoric: pe Android „înapoi” închide foaia, iar pe iPhone / Firefox iese din ecran.
   (b) Ca azi, cu intrare în istoric, dar curățată la orice închidere (`history.back()`, cu riscul ca o navigare
   imediat după închidere să fie anulată).
   **Recomand (a)**: nu mai atinge istoricul deloc, deci blocarea nu mai poate apărea, iar pe aplicația instalată de pe
   Android merge exact ca acum.
4. **§7 — tip fix nou „Plasă” la Lucrări?**
   **Recomand: nu.** „Altele” cu text + alegerile rapide acoperă plasa fără încă o placă pentru toate fermele.
5. **§9 — pragurile pentru „Sigur?” în „Am cumpărat”**: kg > 2.000, l > 500, buc > 500?
   **Recomand: da**, cu pragurile într-un singur fișier, ușor de schimbat.
6. **§8 — tonele în bază.** Le scriu ca kg (`cantitate_totala` în kg + textul omului în `cantitate_text`) sau adaug
   `t` în constrângerea `unitate_cantitate` (migrare cu `drop constraint` / `add constraint`, care nu e strict
   aditivă)?
   **Recomand: kg în bază**, fără migrare. Registrul arată „1,5 t” de la 1.000 kg.
7. **§4 — cine și unde vede banda.** Doar cont real (și operatorii), doar pe telefon, doar pe Acasă, de la a doua zi
   sau după prima salvare, închisă 30 de zile; plus rândul din Mai mult?
   **Recomand: da, exact așa.** Pe Acasă nu acoperă niciun buton fixat jos.
8. **§7 — textul „Ce ai făcut?”**: în `tip_activitate` cu prefixul „Altele: ” (fără migrare) sau într-o coloană nouă
   (`activitati_agricole.descriere`, migrare aditivă; aplicația ar trebui să meargă și fără ea)?
   **Recomand: prefixul**, fără migrare. Rândurile vechi nu se ating, iar prefixul e recunoscut înaintea oricărei
   euristici.
9. **§10 — Acasă pe desktop**: o coloană de 720 px (aceeași ca telefonul și ca modulele) sau două coloane?
   **Recomand: o coloană de 720 px.** E exact Acasă de pe telefon, fără un layout de întreținut separat. Promptul cere
   „doar să funcționeze”.
10. **§10 — „Magazinul meu”** (linkul spre magazinul public al fermei, azi doar pe cardul vechi de desktop): îl scot
    odată cu cardul sau îl mut într-un rând din Setări › Ferma?
    **Recomand: îl mut în Setări › Ferma** („Magazinul tău online”), doar pentru proprietar. Altfel nu mai rămâne
    nicio cale spre el.
11. **§10 — lățimea coloanei modulelor**: 720 px?
    **Recomand: 720 px** (`max-w-modul`). La 1440 px, cu bara laterală de 240 px, rămâne loc de margini, iar listele
    și formularele pe o coloană nu se lungesc până devin greu de citit. 960 px ar lăsa rândurile foarte lungi.
