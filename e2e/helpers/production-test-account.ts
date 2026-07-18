import { expect, type Page } from '@playwright/test'

// Persistent production visual-test login. Run `npm run seed:prod-test-account`
// first, then import `loginWithProductionTestAccount(page)` in visual/E2E specs.

export type ProductionTestAccount = {
  email: string
  password: string
  tenantId?: string
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

export function getProductionTestAccount(): ProductionTestAccount {
  return {
    email: requireEnv('TEST_ACCOUNT_EMAIL'),
    password: requireEnv('TEST_ACCOUNT_PASSWORD'),
    tenantId: process.env.TEST_ACCOUNT_TENANT_ID,
  }
}

export async function loginWithProductionTestAccount(page: Page) {
  const account = getProductionTestAccount()

  await page.goto('/login')
  await page.locator('#login-email, #email').first().fill(account.email)
  await page.locator('#login-password, #password').first().fill(account.password)
  await page.getByRole('button', { name: /autentifica-te|intra|login/i }).click()
  await expect(page).toHaveURL(/\/(dashboard|comenzi|recoltari|parcele)/, { timeout: 30_000 })

  return account
}
