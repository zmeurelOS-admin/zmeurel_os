import { describe, expect, it, vi, beforeEach } from 'vitest'

import { PATCH } from '@/app/api/association/products/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const createNotificationForTenantOwner = vi.fn()
vi.mock('@/lib/notifications/create', () => ({
  createNotificationForTenantOwner: (...a: unknown[]) => createNotificationForTenantOwner(...a),
  NOTIFICATION_TYPES: { product_listed: 'product_listed', product_unlisted: 'product_unlisted' },
}))

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

const approvedTenant = {
  id: PID,
  tenant_id: TID,
  tenants: { is_association_approved: true },
}

describe('PATCH /api/association/products — extended', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('association_listed: true → 200, produs listat', async () => {
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
        fetchData: approvedTenant,
        updateData: updated,
      }),
    )
    const req = createSameOriginRequest('/api/association/products', {
      method: 'PATCH',
      json: { productId: PID, association_listed: true },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    expect(createNotificationForTenantOwner).toHaveBeenCalled()
  })

  it('association_listed: false → 200, produs nelistat', async () => {
    getAssociationRole.mockResolvedValue('admin')
    const updated = {
      id: PID,
      tenant_id: TID,
      nume: 'P',
      association_listed: false,
      association_price: null,
      updated_at: new Date().toISOString(),
      tenants: { nume_ferma: 'Ferma', is_association_approved: true },
    }
    mocks.createClient.mockResolvedValue(
      buildProduseApi({
        user: { id: UID },
        fetchData: approvedTenant,
        updateData: updated,
      }),
    )
    const req = createSameOriginRequest('/api/association/products', {
      method: 'PATCH',
      json: { productId: PID, association_listed: false },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
  })

  it('403: viewer nu poate modifica', async () => {
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

  it('403: produs tenant neaprobat', async () => {
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

  it('association_price: setare override → salvat', async () => {
    getAssociationRole.mockResolvedValue('admin')
    const updated = {
      id: PID,
      tenant_id: TID,
      nume: 'P',
      association_price: 33.5,
      updated_at: new Date().toISOString(),
      tenants: { nume_ferma: 'F', is_association_approved: true },
    }
    mocks.createClient.mockResolvedValue(
      buildProduseApi({
        user: { id: UID },
        fetchData: approvedTenant,
        updateData: updated,
      }),
    )
    const req = createSameOriginRequest('/api/association/products', {
      method: 'PATCH',
      json: { productId: PID, association_price: 33.5 },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const j = (await res.json()) as { data?: { association_price?: number } }
    expect(j.data?.association_price).toBe(33.5)
  })

  it('association_price: null → revenire la preț fermier (DB)', async () => {
    getAssociationRole.mockResolvedValue('moderator')
    const updated = {
      id: PID,
      tenant_id: TID,
      association_price: null,
      pret_unitar: 20,
      updated_at: new Date().toISOString(),
      tenants: { nume_ferma: 'F', is_association_approved: true },
    }
    mocks.createClient.mockResolvedValue(
      buildProduseApi({
        user: { id: UID },
        fetchData: approvedTenant,
        updateData: updated,
      }),
    )
    const req = createSameOriginRequest('/api/association/products', {
      method: 'PATCH',
      json: { productId: PID, association_price: null },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
  })

  it('400: preț negativ respins (schema)', async () => {
    getAssociationRole.mockResolvedValue('admin')
    mocks.createClient.mockResolvedValue(
      buildProduseApi({
        user: { id: UID },
        fetchData: approvedTenant,
        updateData: null,
      }),
    )
    const req = createSameOriginRequest('/api/association/products', {
      method: 'PATCH',
      json: { productId: PID, association_price: -1 },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
  })
})
