# Zmeurel OS Audit Report

Generated: 2026-02-28 21:08:37

## 0. Preflight

? package.json found
? Next config found
? Source dir: src

## 1. PWA

? Manifest present
?? ./src/app/manifest.ts display not standalone
? [HIGH] ./src/app/manifest.ts has <2 icons (-5)
? Service worker found
? [CRITICAL] src/proxy.ts may block manifest/sw.js (-15)
? PWA lib present

## 2. Supabase & RLS

? Migrations dir: ./supabase/migrations
? [CRITICAL] No RLS policy markers in migrations (-15)
? No client-side service role exposure detected
? [MEDIUM] Owner-centric tenancy without membership refs (-5)

## 3. Security

? .env ignored
? No obvious hardcoded secrets
? Auth callback present

## 4. React Query

? React Query present
? Mutation/invalidation ratio acceptable

## 5. Navigation

? [LOW] Multiple nav files (9), risk of duplication (-2)

## 6. Dead Code

? [LOW] Extensionless files found (2) (-1)
? [LOW] Untitled files found (1) (-1)
? [LOW] High console usage (55) (-2)

## 7. Build & Tooling

? Lockfile present
? TS strict true

## 8. Integrations

?? Google contacts traces found (2)

## 9. Tests

? Tests found: 1

---
## Final Score: 5.9 / 10

| Severity | Count |
|---|---:|
| CRITICAL | 2 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 4 |

