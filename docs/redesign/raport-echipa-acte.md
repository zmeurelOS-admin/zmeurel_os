# Raport: Promptul 21, Echipa și Actele fermei pe kit (+ dreptul „Tratamente”)

Branch: `redesign/echipa-acte` (din `main` `4123b60`), cu push. Fără merge. **Nu e nevoie de migrare.**
Din baza de date am citit doar cu `select` (`pg_get_functiondef` pentru `operator_can_write`, `current_tenant_id`,
`is_tenant_owner`; `pg_constraint`, declanșatoarele și coloanele pe `farm_members` / `farm_invites`; `pg_policies` pe
tabelele de tratamente și pe `farm_members` / `farm_invites`; expresia coloanei generate `farmer_legal_docs.legal_docs_complete`;
rândul invitației create în demo). Testele manuale le-am făcut doar într-un cont demo nou, creat prin `/start` → „Continuă fără cont” →
„Fructe de pădure”. Browserul avea o sesiune demo veche, din care am ieșit cu `POST /api/auth/leave-demo`.

## Ce am schimbat, pe bucăți

| Commit | Ce |
|---|---|
| `776dfda` | **Dreptul „Tratamente”**: `tratamente` în `FARM_MEMBER_MODULES` (eticheta „Tratamente”, ruta și ruta implicită `/tratamente`); `/tratamente` iese din rutele lui `activitati`. `resolveFarmMemberAccess` (regula de compatibilitate, mai jos), `toStoredFarmMemberAccess` (ce se scrie), `accessLevelForModule`. Le folosesc `proxy.ts`, `paste-to-x`, acceptarea invitației, API-urile `access` și `create-invite` (doar la scriere; validarea și securitatea au rămas aceleași) și Mai mult (placa Tratamente apare după `tratamente`). În Tratamente, operatorul cu citire nu mai vede „Tratament nou”, „Marchează făcut”, „Anulează”, „Repetă” și nu mai poate deschide formularul cu `?parcela=`. Am scris teste. |
| `5dcadd8` | **Echipa** pe kit: lista (proprietarul, operatorii, livratorii; sub fiecare nume, ce poate face), foaia unui om (schimbă accesul / retrimite linkul / dezactivează, cu confirmare), **„Invită pe cineva”** în 2 pași (`StepForm`). Logica stă în `src/lib/echipa` (rezumatul, ciorna Nu / Citește / Scrie, mesajul și linkul WhatsApp), cu teste. API-urile sunt aceleași. Folderele au intrat în `KIT_RULE_DIRS`, iar `EchipaClient` a ieșit din `KIT_RULE_PENDING_FILES`. |
| `6d3b6e8` | **Actele fermei** la `/settings/ferma/acte`. `/settings/documente-legale` redirecționează acolo. `stareActe` (`src/lib/acte`) e sursa unică pentru ecran, banner, rândul din Setări și `getLegalDocsMissingFields`. Am schimbat legăturile: bannerul, notificările `legal_docs_expiring` / `legal_docs_expired` (`notifications/navigation.ts`), ancora veche `#documente-legale`, rândul din Setări („Actele fermei”) și rândul nou din pagina Ferma. `LegalDocumentsPageClient` e șters. |
| `1b0781b` | `/invite/[token]` pe kit (`BigInput`, butoanele kitului, tokenii), cu aceeași logică. `src/app/invite` a intrat în `check:kit`. |
| `7b1e164` | Ajustări după trecerea prin demo: pe desktop butonul principal stă în pagină (bara de jos există doar pe telefon); un rând cu lipsuri începe cu „lipsește …”; numărul certificatului are mai mult loc decât seria; inițialele proprietarului demo („T”). |
| *(acest commit)* | Raportul și `CLAUDE.md`. |

### Echipa (Setări → Echipa)

- **Lista**: „Tu · Proprietar · tot”; operatorii („Operator · Recoltări, Lucrări (scrie) · Tratamente (citește)”), apoi livratorii („Livrator · doar Livrări”). Inițialele stau într-un pătrat colorat după rol. Pe telefon „Invită pe cineva” e jos; pe desktop, sus în pagină.
- **Foaia unui om**: rolul, ce poate, telefonul, data adăugării. Operatorul are „Schimbă accesul” (editorul Nu / Citește / Scrie în foaie, „Salvează accesul”), livratorul are „Retrimite linkul” (`regenerate-token`; linkul nou vine cu WhatsApp și Copiază, iar cel vechi nu mai merge). „Dezactivează” cere confirmare în foaie („Da, dezactivează” / „Nu, renunț”).
- **Invită**: pasul 1 „Cine e?”: plăcile Operator / Livrator, Nume (minimum 2 litere) și Telefon (opțional). Pasul 2, doar pentru operator: „Ce poate face?”, cu cele 9 module (Recoltări, Lucrări, Tratamente, Comenzi, Livrări, Clienți, Culegători, Parcele, Produse), toate pe „Nu” la pornire. Până alegi un modul, butonul spune „Alege cel puțin un modul”. Livratorul n-are pasul 2. La final apar „Linkul e gata”, linkul, **„Trimite pe WhatsApp”** (un `<a href="https://wa.me/?text=…">`, sau `wa.me/40…` când e scris telefonul) și „Copiază linkul”. Închiderea cu ceva scris cere confirmare.
- Numele și telefonul operatorului ajung doar în mesajul WhatsApp: `create-invite` nu le primește și n-am schimbat API-ul. Numele din echipă îl scrie operatorul la crearea contului, ca înainte.

### Actele fermei (Setări → Ferma → Acte)

- Sus stă starea: „Complete · Pot fi folosite la magazin și la asociație.” sau „Lipsește o dată / Lipsesc N date”, cu lista („Seria certificatului și data vizei.”). Dedesubt apar avertismentele de viză expirată sau aproape expirată.
- Rândurile, fiecare cu foaia lui (`BottomSheet`):
  - **Ferma**: forma juridică (4 plăci), CUI (doar la PFA / II / SRL), localitatea.
  - **Certificat de producător** (doar la certificat): numărul, seria și data vizei, pe `CalendarPanel` în foaie.
  - **Contact afișat**: numele și prenumele, telefonul.
  - **Poza certificatului** (sau „Poza documentului” la PFA / II / SRL): previzualizarea și „Încarcă poza”. Încărcarea merge pe același `/api/legal-docs/upload`, cu aceleași tipuri și aceeași limită de 5 MB.
  - Confirmarea (`CheckRow`) stă în pagină, cu legăturile spre Termeni și Confidențialitate.
- Ce scrii în foi rămâne în ciornă, iar starea de sus se recalculează pe loc. „Salvează actele” apare când ai schimbat ceva și trimite tot formularul la `PUT /api/legal-docs`, după `legalDocsFormSchema` (aceeași validare: un act incomplet nu se salvează, iar mesajul apare sus și la câmp). După salvare, `router.refresh()` reîmprospătează bannerul și Setările. Înainte, pagina trimitea la `/dashboard`; acum rămâi pe ecran.
- **O singură abatere de la regulile de dinainte**: fără niciun act salvat, forma juridică nu mai apare aleasă din oficiu (înainte, lista arăta „Certificat de producător” și îl salva). Acum se alege înainte de salvare, ca starea să spună același lucru ca bannerul („lipsește forma juridică”).
- **Bannerul** (`LegalDocsPersistentBanner`) afișează `textBannerActe(stareActe(...))`, de exemplu „Actele fermei: lipsesc 2 date (seria certificatului și data vizei). Fără ele nu poți vinde prin platformă.”, și duce la `/settings/ferma/acte`. Rândul din Setări folosește aceleași etichete („Lipsesc 2 date: seria certificatului, data vizei”). Regulile din `lipsuriActe` sunt cele ale coloanei generate `legal_docs_complete`; le-am verificat cu `select`.

## Migrarea

**Nu e nevoie.** `operator_can_write` acceptă deja `'tratamente'` în lista de module, iar pe `farm_members.modules_access` și `farm_invites.modules_access` (`jsonb`) nu există nicio constrângere sau declanșator. Politicile RLS pe `aplicari_tratament`, `aplicari_tratament_produse`, `produse_fitosanitare`, `planuri_tratament` și `planuri_tratament_linii`:

- `select`: `tenant_id = current_tenant_id()`, deci orice operator al fermei citește;
- `insert` / `update`: `is_tenant_owner(tenant_id) OR operator_can_write('tratamente')`, deci doar operatorul cu `tratamente: write`;
- `delete`: doar proprietarul.

Așadar un operator cu `tratamente: write` salvează aplicări, iar unul cu `read` doar le vede. Asta reiese din definițiile citite; nu am rulat-o cu un operator real (vezi mai jos).

## Regula de compatibilitate `activitati` → `tratamente: read`

**Unde stă:** `resolveFarmMemberAccess` și `applyTratamenteCompat` în `src/lib/farm-members/access.ts`.

**Regula:** la citirea drepturilor dintr-un rând salvat (`farm_members` sau `farm_invites`), dacă `tratamente` lipsește din `modules_access`, `activitati` e prezent și nu există refuzul explicit (mai jos), operatorul primește `tratamente: read`. Nu fac niciun `update` pe `farm_members`.

**Cine o aplică:** `proxy.ts` (garda de rută și antetul `x-zmeurel-member-modules`, deci și meniul Mai mult, Tratamente și `DashboardAuthContext`), `paste-to-x`, ecranul Echipa (rezumatul și editorul) și acceptarea invitației.

**Refuzul explicit:** altfel, proprietarul n-ar putea alege „Nu” la Tratamente pentru cineva cu Lucrări (la recitire, regula ar da iar citire). Când salvezi Lucrări fără Tratamente, `toStoredFarmMemberAccess` adaugă în `modules_access` `{ "module": "tratamente", "level": "none" }`.

- Baza de date îl ignoră: `operator_can_write` numără doar `read` / `write`.
- `normalizeFarmMemberAccess` îl ignoră și el, deci versiunea veche a aplicației nu se strică.
- Regula îl citește ca „Nu”.
- Rândurile vechi, fără refuz, primesc citire.
- La acceptarea unei invitații vechi cu Lucrări, rândul nou din `farm_members` se scrie cu `tratamente: read` explicit.

**Ce rămâne neschimbat:** în baza de date, un operator vechi cu `activitati` nu are scriere pe tratamente, nici înainte, nici acum. Regula îi dă doar citire, adică ce vedea și până acum.

## Ce n-am putut testa

- **Acceptarea invitației** (`/invite/[token]` → cont nou → `farm_members`). Ar fi creat un utilizator nedemo în producție, așa că am testat doar până la generarea linkului (ecranul pe kit nu l-am deschis cu un link valid în browser).
- **Drepturile unui operator real**: garda de rută pentru `/tratamente`, Mai mult, Tratamente în citire, RLS-ul la salvarea unei aplicări cu `write` și refuzul cu `read`. Le susțin logica și testele unitare (`farm-members-access.test.ts`) și definițiile RLS citite, dar nu o rulare cu un cont de operator.
- **„Schimbă accesul”** pe un operator: în demo nu există operatori (ar fi trebuit acceptată o invitație), deci `PATCH /api/farm-members/[id]/access` nu l-am apelat din ecran. Editorul e același cu cel din invitație, pe care l-am testat.
- **Bannerul cu lipsuri**: demo-ul pornește cu actele complete, iar salvarea cere actele complete, așa că din ecran nu pot ajunge la un act salvat incomplet. Textul bannerului îl acoperă testul `acte/__tests__/stare.test.ts` (aceeași funcție ca ecranul).
- **Încărcarea pozei**: n-am încărcat un fișier (selectorul de fișiere nu se poate folosi din browserul de test). Codul e cel de dinainte.
- e2e-urile Playwright nu le-am rulat: creează utilizatori cu service role.

## Ce am verificat în demo (390×844, zi și noapte; 1280×800)

- **Echipa**: lista cu rezumatul; invitația unui operator „Ana Test” cu Recoltări (scrie), Lucrări (scrie), Tratamente (citește) → linkul s-a generat. Rândul din `farm_invites` (citit cu `select`) are exact `recoltari:write, activitati:write, tratamente:read`. Linkul WhatsApp e corect.
- Un livrator „Ion Test” (telefon fictiv): fără pasul 2, linkul s-a generat, apare în listă ca „Livrator · doar Livrări”. „Retrimite linkul” a produs un link nou, iar „Dezactivează” (cu confirmare) l-a scos din listă. Amândouă pe omul creat în test.
- Formularul se redeschide gol, iar închiderea cu ceva scris cere confirmare (Esc).
- **Actele fermei**: starea „Complete”; seria ștearsă → „Lipsește o dată · Seria certificatului.”, rândul certificatului cu semn de avertizare; salvarea refuzată cu „Seria certificatului este obligatorie.”; seria completată → „Complete”. O salvare reală (localitatea, în demo) a mers. `/settings/documente-legale` → `/settings/ferma/acte`.
- Noaptea: Actele fermei și pasul 2 al invitației. Desktop: Echipa (butonul în pagină) și invitația în fereastră, cu segmentele lângă numele modulului.
- Consola: doar erorile CSP pentru scripturile Vercel Analytics în dev, care existau și înainte.

## Verificări

| | |
|---|---|
| `npm run lint` | 0 erori, 9 avertismente vechi, în fișiere neatinse |
| `npm run typecheck` | OK |
| `npm run check:kit` | OK, 235 de fișiere |
| `npm run test:critical:unit` | 94 de fișiere, 764 de teste, toate trec (noi: `farm-members-access`, `echipa/drepturi`, `acte/stare`) |
| `npm run build` | OK (`/settings/ferma/acte` și redirecționarea `/settings/documente-legale` în listă) |

`public/sw.js` și `.claude/settings.json` au rămas neatinse.
