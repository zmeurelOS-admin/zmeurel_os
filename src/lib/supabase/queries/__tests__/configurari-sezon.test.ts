import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock, getTenantIdByUserIdMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getTenantIdByUserIdMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/tenant/get-tenant', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tenant/get-tenant')>('@/lib/tenant/get-tenant')
  return {
    ...actual,
    getTenantIdByUserId: getTenantIdByUserIdMock,
  }
})

import { getOrCreateConfigurareSezon } from '@/lib/supabase/queries/configurari-sezon'

function buildSupabase(existingRow: Record<string, unknown> | null) {
  const state = {
    existingRow,
    insertedPayload: null as Record<string, unknown> | null,
  }

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table !== 'configurari_parcela_sezon') {
        throw new Error(`Unexpected table: ${table}`)
      }

      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => ({ data: state.existingRow, error: null })),
        insert: vi.fn((payload: Record<string, unknown>) => {
          state.insertedPayload = payload
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: 'cfg-new',
                  tenant_id: String(payload.tenant_id),
                  parcela_id: String(payload.parcela_id),
                  an: Number(payload.an),
                  sistem_conducere: payload.sistem_conducere ?? null,
                  tip_ciclu_soi: payload.tip_ciclu_soi ?? null,
                  created_at: '2026-01-01T00:00:00Z',
                  updated_at: '2026-01-01T00:00:00Z',
                },
                error: null,
              })),
            })),
          }
        }),
      }

      return builder
    }),
  }

  return { supabase, state }
}

describe('getOrCreateConfigurareSezon', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')
  })

  it('auto-populează Maravilla ca mixt_floricane_primocane', async () => {
    const { supabase, state } = buildSupabase(null)
    createClientMock.mockResolvedValue(supabase)

    const result = await getOrCreateConfigurareSezon(
      {
        id: 'parcela-1',
        tenant_id: 'tenant-1',
        cultura: 'Zmeur',
        tip_fruct: 'Zmeura',
        soi: 'Maravilla',
        soi_plantat: 'Maravilla',
      } as never,
      2026
    )

    expect(state.insertedPayload?.sistem_conducere).toBe('mixt_floricane_primocane')
    expect(result.sistem_conducere).toBe('mixt_floricane_primocane')
    expect(result.tip_ciclu_soi).toBeNull()
  })

  it('auto-populează Delniwa ca primocane_only', async () => {
    const { supabase, state } = buildSupabase(null)
    createClientMock.mockResolvedValue(supabase)

    const result = await getOrCreateConfigurareSezon(
      {
        id: 'parcela-2',
        tenant_id: 'tenant-1',
        cultura: 'Zmeur',
        tip_fruct: 'Zmeura',
        soi: 'Delniwa',
        soi_plantat: 'Delniwa',
      } as never,
      2026
    )

    expect(state.insertedPayload?.sistem_conducere).toBe('primocane_only')
    expect(result.sistem_conducere).toBe('primocane_only')
  })

  it('lasă null pentru un soi Rubus necunoscut', async () => {
    const { supabase, state } = buildSupabase(null)
    createClientMock.mockResolvedValue(supabase)

    const result = await getOrCreateConfigurareSezon(
      {
        id: 'parcela-3',
        tenant_id: 'tenant-1',
        cultura: 'Zmeur',
        tip_fruct: 'Zmeura',
        soi: 'Alt soi',
        soi_plantat: 'Alt soi',
      } as never,
      2026
    )

    expect(state.insertedPayload?.sistem_conducere).toBeNull()
    expect(result.sistem_conducere).toBeNull()
  })
})

