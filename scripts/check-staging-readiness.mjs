import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const vercelBinary = process.platform === 'win32' ? 'vercel.cmd' : 'vercel'
const supabaseBinary = process.platform === 'win32' ? 'supabase.exe' : 'supabase'
const STAGING_PROJECT_NAME = 'zmeurelOS-staging'
const STAGING_PREVIEW_BRANCH = 'staging'

const MINIMAL_STAGING_PARITY_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'SITE_URL',
  'CRON_SECRET',
]

const TEST_DOMAINS = new Set([
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

function quoteWindowsArg(arg) {
  if (arg === '') return '""'
  if (!/[\s"]/u.test(arg)) return arg
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1')}"`
}

function runCli(command, args, allowFailure = false) {
  try {
    if (process.platform === 'win32') {
      const commandLine = [command, ...args].map(quoteWindowsArg).join(' ')
      return execFileSync('cmd.exe', ['/d', '/s', '/c', commandLine], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim()
    }

    return execFileSync(command, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    if (allowFailure) return ''
    const stdout = error.stdout?.toString().trim()
    const stderr = error.stderr?.toString().trim()
    throw new Error(stderr || stdout || error.message)
  }
}

function findJsonEnd(text, startIndex) {
  const opening = text[startIndex]
  const closing = opening === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === opening) {
      depth += 1
      continue
    }

    if (char === closing) {
      depth -= 1
      if (depth === 0) return index
    }
  }

  return -1
}

function extractJsonValue(rawText) {
  const trimmed = rawText.trim()
  if (!trimmed) {
    throw new Error('CLI-ul nu a returnat JSON.')
  }

  if (trimmed.startsWith('null')) {
    return null
  }

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index]
    if (char !== '{' && char !== '[') continue

    const endIndex = findJsonEnd(trimmed, index)
    if (endIndex === -1) continue

    try {
      return JSON.parse(trimmed.slice(index, endIndex + 1))
    } catch {
      continue
    }
  }

  throw new Error('Nu am putut extrage JSON din output-ul CLI.')
}

function printSection(title, items) {
  console.log(`\n${title}`)
  for (const item of items) {
    console.log(`- ${item}`)
  }
}

function toHttpsUrl(hostOrUrl = '') {
  const normalized = String(hostOrUrl).trim().replace(/^https?:\/\//u, '')
  return normalized ? `https://${normalized}` : ''
}

function normalizeVercelEnvKeys(entries) {
  return new Set(entries.filter((entry) => !entry.gitBranch).map((entry) => entry.key))
}

function normalizeBranchVercelEnvKeys(entries, branchName) {
  return new Set(entries.filter((entry) => entry.gitBranch === branchName).map((entry) => entry.key))
}

function summarizePreviewBranches(entries) {
  return [...new Set(entries.map((entry) => entry.gitBranch).filter(Boolean))].sort()
}

async function pathExists(relativePath) {
  try {
    await fs.access(path.join(repoRoot, relativePath))
    return true
  } catch {
    return false
  }
}

function isTestEmail(email = '') {
  const lower = String(email).toLowerCase()
  const domain = lower.split('@')[1] || ''
  return TEST_DOMAINS.has(domain)
}

async function inspectLinkedSupabaseRisk() {
  try {
    const envText = await fs.readFile(path.join(repoRoot, '.env.local'), 'utf8')
    const env = dotenv.parse(envText)
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return null
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    let page = 1
    const users = []
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
      if (error) throw error
      const batch = data?.users ?? []
      users.push(...batch)
      if (batch.length < 200) break
      page += 1
    }

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    const nonTestUsers = users.filter((user) => !isTestEmail(user.email))
    const recentNonTestUsersLast30d = nonTestUsers.filter(
      (user) => user.last_sign_in_at && new Date(user.last_sign_in_at).getTime() >= cutoff
    ).length

    const tenantCountResult = await supabase.from('tenants').select('*', { head: true, count: 'exact' })
    if (tenantCountResult.error) throw tenantCountResult.error

    const nonDemoTenantResult = await supabase.from('tenants').select('*', { head: true, count: 'exact' }).neq('is_demo', true)
    if (nonDemoTenantResult.error) throw nonDemoTenantResult.error

    const projectRef = supabaseUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/)?.[1] ?? 'unknown'

    return {
      projectRef,
      totalUsers: users.length,
      nonTestUsers: nonTestUsers.length,
      recentNonTestUsersLast30d,
      totalTenants: tenantCountResult.count ?? 0,
      nonDemoTenants: nonDemoTenantResult.count ?? 0,
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

const productionEnvJson = extractJsonValue(runCli(vercelBinary, ['env', 'ls', 'production', '--format', 'json']))
const previewEnvJson = extractJsonValue(runCli(vercelBinary, ['env', 'ls', 'preview', '--format', 'json']))
const developmentEnvJson = extractJsonValue(runCli(vercelBinary, ['env', 'ls', 'development', '--format', 'json']))
const previewDeploymentsJson = extractJsonValue(
  runCli(vercelBinary, ['list', '--environment', 'preview', '--status', 'READY', '--format', 'json'])
)
const supabaseProjects = extractJsonValue(runCli(supabaseBinary, ['projects', 'list', '-o', 'json']))
const linkedSupabaseRisk = await inspectLinkedSupabaseRisk()

const productionKeys = normalizeVercelEnvKeys(productionEnvJson?.envs ?? [])
const previewKeys = normalizeVercelEnvKeys(previewEnvJson?.envs ?? [])
const stagingPreviewBranchKeys = normalizeBranchVercelEnvKeys(previewEnvJson?.envs ?? [], STAGING_PREVIEW_BRANCH)
const developmentKeys = normalizeVercelEnvKeys(developmentEnvJson?.envs ?? [])
const previewBranchNames = summarizePreviewBranches(previewEnvJson?.envs ?? [])

const stagingPreviewDeployments = Array.isArray(previewDeploymentsJson?.deployments)
  ? previewDeploymentsJson.deployments.filter((deployment) => {
      const commitRef = String(deployment.meta?.githubCommitRef || '')
      const branchAlias = String(deployment.meta?.branchAlias || '')
      return commitRef === STAGING_PREVIEW_BRANCH || branchAlias.includes(STAGING_PREVIEW_BRANCH)
    })
  : []

const stagingReadyPreviewUrl = toHttpsUrl(
  stagingPreviewDeployments[0]?.meta?.branchAlias || stagingPreviewDeployments[0]?.url || ''
)

const stagingPreviewEffectiveKeys = new Set([...previewKeys, ...stagingPreviewBranchKeys])
const previewMissingKeys = MINIMAL_STAGING_PARITY_KEYS.filter(
  (key) => productionKeys.has(key) && !stagingPreviewEffectiveKeys.has(key)
)
const developmentMissingKeys = MINIMAL_STAGING_PARITY_KEYS.filter(
  (key) => productionKeys.has(key) && !developmentKeys.has(key)
)
const activeSupabaseProjects = Array.isArray(supabaseProjects)
  ? supabaseProjects.filter((project) => String(project.status || '').toUpperCase() !== 'INACTIVE')
  : []
const separateStagingProject = activeSupabaseProjects.find((project) => project.name === STAGING_PROJECT_NAME)
const hasSupabaseConfig = await pathExists('supabase/config.toml')

const warnings = []
const notes = []
if (previewDeploymentsJson?.deployments?.length === 0) {
  warnings.push('Nu există preview deployments READY în proiectul Vercel linked.')
}
if (!previewBranchNames.includes(STAGING_PREVIEW_BRANCH)) {
  warnings.push(`Nu au fost detectate override-uri Vercel preview dedicate pentru branch-ul ${STAGING_PREVIEW_BRANCH}.`)
}
if (stagingPreviewDeployments.length === 0) {
  warnings.push(`Nu a fost detectat încă un preview deployment READY pentru branch-ul ${STAGING_PREVIEW_BRANCH}.`)
}
if (previewMissingKeys.length > 0) {
  warnings.push(
    `Preview branch ${STAGING_PREVIEW_BRANCH} nu are încă paritatea minimă de env față de production pentru drill: ${previewMissingKeys.join(', ')}.`
  )
}
if (!separateStagingProject) {
  warnings.push('Nu a fost confirmat un proiect Supabase activ separat, denumit/stabilit clar ca staging.')
}
if (developmentMissingKeys.length > 0) {
  notes.push(`Development nu are încă paritatea minimă de env față de production pentru drill: ${developmentMissingKeys.join(', ')}.`)
}
if (!hasSupabaseConfig) {
  notes.push(
    'Lipsește `supabase/config.toml`; pentru staging/prod folosește workflow-ul documentat cu worktree separat și `supabase link` targetat, fără relink în workspace-ul curent.'
  )
}
if (linkedSupabaseRisk?.error) {
  notes.push(`Nu am putut evalua read-only riscul de date pe proiectul linked dev: ${linkedSupabaseRisk.error}`)
}
if (linkedSupabaseRisk && !linkedSupabaseRisk.error) {
  if (linkedSupabaseRisk.nonTestUsers > 0) {
    notes.push(
      `Proiectul Supabase linked dev (${linkedSupabaseRisk.projectRef}) conține ${linkedSupabaseRisk.nonTestUsers} user(i) non-test; nu îl trata ca staging destructiv implicit.`
    )
  }
  if (linkedSupabaseRisk.recentNonTestUsersLast30d > 0) {
    notes.push(
      `Proiectul Supabase linked dev (${linkedSupabaseRisk.projectRef}) are ${linkedSupabaseRisk.recentNonTestUsersLast30d} user(i) non-test cu semne de activitate în ultimele 30 zile.`
    )
  }
  if (linkedSupabaseRisk.nonDemoTenants > 0) {
    notes.push(
      `Proiectul Supabase linked dev (${linkedSupabaseRisk.projectRef}) are ${linkedSupabaseRisk.nonDemoTenants} tenant(uri) non-demo; evită restore drill destructiv pe el.`
    )
  }
}

const statusLabel = warnings.length === 0 ? 'READY' : previewDeploymentsJson?.deployments?.length > 0 ? 'PARTIAL' : 'NOT_READY'

console.log(`[staging-readiness] ${statusLabel} — verificare read-only a topologiei și parității minime pentru un restore drill sigur.`)

printSection('Topologie Vercel', [
  `Proiect linked în cwd: zmeurel`,
  `Preview deployments READY detectate: ${previewDeploymentsJson?.deployments?.length}`,
  `Preview branches cu env-uri dedicate detectate: ${previewBranchNames.length > 0 ? previewBranchNames.join(', ') : 'niciuna'}`,
  `Branch dedicat pentru staging: ${previewBranchNames.includes(STAGING_PREVIEW_BRANCH) ? STAGING_PREVIEW_BRANCH : 'neconfigurat'}`,
  `Preview deployment READY pentru branch-ul ${STAGING_PREVIEW_BRANCH}: ${stagingPreviewDeployments.length > 0 ? 'da' : 'nu'}`,
  `URL preview stabil pentru branch-ul ${STAGING_PREVIEW_BRANCH}: ${stagingReadyPreviewUrl || 'neconfirmat'}`,
])

printSection('Paritate minimă env față de production', [
  `Chei minime evaluate: ${MINIMAL_STAGING_PARITY_KEYS.join(', ')}`,
  `Preview branch ${STAGING_PREVIEW_BRANCH}: ${previewMissingKeys.length > 0 ? `lipsesc ${previewMissingKeys.join(', ')}` : 'OK'}`,
  `Development: ${developmentMissingKeys.length > 0 ? `lipsesc ${developmentMissingKeys.join(', ')}` : 'OK'}`,
])

printSection(
  'Topologie Supabase',
  Array.isArray(supabaseProjects) && supabaseProjects.length > 0
    ? supabaseProjects.map(
        (project) => `${project.name} (${project.region}) — ref ${project.id}, status ${project.status}`
      )
    : ['Nu am putut lista proiectele Supabase accesibile.']
)

if (linkedSupabaseRisk && !linkedSupabaseRisk.error) {
  printSection('Risc read-only pe proiectul linked dev', [
    `Ref linked local: ${linkedSupabaseRisk.projectRef}`,
    `Useri total: ${linkedSupabaseRisk.totalUsers}`,
    `Useri non-test: ${linkedSupabaseRisk.nonTestUsers}`,
    `Useri non-test activi în ultimele 30 zile: ${linkedSupabaseRisk.recentNonTestUsersLast30d}`,
    `Tenant-uri total: ${linkedSupabaseRisk.totalTenants}`,
    `Tenant-uri non-demo: ${linkedSupabaseRisk.nonDemoTenants}`,
  ])
}

if (separateStagingProject) {
  printSection('Țintă staging confirmată', [
    `Supabase staging: ${separateStagingProject.name}`,
    `Ref staging: ${separateStagingProject.ref}`,
    `Status staging: ${separateStagingProject.status}`,
    `Vercel preview branch dedicat: ${STAGING_PREVIEW_BRANCH}`,
    `URL preview staging: ${stagingReadyPreviewUrl || 'neconfirmat'}`,
    `Workflow repo -> staging: worktree separat + supabase link targetat, fără relink în workspace-ul curent`,
  ])
}

printSection('Gap-uri pentru staging/readiness reală', warnings.length > 0 ? warnings : ['Nu au fost detectate gap-uri critice pentru staging.'])

if (notes.length > 0) {
  printSection('Note operaționale', notes)
}

if (warnings.length > 0) {
  process.exit(1)
}
