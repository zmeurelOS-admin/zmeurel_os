import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type PerfUser = {
  id: string
  email: string
  password: string
}

type PerfContext = {
  service: SupabaseClient
  user: PerfUser
  tenantId: string
}

const ctx: Partial<PerfContext> = {}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function uniqueToken(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

async function createPerfUser(service: SupabaseClient): Promise<PerfUser> {
  const email = `${uniqueToken('nav_perf_user')}@example.test`
  const password = `Pwd!${Math.random().toString(36).slice(2, 10)}1A`

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || !data.user) {
    throw new Error(`Failed creating nav perf user: ${error?.message ?? 'unknown error'}`)
  }

  return { id: data.user.id, email, password }
}

async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: /email/i }).fill(email)
  await page.getByRole('textbox', { name: /parol/i }).fill(password)
  await page.getByRole('button', { name: /intr/i }).click()
  await page.waitForURL(/\/(dashboard|parcele)/, { timeout: 20000 })
}

test.describe('Navigation performance instrumentation', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeAll(async () => {
    const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

    const service = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })

    const user = await createPerfUser(service)

    const { data: tenant, error: tenantError } = await service
      .from('tenants')
      .insert({
        nume_ferma: uniqueToken('nav_perf_ferma'),
        owner_user_id: user.id,
        plan: 'pro',
      })
      .select('id')
      .single()

    if (tenantError || !tenant?.id) {
      throw new Error(`Failed creating nav perf tenant: ${tenantError?.message ?? 'unknown error'}`)
    }

    ctx.service = service
    ctx.user = user
    ctx.tenantId = tenant.id
  })

  test.afterAll(async () => {
    if (!ctx.service) return

    try {
      if (ctx.tenantId) {
        await ctx.service.from('tenants').delete().eq('id', ctx.tenantId)
      }
      if (ctx.user?.id) {
        await ctx.service.auth.admin.deleteUser(ctx.user.id)
      }
    } catch {
      // no-op teardown
    }
  })

  test('captures click->commit timings under threshold across module navigation', async ({ page }) => {
    if (!ctx.user) throw new Error('Missing nav perf test user')

    const navLogs: string[] = []
    page.on('console', (msg) => {
      if (msg.type() !== 'log') return
      const text = msg.text()
      if (text.startsWith('NAV_TIMING ')) {
        navLogs.push(text)
      }
    })

    await loginViaUi(page, ctx.user.email, ctx.user.password)
    await page.goto('/dashboard')
    await page.waitForURL('**/dashboard')

    await page.goto('/recoltari')
    await page.waitForURL('**/recoltari')

    await page.goto('/vanzari')
    await page.waitForURL('**/vanzari')

    await page.goto('/parcele')
    await page.waitForURL('**/parcele')

    await page.goto('/cheltuieli')
    await page.waitForURL('**/cheltuieli')

    await expect.poll(() => navLogs.length, { timeout: 10000 }).toBeGreaterThanOrEqual(4)

    const timingRegex = /^NAV_TIMING from=(.+) to=(.+) click->commit=([0-9]+(?:\.[0-9]+)?)ms$/
    const parsed = navLogs
      .map((line) => {
        const match = line.match(timingRegex)
        if (!match) return null
        return {
          from: match[1],
          to: match[2],
          durationMs: Number(match[3]),
        }
      })
      .filter((entry): entry is { from: string; to: string; durationMs: number } => Boolean(entry))

    expect(parsed.length).toBeGreaterThanOrEqual(4)

    const thresholdMs = 1200
    const offenders = parsed.filter((entry) => entry.durationMs > thresholdMs)

    expect(
      offenders,
      `Navigation timings above ${thresholdMs}ms: ${offenders
        .map((item) => `${item.from}->${item.to}=${item.durationMs.toFixed(1)}ms`)
        .join(', ')}`
    ).toEqual([])
  })
})
