# Prompt 29 — Tratamente, partea a doua (2/3): Capcanele

Lucrezi singur, fără plan și fără să ceri aprobare. Ce te blochează sari și notezi în raport.

**Branch:** `redesign/capcane-29`, din `main` (`a3692d1`). Commit-uri mici, push după fiecare bucată. Fără merge.

**Mockup aprobat** (toate recomandările acceptate de Andrei): `docs/redesign/mockups/tratamente-2.html` de pe `redesign/prompturi-11-12`, capitolul 2, „Capcanele”. Planul pe stadii vine în promptul 30. Acum adaugi doar tab-ul „Capcane”, așa că taburile devin Aplicări · Capcane · Analize; „Plan” se pune între Aplicări și Capcane în 30.

**Context:** `CLAUDE.md`, `docs/redesign/tokens.md`, kitul (`StepForm`, `NumericKeypad` în `dock`, `BottomSheet`, `CalendarPanel`), Tratamente (18), Analize și memento (26), Magazia (28), verificarea de dimineață (14 / 26).

---

## 1. Datele (migrare aditivă, NEAPLICATĂ)

În producție există deja tabelele `capcane_montate` și `capcane_verificari`, cu 0 rânduri. Citește-le din producție (coloane, politici, constrângeri; doar select) și **refolosește-le**. Ce lipsește adaugi aditiv:

- **Pe `capcane_montate`:**
  - `interval_verificare_zile int default 7`;
  - `interval_atractant_zile int null` (implicit 7 pentru Drosophila);
  - `data_schimb_atractant date null`;
  - `client_sync_id uuid` (index unic parțial pe tenant).
  
  `tip_capcana` ia valorile `drosophila` / `lipicioasa_galbena` / `feromoni` / `alta` (check aditiv doar dacă nu strică rândurile; tabelul e gol). `status` ia `activa` / `scoasa`.
- **Pe `capcane_verificari`:**
  - `capcana_nr int` (1..`nr_bucati`, capturile sunt pe fiecare capcană din grup);
  - `atractant_schimbat boolean default false`;
  - `client_sync_id`.
  
  O verificare pe grup = câte un rând pe capcană, aceeași dată.
- **Pragurile, pe fermă:** în `tenant_settings`, coloana `prag_capcane jsonb` (de ex. `{"drosophila":{"prag":1,"doar_in_coacere":true}}`). Implicit pentru Drosophila: 1 captură / capcană / săptămână, doar în coacere. Pentru celelalte tipuri, implicit fără prag.
- **RLS** (le înlocuiești pe cele existente doar dacă nu se potrivesc):
  - citire: `operator_can_read('tratamente')`;
  - inserare și modificare: proprietarul sau `operator_can_write('tratamente')`;
  - ștergere: proprietarul;
  - totul pe `tenant_id = current_tenant_id()`.
- **Fotografiile** merg în bucket-ul privat existent `analize` sau în unul nou `capcane`, cu aceleași politici pe prefixul tenantului.

## 2. Ecranele (kit, `check:kit`), ca în mockup

- **Tab-ul „Capcane”** în `/tratamente`:
  - sus, cardul „Verificare azi · N capcane”, când e scadentă, cu „Atractantul se schimbă azi la M”;
  - lista grupurilor pe parcelă (tip, bucăți, ultima verificare, „peste prag”);
  - butoanele „Verifică acum” și „+ Montează”.
- **„+ Montează”:** tipul (4 plăci), parcelele (mai multe → un grup pe fiecare parcelă), bucățile, „Verific la N zile”, data și poza (opțional).
- **„Verifică acum”** (`StepForm`, câte un pas pe capcană, „Verificare · 2 din 6”):
  - câte ai prins, cu tastatura mare în `dock` (câmpul pornește gol);
  - „Am schimbat atractantul” (comutator, apare când e scadent);
  - poză și notă, opțional.
  
  La final, un rezumat. Dacă un grup a trecut de prag: „Peste prag la Maravilla 1”, cu butonul „Fă un tratament pe Maravilla 1”, care deschide formularul de tratament cu parcela aleasă. Salvarea trimite `client_sync_id`.
- **Fișa grupului / graficul pe parcelă:**
  - totalurile pe săptămână, ca bare, cu linia punctată a pragului;
  - tratamentele aplicate pe parcelă, ca semne pe același grafic;
  - lista verificărilor;
  - „Scoate capcanele” (status `scoasa`);
  - butonul „Fă un tratament pe …”.
- **„În coacere”:** parcela e în stadiul de coacere sau recoltare (fișa parcelei), sau data e în fereastra culesului estimat (promptul 26), de la cu 7 zile înainte de început încolo. Folosește funcțiile existente; nu inventa altă estimare.
- **Pragul:** în Setări → Notificări (sau Setări → Ferma, unde se potrivește), „Pragul la capcane”, pe tip.

## 3. Mementourile și alerta

Toate rulează în verificarea de dimineață existentă, fără cron nou, cu liniștea 22–6 și preferințele respectate.

- **„Verifică capcanele”:** în ziua în care un grup ajunge la `data_urmatoarea_verificare`.
  - Primesc proprietarul și operatorii activi cu „Scrie” pe Tratamente: push + în aplicație, plus cardul din Acasă, până se face verificarea.
  - După verificare, `data_urmatoarea_verificare = data verificării + interval`.
- **„Schimbă atractantul”:** apare în același mesaj, când e scadent.
- **Alerta „Peste prag”:** imediat după salvarea unei verificări care trece pragul, doar proprietarului, push + în aplicație: „Drosophila peste prag la Maravilla 1 (9 în 3 capcane)”, cu link spre grafic.
- **Comutatoare** în Setări → Notificări: „Verifică capcanele” și „Capturi peste prag”, pornite.

## 4. Registrul

În Rapoarte → Exportă → Registrul de tratamente (PDF / Excel), o secțiune „Monitorizare cu capcane”: grupurile, verificările și capturile pe săptămâni, pe parcelă, în sezon. Raportul public al analizei nu se schimbă.

## 5. Demo

Seed-ul pentru demo-urile **noi**:
- 2 grupuri Drosophila (3 bucăți fiecare) și 1 grup de lipicioase galbene;
- verificări pe 4–6 săptămâni, cu o parcelă peste prag în ultimele săptămâni;
- o verificare scadentă azi.

Reîncărcarea demo-ului le curăță. Datele existente nu se ating.

## 6. Verificări și raport

- **Kitul:** folderele noi intră în `KIT_RULE_DIRS`.
- **Teste unitare:**
  - totalurile pe săptămână;
  - „peste prag” (cu și fără „doar în coacere”);
  - scadența verificării și a atractantului;
  - destinatarii mementoului (proprietar + operatori cu „Scrie”, fără cei cu „Citește” și fără cei dezactivați);
  - liniștea de noapte;
  - mai multe parcele → mai multe grupuri.
- `npm run lint`, `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit`, `npm run build`, `npm run test:e2e:smoke`: toate trec. Adaugă la smoke: montează → verifică (cu o valoare peste prag) → apare „peste prag”. Pasul se sare, cu motiv, cât migrarea lipsește.
- **Test în browser doar într-un demo nou** (verifici întâi delogarea). Fără migrare, aplicația merge ca azi: tab-ul arată „după actualizarea bazei de date”. Notezi tenantul.
- **Migrările:** scrise, aditive, NEAPLICATE. Spui ordinea, dacă aplicația merge fără ele și dacă se aplică înainte sau după merge. Din baza de date doar citești (select).
- **Raport** în `docs/redesign/raport-29-capcane.md`: 10 rânduri pentru Andrei, apoi ce ai schimbat, migrările cu SQL complet, mementourile, ce n-ai putut testa, verificările, hash-urile commit-urilor. Actualizezi `CLAUDE.md`.
- **`public/sw.js` nu se comite.** Folosește `git add` pe fișiere anume, nu `git commit -a`.

## Ce NU atingi

- tab-ul Plan (vine în 30);
- Magazia, în afară de citire;
- stocul de fructe;
- Asociația, magazinul, chatul AI, `/start`, Login, Admin;
- variabilele din Vercel și cronurile (nu le apelezi).

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
