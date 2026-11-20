# Prompt 16 — Rularea de noapte: curățenie, logica dintre module, reparații

Model: Fable 5.2 · Effort: high · Mod: normal (fără plan) · Sesiune: NOUĂ · Branch: `redesign/noapte-curatenie` (pornit din `9aa3318`, vârful lui `redesign/curatare-demo`; dacă `main` a ajuns deja la `9aa3318`, e același commit) · Rezultat: branch verde, cu push, fără merge

## Cum lucrezi în noaptea asta

- **Andrei doarme. Nu ceri aprobare, nu faci plan de aprobat, nu te oprești să întrebi.** Decizi singur, repari singur, verifici singur și treci mai departe.
- Ordinea e cea a secțiunilor A → H. Dacă o secțiune se blochează (lipsește o informație, ar cere o decizie de produs, testul nu se poate face), **o sari, o notezi în raport și continui** cu următoarea.
- **Commit-uri mici, câte unul pe secțiune sau pe reparație**, cu mesaj clar în română (`fix(livrari): …`, `chore(cod-mort): …`). Fiecare commit trebuie să treacă `typecheck`. Dai `push` după fiecare secțiune terminată, ca munca să nu se piardă dacă sesiunea se oprește.
- Orice reparație de logică vine cu **un test unitar** care pică înainte și trece după (în `test:critical:unit` sau lângă codul atins).
- **Dacă nu ești sigur că ceva e greșit, nu-l schimbi.** Îl treci în raport la „Întrebări pentru Andrei”, cu recomandarea ta.
- La final rulezi toate verificările și scrii raportul (vezi mai jos).

## Ce NU faci (valabil toată noaptea)

- Mediul local folosește **baza de PRODUCȚIE**. Din bază doar citești (`select`). Testele manuale în browser se fac **doar într-un cont demo** (`/start` → „Continuă fără cont”).
- Nu apelezi rutele cron. Nu setezi și nu schimbi variabile de mediu (local sau în Vercel). Nu deployezi Edge Functions.
- Migrările le scrii în `supabase/migrations/`, dar **nu le aplici**.
- Nu atingi `public/sw.js` și nu slăbești `.claude/settings.json`.
- **Nu atingi modulele puse deoparte de Andrei:** Asociația (Gustă din Bucovina), chatul AI (păstrezi legăturile de precompletare), Material săditor / butași, Parcele + Activități agricole (inclusiv tratamente), magazinul (`/comanda`, `shop_*`), Clienți magazin, Analiză magazin. Le poți citi, dar nu le schimbi și nu le ștergi codul. Singura excepție: secțiunea D, punctul 1, și cele 2 erori de lint din secțiunea G.
- Nu refaci ecrane și nu schimbi design-ul aprobat. Desktopul trebuie doar „să funcționeze”.
- Nu schimbi deciziile de produs de mai jos. Dacă găsești cod care le contrazice, **codul se aliniază la decizii**, nu invers.

## Deciziile lui Andrei (sursa de adevăr pentru verificarea logicii)

- **Comenzi:** fără campanie; avansul se notează doar la livrare; vânzarea rapidă = o comandă „La poartă”, livrată pe loc.
- **Recoltări:** se notează pe culegător, seara; kg nu se precompletează; plata culegătorilor se face la înregistrarea recoltării.
- **Bani:** venitul dintr-o vânzare parțial încasată intră **integral** la încasarea restului; prețul standard are 3 perioade (început / vârf / mediu), alese în Setări.
- **Acasă:** sezonul pornește la prima recoltare; extrasezonul doar după ce aplicația întreabă (pe la 25 octombrie).
- **Notificări:** liniște 22:00–6:00 (gerul face excepție); un comutator oprit oprește doar push-ul, notificarea rămâne în listă.
- **Datele calendaristice** se socotesc în ora României (`Europe/Bucharest`).

## A. Reparații mărunte cunoscute

1. **Numele fermei în demo:** în demo apare numele tehnic `tenant_demo_…`. Peste tot unde se afișează numele fermei (antet, Mai mult, Setări → Ferma, notificări), un nume care începe cu `tenant_demo_` se afișează ca „Ferma demo”. Faci asta într-o singură funcție de afișare, cu test. Nu modifici rândurile din bază.
2. **„Prețul standard” arată 35 lei/kg până se încarcă:** rândul afișează un schelet (sau „…”) până vin setările, nu o valoare implicită. Verifici dacă aceeași valoare implicită mai apare înainte de încărcare și în altă parte (formularul de comandă, Acasă) și repari la fel.
3. **Banda de eroare de la poza bonului** (Cheltuieli / Investiții, la 390 px) împinge suma sub tastatură. Eroarea trebuie să nu mute câmpul sumei și tastatura din `dock` (de ex. eroarea stă în pasul pozei sau ca `Notice` compact deasupra, fără să crească înălțimea zonei cu suma). Verifici în demo, la 390×844.
4. **`fetch-meteo` păstrează doar intervalul cu ploaia maximă**, deci furtunile se văd parțial. Repari în `supabase/functions/_shared/meteo-handler.ts` astfel încât prognoza pe 24 h să păstreze **toate** intervalele de 3 ore cu cod 2xx (sau, minim, cel mai riscant interval de furtună separat de cel cu ploaia maximă), fără să strici ce folosește Acasă (`useMeteo`). Test pentru funcția de prelucrare. **Nu deployezi** funcția; scrii în raport că trebuie deployată după merge.

## B. Logica dintre module: verifici și repari

Pentru fiecare legătură de mai jos: citești codul de la un capăt la altul, verifici că respectă deciziile, scrii testul și repari dacă e greșit. În raport pui un tabel: legătura, starea (corect / reparat / întrebare), commit-ul.

1. **Comandă → livrare → vânzare → încasare.**
   - O comandă livrată produce exact o vânzare (nu zero, nu două, nici la reîncercare offline, datorită `client_sync_id`).
   - Avansul apare doar la livrare.
   - Comanda „La poartă” ajunge livrată pe loc, cu vânzarea ei.
   - Anularea sau editarea unei comenzi livrate nu lasă vânzări sau mișcări de stoc orfane (verifici ce face codul azi; dacă lipsește o regulă clară, întrebare).
2. **Venitul din vânzări parțial încasate.** Găsești **toate** locurile care calculează venit / încasat / de încasat: Acasă, Vânzări, Clienți (fișa clientului), Rapoarte, notificarea „bani de încasat” (`src/lib/notifications/zilnice/`). Toate trebuie să folosească aceeași regulă și, ideal, aceeași funcție. Dacă sunt calcule duplicate care dau rezultate diferite, le aduci la o singură funcție, cu test.
3. **Prețul standard pe 3 perioade.** Verifici că formularul de comandă, vânzarea rapidă și orice preț propus folosesc perioada corectă după dată și setări, nu o valoare fixă.
4. **Recoltări → culegători → plăți.** Plata culegătorului se calculează la înregistrarea recoltării; totalurile din Culegători și din Acasă dau aceeași sumă pentru aceeași perioadă; editarea sau ștergerea unei recoltări actualizează plata.
5. **Stocul (`miscari_stoc`).** Recoltările intră în stoc, livrările ies; ajustările manuale completează coerent `cantitate_kg` și `cantitate_cal1` / `cantitate_cal2` (vezi CLAUDE.md). Verifici că ștergerea / editarea unei recoltări sau livrări nu lasă stocul greșit.
6. **Cheltuieli + Investiții** intră corect în totalurile din Acasă și Rapoarte (fără dublă numărare, perioada corectă).
7. **Acasă: sezon / extrasezon** după regula de mai sus; nimic nu comută singur în extrasezon fără întrebare.
8. **Datele în ora României:** cauți calcule de „azi”, „mâine”, „luna asta” făcute cu `new Date()` / UTC care pot greși între 00:00 și 02:00/03:00. Le aduci la helper-ul existent pentru `Europe/Bucharest` (sau creezi unul, cu test).
9. **Invalidarea cache-ului după mutații:** după o livrare, o încasare, o recoltare, o cheltuială, ecranele legate (Vânzări, Clienți, Acasă, Stoc, Culegători) se actualizează. Verifici `queryClient.invalidateQueries` față de `src/lib/query-keys.ts` și completezi ce lipsește.
10. **Idempotența la creare:** toate formularele de creare din modulele refăcute trimit `client_sync_id` și tratează 409 / `23505` ca succes.

## C. Resetarea fermei și ștergerea GDPR (bug găsit la promptul 15)

- Cheile `ON DELETE RESTRICT` din lanțul `aplicari_tratament*` / `capcane_*` / `planuri_tratament*` / `produse_fitosanitare` spre `parcele` și `shop_order_erp_links` → `comenzi` fac ca **resetarea fermei** și **ștergerea GDPR** să eșueze pentru o fermă reală care are tratamente, capcane sau legături de magazin.
- Ambele sunt acțiuni cerute explicit de utilizator, care trebuie să șteargă **toate** datele fermei. Repari în `src/lib/tenant/destructive-cleanup.ts`: adaugi tabelele lipsă în ordinea corectă a cheilor pentru scopurile `farm_reset` și `gdpr_farm_delete` (poți refolosi `DEMO_ONLY_DELETE_ORDER` din `demo-cleanup-server.ts`, mutând lista într-un loc comun). Tabelele `shop_orders` / `shop_order_erp_links` / `association_product_offers` ale fermei: le incluzi la GDPR; la resetare, doar `shop_order_erp_links` (ca să poată pleca `comenzi`), iar `shop_orders` rămân. Dacă schema arată altceva decât descrie acest punct, alegi varianta sigură și explici.
- Inventarul îl refaci cu `select` pe `information_schema` / `pg_constraint`, nu din memorie.
- Teste cu client mock: ordinea ștergerilor, scopurile, faptul că demo-cleanup rămâne neschimbat.
- **Nu rulezi nicio resetare și nicio ștergere reală.**

## D. Cod mort

1. Cauți fișiere, componente, hook-uri, exporturi, rute și dependențe fără nicio folosire. Instrumente: `npx knip` sau `npx ts-prune` (rulate cu `npx`, fără să le adaugi în `package.json`), plus `grep` pentru folosiri dinamice (`import()`, chei de rută în string-uri, `next/dynamic`, `vercel.json`, teste, e2e).
2. Ștergi **doar ce e dovedit nefolosit**: niciun import, nicio rută accesibilă, nicio referință în string-uri, în `vercel.json`, în e2e sau în teste. Componentele vechi înlocuite de kit în modulele refăcute (Recoltări, Comenzi, Livrări, Acasă, Clienți, Culegători, Cheltuieli, Investiții, Vânzări, Mai mult, Notificări, Setări) sunt primii candidați.
3. Nu ștergi nimic din modulele puse deoparte, nici aliasurile de tokeni vechi (le folosesc modulele nerefăcute), nici migrări, nici obiecte din bază.
4. Dependențele din `package.json` fără niciun import le scoți doar dacă `build` și testele trec după aceea.
5. În raport: lista a ce ai șters, grupată, cu numărul de linii scoase.

## E. Regulile kitului pe toate modulele refăcute

- `scripts/kit-rules.mjs` (`KIT_RULE_DIRS`) are azi doar kitul, `/admin/kit` și Recoltări. Adaugi folderele tuturor modulelor refăcute (lista de la D.2: paginile din `src/app/(dashboard)/…` și componentele lor din `src/components/…`).
- Repari toate abaterile găsite de `npm run check:kit` (tokeni vechi, hex, `dark:`, text sub 13 px, z-index numeric, ținte sub 48 px), fără să schimbi aspectul aprobat. Dacă o abatere nu se poate repara fără schimbare vizibilă, o lași, o excluzi punctual cu comentariu și o treci în raport.

## F. Securitate: migrare scrisă, neaplicată

- Scrii migrarea `supabase/migrations/<timestamp>_revoke_trigger_functions.sql`:
  - `revoke execute ... from public, anon, authenticated` pe funcțiile `SECURITY DEFINER` din `public` care sunt **doar funcții de trigger** (`prorettype = 'trigger'::regtype`). Lista o iei cu `select` din `pg_proc`, nu o ghicești. Execuția unui trigger nu verifică `EXECUTE`, deci triggerele merg mai departe;
  - `revoke execute on function public.merge_clienti_duplicates(...) from public, anon` (păstrezi `authenticated`, `service_role`), după ce verifici semnătura exactă și că aplicația o apelează doar ca utilizator logat.
- Nu atingi RPC-urile folosite de aplicație. În raport: SQL-ul complet și lista funcțiilor.

## G. Igiena repo-ului

1. Repari cele **2 erori vechi de lint** (`analytics-magazin/page.tsx`, `app-date-picker.tsx`) cu schimbarea minimă, fără să modifici comportamentul. Excepție permisă de la regula modulelor puse deoparte, doar pentru aceste 2 erori.
2. Cele 2 teste Google care pică la timeout sub încărcare: le măreşti timeout-ul sau izolezi încărcarea lentă, ca `test:critical:unit` să treacă integral.
3. **`CLAUDE.md`, corectat după realitate:** „There are no unit tests” e fals (există `test:critical:unit`, vitest); lista de cronuri e incompletă (adaugi toate cronurile din `vercel.json`, cu ora UTC); comenzile `check:kit` și `test:critical:unit`; păstrezi regula despre `SECURITY DEFINER`. Nu rescrii restul.

## H. Verificare la final, în demo

- Pornești aplicația local, intri într-un demo nou și treci prin fluxul complet la 390×844: o recoltare pe culegător → o comandă → livrarea ei cu avans → încasarea restului → verifici Acasă, Vânzări, fișa clientului, Culegători și Stocul. Apoi o vânzare „La poartă” și o cheltuială cu poză de bon (încărcare simulată).
- Treci o dată prin aceleași ecrane la 1280×800, doar să verifici că nu se strică nimic pe desktop.
- Totul **doar în contul demo**.

## Raportul

1. Rezumat în 5 rânduri: ce s-a reparat important.
2. **Tabelul legăturilor din B** (corect / reparat / întrebare, cu commit).
3. Secțiunile A–H: ce ai făcut, ce ai sărit și de ce.
4. Codul mort scos (grupat, linii).
5. Migrarea, cu SQL complet.
6. Ce trebuie făcut după merge (de ex. deploy `fetch-meteo`, aplicarea migrării).
7. **Întrebări pentru Andrei**, fiecare cu recomandarea ta.
8. Ce n-ai putut testa.
9. Verificările: lint, typecheck, check:kit, test:critical:unit, build (toate trebuie să treacă; dacă nu, explici).
10. Lista commit-urilor, cu hash.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
