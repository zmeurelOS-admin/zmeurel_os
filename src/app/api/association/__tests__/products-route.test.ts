import { describe, expect, it, vi, beforeEach } from 'vitest'

import { PATCH } from '@/app/api/association/products/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const getAssociationRole = vi.fn()
vi.mock('@/lib/association/auth', () => ({
  getAssociationRole: (uid: string) => getAssociationRole(uid),
}))

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

const PID = '660e8400-e29b-41d4-a716-446655440001'
const TID = '660e8400-e29b-41d4-a716-446655440002'
const UID = '770e8400-e29b-41d4-a716-446655440003'

function buildProduseApi(opts: {
  user: { id: string } | null
  fetchData: Record<string, unknown> | null
  fetchError?: unknown
  updateData: Record<string, unknown> | null
  updateError?: unknown
}) {
  return {
    auth: {
      getUser: async () => ({ data: { user: opts.user }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () =>
            opts.fetchError != null
              ? { data: null, error: opts.fetchError }
              : { data: opts.fetchData, error: null },
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: async () =>
              opts.updateError != null
                ? { data: null, error: opts.updateError }
                : { data: opts.updateData, error: null },
          }),
        }),
      }),
    }),
  }
}

describe('PATCH /api/association/products', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PATCH cu association_listed: true → 200', async () => {
    getAssociationRole.mockResolvedValue('moderator')
    const updated = {
      id: PID,
      tenant_id: TID,
      nume: 'P',
      association_listed: true,
      association_price: null,
      updated_at: new Date().toISOString(),
      tenants: { nume_ferma: 'Ferma', is_association_approved: true },
    }
    mocks.createClient.mockResolvedValue(
      buildProduseApi({
        user: { id: UID },
        fetchData: {
          id: PID,
          tenant_id: TID,
          tenants: { is_association_approved: true },
        },
        updateData: updated,
      }),
    )
    const req = createSameOriginRequest('/api/association/products', {
      method: 'PATCH',
      json: { productId: PID, association_listed: true },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)
  })

  it('PATCH fără auth → 401', async () => {
    mocks.createClient.mockResolvedValue(
      buildProduseApi({
        user: null,
        fetchData: null,
        updateData: null,
      }),
    )
    const req = createSameOriginRequest('/api/association/products', {
      method: 'PATCH',
      json: { productId: PID, association_listed: true },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it('PATCH cu viewer → 403', async () => {
    getAssociationRole.mockResolvedValue('viewer')
    mocks.createClient.mockResolvedValue(
      buildProduseApi({
        user: { id: UID },
        fetchData: null,
        updateData: null,
      }),
    )
    const req = createSameOriginRequest('/api/association/products', {
      method: 'PATCH',
      json: { productId: PID, association_listed: true },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(403)
  })

  it('PATCH pe produs tenant neaprobat → 403', async () => {
    getAssociationRole.mockResolvedValue('admin')
    mocks.createClient.mockResolvedValue(
      buildProduseApi({
        user: { id: UID },
        fetchData: {
          id: PID,
          tenant_id: TID,
          tenants: { is_association_approved: false },
        },
        updateData: null,
      }),
    )
    const req = createSameOriginRequest('/api/association/products', {
      method: 'PATCH',
      json: { productId: PID, association_listed: true },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(403)
  })

  it('PATCH cu body invalid → 400', async () => {
    getAssociationRole.mockResolvedValue('admin')
    mocks.createClient.mockResolvedValue(
      buildProduseApi({
        user: { id: UID },
        fetchData: {},
        updateData: null,
      }),
    )
    const req = createSameOriginRequest('/api/association/products', {
      method: 'PATCH',
      json: { productId: 'not-uuid', association_listed: true },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})
