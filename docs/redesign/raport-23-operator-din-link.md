# Raport 23 — Operatorul intră din link, fără parolă

Branch: `redesign/operator-din-link`, pornit din `main` (`250544e`). Fără merge. O migrare scrisă, **neaplicată**.

## Pe scurt

- Operatorul deschide linkul, apasă „Intră în fermă” și e înăuntru: cont ascuns `op-<uuid>@operator.zmeurel.local`,
  fără email real, fără parolă, fără fermă proprie. Google rămâne a doua variantă. Formularul cu email și parolă a
  dispărut din pagina de invitație. `/login` și livratorul n-au fost atinse.
- „Retrimite linkul” intră în **același** utilizator; linkurile vechi nu mai merg, iar telefonul vechi iese imediat din cont.
- Antetele din `proxy.ts` ajung acum la layout, iar cele trimise de browser se șterg (§0). Asta a scos la iveală două
  probleme, reparate și ele: nivelul de acces rămânea cel al primei pagini și operatorul nu putea deschide „Mai mult”,
  deci pe telefon n-avea de unde ieși din cont.
- **Problemă gravă găsită și reparată:** „Șterge contul” făcut de un operator ar fi șters **ferma proprietarului**.
  Aceeași capcană exista la „Golește ferma” (`/api/farm/reset`) și la redenumirea sau ștergerea fermei
  (`/api/gdpr/farm`), pentru operatorii cu parolă (singurii care pot trece de confirmarea cu parolă).
- Testat cap-coadă într-un demo nou: intrare, drepturi, refuz la scriere, retrimitere, link vechi refuzat, același
  cont, dezactivare. Detalii și ce n-am putut testa: §6.

## 0. Antetele din `proxy.ts` (commit `3817fc5`)

- La intrare, `stripProxyOwnedHeaders` (`src/lib/auth/proxy-headers.ts`) șterge toate antetele `x-zmeurel-*`, cu
  excepția listei explicite `CLIENT_SENT_ZMEUREL_HEADERS`. Lista are un singur antet, `x-zmeurel-step-up-token`
  (`DESTRUCTIVE_STEP_UP_HEADER`). `git grep "x-zmeurel"` nu găsește alt antet trimis de client.
- Răspunsul spre pagină se creează abia la final (`continueRequest()`), cu antetele finale și cookie-urile sesiunii.
  Cookie-urile reîmprospătate ajung și în cererea spre pagină: `request.cookies.set` scrie în `request.headers`, iar
  de acolo le copiez în `requestHeaders`.
- Toate ieșirile din `proxy()` păstrează cookie-urile: redirecturile (`redirectTo(..., supabaseResponse)`,
  `redirectToLogin(..., supabaseResponse)`), callback-ul de autentificare și rutele publice cu sesiune.
  Magazinul (rewrite) și rutele pur publice nu ating sesiunea, deci n-au cookie-uri de copiat.
- Test: `src/lib/auth/__tests__/proxy-headers.test.ts`, 8 cazuri. Un `x-zmeurel-tenant-id` sau un
  `x-zmeurel-member-role` trimis de client nu ajunge la pagină; cele puse de proxy ajung; cookie-urile reîmprospătate
  sunt pe răspuns și pe redirecturi. Testele pică pe codul vechi (verificat) și trec pe cel nou.
- Bannerul cu actele lipsă nu se mai arată operatorului: linkul lui duce în Setări, iar Setările îi sunt blocate.

**Ce a pornit pentru prima oară, verificat pe ecran:**

| Ce | Rezultat |
|---|---|
| Meniul și butoanele operatorului după drepturi | Comenzi cu „Citește”: fără „Comandă nouă”, cu „Caută și vezi toate comenzile”. Recoltări cu „Scrie”: „Adaugă kg”. Modulele nedate și Setări duc la primul modul permis. |
| Bannerul cu actele, demo cu acte complete | Fără banner (corect). |
| `farmName` | „Ferma demo” pe Mai mult, la proprietar. |
| Admin și meniul asociației, la un utilizator obișnuit | Nu apar. Mai mult arată doar fermă, module, Setări, Ajutor și Ieșire. |

**Reparat după ce antetele au început să ajungă** (commit `eb4e367`):

- `accessLevel` venea din layout, iar layout-ul nu se redesenează când treci de la o pagină la alta. Un operator care
  intra pe Comenzi („Citește”) și apoi deschidea Recoltări („Scrie”) vedea Recoltări doar de citit. Acum
  `DashboardAuthProvider` calculează modulul și nivelul din drepturi și din ruta curentă, cu aceeași regulă ca
  proxy-ul. Verificat: după navigare apare „Adaugă kg”.
- `/mai-mult` și `/notificari` sunt permise oricărui operator (`OPERATOR_ALWAYS_ALLOWED_ROUTE_PREFIXES`); înainte îl
  trimiteau la primul modul. Pe Mai mult, operatorul vede doar modulele date.

## 1. Contul ascuns (commit `9f4869a`)

- `POST /api/invite/accept` primește **doar** `{ token }`. Ferma și drepturile vin din invitație; ruta nu primește
  niciun `tenant_id`.
- Ordinea pașilor:
  1. Linkul se marchează folosit **atomic**: un singur `update … where used_at is null and expires_at > now()`
     reușește. Două deschideri simultane dau deci un singur cont (test).
  2. `admin.auth.admin.createUser` creează contul: `op-<uuid>@operator.zmeurel.local`, `email_confirm: true`, fără
     parolă, `user_metadata` = `{ full_name, invite_operator: true, link_only: true }`.
  3. Ferma goală pe care triggerul `on_auth_user_created` o face pentru orice utilizator nou se șterge (doar dacă e a
     lui, mai nouă de o oră și fără date). Profilul primește `tenant_id = null` și `exclude_from_analytics = true`.
  4. Legătura cu ferma: `farm_members`, cu drepturile din invitație.
  5. Sesiunea pornește pe server, fără parolă: `admin.generateLink({ type: 'magiclink' })` (doar întoarce linkul, nu
     trimite email), apoi `verifyOtp({ token_hash, type: 'magiclink' })` cu clientul de server, care scrie
     cookie-urile.
  6. Răspunsul trimite spre `firstAllowedRoute`; pagina face o încărcare completă.
- Dacă ceva pică:
  - înainte să existe contul → linkul redevine bun;
  - la legarea de fermă → contul abia creat se șterge, iar linkul redevine bun;
  - la pornirea sesiunii, când contul există deja → linkul devine unul de reconectare pentru același utilizator, ca
    reîncercarea să nu creeze al doilea cont.
- Parola: aplicația nu trimite niciuna și nu păstrează niciuna. GoTrue pune singur în `encrypted_password` un hash
  bcrypt aleator, pe care nu-l cunoaște nimeni (verificat în bază: 60 de caractere, `$2a$`). În jurnalele serverului
  nu apare nimic despre parole.
- `acceptFarmInviteForUser` (drumul cu Google) refuză linkurile de reconectare: au `modules_access` gol, deci ies
  `no_modules`.

## 2. Linkul și „Retrimite” (commit `333ed51`)

Toate linkurile operatorului stau în `farm_invites`: se folosesc o singură dată și expiră în 7 zile. N-am folosit
`farm_members.invite_token`, pentru că acolo nu există o dată de expirare.

- **Prima invitație:** `used_by_user_id` gol, `modules_access` = drepturile date.
- **Reconectarea:** `used_by_user_id` = utilizatorul ascuns, pus de la creare, și `modules_access` gol. Drepturile vin
  din `farm_members`. Dacă utilizatorul ar fi șters, cheia devine `null` (`on delete set null`), iar `modules_access`
  gol face linkul invalid: nu se poate transforma într-o invitație nouă.
- Ce face „Retrimite linkul” (`/api/farm-members/[id]/regenerate-token`), pentru un operator cu cont ascuns:
  - linkurile lui nefolosite expiră pe loc (`expires_at = now()`);
  - se face un link nou, care intră în același cont;
  - **sesiunile vechi se închid**: pornesc o sesiune ținută doar în memorie, apoi `signOut({ scope: 'global' })`.
    Verificat pe ecran: telefonul deja logat ajunge pe `/login` la următoarea pagină.
  - la intrarea din link se mai cheamă o dată `signOut({ scope: 'others' })`.
- Operatorul cu Google sau cu parolă primește `not_link_operator`. `MembruSheet` arată „Intră: Cu Google” și textul
  „Intră cu Google din pagina de logare.” (respectiv emailul și parola). `GET /api/farm-members` spune pentru fiecare
  operator cum intră (`account_kind`).
- Cine e deja logat în alt cont vede „Ești logat ca <nume>. Ieși întâi ca să intri ca <nume invitat>.” Butonul trimite
  `POST /api/auth/sign-out?next=/invite/<token>` și revine pe link (verificat). API-ul răspunde `409` și nu marchează
  linkul folosit.

## 3. Ecranele

- **`InvitaStepForm`:** textele cerute pe carduri; după generare, „Linkul e valabil 7 zile și merge o singură dată.
  Omul îl deschide pe telefon și intră direct în ferma ta, fără parolă.” Mesajul de WhatsApp spune „intri direct în
  ferma mea, fără parolă”. Starea goală din Echipa nu mai spune „își face cont”.
- **`/invite/[token]`:**
  - titlul „<Numele fermei> te-a invitat” (numele tehnic al unui demo se arată „Ferma demo”);
  - rândul „Lucrezi în ferma lui <proprietar>, doar cu ce ți-a dat. Nu-ți faci fermă proprie.”;
  - butonul principal „Intră în fermă” (`touch-lg`) și „Intră cu Google” (doar la prima invitație);
  - când un link nu merge: „Linkul a expirat” / „Linkul a fost deja folosit” / „Accesul tău a fost oprit”, plus
    „Cere-i lui <nume> un link nou.”
  - Numele proprietarului vine din `full_name` sau din email; la un cont demo nu se știe, așa că textul devine „în
    această fermă” sau „proprietarului fermei”.
- **Ieșirea din cont (commit `bf8e4a7`):** pentru operatorul cu cont ascuns apare confirmarea „Ca să intri din nou îți
  trebuie un link nou de la <proprietar>.” Pe Mai mult e o foaie din kit; pe desktop, în meniul de profil,
  `window.confirm` (componenta veche). `/login` e neschimbat.
- **`/acces-oprit` (commit `c8a85da`):** operatorul din link dezactivat ajunge aici în loc de `/start` („Accesul tău
  a fost oprit. Cere-i lui … un link nou.” și un buton de ieșire).
- **„Șterge contul” (commit `429f736`):**
  - Ruta lua ferma prin `getTenantIdByUserId`, care pentru un operator întoarce ferma proprietarului, și o ștergea.
  - Acum șterge doar ferma proprie, dacă există (`ownedTenantIdForDeletion`), apoi legăturile din `farm_members`,
    conversațiile AI, profilul și utilizatorul.
  - Dacă operatorul a scris în ferma altcuiva, `created_by` → `auth.users` n-are cascadă și ștergerea normală pică. În
    cazul ăsta contul se șterge „soft” (`deleteUser(id, true)`: Supabase îl anonimizează și păstrează rândul), iar
    istoricul fermei rămâne.
  - `/api/farm/reset` și `/api/gdpr/farm` răspund `403 NOT_FARM_OWNER` oricui nu e proprietarul fermei.
  - Teste noi: operatorul nu atinge `tenants`; ștergerea soft; resetul refuzat pentru operator.

## 4. Unde mai trebuia atenție

- **Curățarea demo-urilor (commit `0a34f82`):**
  - Un operator ascuns legat **doar** de ferma demo nu mai e semn de fermă reală. Fără asta, primul demo cu operator
    oprea toată rularea în modul `sterge`.
  - După rândul din `tenants` (legătura pleacă în cascadă), contul lui se reverifică (niciun alt rând în
    `farm_members`, nicio fermă) și se șterge; înainte se șterge și `ai_usage_log`.
  - Proba numără `operatoriAscunsi`.
  - Orice alt membru (operator real, livrator, operator ascuns legat și de altă fermă) rămâne semn de fermă reală.
- **Admin și metrici:**
  - Profilul contului ascuns are `exclude_from_analytics = true`, deci nu intră în „utilizatori”.
  - Ferma făcută de trigger se șterge, deci nu intră nici în „ferme”.
  - Evenimentele operatorului se numără la ferma proprietarului: e folosire reală a unei ferme reale.
  - În Admin n-am găsit alte filtre pe `@demo.zmeurel.local` în afară de cele pe `tenants.is_demo`.
- **Emailuri:**
  - Singurul loc care trimite email din aplicație e `notify-farmer-shop-order` (Resend). Acum scoate adresele
    `@operator.zmeurel.local`.
  - Pagina „Resetare parolă” nu mai cere Supabase să trimită la o adresă ascunsă.
  - `createUser` cu `email_confirm: true` și `generateLink` nu trimit email.
- **`proxy.ts`:** operatorul ascuns activ urmează drumul existent pentru operatori (testat: `/start` → primul modul).
  Fără apartenență activă, ajunge pe `/acces-oprit`.
- **Siguranță:**
  - tokenul se compară exact (`eq('token')`, plus `eq('token')` și în `update`) și se marchează folosit atomic;
  - ruta nu primește `tenant_id`;
  - parolele nu apar nicăieri: nu le trimitem, iar câmpurile în plus din corp se ignoră (test).

## 5. Migrarea

O singură migrare, aditivă: `supabase/migrations/20261121200000_farm_invites_invitee.sql`. **Neaplicată.**

```sql
-- Operatorul intră din link (promptul 23): invitația ține numele și telefonul omului invitat.
-- Aditivă: două coloane nullable, fără backfill. Aplicația merge și fără ea (invitația pleacă fără nume,
-- iar contul ascuns se numește „Operator”).

alter table public.farm_invites
  add column if not exists invitee_name text,
  add column if not exists invitee_phone text;

comment on column public.farm_invites.invitee_name is
  'Numele omului invitat (scris de proprietar). Devine full_name pe contul ascuns și name în farm_members.';
comment on column public.farm_invites.invitee_phone is
  'Telefonul omului invitat (opțional), copiat în farm_members.phone.';

comment on column public.farm_invites.used_by_user_id is
  'Cine a folosit linkul. La linkurile de reconectare („Retrimite linkul”) e pus de la creare: utilizatorul ascuns în care se intră; modules_access e gol, drepturile vin din farm_members.';

notify pgrst, 'reload schema';
```

**Fără migrare aplicația merge:**

- `create-invite` încearcă cu `invitee_name` și `invitee_phone`, iar la „coloană lipsă” (`PGRST204` / `42703`)
  trimite din nou fără ele. Pagina citește cu `select('*')`.
- Singura diferență: operatorul se numește „Operator” în Echipa, iar ecranul „Ești logat ca …” spune „operatorul
  invitat” în loc de nume. Așa a mers și testul de mai jos.
- `src/types/supabase.ts` are coloanele adăugate de mână.

**N-am schimbat triggerul `on_auth_user_created`**, care face o fermă pentru orice utilizator nou. Aplicația o
șterge imediat după creare. Mai curat ar fi o migrare care sare peste fermă pentru emailurile
`@operator.zmeurel.local`, dar atinge înscrierea tuturor; o las la decizia ta.

## 6. Testul cap-coadă

Server: `npm run build` + `next start` (configurația `prod`). Proprietarul a fost în browserul din aplicație, iar
operatorul într-un context separat (Playwright).

**Demo-ul nou** (`guest+…@demo.zmeurel.local`, tenant `189d3dea-b5de-41c6-be19-57c404422eb6`). Operatorul ascuns:
**`op-21c1d724-0442-4c09-930f-47580e1e4c19@operator.zmeurel.local`** (user `bb35bf97-5001-470c-940a-94dea06dabfd`),
acum dezactivat.

1. Invitație cu Recoltări „Scrie” și Comenzi „Citește” → „Ieși din cont” (browserul era logat cu operatorul primului
   test) → revine pe link → „Intră în fermă” → `/comenzi`.
2. Navigare la Recoltări fără reîncărcare → „Adaugă kg”. Scriere în `comenzi` pe API cu sesiunea lui → `403` (RLS
   `42501`).
3. „Retrimite” → `sessions_closed: true`; prima invitație → „deja folosit”; sesiunea lui → redirect la login; linkul
   nou → intră, același `user_id`.
4. „Dezactivează” → orice pagină duce pe `/acces-oprit`. În bază: nicio legătură activă, nicio fermă proprie, profil
   fără tenant, deci `current_tenant_id()` întoarce `null`.

**Primul test, în alt demo.** Tabul din aplicație era încă logat dintr-o sesiune anterioară, așa că „Continuă fără
cont” m-a dus într-un demo creat **azi la 16:59 UTC de rularea promptului 22** (tenant
`4f2a560b-8ce2-4ed5-a1c2-30d95e9eedc3`), nu într-unul nou. L-am observat abia la final și am refăcut traseul principal
în demo-ul nou de mai sus.

- Operatorul din primul test: `op-0dd8f6d1-1635-47f9-8fb3-26e0fc7f7442@operator.zmeurel.local` (user
  `4d25622a-5336-4dbc-87e7-acc97372e553`), tot dezactivat.
- Ce s-a verificat acolo, pe ecran, din interfață:
  - formularul de invitație cu textele noi;
  - ecranul „Ești logat ca contul demo”;
  - recoltarea salvată ca operator (Elena Rusu, 2 kg, cu motivul pentru parcela în pauză), care apare și la
    proprietar;
  - foaia de confirmare la ieșire;
  - în `MembruSheet`: „Intră: Din link, fără parolă” și „Retrimite” de două ori (linkul de reconectare anterior →
    „expirat”, cel folosit → „deja folosit”);
  - dezactivarea din foaie.

**De știut pentru curățarea demo-urilor.** Ambele demo-uri au acum un operator ascuns (inactiv) în `farm_members`.
Codul nou le șterge pe amândouă împreună cu fermele. **Codul din producție de acum îi vede însă drept „alt membru”**:
dacă `DEMO_CLEANUP_MODE=sterge` rulează înainte de merge, rularea se oprește la aceste ferme cu „semn de fermă
reală”, fără să șteargă nimic. În `proba` doar le raportează.

**N-am putut testa:**

- **Bannerul cu actele incomplete.** Din aplicație nu se poate goli niciun act al demo-ului: salvarea cere
  confirmarea, iar poza nu se poate scoate. Am verificat doar că un demo cu acte complete n-are banner. Risc mic:
  condiția e `stareActe` de dinainte, care acum chiar rulează.
- **Fermă de asociație aprobată** (`associationShopApproved` / meniul asociației cu antetele reparate). Nu am un cont
  de asociație de test. Risc: meniul și magazinul asociației pornesc acum din antetele reale; înainte valoarea era
  mereu `false`.
- **Superadmin** (meniul Admin cu antetele reparate). Risc mic: `isSuperAdmin` se citește tot din `profiles`,
  neschimbat.
- **„Intră cu Google” din link:** drumul OAuth n-a fost atins, dar nu l-am rulat cap-coadă (cere un cont Google real).
- **Pe Vercel:** totul s-a testat local, cu build de producție.
- **„Șterge contul” pentru operatorul ascuns din interfață:** nu există cale. Operatorii n-au Setări, iar confirmarea
  ștergerii cere parola (`/api/auth/destructive-step-up`), pe care contul ascuns n-o are. Ruta API e reparată și
  testată unitar.

**Observații, nereparate:**

- Prin API, operatorul poate citi `clienti` fără modulul Clienți (3 rânduri în demo). Probabil intenționat: Comenzi
  are nevoie de numele clienților. Interfața îl blochează.
- Pe Mai mult, operatorul vede „Ferma ta” în loc de numele fermei: citirea `tenants` cu clientul lui nu întoarce
  rândul.
- Local, după un redirect al proxy-ului, browserul încearcă `https://localhost` (`ERR_SSL_PROTOCOL_ERROR` în consolă).
  E vechi, nu ține de branch (probabil `upgrade-insecure-requests`); pe ecran pagina se încarcă.

## 7. Verificările

| Comanda | Rezultat |
|---|---|
| `npm run lint` | 0 erori, 9 avertismente vechi (niciunul în fișierele schimbate) |
| `npm run typecheck` | trece |
| `npm run check:kit` | OK, 236 de fișiere (`src/app/acces-oprit` adăugat în `KIT_RULE_DIRS`) |
| `npm run test:critical:unit` | 103 fișiere, 848 de teste, toate trec |
| `npm run build` | trece |

Teste noi:

- `src/lib/auth/__tests__/proxy-headers.test.ts`
- `src/lib/__tests__/operator-link.test.ts`: tokenul valid / expirat / folosit / dezactivat, reconectarea, domeniul
  ascuns scos din emailuri, felul contului.
- `src/lib/__tests__/operator-link-server.test.ts`: marcarea atomică, linkurile vechi expiră.
- `src/app/api/invite/__tests__/accept.route.test.ts`: un cont, a doua folosire refuzată, deschideri simultane,
  reconectare în același utilizator, logat în alt cont.
- Cazuri noi în testele GDPR, `farm/reset`, curățarea demo-urilor și `farm-members-access`.
- `vitest.critical.config.ts` include acum `src/app/api/invite/__tests__` și `src/app/api/farm-members/__tests__`.

## 8. Commit-uri

| Hash | Ce |
|---|---|
| `3817fc5` | fix(proxy): antetele x-zmeurel ajung la layout, cele trimise de browser se șterg |
| `9f4869a` | feat(echipa): operatorul intră din link, fără email și parolă |
| `333ed51` | feat(echipa): „Retrimite linkul” pentru operatorul din link |
| `bf8e4a7` | feat(echipa): confirmare la ieșirea din cont pentru operatorul din link |
| `429f736` | fix(cont): un operator nu mai poate șterge, goli sau redenumi ferma în care lucrează |
| `0a34f82` | feat(demo-cleanup): operatorii din link ai unui demo se șterg odată cu el |
| `c8a85da` | feat(echipa): contul ascuns nu primește email și nu ajunge pe /start |
| `eb4e367` | fix(operator): drepturile urmează pagina curentă; Mai mult și Notificări deschise |
| (acest commit) | docs: raportul 23 și CLAUDE.md |

`public/sw.js` (modificat de build) n-a fost comis.
