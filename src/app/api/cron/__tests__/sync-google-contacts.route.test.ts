/* @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  captureApiError: vi.fn(),
  syncGoogleContacts: vi.fn(),
}))

vi.mock('@/lib/integrations/google-contacts-sync', () => ({
  syncGoogleContacts: () => mocks.syncGoogleContacts(),
}))

vi.mock('@/lib/monitoring/report-error', () => ({
  captureApiError: (...args: unknown[]) => mocks.captureApiError(...args),
}))

const originalCronSecret = process.env.CRON_SECRET

function createRequest(secret?: string) {
  return new Request('http://localhost:3000/api/cron/sync-google-contacts', {
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  })
}

async function loadRouteModule() {
  vi.resetModules()
  return import('@/app/api/cron/sync-google-contacts/route')
}

describe('GET /api/cron/sync-google-contacts', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret'
    mocks.captureApiError.mockReset()
    mocks.syncGoogleContacts.mockReset()
  })

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = originalCronSecret
    }
  })

  it('returnează 401 fără Authorization Bearer valid', async () => {
    const { GET } = await loadRouteModule()

    const missingResponse = await GET(createRequest())
    const invalidResponse = await GET(createRequest('invalid'))

    expect(missingResponse.status).toBe(401)
    expect(invalidResponse.status).toBe(401)
    expect(mocks.syncGoogleContacts).not.toHaveBeenCalled()
  })

  it('returnează statusul disabled fără eroare', async () => {
    mocks.syncGoogleContacts.mockResolvedValue({ status: 'sync disabled' })
    const { GET } = await loadRouteModule()

    const response = await GET(createRequest('cron-secret'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'sync disabled' })
  })

  it('returnează sumarul sincronizării', async () => {
    mocks.syncGoogleContacts.mockResolvedValue({
      synced: 12,
      skipped: 3,
      errors: 0,
      mode: 'incremental',
    })
    const { GET } = await loadRouteModule()

    const response = await GET(createRequest('cron-secret'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      synced: 12,
      skipped: 3,
      errors: 0,
      mode: 'incremental',
    })
  })
})
