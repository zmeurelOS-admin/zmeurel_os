# Prompt 32 — Redenumirea: Zmeurel OS devine Caietul Fermei

Lucrezi singur, fără plan și fără să ceri aprobare. Ce te blochează sari și notezi în raport.

**Branch:** `redesign/caietul-fermei-32`, din `origin/main` **după ce promptul 31 e în main** (31 refăcuse prima pagină, `/start` și Login și a pus numele în `src/lib/brand.ts`). Dacă 31 nu e încă în main, te oprești și spui asta. Commit-uri mici, push după fiecare bucată. Fără merge. `git add` pe fișiere anume, nu `git commit -a`: `public/sw.js` nu se comite.

**Context:** `CLAUDE.md`, `docs/redesign/tokens.md`. Logo-ul e gata, în toate formatele: `docs/redesign/brand/caietul-fermei-logo/` de pe `redesign/prompturi-11-12` (citește `CITESTE.md` și `manifest-exemplu.json`). Nu desenezi alt logo.

**NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.** Mediul local și preview-urile folosesc baza de PRODUCȚIE: scrii doar în conturi demo create de tine. Nu creezi utilizatori reali. Nu apelezi rute de cron. Nu schimbi variabile din Vercel și nici setări din Supabase sau Google: le scrii în raport, pentru Andrei.

---

## 0. Ce se schimbă și ce nu

- **Platforma** se numește **Caietul Fermei**, la adresa **https://caietulfermei.ro**. Numele scurt, pentru aplicația instalată: **Caietul**. Sloganul: „Ferma ta, pe telefon. Fără hârtii.”
- **Rămân „Zmeurel”**, pentru că sunt ferma și afacerea lui Andrei, nu platforma:
  - magazinul de pe `comanda.zmeurel.ro` (`src/app/comanda/`, manifestul și iconițele lui cu zmeura, `src/lib/shop/pricing.ts`, campania);
  - numele fermei „Ferma Zmeurel” din povestea de pe prima pagină și datele fermei lui.
- **Nu redenumești nimic intern:** repo-ul, proiectul Vercel, baza de date, tabelele, cheile din `localStorage` (`zmeurel_*`), antetele `x-zmeurel-*`, numele de cookie-uri, ID-urile de evenimente din analytics. Schimbarea e doar în ce vede omul.

## 1. Numele și adresa, într-un singur loc

`src/lib/brand.ts` (făcut în 31) devine sursa unică:
- `APP_NAME = 'Caietul Fermei'`, `APP_SHORT_NAME = 'Caietul'`, `APP_TAGLINE`;
- `APP_URL` din `process.env.NEXT_PUBLIC_SITE_URL`, cu implicit `https://caietulfermei.ro`;
- `CONTACT_EMAIL` din `process.env.NEXT_PUBLIC_CONTACT_EMAIL`, cu implicit **`contact@zmeurel.ro`** (adresa nouă de e-mail nu există încă; Andrei schimbă variabila când o face).

Înlocuiește cu ele toate adresele scrise de mână ale platformei. Cel puțin:
- `src/app/layout.tsx`, `src/app/head.tsx`, `src/app/page.tsx` (`metadataBase`, `openGraph.url`, `canonical`);
- `src/lib/analize/raport-server.ts` (azi `https://app.zmeurel.ro`: linkul din QR-ul raportului de analiză);
- `src/lib/farm-members/owner-auth.ts` (linkurile de livrator și de invitație);
- `src/app/api/integrations/google/sync-now/route.ts`;
- `src/lib/shop/association/tech-platform.ts`, `brand-config.ts`, `order-summary-print.ts`, `MarketSuccessOverlay.tsx`, `src/app/magazin/asociatie/termeni/page.tsx` (atribuirea „Platformă tehnică: …”);
- e-mailul de contact din `ajutor`, `termeni`, `confidentialitate`, `landing-footer.tsx`.

Caută și restul: `git grep -n "zmeurel\.ro\|Zmeurel OS\|Zmeurel"` în `src`. Pentru fiecare apariție decizi: platformă (se schimbă) sau ferma și magazinul lui Andrei (rămâne). Lista cu decizia pentru fiecare fișier intră în raport.

## 2. Textele

- Tot ce vede omul și numește platforma: titlurile paginilor, prima pagină, `/start`, Login, paginile de parolă, meniul, Setări, „Planul tău”, ajutorul, termenii, confidențialitatea, notificările push (titlul), e-mailurile trimise de aplicație, textele de instalare a aplicației, exporturile (antetul PDF/Excel), raportul public al analizei.
- **Povestea de pe prima pagină:** „Am făcut Caietul Fermei pentru ferma mea din Văratec, apoi pentru alții ca mine.” Ferma rămâne „Ferma Zmeurel”.
- **În termeni și confidențialitate** se schimbă numele platformei și adresa. Datele firmei care o operează rămân cele de acum.

## 3. Logo-ul și aplicația instalabilă

Din `docs/redesign/brand/caietul-fermei-logo/`:
- **`public/icons/`:** `icon.svg`, `icon-72` … `icon-512.png`, `icon-maskable-192/512.png`, `badge-monocrom-96.png`, `apple-touch-icon-180.png`. Pune și `favicon.ico` unde e azi. Fișierele vechi cu zmeura **le păstrezi dacă magazinul (`/comanda`) le folosește**: verifică întâi `src/app/comanda/manifest.ts` și `layout.tsx`, iar dacă împart aceleași fișiere, mută-le pe ale magazinului în `public/shop/icons/`.
- **`src/app/manifest.ts`** (manifestul platformei, nu cel din `comanda`):
  - `name`, `short_name`;
  - `description`;
  - `theme_color: '#3d7a5f'`, `background_color: '#fbf8ef'`;
  - iconițele ca în `manifest-exemplu.json`, cu `maskable` și `monochrome`.
- **Notificările push:** iconița mare e `icon-192.png`, iar insigna e `badge-monocrom-96.png`. Sursa e `public/push-handlers.js`, nu `public/sw.js`.
- **Imaginea pentru distribuirea linkului:** `og-image-1200x630.png` ca `public/og-image.jpg` (sau actualizează referința), pentru platformă. Magazinul își păstrează imaginea lui.
- **Logo-ul cu nume** (`logo-cu-nume/*.svg`) pe prima pagină, pe Login și în bara laterală de pe desktop. Varianta deschisă sau închisă se alege după temă, cu tokenii canonici: fără hex nou în componente.
- **Iconița din bara de sus și din AI chat** (`/public/icons/icon.svg` via `next/image`) devine automat cea nouă; verifică.

## 4. Adresele vechi trebuie să meargă în continuare

Linkuri cu `zmeurel.ro` există deja în afara aplicației: QR-uri tipărite pe rapoarte și afișe (`/a/<token>`), invitațiile operatorilor trimise pe WhatsApp, linkurile de livrator, aplicații instalate.

În `src/proxy.ts` (nu adăuga `middleware.ts`), **doar dacă `process.env.REDIRECT_OLD_DOMAIN === '1'`**:
- **Hosturile vechi ale platformei:** `zmeurel.ro`, `www.zmeurel.ro`, `app.zmeurel.ro`. Orice cale, cu tot cu query, primește `308` spre `APP_URL` + aceeași cale. Excepție: `/` de pe `zmeurel.ro` și `www.zmeurel.ro` merge spre `https://comanda.zmeurel.ro`, pentru că zmeurel.ro rămâne pagina afacerii lui Andrei.
- **Nu se redirecționează:**
  - `comanda.zmeurel.ro` și tot ce servește magazinul;
  - `*.vercel.app` (preview-uri);
  - `localhost`;
  - `caietulfermei.ro` și `www.caietulfermei.ro`;
  - rutele de cron.
- **`www.caietulfermei.ro`** primește `308` spre `caietulfermei.ro`.
- **Redirecționarea e doar un pas în proxy**, la început, înainte de sesiune: nu citește cookie-uri și nu atinge baza.
- **Teste unitare pentru funcția pură de redirect:** fiecare host, căi cu query, `/a/<token>`, invitația, magazinul, preview-ul, flag-ul oprit.

Fără flag, comportamentul rămâne exact ca azi. Așa, merge-ul nu mută nimic până nu e gata domeniul.

## 5. Ce face Andrei (doar le scrii în raport, pas cu pas)

Pune lista asta la începutul raportului, în ordine:
1. **Vercel → proiect → Settings → Domains:**
   - adaugă `caietulfermei.ro` și `www.caietulfermei.ro`;
   - la registrar, setează înregistrările DNS arătate de Vercel;
   - așteaptă „Valid”;
   - `zmeurel.ro`, `www.zmeurel.ro` și `app.zmeurel.ro` **rămân** pe același proiect, altfel nu mai merg redirecționările.
2. **Supabase → Authentication → URL Configuration:** adaugă la Redirect URLs `https://caietulfermei.ro/**` și `https://www.caietulfermei.ro/**`. **Site URL îl schimbi abia la pasul 5.**
3. **Google Cloud → OAuth consent screen:**
   - numele aplicației devine „Caietul Fermei”;
   - logo-ul e `icon-512.png`;
   - la domenii autorizate adaugi `caietulfermei.ro`.
   Adresa de întoarcere rămâne cea de la Supabase și nu se schimbă.
4. **Vercel → Environment Variables (Production):**
   - `NEXT_PUBLIC_SITE_URL=https://caietulfermei.ro`;
   - verifică dacă `SITE_URL` există și pune aceeași valoare;
   - `NEXT_PUBLIC_CONTACT_EMAIL` doar când există adresa nouă;
   - **apoi** `REDIRECT_OLD_DOMAIN=1` și un redeploy.
5. **Supabase:** Site URL devine `https://caietulfermei.ro`. Șabloanele de e-mail (confirmare, resetare parolă, magic link) primesc numele nou.
6. **Pe telefon:** te loghezi din nou pe caietulfermei.ro și reinstalezi aplicația; cea veche, de pe zmeurel.ro, o ștergi. Notificările se reactivează din Setări, pentru că sunt legate de adresă.

## 6. Verificare

- `npm run lint`, `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit`, `npm run build`.
- **Teste și e2e:** actualizează testele care caută textul „Zmeurel” pentru platformă; cele ale magazinului rămân.
- **Cu Playwright, local, la 390 px și pe desktop, zi și noapte:**
  - prima pagină, `/start`, Login, Acasă demo, Mai mult, Setări, raportul public al unei analize demo;
  - iconița din tab;
  - `/manifest.webmanifest` (numele, iconițele);
  - `/comanda` cu zmeura neatinsă.
- **Redirecționarea:** cu `REDIRECT_OLD_DOMAIN=1` local și antetul `Host` simulat (`curl -H "Host: zmeurel.ro" localhost:3000/a/abc?x=1` → `308` spre `https://caietulfermei.ro/a/abc?x=1`); fără flag → nicio redirecționare.
- `git grep -n "Zmeurel"` la final: în raport, lista ce a rămas și de ce (magazin, fermă, intern).

## 7. Raportul

`docs/redesign/raport-32.md`:
- pașii lui Andrei (§5) la început;
- ce ai schimbat, pe secțiuni;
- tabelul cu fiecare apariție „Zmeurel” / „zmeurel.ro”: schimbat sau rămas, cu motivul;
- testele redirecționării;
- capturi: prima pagină, Login, Acasă, iconița pe ecranul telefonului (manifestul în Chrome DevTools → Application);
- ce n-ai putut testa (domeniul real, Google, e-mailurile);
- `git diff origin/main --stat` și confirmarea că `public/sw.js` nu e în diff.

Actualizează `CLAUDE.md`, pe scurt: numele, `src/lib/brand.ts`, redirecționarea cu flag, ce rămâne „Zmeurel” (magazinul, ferma, numele interne).
