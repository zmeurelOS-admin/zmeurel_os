# Prompt 12 — „+ Poză bon” la Cheltuieli și Investiții

Model: Opus 5.5 · Effort: high · Mod: normal (fără plan) · Sesiune: NOUĂ · Branch: `redesign/poza-bon` (pornit din `redesign/securitate-1`) · Rezultat: migrare scrisă (NEAPLICATĂ), branch verde, cu push, fără merge

## Context

- Andrei a aprobat în mockup: pasul 2 din formularul de cheltuială/investiție are **„+ Poză bon”**, opțional.
- Raportul de noapte (secțiunea „Ce n-am terminat”) arată că nu există niciun flux de încărcare. Pagina veche trimitea mereu `document_url: undefined`. În producție, 0 din 1431 cheltuieli au `document_url`.
- `cheltuieli_diverse.document_url` și `investitii.document_url` există deja (`text`, nullable). **Nu adăugăm coloane.**
- Politicile pe `cheltuieli_diverse` verifică doar tenantul (`tenant_id = current_tenant_id()`), fără `operator_can_write`. Stocarea urmează aceeași regulă.
- Model de urmat pentru bucket privat + URL semnat: `legal-docs`, adică `src/app/api/legal-docs/upload/route.ts` și `src/lib/legal-docs/server.ts`, cu politicile pe `storage.objects` după `(storage.foldername(name))[1] = current_tenant_id()::text`.
- Fișierele formularului:
  - `src/components/cheltuieli/CheltuialaStepForm.tsx`;
  - `src/app/(dashboard)/cheltuieli/CheltuieliPageClient.tsx`;
  - `src/lib/supabase/queries/cheltuieli.ts`, `investitii.ts`.

## Ce faci

1. **Migrarea** `supabase/migrations/20261120120000_bonuri_storage.sql` (aditivă):
   - bucket privat `bonuri`: `public = false`, `file_size_limit = 2097152`, `allowed_mime_types = {image/jpeg, image/webp}`. Folosești `insert ... on conflict (id) do nothing`;
   - 4 politici pe `storage.objects` pentru `authenticated` (select / insert / update / delete), cu `bucket_id = 'bonuri' and auth.uid() is not null and (storage.foldername(name))[1] = public.current_tenant_id()::text`;
   - fără alte schimbări. **NU o aplici.**
2. **Calea fișierului:** `{tenant_id}/{tabel}/{client_sync_id}.jpg`, unde tabelul e `cheltuieli` sau `investitii`. În `document_url` se salvează **calea din bucket**, nu un URL.
   - Când afișezi: dacă valoarea începe cu `http`, o deschizi direct (compatibilitate);
   - altfel ceri `createSignedUrl` pe 1 oră, din client cu `getSupabase()`. Politica de select permite asta.
3. **Pregătirea pozei în client**, într-un helper mic `src/lib/bonuri/` (`prepareBonImage`, `uploadBon`, `removeBon`, `signedBonUrl`):
   - micșorezi pe canvas la latura mare de maximum 1600 px și exporți JPEG 0,8. Așa trece și o poză HEIC de pe iPhone, pe care browserul o decodează, și iese sub 2 MB;
   - dacă imaginea nu se poate decoda, arăți „Poza nu s-a putut citi. Încearcă alta.”
4. **Formularul, pasul 2** (folosești doar kitul):
   - rândul „+ Poză bon” deschide `<input type="file" accept="image/*" capture="environment">`, ascuns. Selectorul nativ al telefonului e în regulă, nu e o fereastră a noastră peste `StepForm`;
   - după alegere: miniatură, plus „Schimbă” și „Scoate” (ținte ≥ 48 px, text ≥ 15 px);
   - la **Salvează**: urci poza întâi (`upsert: true`, pe aceeași cale, ca reîncercarea cu aceeași `client_sync_id` să nu dubleze). Apoi creezi rândul cu `document_url`;
   - dacă urcarea pică, arăți `Notice` în pas: „Bonul nu s-a putut încărca.”, cu două butoane: „Încearcă din nou” și „Salvează fără bon”. Nu pierzi suma introdusă;
   - **fără internet:** dacă există o poză, arăți „Poza bonului se poate adăuga doar cu internet.”, iar cheltuiala se salvează fără bon, prin fluxul offline existent. Nu pui poza în coada IndexedDB;
   - închiderea cu nesalvat (`closeGuard`) ține cont și de poză.
5. **Editarea:** poți adăuga, schimba sau scoate bonul.
   - La schimbare, suprascrii aceeași cale (calea folosește `client_sync_id`-ul rândului). Dacă rândul nu are `client_sync_id`, folosești `id`.
   - La „Scoate” + salvare, pui `document_url = null` și ștergi fișierul (best effort; dacă ștergerea pică, rândul tot se salvează).
6. **Ștergerea unui rând** din foaia lui: după ștergere, încerci să ștergi și fișierul bonului (best effort, fără să blochezi). Ștergi doar obiectul din `bonuri` al acelui rând.
7. **Foaia rândului:** „Vezi bonul” deschide URL-ul semnat în pagină nouă. Opțional, o miniatură în foaie, dacă e simplu; nu deschizi altă foaie peste foaie.
8. **Cheltuielile automate din Recoltări** nu primesc bon (nu au „Editează”).
9. **Demo:** nu atingi cron-ul de curățenie a demo-urilor. Notezi în raport că fișierele din `bonuri/{tenant_demo}/` rămân după ștergerea tenantului și că le curățăm separat.
10. Analytics: pe `create_success`, adaugi `metadata.has_bon: true/false`. Fără evenimente noi.
11. Verificări:
    - `npm run lint` (doar cele 2 erori vechi), `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit`, `npm run build`;
    - un test unitar pentru `prepareBonImage` (dimensiuni) și pentru alegerea între URL direct și cale.
    - **Nu poți testa urcarea până nu aplicăm migrarea.** Scrii în raport pașii de test în demo (390 px): adaugi o cheltuială cu bon, „Vezi bonul”, schimbi, scoți, ștergi rândul.
12. Raportul: `docs/redesign/raport-poza-bon.md`. Apoi `git restore public/sw.js`, commit, `git push origin redesign/poza-bon`. **STOP. Fără merge.**

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
