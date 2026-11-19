# Prompt 08 — Noaptea: Comenzi, Livrări, Acasă, Clienți + Culegători, Cheltuieli + Vânzări pe kit

Model: Fable 5.2 · Effort: high · Mod: **fără plan, fără aprobări** (Andrei pornește sesiunea cu „Accept edits”) · Sesiune: NOUĂ · Branch-uri: în lanț, pornind de la `redesign/comenzi` · Rezultat: 5 module refăcute pe kit, fiecare pe branch-ul lui, cu push, plus un raport de dimineață

## 0. Cum lucrezi în noaptea asta (obligatoriu)

Andrei doarme. **Nu faci plan, nu te oprești, nu pui întrebări.** Lucrezi singur până termini toate modulele sau până nu mai poți continua.

1. **Deciziile sunt deja luate.** Sursele, în ordinea priorității: acest fișier → `docs/redesign/mockups/*.md` (comenzi, livrari, acasa, clienti-culegatori, cheltuieli-vanzari) → mockup-urile din linkuri (doar ca imagine de ansamblu) → `CLAUDE.md` (regulile kitului) → modelul Recoltări (`src/app/(dashboard)/recoltari/`, `src/components/recoltari/`, `docs/redesign/prompts/05-recoltari.md`).
2. **Unde ceva nu e decis**, alegi varianta cea mai simplă care respectă deciziile, o aplici și o scrii în raport la „Ce am ales singur”. Nu aștepți pe nimeni.
3. **Păstrezi tot ce există și nu e scos explicit** de decizii (editare, ștergere, mutare pe altă zi, „Din mesaj”, precompletarea prin URL din chat, sincronizări etc.). Dacă o funcție nu mai are loc pe ecranul nou, o muți (meniu ⋯, foaia unui rând) și o treci în raport.
4. **Comenzi pe care nu le ai voie** (ar cere aprobare și te-ar bloca toată noaptea, sau sunt interzise): `git merge`, `git rebase`, push pe `main`, `git push --force`, `git reset --hard`, `git clean`, `rm -rf`, `supabase *`, `vercel *`, `execute_sql`, `apply_migration`, citirea `.env*`. Folosește doar comenzile din lista `allow` din `.claude/settings.json` (git pe `redesign/*`, `npm run *`, `npx tsc/eslint/vitest/playwright/next`, `ls`, `cat`, `grep`, `find` etc.). Fișierele le creezi și le modifici cu uneltele de editare, nu din shell. Ștergi fișiere doar cu `git rm`. Dacă o comandă îți cere aprobare, renunți la ea și găsești altă cale.
5. **Nu faci merge în `main` și nu deschizi PR.** Andrei verifică dimineața și face merge-urile.
6. `public/sw.js` nu intră în niciun commit: `git restore public/sw.js` înainte de fiecare commit.
7. **Niciun branch nu se împinge stricat.** Înainte de fiecare push: `npm run lint`, `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit`, `npm run build` — toate verzi. Dacă o parte dintr-un modul nu iese, o scoți (sau o lași pe ecranul vechi), împingi ce merge și scrii în raport ce a rămas.
8. **Dacă sesiunea se compactează sau te pierzi:** recitește acest fișier și `docs/redesign/raport-noapte.md`, verifică cu `git log` / `git branch` unde ai rămas și continuă de acolo.

## 1. Ordinea și branch-urile

Fiecare modul pe branch-ul lui, pornit din branch-ul modulului anterior (lanț), ca dimineața merge-urile să se facă pe rând, `--ff-only`:

| # | Modul | Branch | Pornește din |
|---|---|---|---|
| 1 | Comenzi (+ migrarea comună, + helperul de preț standard) | `redesign/comenzi` | există (conține deja acest prompt și deciziile) |
| 2 | Livrări | `redesign/livrari` | `redesign/comenzi` |
| 3 | Acasă (Dashboard, telefon) | `redesign/acasa` | `redesign/livrari` |
| 4 | Clienți + Culegători + Setări (Preț standard, Ce arată Acasă, Date) | `redesign/clienti-culegatori` | `redesign/acasa` |
| 5 | Cheltuieli + Investiții + Vânzări | `redesign/cheltuieli-vanzari` | `redesign/clienti-culegatori` |

Start: `git fetch origin && git checkout redesign/comenzi && git pull`. La fiecare modul nou: `git checkout -b redesign/<x>` din vârful celui anterior, iar la final `git push -u origin redesign/<x>`. Commit-uri mici, cu mesaje în română.

Dacă un modul eșuează complet, următorul pornește din ultimul commit bun al lanțului. Notezi asta în raport.

**În afara nopții (nu atingi):** Parcele, Activități, tratamente, Material săditor (butași), Rapoarte, notificările push, designul de desktop, magazinul `comanda.zmeurel.ro`, chatul AI (doar legăturile lui prin URL rămân funcționale).

## 2. Baza de date: o singură migrare, scrisă, NU aplicată

Câteva decizii au nevoie de coloane noi. Le scrii **într-un singur fișier**, în modulul 1, primul commit: `supabase/migrations/20261120090000_redesign_noapte.sql`. **Nu îl aplici** (nu ai voie și nu poți). Andrei îl aprobă și îl rulează dimineața.

Reguli pentru fișier: doar `alter table … add column if not exists …`, valori implicite și `check`-uri. Fără `update`, `delete`, backfill, `drop`, redenumiri sau indexuri unice noi. Idempotent (se poate rula de două ori). Comentariu în antet cu ce face fiecare coloană. Înainte să-l scrii, verifici **doar prin citire** (`src/types/supabase.ts`, `supabase/migrations/`) că coloanele nu există deja și cum arată politicile RLS ale tabelelor.

Conținut:
- `comenzi.prioritara boolean not null default false`
- `clienti.latitudine double precision`, `clienti.longitudine double precision` (cu `check` pe intervale), `clienti.locatie_salvata_la timestamptz`, `clienti.locatie_precizie_m real`
- `vanzari.suma_incasata_partial_lei numeric(12,2)` (`check >= 0`), `vanzari.data_incasare_partiala date`
- `tenant_settings`:
  - `pret_standard_inceput_lei_kg`, `pret_standard_varf_lei_kg`, `pret_standard_mediu_lei_kg` (`numeric(10,2)`, nullable);
  - `pret_standard_perioada text` (`check in ('inceput','varf','mediu')`, nullable);
  - `acasa_perioada_mod text not null default 'auto'` (`check in ('auto','sezon','extrasezon')`);
  - `extrasezon_inceput_la date`, `extrasezon_amanat_pana date`;
  - `extrasezon_intrebare_din text not null default '10-25'` (lună-zi);
  - `acasa_extrasezon_afiseaza jsonb` (comenzi butași / rest de încasat / lucrări / îngheț).

**Codul trebuie să meargă și înainte, și după rularea migrării:**
- Un helper unic, de exemplu `src/lib/schema-features.ts`, verifică o singură dată pe sesiune (React Query, `staleTime` lung) dacă există fiecare grup de coloane: un `select('<coloana>').limit(1)` care întoarce eroarea `42703` sau `PGRST204` înseamnă „lipsește”.
- Cât lipsesc coloanele, funcția respectivă e ascunsă sau doar pentru citire, cu valoarea de rezervă. **Nu trimiți niciodată coloanele noi în insert/update când lipsesc** (PostgREST respinge toată cererea).
- Tipurile: adaugi coloanele noi, nullable, în `src/types/supabase.ts` și notezi în raport că fișierul trebuie regenerat după migrare.
- `tenant_settings` poate să nu aibă rând pentru o fermă. Citești cu `maybeSingle`. Scrii cu select-apoi-insert/update; folosești `upsert` doar dacă găsești în migrări o constrângere unică pe `tenant_id`.
- Rezerve: preț standard = **35 lei/kg** (valoarea de azi din `ComenziPageClient`); perioada Acasă = regula automată de mai jos; prioritare, locații, plată parțială = ascunse.

## 3. Modulul 1 — Comenzi (`redesign/comenzi`)

Decizii: `docs/redesign/mockups/comenzi.md` (inclusiv „Decise ulterior”). Cod: `src/app/(dashboard)/comenzi/`, `src/components/comenzi/`, `src/lib/supabase/queries/comenzi.ts` și tot ce importă din ele (verifici cu `grep`).

- **Pagina pe zile:** sus `StatTile`-uri „Azi de livrat” (kg, comenzi, lei) și „Mâine”; `Segments` Azi / Mâine / Mai târziu / Fără dată (etichete care încap la 390 px); lista cu un card nou pe kit (client, localitate, kg, sumă, status, plată, steag „Prioritară”). Prioritarele sus, cu banner pe Azi „N prioritare azi · X kg — de livrat cu prioritate”. Sus în antet, „Din mesaj” (funcția existentă de lipire WhatsApp/SMS, păstrată).
- **Butonul mare „Comandă nouă”** (56 px) înlocuiește FAB-ul pe pagina asta, exact ca la Recoltări.
- **Formularul (`StepForm`, 2 pași, salvare din pasul 2):**
  - **pasul 1, clientul:** căutare după nume sau telefon, clienții recenți, „Client nou” (nume + telefon) **în pas**, nu în foaie suprapusă. Fără „cât ia de obicei”.
  - **pasul 2, detaliile:** cantitatea doar în kg (plăci 2–10 + „Alta” → `KgField` + `NumericKeypad`), **nimic preselectat**; data (Azi / Mâine / Poimâine / Altă zi cu `CalendarPanel` / Fără dată); adresa din fișa clientului, editabilă; prețul (negociat din fișa clientului pentru patiserii/magazine, altfel prețul standard al perioadei active, modificabil); „+ Notă pentru livrare”; comutatorul „Prioritară” (doar dacă există coloana; cere dată).
  - **Fără câmp de avans.**
  - Editarea se face în același formular.
  - Deschiderea prin URL (`?client=<id>&nou=1`) pornește direct la pasul 2 cu clientul ales (o folosește fișa clientului).
- **Helperul de preț standard** (îl folosesc și Vânzarea rapidă, Clienții, Setările): `src/lib/pret-standard.ts` → `{ inceput, varf, mediu, perioada, activ }`, cu rezerva 35.
- **„Pune în livrare azi (n)”** → listă bifabilă pe kit (`CheckRow`). Prioritarele sunt sus și bifate implicit. „Rămas în stoc: X kg” vine din `get_sellable_cal1_stock_summary` și scade la fiecare bifă; o comandă care nu mai încape e blocată, cu „Nu ajunge stocul: lipsesc X kg”. Avertizare sus dacă doar prioritarele depășesc stocul. Trimiterea se face prin `set_comanda_in_delivery`, cu `STOC_INSUFICIENT` tratat clar (stocul s-a schimbat între timp → reîncarci).
- **Scoți tot ce ține de campanie:**
  - pagina `comenzi/campanie` (`CampaniePageClient.tsx`, `page.tsx`, `loading.tsx`), legăturile, filtrele, etichetele, `ComenziSpeedDial` dacă servește doar campaniei, cozile de query folosite doar de campanie;
  - **doar cod, datele rămân neatinse**: comenzile venite din campanie apar ca orice comandă;
  - înainte să ștergi, `grep` după fiecare simbol; nu strici Livrări, API-urile, cron-urile;
  - în raport, lista exactă cu ce ai scos și ce a rămas (de exemplu coloane din DB folosite doar de campanie).
- `UnifiedOrderCard` rămâne în Livrări până la modulul 2; Comenzi folosește cardul nou.
- Idempotență: `comenzi` nu are `client_sync_id`. Butonul de salvare e blocat cât rulează cererea și se trimite o singură dată per cheie de formular. **Fără migrare pentru asta.**
- Analytics: păstrezi evenimentele de acum, prin ciclul `StepForm`.
- Adaugi folderele Comenzi în `KIT_RULE_DIRS`.

## 4. Modulul 2 — Livrări (`redesign/livrari`)

Decizii: `docs/redesign/mockups/livrari.md`. Cod: `src/app/(dashboard)/livrari/`, `UnifiedOrderCard` și ce mai folosește modulul.

- **Ecranul din mașină:**
  - sus progresul: x din y livrate, kg rămase, lei de încasat;
  - **următoarea oprire** mare: număr pe traseu, client, adresă, cantitate, sumă de încasat evidențiată, nota din comandă, plus **Sună / Navighează / Livrat** (56 px);
  - apoi restul opririlor numerotate; cele livrate strânse într-un singur rând.
- **Confirmarea livrării** (`BottomSheet`): plata Cash / Transfer / Nu a plătit; suma încasată precompletată cu totalul comenzii; livrare parțială; „Da, livrat”. Folosești RPC-urile existente de livrare (`deliver_and_clone_comanda` și ce mai găsești), fără să le schimbi. Încasarea mai mică decât totalul înseamnă o vânzare **Neîncasată** cu „a dat X lei” (doar dacă există coloanele de plată parțială; altfel Neîncasată simplu) — vezi regula de venit din `cheltuieli-vanzari.md`.
- **Păstrezi obligatoriu** „N-a răspuns” (`last_call_status`) și „Copiază comanda pentru livrarea următoare”.
- **După apel:** la revenirea în aplicație după „Sună” (`visibilitychange`) apare „Cum a fost apelul?”:
  - A răspuns → nimic;
  - Nu a răspuns → etichetă cu ora + „Mut-o la finalul traseului”;
  - Mută pe altă zi → Mâine / Poimâine / Altă dată + notă, iar comanda iese din traseul de azi.
  - Aceleași acțiuni sunt și în meniul ⋯ al opririi.
- **Navigare:**
  - Google Maps implicit, cu setare pentru Waze la o singură oprire (`localStorage` în `try/catch`);
  - „Pornește în Maps” trimite câte 9 opriri, apoi următoarele 9;
  - Navighează e inactiv („fără locație încă”) cât clientul n-are locație.
- **Locațiile** (doar dacă există coloanele):
  - la „Da, livrat”, comutatorul „Salvează locația de aici”, pornit dacă clientul n-are locație; se salvează doar la precizie < 50 m, iar precizia se afișează;
  - dacă livrezi la > 150 m de locația salvată → „Livrezi aici și de acum?”;
  - altfel locația nu se schimbă niciodată singură.
- **Optimizarea traseului:**
  - ruta `src/app/api/livrari/optimizeaza/route.ts` apelează OpenRouteService (`api.heigit.org`, optimizare Vroom) cu cheia din `process.env.ORS_API_KEY`, **doar pe server**; cheia nu ajunge în client și nu se loghează;
  - dacă cheia lipsește, ruta întoarce 503 cu un mesaj clar, iar UI-ul spune „Optimizarea nu e configurată încă” și lasă aranjarea manuală;
  - traseul pornește de unde ești, iar clienții fără locație rămân la final;
  - aranjarea manuală se face cu săgeți mari sus/jos; ordinea se salvează în `ordine_livrare`, care există deja.
- **Modul noapte verificat obligatoriu.** Livrări se folosește seara, în mașină.
- După ce Livrări nu-l mai folosește, ștergi `UnifiedOrderCard` (verifici cu `grep`). Adaugi folderele în `KIT_RULE_DIRS`.

## 5. Modulul 3 — Acasă (`redesign/acasa`)

Decizii: `docs/redesign/mockups/acasa.md`. Cod: `src/app/(dashboard)/dashboard/page.tsx`, `src/components/dashboard/`, `src/lib/dashboard/` (engine, treatment-suggestions — le folosești, nu le rescrii).

- **Pe telefon** (sub breakpoint-ul de desktop folosit azi), Acasă nouă pe kit. **Pe desktop, grila editabilă rămâne exact cum e.**
- Conținutul Sezon / Extrasezon, ca în fișierul de decizii. Datele vin din sursele existente (comenzi, stoc, livrări, recoltări, `activitati_agricole` cu dată în viitor, sugestiile de tratament existente, meteo existent, `vanzari`, `vanzari_butasi`*). Fiecare rând e un link spre modulul lui.
- **Perioada:**
  - cu setările din migrare: `acasa_perioada_mod` (auto/sezon/extrasezon);
  - în modul auto: Sezon de la prima recoltare din anul curent ulterioară lui `extrasezon_inceput_la`; Extrasezon după ce Andrei confirmă;
  - cardul „Începem extrasezonul?” apare din `extrasezon_intrebare_din` (25 octombrie), dacă nu e amânat (`extrasezon_amanat_pana`). „Da, începem” scrie `extrasezon_inceput_la = azi`; „Mai am de cules” scrie `extrasezon_amanat_pana = azi + 7`.
  - **Rezerva fără migrare:** Sezon dacă există o recoltare în anul curent și data e înainte de 1 noiembrie, altfel Extrasezon; fără card de întrebare.
- Scoți de pe telefon: „Adaugă widget”, scurtăturile „Intră direct în fluxuri”, recomandările generice, „Recente”. Nu ștergi componentele folosite pe desktop.

## 6. Modulul 4 — Clienți + Culegători + Setări (`redesign/clienti-culegatori`)

Decizii: `docs/redesign/mockups/clienti-culegatori.md`. Cod: `src/app/(dashboard)/clienti/`, `src/app/(dashboard)/culegatori/`, componentele lor, `src/app/(dashboard)/settings/`.

- **Clienți:** listă, fișă, formular comun nou/editare, meniul ⋯ (import din fișier, Google Contacts, mesajul WhatsApp implicit — funcțiile existente, mutate). Neîncasatul pe client vine din `vanzari.status_plata`. „Comandă nouă” deschide `/comenzi?client=<id>&nou=1`. WhatsApp e pentru toți clienții (`https://wa.me/<telefon normalizat>`, fără text).
- **Culegători:** listă Activi / Inactivi (kg azi, kg sezon, plătit = kg × tarif din recoltări), fișă, formular. Din formular **scoți data angajării și parcelele alocate** (coloanele rămân în DB). „Marchează inactiv” în loc de ștergere (ștergerea rămâne, dacă există azi, în meniul ⋯). „Adaugă kg azi” deschide `/recoltari?culegator=<id>` direct la pasul 2. Pentru asta e permisă o modificare mică în Recoltări, cu testele lor verzi.
- **Setări** (doar secțiuni noi pe kit, nu refaci toată pagina):
  - **Preț standard:** trei perioade cu prețuri + perioada activă, scrise în `tenant_settings`; fără migrare, ecran doar de citire cu 35 și „se activează după actualizarea bazei de date”;
  - **Ce arată Acasă:** perioada Automat / Sezon / Extrasezon, data întrebării, ce arată în extrasezon;
  - **Date › Șterge toți clienții:** funcția existentă, mutată aici din Clienți, cu confirmare scrisă (tastezi „ȘTERGE”). E o acțiune a utilizatorului, nu o rulezi tu.
- Adaugi folderele în `KIT_RULE_DIRS`.

## 7. Modulul 5 — Cheltuieli + Investiții + Vânzări (`redesign/cheltuieli-vanzari`)

Decizii: `docs/redesign/mockups/cheltuieli-vanzari.md`. Cod: `src/app/(dashboard)/cheltuieli/`, `src/app/(dashboard)/investitii/`, `src/app/(dashboard)/vanzari/`, componentele lor, `src/lib/financial/categories.ts`.

- **Pagina comună „Cheltuieli”** cu fila Investiții. `/investitii` duce la fila Investiții (redirect sau aceeași componentă).
- **Formularul în 2 pași**, cu salvare din pasul 2: categoria pe plăci, apoi suma pe `NumericKeypad`, data, furnizor/descriere, „+ Poză bon” (fluxul existent pentru `document_url`) și, la investiții, parcela.
- **Categoriile noi** (8 la cheltuieli, 6 la investiții) se definesc în `categories.ts`, cu maparea completă vechi → nou extinsă din hărțile de acum.
  - Înregistrările noi se scriu cu numele noi.
  - Verifici prin citire că nu există `check`/enum pe coloanele de categorie. Dacă există, scrii cu valorile vechi și afișezi doar numele noi.
  - Cauți **toți cititorii** categoriilor (Rapoarte, Dashboard, chatul AI, rutele `paste-to-*`, exporturi) și îi treci prin funcția de normalizare, ca rapoartele să nu se rupă.
  - Cheltuiala de manoperă generată automat din recoltări: citești ce categorie scrie generatorul (DB) și o mapezi la „Manoperă”. **Nu schimbi generatorul.**
- **Vânzări:**
  - registrul, foaia unei vânzări („Marchează încasat azi” scrie `status_plata` și `data_incasare`);
  - „A dat doar o parte…”, doar cu coloanele din migrare: suma și data plății parțiale; vânzarea rămâne Neîncasată și se vede restul;
  - venitul pe lună se calculează pe `data_incasare`, deci suma întreagă intră la încasarea restului.
- **Vânzarea rapidă** se face prin RPC-ul existent cu scădere din stoc (`create_vanzare_with_stock` sau echivalentul găsit) și `client_sync_id` din `StepForm`. Clientul e opțional, prețul vine din `pret-standard`, vânzarea se salvează încasată pe loc, iar ecranul arată „Rămas în stoc cal. 1”.
- Adaugi folderele în `KIT_RULE_DIRS`.

## 8. Verificare (la fiecare modul)

- Verificările din §0 punctul 7, toate verzi. Testele e2e ale modulelor atinse: le actualizezi unde selectorii s-au schimbat evident. Nu te blochezi în testele care cer credențiale.
- **Vizual, local** (`npm run dev` + Playwright cu `npx playwright test` și un fișier de test temporar, necomis), la 390×844, zi și noapte (clasa `dark` pe `<html>`):
  - nimic nu iese din cadru;
  - toate țintele ≥ 48 px, acțiunea principală 56 px;
  - tastatura și butonul principal se văd fără derulare;
  - capturile le salvezi într-un folder ignorat de git (de exemplu `test-results/`) și nu le comiți.
- **Salvările se testează DOAR într-un cont demo** creat prin `/start` → „Continuă fără cont” → „Fructe de pădure”. Mediul local și preview-urile folosesc **baza de producție**. În contul real al lui Andrei doar deschizi ecrane, fără să salvezi nimic. Fără SQL de scriere, niciodată.
- Desktop: doar „să funcționeze” (coloană centrată, mouse și tastatură fizică).

## 9. Raportul de dimineață

Ții la zi `docs/redesign/raport-noapte.md` (îl comiți la finalul fiecărui modul, pe branch-ul acelui modul) și actualizezi `docs/redesign/progres.md`. Sus în raport:

1. ordinea merge-urilor (lanțul de branch-uri, ultimul commit al fiecăruia);
2. migrarea de aprobat: fișierul, ce adaugă, ce se aprinde după rulare, plus regenerarea tipurilor;
3. pe modul:
   - ce e gata;
   - ce am ales singur;
   - ce funcții am mutat, unde, și ce am scos;
   - ce așteaptă migrarea sau cheia ORS;
   - ce n-am terminat și de ce;
   - **lista de verificat pe telefon** (preview: `https://zmeurel-git-redesign-<x>-zmeurelos-admins-projects.vercel.app`).

La final, ultimul push și **STOP**. Fără merge.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
