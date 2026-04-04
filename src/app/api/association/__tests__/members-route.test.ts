import { describe, expect, it, vi, beforeEach } from 'vitest'

import { DELETE, PATCH, POST } from '@/app/api/association/members/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const getAssociationRole = vi.fn()
vi.mock('@/lib/association/auth', () => ({
  getAssociationRole: (uid: string) => getAssociationRole(uid),
}))

const resolveAuthUserIdByEmail = vi.fn()
vi.mock('@/lib/association/resolve-auth-user-by-email', () => ({
  resolveAuthUserIdByEmail: (admin: unknown, email: string) => resolveAuthUserIdByEmail(admin, email),
}))

const createNotification = vi.fn()
vi.mock('@/lib/notifications/create', () => ({
  createNotification: (...args: unknown[]) => createNotification(...args),
  NOTIFICATION_TYPES: { system: 'system' },
}))

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  adminFrom: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => mocks.getSupabaseAdmin(),
}))

const ADMIN_UID = 'aa000000-0000-4000-8000-000000000001'
const TARGET_UID = 'bb000000-0000-4000-8000-000000000002'
const MEMBER_ID = 'cc000000-0000-4000-8000-000000000003'

function gateClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: ADMIN_UID } }, error: null }),
    },
  }
}

function buildAdmin(opts: {
  existingMember?: { id: string } | null
  insertRow?: { id: string; user_id: string; role: string; created_at: string; invited_by: string | null } | null
  insertError?: unknown
  fetchMember?: { id: string; user_id: string; role: string } | null
  updateRow?: unknown
  adminCount?: number
  deleteError?: unknown
}) {
  return {
    from: (table: string) => {
      if (table === 'association_members') {
        return {
          select: () => ({
            eq: (col: string, val: unknown) => {
              if (col === 'role' && val === 'admin') {
                return Promise.resolve({
                  data: Array.from({ length: opts.adminCount ?? 2 }, (_, i) => ({ id: `a${i}` })),
                  error: null,
                })
              }
              return {
                maybeSingle: async () => {
                  if (col === 'user_id') {
                    return { data: opts.existingMember ?? null, error: null }
                  }
                  if (col === 'id') {
                    return { data: opts.fetchMember ?? null, error: null }
                  }
                  return { data: null, error: null }
                },
              }
            },
          }),
          insert: () => ({
            select: () => ({
              single: async () =>
                opts.insertError
                  ? { data: null, error: opts.insertError }
                  : { data: opts.insertRow, error: null },
            }),
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({ data: opts.updateRow, error: null }),
              }),
            }),
          }),
          delete: () => ({
            eq: async () => ({ error: opts.deleteError ?? null }),
          }),
        }
      }
      return {}
    },
  }
}

describe('POST /api/association/members (invitare)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAssociationRole.mockResolvedValue('admin')
    mocks.createClient.mockResolvedValue(gateClient())
  })

  it('200: email valid, user existent, nu e membru → insert + notificare', async () => {
    resolveAuthUserIdByEmail.mockResolvedValue({ id: TARGET_UID, email: 'new@example.test' })
    const inserted = {
      id: MEMBER_ID,
      user_id: TARGET_UID,
      role: 'viewer',
      created_at: new Date().toISOString(),
      invited_by: ADMIN_UID,
    }
    mocks.getSupabaseAdmin.mockReturnValue(
      buildAdmin({
        existingMember: null,
        insertRow: inserted,
      }),
    )
    const req = createSameOriginRequest('/api/association/members', {
      method: 'POST',
      json: { email: 'new@example.test', role: 'viewer' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const j = (await res.json()) as { ok: boolean; data?: { member?: { email?: string } } }
    expect(j.ok).toBe(true)
    expect(j.data?.member?.email).toBe('new@example.test')
    expect(createNotification).toHaveBeenCalled()
  })

  it('400: body invalid (email lipsă)', async () => {
    mocks.getSupabaseAdmin.mockReturnValue(buildAdmin({}))
    const req = createSameOriginRequest('/api/association/members', {
      method: 'POST',
      json: { role: 'viewer' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('400: email invalid', async () => {
    mocks.getSupabaseAdmin.mockReturnValue(buildAdmin({}))
    const req = createSameOriginRequest('/api/association/members', {
      method: 'POST',
      json: { email: 'not-an-email', role: 'viewer' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('404: email fără cont în Zmeurel OS', async () => {
    resolveAuthUserIdByEmail.mockResolvedValue(null)
    mocks.getSupabaseAdmin.mockReturnValue(buildAdmin({}))
    const req = createSameOriginRequest('/api/association/members', {
      method: 'POST',
      json: { email: 'ghost@example.test', role: 'viewer' },
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('409: utilizator deja membru', async () => {
    resolveAuthUserIdByEmail.mockResolvedValue({ id: TARGET_UID, email: 'x@example.test' })
    mocks.getSupabaseAdmin.mockReturnValue(
      buildAdmin({
        existingMember: { id: MEMBER_ID },
      }),
    )
    const req = createSameOriginRequest('/api/association/members', {
      method: 'POST',
      json: { email: 'x@example.test', role: 'viewer' },
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })

  it('403: apelant nu e admin (moderator)', async () => {
    getAssociationRole.mockResolvedValue('moderator')
    const req = createSameOriginRequest('/api/association/members', {
      method: 'POST',
      json: { email: 'a@b.co', role: 'viewer' },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('403: apelant viewer', async () => {
    getAssociationRole.mockResolvedValue('viewer')
    const req = createSameOriginRequest('/api/association/members', {
      method: 'POST',
      json: { email: 'a@b.co', role: 'viewer' },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/association/members (rol)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAssociationRole.mockResolvedValue('admin')
    mocks.createClient.mockResolvedValue(gateClient())
  })

  it('200: schimbare rol validă', async () => {
    mocks.getSupabaseAdmin.mockReturnValue(
      buildAdmin({
        fetchMember: { id: MEMBER_ID, user_id: TARGET_UID, role: 'viewer' },
        updateRow: { id: MEMBER_ID, user_id: TARGET_UID, role: 'moderator', created_at: '', invited_by: null },
        adminCount: 2,
      }),
    )
    const req = createSameOriginRequest('/api/association/members', {
      method: 'PATCH',
      json: { memberId: MEMBER_ID, role: 'moderator' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    expect(createNotification).toHaveBeenCalled()
  })

  it('400: rol invalid (schema)', async () => {
    mocks.getSupabaseAdmin.mockReturnValue(buildAdmin({}))
    const req = createSameOriginRequest('/api/association/members', {
      method: 'PATCH',
      json: { memberId: MEMBER_ID, role: 'boss' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })

  it('403: apelant nu e admin', async () => {
    getAssociationRole.mockResolvedValue('moderator')
    const req = createSameOriginRequest('/api/association/members', {
      method: 'PATCH',
      json: { memberId: MEMBER_ID, role: 'viewer' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(403)
  })

  it('403: ultimul admin încearcă downgrade → LAST_ADMIN', async () => {
    mocks.getSupabaseAdmin.mockReturnValue(
      buildAdmin({
        fetchMember: { id: MEMBER_ID, user_id: TARGET_UID, role: 'admin' },
        adminCount: 1,
      }),
    )
    const req = createSameOriginRequest('/api/association/members', {
      method: 'PATCH',
      json: { memberId: MEMBER_ID, role: 'moderator' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(403)
    const j = (await res.json()) as { error?: { code?: string } }
    expect(j.error?.code).toBe('LAST_ADMIN')
  })

  it('403: adminul își schimbă propriul rol', async () => {
    mocks.getSupabaseAdmin.mockReturnValue(
      buildAdmin({
        fetchMember: { id: MEMBER_ID, user_id: ADMIN_UID, role: 'admin' },
        adminCount: 2,
      }),
    )
    const req = createSameOriginRequest('/api/association/members', {
      method: 'PATCH',
      json: { memberId: MEMBER_ID, role: 'viewer' },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(403)
    const j = (await res.json()) as { error?: { code?: string } }
    expect(j.error?.code).toBe('SELF_ROLE')
  })
})

describe('DELETE /api/association/members (revocare)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAssociationRole.mockResolvedValue('admin')
    mocks.createClient.mockResolvedValue(gateClient())
  })

  it('200: revocare membru valid', async () => {
    mocks.getSupabaseAdmin.mockReturnValue(
      buildAdmin({
        fetchMember: { id: MEMBER_ID, user_id: TARGET_UID, role: 'viewer' },
        adminCount: 2,
      }),
    )
    const req = createSameOriginRequest('/api/association/members', {
      method: 'DELETE',
      json: { memberId: MEMBER_ID },
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    expect(createNotification).toHaveBeenCalled()
  })

  it('403: adminul se revocă pe sine', async () => {
    mocks.getSupabaseAdmin.mockReturnValue(
      buildAdmin({
        fetchMember: { id: MEMBER_ID, user_id: ADMIN_UID, role: 'admin' },
      }),
    )
    const req = createSameOriginRequest('/api/association/members', {
      method: 'DELETE',
      json: { memberId: MEMBER_ID },
    })
    const res = await DELETE(req)
    expect(res.status).toBe(403)
    const j = (await res.json()) as { error?: { code?: string } }
    expect(j.error?.code).toBe('SELF_REVOKE')
  })

  it('403: ultimul admin nu poate fi revocat', async () => {
    mocks.getSupabaseAdmin.mockReturnValue(
      buildAdmin({
        fetchMember: { id: MEMBER_ID, user_id: TARGET_UID, role: 'admin' },
        adminCount: 1,
      }),
    )
    const req = createSameOriginRequest('/api/association/members', {
      method: 'DELETE',
      json: { memberId: MEMBER_ID },
    })
    const res = await DELETE(req)
    expect(res.status).toBe(403)
  })

  it('403: apelant nu e admin', async () => {
    getAssociationRole.mockResolvedValue('viewer')
    const req = createSameOriginRequest('/api/association/members', {
      method: 'DELETE',
      json: { memberId: MEMBER_ID },
    })
    const res = await DELETE(req)
    expect(res.status).toBe(403)
  })
})
