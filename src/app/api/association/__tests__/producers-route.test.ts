import { describe, expect, it, vi, beforeEach } from 'vitest'

import { PATCH, POST } from '@/app/api/association/producers/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const getAssociationRole = vi.fn()
vi.mock('@/lib/association/auth', () => ({
  getAssociationRole: (uid: string) => getAssociationRole(uid),
}))

const isSuperAdmin = vi.fn()
vi.mock('@/lib/auth/isSuperAdmin', () => ({
  isSuperAdmin: (_s: unknown, uid: string) => isSuperAdmin(uid),
}))

const createNotification = vi.fn()
vi.mock('@/lib/notifications/create', () => ({
  createNotification: (...args: unknown[]) => createNotification(...args),
  NOTIFICATION_TYPES: { producer_approved: 'producer_approved', producer_suspended: 'producer_suspended' },
}))

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

const TID = 'dd000000-0000-4000-8000-000000000001'
const UID = 'ee000000-0000-4000-8000-000000000002'

function clientForPatch(opts: { superadmin: boolean; tenantFound: boolean }) {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: UID } }, error: null }),
    },
    from: (table: string) => {
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () =>
                opts.tenantFound
                  ? { data: { id: TID }, error: null }
                  : { data: null, error: null },
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: TID,
                    owner_user_id: 'ff000000-0000-4000-8000-000000000099',
                    is_association_approved: true,
                    nume_ferma: 'F',
                    updated_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'produse') {
        return {
          update: () => ({
            eq: () => ({ error: null }),
          }),
        }
      }
      throw new Error(`unexpected ${table}`)
    },
  }
}

function clientForPost(opts: { role: 'admin' | 'moderator' | 'viewer' | null; tenantApproved: boolean }) {
  getAssociationRole.mockResolvedValue(opts.role)
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: UID } }, error: null }),
    },
    from: (table: string) => {
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () =>
                opts.tenantApproved
                  ? { data: { id: TID, is_association_approved: true }, error: null }
                  : { data: { id: TID, is_association_approved: false }, error: null },
            }),
          }),
        }
      }
      if (table === 'produse') {
        return {
          update: () => ({
            eq: () => ({
              eq: () => ({
                select: async () => ({
                  data: [{ id: 'p1' }, { id: 'p2' }],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected ${table}`)
    },
    rpc: async (fn: string) => {
      if (fn === 'is_legal_docs_complete') {
        return { data: true, error: null }
      }
      throw new Error(`unexpected rpc ${fn}`)
    },
  }
}

describe('PATCH /api/association/producers (aprobare tenant)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('403: non-superadmin → mesaj Zmeurel.ro', async () => {
    isSuperAdmin.mockResolvedValue(false)
    mocks.createClient.mockResolvedValue(clientForPatch({ superadmin: false, tenantFound: true }))
    const req = createSameOriginRequest('/api/association/producers', {
      method: 'PATCH',
      json: { tenantId: TID, approved: true },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(403)
    const j = (await res.json()) as { error?: { message?: string } }
    expect(j.error?.message).toContain('Zmeurel.ro')
  })

  it('200: superadmin → actualizare', async () => {
    isSuperAdmin.mockResolvedValue(true)
    mocks.createClient.mockResolvedValue(clientForPatch({ superadmin: true, tenantFound: true }))
    const req = createSameOriginRequest('/api/association/producers', {
      method: 'PATCH',
      json: { tenantId: TID, approved: true },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const j = (await res.json()) as { ok: boolean }
    expect(j.ok).toBe(true)
    expect(createNotification).toHaveBeenCalled()
  })
})

describe('POST /api/association/producers (batch list produse)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('200: admin → update produse', async () => {
    mocks.createClient.mockResolvedValue(clientForPost({ role: 'admin', tenantApproved: true }))
    const req = createSameOriginRequest('/api/association/producers', {
      method: 'POST',
      json: { tenantId: TID, listed: true },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const j = (await res.json()) as { data?: { updatedCount?: number } }
    expect(j.data?.updatedCount).toBe(2)
  })

  it('200: moderator → update produse', async () => {
    mocks.createClient.mockResolvedValue(clientForPost({ role: 'moderator', tenantApproved: true }))
    const req = createSameOriginRequest('/api/association/producers', {
      method: 'POST',
      json: { tenantId: TID, listed: true },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('403: viewer → respins', async () => {
    mocks.createClient.mockResolvedValue(clientForPost({ role: 'viewer', tenantApproved: true }))
    const req = createSameOriginRequest('/api/association/producers', {
      method: 'POST',
      json: { tenantId: TID, listed: true },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('403: tenant neaprobat', async () => {
    mocks.createClient.mockResolvedValue(clientForPost({ role: 'admin', tenantApproved: false }))
    const req = createSameOriginRequest('/api/association/producers', {
      method: 'POST',
      json: { tenantId: TID, listed: true },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const j = (await res.json()) as { error?: { code?: string } }
    expect(j.error?.code).toBe('NOT_APPROVED')
  })
})
