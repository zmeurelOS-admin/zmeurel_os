import { describe, expect, it, vi, beforeEach } from 'vitest'

import { DELETE, GET, PATCH, POST } from '@/app/api/association/offers/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

vi.mock('@/lib/notifications/create', () => ({
  createNotification: vi.fn(),
  createNotificationsForAssociationAdmins: vi.fn(),
  NOTIFICATION_TYPES: {
    offer_new: 'offer_new',
    offer_approved: 'offer_approved',
    offer_rejected: 'offer_rejected',
  },
}))

const getAssociationRole = vi.fn()
vi.mock('@/lib/association/auth', () => ({
  getAssociationRole: (uid: string) => getAssociationRole(uid),
}))

const getTenantIdByUserId = vi.fn()
vi.mock('@/lib/tenant/get-tenant', () => ({
  getTenantIdByUserId: (...args: unknown[]) => getTenantIdByUserId(...args),
}))

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

const PID = '660e8400-e29b-41d4-a716-446655440011'
const TID = '660e8400-e29b-41d4-a716-446655440012'
const UID = '770e8400-e29b-41d4-a716-446655440013'

describe('/api/association/offers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET ?countOnly=1 returnează pendingCount', async () => {
    getAssociationRole.mockResolvedValue('moderator')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: UID } }, error: null }) },
      from: () => ({
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.head) {
            return {
              eq: async () => ({ count: 3, error: null }),
            }
          }
          return {
            order: () => ({ error: null, data: [] }),
          }
        },
      }),
    })

    const req = new Request('http://localhost:3000/api/association/offers?countOnly=1')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { pendingCount: number } }
    expect(body.data.pendingCount).toBe(3)
  })

  it('POST: tenant neaprobat pentru asociație → 403', async () => {
    getTenantIdByUserId.mockResolvedValue(TID)
    mocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: UID } }, error: null }) },
      from: (table: string) => {
        if (table === 'tenants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { is_association_approved: false },
                  error: null,
                }),
              }),
            }),
          }
        }
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
      },
    })

    const req = createSameOriginRequest('/api/association/offers', {
      method: 'POST',
      json: { productId: PID, suggestedPrice: 12 },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('DELETE: offerId invalid → 400', async () => {
    getTenantIdByUserId.mockResolvedValue(TID)
    mocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: UID } }, error: null }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    })

    const req = createSameOriginRequest('/api/association/offers', {
      method: 'DELETE',
      json: { offerId: 'not-uuid' },
    })
    const res = await DELETE(req)
    expect(res.status).toBe(400)
  })

  it('PATCH: viewer asociație → 403', async () => {
    getAssociationRole.mockResolvedValue('viewer')
    mocks.createClient.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: UID } }, error: null }) },
    })

    const req = createSameOriginRequest('/api/association/offers', {
      method: 'PATCH',
      json: { offerId: '660e8400-e29b-41d4-a716-446655440010', action: 'aproba' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(403)
  })
})
