import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const ENV_SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const ENV_SCAN_EXCLUDED_DIRS = new Set(['.git', '.next', 'node_modules', 'coverage', 'dist', 'docs', 'tests', 'e2e'])
const ENV_SCAN_EXCLUDED_SEGMENTS = new Set(['__tests__', 'test-results', 'playwright-report'])
const AUTO_PROVIDED_ENV_KEYS = new Set([
  'NODE_ENV',
  'NEXT_RUNTIME',
  'VERCEL_ENV',
  'NEXT_PUBLIC_VERCEL_ENV',
  'VERCEL_GIT_COMMIT_SHA',
  'NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_DB_URL',
])
const NON_INVENTORY_ENV_KEYS = new Set([
  'CI',
  'VERCEL',
  'GITHUB_BASE_REF',
  'SENSITIVE_GUARD_BASE_SHA',
  'DEBUG_DB_TARGET_USER_ID',
])
const NON_INVENTORY_ENV_PREFIXES = ['LOAD_TEST_', 'PLAYWRIGHT_']

const REQUIRED_PATHS = [
  'BACKUP-INSTRUCTIONS.md',
  'AGENTS.md',
  '.env.local.example',
  'package.json',
  'vercel.json',
  'scripts/check-env.js',
  'supabase/migrations',
  'supabase/functions',
]

const REQUIRED_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SITE_URL',
  'APP_BASE_URL',
  'CRON_SECRET',
  'DESTRUCTIVE_ACTION_STEP_UP_SECRET',
  'GOOGLE_TOKENS_ENCRYPTION_KEY',
  'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'AI_GEMINI_MODEL',
  'AI_GEMINI_SIMPLE_MODEL',
  'AI_CHAT_DAILY_LIMIT',
  'AI_CHAT_PRIVILEGED_USER_IDS',
  'AI_CHAT_PRIVILEGED_DAILY_LIMIT',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'SENTRY_AUTH_TOKEN',
  'NEXT_PUBLIC_SENTRY_DSN',
  'NEXT_PUBLIC_SENTRY_DASHBOARD_URL',
  'SHOP_ORDER_NOTIFY_FROM',
  'SHOP_ORDER_NOTIFY_EMAIL',
  'SHOP_ORDER_NOTIFY_RESEND_API_KEY',
  'RESEND_API_KEY',
  'ASSOCIATION_ALLOWED_OWNER_USER_IDS',
  'ASSOCIATION_ALLOWED_EMAILS',
  'ACCOUNT_DELETE_PROTECTED_USER_IDS',
  'DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS',
  'CLEANUP_DEMOS_PROTECTED_USER_IDS',
  'CLEANUP_BETA_PROTECTED_USER_IDS',
  'RESET_TEST_USERS_PROTECTED_USER_IDS',
  'OPENWEATHER_API_KEY',
  'OPENWEATHERMAP_API_KEY',
]

function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

async function pathExists(relativePath) {
  try {
    await fs.access(path.join(repoRoot, relativePath))
    return true
  } catch {
    return false
  }
}

async function listSqlFiles(relativeDir) {
  try {
    const entries = await fs.readdir(path.join(repoRoot, relativeDir), { withFileTypes: true })
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.sql')).map((entry) => entry.name)
  } catch {
    return []
  }
}

async function readText(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8')
}

async function collectEnvScanFiles(relativeDir = '') {
  const absoluteDir = path.join(repoRoot, relativeDir)
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.name.startsWith('.codex-')) continue

    const nextRelative = relativeDir ? path.posix.join(relativeDir.replace(/\\/g, '/'), entry.name) : entry.name

    if (entry.isDirectory()) {
      if (ENV_SCAN_EXCLUDED_DIRS.has(entry.name) || ENV_SCAN_EXCLUDED_SEGMENTS.has(entry.name)) {
        continue
      }
      files.push(...(await collectEnvScanFiles(nextRelative)))
      continue
    }

    if (!entry.isFile()) continue
    if (!ENV_SCAN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue
    if ([...ENV_SCAN_EXCLUDED_SEGMENTS].some((segment) => nextRelative.split('/').includes(segment))) continue
    files.push(nextRelative)
  }

  return files
}

function extractEnvKeys(content) {
  const keys = new Set()
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Z0-9_]+)=/)
    if (match) keys.add(match[1])
  }
  return keys
}

function extractStorageBuckets(sqlContent) {
  const buckets = new Set()
  const regex = /INSERT INTO storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\)[\s\S]*?VALUES\s*\(\s*'([^']+)'/gi
  for (const match of sqlContent.matchAll(regex)) {
    if (match[1]) buckets.add(match[1])
  }
  return buckets
}

function extractCronPaths(vercelJsonText) {
  try {
    const parsed = JSON.parse(vercelJsonText)
    return Array.isArray(parsed.crons) ? parsed.crons.map((item) => item.path).filter(Boolean) : []
  } catch {
    return []
  }
}

function extractReferencedEnvKeys(content) {
  const keys = new Set()
  const regexes = [
    /process\.env\.([A-Z0-9_]+)/g,
    /Deno\.env\.get\('([A-Z0-9_]+)'\)/g,
    /Deno\.env\.get\("([A-Z0-9_]+)"\)/g,
  ]

  for (const regex of regexes) {
    for (const match of content.matchAll(regex)) {
      const key = match[1]?.trim()
      if (!key || AUTO_PROVIDED_ENV_KEYS.has(key) || NON_INVENTORY_ENV_KEYS.has(key)) continue
      if (NON_INVENTORY_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) continue
      keys.add(key)
    }
  }

  return keys
}

function printSection(title, items) {
  console.log(`\n${title}`)
  for (const item of items) {
    console.log(`- ${item}`)
  }
}

const missingRequiredPaths = []
for (const relativePath of REQUIRED_PATHS) {
  if (!(await pathExists(relativePath))) {
    missingRequiredPaths.push(relativePath)
  }
}

const trackedFiles = new Set(runGit(['ls-files']).split(/\r?\n/).filter(Boolean))
const trackedReadinessFiles = ['BACKUP-INSTRUCTIONS.md', 'AGENTS.md', '.env.local.example', 'vercel.json']
const untrackedReadinessFiles = trackedReadinessFiles.filter((file) => !trackedFiles.has(file))

const migrationFiles = await listSqlFiles('supabase/migrations')
const envExampleText = (await pathExists('.env.local.example')) ? await readText('.env.local.example') : ''
const envKeys = extractEnvKeys(envExampleText)
const missingEnvKeys = REQUIRED_ENV_KEYS.filter((key) => !envKeys.has(key))
const envScanFiles = await collectEnvScanFiles()
const referencedEnvKeys = new Set()
for (const file of envScanFiles) {
  const content = await readText(file)
  for (const key of extractReferencedEnvKeys(content)) {
    referencedEnvKeys.add(key)
  }
}
const undocumentedReferencedEnvKeys = [...referencedEnvKeys].filter((key) => !envKeys.has(key)).sort()

const vercelJsonText = (await pathExists('vercel.json')) ? await readText('vercel.json') : ''
const cronPaths = extractCronPaths(vercelJsonText)

const migrationSql = await Promise.all(
  migrationFiles.map(async (file) => readText(path.join('supabase/migrations', file)))
)
const storageBuckets = [...new Set(migrationSql.flatMap((sql) => [...extractStorageBuckets(sql)]))].sort()

const warnings = []
if (!(await pathExists('supabase/config.toml'))) {
  warnings.push('Lipsește `supabase/config.toml`; restore-ul pe proiect nou depinde de Supabase Dashboard/CLI link manual, nu de config repo-local complet.')
}
if (cronPaths.length === 0) {
  warnings.push('`vercel.json` nu expune cron jobs configurate; verifică manual dacă joburile programate sunt încă necesare în Vercel.')
}
if (storageBuckets.length === 0) {
  warnings.push('Nu au fost detectate bucket-uri Storage din migrații; verifică manual dacă storage-ul critic este definit în altă parte.')
}
if (!envKeys.has('OPENWEATHER_API_KEY') && !envKeys.has('OPENWEATHERMAP_API_KEY')) {
  warnings.push('`.env.local.example` nu include cheia OpenWeather pentru Edge Functions; restore-ul meteo poate rămâne degradat până când secretul este setat în Supabase.')
}
warnings.push('Repo-ul nu conține un export automat pentru database dump sau storage export; backup-ul datelor reale rămâne provider/manual.')
warnings.push('Secretele runtime din Vercel și Supabase Edge Functions nu sunt backup-uite de repo; trebuie păstrate separat în secret manager / provider dashboards.')
for (const file of untrackedReadinessFiles) {
  warnings.push(`Fișierul ${file} există local, dar nu este încă urmărit în Git; comite-l pentru ca runbook-ul de restore să existe într-un clone curat.`)
}

if (missingRequiredPaths.length > 0 || missingEnvKeys.length > 0 || undocumentedReferencedEnvKeys.length > 0) {
  console.error('\n[backup-readiness] FAIL — lipsesc artefacte esențiale pentru un restore auditabil.')
  if (missingRequiredPaths.length > 0) {
    printSection('Artefacte lipsă', missingRequiredPaths)
  }
  if (missingEnvKeys.length > 0) {
    printSection('Chei lipsă din `.env.local.example`', missingEnvKeys)
  }
  if (undocumentedReferencedEnvKeys.length > 0) {
    printSection('Env-uri folosite în cod dar absente din `.env.local.example`', undocumentedReferencedEnvKeys)
  }
  process.exit(1)
}

console.log('[backup-readiness] OK — artefactele minime de backup/restore readiness există în repo.')
printSection('Migrations SQL detectate', [`${migrationFiles.length} fișier(e) active în supabase/migrations`])
printSection('Env-uri runtime detectate în cod și acoperite de inventory', [`${referencedEnvKeys.size} cheie(i) documentate în .env.local.example`])
printSection('Bucket-uri Storage detectate din migrații', storageBuckets)
printSection('Cron jobs declarate în vercel.json', cronPaths)
printSection('Avertismente operaționale rămase', warnings)
