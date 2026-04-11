import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.yml',
  '.yaml',
  '.sql',
  '.env',
])

const EXCLUDED_PATH_PATTERNS = [
  /^\.git\//,
  /^\.next\//,
  /^coverage\//,
  /^dist\//,
  /^node_modules\//,
  /^docs\//,
  /^e2e\//,
  /^tests\//,
  /^src\/test\//,
  /\/__tests__\//,
  /^supabase\/migrations_archive\//,
  /^supabase\/\.temp\//,
  /^package-lock\.json$/,
  /^CLAUDE\.md$/,
  /^PROGRES\.md$/,
  /^PROGRESS\.md$/,
  /^BACKUP-INSTRUCTIONS\.md$/,
  /^\.env(?:\.[^.]+)?\.example$/,
]

const EMAIL_LITERAL_PATH_PATTERNS = [
  /^\.github\/workflows\//,
  /^scripts\//,
  /^src\/app\/api\//,
  /^src\/lib\//,
  /^src\/proxy\.ts$/,
  /^supabase\/functions\//,
  /^supabase\/migrations\//,
  /^next\.config\./,
]

const CLIENT_PATH_PATTERNS = [/^src\/components\//, /^src\/hooks\//, /^public\//]

const ALLOWED_EMAIL_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'example.test',
  'demo.zmeurel.local',
  'localhost',
  'local.test',
  'test.local',
  'invalid',
])
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.ro',
  'icloud.com',
  'me.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'protonmail.com',
  'proton.me',
])

const SERVER_ONLY_ENV_NAMES = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'VAPID_PRIVATE_KEY',
  'RESEND_API_KEY',
  'SHOP_ORDER_NOTIFY_RESEND_API_KEY',
  'DESTRUCTIVE_ACTION_STEP_UP_SECRET',
  'GOOGLE_TOKENS_ENCRYPTION_KEY',
]

const EMAIL_LITERAL_REGEX = /(['"`])([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\1/gi
const QUOTED_STRING_REGEX = /(['"`])([^'"`]+)\1/g
const KNOWN_SECRET_LITERAL_REGEX = /(['"`])(?:sk-[A-Za-z0-9]{16,}|sk_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z\-_]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|AKIA[0-9A-Z]{16})\1/g
const BEARER_LITERAL_REGEX = /(['"`])Bearer\s+[A-Za-z0-9._\-]{20,}\1/g
const DIRECT_EMAIL_COMPARISON_PATTERNS = [
  /\.eq\(\s*['"`](email|user_email|owner_email|connected_email)['"`]\s*,\s*(['"`])([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\2\s*\)/gi,
  /\b(email|user_email|owner_email|connected_email)\b[^\n]{0,80}?(?:===|==|!==|!=|=|ilike|like)\s*(['"`])([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\2/gi,
  /\b(?:where|and|or)\b[^\n]{0,80}\b(email|user_email|owner_email|connected_email)\b[^\n]{0,30}=\s*'([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})'/gi,
]
const INLINE_EMAIL_ALLOWLIST_REGEX = /\b(?:allowedEmails|protectedEmails|adminEmails|superadminEmails|ownerEmails)\b[\s\S]{0,120}?(?:=|:)\s*(?:new Set\s*\(\s*)?\[([\s\S]{0,240}?)\]/gi
const INLINE_ID_ALLOWLIST_REGEX = /\b(?:allowedUserIds|protectedUserIds|privilegedUserIds|adminUserIds|superadminUserIds|ownerUserIds)\b[\s\S]{0,120}?(?:=|:)\s*(?:new Set\s*\(\s*)?\[([\s\S]{0,240}?)\]/gi
const GENERIC_SECRET_ASSIGNMENT_REGEX = /\b(?:apiKey|api_key|secret|token|clientSecret|client_secret|accessToken|access_token|refreshToken|refresh_token|authorization)\b[^\n]{0,40}?(?:=|:)\s*(['"`])([^'"`\n]{16,})\1/gi
const ENV_SECRET_ASSIGNMENT_REGEX = /\b([A-Z0-9_]*(?:TOKEN|SECRET|API_KEY|PRIVATE_KEY|SERVICE_ROLE_KEY))\b\s*[:=]\s*(['"]?)([^'"\s$][A-Za-z0-9._\-\/+=]{16,})\2/g
const PUBLIC_SECRET_ENV_PATTERNS = [
  /\bprocess\.env\.(NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE|SERVICE_ROLE)[A-Z0-9_]*)\b/g,
  /\bimport\.meta\.env\.(NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE|SERVICE_ROLE)[A-Z0-9_]*)\b/g,
  /\b(NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PRIVATE|SERVICE_ROLE)[A-Z0-9_]*)\b\s*=/g,
]
const UUID_LITERAL_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PLACEHOLDER_SECRET_REGEX = /^(?:test(?:[-_ ]?key)?|dummy(?:[-_ ]?key)?|placeholder|example(?:[-_].*)?|your[-_a-z]*key(?:[-_a-z]*)?|changeme|replace(?:me|_me)?|fake(?:[-_].*)?)$/i

function normalizePath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '')
}

function isExcludedPath(filePath) {
  return EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(filePath))
}

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function isRelevantFilePath(filePath) {
  return isTextFile(filePath) && !isExcludedPath(filePath)
}

function isSensitiveEmailPath(filePath) {
  return EMAIL_LITERAL_PATH_PATTERNS.some((pattern) => pattern.test(filePath))
}

function isClientFacingFile(filePath, content) {
  if (CLIENT_PATH_PATTERNS.some((pattern) => pattern.test(filePath))) return true
  if (/^src\/app\/.+\.(?:ts|tsx|js|jsx)$/.test(filePath) && !/\/api\//.test(filePath)) {
    return /^['"]use client['"];?/m.test(content)
  }
  return /^['"]use client['"];?/m.test(content)
}

function isAllowedEmailLiteral(email) {
  const normalized = email.trim().toLowerCase()
  const [, domain = ''] = normalized.split('@')
  return ALLOWED_EMAIL_DOMAINS.has(domain)
}

function isPersonalEmailLiteral(email) {
  const normalized = email.trim().toLowerCase()
  const [, domain = ''] = normalized.split('@')
  return PERSONAL_EMAIL_DOMAINS.has(domain)
}

function isPlaceholderSecret(value) {
  return PLACEHOLDER_SECRET_REGEX.test(value.trim())
}

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length
}

function getLinePreview(content, index) {
  const start = content.lastIndexOf('\n', index)
  const end = content.indexOf('\n', index)
  return content.slice(start === -1 ? 0 : start + 1, end === -1 ? content.length : end).trim()
}

function pushFinding(findings, seen, filePath, content, index, rule, message) {
  const line = getLineNumber(content, index)
  const preview = getLinePreview(content, index)
  const key = `${filePath}:${line}:${rule}:${preview}`
  if (seen.has(key)) return
  seen.add(key)
  findings.push({
    filePath,
    line,
    rule,
    message,
    preview,
  })
}

function extractQuotedLiterals(block) {
  const values = []
  for (const match of block.matchAll(QUOTED_STRING_REGEX)) {
    values.push(match[2])
  }
  return values
}

export function scanFileContent({ filePath, content }) {
  const normalizedPath = normalizePath(filePath)
  const findings = []
  const seen = new Set()

  for (const pattern of DIRECT_EMAIL_COMPARISON_PATTERNS) {
    for (const match of content.matchAll(pattern)) {
      const email = match.at(-1) ?? ''
      if (!email || isAllowedEmailLiteral(email)) continue
      pushFinding(
        findings,
        seen,
        normalizedPath,
        content,
        match.index ?? 0,
        'hardcoded-email-check',
        'Comparație directă pe email cu valoare hardcodată. Mută regula pe rol/user_id/env config, nu pe adrese email literale.',
      )
    }
  }

  for (const match of content.matchAll(INLINE_EMAIL_ALLOWLIST_REGEX)) {
    const block = match[1] ?? ''
    const emails = extractQuotedLiterals(block).filter((value) => /@/.test(value) && !isAllowedEmailLiteral(value))
    if (emails.length === 0) continue
    pushFinding(
      findings,
      seen,
      normalizedPath,
      content,
      match.index ?? 0,
      'inline-email-allowlist',
      'Allowlist de emailuri literală detectată. Mută lista în env/config și evită reguli sensibile bazate pe email hardcodat.',
    )
  }

  for (const match of content.matchAll(INLINE_ID_ALLOWLIST_REGEX)) {
    const block = match[1] ?? ''
    const values = extractQuotedLiterals(block).filter((value) => UUID_LITERAL_REGEX.test(value) || value.trim().length >= 6)
    if (values.length === 0) continue
    pushFinding(
      findings,
      seen,
      normalizedPath,
      content,
      match.index ?? 0,
      'inline-id-allowlist',
      'Allowlist de user IDs literală detectată. Mută valorile în env/config (ex. *_PROTECTED_USER_IDS), nu în cod.',
    )
  }

  if (isSensitiveEmailPath(normalizedPath)) {
    for (const match of content.matchAll(EMAIL_LITERAL_REGEX)) {
      const email = match[2] ?? ''
      if (!email || isAllowedEmailLiteral(email)) continue
      if (!isPersonalEmailLiteral(email)) continue
      pushFinding(
        findings,
        seen,
        normalizedPath,
        content,
        match.index ?? 0,
        'hardcoded-personal-email',
        'Email literal detectat într-o zonă sensibilă a codului/configului. Mută-l în env/config sau înlocuiește-l cu rol/user_id.',
      )
    }
  }

  for (const match of content.matchAll(KNOWN_SECRET_LITERAL_REGEX)) {
    pushFinding(
      findings,
      seen,
      normalizedPath,
      content,
      match.index ?? 0,
      'hardcoded-secret',
      'Secret/API key literal detectat. Mută valoarea în env sau GitHub/Vercel secrets.',
    )
  }

  for (const match of content.matchAll(BEARER_LITERAL_REGEX)) {
    pushFinding(
      findings,
      seen,
      normalizedPath,
      content,
      match.index ?? 0,
      'hardcoded-bearer-token',
      'Bearer token literal detectat. Mută tokenul în env/secrets și injectează-l doar la runtime.',
    )
  }

  for (const match of content.matchAll(GENERIC_SECRET_ASSIGNMENT_REGEX)) {
    const value = match[2] ?? ''
    if (isPlaceholderSecret(value)) continue
    if (value.includes('${')) continue
    pushFinding(
      findings,
      seen,
      normalizedPath,
      content,
      match.index ?? 0,
      'literal-secret-assignment',
      'Atribuire literală pentru token/secret/apiKey detectată. Folosește process.env sau provider secrets, nu string-uri în cod.',
    )
  }

  for (const match of content.matchAll(ENV_SECRET_ASSIGNMENT_REGEX)) {
    const value = match[3] ?? ''
    if (isPlaceholderSecret(value)) continue
    pushFinding(
      findings,
      seen,
      normalizedPath,
      content,
      match.index ?? 0,
      'literal-env-secret',
      'Variabilă de tip secret/token configurată cu valoare literală. Folosește env real sau GitHub secrets, nu valori hardcodate.',
    )
  }

  for (const pattern of PUBLIC_SECRET_ENV_PATTERNS) {
    for (const match of content.matchAll(pattern)) {
      pushFinding(
        findings,
        seen,
        normalizedPath,
        content,
        match.index ?? 0,
        'public-secret-env-name',
        'Nume de env public cu SECRET/PRIVATE/SERVICE_ROLE detectat. Secretele nu trebuie expuse prin prefixul NEXT_PUBLIC_.',
      )
    }
  }

  if (isClientFacingFile(normalizedPath, content)) {
    for (const envName of SERVER_ONLY_ENV_NAMES) {
      const regex = new RegExp(`\\b${envName}\\b`, 'g')
      for (const match of content.matchAll(regex)) {
        pushFinding(
          findings,
          seen,
          normalizedPath,
          content,
          match.index ?? 0,
          'server-secret-in-client',
          `Variabila server-only ${envName} este referită din cod client/public. Mută accesul într-un modul server/API route.`,
        )
      }
    }
  }

  return findings.sort((a, b) => a.filePath.localeCompare(b.filePath) || a.line - b.line)
}

function runGit(rootDir, args) {
  try {
    return execFileSync('git', args, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return ''
  }
}

function splitLines(output) {
  return output
    .split(/\r?\n/)
    .map((line) => normalizePath(line.trim()))
    .filter(Boolean)
}

function unique(values) {
  return [...new Set(values)]
}

function resolveChangedFiles(rootDir) {
  const fromBaseSha = (process.env.SENSITIVE_GUARD_BASE_SHA ?? '').trim()
  if (fromBaseSha && !/^0+$/.test(fromBaseSha)) {
    const diff = runGit(rootDir, ['diff', '--name-only', '--diff-filter=ACMRTUXB', `${fromBaseSha}...HEAD`])
    if (diff) return unique(splitLines(diff))
  }

  const baseRef = (process.env.GITHUB_BASE_REF ?? '').trim()
  if (baseRef) {
    const mergeBase =
      runGit(rootDir, ['merge-base', 'HEAD', `origin/${baseRef}`]) ||
      runGit(rootDir, ['merge-base', 'HEAD', `refs/remotes/origin/${baseRef}`])
    if (mergeBase) {
      const diff = runGit(rootDir, ['diff', '--name-only', '--diff-filter=ACMRTUXB', `${mergeBase}...HEAD`])
      if (diff) return unique(splitLines(diff))
    }
  }

  const staged = splitLines(runGit(rootDir, ['diff', '--cached', '--name-only', '--diff-filter=ACMRTUXB']))
  const unstaged = splitLines(runGit(rootDir, ['diff', '--name-only', '--diff-filter=ACMRTUXB']))
  const untracked = splitLines(runGit(rootDir, ['ls-files', '--others', '--exclude-standard']))

  return unique([...staged, ...unstaged, ...untracked])
}

function resolveAllFiles(rootDir) {
  const tracked = splitLines(runGit(rootDir, ['ls-files']))
  const untracked = splitLines(runGit(rootDir, ['ls-files', '--others', '--exclude-standard']))
  return unique([...tracked, ...untracked])
}

export async function runSensitiveHardcodingGuard(options = {}) {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  const rootDir = options.rootDir ? path.resolve(options.rootDir) : path.resolve(moduleDir, '..')
  const scanAll = options.scanAll === true
  const requestedFiles = Array.isArray(options.files) ? options.files.map((value) => normalizePath(value)) : null
  const candidateFiles = requestedFiles ?? (scanAll ? resolveAllFiles(rootDir) : resolveChangedFiles(rootDir))
  const filesToScan = candidateFiles.filter((filePath) => isRelevantFilePath(filePath))
  const findings = []

  for (const relativeFilePath of filesToScan) {
    const absoluteFilePath = path.join(rootDir, relativeFilePath)
    try {
      const stat = await fs.stat(absoluteFilePath)
      if (!stat.isFile() || stat.size > 1024 * 1024) continue
      const content = await fs.readFile(absoluteFilePath, 'utf8')
      findings.push(...scanFileContent({ filePath: relativeFilePath, content }))
    } catch {
      continue
    }
  }

  return {
    rootDir,
    scannedFiles: filesToScan,
    findings,
  }
}
