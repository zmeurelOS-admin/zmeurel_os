import 'dotenv/config'

type LoginResult = {
  accessToken: string
  durationMs: number
}

type StepResult = {
  ok: boolean
  durationMs: number
  status: number
  error?: string
}

type VirtualUserResult = {
  userIndex: number
  login: StepResult
  createRecoltare: StepResult
  createVanzare: StepResult
}

type Credentials = {
  email: string
  password: string
}

const VIRTUAL_USERS = Number(process.env.LOAD_TEST_USERS_COUNT ?? 20)
const SUPABASE_URL = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_ANON_KEY = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const PARCELA_ID = requiredEnv('LOAD_TEST_PARCELA_ID')
const CULEGATOR_ID = requiredEnv('LOAD_TEST_CULEGATOR_ID')
const CLIENT_ID = process.env.LOAD_TEST_CLIENT_ID
const TENANT_ID = process.env.LOAD_TEST_TENANT_ID

const BASE_HEADERS: Record<string, string> = {
  apikey: SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function readCredentials(): Credentials[] {
  const json = process.env.LOAD_TEST_USERS_JSON
  if (json) {
    const parsed = JSON.parse(json) as Credentials[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('LOAD_TEST_USERS_JSON must be a non-empty array')
    }
    return parsed
  }

  const email = process.env.LOAD_TEST_EMAIL
  const password = process.env.LOAD_TEST_PASSWORD
  if (!email || !password) {
    throw new Error(
      'Provide either LOAD_TEST_USERS_JSON or LOAD_TEST_EMAIL + LOAD_TEST_PASSWORD'
    )
  }

  return [{ email, password }]
}

function nowIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function uniqueId(prefix: string, index: number): string {
  return `${prefix}_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`.slice(0, 24)
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function pct(values: number, total: number): number {
  if (total === 0) return 0
  return (values / total) * 100
}

async function login(email: string, password: string): Promise<LoginResult> {
  const start = performance.now()

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: BASE_HEADERS,
    body: JSON.stringify({ email, password }),
  })

  const durationMs = performance.now() - start

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Login failed (${response.status}): ${body}`)
  }

  const json = (await response.json()) as { access_token?: string }
  if (!json.access_token) {
    throw new Error('Login response missing access_token')
  }

  return { accessToken: json.access_token, durationMs }
}

async function createRecoltare(accessToken: string, index: number): Promise<StepResult> {
  const start = performance.now()

  const payload: Record<string, unknown> = {
    client_sync_id: crypto.randomUUID(),
    id_recoltare: uniqueId('REC_LT', index),
    data: nowIsoDate(),
    parcela_id: PARCELA_ID,
    culegator_id: CULEGATOR_ID,
    cantitate_kg: 12.5,
    observatii: 'LOAD_TEST_RECOLTARE',
    sync_status: 'synced',
  }

  if (TENANT_ID) payload.tenant_id = TENANT_ID

  const response = await fetch(`${SUPABASE_URL}/rest/v1/recoltari`, {
    method: 'POST',
    headers: {
      ...BASE_HEADERS,
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  })

  const durationMs = performance.now() - start

  if (!response.ok) {
    return {
      ok: false,
      durationMs,
      status: response.status,
      error: await response.text(),
    }
  }

  return { ok: true, durationMs, status: response.status }
}

async function createVanzare(accessToken: string, index: number): Promise<StepResult> {
  const start = performance.now()

  const payload: Record<string, unknown> = {
    client_sync_id: crypto.randomUUID(),
    id_vanzare: uniqueId('V_LT', index),
    data: nowIsoDate(),
    client_id: CLIENT_ID ?? null,
    cantitate_kg: 10,
    pret_lei_kg: 20,
    pret_unitar_lei: 20,
    status_plata: 'Platit',
    observatii_ladite: 'LOAD_TEST_VANZARE',
    sync_status: 'synced',
  }

  if (TENANT_ID) payload.tenant_id = TENANT_ID

  const response = await fetch(`${SUPABASE_URL}/rest/v1/vanzari`, {
    method: 'POST',
    headers: {
      ...BASE_HEADERS,
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  })

  const durationMs = performance.now() - start

  if (!response.ok) {
    return {
      ok: false,
      durationMs,
      status: response.status,
      error: await response.text(),
    }
  }

  return { ok: true, durationMs, status: response.status }
}

async function runVirtualUser(userIndex: number, credentials: Credentials): Promise<VirtualUserResult> {
  let loginStep: StepResult = { ok: false, durationMs: 0, status: 0 }
  let recoltareStep: StepResult = { ok: false, durationMs: 0, status: 0 }
  let vanzareStep: StepResult = { ok: false, durationMs: 0, status: 0 }

  try {
    const loginResult = await login(credentials.email, credentials.password)
    loginStep = { ok: true, durationMs: loginResult.durationMs, status: 200 }

    recoltareStep = await createRecoltare(loginResult.accessToken, userIndex)
    vanzareStep = await createVanzare(loginResult.accessToken, userIndex)
  } catch (error) {
    loginStep = {
      ok: false,
      durationMs: loginStep.durationMs,
      status: 0,
      error: error instanceof Error ? error.message : 'Unknown login error',
    }
  }

  return {
    userIndex,
    login: loginStep,
    createRecoltare: recoltareStep,
    createVanzare: vanzareStep,
  }
}

async function main() {
  const credentialsPool = readCredentials()

  const startedAt = performance.now()

  const results = await Promise.all(
    Array.from({ length: VIRTUAL_USERS }, (_, index) => {
      const creds = credentialsPool[index % credentialsPool.length]
      return runVirtualUser(index + 1, creds)
    })
  )

  const finishedInMs = performance.now() - startedAt

  const loginDurations = results.filter((r) => r.login.ok).map((r) => r.login.durationMs)
  const recoltareDurations = results
    .filter((r) => r.createRecoltare.ok)
    .map((r) => r.createRecoltare.durationMs)
  const vanzareDurations = results.filter((r) => r.createVanzare.ok).map((r) => r.createVanzare.durationMs)

  const loginErrors = results.filter((r) => !r.login.ok)
  const recoltareErrors = results.filter((r) => !r.createRecoltare.ok)
  const vanzareErrors = results.filter((r) => !r.createVanzare.ok)

  console.log('=== LOAD TEST SUMMARY ===')
  console.log(`Virtual users: ${VIRTUAL_USERS}`)
  console.log(`Total wall time: ${finishedInMs.toFixed(2)} ms`)

  console.log('\nAverage response time:')
  console.log(`- Login: ${avg(loginDurations).toFixed(2)} ms (${loginDurations.length} success)`)
  console.log(`- Create Recoltare: ${avg(recoltareDurations).toFixed(2)} ms (${recoltareDurations.length} success)`)
  console.log(`- Create Vanzare: ${avg(vanzareDurations).toFixed(2)} ms (${vanzareDurations.length} success)`)

  console.log('\nErrors:')
  console.log(
    `- Login: ${loginErrors.length}/${VIRTUAL_USERS} (${pct(loginErrors.length, VIRTUAL_USERS).toFixed(1)}%)`
  )
  console.log(
    `- Create Recoltare: ${recoltareErrors.length}/${VIRTUAL_USERS} (${pct(recoltareErrors.length, VIRTUAL_USERS).toFixed(1)}%)`
  )
  console.log(
    `- Create Vanzare: ${vanzareErrors.length}/${VIRTUAL_USERS} (${pct(vanzareErrors.length, VIRTUAL_USERS).toFixed(1)}%)`
  )

  const detailedErrors = results.flatMap((result) => {
    const errors: Array<{ userIndex: number; step: string; status: number; error?: string }> = []
    if (!result.login.ok) {
      errors.push({ userIndex: result.userIndex, step: 'login', status: result.login.status, error: result.login.error })
    }
    if (!result.createRecoltare.ok) {
      errors.push({
        userIndex: result.userIndex,
        step: 'create_recoltare',
        status: result.createRecoltare.status,
        error: result.createRecoltare.error,
      })
    }
    if (!result.createVanzare.ok) {
      errors.push({
        userIndex: result.userIndex,
        step: 'create_vanzare',
        status: result.createVanzare.status,
        error: result.createVanzare.error,
      })
    }
    return errors
  })

  if (detailedErrors.length > 0) {
    console.log('\nError details:')
    detailedErrors.forEach((item) => {
      console.log(
        `- user #${item.userIndex} | ${item.step} | status=${item.status} | ${item.error?.slice(0, 180) ?? 'unknown error'}`
      )
    })
  }
}

main().catch((error) => {
  console.error('Load test failed:', error)
  process.exit(1)
})
