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

import { upsertPlanTratamentCuLinii } from '@/lib/supabase/queries/tratamente'

function createAwaitable<T>(result: T) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    in: vi.fn(() => builder),
    update: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (onFulfilled?: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }

  return builder
}

describe('upsertPlanTratamentCuLinii', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('apelează RPC-ul atomic cu parametrii așteptați', async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: {
        plan: {
          id: 'plan-1',
          tenant_id: 'tenant-1',
          nume: 'Plan zmeur 2026',
          cultura_tip: 'zmeur',
          descriere: null,
          activ: true,
          arhivat: false,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          created_by: null,
          updated_by: null,
        },
        linii: [
          {
            id: 'linie-1',
            tenant_id: 'tenant-1',
            plan_id: 'plan-1',
            ordine: 1,
            stadiu_trigger: 'buton_verde',
            cohort_trigger: 'floricane',
            produs_id: 'prod-1',
            produs_nume_manual: null,
            doza_ml_per_hl: 200,
            doza_l_per_ha: null,
            observatii: 'Test',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
        parcele_asociate: [],
      },
      error: null,
    })

    const planLiniiBuilder = createAwaitable({
      data: [
        {
          id: 'linie-1',
          tenant_id: 'tenant-1',
          plan_id: 'plan-1',
          ordine: 1,
          stadiu_trigger: 'buton_verde',
          cohort_trigger: 'floricane',
          produs_id: 'prod-1',
          produs_nume_manual: null,
          doza_ml_per_hl: 200,
          doza_l_per_ha: null,
          observatii: 'Test',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          produs: null,
        },
      ],
      error: null,
    })

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      rpc: rpcMock,
      from: vi.fn((table: string) => {
        if (table === 'planuri_tratament') {
          return createAwaitable({
            data: {
              id: 'plan-1',
              tenant_id: 'tenant-1',
              nume: 'Plan zmeur 2026',
              cultura_tip: 'zmeur',
              descriere: null,
              activ: true,
              arhivat: false,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
              created_by: null,
              updated_by: null,
            },
            error: null,
          })
        }

        if (table === 'planuri_tratament_linii') {
          return planLiniiBuilder
        }

        if (table === 'parcele_planuri') {
          return createAwaitable({
            data: [],
            error: null,
          })
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')

    const result = await upsertPlanTratamentCuLinii(
      {
        nume: 'Plan zmeur 2026',
        cultura_tip: 'zmeur',
        descriere: '  ',
      },
      [
        {
          ordine: 1,
          stadiu_trigger: 'buton_verde',
          cohort_trigger: null,
          produs_id: 'prod-1',
          produs_nume_manual: null,
          doza_ml_per_hl: 200,
          doza_l_per_ha: null,
          observatii: 'Test',
        },
      ],
      ['parcela-1'],
      2026
    )

    expect(rpcMock).toHaveBeenCalledWith('upsert_plan_tratament_cu_linii', {
      p_plan_id: null,
      p_plan_data: {
        nume: 'Plan zmeur 2026',
        cultura_tip: 'zmeur',
        descriere: null,
        activ: true,
        arhivat: false,
      },
      p_linii: [
        {
          ordine: 1,
          stadiu_trigger: 'buton_verde',
          cohort_trigger: null,
          produs_id: 'prod-1',
          produs_nume_manual: null,
          doza_ml_per_hl: 200,
          doza_l_per_ha: null,
          observatii: 'Test',
        },
      ],
      p_parcele_ids: ['parcela-1'],
      p_an: 2026,
    })

    expect(planLiniiBuilder.update).not.toHaveBeenCalled()
    expect(result.id).toBe('plan-1')
  })
})
