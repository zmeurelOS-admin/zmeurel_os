import { test, expect, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { ensureTenantForUser } from '../src/lib/auth/ensure-tenant'

type TestContext = {
  service: SupabaseClient
  user: { id: string; email: string; password: string }
  tenantId: string
  parcelaId: string
  baseUrl: string
}

const ctx: Partial<TestContext> = {}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function uniqueToken(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function getCtx(): TestContext {
  if (!ctx.service || !ctx.user || !ctx.tenantId || !ctx.parcelaId || !ctx.baseUrl) {
    throw new Error('Activitati solar test context not initialized')
  }

  return ctx as TestContext
}

async function createTestUser(service: SupabaseClient) {
  const email = `${uniqueToken('activitate_solar')}@example.test`
  const password = `Pwd!${Math.random().toString(36).slice(2, 10)}1A`
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error || !data.user) {
    throw new Error(`Failed creating activitati solar test user: ${error?.message ?? 'unknown error'}`)
  }

  return {
    id: data.user.id,
    email,
    password,
  }
}

async function loginViaUi(page: Page, email: string, password: string, baseUrl: string) {
  await page.goto(`${baseUrl}/login`)
  await page.fill('#login-email', email)
  await page.fill('#login-password', password)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(/\/(dashboard|lucrari|start)/, { timeout: 15000 })
}

test.describe('Activitati Solar Flow', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000'

    const service = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })

    const user = await createTestUser(service)
    const tenantId = await ensureTenantForUser({
      supabase: service,
      userId: user.id,
      fallbackFarmName: uniqueToken('activitati_solar_ferma'),
    })

    const { data: parcela, error: parcelaError } = await service
      .from('parcele')
      .insert({
        id_parcela: `SOL_${uniqueToken('act')}`.slice(0, 24),
        nume_parcela: 'SOLAR_ACTIVITATE_E2E',
        suprafata_m2: 120,
        tip_unitate: 'solar',
        an_plantare: 2026,
        status: 'Activ',
        stadiu: 'crestere',
        tenant_id: tenantId,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single()

    if (parcelaError || !parcela?.id) {
      throw new Error(`Failed creating solar parcela: ${parcelaError?.message ?? 'unknown error'}`)
    }

    ctx.service = service
    ctx.user = user
    ctx.tenantId = tenantId
    ctx.parcelaId = parcela.id
    ctx.baseUrl = baseUrl
  })

  test.afterAll(async () => {
    if (!ctx.service) return

    try {
      if (ctx.tenantId) {
        const { data: activitati } = await ctx.service
          .from('activitati_agricole')
          .select('id')
          .eq('tenant_id', ctx.tenantId)

        if (activitati?.length) {
          await ctx.service.from('activitati_agricole').delete().in('id', activitati.map((row) => row.id))
        }
      }

      if (ctx.parcelaId) {
        await ctx.service.from('parcele').delete().eq('id', ctx.parcelaId)
      }
      if (ctx.tenantId) {
        await ctx.service.from('tenants').delete().eq('id', ctx.tenantId)
      }
      if (ctx.user?.id) {
        await ctx.service.auth.admin.deleteUser(ctx.user.id)
      }
    } catch {
      // noop teardown
    }
  })

  test('o lucrare nouă pe solar apare în Lucrări și în jurnalul fișei parcelei', async ({ page }) => {
    const c = getCtx()
    await loginViaUi(page, c.user.email, c.user.password, c.baseUrl)

    // `/activitati-agricole` redirecționează la `/lucrari`, cu parametrii păstrați.
    await page.goto(`${c.baseUrl}/activitati-agricole?fila=planificate`, { waitUntil: 'load' })
    await expect(page).toHaveURL(/\/lucrari\?fila=planificate/)

    await page.goto(`${c.baseUrl}/lucrari`, { waitUntil: 'load' })
    await page.getByRole('button', { name: /^Lucrare$/ }).first().click()
    await page.getByRole('radio', { name: /Irigație/ }).click()
    await page.getByRole('button', { name: /^Continuă$/ }).click()
    await page.getByRole('checkbox', { name: /SOLAR_ACTIVITATE_E2E/ }).click()
    await page.getByLabel('Notă (opțional)').fill('Observatie test solar')
    await page.getByRole('button', { name: /Salvează lucrarea/ }).click()
    await expect(page.getByText(/^Salvată$/)).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /^Gata$/ }).click()
    await expect(page.getByText(/Observatie test solar/).first()).toBeVisible({ timeout: 10000 })

    await page.goto(`${c.baseUrl}/parcele`, { waitUntil: 'load' })
    await expect(page.getByText(/SOLAR_ACTIVITATE_E2E/i).first()).toBeVisible({ timeout: 10000 })

    await page.goto(`${c.baseUrl}/parcele/${c.parcelaId}`, { waitUntil: 'load' })
    await expect(page.getByRole('heading', { name: /SOLAR_ACTIVITATE_E2E/ })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Lucrare: irigație/i).first()).toBeVisible({ timeout: 10000 })
  })
})
