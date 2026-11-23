# Prompt 30 — Tratamente, partea a doua (3/3): Planul pe stadii

Lucrezi singur, fără plan și fără să ceri aprobare. Ce te blochează sari și notezi în raport.

**Branch:** `redesign/plan-30`, din `main` (`c6aef5c`). Commit-uri mici, push după fiecare bucată. Fără merge. Folosește `git add` pe fișiere anume, nu `git commit -a`: `public/sw.js` nu se comite.

**Mockup aprobat** (toate recomandările acceptate de Andrei): `docs/redesign/mockups/tratamente-2.html` de pe `redesign/prompturi-11-12`, capitolul 3, „Planul pe stadii”. Taburile din Tratamente devin **Aplicări · Plan · Capcane · Analize**.

**Context:** `CLAUDE.md`, `docs/redesign/tokens.md`, Tratamente (18), Parcele și stadiile (20; `stadii_fenologice_parcela`, cohortele), culesul estimat și mementoul (26), Magazia (28), Capcanele (29). Formularele urmează modelul din Recoltări.

---

## 1. Datele: refolosește ce există

În producție există deja `planuri_tratament` (4 planuri), `planuri_tratament_linii` (13 linii) și `parcele_planuri`, cu coloane ca:
- pe linii: `stadiu_trigger`, `cohort_trigger`, `scop`, `regula_repetare`, `interval_repetare_zile`, `numar_repetari_max`, `metoda_aplicare`;
- pe aplicări: `aplicari_tratament.plan_linie_id` și `aplicari_tratament_produse.plan_linie_produs_id`.

Citește-le din producție (coloane, politici, funcția `upsert_plan_tratament_cu_linii`, cine le folosește în `src`; doar select) și **refolosește-le**. Planurile și liniile existente trebuie să se deschidă în noul ecran, fără conversie distructivă.

**Migrare aditivă, NEAPLICATĂ, doar pentru ce lipsește.** De exemplu:
- o linie cu mai multe produse, dacă azi e un singur produs pe linie (vezi `plan_linie_produs_id`);
- excepțiile pe parcelă;
- „sărit” pe linie și parcelă (`planuri_linii_sarite`: linie, parcelă, an, motiv);
- un tabel pentru ce s-a anunțat deja, ca notificarea să nu se repete.

Nu redenumești și nu ștergi coloane. RLS:
- citire: `operator_can_read('tratamente')`;
- scriere: proprietarul sau `operator_can_write('tratamente')`;
- ștergerea planului: proprietarul.

**Stadiile** sunt cele din aplicație (fișa parcelei, promptul 20): repaus, umflarea mugurilor, lăstari, buton floral, înflorire, fruct verde, coacere, recoltare, după recoltare (verifică lista reală și folosește-o, nu inventa alta).

## 2. Ce urmează (logica, funcție pură + teste)

- **Pentru fiecare parcelă cu plan activ în anul curent:** stadiul de acum (din fișă) → liniile acelui stadiu → „E timpul pentru…”, dacă linia n-a fost făcută (o aplicare cu `plan_linie_id` pe parcelă, în sezon) și nici sărită.
- **„Repetă la N zile, de M ori”:** după o aplicare, linia reapare peste N zile, cât timp parcela e tot în acel stadiu, până la M ori.
- **Verificările la completare** (avertizează, nu blochează):
  - pauza produsului față de culesul estimat (26);
  - numărul de aplicări pe sezon față de `nr_max_aplicari_per_sezon`;
  - intervalul minim față de `interval_min_aplicari_zile`;
  - stocul din magazie (28).
- **„A început înflorirea?”** Când se apropie data la care parcela a intrat în stadiul următor anul trecut (sau după estimarea culesului), apare întrebarea pe fișa parcelei și în tab-ul Plan, cu „Da, de azi” / „Încă nu”. Stadiul îl schimbă omul, aplicația doar întreabă.

## 3. Ecranele (kit, `check:kit`), ca în mockup

- **Tab-ul „Plan”:**
  - sus, eroul „E timpul pentru · <stadiu> · <parcele>”, cu intervențiile, fiecare cu verificările ei (magazie, pauză);
  - jos, „Urmează”: stadiile următoare, pe scurt;
  - fără plan: „Fă un plan”, cu cele două variante.
- **Atingerea unei intervenții** deschide **formularul de tratament completat** (parcele, produse, doze, metodă, `plan_linie_id`), cu informația „Completat din <plan> · <stadiu>”. Se poate schimba orice. Pe același ecran, „Sar peste” (motiv opțional) → linia apare tăiată, nu dispare.
- **„Plan nou”:**
  - **„Din ce am aplicat în <anul trecut>”:** grupează aplicările făcute anul trecut pe stadiul parcelei la data aplicării (din istoricul de stadii; dacă lipsește, îl alegi din listă). Fiecare grup se poate păstra sau scoate. Aplicările repetate ale aceluiași produs în același stadiu devin o linie cu „repetă la ~N zile”;
  - **„De la zero”.**
  
  Aplicația **nu vine cu planuri-model**.
- **„Planul întreg”:**
  - pe stadii, cu liniile (produs, doză, scop, metodă, repetare) și starea pe an: făcut / acum / sărit / urmează;
  - „+ Linie”, editarea unei linii, mutarea între stadii (ținut apăsat pe mobil, tras pe desktop);
  - parcelele planului, cu excepții pe parcelă: o linie care nu se aplică pe o parcelă.
- **Planurile vechi** apar în listă și se pot deschide și edita.

## 4. Notificarea

În verificarea de dimineață existentă (fără cron nou):
- „E timpul pentru <stadiu> la <parcele> · N intervenții” — o singură dată pe linie, parcelă și repetare;
- la proprietar și la operatorii activi cu „Scrie” pe Tratamente;
- push + în aplicație, cu liniștea 22–6 și preferințele respectate;
- comutator în Setări → Notificări: „Planul de tratamente”, pornit.

Întrebarea „A început…?” nu se trimite pe telefon; apare doar în aplicație.

## 5. Demo

Seed-ul pentru demo-urile **noi** primește un plan „Zmeură <an>” pe parcelele de vânzare, cu linii pe 4–5 stadii (produse din demo, cu exemple), o parcelă aflată în stadiul unei linii (ca să apară „E timpul pentru…”) și o linie făcută. Reîncărcarea demo-ului le curăță. Datele existente nu se ating.

## 6. Verificări și raport

- **Kitul:** folderele noi intră în `KIT_RULE_DIRS`.
- **Teste unitare:**
  - „ce urmează” (stadiu, făcut, sărit, repetare, excepții pe parcelă);
  - gruparea „din anul trecut”;
  - verificările la completare (pauză, maximul pe sezon, interval, stoc);
  - notificarea care nu se repetă;
  - destinatarii notificării.
- `npm run lint`, `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit` (dacă mașina e încărcată, `--maxWorkers=3`), `npm run build`, `npm run test:e2e:smoke`: toate trec. Adaugă la smoke: tab-ul Plan arată „E timpul pentru…” → atingi → formularul e completat → „Salvează · făcut” → linia apare „făcut”.
- **Test în browser doar într-un demo nou** (verifici întâi delogarea). Fără migrare, aplicația merge ca azi. Notezi tenantul.
- **Migrările:** scrise, aditive, NEAPLICATE. Spui ordinea, dacă aplicația merge fără ele și dacă se aplică înainte sau după merge. Din baza de date doar citești (select).
- **Raport** în `docs/redesign/raport-30-plan.md`: 10 rânduri pentru Andrei, apoi ce ai schimbat, migrările cu SQL complet, cum ai refolosit tabelele vechi, ce n-ai putut testa, verificările, hash-urile commit-urilor. Actualizezi `CLAUDE.md`.

## Ce NU atingi

- logica Magaziei și a Capcanelor (doar le citești);
- stocul de fructe;
- Asociația, magazinul, chatul AI, `/start`, Login, Admin;
- variabilele din Vercel și cronurile (nu le apelezi).

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
