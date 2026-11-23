# Prompt 31 — Prima pagină, /start, Login, fermă nouă, cultura din parcele

Lucrezi singur, fără plan și fără să ceri aprobare. Ce te blochează sari și notezi în raport.

**Branch:** `redesign/start-31`, din `origin/main` de la momentul lansării. Commit-uri mici, push după fiecare bucată. Fără merge. Folosește `git add` pe fișiere anume, nu `git commit -a`: `public/sw.js` nu se comite.

**Promptul 30 (Planul pe stadii) e terminat** și intră în main înainte de tine (Tratamente → tab-ul Plan, `src/lib/plan`, `src/components/plan`, notificarea zilnică). Pornește din `origin/main` de la momentul lansării. Dacă main e încă `c6aef5c` (30 nu e încă în main), pornește de acolo, nu atinge fișierele din Tratamente, Plan, `src/components/tratamente`, `src/lib/notifications/zilnice`, iar la final fă `git rebase origin/main`, rezolvă conflictele și rulează din nou verificările.

**Prototipul aprobat** (toate recomandările acceptate de Andrei): `docs/redesign/mockups/start-login-prototip.html` de pe `redesign/prompturi-11-12`. Deschide-l în browser: e un telefon cu navigare reală, cu notițele „Ce se schimbă” și deciziile lângă fiecare ecran. Urmează varianta recomandată de la fiecare întrebare.

**Context:** `CLAUDE.md`, `docs/redesign/tokens.md`, kitul (`src/components/kit`). Formularele urmează modelul din Recoltări.

**NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.** Mediul local și preview-urile folosesc baza de PRODUCȚIE: scrii doar în conturi demo create de tine. Nu creezi utilizatori reali. Migrările sunt doar aditive și rămân NEAPLICATE. Nu apelezi rute de cron.

---

## 1. Prima pagină (`src/app/page.tsx`, `src/components/landing/`)

- **Titlul:** „Ferma ta, pe telefon. Fără hârtii.” Subtitlul spune pe scurt ce ții în aplicație. Actualizează și `metadata` (title, description, openGraph, twitter).
- **Se scot:**
  - testimonialele inventate (`testimonials.tsx`); azi e o singură fermă reală activă;
  - „Beta deschis — locuri limitate”;
  - secțiunile care se repetă (probleme, soluție, cum funcționează, tipuri de ferme: păstrează doar ce apare în prototip).
- **Rămân, în ordinea din prototip:**
  - titlul cu două butoane: „Încearcă fără cont” (duce la demo, prin `/start`) și „Am deja cont” (`/login`);
  - capturi reale din aplicație;
  - 6 plăci „Ce ții în Zmeurel”;
  - povestea lui Andrei;
  - „Gratuit cât e în beta”;
  - întrebările frecvente;
  - contactul.
- **Capturile reale:** fă-le cu Playwright dintr-un cont demo creat de tine (Acasă, Recoltări, Comenzi, Tratamente, Stocuri, Parcele), la lățime de telefon. Salvează-le ca `.webp` în `public/landing/` și pune-le cu `next/image`, cu `alt` în română. Nu trebuie să se vadă nimic personal.
- **Magazinul asociației:** în locul secțiunii mari, un singur rând: „Pentru asociații: în curând”.
- **Pagina rămâne rapidă:** fără biblioteci noi; imaginile cu `loading="lazy"`, mai puțin prima.

## 2. `/start` (`src/app/(onboarding)/start/page.tsx`)

- **Demo-ul e primul:** „Încearcă fără cont”, sus. Contul nou e a doua opțiune (Google, email). Sub ele, „Am deja cont” duce la Login.
- **Tipurile de demo:** rămân doar cele al căror seed umple modulele refăcute. Verifică în `src/lib/demo/demo-seed-service.ts`. Mă aștept să rămână Fructe de pădure și Solarii; dacă livada sau cultura mare sunt complete, spune în raport.
- **Ecranul de așteptare (nou):**
  - după „Pornește demo-ul”, un ecran cu pașii seed-ului bifați pe rând;
  - intri în Acasă **doar când datele sunt gata**. Azi poți ajunge pe pagini goale dacă intri prea repede: află de ce (seed-ul continuă după răspuns? cache-ul React Query?) și repară cauza;
  - verificarea „gata” e o interogare reală (de exemplu: există parcele și recoltări pentru tenant), cu limită de timp și mesaj clar la eroare, cu „Încearcă din nou”;
  - la intrare, cache-ul React Query se golește sau se invalidează, ca nicio pagină să nu rămână goală.
- **Aspectul:** tokenii canonici și kitul (fără `bg-white`, `dark:`, `--agri-*`, `text-xs`). Adaugă `src/app/(onboarding)/start` în `KIT_RULE_DIRS`.

## 3. Login și paginile de parolă (`src/app/(auth)/`)

- **Login:** Google, email și parolă, „Ai uitat parola?”, cu același aspect ca `/start`. Adaugi:
  - nota „Ești operator? Intră din linkul primit pe WhatsApp.” (un `Notice`, nu un buton);
  - „Nu ai cont? Încearcă demo-ul” (duce la `/start`).
- **Paginile de parolă** (`reset-password-request`, `reset-password`, `update-password`) primesc același aspect. Logica de autentificare nu se schimbă.
- Adaugă `src/app/(auth)` în `KIT_RULE_DIRS`.

## 4. Ferma nouă: fără cultură implicită, prima parcelă decide

**Regula:** nicăieri în aplicație nu mai apare „zmeură” scris fix pentru o fermă care nu are parcele de zmeură. Fructul fermei vine **doar din parcelele ei** (`parcele.cultura`, `parcele.soi`). Din parcelă se știe și cum se recoltează: grupul biologic, stadiile, kg pe calități.

### 4a. Înscrierea
- Află cum se creează azi tenantul pentru un cont real nou (Google, email: trigger, rută, `/start`).
- După contul nou, **o singură întrebare:** numele fermei și localitatea. Se salvează unde e deja numele fermei; localitatea merge în câmpul existent de locație a fermei, dacă există. Dacă nu există, nu faci migrare: notezi în raport.
- **Nu se mai întreabă „Ce cultivi?”.** Nu se creează nicio parcelă, niciun produs și nicio cultură implicită.

### 4b. „Primii pași” în Acasă (fermă reală, nu demo)
- Un card cu 4 pași, care se bifează singuri din date reale:
  1. numele fermei;
  2. **„Adaugă prima parcelă”** (cultura, soiul, suprafața; formularul de parcelă existent);
  3. „Adaugă culegătorii”;
  4. „Pune prețul la <cultura>”.
- Pasul 4 e inactiv până la prima parcelă (apăsat, spune „Întâi adaugă prima parcelă”). După parcelă, textul folosește cultura ei, cu literă mică: „Pune prețul la afine”.
- Apeși un pas: se deschide formularul existent. Cardul dispare când toți pașii sunt gata sau la „Ascunde” (preferință pe utilizator, în `localStorage` sau în setările existente; fără migrare).

### 4c. Etichetele și stocul din cultura parcelelor
Caută tot ce presupune zmeura. Cel puțin:
- `src/app/(dashboard)/dashboard/page.tsx` (`produs: 'Zmeură cal. I'`);
- `src/app/(dashboard)/stocuri/StocuriPageClient.tsx` („Zmeură cal. I disponibilă”);
- `src/components/stocuri/AjustareStocForm.tsx`;
- `src/lib/stoc-pe-produs.ts` și `src/lib/stocuri/stoc.ts` (`esteZmeura`, „numărăm doar zmeura”);
- `src/lib/supabase/queries/comenzi.ts` (`resolveZmeuraProdusId`, `ilike 'zmeur%'`);
- funcțiile din bază care calculează disponibilul (citește-le din producție, doar select).

**Ce trebuie să iasă:**
- **Culturile fermei** = culturile distincte din parcelele active. Faci o singură funcție pură, cu teste, care normalizează denumirile: „Zmeure Delniwa” și „Zmeură” înseamnă aceeași cultură. Refolosește ce există în `src/lib/parcele/` (`culturi.ts`, `parcel-form-options.ts`, grupul biologic din `stadiu-curent.ts`).
- **Fără parcele:** Stocul, Acasă și Comenzile arată „Adaugă întâi o parcelă”, cu buton spre formularul de parcelă. Nicio cultură scrisă.
- **O singură cultură:** „Afine cal. I disponibile”, „Zmeură cal. I disponibilă” (acordul corect, după cultură).
- **Mai multe culturi:** stocul pe cultură, cu `Segments`, câte o filă pe cultură.
- **Comanda** întreabă cultura doar dacă ferma are mai multe. Stocul scade pe cultura comenzii.
- **Produsul pentru comenzi:** la prima parcelă dintr-o cultură se asigură produsul „<Cultură> proaspătă/proaspete” al tenantului, în locul celui fix „Zmeură proaspătă”. Produsele existente rămân neatinse: pentru ferma lui Andrei, „Zmeură proaspătă” continuă să funcționeze exact ca azi. Folosește `comenzi.produs_id`, care există deja.
- **Dacă e nevoie de schemă** (de exemplu, legătura produs → cultură): migrare aditivă, NEAPLICATĂ, explicată în raport. Fără ea, codul trebuie să meargă ca azi.
- **Verificările** de zmeură din Tratamente rămân, dar doar pe parcelele de zmeură. Nu atingi fișierele din Tratamente (promptul 30): doar notezi în raport ce ai găsit.
- **Demo-ul Fructe de pădure** rămâne cu zmeură, mure și afine, pentru că așa sunt parcelele lui, nu pentru că e scris fix.

## 5. Ce ascundem cât e beta

- **Din meniu** (`Sidebar.tsx`, Mai mult, orice altă listă de navigare) ies „Clienți magazin” și „Analytics magazin”. Paginile și datele rămân; doar nu mai apar în meniu.
- **„Planuri” devine „Planul tău”** (`src/app/(dashboard)/planuri/page.tsx`), pe kit:
  - un `StatHero` „Gratuit în beta”, cu textul „toate modulele, fără limită de date”;
  - „Când ies abonamentele, afli cu cel puțin o lună înainte. Datele rămân ale tale și le poți exporta oricând.”;
  - un rând „Exportă tot în Excel”, dacă există deja exportul, și un rând „Scrie-mi ce lipsește” (WhatsApp, linkul existent din aplicație);
  - fără prețuri și fără butoane de plată.
- Adaugă `src/app/(dashboard)/planuri` în `KIT_RULE_DIRS`.

## 5b. Numele aplicației într-un singur loc

Platforma se va redenumi în „Caietul Fermei” (promptul 32). Ca redenumirea să fie simplă, textele noi scrise de tine (prima pagină, `/start`, Login, „Primii pași”, „Planul tău”) iau numele aplicației dintr-o constantă, nu scris de mână: `src/lib/brand.ts`, cu `APP_NAME = 'Zmeurel OS'` deocamdată. Nu redenumești nimic acum.

## 6. Verificare

- `npm run lint`, `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit`, `npm run build`.
- **Teste unitare noi:** culturile fermei (normalizarea, zero, una, mai multe), eticheta de stoc, pașii din „Primii pași”, verificarea „demo gata”.
- **E2E smoke** (`npm run test:e2e:smoke`): adaugă pașii:
  - `/` se încarcă și nu are textele scoase;
  - `/start` → demo → ecranul de așteptare → Acasă cu date;
  - Login are nota pentru operatori;
  - Mai mult nu mai are cele două intrări de magazin;
  - Planul tău scrie „Gratuit în beta”.
- **În browser, cu Playwright, la 390 px, zi și noapte:**
  - prima pagină;
  - `/start` → demo Fructe de pădure → Acasă; pagina de Stocuri, pe cultură;
  - un demo Solarii: nicio „zmeură” nicăieri (caută textul în paginile principale);
  - Login și paginile de parolă.
- **Ferma reală nouă** nu se poate testa fără un cont real; nu crea unul. Testează „Primii pași” și etichetele prin teste unitare și dând componentelor date de fermă fără parcele. Notează în raport ce n-ai putut testa.

## 7. Raportul

`docs/redesign/raport-31.md`:
- ce ai schimbat, pe secțiuni;
- cum se creează tenantul la cont nou și ce ai atins acolo;
- de ce apăreau paginile goale în demo și cum ai reparat;
- lista locurilor cu „zmeură” fix găsite și ce ai făcut cu fiecare;
- migrarea, dacă există, cu SQL complet, neaplicată;
- capturile din `public/landing/`;
- ce n-ai putut testa;
- `git diff origin/main --stat` și confirmarea că `public/sw.js` nu e în diff.

Actualizează `CLAUDE.md`, pe scurt: regula „cultura vine din parcele”, „Primii pași”, ecranul de așteptare din demo.
