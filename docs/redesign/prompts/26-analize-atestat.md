# Prompt 26 — Analizele la fructe + mementoul dinainte de cules + „Atestat de producător”

Lucrezi singur, fără plan și fără să ceri aprobare. Ce te blochează sari și notezi în raport.

**Branch:** `redesign/analize-26`, din `main`.
- Înainte de orice, verifică faptul că `main` conține `docs/redesign/raport-25-decizii.md` (promptul 25 e în producție).
- Dacă nu-l conține, te oprești și scrii doar asta în răspuns.

Commit-uri mici, push după fiecare bucată. Fără merge.

**Mockup-ul aprobat** (toate recomandările din el sunt acceptate de Andrei): `docs/redesign/mockups/analize-fructe.html` de pe branch-ul `redesign/prompturi-11-12`. Citește-l cu `git show origin/redesign/prompturi-11-12:docs/redesign/mockups/analize-fructe.html`. Textele, ordinea și comportamentul vin de acolo.

**Context:** `CLAUDE.md`, `docs/redesign/tokens.md`, kitul (`src/components/kit`), modulul Tratamente (`src/app/(dashboard)/tratamente`, promptul 18), Notificări (prompturile 13 și 14), Actele fermei (promptul 21), rapoartele 18–25. Model pentru formulare: Recoltări.

**Ordinea:** A, B, C, D, E. Dacă timpul nu ajunge, A, B și C trebuie să fie gata.

---

## A. „Atestat de producător” (mic)

Din 2014 actul se numește **atestat de producător**, valabil 7 ani.

- **Textele din UI**, peste tot (Actele fermei, foaia actelor, bannerul, notificările, cronul `farmer-legal-docs-check`, `LEGAL_TYPE_OPTIONS` / `LEGAL_TYPE_LABELS`):
  - „Certificat de producător” → „Atestat de producător”;
  - „viza” → „valabil până la”;
  - „Poza certificatului” → „Poza atestatului”.
- **Valorile din baza de date nu se schimbă** (`certificat_producator` în enum, coloanele `certificate_*`).
- **Confirmarea din Actele fermei** spune exact ce se va afișa public: „Confirm că datele sunt corecte. Când magazinul și asociația revin, public apar doar numele fermei, localitatea, seria și valabilitatea atestatului și telefonul de contact. Numărul și poza atestatului nu se afișează.”
- Nicio pagină publică nu arată numărul sau poza atestatului. Verifică și notează.

### A2. Widgetul „Ești în beta” (mic)

Raportul 25: deschis, widgetul acoperă butonul principal al paginii pe telefon (de ex. „Invită pe cineva”) și o parte din conținut pe desktop. Îl faci un punct mic în colțul de sus al carcasei, care deschide conținutul de acum doar la atingere. Nu se deschide singur și nu stă peste butoanele de jos sau peste `StepForm` / `BottomSheet`. Folosești clasele de strat ale kitului.

## B. Analizele la fructe (Tratamente → tab „Analize”)

### Datele (migrare aditivă, NEAPLICATĂ)

- **`analize_fructe`:**
  - `id`, `tenant_id`, `client_sync_id` (index unic parțial pe tenant), `created_by`, `created_at`, `updated_at`;
  - prelevarea: `data_prelevare date`, `pv_numar text`, `pv_poza_path text`, `prelevat_de text` (check `dsvsa` / `laborator` / `eu`), `laborator text`, `data_predare date`, `nota text`;
  - rezultatul: `status text` (check `la_laborator` / `conform` / `neconform`, implicit `la_laborator`), `buletin_numar text`, `buletin_data date`, `buletin_path text`, `ce_s_a_analizat text` (text liber, cum scrie în buletin), `rest_nedetectate boolean`;
  - publicul: `public_token text unique` (aleator, cel puțin 10 caractere, negăsibil), `public_activ boolean default true`, `public_optiuni jsonb` (substanțe, tratamente, numere PV/buletin, poza buletinului — implicit oprită, telefon).
- **`analize_fructe_parcele`** (`analiza_id`, `parcela_id`, `tenant_id`): **mai multe parcele pe o analiză.** Doar parcelele care nu sunt „Personal”.
- **`analize_fructe_substante`** (`id`, `analiza_id`, `tenant_id`, `substanta`, `valoare_mg_kg numeric`, `lmr_mg_kg numeric`, `ordine`).
- **Fără tip de analiză.** Ce s-a analizat reiese din `ce_s_a_analizat`.
- **RLS:** citire pentru proprietar și operatorul cu „Tratamente” (citește); scriere pentru proprietar și `operator_can_write('tratamente')`. Toate pe `tenant_id = current_tenant_id()`.
- **Storage:** bucket privat `analize`, ca `bonuri`: politici pe prefixul tenantului, aceleași drepturi.
- **Laboratoarele folosite** se propun din analizele anterioare (distinct), fără tabel nou.

### Ecranele (kit, `check:kit`)

- **Tab-ul „Analize”** în `/tratamente`:
  - un `Segments` „Aplicări / Analize”;
  - sus, „Ultima analiză” (verdict, parcele, data buletinului);
  - lista: cele „la laborator” sus, cu albastru; titlul = parcelele + data prelevării.
- **„Analiză nouă”** (`StepForm`, 2 pași):
  1. parcelele (bifare multiplă + „Toate parcelele de vânzare”) și data prelevării (`CalendarPanel`);
  2. numărul PV-ului + poza PV, cine a prelevat (DSVSA / Laboratorul / Eu), laboratorul (cu propuneri), data predării, nota.
  
  Se trimite `client_sync_id`. Deep link: `/tratamente?tab=analize&noua=1&parcele=<id,id>`, folosit de memento.
- **Fișa analizei:**
  - etapele (Prelevată / Predată / Rezultat);
  - tratamentele din cele 30 de zile dinainte de prelevare pe parcelele alese, cu „pauza respectată ✓” sau avertizare, din registrul de tratamente;
  - „Adaugă rezultatul”, „Editează prelevarea”.
- **„Rezultatul”:** Conform / Neconform, numărul și data buletinului, buletinul (poză sau PDF), „Ce s-a analizat (din buletin)”, substanțele (opționale, cu „+ Substanță”) și „Restul substanțelor analizate: nedetectate”.
- **„Ce apare în raport”:** comutatoarele din mockup. Implicitele sunt pe fermă (în setările existente ale fermei sau în `tenant_settings`), cu suprascriere pe analiză. Nu apar niciodată: numărul atestatului, poza PV-ului, numele inspectorului.
- **Pe fișa parcelei** (`/parcele/[id]`): rândul „Ultima analiză: conform · vezi raportul” sau „Analiza sezonului: netrimisă”.
- **Neconform:** avertizare roșie în Acasă și pe fișa parcelei. Fără link public, fără raport public.

### Raportul

- **Pagina publică `/a/[token]`:**
  - server component, cu service role, care citește doar câmpurile permise;
  - există doar pentru `status = conform` și `public_activ`; altfel 404;
  - `noindex`; fără date de autentificare; ruta se adaugă la rutele publice din `proxy.ts`.
- **Conținutul raportului:**
  - numele fermei și localitatea;
  - „Atestat de producător seria X · valabil până la …”, din actele fermei, dacă există;
  - parcelele și soiul;
  - prelevarea (data, PV, cine), laboratorul;
  - buletinul (număr, dată);
  - „Analiza: <ce s-a analizat>”;
  - substanțele (găsit / limită) și „restul nedetectate”;
  - tratamentele din cele 30 de zile dinainte, cu pauza respectată;
  - telefonul (după opțiuni);
  - codul QR spre același link.
- **PDF și afiș A4 cu QR** (mare, pentru piață), din aceleași date. Refolosești biblioteca de PDF din Rapoarte (promptul 19). Pentru QR adaugi o dependență mică (de ex. `qrcode`) dacă nu există.
- **Butoanele:** „Distribuie linkul” (Web Share, cu WhatsApp ca rezervă), „Descarcă PDF”, „Afiș A4 cu QR”, iar linkul public se poate opri.
- **Rapoarte → Exportă:** „Analizele sezonului” (Excel + PDF, o listă).

## C. Mementoul dinainte de cules

### Când începe culesul (pe parcelă, pe sezon)

- **Ordinea surselor:**
  1. data pusă de mână pe fișa parcelei („Culesul începe pe ~… · Schimbă”), salvată pe sezon (folosește `configurari_parcela_sezon` dacă se potrivește, altfel o migrare aditivă);
  2. ziua primei recoltări de anul trecut pe parcelă, mutată în anul curent;
  3. nimic: fișa cere „Pune data culesului”.
- **Ajustarea după stadiu** o faci doar dacă `stadii_fenologice_parcela` permite o regulă clară. Altfel o sari și o notezi în raport.

### Mementoul

- **Doar proprietarul primește.** Notificare **push** pe telefon, prin infrastructura existentă, plus notificarea în aplicație.
- **Când:** la **8:00 ora României**, cu **21, 14, 7 și 3 zile** înainte de cel mai apropiat început de cules (zilele se pot schimba din Setări). Apoi **zilnic** din ziua culesului.
- **Grupare:** o singură notificare, cu parcelele care încep în aceeași săptămână.
- **Liniștea 22–6** rămâne.
- **Se oprește:**
  - când există o analiză cu prelevarea în fereastra sezonului pentru acele parcele;
  - la „Nu fac analize anul acesta” (doar sezonul curent);
  - din comutatorul general.
- **„Amână”** 1, 3 sau 7 zile (din butonul notificării, implicit 3) suspendă până la acea dată.
- **Textul** spune câte produse din fermă au pauza mai lungă decât zilele rămase („evită acum produsele cu pauză lungă (2 în fermă)”).
- **Programarea:**
  - refolosești un cron zilnic existent (`vercel.json`; verifică limitele planului Hobby) sau verificarea zilnică de la 05:00 UTC;
  - un cron nou adaugi doar dacă nu se poate altfel; notezi în raport;
  - nu apelezi cronurile în producție.
  
  Starea (amânat până la, dezactivat pe sezon, ultima trimitere) stă într-un tabel nou pe tenant + sezon (migrare aditivă). Setările stau în preferințele de notificări existente.

### Butoanele din notificare

- Acțiunile **„Am trimis”** și **„Amână 3 zile”** (Android: cel mult două).
  - „Am trimis” deschide deep link-ul „Analiză nouă” cu parcelele.
  - „Amână” cheamă o rută API autentificată (`POST`, cookie-ul sesiunii, fără token în URL).
- **Atenție:** `public/sw.js` nu se comite. Găsește sursa service worker-ului din care se generează. Dacă acțiunile nu se pot adăuga acolo fără să atingi `public/sw.js`, notificarea doar deschide foaia „Analiza dinainte de cules” din aplicație. Notezi în raport.
- **Foaia „Analiza dinainte de cules”** (din notificare sau din cardul din Acasă):
  - „Culesul începe în ~N zile”, cu parcelele și data;
  - „Produse de evitat acum” (produsele fermei cu pauza > zilele rămase);
  - amânarea 1 / 3 / 7 zile;
  - butoanele „Am trimis la analize”, „Amână N zile” și „Nu fac analize anul acesta”.
  
  E o foaie (`BottomSheet`), nu deasupra unui `StepForm`.
- **Cardul din Acasă**, primul, „Analiza la fructe · culesul în N zile”, cu „Am trimis” și „Amână”. Stă până la trimitere, amânare sau dezactivare.
- **Setări → Notificări:** „Analiza dinainte de cules” (comutator), „Cu câte zile înainte” (21 / 14 / 7 / 3 / 1, mai multe deodată), „Zilnic din ziua culesului” și „Anul acesta nu fac analize”.

### Avertizarea la tratament

În formularul de tratament (promptul 18), când pauza produsului ales trece de începutul culesului estimat al unei parcele alese: avertizarea din mockup („Pauza trece de începutul culesului…”). **Doar avertizează, nu blochează**, ca la recoltarea în pauză.

## D. Demo

Seed-ul pentru demo-urile **noi** primește:
- o analiză conformă pe 2 parcele, cu 2 substanțe (exemplu) și link public;
- o dată de cules estimată pe fiecare parcelă.

Datele existente nu se ating.

## E. Verificări și raport

- **Kitul:** folderele noi intră în `KIT_RULE_DIRS`.
- **Teste unitare:**
  - estimarea culesului (cele 3 surse);
  - calendarul mementoului (21 / 14 / 7 / 3, zilnic, amânare, oprire la analiză, „nu anul acesta”, liniștea de noapte);
  - produsele de evitat;
  - avertizarea la tratament;
  - pagina publică (404 pentru `neconform` / `la_laborator` / inactiv; câmpurile interzise nu apar niciodată);
  - textele „Atestat”.
- `npm run lint`, `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit`, `npm run build`: toate trec.
- **Test în browser, doar într-un demo nou** (verifici întâi delogarea):
  - analiză pe 2 parcele → rezultat conform → raport, PDF, afiș, link public deschis fără cont;
  - neconform → fără link;
  - un operator cu „Tratamente: Citește” vede analizele, dar nu le poate adăuga;
  - mementoul: simulezi data (funcție pură + test) și verifici cardul din Acasă și foaia.
  
  Notezi tenantul.
- **Migrările:** scrise, aditive, NEAPLICATE. Pentru fiecare spui dacă aplicația merge fără ea. Din baza de date doar citești (select).
- **Raport** în `docs/redesign/raport-26-analize.md`: 10 rânduri pentru Andrei, apoi ce ai schimbat, migrările cu SQL complet și ordinea lor, cum se programează mementoul, ce s-a întâmplat cu acțiunile din notificare, ce n-ai putut testa, verificările, hash-urile commit-urilor. Actualizezi `CLAUDE.md` (modulul nou, ruta publică, mementoul).

## Ce NU atingi

Asociația, magazinul, chatul AI, `/start`, Login, Admin, logica de bani, stocul produselor de tratament (mai târziu), variabilele din Vercel, `public/sw.js`.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
