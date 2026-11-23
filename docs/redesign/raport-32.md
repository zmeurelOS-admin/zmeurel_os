# Raport — promptul 32: Zmeurel OS devine Caietul Fermei

Branch: `redesign/caietul-fermei-32`, pornit din `origin/main` la `e963c16` (promptul 31 era deja în main). Fără merge.
`public/sw.js` nu e în niciun commit. Folderul `docs/redesign/brand/` nu e comis (din el am copiat în `public/`).
Fără migrări: redenumirea e doar în ce vede omul; nicio tabelă, coloană sau funcție SQL nu se schimbă.

## Pașii tăi (Andrei), în ordine

Fără ei, după merge nu se mută nimic: redirecționarea e oprită (`REDIRECT_OLD_DOMAIN` lipsă), iar linkurile din invitații
iau adresa din `SITE_URL` (azi `https://zmeurel.ro`), deci merg ca înainte.

1. **Vercel → proiectul → Settings → Domains**
   - adaugă `caietulfermei.ro` și `www.caietulfermei.ro`;
   - la registrar, pune înregistrările DNS arătate de Vercel (de obicei `A 76.76.21.21` pe `@` și `CNAME cname.vercel-dns.com` pe `www`; ia-le pe cele din ecran);
   - așteaptă „Valid” la amândouă;
   - `zmeurel.ro`, `www.zmeurel.ro` și `app.zmeurel.ro` **rămân** pe același proiect (altfel redirecționarea nu mai primește cererile). `comanda.zmeurel.ro` rămâne și el, neatins.
   - Dacă Vercel îți propune „Redirect www.caietulfermei.ro to caietulfermei.ro”, poți accepta: aplicația face oricum același lucru.
2. **Supabase → Authentication → URL Configuration → Redirect URLs**: adaugă `https://caietulfermei.ro/**` și `https://www.caietulfermei.ro/**`. **Site URL nu-l schimbi încă** (pasul 5). Cele vechi (`https://zmeurel.ro/**` etc.) le lași.
3. **Google Cloud Console → APIs & Services → OAuth consent screen** (proiectul folosit de Supabase pentru „Intră cu Google”):
   - numele aplicației: „Caietul Fermei”;
   - logo-ul: `public/icons/icon-512.png` din repo (512 × 512);
   - Authorized domains: adaugă `caietulfermei.ro` (și pagina principală / politica de confidențialitate: `https://caietulfermei.ro`, `https://caietulfermei.ro/confidentialitate`, `https://caietulfermei.ro/termeni`, dacă ți le cere).
   - Adresa de întoarcere (Authorized redirect URI, cea de la Supabase `https://<proiect>.supabase.co/auth/v1/callback`) **rămâne** neschimbată.
   - Schimbarea numelui / logo-ului poate cere reverificarea aplicației de către Google; până atunci ecranul de consimțământ poate arăta numele vechi.
4. **Vercel → Settings → Environment Variables (Production)**:
   - `NEXT_PUBLIC_SITE_URL=https://caietulfermei.ro`;
   - `SITE_URL` există (îl cere `scripts/check-env.js` la build): pune tot `https://caietulfermei.ro`. Dacă `NEXT_PUBLIC_APP_URL` există, la fel (are prioritate la linkul din QR-ul raportului și la sincronizarea Google);
   - `NEXT_PUBLIC_CONTACT_EMAIL` doar când există adresa nouă de e-mail (până atunci rămâne `contact@zmeurel.ro`);
   - **apoi** `REDIRECT_OLD_DOMAIN=1`;
   - **Redeploy** (variabilele `NEXT_PUBLIC_*` intră în cod doar la build).
5. **Supabase**:
   - **Authentication → URL Configuration → Site URL**: `https://caietulfermei.ro`;
   - **Authentication → Email Templates** (Confirm signup, Reset password, Magic link, Invite, Change email): înlocuiește „Zmeurel” / „Zmeurel OS” cu „Caietul Fermei” în subiect și în text. (Aplicația nu ține aceste șabloane în cod.)
   - Dacă trimiți e-mailurile prin SMTP propriu (Resend etc.), schimbă și „Sender name” în „Caietul Fermei”.
6. **Pe telefon**: intră din nou pe `https://caietulfermei.ro` și loghează-te; instalează aplicația de acolo (apare ca „Caietul”); aplicația veche, de pe zmeurel.ro, o ștergi. Notificările se reactivează din Setări › Notificări: abonamentul push e legat de adresă, deci cel vechi nu mai primește nimic după redirecționare.

Note:
- Cât timp `REDIRECT_OLD_DOMAIN` nu e `1`, nimic nu se redirecționează, chiar dacă domeniul nou e gata.
- Dacă pornești `REDIRECT_OLD_DOMAIN=1` înainte de a schimba `NEXT_PUBLIC_SITE_URL`, adresa platformei rămâne `https://caietulfermei.ro` (valoarea implicită din cod) — deci domeniul nou **trebuie** să fie „Valid” înainte de flag. Dacă `NEXT_PUBLIC_SITE_URL` e încă `https://zmeurel.ro`, funcția nu face buclă (`zmeurel.ro → zmeurel.ro` e oprit), doar `www` / `app` merg pe `zmeurel.ro`.
- Un login început pe zmeurel.ro înainte de redirecționare și terminat după ea (Google, PKCE) poate cere încă o dată „Intră”: cookie-ul de verificare e pe domeniul vechi. Se întâmplă o singură dată, în minutul trecerii.
- `SHOP_ORDER_NOTIFY_FROM` (Vercel): dacă numele expeditorului e „Zmeurel …”, pune „Caietul Fermei <adresa>” când ai adresa nouă (e-mailul către fermier la o comandă din magazin are acum subiectul „Comandă nouă din magazin · Caietul Fermei”).

## 1. Ce am schimbat

### 1. Numele și adresa, într-un singur loc (`src/lib/brand.ts`)
- `APP_NAME = 'Caietul Fermei'`, `APP_SHORT_NAME = 'Caietul'`, `APP_TAGLINE = 'Ferma ta, pe telefon. Fără hârtii.'`, plus `APP_NAME_GENITIV = 'Caietului Fermei'` (pentru „Asistentul Caietului Fermei”, „administratorul Caietului Fermei”; „Asistentul Caietul Fermei” ar fi fost greșit).
- `APP_URL` = originea din `NEXT_PUBLIC_SITE_URL`, implicit `https://caietulfermei.ro`; `APP_HOST`; `CONTACT_EMAIL` din `NEXT_PUBLIC_CONTACT_EMAIL`, implicit `contact@zmeurel.ro`; `originDinUrl()` (normalizează o adresă la origine).
- Adresele scrise de mână înlocuite:
  - `src/app/layout.tsx`, `src/app/head.tsx`, `src/app/page.tsx`: `metadataBase`, `openGraph.url`, `canonical`, JSON-LD → `APP_URL`;
  - `src/lib/analize/raport-server.ts` (linkul din QR-ul raportului): `NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_SITE_URL` → hostul cererii → `APP_URL` (în loc de `https://app.zmeurel.ro`);
  - `src/lib/farm-members/owner-auth.ts`: linkul de livrator (era `https://zmeurel.ro/livrator/…` fix) și invitația operatorului iau aceeași origine: `SITE_URL` → `NEXT_PUBLIC_SITE_URL` → `APP_URL`;
  - `src/app/api/integrations/google/sync-now/route.ts`: `APP_URL` în loc de `https://www.zmeurel.ro`;
  - magazinul asociației: `tech-platform.ts`, `brand-config.ts`, `order-summary-print.ts`, `MarketSuccessOverlay.tsx` (PDF-ul comenzii), `magazin/asociatie/termeni`, `confidentialitate`, `layout.tsx`, `producatori/[tenantId]` (aici implicitul era `https://zmeurel.app`, un domeniu greșit), `page.tsx`, `produse/page.tsx`;
  - e-mailul de contact din `ajutor`, `termeni`, `confidentialitate`, `components/landing/contact.tsx` → `CONTACT_EMAIL`. (Subsolul primei pagini, `landing-footer.tsx`, nu avea e-mail; are deja `© … {APP_NAME}`.)

### 2. Textele
- Titlurile paginilor (`Clienți | …`, `Ajutor | …`, `Termeni și condiții | …`, `Politica de confidențialitate | …`), prima pagină (antetul, „Ce ții în Caietul Fermei”, subsolul), `/start` și Login (prin `AuthFrame`), „Planul tău în Caietul Fermei”, „Primii pași” („Așa pornești Caietul pe ferma ta”), Mai mult („Admin (Caietul Fermei)”), ajutorul, termenii, confidențialitatea (numele și e-mailul; datele firmei neatinse — paginile nu aveau alte date), raportul public („Raport făcut în Caietul Fermei…”), invitația și „Acces oprit” (`alt`), pagina offline, livratorul („Înapoi la Caietul Fermei”, „Livrări · Caietul”), mesajele WhatsApp ale invitațiilor (operator și livrator, „— Echipa Caietul Fermei”), asistentul AI („Asistentul Caietului Fermei” și prompturile modelului), „Din mesaj” (promptul), mesajele de eroare ale asociației, ferestrele de tipărire blocate (raport, analiză), linkul WhatsApp de ajutor (`SUPPORT_WHATSAPP_URL`, acum construit cu `encodeURIComponent`), `/magazin` (pagina generică a fermelor), e-mailul către fermier la o comandă din magazin (subiect și text).
- Notificările push: titlul implicit (când lipsește) e „Caietul Fermei” (`public/push-handlers.js`); titlurile notificărilor sunt ale fiecărui eveniment și nu conțineau numele.
- Exportul: fișierele CSV din Setări › Cont se numesc `caietul-fermei-<modul>-<zi>.csv`. Rapoartele PDF / tipărite nu aveau numele platformei în antet (am căutat).
- **Povestea:** „Am ~1.900 de plante de zmeură. Țineam totul pe hârtie și în WhatsApp… Am făcut Caietul Fermei pentru ferma mea din Văratec, apoi pentru alții ca mine.” Semnătura: „— Andrei, Ferma Zmeurel, autorul aplicației”.
- Testele: `e2e/admin-access.spec.ts` („Admin (Caietul Fermei)”), `producers-route.test.ts`, `members-route.test.ts`. Testele magazinului au rămas.

### 3. Logo-ul și aplicația instalabilă
- `public/icons/`: `icon.svg`, `icon-72/96/128/144/152/192/384/512.png`, `icon-maskable-192/512.png`, `badge-monocrom-96.png`, `apple-touch-icon-180.png`, `favicon.png` (32 px). `public/favicon.ico` (16/32/48; nu exista înainte: favicon-ul venea din `src/app/icon.tsx`).
- **Magazinul folosea același `/icons/icon.svg` (zmeura) în `ShopClient.tsx`** (sigla din antet și din subsol): l-am mutat cu `git mv` în `public/shop/icons/icon.svg` și am schimbat cele două căi. Manifestul și iconițele magazinului (`/shop-icon-*.png`) nu se schimbă.
- Fișierele vechi din rădăcina `public/` (`icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-icon.png`, `badge-96.png`) erau ale platformei: le-am suprascris cu cele noi, ca aplicațiile instalate și notificările vechi care încă le cer să arate logo-ul nou.
- Șterse: `src/app/icon.tsx`, `src/app/apple-icon.tsx`, `src/app/icon-192.png/route.tsx`, `src/app/icon-512.png/route.tsx` — desenau un „Z” verde și treceau peste iconițele din `metadata` (inclusiv pe `/comanda`). Acum fiecare layout își pune iconițele: platforma în `src/app/layout.tsx`, magazinul în `src/app/comanda/layout.tsx`.
- `src/app/layout.tsx`: `icons` (favicon.ico, svg, 192, 512, apple 180), `appleWebApp.title = 'Caietul'`, `themeColor: '#3d7a5f'`; am scos `<meta theme-color>`, `apple-mobile-web-app-title` și `<link apple-touch-icon>` scrise de mână în `<head>`: apăreau și pe `/comanda`, peste ale magazinului.
- `src/app/manifest.ts` (ramura platformei): `name` „Caietul Fermei”, `short_name` „Caietul”, `description` = sloganul, `theme_color #3d7a5f`, `background_color #fbf8ef`, iconițele ca în `manifest-exemplu.json` (svg, 8 PNG, 2 maskable, 1 monochrome). Ramura magazinului (host `comanda.zmeurel.ro`) neatinsă.
- Push: iconița `/icons/icon-192.png`, insigna `/icons/badge-monocrom-96.png` (în `public/push-handlers.js`; `sw.js` se reface la build și nu e comis).
- Imaginea de distribuire: `public/og-image.png` (1200 × 630) pe prima pagină. `og-image.jpg` vechi a rămas în `public/` (nefolosit; nu l-am șters).
- **Logo-ul cu nume**: `src/components/brand/LogoCuNume.tsx` — semnul (`/icons/icon.svg`) + textul „Caietul Fermei” din `logo-cu-nume/*.svg`, ca contururi (`logo-contururi.ts`, rotunjite la o zecimală, ~14 KB), cu `fill="currentColor"` și `text-fg` / `text-fg-muted`. Așa varianta pentru fundal deschis sau închis o alege tema, fără hex în componentă. Folosit pe prima pagină (antet), pe `/start` / Login / paginile de parolă (`AuthFrame`) și în bara laterală de pe desktop (restrânsă: doar semnul). SVG-urile originale sunt și în `public/brand/`.
- Iconița din antet / chat / invitație / offline (`/icons/icon.svg` prin `next/image`) e automat cea nouă.

### 4. Adresele vechi
- `src/lib/redirect-domeniu.ts`: `destinatieRedirect()` (funcție pură) și `flagRedirectActiv()`; chemată **primul pas** în `proxy()`, înainte de orice antet, sesiune sau bază; `NextResponse.redirect(url, 308)`.
- Reguli: `zmeurel.ro`, `www.zmeurel.ro`, `app.zmeurel.ro` → `APP_URL` + aceeași cale și query; `/` de pe `zmeurel.ro` / `www.zmeurel.ro` → `https://comanda.zmeurel.ro/` (cu query); `www.<host platformă>` → `<host platformă>`. Nu ating: `comanda.zmeurel.ro`, `*.vercel.app`, `localhost`, `caietulfermei.ro`, `/api/cron/*`. Protecție contra buclei: o destinație pe același host nu se întoarce niciodată.
- Fișierele statice (iconițe, `manifest.webmanifest`, `sw.js`, imagini) nu trec prin proxy (matcherul le exclude), deci rămân servite și pe zmeurel.ro — aplicațiile instalate vechi își găsesc iconițele și service workerul.

## 2. Fiecare „Zmeurel” / „zmeurel.ro” din `src`

Am trecut prin toate aparițiile (`git grep -n -i zmeurel -- src`). Schimbate (platforma):

| Fișier | Ce era | Acum |
|---|---|---|
| `app/layout.tsx`, `head.tsx`, `page.tsx` | `www.zmeurel.ro`, „Zmeurel”, „Zmeurel OS” | `APP_URL`, `APP_NAME`, `APP_SHORT_NAME` |
| `app/manifest.ts` (platforma) | „Zmeurel OS” | „Caietul Fermei” / „Caietul” |
| `app/(dashboard)/clienti/page.tsx` | titlul | `APP_NAME` |
| `app/(dashboard)/mai-mult/MaiMultPageClient.tsx` | „Admin (Zmeurel)” | „Admin (Caietul Fermei)” |
| `app/a/[token]/page.tsx` | „Raport făcut în Zmeurel” | `APP_NAME` |
| `app/acces-oprit`, `app/invite/[token]`, `app/offline` | `alt` | `APP_NAME` |
| `app/ajutor`, `termeni`, `confidentialitate` | titlu, „ZO” + „Zmeurel OS”, `contact@zmeurel.ro` | `APP_NAME`, semnul nou, `CONTACT_EMAIL` |
| `app/livrator/[token]`, `livrator/livrari/LivratorLivrariClient.tsx` | „Înapoi la Zmeurel”, „Zmeurel livrări” | `APP_NAME`, „Livrări · Caietul” |
| `app/api/association/members`, `producers` | „Zmeurel OS”, „Zmeurel.ro” | `APP_NAME`, `APP_NAME_GENITIV` |
| `app/api/chat/chat-post-handler.ts`, `api/parse-order/parse-order-handler.ts` | prompturile modelului | `APP_NAME` / `APP_NAME_GENITIV` |
| `app/api/integrations/google/sync-now/route.ts` | `www.zmeurel.ro` | `APP_URL` |
| `app/magazin/page.tsx` (pagina generică a fermelor) | „Zmeurel”, „Autentificare Zmeurel” | `APP_NAME` |
| `app/magazin/asociatie/*` (layout, page, produse, producatori, termeni, confidentialitate) | „Zmeurel OS”, `zmeurel.ro`, `zmeurel.app` | `APP_NAME`, `APP_HOST`, `APP_URL` |
| `components/ai/AiBottomSheet.tsx` | „Asistentul Zmeurel” | „Asistentul Caietului Fermei” |
| `components/analize/RaportSheet.tsx`, `rapoarte/ExportRaportSheet.tsx` | „…pentru Zmeurel” | `APP_NAME` |
| `components/association/membri`, `producatori` | „Zmeurel OS”, „Zmeurel.ro” | `APP_NAME`, `APP_NAME_GENITIV` |
| `components/landing/contact.tsx`, `ce-tii.tsx`, `landing-header.tsx`, `story.tsx` | e-mail, „Ce ții în Zmeurel”, sigla, povestea | `CONTACT_EMAIL`, `APP_NAME`, `LogoCuNume`, textul din prompt |
| `components/layout/Sidebar.tsx` | „Zmeurel / OS” | `LogoCuNume` |
| `components/shop/association/marketplace/MarketSuccessOverlay.tsx` | „Platformă tehnică: Zmeurel OS (zmeurel.ro)” | `APP_NAME (APP_HOST)` |
| `lib/analize/raport-server.ts` | `app.zmeurel.ro` | `APP_URL` |
| `lib/farm-members/owner-auth.ts` | `zmeurel.ro` (livrator, invitație) | `SITE_URL` → `NEXT_PUBLIC_SITE_URL` → `APP_URL` |
| `lib/echipa/drepturi.ts` | mesajele WhatsApp | `APP_NAME` |
| `lib/shop/association/tech-platform.ts`, `brand-config.ts`, `order-summary-print.ts` | „Zmeurel OS”, `zmeurel.ro`, `contact@zmeurel.ro` | `APP_NAME`, `APP_HOST` / `APP_URL`, `CONTACT_EMAIL` |
| `lib/shop/notify-farmer-shop-order.ts` | „platforma Zmeurel OS”, „· Zmeurel” | `APP_NAME` |
| `lib/support.ts` | „…sugestie pentru Zmeurel OS” | `APP_NAME` |
| `lib/setari/export-data.ts` | `zmeurel-<modul>.csv` | `caietul-fermei-<modul>.csv` |
| `docs/gdpr-data-mapping.md` | „Zmeurel OS (zmeurel.ro)” | „Caietul Fermei (caietulfermei.ro; fostul Zmeurel OS)” |
| `public/push-handlers.js` | titlul implicit „Zmeurel OS” | „Caietul Fermei” |

Rămase (`git grep -n "Zmeurel" -- src`, fără teste: 35 de rânduri), cu motivul:

| Fișier | De ce rămâne |
|---|---|
| `app/comanda/ShopClient.tsx` (9), `layout.tsx` (6), `manifest.ts` (2), `opengraph-image.tsx` (2) | magazinul lui Andrei, `comanda.zmeurel.ro` |
| `app/manifest.ts` (2) | ramura magazinului (host `comanda.zmeurel.ro`) |
| `lib/shop/campaign-mock.ts` (5), `lib/shop/b2c-order-helpers.ts` (1), `lib/shop/pricing.ts` (comentariu) | magazinul și campania lui |
| `components/pwa/PWAInstallPrompt.tsx` (1) | `iconAlt` implicit al promptului de instalare, folosit doar de magazin (iconița implicită e `shop-icon-192.png`) |
| `lib/comenzi/whatsapp-messages.ts` (2) | „Ferma Zmeurel” în mesajele către clienți — numele fermei, cum cere promptul. **De văzut**: e scris fix, deci și alte ferme trimit „Mulțumim că ați ales Ferma Zmeurel!”; ar trebui numele fermei din `tenants` (n-am schimbat, e în afara redenumirii) |
| `components/landing/story.tsx` (1) | „Ferma Zmeurel” în semnătura poveștii |
| `lib/supabase/queries/produse.ts` (1) | potrivește textul unei erori aruncate de funcția SQL din migrarea `20260406003` („…în Zmeurel OS”); omul vede alt mesaj. Intern |
| `lib/brand.ts` (2) | comentariul despre ce rămâne și `contact@zmeurel.ro` implicit |
| `docs/gdpr-data-mapping.md` (1) | „fostul Zmeurel OS” |

Plus cele interne, nerenumite intenționat: `x-zmeurel-*` (proxy, layout, `proxy-headers.ts`), cheile `zmeurel_*` și `zmeurel:*` din `localStorage` / `sessionStorage`, `[zmeurel:…]` din notele parcelelor, `zmeurel-<tip>` (tag-ul notificărilor), `ZMEUREL_TECH_PLATFORM` (numele constantei), `@demo.zmeurel.local`, `@operator.zmeurel.local`, `noreply@zmeurel.local` (subiectul VAPID), `DEFAULT_SHOP_DOMAIN = 'comanda.zmeurel.ro'`, `HOSTURI_VECHI_PLATFORMA` din redirecționare. În teste rămân adresele `https://zmeurel.ro/...` folosite ca origine oarecare a cererilor și datele magazinului / fermei.

## 3. Testele redirecționării
- **Unitare** (`src/lib/__tests__/redirect-domeniu.test.ts`, 12 teste): flag oprit pe toate hosturile; cele trei hosturi vechi cu căi și query; `/a/<token>`; invitația și livratorul; `/` → magazin (și `app.zmeurel.ro/` → platformă); `www.caietulfermei.ro`; magazinul, preview-ul `*.vercel.app`, `localhost`, `127.0.0.1`, `caietulfermei.ro` neatinse; cronul neatins; port și majuscule; fără buclă când adresa platformei e încă zmeurel.ro; host lipsă / adresă invalidă; `flagRedirectActiv` doar pentru „1”.
- **Local, pe build** (`npx next start`, antetul `Host` simulat cu `curl -H "Host: …"`), cu `REDIRECT_OLD_DOMAIN=1`:

```
zmeurel.ro           /a/abc?x=1          → 308 https://caietulfermei.ro/a/abc?x=1
www.zmeurel.ro       /invite/AbC123?x=1  → 308 https://caietulfermei.ro/invite/AbC123?x=1
app.zmeurel.ro       /livrator/tok       → 308 https://caietulfermei.ro/livrator/tok
zmeurel.ro           /                   → 308 https://comanda.zmeurel.ro/
www.zmeurel.ro       /?utm=1             → 308 https://comanda.zmeurel.ro/?utm=1
app.zmeurel.ro       /                   → 308 https://caietulfermei.ro/
www.caietulfermei.ro /start?demo=1       → 308 https://caietulfermei.ro/start?demo=1
caietulfermei.ro     /                   → 200
comanda.zmeurel.ro   /                   → 200 (magazinul)
abc.vercel.app       /a/abc              → 404 (tokenul nu există; nicio redirecționare)
localhost:3001       /a/abc?x=1          → 404 (la fel)
zmeurel.ro           /api/cron/notificari-dimineata → 401 (nicio redirecționare; cererea fără secret e refuzată de rută, nu rulează nimic)
```

- Fără flag (același build): `zmeurel.ro /a/abc?x=1` → 404, `zmeurel.ro /` → 200, `www.caietulfermei.ro /start` → 200: nicio redirecționare.

## 4. Capturi (`docs/redesign/capturi-32/`)
Făcute cu Playwright pe build (`next start`), cu un demo nou „Fructe de pădure” creat din `/start` (ieșit din cont la final):
- prima pagină: `prima-tel-zi`, `prima-tel-noapte`, `prima-desk-zi`, `prima-desk-noapte`, `prima-poveste-tel-zi`;
- `/start`: `start-{tel,desk}-{zi,noapte}`; Login: `login-{tel,desk}-{zi,noapte}`;
- Acasă demo: `acasa-tel-{zi,noapte}`, `acasa-desk-{zi,noapte}` (bara laterală cu logo-ul); Mai mult: `mai-mult-tel-{zi,noapte}`; Setări: `setari-tel-{zi,noapte}`;
- raportul public al analizei demo: `raport-public-{tel,desk}-{zi,noapte}` (raportul e mereu pe fundal deschis, ca la tipar);
- magazinul neatins: `comanda-tel-zi`, `comanda-desk-zi` (zmeura, „Zmeurel”);
- iconițele: `iconite-manifest.webp` — **simulare** compusă din fișierele servite de manifest (iconița, cea „maskable” tăiată rotund ca pe Android, insigna push, favicon-ul), nu o captură de pe telefon.
- Verificat cu `curl`: `/manifest.webmanifest` (numele, culorile, cele 12 iconițe), manifestul pe host `comanda.zmeurel.ro` (tot „Zmeurel”, iconițele `shop-*`), `<link rel="icon">` / `apple-touch-icon` / `theme-color` pe `/` (noi) și pe `/comanda` (ale magazinului, `#F16B6B`), toate fișierele noi servite cu 200.

## 5. Ce n-am putut testa
- Domeniul real (`caietulfermei.ro` nu e încă pe Vercel), DNS-ul, certificatul, redirecționarea în producție.
- „Intră cu Google” pe domeniul nou și ecranul de consimțământ Google (setările sunt la tine).
- E-mailurile: șabloanele Supabase (în dashboard, nu în cod) și e-mailul Resend către fermier (n-am trimis comenzi).
- Instalarea aplicației pe un telefon real și „Application → Manifest” din Chrome DevTools (n-am DevTools în mediul de test): am verificat manifestul cu `curl` și am făcut simularea iconițelor.
- Notificările push reale (iconița și insigna): verificate doar căile din `push-handlers.js`.
- Panoul de browser nu arată bara de taburi, deci iconița din tab am verificat-o doar prin `<link rel="icon">` și fișierele servite.
- `/comanda` pe `localhost` are încă `<link rel="manifest" href="/manifest.webmanifest">` (al platformei): `src/app/manifest.ts` e fișier de convenție și trece peste `manifest` din `comanda/layout.tsx`; pe domeniul magazinului răspunde ramura magazinului, deci în producție e corect. Era așa și înainte.
- `npm run test:e2e` și setul smoke: nerulate (am actualizat doar textul din `admin-access.spec.ts`).

## 6. Verificări
- `npm run lint`: 0 erori, 4 avertismente vechi (`chat-post-handler.ts` variabile nefolosite, `<img>` în `LivratorLivrariClient.tsx`).
- `npm run typecheck`: trece (după build, care a refăcut `.next/types` fără rutele șterse).
- `npm run check:kit`: OK, 345 de fișiere, fără abateri.
- `npm run test:critical:unit`: 135 de fișiere, **1161 / 1161** (ultima rulare, singură). La rulările făcute în paralel cu build-ul, 7 și apoi 2 teste au depășit limita de 5 s (`ComenziDinMesajSheet`, `plan.test.ts`, primul test din două rute de cron); rulate singure, trec toate.
- `npm run build`: trece (EXIT 0).

## 7. `git diff origin/main HEAD --stat`
`public/sw.js` **nu** e în diff (`git diff origin/main HEAD --name-only | grep sw.js` → nimic). Fără capturi:

```
 CLAUDE.md |   4 +-
 e2e/admin-access.spec.ts |   4 +-
 public/apple-icon.png | Bin 11538 -> 7191 bytes
 public/badge-96.png | Bin 1452 -> 2011 bytes
 public/brand/logo-cu-nume-fundal-deschis.svg |   1 +
 public/brand/logo-cu-nume-fundal-inchis.svg |   1 +
 public/brand/logo-scurt-fundal-deschis.svg |   1 +
 public/brand/logo-scurt-fundal-inchis.svg |   1 +
 public/favicon.ico | Bin 0 -> 5086 bytes
 public/icon-192.png | Bin 12293 -> 8833 bytes
 public/icon-512-maskable.png | Bin 28949 -> 18633 bytes
 public/icon-512.png | Bin 36360 -> 25558 bytes
 public/icons/apple-touch-icon-180.png | Bin 0 -> 7191 bytes
 public/icons/badge-monocrom-96.png | Bin 0 -> 2011 bytes
 public/icons/favicon.png | Bin 1506 -> 1345 bytes
 public/icons/icon-128.png | Bin 6410 -> 5887 bytes
 public/icons/icon-144.png | Bin 7350 -> 6926 bytes
 public/icons/icon-152.png | Bin 0 -> 7545 bytes
 public/icons/icon-192.png | Bin 9961 -> 8833 bytes
 public/icons/icon-384.png | Bin 20971 -> 18590 bytes
 public/icons/icon-512.png | Bin 29072 -> 25558 bytes
 public/icons/icon-72.png | Bin 3560 -> 3664 bytes
 public/icons/icon-96.png | Bin 4808 -> 4395 bytes
 public/icons/icon-maskable-192.png | Bin 0 -> 6738 bytes
 public/icons/icon-maskable-512.png | Bin 0 -> 18633 bytes
 public/icons/icon.svg | 120 +--------------------
 public/og-image.png | Bin 0 -> 49945 bytes
 public/push-handlers.js |  10 +-
 public/shop/icons/icon.svg | 119 ++++++++++++++++++++
 src/app/(dashboard)/clienti/page.tsx |   3 +-
 src/app/(dashboard)/mai-mult/MaiMultPageClient.tsx |   3 +-
 src/app/a/[token]/page.tsx |   3 +-
 src/app/acces-oprit/page.tsx |   3 +-
 src/app/ajutor/page.tsx |  14 +--
 .../association/__tests__/members-route.test.ts |   2 +-
 .../association/__tests__/producers-route.test.ts |   4 +-
 src/app/api/association/members/route.ts |   3 +-
 src/app/api/association/producers/route.ts |   3 +-
 src/app/api/chat/chat-post-handler.ts |   5 +-
 src/app/api/integrations/google/sync-now/route.ts |   4 +-
 src/app/api/parse-order/parse-order-handler.ts |   3 +-
 src/app/apple-icon.tsx |  35 ------
 src/app/comanda/ShopClient.tsx |   4 +-
 src/app/confidentialitate/page.tsx |  14 +--
 src/app/head.tsx |   6 +-
 src/app/icon-192.png/route.tsx |  27 -----
 src/app/icon-512.png/route.tsx |  27 -----
 src/app/icon.tsx |  34 ------
 src/app/invite/[token]/page.tsx |   3 +-
 src/app/layout.tsx |  29 ++---
 src/app/livrator/[token]/page.tsx |   3 +-
 src/app/livrator/livrari/LivratorLivrariClient.tsx |   5 +-
 .../magazin/asociatie/confidentialitate/page.tsx |   3 +-
 src/app/magazin/asociatie/layout.tsx |   5 +-
 src/app/magazin/asociatie/page.tsx |   3 +-
 .../asociatie/producatori/[tenantId]/page.tsx |   3 +-
 src/app/magazin/asociatie/produse/page.tsx |   3 +-
 src/app/magazin/asociatie/termeni/page.tsx |   7 +-
 src/app/magazin/page.tsx |   5 +-
 src/app/manifest.ts |  27 +++--
 src/app/offline/page.tsx |   3 +-
 src/app/page.tsx |  14 +--
 src/app/termeni/page.tsx |  14 +--
 src/components/ai/AiBottomSheet.tsx |   3 +-
 src/components/analize/RaportSheet.tsx |   3 +-
 .../association/membri/AssociationMembriClient.tsx |   3 +-
 .../producatori/AssociationProducatoriClient.tsx |   3 +-
 src/components/auth/AuthFrame.tsx |   8 +-
 src/components/brand/LogoCuNume.tsx |  32 ++++++
 src/components/brand/logo-contururi.ts |  14 +++
 src/components/landing/ce-tii.tsx |   6 +-
 src/components/landing/contact.tsx |   5 +-
 src/components/landing/landing-header.tsx |   9 +-
 src/components/landing/story.tsx |   8 +-
 src/components/layout/Sidebar.tsx |  20 ++--
 src/components/rapoarte/ExportRaportSheet.tsx |   3 +-
 .../marketplace/MarketSuccessOverlay.tsx |   3 +-
 src/docs/gdpr-data-mapping.md |   4 +-
 src/lib/__tests__/redirect-domeniu.test.ts |  85 +++++++++++++++
 src/lib/analize/raport-server.ts |   3 +-
 src/lib/brand.ts |  45 +++++++-
 src/lib/echipa/drepturi.ts |   7 +-
 src/lib/farm-members/owner-auth.ts |  21 ++--
 src/lib/redirect-domeniu.ts |  91 ++++++++++++++++
 src/lib/setari/export-data.ts |   2 +-
 src/lib/shop/association/brand-config.ts |   6 +-
 src/lib/shop/association/order-summary-print.ts |   4 +-
 src/lib/shop/association/tech-platform.ts |  14 +--
 src/lib/shop/notify-farmer-shop-order.ts |   9 +-
 src/lib/support.ts |   5 +-
 src/proxy.ts |  12 +++
 91 files changed, 601 insertions(+), 412 deletions(-)
```

Cu cele 28 de capturi: 119 fișiere, 601 inserări, 412 ștergeri (plus acest raport).

## 8. Commit-uri
- `28a1e50` numele și adresa în `src/lib/brand.ts`, linkurile fără zmeurel.ro (au intrat aici din index și ștergerea `icon.tsx` / `apple-icon.tsx` / `icon-192.png/route.tsx` și mutarea zmeurei magazinului)
- `1273fc8` logo-ul: iconițe, manifest, push, `LogoCuNume`
- `1c13c2b` textele platformei
- `b06f168` redirecționarea cu flag + teste
- `94b086a` `CLAUDE.md` + „Ce ții în Caietul Fermei”
- `1501a98` fără ruta veche `/icon-512.png`
- `1979ea4` capturile
- ultimul: acest raport
