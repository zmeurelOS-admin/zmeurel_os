# Audit Part 1 - Structura Auth

## 1) Output comanda structura directoare (`src/app`)
Comanda rulata:
```powershell
Get-ChildItem src/app -Recurse -Depth 3 -Directory | Select FullName
```

Output:
```text
FullName
--------
C:\Users\Andrei\Desktop\zmeurel\src\app\(auth)
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)
C:\Users\Andrei\Desktop\zmeurel\src\app\api
C:\Users\Andrei\Desktop\zmeurel\src\app\auth
C:\Users\Andrei\Desktop\zmeurel\src\app\callback
C:\Users\Andrei\Desktop\zmeurel\src\app\confidentialitate
C:\Users\Andrei\Desktop\zmeurel\src\app\icon-192.png
C:\Users\Andrei\Desktop\zmeurel\src\app\icon-512.png
C:\Users\Andrei\Desktop\zmeurel\src\app\login
C:\Users\Andrei\Desktop\zmeurel\src\app\register
C:\Users\Andrei\Desktop\zmeurel\src\app\termeni
C:\Users\Andrei\Desktop\zmeurel\src\app\(auth)\login
C:\Users\Andrei\Desktop\zmeurel\src\app\(auth)\reset-password
C:\Users\Andrei\Desktop\zmeurel\src\app\(auth)\reset-password-request
C:\Users\Andrei\Desktop\zmeurel\src\app\(auth)\update-password
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\activitati-agricole
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\admin
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\cheltuieli
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\clienti
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\comenzi
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\culegatori
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\dashboard
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\investitii
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\parcele
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\planuri
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\rapoarte
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\recoltari
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\settings
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\stoc
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\stocuri
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\ui-template-demo
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\vanzari
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\vanzari-butasi
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\admin\analytics
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\admin\audit
C:\Users\Andrei\Desktop\zmeurel\src\app\(dashboard)\recoltari\new
C:\Users\Andrei\Desktop\zmeurel\src\app\api\admin
C:\Users\Andrei\Desktop\zmeurel\src\app\api\cron
C:\Users\Andrei\Desktop\zmeurel\src\app\api\demo
C:\Users\Andrei\Desktop\zmeurel\src\app\api\gdpr
C:\Users\Andrei\Desktop\zmeurel\src\app\api\integrations
C:\Users\Andrei\Desktop\zmeurel\src\app\api\admin\tenant-plan
C:\Users\Andrei\Desktop\zmeurel\src\app\api\cron\admin-metrics-daily
C:\Users\Andrei\Desktop\zmeurel\src\app\api\cron\google-contacts-sync
C:\Users\Andrei\Desktop\zmeurel\src\app\api\demo\reset
C:\Users\Andrei\Desktop\zmeurel\src\app\api\demo\seed
C:\Users\Andrei\Desktop\zmeurel\src\app\api\gdpr\account
C:\Users\Andrei\Desktop\zmeurel\src\app\api\gdpr\farm
C:\Users\Andrei\Desktop\zmeurel\src\app\api\integrations\google
C:\Users\Andrei\Desktop\zmeurel\src\app\api\integrations\google\callback
C:\Users\Andrei\Desktop\zmeurel\src\app\api\integrations\google\connect
C:\Users\Andrei\Desktop\zmeurel\src\app\api\integrations\google\import
C:\Users\Andrei\Desktop\zmeurel\src\app\auth\callback
```

## 2) Fisiere din `src/app/(auth)/` si `src/app/auth/`

- `src/app/(auth)/login/page.tsx`: pagina client pentru login + register (email/parola si Google OAuth). Seteaza `redirectTo` catre `/auth/callback` pentru signup/OAuth si, la login cu parola, redirectioneaza spre `/dashboard`.
- `src/app/(auth)/reset-password/page.tsx`: formular client pentru resetarea parolei prin `supabase.auth.updateUser`. Dupa succes face `router.push('/dashboard')`.
- `src/app/(auth)/reset-password-request/page.tsx`: cere email si trimite link de reset prin `supabase.auth.resetPasswordForEmail`. Linkul de revenire este setat la `/update-password`.
- `src/app/(auth)/update-password/page.tsx`: pagina client pentru setarea parolei noi (validare + confirmare). Dupa update reusit trimite userul in `/dashboard`.
- `src/app/auth/callback/route.ts`: handler server pentru callback auth (OTP/email/signup/recovery/OAuth code). Valideaza sesiunea, asigura existenta tenantului (`ensureTenantForUser`) si apoi redirectioneaza catre `/dashboard` (sau `/update-password` pentru recovery).

## 3) `src/middleware.ts` - ce rute protejeaza?
`src/middleware.ts` **nu exista** in repo.

Echivalentul este `src/proxy.ts`, care ruleaza pe aproape toate rutele (prin `config.matcher`) si trateaza ca publice:
- `/`, `/login`, `/register`, `/callback`
- toate rutele care incep cu `/auth/`
- rute reset/update parola (`/reset-password*`, `/update-password*`)
- `/api/cron/google-contacts-sync`
- asset-uri (`manifest`, `sw`, `favicon`, `icons`, imagini statice)

Orice ruta nepublica este protejata: daca nu exista user autentificat, se face redirect la `/login`.

## 4) `seed_demo_for_tenant` in `src/app/auth/callback/route.ts` si `src/app/callback/page.tsx`
Nu. Nu exista niciun apel la `seed_demo_for_tenant` in aceste fisiere.

`src/app/callback/page.tsx` doar redirectioneaza catre `/auth/callback` cu query params pastrati, iar logica din `src/app/auth/callback/route.ts` creeaza/verifica tenantul, fara seed demo.

## 5) VERDICT
Da, in flow-ul normal un user nou poate ajunge pe dashboard fara blocaje, pentru ca:
- callback-ul auth creeaza tenantul daca lipseste (`ensureTenantForUser`)
- dupa succes redirectioneaza la `/dashboard`
- proxy-ul permite callback/login/register si protejeaza dashboard doar pentru useri neautentificati

Singurul blocaj relevant este cand onboarding-ul din callback esueaza (ex: esec la creare tenant), caz in care userul este trimis inapoi la `/login` cu parametru de eroare.
