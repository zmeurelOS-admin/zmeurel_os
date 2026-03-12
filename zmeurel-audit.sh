#!/usr/bin/env bash
set -eu
REPORT="audit-report.md"
SCORE=100
CRITICAL=0; HIGH=0; MEDIUM=0; LOW=0

ok(){ echo "? $1" | tee -a "$REPORT" >/dev/null; }
warn(){ echo "?? $1" | tee -a "$REPORT" >/dev/null; }
fail(){ sev="$1"; msg="$2"; d="$3"; echo "? [$sev] $msg (-$d)" | tee -a "$REPORT" >/dev/null; SCORE=$((SCORE-d)); case "$sev" in CRITICAL) CRITICAL=$((CRITICAL+1));; HIGH) HIGH=$((HIGH+1));; MEDIUM) MEDIUM=$((MEDIUM+1));; LOW) LOW=$((LOW+1));; esac; }
sec(){ echo -e "\n## $1\n" | tee -a "$REPORT" >/dev/null; }

cat > "$REPORT" <<EOF
# Zmeurel OS Audit Report

Generated: $(date '+%Y-%m-%d %H:%M:%S')
EOF

sec "0. Preflight"
[ -f package.json ] && ok "package.json found" || { echo "Run from repo root"; exit 1; }
[ -f next.config.js ] || [ -f next.config.mjs ] || [ -f next.config.ts ] && ok "Next config found" || fail HIGH "Missing next.config" 5
[ -d src ] && SRC_DIR="src" || SRC_DIR="."
ok "Source dir: $SRC_DIR"

sec "1. PWA"
MANIFESTS=$(find . -name 'manifest*' -not -path '*/node_modules/*' -not -path '*/.next/*' 2>/dev/null || true)
if [ -n "$MANIFESTS" ]; then
  ok "Manifest present"
  echo "$MANIFESTS" | while read -r mf; do
    grep -q '"display"[[:space:]]*:[[:space:]]*"standalone"' "$mf" 2>/dev/null && ok "$mf display standalone" || warn "$mf display not standalone"
    IC=$(grep -c '"src"' "$mf" 2>/dev/null || true)
    IC=$(echo "$IC" | tail -n1 | tr -cd '0-9')
    [ -z "$IC" ] && IC=0
    [ "$IC" -ge 2 ] && ok "$mf has >=2 icons" || fail HIGH "$mf has <2 icons" 5
  done
else
  fail CRITICAL "Missing manifest" 10
fi
SW=$(find public . -name 'sw.js' -o -name 'service-worker*' 2>/dev/null | grep -v node_modules | head -5 || true)
[ -n "$SW" ] && ok "Service worker found" || fail HIGH "Service worker not found" 5
PROXY=$(find "$SRC_DIR" -name 'middleware.*' -o -name 'proxy.*' 2>/dev/null | head -5 || true)
if [ -n "$PROXY" ]; then
  for p in $PROXY; do
    if grep -q '/login' "$p" 2>/dev/null && ! grep -q 'manifest\|sw\.js' "$p" 2>/dev/null; then
      fail CRITICAL "$p may block manifest/sw.js" 15
    else
      ok "$p checked"
    fi
  done
fi

grep -q 'next-pwa\|@serwist\|workbox' package.json && ok "PWA lib present" || warn "No PWA lib detected"

sec "2. Supabase & RLS"
if [ -d "./supabase/migrations" ]; then
  MIG="./supabase/migrations"
else
  MIG=$(find . -path '*/migrations' -type d -not -path '*/node_modules/*' -not -path '*/.codex-tmp/*' | head -1 || true)
fi
if [ -n "$MIG" ]; then
  ok "Migrations dir: $MIG"
  RLS=$(grep -rl 'ENABLE ROW LEVEL SECURITY\|CREATE POLICY' "$MIG" 2>/dev/null | wc -l | tr -d ' ' || true)
  [ "$RLS" -gt 0 ] && ok "RLS/policies detected in migrations" || fail CRITICAL "No RLS policy markers in migrations" 15
else
  fail HIGH "Migrations dir missing" 5
fi
SR=$(grep -rn 'SUPABASE_SERVICE_ROLE\|service_role' "$SRC_DIR" --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v 'admin\|api\|server\|cron' || true)
[ -z "$SR" ] && ok "No client-side service role exposure detected" || fail CRITICAL "Possible service role exposure" 20
OWN=$(grep -rn 'owner_user_id' "$SRC_DIR" --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')
MEM=$(grep -rn 'membership\|member' "$SRC_DIR" --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')
if [ "$OWN" -gt 5 ] && [ "$MEM" -eq 0 ]; then fail MEDIUM "Owner-centric tenancy without membership refs" 5; else ok "Tenancy refs checked"; fi

sec "3. Security"
[ -f .gitignore ] && grep -q '\.env' .gitignore && ok ".env ignored" || fail HIGH ".env not ignored" 5
SECRETS=$(grep -rn 'sk_live\|pk_live\|SUPABASE_.*KEY.*=.*eyJ\|sk-' "$SRC_DIR" --include='*.ts' --include='*.tsx' --include='*.js' 2>/dev/null | head -5 || true)
[ -z "$SECRETS" ] && ok "No obvious hardcoded secrets" || fail CRITICAL "Possible hardcoded secrets" 15
CALLBACK=$(find "$SRC_DIR" -path '*callback*' -name '*.ts' -o -path '*callback*' -name '*.tsx' 2>/dev/null | head -5 || true)
[ -n "$CALLBACK" ] && ok "Auth callback present" || warn "Auth callback not found"

sec "4. React Query"
grep -q '@tanstack/react-query' package.json && ok "React Query present" || warn "React Query missing"
MUT=$(grep -rn 'useMutation' "$SRC_DIR" --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')
INV=$(grep -rn 'invalidateQueries\|invalidate(' "$SRC_DIR" --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')
[ "$INV" -lt "$MUT" ] && fail MEDIUM "Mutations ($MUT) exceed invalidations ($INV)" 3 || ok "Mutation/invalidation ratio acceptable"

sec "5. Navigation"
NAV=$(find "$SRC_DIR" -iname '*nav*' -o -iname '*sidebar*' -o -iname '*drawer*' -o -iname '*tab*bar*' 2>/dev/null | grep -E '\.(ts|tsx)$' | wc -l | tr -d ' ')
[ "$NAV" -gt 1 ] && fail LOW "Multiple nav files ($NAV), risk of duplication" 2 || ok "Navigation structure compact"

sec "6. Dead Code"
EXTLESS=$(find "$SRC_DIR" -type f -not -name '*.*' -not -path '*/node_modules/*' -not -path '*/.next/*' 2>/dev/null | wc -l | tr -d ' ')
[ "$EXTLESS" -gt 0 ] && fail LOW "Extensionless files found ($EXTLESS)" 1 || ok "No extensionless files"
UNT=$(find "$SRC_DIR" -iname '*untitled*' 2>/dev/null | wc -l | tr -d ' ')
[ "$UNT" -gt 0 ] && fail LOW "Untitled files found ($UNT)" 1 || ok "No untitled files"
CON=$(grep -rn 'console\.\(error\|warn\|log\)' "$SRC_DIR" --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')
[ "$CON" -gt 30 ] && fail LOW "High console usage ($CON)" 2 || warn "Console statements: $CON"

sec "7. Build & Tooling"
[ -f package-lock.json ] || [ -f yarn.lock ] || [ -f pnpm-lock.yaml ] || [ -f bun.lockb ] && ok "Lockfile present" || fail MEDIUM "No lockfile" 3
grep -q '"strict"[[:space:]]*:[[:space:]]*true' tsconfig.json 2>/dev/null && ok "TS strict true" || warn "TS strict not true"

sec "8. Integrations"
GC=$(grep -rli 'people.googleapis.com\|contacts.readonly\|googleContacts' "$SRC_DIR" --include='*.ts' --include='*.tsx' 2>/dev/null | wc -l | tr -d ' ')
[ "$GC" -gt 0 ] && warn "Google contacts traces found ($GC)" || ok "No Google contacts traces"

sec "9. Tests"
TF=$(find "$SRC_DIR" -name '*.test.*' -o -name '*.spec.*' 2>/dev/null | wc -l | tr -d ' ')
[ "$TF" -gt 0 ] && ok "Tests found: $TF" || warn "No tests found"

[ "$SCORE" -lt 0 ] && SCORE=0
SCORE10=$(awk "BEGIN { printf \"%.1f\", $SCORE/10 }")

cat >> "$REPORT" <<EOF

---
## Final Score: $SCORE10 / 10

| Severity | Count |
|---|---:|
| CRITICAL | $CRITICAL |
| HIGH | $HIGH |
| MEDIUM | $MEDIUM |
| LOW | $LOW |

EOF

echo "Final score: $SCORE10/10"
echo "CRITICAL=$CRITICAL HIGH=$HIGH MEDIUM=$MEDIUM LOW=$LOW"
echo "Report: $REPORT"
