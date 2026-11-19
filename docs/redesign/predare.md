# Predare — revamp UI Zmeurel OS (stare la 19.11.2026, 15:50)

Document pentru o conversație nouă din proiectul „Zmeurel OS – Dev”. Citește-l integral înainte de orice acțiune.

## 1. Rolul tău și cum lucrăm (cerințe Andrei)

- Ești **arhitect și auditor**. Nu implementezi codul aplicației. Scrii prompturi structurate pentru **Claude Code** și verifici rezultatul (preview, baza de date doar prin citire).
- Fiecare prompt complet se scrie în repo, în `docs/redesign/prompts/NN-nume.md`, pe branch-ul de lucru, cu push. Andrei primește **doar un prompt scurt**: „citește X din Y, fă planul (și fișierele atinse), apoi aștepți aprobarea”.
- Claude Code face **întotdeauna PLAN → STOP → (aprobare) → ETAPA A → STOP → ETAPA B → STOP**. Nimic fără aprobare.
- Fiecare prompt are în antet **Model · Effort · Mod · Sesiune**. Convenția folosită:
  - module mari / kit / fundație: `Fable 5.2 · Effort: high · Mod: plan · Sesiune: NOUĂ`;
  - corecturi mici: `Opus 5.5 · Effort: medium · Mod: plan`.
- Îi spui lui Andrei **când să înceapă o sesiune nouă** în Claude Code (de regulă la fiecare prompt nou de modul).
- Permisiunile Claude Code sunt în `.claude/settings.json` (citire, edit, git pe `redesign/*`, npm; `ask` la push pe main / merge / `execute_sql`; `deny` la force push, reset, supabase/vercel CLI, `.env`, `apply_migration`). Nu le slăbi.
- Răspunde în **română, scurt și direct**.
- Orice prompt include obligatoriu, la final:

  > NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.

## 2. Reguli de siguranță

- **Preview-urile și mediul local folosesc baza de PRODUCȚIE** (Supabase `ilybohhdeplwcrbpblqw`). Pe preview nu se creează și nu se editează date în contul lui Andrei. Salvările se testează **doar într-un cont demo** creat prin `/start` → „Continuă fără cont” → „Fructe de pădure” (tenant de test, șters automat de cron după 24 h).
- Migrări: **doar aditive**, scrise ca fișier de Claude Code, **aprobate de Andrei** înainte de rulare. Le poți rula tu prin MCP Supabase doar după ce Andrei cere explicit, și doar după verificare prin citire (semnături, triggere, RLS, granturi).
- `public/sw.js` nu intră niciodată în commit (Claude Code face `git restore public/sw.js` înainte de merge).
- Push direct pe `main` din sesiunea ta e refuzat. Merge-ul îl face Claude Code: `git merge --ff-only redesign/<x>` după ce verifici preview-ul și Andrei aprobă; apoi confirmă deploy de producție READY.
- Nu introduci parole sau chei. Codurile de verificare rămân la Andrei. Cheia `service_role` nu se copiază nicăieri.

## 3. Infrastructură

- Repo: `zmeurelOS-admin/zmeurel_os` (local: `/home/claude/zmeurel_os`). Lucru pe branch-uri `redesign/<x>`.
- Vercel: echipa `zmeurelos-admins-projects`, proiect `zmeurel`. Preview stabil pe branch: `https://zmeurel-git-redesign-<x>-zmeurelos-admins-projects.vercel.app` (pentru `redesign/recoltari`: `...-git-redesign-recoltari-...`). Producție: `www.zmeurel.ro`.
- Variabilele Supabase pentru Preview au fost reparate (login funcționează pe preview).
- Verificare în browser (Claude in Chrome):
  - service worker-ul servește HTML vechi după deploy → înainte de verificare: `navigator.serviceWorker.getRegistrations()` → `unregister()` + `caches.delete()` pentru fiecare cheie, apoi reîncarcă;
  - redimensionarea ferestrei nu se aplică mereu → pentru telefon, injectezi un `iframe` same-origin de 412×800 px (`position:fixed`), îl folosești și îl scoți la final;
  - noaptea: adaugi clasa `dark` pe `<html>` din iframe;
  - cardul „beta” (WhatsApp) apare în primele sesiuni; închide-l (nu apăsa pe linkul WhatsApp).

## 4. Ce e gata (în `main`, în producție)

| Prompt | Ce | Stare |
|---|---|---|
| 00 / 01 | Audit UI + audit analytics | `docs/redesign/audit.md` (decizii în §6, interogări în Anexa G) |
| 02 | Curățenie cod mort | merge |
| 03 / 03b | Fundație: tokeni pe roluri, noapte pe `.dark`, scara de straturi; corecturi antet + pagini auth noaptea | merge `7717606` |
| 04 | Kit de componente `src/components/kit/` + `/admin/kit` + `npm run check:kit` | merge `62c0ae2` |

Referințe: `docs/redesign/tokens.md`, `CLAUDE.md` (secțiunea kitului, reguli pentru modulele refăcute), `docs/redesign/progres.md` (jurnal + „Rămase” + liste de verificat pe telefon).

## 5. În curs: Recoltări pe kit (prompt 05) — ultimul pas, MERGE

- Branch `redesign/recoltari`, ultimul commit verificat `2d0d2ed` (Etapa A + B). Verificat de mine pe preview în cont demo: 412 px zi/noapte + desktop.
- Decizii luate (detaliu în `docs/redesign/prompts/05-recoltari.md` și `progres.md`): pagina doar o zi (azi implicit, zile anterioare din pastila cu data); „Adaugă kg” înlocuiește FAB-ul; salvare directă din pasul 2 → ecran „Salvat” cu „Următorul culegător” / „Gata”; alegerile (dată, parcelă, notă, culegător nou) se deschid **în pas**, nu în foi suprapuse; confirmare la închidere cu kg nesalvate (X și „înapoi”), garda e în kit (`StepForm.closeGuard`); avertismentul de tratament e un buton ⚠ lângă parcelă; căutarea, filtrele și „Sezon pe parcelă” au fost eliminate.
- **Migrare aplicată în producție (19.11.2026):** `create_recoltare_idempotent` (fișier `supabase/migrations/20261119120000_create_recoltare_idempotent.sql`) — înveliș `security invoker` peste `create_recoltare_with_stock`, cu `client_sync_id`. Funcțiile vechi neatinse. Aplicația trimite cheia, cu revenire la funcția veche la PGRST202, 23505 = reușită.
- **Ultimul mesaj trimis lui Claude Code:** corectură mică (subtitlul din `PageHeader` rămâne data de azi când e aleasă altă zi), apoi `git restore public/sw.js && git checkout main && git pull && git merge --ff-only redesign/recoltari && git push origin main`, deploy READY, STOP.
- **Primul lucru de făcut:** verifică dacă merge-ul a ajuns (`git fetch && git log origin/main`, sau Vercel `list_deployments` pe target production). Dacă nu, aștepți raportul lui Andrei.

## 6. Următorul: Comenzi (prompt 06), apoi Livrări (prompt 07)

Ordinea stabilită: **Recoltări (pilot) → Comenzi → Livrări**. Două module separate, interfețe separate.

- Deciziile sunt în `docs/redesign/mockups/comenzi.md` și `docs/redesign/mockups/livrari.md` (mockup-uri aprobate: Comenzi https://claude.ai/artifact/Y2wLwSeJkTmnwM3eiigSVq, Livrări https://claude.ai/artifact/AkDRrjRhuZ1SQDk7X1sJbG, Recoltări https://claude.ai/artifact/NfqZJG7nTanjryxB3r191R).
- Promptul 06 se scrie după modelul lui 05 (`docs/redesign/prompts/05-recoltari.md`): protocol PLAN/STOP/A/B, inventarul funcțiilor existente (păstrat / mutat / eliminat), doar kit + tokeni canonici, folderele modulului în `KIT_RULE_DIRS`, verificare în cont demo, desktop doar „să funcționeze”, fără merge.
- Pentru Comenzi, de reținut în prompt:
  - stocul: „Pune în livrare azi” arată „Rămas în stoc” din `get_sellable_cal1_stock_summary` și blochează comenzile care nu mai încap; garda reală rămâne `set_comanda_in_delivery` → `STOC_INSUFICIENT` (advisory lock); UI tratează eroarea;
  - prioritarele: steag, banner despre **livrare**, bifate implicit la „Pune în livrare”; **nu** au loc special în traseu; notificările push (07:00 / 18:00, din Setări) pot fi etapă separată;
  - prețul din fișa clientului (`clienti.tip`, `clienti.pret_negociat_lei_kg`, deja în schemă); fără „cât ia de obicei”; cantitate doar kg, nimic preselectat;
  - „Din mesaj” (lipire WhatsApp/SMS) există deja — se păstrează;
  - segmentele cu 4 opțiuni la 390 px taie etichete lungi → „Programate” are nevoie de formă scurtă;
  - **întrebare deschisă pentru Andrei:** avansul se notează la comandă sau doar la livrare?
  - **întrebare deschisă:** modulul Comenzi are și pagini `comenzi/campanie` și `UnifiedOrderCard` folosit în Livrări — planul trebuie să spună ce se atinge.
- Pentru Livrări (07), de reținut:
  - funcții existente care **trebuie păstrate**: „N-a răspuns” și „Copiază comanda pentru livrarea următoare”;
  - locații clienți: migrare aditivă (lat, lng, data și precizia salvării) — aprobată înainte;
  - optimizare traseu prin OpenRouteService apelat de pe server (cheia nu ajunge în client);
  - modul noapte obligatoriu verificat.

## 7. Rămase (lista completă în `progres.md` → „Rămase”)

- Service worker-ul servește HTML vechi după deploy — strategia de cache pentru navigări.
- Cardul „beta” acoperă butonul mare de jos până e închis (`beta-widget.tsx`).
- „Vizibilitate ridicată” pe setul canonic; contrastul `--fg-subtle` noaptea.
- Două ferestre suprapuse se închid amândouă la „înapoi” pe Android (regulă în `CLAUDE.md`: închizi foaia înainte să deschizi formularul).
- Butoanele din Dashboard albe pe alb ziua, la 768–1023 px; pastila Asociație din Livrări noaptea; notificările (toast) din auth noaptea.
- Mărimea implicită a butonului (40 px) — se schimbă la final.
- Totaluri pe sezon / parcelă — de mutat în Rapoarte.
- Testele e2e de recoltare caută selectori vechi.
- Expirările din testele `integrations/google`.
- De verificat pe telefon real (Andrei): „înapoi” fizic pe Android, mărirea pe iPhone, TalkBack — liste în `progres.md`.

## 8. Decizii generale ale lui Andrei

- Desktopul se reface mai târziu (acum doar „să funcționeze”).
- Asociația (Gustă din Bucovina) — mai târziu.
- Chatul AI e pus deoparte; legăturile lui (precompletare prin URL) se păstrează funcționale.
- Material săditor nu se migrează pe kit deocamdată.
- Notarea recoltării: pe culegător, seara; cântarul dă zecimale; kg nu se precompletează niciodată.
