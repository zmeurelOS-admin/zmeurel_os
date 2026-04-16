import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PATCH } from '@/app/api/association/products/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const createNotificationForTenantOwner = vi.fn()
vi.mock('@/lib/notifications/create', () => ({
  createNotificationForTenantOwner: (...args: unknown[]) => createNotificationForTenantOwner(...args),
  NOTIFICATION_TYPES: { product_listed: 'product_listed', product_unlisted: 'product_unlisted' },
}))

const getAssociationRole = vi.fn()
vi.mock('@/lib/association/auth', () => ({
  getAssociationRole: (uid: string) => getAssociationRole(uid),
}))

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  updateSpy: vi.fn(),
  deleteSpy: vi.fn(),
  rpcSpy: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

const PID = '660e8400-e29b-41d4-a716-446655440001'
const TID = '660e8400-e29b-41d4-a716-446655440002'
const UID = '770e8400-e29b-41d4-a716-446655440003'

function buildPatchClient(opts: {
  user: { id: string } | null
  fetchData:
    | {
        id: string
        association_category: string | null
        tenant_id: string
        tenants:
          | { is_association_approved: boolean; is_demo?: boolean | null }
          | Array<{ is_association_approved: boolean; is_demo?: boolean | null }>
      }
    | null
  fetchError?: unknown
  updateData:
    | {
        id: string
        tenant_id: string
        nume: string
        association_listed: boolean
        association_price: number | null
        association_category?: string | null
        updated_at: string
        tenants: { nume_ferma: string; is_association_approved: boolean }
      }
    | null
  updateError?: unknown
  legalDocsComplete?: boolean
  legalError?: unknown
}) {
  return {
    auth: {
      getUser: async () => ({ data: { user: opts.user }, error: null }),
    },
    from: (table: string) => {
      if (table !== 'produse') {
        throw new Error(`Unexpected table in patch client mock: ${table}`)
      }

      return {
        select: () => ({
          eq: () => ({
            single: async () =>
              opts.fetchError != null
                ? { data: null, error: opts.fetchError }
                : { data: opts.fetchData, error: null },
          }),
        }),
        update: (payload: unknown) => {
          mocks.updateSpy(payload)
          return {
            eq: () => ({
              select: () => ({
                single: async () =>
                  opts.updateError != null
                    ? { data: null, error: opts.updateError }
                    : { data: opts.updateData, error: null },
              }),
            }),
          }
        },
        delete: () => {
          mocks.deleteSpy()
          return {
            eq: async () => ({ error: null }),
          }
        },
      }
    },
    rpc: async () => {
      mocks.rpcSpy()
      return opts.legalError != null
        ? { data: null, error: opts.legalError }
        : { data: opts.legalDocsComplete ?? true, error: null }
    },
  }
}

const approvedFetchRow = {
  id: PID,
  association_category: 'fructe_legume',
  tenant_id: TID,
  tenants: { is_association_approved: true, is_demo: false },
}

describe('PATCH /api/association/products — catalog actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAssociationRole.mockResolvedValue('admin')
  })

  it('2.1 elimină din catalog → 200 și PATCH fără DELETE', async () => {
    mocks.createClient.mockResolvedValue(
      buildPatchClient({
        user: { id: UID },
        fetchData: approvedFetchRow,
        updateData: {
          id: PID,
          tenant_id: TID,
          nume: 'Produs test',
          association_listed: false,
          association_price: null,
          association_category: 'fructe_legume',
          updated_at: new Date().toISOString(),
          tenants: { nume_ferma: 'Ferma', is_association_approved: true },
        },
      }),
    )

    const req = createSameOriginRequest('/api/association/products', {
      method: 'PATCH',
      json: { productId: PID, association_listed: false, association_price: null },
    })

    const res = await PATCH(req)
    const payload = mocks.updateSpy.mock.calls[0]?.[0] as Record<string, unknown>
    const { updated_at, ...rest } = payload

    expect(res.status).toBe(200)
    expect(typeof updated_at).toBe('string')
    expect(rest).toEqual({
      association_listed: false,
      association_price: null,
    })
    expect(mocks.deleteSpy).not.toHaveBeenCalled()
  })

  it('2.2 toggle ON → OFF → 200 și update corect', async () => {
    mocks.createClient.mockResolvedValue(
      buildPatchClient({
        user: { id: UID },
        fetchData: approvedFetchRow,
        updateData: {
          id: PID,
          tenant_id: TID,
          nume: 'Produs test',
          association_listed: false,
          association_price: 21,
          association_category: 'fructe_legume',
          updated_at: new Date().toISOString(),
          tenants: { nume_ferma: 'Ferma', is_association_approved: true },
        },
      }),
    )

    const req = createSameOriginRequest('/api/association/products', {
      method: 'PATCH',
      json: { productId: PID, association_listed: false },
    })

    const res = await PATCH(req)
    const payload = mocks.updateSpy.mock.calls[0]?.[0] as Record<string, unknown>
    const { updated_at, ...rest } = payload

    expect(res.status).toBe(200)
    expect(typeof updated_at).toBe('string')
    expect(rest).toEqual({ association_listed: false })
    expect(mocks.deleteSpy).not.toHaveBeenCalled()
  })

  it('2.3 toggle OFF → ON → 200 și update corect', async () => {
    mocks.createClient.mockResolvedValue(
      buildPatchClient({
        user: { id: UID },
        fetchData: approvedFetchRow,
        updateData: {
          id: PID,
          tenant_id: TID,
          nume: 'Produs test',
          association_listed: true,
          association_price: 21,
          association_category: 'fructe_legume',
          updated_at: new Date().toISOString(),
          tenants: { nume_ferma: 'Ferma', is_association_approved: true },
        },
        legalDocsComplete: true,
      }),
    )

    const req = createSameOriginRequest('/api/association/products', {
      method: 'PATCH',
      json: { productId: PID, association_listed: true },
    })

    const res = await PATCH(req)
    const payload = mocks.updateSpy.mock.calls[0]?.[0] as Record<string, unknown>
    const { updated_at, ...rest } = payload

    expect(res.status).toBe(200)
    expect(typeof updated_at).toBe('string')
    expect(rest).toEqual({ association_listed: true })
    expect(mocks.rpcSpy).toHaveBeenCalledTimes(1)
    expect(mocks.deleteSpy).not.toHaveBeenCalled()
  })
})
