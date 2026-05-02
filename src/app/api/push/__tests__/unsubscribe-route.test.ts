import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/push/unsubscribe/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

const USER_ID = '11111111-1111-1111-1111-111111111111'
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc-123'

function buildSupabaseClient(opts: {
  userId: string | null
  /** Nr. de rânduri șterse — folosit doar pentru introspecție; delete e mereu success. */
  recordedDeletes?: { user_id: string; endpoint: string }[]
}) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: opts.userId ? { id: opts.userId, email: 'u@example.com' } : null },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      void table
      return {
        delete: () => {
          const filters: Record<string, string> = {}
          const chain: Record<string, unknown> = {}
          chain.eq = (col: string, val: string) => {
            filters[col] = val
            if (filters.user_id && filters.endpoint) {
              const finished = async () => {
                opts.recordedDeletes?.push({ user_id: filters.user_id, endpoint: filters.endpoint })
                return { error: null }
              }
              return Object.assign(chain, {
                then: (resolve: (v: unknown) => unknown) => finished().then(resolve),
              })
            }
            return chain
          }
          return chain
        },
      }
    }),
  }
}

describe('POST /api/push/unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('respinge cu 401 când utilizatorul nu e autentificat', async () => {
    mocks.createClient.mockResolvedValue(buildSupabaseClient({ userId: null }))
    const req = createSameOriginRequest('/api/push/unsubscribe', { method: 'POST', json: { endpoint: ENDPOINT } })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('happy path: șterge subscripția curentă', async () => {
    const recordedDeletes: { user_id: string; endpoint: string }[] = []
    mocks.createClient.mockResolvedValue(buildSupabaseClient({ userId: USER_ID, recordedDeletes }))
    const req = createSameOriginRequest('/api/push/unsubscribe', {
      method: 'POST',
      json: { endpoint: ENDPOINT },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(recordedDeletes).toEqual([{ user_id: USER_ID, endpoint: ENDPOINT }])
  })

  it('idempotent: dezabonare pentru endpoint inexistent → 200, fără throw', async () => {
    // Implementarea face delete .eq.eq — Supabase întoarce {error:null} chiar dacă nu sunt rânduri.
    const recordedDeletes: { user_id: string; endpoint: string }[] = []
    mocks.createClient.mockResolvedValue(buildSupabaseClient({ userId: USER_ID, recordedDeletes }))
    const res = await POST(
      createSameOriginRequest('/api/push/unsubscribe', {
        method: 'POST',
        json: { endpoint: 'https://fcm.googleapis.com/fcm/send/does-not-exist' },
      }),
    )
    expect(res.status).toBe(200)
  })

  it('respinge body invalid cu 400', async () => {
    mocks.createClient.mockResolvedValue(buildSupabaseClient({ userId: USER_ID }))
    const res = await POST(createSameOriginRequest('/api/push/unsubscribe', { method: 'POST', json: {} }))
    expect(res.status).toBe(400)
  })
})
