import { expect, test, type Page } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type TestContext = {
  service: SupabaseClient
  userId: string
  email: string
  password: string
  tenantId: string
  parcelaId: string
  parcelaName: string
  culegatorId: string
}

const ctx: Partial<TestContext> = {}

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env: ${name}`)
  return value
}

function token(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.getByRole('button', { name: /intra|login/i }).click()
  await page.waitForURL(/\/(dashboard|recoltari)/, { timeout: 20000 })
}

test.describe('Stocuri inventory per locatie', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async () => {
    const service = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const email = `${token('stocuri_user')}@example.test`
    const password = `Pwd!${Math.random().toString(36).slice(2, 10)}1A`

    const { data: userData, error: userError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (userError || !userData.user) throw new Error(userError?.message || 'failed creating user')

    const { data: tenant, error: tenantError } = await service
      .from('tenants')
      .insert({ nume_ferma: token('ferma_stocuri'), owner_user_id: userData.user.id, plan: 'pro' })
      .select('id')
      .single()
    if (tenantError || !tenant?.id) throw new Error(tenantError?.message || 'failed creating tenant')

    const parcelaName = token('PARCELA_STOC')
    const { data: parcela, error: parcelaError } = await service
      .from('parcele')
      .insert({
        id_parcela: token('PAR'),
        nume_parcela: parcelaName,
        suprafata_m2: 100,
        an_plantare: 2025,
        tenant_id: tenant.id,
      })
      .select('id')
      .single()
    if (parcelaError || !parcela?.id) throw new Error(parcelaError?.message || 'failed creating parcela')

    const { data: culegator, error: culegatorError } = await service
      .from('culegatori')
      .insert({
        id_culegator: token('CUL'),
        nume_prenume: 'Test Culegator Stocuri',
        tarif_lei_kg: 3,
        tenant_id: tenant.id,
      })
      .select('id')
      .single()
    if (culegatorError || !culegator?.id) throw new Error(culegatorError?.message || 'failed creating culegator')

    ctx.service = service
    ctx.userId = userData.user.id
    ctx.email = email
    ctx.password = password
    ctx.tenantId = tenant.id
    ctx.parcelaId = parcela.id
    ctx.parcelaName = parcelaName
    ctx.culegatorId = culegator.id
  })

  test.afterAll(async () => {
    if (!ctx.service) return

    await ctx.service.from('miscari_stoc').delete().eq('tenant_id', ctx.tenantId!)
    await ctx.service.from('recoltari').delete().eq('tenant_id', ctx.tenantId!)
    await ctx.service.from('culegatori').delete().eq('tenant_id', ctx.tenantId!)
    await ctx.service.from('parcele').delete().eq('tenant_id', ctx.tenantId!)
    await ctx.service.from('tenants').delete().eq('id', ctx.tenantId!)
    if (ctx.userId) await ctx.service.auth.admin.deleteUser(ctx.userId)
  })

  test('create recoltare feeds derived stock without writing miscari_stoc', async ({ page }) => {
    await login(page, ctx.email!, ctx.password!)

    await page.goto('/recoltari')
    await page.getByRole('button', { name: /Adauga recoltare/i }).first().click()

    await page.getByLabel('Parcela').click()
    await page.getByRole('option', { name: ctx.parcelaName! }).click()

    await page.getByLabel('Culegator').click()
    await page.getByRole('option', { name: 'Test Culegator Stocuri' }).click()

    await page.fill('#recoltare_kg_cal1', '5')
    await page.fill('#recoltare_kg_cal2', '3')
    await page.getByRole('button', { name: /^Salveaza$/ }).last().click()
    await expect(page.getByText(/Recoltare adaugata/i)).toBeVisible({ timeout: 15000 })

    const service = ctx.service!
    const { data: recoltare } = await service
      .from('recoltari')
      .select('id,kg_cal1,kg_cal2')
      .eq('tenant_id', ctx.tenantId!)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    expect(recoltare?.id).toBeTruthy()
    expect(Number(recoltare?.kg_cal1 ?? 0)).toBe(5)
    expect(Number(recoltare?.kg_cal2 ?? 0)).toBe(3)

    // miscari_stoc este arhivă înghețată: recoltarea NU mai scrie în ea.
    const { data: miscari } = await service
      .from('miscari_stoc')
      .select('id')
      .eq('referinta_id', recoltare!.id)

    expect(miscari?.length ?? 0).toBe(0)

    // Pagina /stocuri afișează pool-ul derivat cal1 (5 kg din recoltarea de mai sus).
    await page.goto('/stocuri')
    await expect(page.getByText('Zmeură cal. I').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('5,0 kg').first()).toBeVisible()
  })
})
