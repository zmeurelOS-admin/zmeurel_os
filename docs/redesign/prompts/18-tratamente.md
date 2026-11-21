# Prompt 18 — Modulul Tratamente (stropiri, fertirigare, pauză) + „Șterge contul” reparat

Model: Opus 5.5 · Effort: high · Mod: normal (fără plan) · Sesiune: NOUĂ · Branch: `redesign/tratamente` (pornit din `main` `b6c91c9`) · Rezultat: branch verde, cu push, fără merge

## Cum lucrezi

- Lucrezi singur, fără plan și fără să ceri aprobare. Ce te blochează sari, notezi în raport și continui.
- Commit-uri mici, pe bucăți logice, cu push după fiecare. Logica (pauză, avertismente, calcule de doze, grupare) stă în funcții pure, cu teste unitare.
- Migrările le scrii, **nu le aplici**. Doar aditive: coloane noi nule, indexuri, funcții noi / `create or replace`. Fără `drop` pe date, fără `update`/`delete`. Orice funcție nouă `SECURITY DEFINER` respectă regula din `CLAUDE.md`. Înainte de orice migrare citești cu `select` schema și funcțiile reale din producție, nu din fișierele vechi de migrare.
- Aplicația trebuie să meargă și **înainte** de aplicarea migrărilor: unde depinzi de o coloană nouă, citirea nu cade (fallback), iar scrierea spune clar „se activează după actualizarea bazei” (ca la promptul 17).

## Mockup-ul aprobat

- Pagina HTML aprobată de Andrei e în repo: `git show origin/redesign/prompturi-11-12:docs/redesign/mockups/tratamente-v2.html`. O deschizi local în browser: are toate cele 9 ecrane, care merg, și deciziile sus. **Urmezi ecranele și textele de acolo.** Dozele și pauzele din mockup sunt exemple.
- Construiești pe kit (`src/components/kit`), cu regulile din `CLAUDE.md` (tokeni canonici, 48/56 px, `StepForm`, `BottomSheet`, noapte). Model de urmat: Recoltări. Adaugi folderele noi în `KIT_RULE_DIRS`.

## Deciziile lui Andrei (sursa de adevăr)

1. **Intrarea:** Mai mult → rândul „Tratamente”, sub Ferma (cu semnalul de pauză pe el), plus cardurile din Acasă (pauza activă și „De făcut azi” cu tratamentele planificate, cu „Marchează făcut”). Bara de jos rămâne cum e. Ruta: `/tratamente`.
2. **Doza la stropire:** se scrie la 100 l (ml sau g / 100 l), ca pe etichetă; comutator „la ha” (l sau kg / ha) pentru produsele cu doza pe hectar. Aplicația calculează cât pui: la 100 l → doză × volum / 100; la ha → doză × suprafața parcelelor alese (`parcele.suprafata_m2`).
3. **Volumul de soluție:** ținut pe fiecare parcelă și propus singur (suma parcelelor alese); se poate schimba în formular. Coloană nouă nulă pe `parcele` (de ex. `volum_solutie_l numeric`), editabilă din fișa / formularul parcelei sau salvată la primul tratament pe parcelă (alegi varianta simplă și explici). Fără volum salvat, câmpul pornește gol.
4. **Fertirigarea:** pe parcele (fiecare cu bifă „azi”), în **g/plantă** pentru fiecare produs, cu rezervorul A sau B; kg pe parcelă = g/plantă × `parcele.nr_plante` / 1000, calculat și afișat; totalul pe rezervor jos. Fertirigarea nu are pauză (dacă produsul nu are `phi_zile`).
5. **Scăderea din stoc:** NU acum (`stoc_mutatie_id` rămâne gol).
6. **Planurile pe stadii:** NU acum (`planuri_tratament*` nu se ating). Acum: „Repetă” (pornește formularul cu aceleași parcele, produse și doze ca un tratament anterior) + planificarea simplă pe o dată.
7. **Capcanele:** placa „Capcane” apare dezactivată, „în curând”. Fără ecrane.
8. **Recoltarea dintr-o parcelă în pauză:** doar avertizare, nu blocare. Ecranul din Recoltări (pasul cu parcela) arată pauza pe parcelă; dacă omul alege totuși parcela, apare avertismentul cu „Alege altă parcelă” ca acțiune principală și „Recoltez totuși”, care cere un motiv (plăci: „Pentru consum propriu”, „Fructe aruncate”, „Altceva”). Motivul se salvează lângă recoltare (coloană nouă nulă pe `recoltari` sau eticheta `[zmeurel:…]` din `observatii`, cum se face deja cu `[zmeurel:harvest-crop]`; alegi varianta care nu schimbă semnătura RPC-ului de creare și explici).
9. **Activitățile vechi:** înregistrările din `activitati_agricole` de tip tratament (Stropire, Fungicide/Pesticide, Fertilizare foliară, Fertirigare, Fertilizare de bază; verifici valorile reale cu `select distinct`) apar în jurnal ca „Importat”, doar citire, **netransformate**. Prășitul și alte lucrări nu apar.

Plus, din propunerea aprobată:
- **Mai multe produse în același rezervor** (o stropire = mai multe produse).
- **Pauza = cea mai lungă** dintre `phi_zile` ale produselor; se socotește de la ziua aplicării, în ora României. Afișată mare în rezumat: „Nu recolta din X până <zi> <dată>”.
- **Avertismente** (informative, nu blochează): aceeași grupă FRAC/IRAC ca tratamentul anterior pe aceeași parcelă (ultimele 30 de zile); numărul maxim de aplicări pe sezon (`nr_max_aplicari_per_sezon`, sezon = anul calendaristic) atins; intervalul minim (`interval_min_aplicari_zile`) neatins; ploaie / vânt în prognoză (din `fetch-meteo`, câmpul `spray`), doar la „Făcut acum”.
- **Rezumatul (pasul 3):** „Făcut acum” / „Altă zi” (cu dată) / „Planifică” (cu dată); fereastra meteo la „Făcut acum”; lista produselor cu cantitățile calculate; pauza.
- **Planificatele:** `status = 'planificata'`, `data_planificata`. Apar în jurnal la „Planificate” și în Acasă la „De făcut azi” în ziua lor. „Marchează făcut” → `status = 'aplicata'`, `data_aplicata` = azi; pauza pornește atunci. Notificare dimineața în ziua lor, în cronul existent `notificari-dimineata` (deduplicare prin `data.reminder_key = tratament:<tenant>:<data>`, o singură notificare pe fermă: „2 tratamente planificate azi”), legată de cheia de preferință potrivită din `src/lib/notifications/preferinte.ts` (`pauza` sau una nouă, `tratamente`, cu rândul ei în „Ce primești”; alegi și explici).
- **Alegerea produsului:** căutare după nume sau substanță; „Folosite recent” (din aplicările fermei); catalogul (`produse_fitosanitare`: globale cu `tenant_id is null` + ale fermei), cu tip, substanță, FRAC, pauză, doza de pe etichetă, filtrat „pentru zmeur” după `omologat_culturi` când cultura parcelei e zmeura (fără să ascunzi restul de tot: „Arată toate”). „Nu e în listă” → produs nou al fermei, cu nume, tip și pauză (verifici că RLS permite inserarea în `produse_fitosanitare` cu `tenant_id` al fermei; dacă nu, migrare de politică).

## Schema existentă (citește-o, nu o reinventa)

- `aplicari_tratament`: o aplicare = o parcelă (`parcela_id`), cu `status` (`planificata`, `aplicata`, plus `reprogramata`/`anulata`/`omisa`), `data_planificata`, `data_aplicata`, `metoda_aplicare` (`foliar`, `fertirigare`, `fertilizare_baza`, `granulat_sol`, `capcana_*`, `altul`), `tip_interventie`, `sursa` (`manuala`, `din_plan`), `meteo_snapshot`, `observatii`.
- `aplicari_tratament_produse`: produsele unei aplicări, cu `doza_ml_per_hl`, `doza_l_per_ha`, `cantitate_totala`, `unitate_cantitate`, `cantitate_text`, `phi_zile_snapshot`, `frac_irac_snapshot`, `produs_nume_snapshot`, `ordine`.
- `produse_fitosanitare`: catalog (16 globale + produse ale fermelor), cu `phi_zile`, `frac_irac`, dozele min/max, `nr_max_aplicari_per_sezon`, `interval_min_aplicari_zile`, `omologat_culturi`.
- **În producție există deja date reale:** ferma lui Andrei are 9 aplicări în `aplicari_tratament` și 13 activități vechi. Ecranele noi trebuie să le arate corect. **Nu le modifici.**
- Dacă îți trebuie, adaugi coloane nule (migrare aditivă), de exemplu: un `lot_id uuid` pe `aplicari_tratament` ca să grupezi aplicările salvate împreună pe mai multe parcele (jurnalul arată un singur rând „Maravilla 1, Maravilla 2”); `rezervor text` (A/B) și `doza_g_per_planta numeric` pe `aplicari_tratament_produse`. Aplicările vechi fără lot apar câte una.
- RLS și gărzile operatorilor (`operator_can_write`) există pe aceste tabele: le verifici cu `select` din `pg_policies` și le respecți.

## Pauza: o singură sursă

Azi pauza din Recoltări (`findPauseWarning` în `RecoltareStepForm.tsx`) și din Acasă (`parcelePauza` în `src/lib/dashboard/acasa.ts`) vine doar din `activitati_agricole.timp_pauza_zile`. Faci **un singur helper** (de ex. `src/lib/tratamente/pauza.ts`) care combină:
- aplicările noi cu `status = 'aplicata'` (pauza = max `phi_zile_snapshot` al produselor);
- activitățile vechi cu `timp_pauza_zile > 0`.

Îl folosesc: Recoltări, Acasă (telefon și desktop), Mai mult (semnalul de pe rând), jurnalul Tratamente, Rapoarte (dacă au deja pauza). Teste: pauză din aplicare nouă, din activitate veche, ambele, expirată, cu ora României.

## „Șterge contul” (GDPR)

`DELETE /api/gdpr/account` șterge direct rândul din `tenants`, fără curățarea în ordinea cheilor, deci la o fermă cu tratamente / capcane poate eșua pe cheile `ON DELETE RESTRICT` spre `parcele`. Repari: rulează întâi `deleteTenantScopedData(admin, tenantId, { scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.gdprFarmDelete, verifyCriticalTables: true })`, apoi ce face acum (analytics, ai_conversations, `tenants`, `profiles`, `auth.admin.deleteUser`). Păstrezi protecțiile existente (cont protejat, step-up). Test cu client simulat: ordinea apelurilor și oprirea la eroare. **Nu rulezi nicio ștergere reală.**

## Demo

Dacă e simplu, seed-ul demo-ului „Fructe de pădure” (cod, nu date) primește 2–3 aplicări (o stropire cu pauză încă activă, o fertirigare, una planificată mâine), ca un demo nou să arate modulul plin. Nu rulezi seed-ul peste date existente; îl testezi creând un demo nou.

## Ce NU faci

- Mediul local folosește **baza de PRODUCȚIE**. Din bază doar citești (`select`). Testele manuale se fac **doar într-un cont demo nou**.
- Nu aplici migrările, nu apelezi cronuri, nu schimbi variabile de mediu, nu deployezi Edge Functions.
- Nu atingi `public/sw.js` și nu slăbești `.claude/settings.json`.
- Nu atingi planurile de tratament, stocul produselor, capcanele (în afară de placa dezactivată), Asociația, chatul AI, Material săditor, magazinul. Ecranele vechi din Parcele / Activități rămân cum sunt (doar intrarea lor la tratamente poate trimite spre `/tratamente`, dacă e firesc).

## Verificare în demo (la final), la 390×844

- Mai mult → Tratamente; jurnalul cu Făcute / Planificate și filtrele; un rând „Importat”.
- Stropire nouă pe 2 parcele, cu 3 produse, la 100 l și la ha; pauza = cea mai lungă; avertismentul FRAC.
- Fertirigare pe 3 parcele, 2 g/plantă, A/B; totalurile în kg.
- „Repetă” din pasul 1.
- O planificare pe azi → apare în Acasă la „De făcut azi” → „Marchează făcut” → pauza apare în Acasă și în Recoltări.
- Recoltare din parcela în pauză → avertisment → „Recoltez totuși” cu motiv → motivul e salvat.
- O trecere și noaptea, și o trecere la 1280×800 (doar să nu se strice).

## Raportul

- ce ai schimbat, pe bucăți, cu commit;
- migrările, cu SQL complet și ordinea lor; ce merge fără ele și ce nu;
- cum ai grupat aplicările pe mai multe parcele; unde stă motivul recoltării în pauză; ce cheie de notificare ai folosit;
- ce n-ai putut testa;
- verificările: lint, typecheck, check:kit, test:critical:unit, build;
- lista commit-urilor, cu hash.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
