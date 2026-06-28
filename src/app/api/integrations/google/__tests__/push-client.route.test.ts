/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getTenantIdByUserIdOrNull: vi.fn(),
  getUser: vi.fn(),
  pushClientToGoogle: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

vi.mock('@/lib/tenant/get-tenant', () => ({
  getTenantIdByUserIdOrNull: (...args: unknown[]) =>
    mocks.getTenantIdByUserIdOrNull(...args),
}))

vi.mock('@/lib/integrations/google-contacts-push', () => ({
  pushClientToGoogle: (...args: unknown[]) =>
    mocks.pushClientToGoogle(...args),
}))

const clientId = '11111111-1111-4111-8111-111111111111'
const tenantId = '22222222-2222-4222-8222-222222222222'

async function loadRouteModule() {
  vi.resetModules()
  return import('@/app/api/integrations/google/push-client/route')
}

function createRequest() {
  return createSameOriginRequest('/api/integrations/google/push-client', {
    method: 'POST',
    json: { clientId, tenantId },
  })
}

describe('POST /api/integrations/google/push-client', () => {
  beforeEach(() => {
    mocks.createClient.mockReset()
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } })
    mocks.getTenantIdByUserIdOrNull.mockReset()
    mocks.getUser.mockReset()
    mocks.pushClientToGoogle.mockReset()
    mocks.pushClientToGoogle.mockResolvedValue(undefined)
  })

  it('returnează 401 fără sesiune autentificată', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })
    const { POST } = await loadRouteModule()

    const response = await POST(createRequest())

    expect(response.status).toBe(401)
    expect(mocks.pushClientToGoogle).not.toHaveBeenCalled()
  })

  it('returnează 403 când tenantul nu aparține sesiunii', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mocks.getTenantIdByUserIdOrNull.mockResolvedValue(
      '33333333-3333-4333-8333-333333333333',
    )
    const { POST } = await loadRouteModule()

    const response = await POST(createRequest())

    expect(response.status).toBe(403)
    expect(mocks.pushClientToGoogle).not.toHaveBeenCalled()
  })

  it('așteaptă push-ul server-side pentru tenantul sesiunii', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mocks.getTenantIdByUserIdOrNull.mockResolvedValue(tenantId)
    const { POST } = await loadRouteModule()

    const response = await POST(createRequest())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(mocks.pushClientToGoogle).toHaveBeenCalledWith(clientId, tenantId)
  })
})
