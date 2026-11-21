# Prompt 23 — Operatorul intră din link, fără parolă

Lucrezi singur, fără plan și fără să ceri aprobare. Ce te blochează sari și notezi în raport. Branch nou din `main` (sha-ul primit în textul de lansare): `redesign/operator-din-link`. Commit-uri mici, push după fiecare bucată. Fără merge.

Context: `CLAUDE.md`, `docs/redesign/tokens.md`, raportul 21 (`docs/redesign/raport-21-*.md`). Fișiere de pornire: `src/app/invite/[token]/`, `src/app/api/invite/accept/route.ts`, `src/lib/farm-members/invite-accept.ts`, `src/app/api/farm-members/*`, `src/components/echipa/*`, `src/lib/livrator/access.ts` (modelul livratorului, cu link).

## Ce vrea Andrei

Acum operatorul invitat trebuie să-și facă cont cu email + parolă (sau Google). Nu primește fermă proprie, dar pentru un om de la fermă e prea greu, iar textul „Își face cont” sugerează altceva. Decizia:

- **Implicit: operatorul intră doar din link.** Deschide linkul de pe WhatsApp și e înăuntru, în ferma care l-a invitat, cu drepturile date. Fără email, fără parolă, fără fermă proprie.
- **Google rămâne ca a doua variantă**, pentru cine vrea.
- **Formularul cu email + parolă dispare din pagina de invitație.** Operatorii existenți cu email + parolă intră în continuare din `/login`, neschimbat.
- Livratorul rămâne exact cum e.

## 1. Contul ascuns

- La „Intră în fermă”, serverul creează un utilizator Supabase prin `getSupabaseAdmin().auth.admin.createUser`:
  - email intern, nerutabil: `op-<uuid>@operator.zmeurel.local`;
  - `email_confirm: true`, fără parolă (sau cu una aleatorie care nu se păstrează nicăieri și nu se întoarce);
  - `user_metadata`: `full_name` din invitație, `invite_operator: true`, `link_only: true`.
- Îl legi de fermă cu `acceptFarmInviteForUser` (același drum ca acum: `farm_members`, drepturile, invitația marcată folosită).
- Sesiunea o pornești **pe server**, în aceeași cerere, fără parolă: `admin.auth.admin.generateLink({ type: 'magiclink', email })`, apoi `verifyOtp({ token_hash, type: 'magiclink' })` cu clientul de server (`createClient()`), ca să se scrie cookie-urile. Nu se trimite niciun email. Dacă metoda asta nu merge, alege una echivalentă care nu păstrează parola și notează în raport de ce.
- Răspunsul redirecționează spre primul modul permis (`firstAllowedRoute`), ca acum.
- Aplicația nu trimite niciodată email către `@operator.zmeurel.local`: caută locurile care trimit email sau notificări pe email și exclude domeniul.

## 2. Linkul

- **Prima invitație:** tokenul din `farm_invites`, ca acum. Se folosește o singură dată: după prima deschidere, sesiunea rămâne pe telefonul acela. Expiră în 7 zile dacă nu e deschis.
- **„Retrimite link”** (`MembruSheet`) pentru un operator cu cont ascuns: un token nou de reconectare, care **intră în același utilizator** (nu creează altul, ca să rămână istoricul). Tokenul vechi nu mai merge. Poți refolosi `farm_members.invite_token` / `invite_used_at` (azi doar pentru livrator; `regenerate-token` refuză operatorul) sau poți face o migrare aditivă, dacă e mai curat. Tot o singură folosire, tot 7 zile.
- La „Retrimite” încearcă să închizi și sesiunile vechi ale acelui utilizator (de ex. telefonul pierdut). Dacă API-ul nu permite asta curat, notează în raport; „Dezactivează” rămâne oprirea sigură.
- Operatorul intrat cu Google nu are „Retrimite link”. `MembruSheet` arată „Intră cu Google din pagina de logare”.
- **Dacă cel care deschide linkul e deja logat în alt cont** (de ex. proprietarul care încearcă linkul pe telefonul lui), nu schimbi contul pe tăcute. Arăți „Ești logat ca <nume>. Ieși întâi ca să intri ca <nume invitat>.” și un buton care face delogarea pe server (`POST /api/auth/sign-out?next=/invite/<token>`), apoi revine pe link.

## 3. Ecranele (kit, reguli `check:kit`)

- **`InvitaStepForm`, cardurile:**
  - Operator: „Lucrează în ferma ta, doar cu ce-i dai. Intră din link, fără parolă.”
  - Livrator: „Doar Livrări, din link.”
  - Textul ajutător de sub telefon rămâne.
- **Pagina de invitație `/invite/[token]`:**
  - titlu: „<Numele fermei> te-a invitat”;
  - rând: „Lucrezi în ferma lui <nume proprietar>, doar cu ce ți-a dat. Nu-ți faci fermă proprie.”;
  - buton principal (`touch-lg`): „Intră în fermă”;
  - buton secundar: „Intră cu Google”;
  - fără email și parolă;
  - stările link expirat / folosit / dezactivat rămân, cu textul: „Cere-i lui <nume> un link nou.”
- **Ieșirea din cont** pentru un operator cu cont ascuns: confirmare „Ca să intri din nou îți trebuie un link nou de la <nume proprietar>.” Pe pagina de logare (`/login`) nu se schimbă nimic.
- **„Șterge contul”** făcut de un operator cu cont ascuns șterge doar utilizatorul lui și legătura din `farm_members`, **niciodată** ferma proprietarului. Verifică drumul actual pentru orice operator și corectează-l dacă atinge tenantul.

## 4. Unde mai trebuie atenție

- **Curățarea demo-urilor** (`DEMO_CLEANUP_MODE`): când se șterge un tenant demo, se șterg și utilizatorii `@operator.zmeurel.local` care erau membri doar acolo. Altfel rămân conturi orfane.
- **Admin și metrici:** `@operator.zmeurel.local` nu se numără ca utilizatori noi sau ferme reale. Caută filtrele pe `@demo.zmeurel.local` și adaugă domeniul unde are sens.
- **`src/proxy.ts`:** operatorul fără `profiles.tenant_id` propriu nu ajunge pe `/start`. Verifică faptul că drumul existent pentru operatori acoperă și contul ascuns.
- **Siguranță:**
  - tokenul se compară exact și se marchează folosit atomic (două deschideri simultane → un singur cont);
  - parolele nu apar în loguri, răspunsuri sau Sentry;
  - ruta nu acceptă alt `tenant_id` decât cel din invitație.

## 5. Teste și verificări

- **Teste unitare:**
  - tokenul (valid / expirat / folosit / dezactivat);
  - reconectarea intră în același utilizator;
  - a doua folosire e refuzată;
  - domeniul ascuns e exclus din emailuri și metrici.
- `npm run lint`, `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit`, `npm run build`: toate trec.
- **Test cap-coadă doar cu un cont demo nou** (proprietar demo). Mediul local folosește baza de producție, deci operatorul ascuns creat aici e legat doar de tenantul demo; notezi emailul lui în raport.
  - Folosești două contexte de browser separate (Playwright sau browserul din aplicație cu delogare între pași).
  - Pași: invitație → „Intră în fermă” → vede doar modulele date → scrie unde are „Scrie” și e refuzat unde are „Citește” → „Retrimite link” → linkul vechi refuzat, cel nou intră în același cont → „Dezactivează” → nu mai vede nimic.
- **Migrările**, dacă există, le scrii în `supabase/migrations/`, aditive, și NU le aplici. Spui în raport dacă aplicația merge fără ele.
- **Raport** în `docs/redesign/raport-23-operator-din-link.md`: ce ai schimbat, migrările cu SQL complet, ce n-ai putut testa, verificările, hash-urile commit-urilor.
- Nu comiți `public/sw.js`. Nu apelezi cronuri. Nu creezi utilizatori reali; doar operatori ascunși legați de tenanturi demo. Din baza de date doar citești (select), în afară de ce face aplicația însăși în contul demo.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
