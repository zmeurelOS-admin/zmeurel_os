#!/usr/bin/env bash
set -euo pipefail

OUT="zmeurel-audit-$(date +%Y%m%d-%H%M%S).zip"

paths=(
  "src"
  "supabase"
  "docs"
  "AGENTS.md"
  "package.json"
  "package-lock.json"
  "pnpm-lock.yaml"
  "yarn.lock"
  "tsconfig.json"
  "next.config.js"
  "next.config.mjs"
  "next.config.ts"
  "tailwind.config.js"
  "tailwind.config.ts"
  "postcss.config.js"
  "postcss.config.mjs"
  "eslint.config.js"
  "eslint.config.mjs"
  ".eslintrc.json"
  "components.json"
  "middleware.ts"
  "src/middleware.ts"
)

existing=()
for p in "${paths[@]}"; do
  [ -e "$p" ] && existing+=("$p")
done

tar \
  --exclude="*/node_modules/*" \
  --exclude="*/.next/*" \
  --exclude="*/.git/*" \
  --exclude="*/dist/*" \
  --exclude="*/build/*" \
  --exclude="*/coverage/*" \
  --exclude="*/.turbo/*" \
  --exclude="*/.vercel/*" \
  --exclude="*/.cache/*" \
  --exclude="*/tmp/*" \
  --exclude="*/temp/*" \
  --exclude="*/Thumbs.db" \
  --exclude="*.log" \
  --exclude=".env" \
  --exclude=".env.*" \
  --exclude="supabase/.temp/*" \
  -a -c -f "$OUT" "${existing[@]}"

echo "Creat: $OUT"
ls -lh "$OUT"

echo
echo "Verificare rapidă pentru fișiere excluse:"
tar -tf "$OUT" | grep -E '(^|/)\.env($|\.|/)|(^|/)node_modules/|(^|/)\.next/|(^|/)\.git/|(^|/)supabase/\.temp/' || true
