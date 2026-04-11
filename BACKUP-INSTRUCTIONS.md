# Zmeurel OS — Backup / Restore Runbook

Acest document descrie **ce se poate salva și restaura realist** pentru Zmeurel OS, cu stack-ul actual:

- Next.js 16 pe Vercel
- Supabase (Postgres + Auth + Storage + Edge Functions secrets)
- runtime secrets în Vercel și Supabase

Scopul lui este operațional: **să reducem improvizațiile în incident**, nu să promitem un restore complet automat acolo unde nu există.

## Principii de bază

- **Repo-ul nu este backup de date.** Git salvează codul, migrațiile, funcțiile și documentația, dar **nu** salvează datele reale din DB/Auth/Storage.
- **Sursa de adevăr pentru schema DB este `supabase/migrations/`.** Nu README, nu SQL snippets izolate.
- **Sursa de adevăr pentru env inventory este `.env.local.example`.** Valorile reale trebuie păstrate separat, securizat.
- **Backup-ul real al datelor Supabase** rămâne provider-managed sau export manual controlat.
- **Storage objects** trebuie tratate separat de schema DB: bucket-urile sunt recreate din migrații, fișierele din bucket-uri nu sunt în repo.

## Ce intră în backup / restore pentru Zmeurel OS

### 1. Cod și configurație repo

Acoperit prin Git:

- `src/`
- `supabase/migrations/`
- `supabase/functions/`
- `public/`
- `package.json`, `package-lock.json`
- `next.config.js`
- `vercel.json`
- `AGENTS.md`
- `BACKUP-INSTRUCTIONS.md`
- `.env.local.example`

Acestea permit refacerea codului, a lanțului de migrații și a contractelor operaționale.

### 2. Database schema

Acoperită în repo prin:

- `supabase/migrations/`

Observații:

- lanțul activ de migrații este sursa de adevăr pentru tabele, politici RLS, funcții SQL/RPC și bucket-uri Storage
- `supabase/migrations_archive/` este istoric și nu trebuie tratat ca lanț activ de restore

### 3. Database data

Nu este salvată în repo.

Include:

- datele din schema `public`
- profile / tenants / analytics / module operaționale
- orice relații necesare fluxurilor ERP

Pentru restore complet, este preferabil un **backup provider-level Supabase** sau un dump SQL extern făcut separat de repo.

### 4. Auth users

Nu sunt salvați în repo.

Pentru incidente reale, restore-ul trebuie să țină cont și de:

- `auth.users`
- legătura lor cu `profiles`
- roluri / superadmin state / owners

De aceea, **restore-ul numai din migrații nu este suficient** pentru un mediu existent cu date reale.

### 5. Storage buckets și assets

Bucket-urile sunt definite în migrații și pot fi recreate prin schema restore.

Bucket-uri active detectate în repo:

- `produse-photos`
- `producer-photos`
- `producer-logos`
- `association-config`
- `legal-docs`

Important:

- definiția bucket-urilor și politicilor este în repo
- **fișierele din bucket-uri nu sunt în repo** și trebuie exportate separat dacă vrem restore complet
- bucket-urile private (`association-config`, `legal-docs`) sunt operațional sensibile

### 6. Runtime env și secrets

Nu sunt salvați cu valori reale în repo.

Inventory-ul minim este documentat în:

- `.env.local.example`

Dar valorile reale trebuie păstrate separat pentru:

- Vercel runtime envs
- Supabase Edge Functions secrets
- eventual password manager / secret manager intern

### 7. Deploy/runtime metadata

Acoperit parțial în repo:

- `vercel.json` pentru cron jobs
- `next.config.js` pentru PWA/Sentry/runtime behavior

Nu este acoperit complet în repo:

- setările efective de env din Vercel
- proiectul Supabase și backup policy-ul lui
- secretele Edge Functions din Supabase

## Unde sunt ținute lucrurile

### Sursa de adevăr pentru schema DB

- `supabase/migrations/`
- aici trăiesc tabelele, politicile RLS, funcțiile SQL/RPC și definițiile bucket-urilor Storage
- `supabase/migrations_archive/` nu este lanț activ de restore

### Runtime env inventory

- `.env.local.example` este inventarul versionat al cheilor necesare pentru restore/readiness
- `scripts/check-backup-readiness.mjs` validează read-only că inventarul acoperă și env-urile runtime folosite efectiv în cod
- valorile reale nu sunt în repo

### Runtime envs reale pentru aplicație

- Vercel Project Environment Variables pentru proiectul aplicației
- medii separate de verificat la incident: `development`, `preview`, `production`
- repo-ul păstrează doar numele cheilor și config-ul de deploy, nu valorile lor

### Backup-uri DB și Auth

- trebuie verificate la nivel de proiect Supabase, nu în repo
- pentru restore real contează atât datele din `public`, cât și `auth.users`
- repo-ul poate restaura schema, dar nu poate confirma sau reproduce singur backup-urile provider-side

### Storage buckets vs Storage objects

- bucket-urile și politicile lor sunt recreate din `supabase/migrations/`
- obiectele reale din bucket-uri trebuie verificate/exportate separat în Supabase Storage
- prioritate operațională mare la restore: `association-config`, `legal-docs`

### Edge Functions și secretele lor

- codul funcțiilor este în `supabase/functions/`
- secretele runtime pentru funcții se verifică/refac în Supabase Secrets, nu în repo
- exemple critice: `OPENWEATHER_API_KEY`, `OPENWEATHERMAP_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Ce nu este acoperit de repo

- backup provider-side pentru DB/Auth
- exportul obiectelor Storage
- valorile reale din Vercel envs
- valorile reale din Supabase Edge Functions secrets
- link/config complet pentru proiect nou Supabase (`supabase/config.toml` lipsește încă)

## Modelul operațional minim corect

Un restore rezonabil pentru Zmeurel OS înseamnă, în ordinea logică:

1. **Ai codul corect**
   - clonezi repo la commit/tag-ul dorit

2. **Ai inventarul de env-uri**
   - pornești de la `.env.local.example`
   - completezi valorile reale din secret storage, nu din documentație veche

3. **Ai schema corectă**
   - reaplici lanțul activ din `supabase/migrations/`

4. **Ai datele reale**
   - restore din Supabase backup / dump extern

5. **Ai assets-urile Storage**
   - reîncarci obiectele pentru bucket-urile active, mai ales private

6. **Ai secretele externe refăcute**
   - Vercel envs
   - Supabase Edge Functions secrets

7. **Ai validat post-restore**
   - auth
   - tenant resolution
   - storage access
   - cron/runtime envs
   - module critice

## Procedură de backup pragmatică

### A. Backup de cod / repo

Minimul obligatoriu:

```powershell
git status
git add .
git commit -m "backup: operational checkpoint"
git push origin main
```

Opțional, pentru un artefact offline al repo-ului:

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
git bundle create backups\zmeurel-$(Get-Date -Format yyyyMMdd-HHmmss).bundle --all
```

Observații:

- `git push` rămâne backup-ul principal pentru cod
- `git bundle` este util doar ca artefact offline suplimentar
- `make-audit-zip.sh` este pentru audit/code snapshot, **nu** backup complet de produs

### B. Backup de database

Backup-ul real de date trebuie făcut în afara repo-ului.

Minimul recomandat:

1. Supabase Dashboard → verifică politica de backup disponibilă
2. notează timestamp-ul backup-ului sau dump-ului folosit
3. confirmă că include și datele de Auth relevante pentru environment-ul respectiv

Important:

- pentru un incident real, **restore din provider backup** este preferabil față de exporturi CSV fragmentate
- exporturile manuale pe tabele sunt doar fallback local/operational, nu runbook principal

### C. Backup de Storage

Pentru fiecare bucket activ, decide explicit dacă ai nevoie de export de obiecte:

- `produse-photos`
- `producer-photos`
- `producer-logos`
- `association-config`
- `legal-docs`

Prioritate mare pentru restore:

- `association-config`
- `legal-docs`

Prioritate medie:

- `produse-photos`
- `producer-photos`
- `producer-logos`

Repo-ul actual **nu** conține automatizare de export pentru aceste obiecte.

### D. Backup de env-uri și secrets

Nu salva valori reale în repo.

Păstrează separat și securizat:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `DESTRUCTIVE_ACTION_STEP_UP_SECRET`
- `GOOGLE_TOKENS_ENCRYPTION_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `SHOP_ORDER_NOTIFY_*` / `RESEND_API_KEY`
- `VAPID_PRIVATE_KEY`
- cheile OpenWeather din Supabase Edge Functions secrets (`OPENWEATHER_API_KEY` / `OPENWEATHERMAP_API_KEY`)
- orice credențiale Sentry / Google OAuth relevante

Surse recomandate pentru stocare:

- Vercel Project Environment Variables
- Supabase Edge Functions Secrets
- password manager / secret vault intern

## Pre-restore checks

Înainte de orice restore, verifică:

- ce environment restaurezi: local / staging / production
- ce commit/tag din repo este ținta
- ce backup Supabase este ținta
- dacă trebuie restaurate și bucket-urile Storage, nu doar DB
- dacă secretele reale sunt disponibile în afara repo-ului
- dacă restore-ul va intra în conflict cu cron jobs din `vercel.json`

Cron jobs active în repo:

- `/api/cron/google-contacts-sync`
- `/api/cron/admin-metrics-daily`
- `/api/cron/demo-tenant-cleanup`
- `/api/cron/farmer-weekly-summary`
- `/api/cron/farmer-legal-docs-check`

Într-un restore sensibil:

- evită fereastra în care aceste joburi rulează
- sau rotește temporar `CRON_SECRET` până finalizezi restore-ul și verificările

## Drill sigur: staging, read-only sau tabletop

Ordinea recomandată pentru exerciții este:

1. staging / proiect separat sigur
2. drill parțial non-destructiv pe environment izolat
3. tabletop restore strict procedural, dacă nu există environment sigur de test

Pentru Zmeurel OS, fără confirmarea unui staging separat, varianta implicit sigură este un drill read-only + tabletop:

- verifici că repo-ul are toate artefactele de restore (`npm run check:backup-readiness`)
- confirmi proiectul Vercel linked și env-urile existente pe `development` / `preview` / `production`
- confirmi proiectele Supabase accesibile, proiectul linked, Edge Functions active și existența secretelor de funcții
- confirmi bucket-urile Storage existente și faptul că Auth este accesibil cu service role, fără să expui useri sau secrete
- marchezi explicit punctele unde restore-ul real depinde de backup provider-side/manual

Nu rula restore destructiv pe production pentru acest exercițiu.

## Staging readiness minimă pentru primul restore drill real

Nu trata automat `preview` sau `zmeurelOS-dev` ca staging sigur doar pentru că sunt non-production.

Pentru primul restore drill real, minimul recomandat este:

1. **Țintă Vercel stabilă**
   - fie proiect separat de staging,
   - fie un preview branch dedicat și stabil, folosit explicit pentru exerciții operaționale

2. **Țintă Supabase separată de orice utilizatori activi**
   - ideal proiect Supabase separat de dev și production,
   - alternativ branch/database izolat, dacă platforma și planul permit asta operațional

3. **Paritate minimă de env**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL`
   - `SITE_URL`
   - `CRON_SECRET`

4. **Control explicit al joburilor programate**
   - staging-ul trebuie să poată evita rularea cron jobs în timpul restore-ului
   - dacă nu poți opri temporar efectele lor, nu ai încă un staging sigur pentru drill real

5. **Link/config repetabil către Supabase target**
   - preferabil `supabase/config.toml` sau un pas documentat clar pentru `supabase link`
   - fără acest pas, restore-ul pe proiect nou rămâne prea manual pentru exercițiu repetabil

6. **Politică clară de date**
   - dacă mediul conține useri non-test sau tenants non-demo activi, tratează-l ca mediu sensibil
   - în acest caz, drill-ul rămâne read-only sau tabletop până ai o țintă cu risc acceptabil

Helper util în repo:

- `npm run check:staging-readiness` verifică read-only paritatea minimă Vercel/Supabase și semnalează dacă proiectul linked dev pare nepotrivit pentru un restore drill destructiv

## Procedură de restore minimă

### 1. Repornește codul din repo

```powershell
git clone https://github.com/zmeurelOS-admin/zmeurel-os.git
cd zmeurel-os
npm ci
```

### 2. Refă inventarul de env-uri

```powershell
Copy-Item .env.local.example .env.local
```

Apoi completează `.env.local` din sursa securizată de secrete.

Important:

- `.env.local.example` este inventar, nu conține valori reale
- pentru production/staging, valorile reale trebuie replicate și în Vercel
- pentru Edge Functions, secretele trebuie refăcute în Supabase, nu doar local

### 3. Refă schema DB

Sursa de adevăr este `supabase/migrations/`.

Repo-ul nu are în acest moment un `supabase/config.toml`, deci restore-ul pe proiect nou nu este complet turnkey din repo. Opțiunile realiste sunt:

- Supabase CLI după link manual la proiectul țintă
- sau aplicarea controlată a lanțului de migrații prin workflow-ul standard al echipei / Dashboard

Important:

- nu trata README SQL snippets ca sursă completă de restore
- bucket-urile Storage și politicile lor vin din migrații, deci schema restore trebuie să includă întreg lanțul activ

### 4. Restaurează datele

Preferat:

- restore din backup provider-level Supabase / snapshot / dump complet

Fallback:

- importuri manuale controlate doar dacă știi exact ce date trebuie refăcute și ce nu este acoperit

### 5. Restaurează obiectele Storage

Reîncarcă obiectele pentru bucket-urile relevante, în special:

- `association-config`
- `legal-docs`
- apoi public media buckets

Fără acest pas:

- branding/public settings pot lipsi
- documentele legale pot rămâne inaccesibile
- imaginile publice pot apărea goale deși DB-ul este restaurat

### 6. Refă runtime-ul extern

Verifică și refă:

- Vercel env vars
- Supabase Edge Functions secrets
- cron auth (`CRON_SECRET`)
- Google OAuth / Google token encryption
- push VAPID keys
- Sentry config

### 7. Deploy și pornește verificările

```powershell
npm run check:backup-readiness
npm run check:critical
```

## Post-restore smoke checklist

Verificări minime:

- [ ] `npm run check:backup-readiness` trece
- [ ] `npm run check:critical` trece
- [ ] login funcționează
- [ ] tenant resolution funcționează după autentificare
- [ ] dashboard se încarcă fără erori de env / service-role
- [ ] datele critice ERP sunt prezente pentru tenant-ul așteptat
- [ ] imaginile din `produse-photos` / `producer-photos` / `producer-logos` se încarcă
- [ ] `association-config/settings.json` este disponibil dacă workspace-ul asociației este activ
- [ ] documentele legale pot genera signed URL din `legal-docs`
- [ ] AI/chat funcționează dacă cheile Gemini sunt configurate
- [ ] notificările push pot inițializa cheile VAPID
- [ ] ruta meteo nu este degradată din lipsa cheii OpenWeather
- [ ] cron routes sunt securizate și `CRON_SECRET` este setat corect

## Ce nu este automatizat în prezent

Nu există în repo:

- export automat pentru DB dump
- export automat pentru Auth users
- export automat pentru Storage objects
- restore automat end-to-end pentru proiect nou Supabase
- sincronizare automată a secretelor Vercel/Supabase în afara providerilor

Aceste limitări trebuie considerate normale pentru stadiul actual; important este să fie **cunoscute explicit**, nu presupuse.

## Artefacte utile din repo

- `BACKUP-INSTRUCTIONS.md` — acest runbook
- `.env.local.example` — inventarul de env-uri/secrets
- `scripts/check-backup-readiness.mjs` — verificare read-only pentru readiness minim în repo
- `scripts/check-env.js` — verificare minimă de build local
- `supabase/migrations/` — sursa de adevăr pentru schema DB și bucket-uri
- `vercel.json` — cron jobs deployate
- `AGENTS.md` — context operațional și dependențe sensibile

## Comandă rapidă de readiness

```powershell
npm run check:backup-readiness
```

Aceasta verifică doar readiness-ul repo-ului:

- existența artefactelor cheie
- inventarul de env-uri
- cron config
- bucket-urile definite prin migrații

Nu verifică dacă backup-urile reale Supabase/Vercel există sau dacă secretele provider-side sunt complete.

## Concluzie operațională

Pentru Zmeurel OS, restore-ul realist astăzi înseamnă:

- repo curat la commit-ul corect
- migrații active complete
- backup real Supabase pentru date/Auth
- export separat pentru Storage objects importante
- inventar clar de env-uri și secrete refăcute în providerii corecți

Atâta timp cât aceste 5 lucruri sunt tratate explicit, incident response-ul rămâne controlabil și nu depinde de memorie informală sau panică.
