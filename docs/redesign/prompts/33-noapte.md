# Promptul 33 — resturile redenumirii, banii neîncasați, pierderile din stoc, vremea, audit final

**Mod de lucru:** întâi citești codul și scrii planul (pe secțiuni: ce faci, fișierele modificate/noi, migrările, testele, riscurile, întrebările). Îl dai și te oprești până confirmă Andrei. După confirmare implementezi planul aprobat; ce te blochează sari și notezi în raport. Optimizarea RLS NU intră aici (amânată). Ordinea de mai jos e și ordinea de prioritate: dacă timpul nu ajunge, lucrurile de la final rămân, nu cele de la început.

## 0. Pornire

- Branch nou `redesign/33-noapte` din `main` (`958e9cf`), nu din branch-ul cu prompturi.
- Citește întâi: `src/lib/brand.ts`, `docs/redesign/raport-32*.md`, `docs/redesign/raport-31*.md`, `docs/redesign/raport-30*.md`, middleware-ul (redirecționarea `zmeurel.ro` → `caietulfermei.ro`), `scripts/check-env.js`.
- Baza de date (`ilybohhdeplwcrbpblqw`) e cea de PRODUCȚIE, și local. Din ea doar citești (`select`, `pg_policies`, `pg_get_functiondef`). Scrierile de test se fac doar într-un cont demo nou (`/start` → „Încearcă o fermă demo” → „Fructe de pădure” → „Pornește demo-ul”; aștepți `/dashboard` înainte de alte pagini).
- Migrările le scrii în `supabase/migrations/`, NU le aplici. Doar aditive. Fără `drop`.
- Funcțiile noi `SECURITY DEFINER`: `revoke all ... from public, anon`; dacă primesc ferma ca parametru, verificare internă înainte de `grant ... to authenticated`.
- NU comiți `public/sw.js` (sursa e `public/push-handlers.js`). `git add` doar pe fișiere anume, niciodată `git commit -a` / `git add -A`. Nu atingi `.claude/settings.json`. Nu apelezi cronuri în producție. Nu folosești chei secrete.
- Commit-uri mici, push după fiecare secțiune.

## 1. `originDinUrl` — teste și protecție (prioritar)

Context: în producție, `NEXT_PUBLIC_SITE_URL` a avut o valoare stricată și redirecționarea ducea la `https://valuehttps/...`; înainte, `www.zmeurel.ro:443` dădea originea „null” și oprea build-ul.

Regula: o valoare se acceptă doar dacă, după `trim`, e un URL `http:`/`https:` valid al cărui host conține un punct (excepție: `localhost` și `127.0.0.1`, doar în afara producției). Orice altceva → originea implicită `https://caietulfermei.ro`. Rezultatul e mereu `protocol://host[:port]`, fără cale, fără `/` final. Nu aruncă niciodată.

- Teste unitare (incluse în `npm run test:critical:unit`), cel puțin: `https://caietulfermei.ro`, `https://caietulfermei.ro/`, `https://caietulfermei.ro/login?x=1`, `  https://caietulfermei.ro  `, `http://localhost:3000` (dev vs prod), `www.zmeurel.ro:443`, `caietulfermei.ro`, `value`, `valuehttps://caietulfermei.ro`, `https://value`, `https://valuehttps`, `ftp://caietulfermei.ro`, `javascript:alert(1)`, `""`, `undefined`, `null`, `https://`, `https://user:pass@caietulfermei.ro`.
- Middleware-ul de redirecționare folosește doar originea validată; test că nu poate redirecționa niciodată spre un host fără punct și că păstrează calea și query-ul (`/a/test123?x=1`).
- `scripts/check-env.js`: avertizare clară (nu eșec) când `NEXT_PUBLIC_SITE_URL` sau `SITE_URL` nu trec regula, cu valoarea care va fi folosită în loc. Nu afișa alte variabile.
- Caută și alte locuri care construiesc URL-uri absolute din env (`new URL(process.env...)`, OAuth `redirectTo`, linkuri din e-mailuri, raportul public `/a/[token]`, QR, invitațiile din echipă) și treci-le prin aceeași funcție.

## 2. Orice „Zmeurel” rămas

Caută în tot codul (`src/`, `public/` fără `sw.js`, `supabase/functions/`, șabloane de e-mail, `scripts/`, exporturi PDF/CSV/XLSX, notificări push, texte WhatsApp/SMS, metadate, OG, `manifest`) după `zmeurel` (insensibil la majuscule).

- Textele vizibile pentru utilizator (UI, e-mailuri, notificări, exporturi, PDF, afișe, raportul public) → `BRAND` din `src/lib/brand.ts`.
- **WhatsApp și orice mesaj trimis în numele fermei:** „Ferma Zmeurel” scris fix → numele fermei care trimite (din tenant). Dacă lipsește numele, text neutru fără nume de fermă.
- **Rămân intenționat**, nu le schimba: prima pagină „Andrei, Ferma Zmeurel” și `contact@zmeurel.ro` (până la `NEXT_PUBLIC_CONTACT_EMAIL`), `comanda.zmeurel.ro` și tot magazinul de acolo, `zmeurel.ro` în redirecționare, identificatori tehnici (numele pachetului, `@demo.zmeurel.local`, `@operator.zmeurel.local`, cookie-uri, chei de `localStorage`, nume de tabele/funcții, istoricul migrărilor).
- În raport: tabel cu fiecare apariție rămasă (fișier:linie, de ce rămâne).
- Test unitar sau script (`npm run check:brand`, și în CI dacă e simplu) care pică la un „Zmeurel” nou în texte vizibile, cu lista de excepții de mai sus.

## 3. Memento pentru banii neîncasați după 30 de zile (aprobat)

- Comenzile livrate cu rest neîncasat, livrate de peste 30 de zile (starea plății din `comenzi_stare_plata`).
- Doar proprietarul fermei. Intră în verificarea de dimineață (05:00 UTC), ca celelalte mementouri (analize, magazie, capcane, plan); respectă liniștea 22–6.
- Un singur mesaj pe zi, cumulat: „N comenzi neîncasate de peste 30 de zile · total X lei”, cu link spre lista filtrată în Comenzi. Idempotent: rularea de două ori în aceeași zi nu trimite de două ori. A doua oară abia după 7 zile, dacă tot există.
- Pe Acasă (doar proprietar): același rând, dacă există.
- Teste unitare pentru selecție (30 de zile exact, plată parțială, comandă anulată, comandă nelivrată, altă fermă).

## 4. Pierderile din stoc cu motiv

- În Stocuri, acțiunea „Pierdere” pe cultură: cantitate (kg), motiv obligatoriu: **stricat**, **consum propriu**, **donat**, **altul** (cu text), data, notă opțională.
- Scade stocul disponibil pe cultura respectivă (folosește `ajustari_stoc` cu `cultura` și `create_ajustare_stoc(..., p_cultura)` din 31; motivul doar prin migrare aditivă: coloană nouă cu `check`, valoare implicită pentru rândurile existente, fără `update` pe date).
- Nu e venit și nu e cheltuială. Apare în istoricul stocului cu motivul și în sumar („pierderi în sezon: X kg, din care stricat Y”).
- Drepturi: aceleași ca ajustările de stoc existente (verifică politicile și funcția; notează în raport cine poate).
- Nu se trece sub zero fără confirmare.

## 5. Vremea pe Acasă (extinde cardul existent)

- Pe Acasă există deja cardul „Meteo azi” (temperatură, vânt, umiditate, „Stropire: ...”). **Nu face un card nou**: găsește-l, vezi de unde ia datele și coordonatele, și extinde-l.
- Adaugă următoarele 3 zile (min/max, ploaie mm, vânt), compact, sub ziua de azi; avertizare de îngheț (min ≤ 0 °C) și de ploaie mare.
- Coordonatele vin din locul fermei. Dacă ferma nu are loc setat: rând „Pune locul fermei ca să vezi vremea ta” → setări (nu o locație implicită tăcută). Fără geolocalizare automată.
- Dacă serviciul nu răspunde, cardul dispare liniștit. Cache pe server 1–3 h. Fără notificări noi. Ore în `Europe/Bucharest`.

## 6. Reparațiile rămase din 31

- Fila „Mix fructe” din demo: în Stocuri apar doar filele culturilor din parcele. Găsește de unde vine „Mix fructe” (seed-ul demo sau date de stoc fără parcelă) și repară pentru demo-urile noi; nu modifica demo-urile existente.
- Rescrie cele două e2e vechi (`onboarding-flows`, `demo-to-real-conversion`) pe noul `/start` (demo primul, așteptarea, `/start/ferma`, „Primii pași”).

## 7. Audit final și smoke extins

- Smoke e2e extins (local) pentru: prima pagină, `/start` + demo, Login, `/start/ferma` → „Primii pași”, Acasă (vremea, pauzele, memento), Recoltări, Comenzi (inclusiv „La poartă”), Stocuri (filă pe cultură + Pierdere), Tratamente (Aplicări, Plan, Capcane, Analize, Magazia), raportul public `/a/[token]` (fără cookie-uri, `noindex`), Mai mult, Setări.
- Audit de securitate pe toate funcțiile `SECURITY DEFINER` adăugate în 26–33: cine le poate apela (`has_function_privilege` pentru `anon`, `authenticated`), verificare internă a fermei. Tabel în raport.
- Verifică pe un operator demo (ascuns, `@operator.zmeurel.local`) că nu vede bani, prețuri din magazie, acte.
- Toate verificările trebuie să treacă: `lint`, `typecheck`, `check:kit`, `test:critical:unit`, `build`.

## 8. Raportul

`docs/redesign/raport-33-noapte.md`, cu: ce ai schimbat pe secțiuni; migrările cu SQL complet și ordinea de aplicare; fiecare „Zmeurel” rămas; ce n-ai putut testa; rezultatul verificărilor; hash-urile commit-urilor. La final: push și te oprești. Fără merge.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
