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

import { createAplicarePlanificataDinInterventie } from '@/lib/supabase/queries/tratamente'

function createExistingAplicareBuilder(existing: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: existing, error: null })),
  }

  return builder
}

function createPlanLinieBuilder(cohort: 'floricane' | 'primocane' | null = null) {
  const row = {
    id: '00000000-0000-4000-8000-000000000002',
    tenant_id: 'tenant-1',
    plan_id: 'plan-1',
    ordine: 1,
    stadiu_trigger: 'inflorit',
    cohort_trigger: cohort,
    tip_interventie: 'protectie',
    scop: null,
    regula_repetare: 'fara_repetare',
    interval_repetare_zile: null,
    numar_repetari_max: null,
    fereastra_start_offset_zile: null,
    fereastra_end_offset_zile: null,
    produs_id: null,
    produs_nume_manual: null,
    doza_ml_per_hl: null,
    doza_l_per_ha: null,
    observatii: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    produs: null,
    produse: [],
    plan: {
      id: 'plan-1',
      nume: 'Plan test',
      cultura_tip: 'zmeur',
      activ: true,
      arhivat: false,
    },
  }

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  }

  return builder
}

describe('createAplicarePlanificataDinInterventie', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')
  })

  it('caută aplicarea existentă pe aceeași cohortă când cohorta este prezentă', async () => {
    const existing = { id: 'aplicare-1' }
    const aplicariBuilder = createExistingAplicareBuilder(existing)
    const linieBuilder = createPlanLinieBuilder()
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'planuri_tratament_linii') return linieBuilder
        if (table === 'aplicari_tratament') return aplicariBuilder
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)

    const result = await createAplicarePlanificataDinInterventie({
      parcela_id: '00000000-0000-4000-8000-000000000001',
      plan_linie_id: '00000000-0000-4000-8000-000000000002',
      cohort_la_aplicare: 'floricane',
    })

    expect(result).toBe(existing)
    expect(aplicariBuilder.eq).toHaveBeenCalledWith('cohort_la_aplicare', 'floricane')
    expect(aplicariBuilder.is).not.toHaveBeenCalledWith('cohort_la_aplicare', null)
  })

  it('caută aplicarea existentă fără cohortă când cohorta lipsește', async () => {
    const existing = { id: 'aplicare-2' }
    const aplicariBuilder = createExistingAplicareBuilder(existing)
    const linieBuilder = createPlanLinieBuilder()
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'planuri_tratament_linii') return linieBuilder
        if (table === 'aplicari_tratament') return aplicariBuilder
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)

    const result = await createAplicarePlanificataDinInterventie({
      parcela_id: '00000000-0000-4000-8000-000000000001',
      plan_linie_id: '00000000-0000-4000-8000-000000000002',
      cohort_la_aplicare: null,
    })

    expect(result).toBe(existing)
    expect(aplicariBuilder.is).toHaveBeenCalledWith('cohort_la_aplicare', null)
  })

  it('folosește cohorta intervenției când inputul nu trimite cohortă explicită', async () => {
    const existing = { id: 'aplicare-3' }
    const aplicariBuilder = createExistingAplicareBuilder(existing)
    const linieBuilder = createPlanLinieBuilder('primocane')
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'planuri_tratament_linii') return linieBuilder
        if (table === 'aplicari_tratament') return aplicariBuilder
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)

    const result = await createAplicarePlanificataDinInterventie({
      parcela_id: '00000000-0000-4000-8000-000000000001',
      plan_linie_id: '00000000-0000-4000-8000-000000000002',
    })

    expect(result).toBe(existing)
    expect(aplicariBuilder.eq).toHaveBeenCalledWith('cohort_la_aplicare', 'primocane')
  })
})
