import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/push/test/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  sendPushToUser: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

vi.mock('@/lib/notifications/send-push', () => ({
  sendPushToUser: (...args: unknown[]) => mocks.sendPushToUser(...args),
}))

const USER_ID = '11111111-1111-1111-1111-111111111111'

function buildSupabaseClient(userId: string | null) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: userId ? { id: userId, email: 'u@example.com' } : null },
        error: null,
      }),
    },
  }
}

describe('POST /api/push/test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('respinge cu 401 când utilizatorul nu e autentificat', async () => {
    mocks.createClient.mockResolvedValue(buildSupabaseClient(null))
    const res = await POST(createSameOriginRequest('/api/push/test', { method: 'POST', json: {} }))
    expect(res.status).toBe(401)
    expect(mocks.sendPushToUser).not.toHaveBeenCalled()
  })

  it('happy path: cu auth + subscripție validă → 200 și apel către sendPushToUser cu bypassPolicy', async () => {
    mocks.createClient.mockResolvedValue(buildSupabaseClient(USER_ID))
    mocks.sendPushToUser.mockResolvedValue({
      attempted: 1,
      sent: 1,
      deleted: 0,
      failed: 0,
      skippedReason: null,
    })
    const res = await POST(createSameOriginRequest('/api/push/test', { method: 'POST', json: {} }))
    expect(res.status).toBe(200)
    expect(mocks.sendPushToUser).toHaveBeenCalledTimes(1)
    const callArgs = mocks.sendPushToUser.mock.calls[0]
    expect(callArgs[0]).toBe(USER_ID)
    expect(callArgs[3]).toMatchObject({ type: 'system', bypassPolicy: true })
  })

  it('întoarce 503 când VAPID nu e configurat', async () => {
    mocks.createClient.mockResolvedValue(buildSupabaseClient(USER_ID))
    mocks.sendPushToUser.mockResolvedValue({
      attempted: 0,
      sent: 0,
      deleted: 0,
      failed: 0,
      skippedReason: 'not_configured',
    })
    const res = await POST(createSameOriginRequest('/api/push/test', { method: 'POST', json: {} }))
    expect(res.status).toBe(503)
  })

  it('întoarce 409 când nu există subscripții salvate', async () => {
    mocks.createClient.mockResolvedValue(buildSupabaseClient(USER_ID))
    mocks.sendPushToUser.mockResolvedValue({
      attempted: 0,
      sent: 0,
      deleted: 0,
      failed: 0,
      skippedReason: 'no_subscriptions',
    })
    const res = await POST(createSameOriginRequest('/api/push/test', { method: 'POST', json: {} }))
    expect(res.status).toBe(409)
  })

  it('întoarce 502 când push-ul a fost încercat dar a eșuat', async () => {
    mocks.createClient.mockResolvedValue(buildSupabaseClient(USER_ID))
    mocks.sendPushToUser.mockResolvedValue({
      attempted: 1,
      sent: 0,
      deleted: 0,
      failed: 1,
      skippedReason: null,
    })
    const res = await POST(createSameOriginRequest('/api/push/test', { method: 'POST', json: {} }))
    expect(res.status).toBe(502)
  })
})
