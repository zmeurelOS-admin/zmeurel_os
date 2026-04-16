import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/association/products/create/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const getAssociationRole = vi.fn()
vi.mock('@/lib/association/auth', () => ({
  getAssociationRole: (uid: string) => getAssociationRole(uid),
}))

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  insertSpy: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => mocks.getSupabaseAdmin(),
}))

const UID = '770e8400-e29b-41d4-a716-446655440003'
const TID = '660e8400-e29b-41d4-a716-446655440002'
const OWNER_UID = '550e8400-e29b-41d4-a716-446655440004'
const PRODUCT_ID = '440e8400-e29b-41d4-a716-446655440005'

function buildCreateClient(opts: {
  user: { id: string } | null
  tenant?: {
    id: string
    owner_user_id: string | null
    nume_ferma: string | null
    is_association_approved: boolean
    is_demo: boolean | null
  } | null
  tenantError?: unknown
  associationMembership?: { id: string } | null
  membershipError?: unknown
  legalDocsComplete?: boolean
  legalError?: unknown
}) {
  return {
    auth: {
      getUser: async () => ({ data: { user: opts.user }, error: null }),
    },
    from: (table: string) => {
      if (table === 'tenants') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () =>
                opts.tenantError != null
                  ? { data: null, error: opts.tenantError }
                  : { data: opts.tenant ?? null, error: null },
            }),
          }),
        }
      }

      if (table === 'association_members') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () =>
                opts.membershipError != null
                  ? { data: null, error: opts.membershipError }
                  : { data: opts.associationMembership ?? null, error: null },
            }),
          }),
        }
      }

      throw new Error(`Unexpected table in create client mock: ${table}`)
    },
    rpc: async () =>
      opts.legalError != null
        ? { data: null, error: opts.legalError }
        : { data: opts.legalDocsComplete ?? true, error: null },
  }
}

function buildAdmin(opts: {
  created?:
    | {
        id: string
        tenant_id: string
        nume: string
        categorie: string
        pret_unitar: number
        unitate_vanzare: string
        status: string
        moneda: string
        association_listed: boolean
        association_price: number | null
        association_category: string | null
        descriere: string | null
        created_at: string
        updated_at: string
        tenants: { nume_ferma: string | null; is_association_approved: boolean | null }
      }
    | null
  createError?: unknown
}) {
  return {
    from: (table: string) => {
      if (table !== 'produse') {
        throw new Error(`Unexpected admin table: ${table}`)
      }

      return {
        insert: (payload: unknown) => {
          mocks.insertSpy(payload)
          return {
            select: () => ({
              single: async () =>
                opts.createError != null
                  ? { data: null, error: opts.createError }
                  : { data: opts.created ?? null, error: null },
            }),
          }
        },
      }
    },
  }
}

describe('POST /api/association/products/create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAssociationRole.mockResolvedValue('admin')
  })

  it('1.1 creare reușită → 200 și insert cu status activ + moneda RON', async () => {
    mocks.createClient.mockResolvedValue(
      buildCreateClient({
        user: { id: UID },
        tenant: {
          id: TID,
          owner_user_id: OWNER_UID,
          nume_ferma: 'Ferma aprobată',
          is_association_approved: true,
          is_demo: false,
        },
        associationMembership: { id: 'member-1' },
        legalDocsComplete: true,
      }),
    )

    mocks.getSupabaseAdmin.mockReturnValue(
      buildAdmin({
        created: {
          id: PRODUCT_ID,
          tenant_id: TID,
          nume: 'Mure',
          categorie: 'fruct',
          pret_unitar: 25,
          unitate_vanzare: 'kg',
          status: 'activ',
          moneda: 'RON',
          association_listed: false,
          association_price: null,
          association_category: null,
          descriere: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tenants: { nume_ferma: 'Ferma aprobată', is_association_approved: true },
        },
      }),
    )

    const req = createSameOriginRequest('/api/association/products/create', {
      method: 'POST',
      json: {
        tenant_id: TID,
        nume: 'Mure',
        categorie: 'fruct',
        pret_unitar: 25,
        unitate_vanzare: 'kg',
      },
    })

    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mocks.insertSpy).toHaveBeenCalledTimes(1)
    expect(mocks.insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TID,
        nume: 'Mure',
        categorie: 'fruct',
        pret_unitar: 25,
        unitate_vanzare: 'kg',
        status: 'activ',
        moneda: 'RON',
      }),
    )
  })

  it('1.2 respingere cross-asociație → 403', async () => {
    mocks.createClient.mockResolvedValue(
      buildCreateClient({
        user: { id: UID },
        tenant: {
          id: TID,
          owner_user_id: OWNER_UID,
          nume_ferma: 'Ferma din altă asociație',
          is_association_approved: true,
          is_demo: false,
        },
        associationMembership: null,
      }),
    )

    const req = createSameOriginRequest('/api/association/products/create', {
      method: 'POST',
      json: {
        tenant_id: TID,
        nume: 'Mure',
        categorie: 'fruct',
        pret_unitar: 25,
        unitate_vanzare: 'kg',
      },
    })

    const res = await POST(req)
    const body = (await res.json()) as { error?: string }

    expect(res.status).toBe(403)
    expect(body).toEqual({ error: 'Fermierul nu aparține asociației tale.' })
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('1.3 respingere fermier neaprobat → 403 TENANT_NOT_APPROVED', async () => {
    mocks.createClient.mockResolvedValue(
      buildCreateClient({
        user: { id: UID },
        tenant: {
          id: TID,
          owner_user_id: OWNER_UID,
          nume_ferma: 'Ferma neaprobată',
          is_association_approved: false,
          is_demo: false,
        },
      }),
    )

    const req = createSameOriginRequest('/api/association/products/create', {
      method: 'POST',
      json: {
        tenant_id: TID,
        nume: 'Mure',
        categorie: 'fruct',
        pret_unitar: 25,
        unitate_vanzare: 'kg',
      },
    })

    const res = await POST(req)
    const body = (await res.json()) as { error?: { code?: string } }

    expect(res.status).toBe(403)
    expect(body.error?.code).toBe('TENANT_NOT_APPROVED')
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it.each([
    ['fără nume', { tenant_id: TID, categorie: 'fruct', pret_unitar: 25, unitate_vanzare: 'kg' }],
    ['fără tenant_id', { nume: 'Mure', categorie: 'fruct', pret_unitar: 25, unitate_vanzare: 'kg' }],
    ['fără pret_unitar', { tenant_id: TID, nume: 'Mure', categorie: 'fruct', unitate_vanzare: 'kg' }],
    ['fără categorie', { tenant_id: TID, nume: 'Mure', pret_unitar: 25, unitate_vanzare: 'kg' }],
    ['fără unitate_vanzare', { tenant_id: TID, nume: 'Mure', categorie: 'fruct', pret_unitar: 25 }],
  ])('1.4 câmpuri obligatorii lipsă: %s → 400', async (_label, payload) => {
    mocks.createClient.mockResolvedValue(
      buildCreateClient({
        user: { id: UID },
      }),
    )

    const req = createSameOriginRequest('/api/association/products/create', {
      method: 'POST',
      json: payload,
    })

    const res = await POST(req)
    const body = (await res.json()) as { error?: { code?: string } }

    expect(res.status).toBe(400)
    expect(body.error?.code).toBe('INVALID_BODY')
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('1.5 acces neautorizat: user neautentificat → 401', async () => {
    mocks.createClient.mockResolvedValue(
      buildCreateClient({
        user: null,
      }),
    )

    const req = createSameOriginRequest('/api/association/products/create', {
      method: 'POST',
      json: {
        tenant_id: TID,
        nume: 'Mure',
        categorie: 'fruct',
        pret_unitar: 25,
        unitate_vanzare: 'kg',
      },
    })

    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('1.5 acces neautorizat: viewer → 403', async () => {
    getAssociationRole.mockResolvedValue('viewer')
    mocks.createClient.mockResolvedValue(
      buildCreateClient({
        user: { id: UID },
      }),
    )

    const req = createSameOriginRequest('/api/association/products/create', {
      method: 'POST',
      json: {
        tenant_id: TID,
        nume: 'Mure',
        categorie: 'fruct',
        pret_unitar: 25,
        unitate_vanzare: 'kg',
      },
    })

    const res = await POST(req)

    expect(res.status).toBe(403)
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
  })
})
