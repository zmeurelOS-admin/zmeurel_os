# Prompt 10 — Corecturi după merge: tipurile regenerate + localizarea permisă

Model: Opus 5.5 · Effort: medium · Mod: normal (fără plan) · Sesiune: NOUĂ · Branch: `redesign/corecturi-1` (pornit din `main` `ac3d3bd`) · Rezultat: branch verde, cu push, fără merge

## Context

- Cele 5 module din noaptea de 19→20.11 sunt în `main` (`ac3d3bd`), iar producția e READY.
- Ambele migrări sunt aplicate în producție, verificate prin citire și într-un cont demo: `20261120090000_redesign_noapte`, `20261120100000_tenant_settings_rls`. Prețul standard se salvează.
- Pe branch există deja un commit cu `src/types/supabase.ts` **regenerat din producție** (Supabase MCP). Față de varianta scrisă de mână se schimbă:
  - `comenzi.prioritara: boolean` (nu mai e nullable);
  - `tenant_settings.acasa_perioada_mod: string` și `extrasezon_intrebare_din: string` (nu mai sunt nullable);
  - apare RPC-ul `deliver_and_clone_comanda`.

## Ce faci

1. **Tipurile:** `npm run typecheck` cu fișierul regenerat. Repari erorile apărute din nullability, fără `as any` și fără `!` ca să ascunzi probleme. Nu modifici `src/types/supabase.ts` de mână.
2. **Localizarea e blocată în tot site-ul.**
   - `src/lib/security/http-headers.js` trimite `Permissions-Policy: camera=(), microphone=(self), geolocation=()`. `geolocation=()` interzice `navigator.geolocation` pe orice pagină, deci în Livrări nu se pot salva locațiile clienților (`src/lib/livrari/device.ts`) și traseul nu poate porni de la poziția curentă.
   - Schimbi în `geolocation=(self)` (doar originea proprie, fără iframe-uri străine) și actualizezi testul din `src/lib/security/__tests__/http-headers.test.ts`.
   - Cauți și alte locuri unde e setat `Permissions-Policy` (`next.config.*`, `vercel.json`, `src/proxy.ts`).
   - Verifici că `device.ts` arată un mesaj clar când utilizatorul refuză permisiunea sau localizarea nu e disponibilă, nu o eroare tehnică.
3. **`schema-features.ts`:** cu migrările aplicate, verificările de coloane găsesc totul. Lași mecanismul cum e: tenanții noi și demo-urile trec prin aceeași cale. Notezi în raport că cele 5 cereri de verificare pe sesiune pot fi scoase mai târziu, după ce rămânem stabil.
4. Raportul: în `docs/redesign/raport-noapte.md`, o secțiune 9, „După merge (20.11)”, cu ce s-a schimbat.
5. Verificări: `npm run lint` (doar cele 2 erori vechi), `npm run typecheck`, `npm run check:kit`, `npm run test:critical:unit`, `npm run build`. Apoi `git restore public/sw.js`, commit, `git push origin redesign/corecturi-1`. **STOP. Fără merge.**

NEVER delete, truncate, or modify any user data in the database. Do not run DELETE, UPDATE, or TRUNCATE on production data tables. Do not reset or seed over existing data.
