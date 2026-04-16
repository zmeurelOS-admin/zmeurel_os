# AI Chat Widget — Zmeurel OS
_Last updated: 2026-03-28_

---

## Architecture Overview

The chat widget is a floating assistant embedded in the dashboard layout for all authenticated users.

**Stack:**
- `@ai-sdk/google` with `gemini-2.5-flash` (fallback `gemini-2.0-flash-lite`)
- Vercel AI SDK (`generateObject` + `generateText`) pentru extracție structurată și fallback conversațional
- Supabase server client (`createClient`) for auth, rate limiting, context queries
- Web Speech API for voice input (zero new deps)

**Entry points:**
- API: `src/app/api/chat/route.ts` — wrapper-ul POST endpoint pentru Next.js App Router (guard same-origin/CSRF cu `validateSameOriginMutation` înainte de handler)
- Handler: `src/app/api/chat/chat-post-handler.ts` — orchestratorul POST, routing AI, rate limiting, keyword queries și handoff UI
- Extractors: `src/app/api/chat/extractors.ts` — regex/text extraction helpers pentru payload-uri determinate
- Signals: `src/app/api/chat/signal-detectors.ts` — detectori booleeni pentru routing-ul cheap-first
- Conversation memory: `src/app/api/chat/conversation-memory.ts` — memorie scurtă și fallback la ultimele schimburi
- Date helpers: `src/app/api/chat/date-helpers.ts` — date relative în `Europe/Bucharest`
- Flow detection: `src/app/api/chat/flow-detection.ts` — flow types, required fields, canonicalizare și candidate loading
- Shared utils: `src/app/api/chat/utils.ts` — utilitare comune pentru parsing/error summaries
- `deterministic-eval.ts` a fost eliminat — logica e acoperită de `extractors.ts`, `signal-detectors.ts`, `flow-detection.ts`
- Widget: `src/components/ai/AiBottomSheet.tsx` — bottom sheet chat UI
- Desktop overlay: `src/components/ai/AiPanel.tsx` — right slide-in panel, same content as mobile widget
- Floating button: `src/components/ui/AiFab.tsx`
- Mounted in: `src/app/(dashboard)/layout.tsx`

---

## Request Flow

```
Client → POST /api/chat { message, pathname, conversationId, history? }
  1. Same-origin guard (`validateSameOriginMutation`) pentru mutația POST
  2. Auth check (supabase.auth.getUser)
  3. Profile read → tenant_id, rate limit check
  4. Continuation detection + sticky-flow reset când mesajul nou schimbă clar intenția
  5. Pentru `recoltare` / `activitate` / `comandă`: `generateObject` cu Zod + entități valide injectate
  6. Backend validation: verifică ID-uri, missing fields, clarificări, `prefill_data`
  7. Keyword queries / routing deterministic financiar pentru restul flow-urilor
  8. Fallback conversațional cu `generateText` doar când nu există un flow structurat deschis
  9. Fire-and-forget: save to ai_conversations, analytics, rate usage
  10. Return JSON (`answer` / `form`)
```

---

## Keyword Detection

Runs ONLY when the last user message matches a keyword group. All queries are parallel via `Promise.allSettled`-style wrapping. Each query is wrapped in `Promise.resolve(...).catch(...)` to handle failures gracefully.

| Keyword group | Regex | Query |
|---|---|---|
| `tratament` | `/(tratament\|stropit\|produs\|aplicat)/i` | `activitati_agricole` — last 3 by `created_at DESC`, columns: `tip_activitate, produs_utilizat, data_aplicare, parcela_id` |
| `client` | `/(telefon\|număr\|numar\|client)\s+\w+/i` | `clienti` — WHERE `nume_client ILIKE '%{word}%'`, columns: `nume_client, telefon, email` |
| `cheltuieli` | `/(cules\|culegător\|culegator\|plătit\|platit)/i` | `cheltuieli_diverse` — SUM(`suma_lei`) for current month (filter: `data >= first of month`) |
| `recoltare` | `/(recoltat\|recolt\|kg\|producție\|productie)/i` | `recoltari` — SUM(`cantitate_kg`) for current month (filter: `data >= first of month`) |
| `comenzi` | `/(comandă\|comanda\|livrare\|nelivrat)/i` | `comenzi` — COUNT grouped by `status` |
| `stocuri` | `/(stoc\|disponibil)/i` | `miscari_stoc` — LIMIT 5, columns: `produs, cantitate_kg, tip_miscare, data` |

**Important column names (from supabase.ts):**
- `cheltuieli_diverse` amount column: `suma_lei` (NOT `valoare` or `suma`)
- `recoltari` date column: `data` (NOT `created_at`)
- `cheltuieli_diverse` date column: `data` (NOT `created_at`)
- `clienti` name column: `nume_client` (NOT `nume_prenume`)
- `culegatori` name column: `nume_prenume`

---

## Structured Targeted Flows

- Flow-urile `recoltare`, `activitate`, `comandă` folosesc acum extracție semantică structurată cu Zod pe modelul existent.
- Backend-ul injectează explicit:
  - `now_iso`
  - `timezone: Europe/Bucharest`
  - doar entitățile valide relevante pentru flow-ul probabil (`parcele`, `clienți`, `produse`)
- LLM-ul:
  - alege `flow_key`
  - extrage câmpurile
  - selectează `parcela_id` / `client_id` doar din listele valide
  - curăță voice junk și `observatii`
- Backend-ul:
  - validează schema
  - verifică existența ID-urilor
  - decide clarificările și `missing_fields`
  - emite un singur payload canonic: `prefill_data`
- UI-ul:
  - consumă `prefill_data`
  - cardul AI afișează doar label-uri curate
  - dialogurile folosesc direct ID-urile validate când există
- Dacă `generateObject` eșuează pe aceste flow-uri, handler-ul nu mai răspunde direct cu fallback generic; continuă pe extragerea deterministică locală deja existentă.
- Parsarea deterministică de parcelă pentru agricultură acceptă și formulări cu `din` (ex: `Am recoltat 20 kg azi din Delniwa`).

### Deterministic priority hotfix (2026-03-25)

- Lucrările agricole (`stropit/stropire/irigat/irigare/palisat/copilit`) și recoltarea (`recoltare/recoltat/cules`) au prioritate față de routing-ul financiar când mesajul indică operațiune agricolă (parcelă/produs/doză/data/cantitate).
- `Switch`/produs fitosanitar singur nu mai forțează `cheltuiala`.
- `cheltuiala`/`investitie` pornesc doar pe semnale clare de cost (`sumă`, `lei`, `am plătit`, `am cumpărat`, `bon`, `factură`, `cheltuială`).
- Clarificările cer strict câmpurile lipsă detectate local; nu se mai repetă câmpuri deja extrase.
  - Exemplu: `Recoltare la Delniwa` → `Ce cantitate și pentru ce dată?`
  - Exemplu: `Activitate de stropit la Delniwa cu Switch` → `Ce doză și pentru ce dată?`
- Pentru cazurile cu semnal insuficient sau mixt (`produs + parcelă` fără verb dominant), backend-ul folosește clarificare scurtă contextuală în loc de routing greșit.

### Multi-turn short follow-up hotfix (2026-03-25)

- Dacă ultimul răspuns AI este o clarificare de tip câmp lipsă sau un răspuns de tip `formular pregătit` (`Am pregătit formularul...`, `Am completat...`, `Am deschis formularul...`), mesajele scurte următoare sunt tratate ca `continuare` a aceluiași flow.
- Backend-ul face merge local între contextul anterior și mesajul scurt curent (fără prompt bloat), astfel câmpurile deja extrase nu se pierd la pasul următor.
- După ce un flow a fost stabilit, follow-up-urile scurte rămân sticky pe același flow (evită reclasificări accidentale între recoltare/activitate/cheltuială).
- Pentru inputuri vagi cu semnal util parțial (`20 kile la Delniwa`, `Switch la Delniwa`, `am pus ceva ieri`), backend-ul răspunde cu clarificare scurtă contextuală (maxim 2 opțiuni), evitând fallback generic.
- Detecția de `pending clarification` include și formulări scurte de tip `mai am nevoie de...` / `ce detaliu mai completezi?`, ca follow-up-urile scurte (`ieri`, `20 kg`, `0,5 l`, nume) să continue flow-ul activ în loc de reset generic.

### Required-vs-optional alignment (2026-03-25)

- Clarificările AI folosesc o matrice locală de `required for open_form` și întreabă doar lipsurile obligatorii.
- Matrice curentă pentru clarificări:
  - `activitate`: `tip`, `data`
  - `recoltare`: `parcela`, `data`
  - `cheltuiala`: `suma`, `data`, `categorie`
  - `investitie`: `suma`, `data`, `categorie`
  - `comanda`: `nume_client`, `cantitate_kg`, `data_livrare`
  - `client`: `nume_client`
- Câmpurile opționale nu mai blochează flow-ul (ex: telefon client, observații, produs/doză/sursă); se lasă pentru completare în formular.
- Separare explicită:
  - `required_for_open_form`: decide doar clarificările obligatorii înainte de open.
  - `required_for_save_hint`: nu blochează open; doar adaugă mesaj scurt post-open când mai lipsesc detalii critice de salvare în UI (ex: recoltare → culegător, comandă → preț/kg).

### Regression harness (2026-03-25)

- Există un mini harness local pentru regresii AI chat: `npm run test:ai-chat`.
- Rulează Node-only prin Playwright Test config dedicat (`playwright.ai-chat.config.ts`), fără browser flow/e2e și fără DB real.
- Corpusul sintetic V2.6 este organizat pe categorii utile: routing clar, ambiguități controlate, continuitate multi-turn scurtă, corecții explicite, anulări explicite de câmp, canonicalizare/typo/nume apropiate, română reală/colocvială/dictare, `required_for_open_form`, `required_for_save_hint`, clarificări strict pe lipsuri reale, cazuri foarte scurte/sub-specificate și non-regresie.
- Verificările sunt robuste pe comportament, nu pe snapshot text complet: flow ales, tip răspuns (`open_form`/clarificare/hint), câmpuri extrase/correctate/golite și prezența sau absența save hints.
- Contract tests endpoint real: `npm run test:ai-chat:integration` (Node-only, fără browser, cu mock-uri locale pentru dependențe externe inevitabile).
- Gate standard înainte de deploy pentru patch-uri AI relevante: `npm run check:ai-chat` (lint AI + typecheck + harness sintetic).
- Gate general repo: `.github/workflows/check.yml` rulează `npm run check:critical` pe toate PR-urile și pe `push` pe `main`.
- CI gate dedicat AI/chat: `.github/workflows/ai-chat-gate.yml` rulează `npm run check:ai-chat:ci` pe `pull_request`, `push` pe `main` și `workflow_dispatch`, dar numai când sunt atinse path-urile AI/chat relevante.
- `check:ai-chat:ci` combină `npm run check:ai-chat` cu `npm run test:critical:integration`, astfel regresiile importante din endpointul real `/api/chat` sunt blocate automat fără să încărcăm toate PR-urile nerelevante.
- Regula de lucru: orice bug nou confirmat pe AI chat se adaugă mai întâi în corpusul sintetic ca regresie, apoi se face patch-ul.
- Pentru hardening cross-modul înainte de build: `npm run test:critical` (suite stabile de security/API hardening).
- Pentru gate extins înainte de release: `npm run test:critical:full` (include și `test:ai-chat:integration`).

### Decision observability (2026-03-26)

- API-ul emite un eveniment structural `ai_chat_decision` pentru fiecare răspuns AI relevant (clarificare, `open_form`, fallback LLM, continuare flow).
- Payload-ul nu include mesajul brut al utilizatorului; conține doar metadate compacte de decizie:
  - `flow_selected`, `decision_mode`, `continuation_used`, `entity_locking_used`, `correction_used`, `field_clear_used`, `canonicalization_used`
  - `open_form_emitted`, `save_hint_emitted`
  - `missing_required_open_fields_count`, `missing_save_hint_fields_count`
  - `clarification_kind`, `flow_final_state`
  - `fields_present`, `fields_missing` (doar chei, fără valori brute)
- În development se emite și un log scurt în server console (`[chat] decision`) cu aceeași structură, pentru debugging rapid fără expunere de text brut.
- Logurile de eroare AI chat (`structured_extraction_failed`, `generateText error`, fallback-uri) folosesc redaction server-side (`sanitizeForLog` + `toSafeErrorContext`), fără input brut al utilizatorului, fără tokenuri și fără payload-uri sensibile în clar.
- Dashboard-ul admin existent (`/admin/analytics`) are acum o secțiune AI care agregă direct aceste evenimente pentru KPI-uri de `open_form`/clarificări/LLM/save hints/continuation, distribuții pe flow și decision mode, fricțiune pe flow și un tabel recent de evenimente structurale.
- Filtrele AI din dashboard sunt minime și deliberate: interval (`7 zile` / `30 zile`), `flow`, `decision mode`.
- În dashboard, KPI-urile AI folosesc acum praguri pragmatice de beta cu semnalizare rapidă `Bun / Atenție / Risc` și un rezumat „Necesită atenție acum”; aceste praguri sunt orientative pentru hardening și nu reprezintă SLA final.

### Stabilization cleanup intern (2026-03-26)

- `route.ts` a fost curățat local fără schimbare intenționată de comportament:
  - centralizare pentru map-ul `required_for_save_hint` folosit la telemetry/save-hint meta;
  - helper comun pentru calculul câmpurilor obligatorii lipsă (`missing required`);
  - helper comun pentru răspunsurile de tip ambiguitate (`ambiguous_clarification`) ca să reducă duplicarea de metadata.
- Contractele externe (`open_form`, clarificări, telemetry keys, harness expectations) rămân neschimbate.

### Sticky-flow break + clean clarifications hotfix (2026-03-26)

- Continuation rămâne activ doar pentru follow-up-uri scurte compatibile cu clarificarea curentă (`ieri`, `20 kg`, `0,5 l`, nume scurt, telefon).
- Dacă mesajul nou are semnal clar de alt flow (ex: `recoltare -> activitate`, `recoltare -> comandă`), sticky flow-ul precedent este întrerupt și inputul este re-evaluat ca intenție nouă.
- Clarificările care depind de entități nerezolvate nu mai includ text brut neverificat; fără match canonic sigur, backend-ul folosește formulare neutră (`Nu găsesc parcela în datele fermei. La ce parcelă te referi?`).

### Entity canonicalization hotfix (2026-03-25)

- Pentru flow-urile deterministe, valorile extrase (`parcela`, `sursa`, `nume_client`, `produs`) sunt normalizate la etichete canonice din datele reale tenant când match-ul este sigur.
- Dacă apar mai multe candidate plauzibile, backend-ul cere clarificare scurtă contextuală în loc să ghicească.

### Recoltare parcel matching + UI prefill hardening (2026-03-26)

- Pentru flow-ul `recoltare`, matching-ul de parcelă folosește acum candidați extinși din date reale tenant: `nume_parcela`/`nume` + `soi_plantat`/`soi` + `cultura`/`tip_fruct`.
- Alias-urile de parcelă includ și variante fără sufixe decorative (ex: `MARAVILLA (Camp)` -> `MARAVILLA`), cu normalizare fără diacritice și typo tolerance mică.
- Ambiguitatea este tratată explicit când un alias corespunde mai multor parcele canonice (clarificare scurtă cu opțiuni), în loc de match agresiv.
- Handoff-ul AI -> UI pentru recoltare aplică prefill local în dialog: `parcela` (mapată la `parcela_id`), `cantitate_kg` (în `kg_cal1`) și `data`.

### Activitate parcel/product matching + UI prefill hardening (2026-03-26)

- Pentru flow-ul `activitate`, matching-ul de parcelă reutilizează candidați extinși din date tenant (`nume_parcela/nume`, `soi_plantat/soi`, `cultura/tip_fruct`) cu alias fără sufix decorativ și typo tolerance mică.
- Matching-ul pentru `produs` în activitate folosește candidați canonici combinați din `activitati_agricole.produs_utilizat`, `comenzi.produs` și `miscari_stoc.produs`; la ambiguitate sau lipsă de match se cere clarificare scurtă și curată.
- Handoff-ul AI -> UI pentru activitate aplică prefill local în dialog: `tip_activitate`, `parcela_id` (rezolvat din `parcela`), `produs_utilizat`, `doza`, `data_aplicare`.

### Comandă client/product matching + UI prefill hardening (2026-03-26)

- Pentru flow-ul `comanda`, matching-ul de client folosește canonicalizare pe nume tenant (normalizare fără diacritice, prefix relevant, typo tolerance mică), cu clarificare doar la ambiguitate reală.
- Extractorul deterministic pentru `comanda.nume_client` acceptă și formulări scurte de tip `pt Maria`.
- Dacă numele clientului este extras clar, dar nu există un match canonic suficient de sigur, formularul de comandă primește acum `nume_client` raw în loc să repete clarificarea pentru același client.
- Pentru `comanda.produs`, candidații canonici sunt agregați din date reale (`comenzi.produs` + `miscari_stoc.produs`); dacă nu există match sigur, backend-ul cere clarificare scurtă și curată, fără inventare.
- `open_form` pentru comandă include acum `client_id` când clientul este rezolvat canonic; în UI, dialogul folosește `client_id` sau rezolvă robust din `nume_client` pentru auto-select client + prefill telefon/adresă când există.

### Canonical Prefill Parity (2026-03-26)

- Pentru flow-urile `recoltare`, `activitate`, `comanda`, cardul AI (`open_form` preview), handoff URL (`AiBottomSheet`) și dialogurile UI consumă acum același payload canonic (`prefill_data`) ca sursă unică.
- Câmpurile afișate în card sunt doar valori canonice/sigure; valorile brute suspecte sunt filtrate înainte de emitere.
- În comandă, nota de livrare (ex: `după ora 18`) nu mai este interpretată ca `produs`; produsul și observațiile rămân separate.

### Extraction hygiene pentru leftover/observații (2026-03-26)

- Backend-ul folosește acum un strat unificat de curățare pentru text rezidual (`leftover`) înainte de maparea în `observatii`/`descriere`.
- Se elimină explicit valori deja consumate în câmpuri canonice (client/parcela/produs/cantitate/data/telefon etc.), politețuri și zgomot gramatical, plus fragmente prea scurte sau fără semnificație operațională.
- `observatii` nu mai este fallback automat; se populează doar când rămâne o notă clară și utilă pentru operator.
- Regula este aplicată coerent în flow-urile suportate (`recoltare`, `activitate`, `comanda`, `client`) fără a regresa curățarea deja existentă pe financiar (`descriere`).

### Romanian deterministic normalization (2026-03-25)

- Cantitate/sumă/doză: suport local pentru forme uzuale (`20 de kg`, `20 kile`, `20 kilograme`, `300 de lei`, `jumate de litru`, `o jumătate de litru`, `500 ml`).
- Date relative: `azi/astăzi`, `ieri`, `alaltăieri`, `mâine`, `poimâine`.
- Telefon: acceptă forme cu spații/cratimă (`0722 123 456`, `0722-123-456`) și normalizează intern.
- Suportă anulări explicite de câmp (`fără telefon`, `scoate data`, `șterge cantitatea`) în flow-ul activ, fără reset.
- `descriere` pentru cheltuială/investiție este populată conservator: se elimină fragmente deja extrase (sumă/data/parcela/produs/doză), stop words și zgomot; dacă restul nu trece un prag minim de calitate, rămâne goală.

### Financial routing hotfix (2026-03-27)

- Routerul financiar deterministic tratează acum explicit `caserole` ca `Ambalaje`, astfel mesaje precum `Adaugă o cheltuială de 300 lei pentru caserole, pentru azi` deschid direct formularul de cheltuială fără clarificare inutilă pe categorie.
- Extracția locală de `descriere` pentru flow-urile financiare păstrează acum și descrieri scurte valide dintr-un singur cuvânt (`motorină`, `manoperă`, `caserole`) când acestea rămân după curățare.
- În fallback-ul deterministic din `chat-post-handler.ts`, ramura de `investitie` are acum prioritate efectivă când `routeFinancialMessage(...)` clasifică explicit mesajul ca `investitie`, chiar dacă există semnal generic de cost (`lei`/`sumă`), evitând clasificarea greșită pe `cheltuiala`.
- Filtrul anti-zgomot pentru `extractDescriere` folosește acum detectare Unicode-safe pentru tokeni de o literă; expresii valide cu diacritice (ex: `butași`) nu mai sunt eliminate fals ca zgomot.

### Continuation fallback hotfix (2026-03-27)

- `AiBottomSheet` trimite acum către API și `conversationId` + `history` (ultimul exchange user/AI) pentru a proteja follow-up-urile foarte scurte.
- `resolveContinuationMessage(...)` rămâne DB-first (`ai_conversations`), dar folosește `history` ca fallback strict când ultimul exchange nu este încă disponibil la citire.
- Comportamentul vizat: răspunsuri scurte ca `ieri`, `300 lei`, `caserole` rămân legate de clarificarea anterioară chiar dacă utilizatorul răspunde imediat.
- Contextul client de continuare se resetează la schimbarea de rută, pentru a evita amestec între ecrane.

### Continuation + client price hotfix (2026-03-27)

- Dacă ultimul răspuns AI a fost deja un `formular pregătit`, iar utilizatorul pornește explicit un flow nou non-agricol de tip `adaugă cheltuială` / `adaugă comandă` / `client nou`, handler-ul nu mai lipește automat payload-ul anterior; tratează mesajul ca cerere nouă și cere detalii proaspete.
- Guard-ul de reset este limitat intenționat la flow-urile non-agricole (`cheltuială`, `investiție`, `comandă`, `client`), ca să nu schimbe comportamentul stabilizat pentru `recoltare` / `activitate`.
- Pentru `comandă`, dacă `client_id` este rezolvat canonic și utilizatorul nu a dat explicit acele valori, backend-ul completează acum în `prefill_data` atât telefonul clientului (`clienti.telefon`), cât și prețul negociat (`clienti.pret_negociat_lei_kg`).
- Acesta este contractul canonic pentru `/api/chat`: la client existent rezolvat sigur, `prefill_data.client_id` + `client_label` pot fi însoțite de `telefon` și `pret_per_kg`, iar mesajul de răspuns nu mai trebuie să ceară `prețul/kg` dacă valoarea negociată a fost moștenită.

### Financial ambiguity continuation hotfix (2026-03-27)

- Clarificările scurte de tip ambiguitate financiară (`CAPEX sau OPEX?`) sunt tratate acum ca `pending clarification`, la fel ca întrebările de tip `Ce sumă?` sau `Pentru ce dată?`.
- Follow-up-urile foarte scurte precum `capex`, `opex`, `investiție`, `cheltuială` păstrează contextul financiar anterior în `effectiveMessage`, în loc să pornească de la zero.
- Când un follow-up scurt rezolvă explicit ambiguitatea (`capex` / `opex`), flow-ul activ este suprascris local cu alegerea utilizatorului, ca să nu rămână blocat pe sticky-flow-ul precedent.
- Routerul financiar deterministic tratează acum explicit combinațiile `capex + pompă/atomizor/utilaj` ca `investiție -> Utilaje și echipamente` și `opex + pompă/atomizor/utilaj` ca `cheltuială -> Reparații și întreținere`.

### Inline confirm save hotfix (2026-03-27)

- Butonul `Confirmă` din `AiBottomSheet` nu mai este limitat la `cheltuială`; încearcă acum direct-save și pentru `investiție` și `comandă`, folosind aceleași query helpers runtime ca UI-ul normal.
- Pentru `comandă`, `AiBottomSheet` încearcă să rezolve `client_id` / telefon / preț negociat din `clienti` înainte de insert; dacă lipsesc încă datele critice, cade pe `router.push(buildFormUrl(...))`.
- Pentru `recoltare`, `AiBottomSheet` încearcă să rezolve `parcela_id` din eticheta canonică, dar dacă lipsește `culegator_id` sau alt câmp obligatoriu real, cade deliberat pe formularul UI.
- `activitate` și `client` rămân UI-first; nu fac direct-save din chat.

### Widget polish + dark mode (2026-03-28)

- `AiFab` afișează acum, o singură dată per sesiune, un bubble contextual `Întreabă-mă orice 🌱`; bubble-ul dispare automat după 4 secunde sau instant la orice tap.
- FAB-ul AI are acum etichetă vizuală permanentă `AI` sub icon, pentru claritate mai bună pe mobil.
- `AiBottomSheet` și `AiFab` folosesc acum culorile canonice light/dark ale aplicației, în locul fundalurilor hardcodate deschise.
- Confirmările de direct-save din `AiBottomSheet` trimit și haptic scurt (`navigator.vibrate(10)`) când salvarea reușește.

The response is always formatted as an AI data stream (`0:"<json>"\n e:...\n d:...\n`) so `useChat` can parse it as an assistant message. `ChatWidget.tsx` then detects `"action":"open_form"` via regex on `lastAssistantMsg.content` and intercepts it — the JSON is never displayed in chat (replaced with `✅ Am pregătit formularul. Verifică și salvează!`).

**Cheltuială prefill fields**: `suma` (number), `descriere` (exact product/service text), `categorie` (one of: Pesticide, Manoperă, Combustibil, Echipamente, Apă, Electricitate, Semințe, Îngrășăminte, Altele), `data` (YYYY-MM-DD)

**Recoltare prefill fields**: `cantitate_kg` (number), `parcela` (string), `data` (YYYY-MM-DD), `calitate` (Cal I / Cal II)

**Activitate prefill fields**: `tip` (tratament/irigare/etc.), `parcela` (string), `produs` (string), `doza` (string), `data` (YYYY-MM-DD)

**Few-shot examples in system prompt** (representative subset):

| User input | JSON output |
|---|---|
| "adaugă 500 lei pesticide ulei horticol astăzi" | `{"suma":500,"descriere":"Ulei horticol","categorie":"Pesticide","data":"<today>"}` |
| "75 lei insecticid și ulei horticol 21.03" | `{"suma":75,"descriere":"Insecticid și ulei horticol","categorie":"Pesticide","data":"<date>"}` |
| "300 lei manoperă curățare teren după tăiere lăstari Delniwa ieri" | `{"suma":300,"descriere":"Curățare teren după tăiere lăstari Delniwa","categorie":"Manoperă","data":"<yesterday>"}` |
| "200 ron îngrășământ NPK săptămâna trecută" | `{"suma":200,"descriere":"Îngrășământ NPK","categorie":"Îngrășăminte","data":"<lastWeek>"}` |
| "am recoltat 12 kg azi de pe Delniwa" | `{"cantitate_kg":12,"parcela":"Delniwa","data":"<today>","calitate":"Cal I"}` |
| "am stropit Delniwa cu Switch azi 0.5L" | `{"tip":"tratament","parcela":"Delniwa","produs":"Switch","doza":"0.5L","data":"<today>"}` |

**Rules enforced by system prompt:**
- `suma` = number only, no "lei"/"ron"
- `descriere` = exact product/service text, stripped of intent verbs + suma + date
- If `suma` missing → AI asks before returning JSON
- If `parcela` missing for recoltare → AI asks before returning JSON
- Relative dates ("ieri", "săptămâna trecută", "luni") → computed from `today` and `yesterday` injected into system prompt

**Routing after detection:**
- `cheltuiala` → `/cheltuieli?suma=X&data=Y&descriere=Z&categorie=W&openForm=1`
- `recoltare` → `/recoltari?cantitate_kg=X&parcela=Z&data=Y&calitate=Q&openForm=1`
- `activitate` → `/activitati-agricole?tip=T&parcela=Z&produs=P&doza=D&data=Y&openForm=1`
- `comanda` → `/comenzi?nume_client=N&telefon=...&cantitate_kg=X&pret_per_kg=Y&data_livrare=D&openForm=1`
- `client` → `/clienti?nume_client=N&telefon=...&email=...&adresa=...&openForm=1`

`CheltuialaPageClient`, `InvestitiiPageClient`, `RecoltariPageClient`, `ActivitatiPage`, `ComenziPageClient` și `ClientPageClient` consumă `?openForm=1`; pentru flow-urile unde `AiBottomSheet` nu poate salva direct sau lipsesc câmpuri obligatorii, handoff-ul deschide dialogul de adăugare cu prefill-ul disponibil.

**CRITICAL**: Acțiunile directe în DB din chat există doar după apăsarea explicită a butonului `Confirmă` în `AiBottomSheet`, și doar pentru flow-urile unde payload-ul are deja datele minime necesare (`cheltuială`, `investiție`, unele `comenzi`). Când payload-ul este incomplet, fluxul cade pe formularul UI pentru validare finală.

---

## Session Memory

Loads last 3 user/AI exchanges from `ai_conversations` table before each request. Each exchange contributes ~250 chars to context. Gracefully skipped if the table doesn't exist yet (catch block).

În plus, pentru follow-up imediat după clarificare, clientul poate trimite ultimul exchange (`history`) ca fallback temporar dacă ultima linie nu este încă vizibilă în query-ul DB.

Query: `SELECT mesaj_user, raspuns_ai, created_at FROM ai_conversations WHERE user_id = $1 AND tenant_id = $2 ORDER BY created_at DESC LIMIT 3`

After each successful stream, saves a new row (fire-and-forget via `result.text.then(...)`):
- `mesaj_user` truncated to 1000 chars
- `raspuns_ai` truncated to 2000 chars

---

## Proactive Alerts Logic

Triggered only when `messages.length <= 1` (start of session). Checks which active parcele have had no activity in the last 7 days.

Algorithm:
1. Fetch active parcele (limit 5)
2. Fetch all activities for those parcel IDs ordered by `data_aplicare DESC`
3. Build map: `parcelaId → { data_aplicare, tip_activitate }` (only first/latest per parcela)
4. For each parcela: if no activity OR latest `data_aplicare < today - 7 days`, add alert
5. Include max 2 alerts in system prompt

---

## Token Budget & Prioritization

| Component | Approx tokens | Priority |
|---|---|---|
| System instructions | ~80 | Always |
| Minimal context (parcele/comenzi/clienti counts) | ~15 | Always |
| Page-specific context | ~20 | If on relevant page |
| Keyword query results | ~100 (max 600 chars) | Only when keywords match |
| Session memory (3 exchanges) | ~150 | Always (if table exists) |
| Proactive alerts (2 max) | ~60 | First message only |
| User conversation history | last 4 messages, last truncated to 500 chars | Always |

Total system prompt target: ~300 tokens. Total per request: ~800 tokens input.

---

## Rate Limiting

- Standard: 20 messages/day per user
- Superadmin override: 60 messages/day when `profiles.is_superadmin = true`
- Stored in `profiles.ai_messages_count` (integer) and `profiles.last_ai_usage_date` (date)
- Timezone: Europe/Bucharest — `new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })`
- If `last_ai_usage_date` differs from today → treat count as 0 (reset)
- Counter incremented fire-and-forget after stream completes
- Gracefully skipped if columns don't exist (catches the Supabase error)

---

## Voice Input

- Uses Web Speech API — zero new npm dependencies
- Language: `ro-RO`
- Button only shown if `'SpeechRecognition' in window || 'webkitSpeechRecognition' in window`
- Mic button turns red + shows `MicOff` icon while recording
- Transcript appended to current input on `onresult`
- All SpeechRecognition types cast to `any` (not in standard TypeScript lib for all browsers)

---

## How to Extend

### Adding a new keyword group
1. Add regex to `keywords` object in `route.ts`
2. Add a `queryPromises.push(Promise.resolve(...).then(...).catch(...))` block
3. The result string gets included in `keywordContext` automatically

### Adding a new open_form type
1. Add a new `if (/(pattern)/i.test(lastMsg))` block in the intent section of `route.ts`
2. Return `Response.json({ action: 'open_form', form: 'new-form-name', ... })`
3. In `ChatWidget.tsx`, add a new `else if (parsed.form === 'new-form-name')` block in the `useEffect`
4. Create the target URL with appropriate URL params

### Adding a new page context
Add an `else if (pathname.includes('/your-route'))` block in the page context section with the appropriate Supabase query.

---

## SQL — Tables Required

Run these in the Supabase dashboard SQL editor before deploying:

```sql
-- 1. Add AI rate limit columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_messages_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_ai_usage_date date;

-- 2. Create ai_conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  mesaj_user text,
  raspuns_ai text,
  pathname text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- 4. RLS: users can only see their own conversations
CREATE POLICY "Users can read own ai_conversations"
  ON ai_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai_conversations"
  ON ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 5. Index for fast lookups
CREATE INDEX IF NOT EXISTS ai_conversations_user_tenant_idx
  ON ai_conversations(user_id, tenant_id, created_at DESC);

-- 6. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
```

> **Note**: After adding columns to `profiles`, regenerate `src/types/supabase.ts` with `npx supabase gen types typescript` if you have the Supabase CLI configured.

---

## Environment Variable

The Gemini API key must be set:

```
GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
```

Add to `.env.local` for development and to Vercel environment variables for production.

---

## Troubleshooting

| Issue | Cause | Fix |
|---|---|---|
| 401 errors | Session expired or not authenticated | Check Supabase session cookie; middleware should redirect |
| 429 errors | Rate limit hit (20/day) | Wait until midnight Europe/Bucharest or increment limit in code |
| Rate limit not working | `ai_messages_count`/`last_ai_usage_date` columns missing | Run SQL migration above |
| Session memory empty | `ai_conversations` table missing | Run SQL migration above |
| open_form not routing | Table missing or regex not matching | Check `lastAssistantMsg.content` in browser console |
| Voice button not showing | Browser doesn't support Web Speech API | Expected on Firefox desktop; works on Chrome/Safari |
| Keyword queries slow | Too many queries running | Check which keyword groups match; they should be rare |
| Build error: `as any` on ai_conversations | Table not in supabase.ts types | Expected; the code uses `supabase as any` intentionally until types are regenerated |
