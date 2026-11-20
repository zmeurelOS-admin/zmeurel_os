# Prompt 15 — Curățarea demo-urilor, reparată (cu probă care doar numără)

Model: Opus 5.5 · Effort: high · Mod: normal (fără plan) · Sesiune: NOUĂ · Branch: `redesign/curatare-demo` (pornit din `main` `84ce103`) · Rezultat: branch verde, cu push, fără merge

## Context

- Cronul `/api/cron/demo-tenant-cleanup` (`vercel.json`, 04:00 UTC) **nu șterge nimic**. Caută `tenants.is_demo = true` și `expires_at < now()`, dar la toate cele ~110 demo-uri din producție `is_demo = false` și `expires_at` e gol.
- Semnul sigur al unui demo e **emailul proprietarului**: `…@demo.zmeurel.local`. Așa le recunosc și bannerul demo (`useDemoBannerVisible`) și verificarea zilnică (`src/lib/notifications/zilnice/ferme.ts`, `esteEmailDemo`).
- Ștergerea datelor unei ferme e deja în `src/lib/tenant/destructive-cleanup.ts` (`deleteTenantScopedData`, `TENANT_SCOPED_DELETE_ORDER`), iar protecțiile sunt în `src/lib/auth/protected-account.ts` (superadmini + `DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS`).
- Bonurile (promptul 12) stau în bucketul privat `bonuri`, la calea `{tenant_id}/{cheltuieli|investitii}/{client_sync_id}.jpg` (`src/lib/bonuri/index.ts`). Azi nimeni nu le șterge când dispare ferma.
- Verificarea zilnică (`src/lib/notifications/zilnice/server.ts`) sare peste demo-uri, dar **nu** și peste conturile de test automate `@example.test` (~25 de ferme).
- **E singurul loc din aplicație care șterge ferme în producție.** Greșeala aici înseamnă date reale pierdute. Tot promptul e construit în jurul acestui risc.

## Ce faci

1. **Regula „ce demo se șterge”, într-o funcție pură, cu teste** (de ex. `src/lib/tenant/demo-cleanup.ts`, `selecteazaDemoDeSters(tenanti, emailuri, acum)`):
   - o fermă intră **doar dacă** emailul proprietarului (din `auth.users`, comparat fără majuscule și fără spații) se termină în `@demo.zmeurel.local` **și** `tenants.created_at` e mai vechi de 24 h;
   - `is_demo` / `expires_at` nu mai decid nimic. O fermă cu `is_demo = true`, dar cu proprietar cu email real, **nu** se șterge;
   - nu intră niciodată: ferme fără proprietar, ferme al căror proprietar nu are email, proprietari superadmin, proprietari din `DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS`, ferme de asociație (verifici cum se marchează în schemă și le excluzi explicit);
   - teste pentru fiecare caz de mai sus, inclusiv: email `…@Demo.Zmeurel.Local ` (cu majuscule și spațiu), demo de 23 h, `@example.test` (nu se șterge prin acest cron), email real cu `is_demo = true`.
2. **Modul de probă, implicit.** Variabila de mediu `DEMO_CLEANUP_MODE`:
   - lipsă sau orice altă valoare decât `sterge` → **doar numără**: nu șterge nimic, întoarce JSON cu `mod: "proba"`, câte ferme ar fi șterse, câte fișiere din `bonuri` și primele 20 de emailuri demo din listă (sunt emailuri generate, nu date personale);
   - `sterge` → șterge efectiv.
   - Andrei citește proba din jurnalele Vercel după primul 04:00 și abia apoi se pune `sterge`. Nu setezi variabila nicăieri, doar o documentezi.
3. **Plase de siguranță în modul `sterge`:**
   - maximum **50 de ferme pe rulare** (restul rămân pentru noaptea următoare);
   - înainte de fiecare ștergere, **reverifici** emailul proprietarului pentru ferma respectivă (nu te bazezi doar pe lista citită la început);
   - dacă la o fermă selectată apare **orice** semn de fermă reală, te oprești cu eroare pentru toată rularea, fără să mai ștergi nimic: de ex. mai mult de un membru în `profiles` cu acel `tenant_id` și email non-demo. Regula exactă o alegi după schemă și o scrii în raport;
   - o fermă care dă eroare la ștergere nu oprește restul (cu excepția regulii de mai sus); o raportezi prin `captureApiError`.
4. **Ce se șterge pentru o fermă demo, complet:**
   - inventariezi cu `select` toate tabelele din `public` care au `tenant_id` și le compari cu `TENANT_SCOPED_DELETE_ORDER`. Pentru fiecare tabel lipsă verifici dacă cheia străină spre `tenants` are `ON DELETE CASCADE`. Ce nu se șterge în cascadă și lipsește din listă (de ex. `tenant_settings`, `notificari_preferinte`, dacă e cazul) se adaugă, în ordinea corectă a cheilor;
   - la fel pentru datele legate de utilizator (`profiles`, `notifications`, abonamentele de push, `ai_conversations`): verifici că pleacă la `auth.admin.deleteUser` (cascadă) sau le ștergi explicit, doar pentru proprietarul demo;
   - fișierele din `bonuri/{tenant_id}/…` se șterg prin Storage API (`list` + `remove`), **doar** sub prefixul fermei șterse. Un prefix gol sau fără `tenant_id` valid = nu ștergi nimic;
   - ordinea: fișiere → date → rândul din `tenants` → utilizatorul din `auth`.
   - Atenție: `deleteTenantScopedData` e folosit și de resetarea fermei și de ștergerea GDPR. Orice tabel adăugat în listă trebuie să fie corect și pentru acele două căi; dacă nu e, îl ștergi doar în cronul de demo și explici.
5. **Verificarea zilnică fără conturile de test:** în `src/lib/notifications/zilnice/ferme.ts` faci `esteFermaReala(tenant, ownerEmail)` = nu e demo și nu e `@example.test`, o folosești în `server.ts` și adaugi testul. Nu schimbi nimic altceva în notificări.
6. **Testele existente:** actualizezi `src/app/api/cron/__tests__/demo-tenant-cleanup.route.test.ts` (cu client mock): proba nu apelează niciun `delete`/`remove`/`deleteUser`; limita de 50; oprirea la semn de fermă reală; reverificarea emailului; protecțiile.
7. **Documentație:** actualizezi `CLAUDE.md` (secțiunea Cron Jobs: regula nouă și `DEMO_CLEANUP_MODE`) și `docs/KNOWN_RISKS.md`, dacă pomenește cronul.

## Ce NU faci

- **Nu apelezi ruta în producție și nu rulezi local nicio ștergere** pe baza de producție (mediul local folosește baza de PRODUCȚIE). Ștergerea se testează doar cu mock-uri.
- Din baza de date doar citești (`select`), ca să numeri și să inventariezi.
- Nu atingi `public/sw.js`. Nu slăbești `.claude/settings.json`.
- Nu e nevoie de migrare. Dacă ajungi la concluzia că îți trebuie una (de ex. o cheie străină fără cascadă), te oprești și o explici în raport, fără s-o scrii.

## Raportul

- ce ai schimbat, pe fișiere;
- **numărătoarea reală, din `select`:** câte ferme ar intra acum în ștergere, câte sunt protejate și de ce, câte fișiere din `bonuri` ar pleca;
- inventarul tabelelor cu `tenant_id`: în listă / cascadă / adăugate;
- regula exactă pentru „semn de fermă reală”;
- ce n-ai putut testa;
- verificările: lint, typecheck, check:kit, test:critical:unit, build;
- hash-ul commitului.

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
