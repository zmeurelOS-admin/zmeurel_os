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
    produse: [
      {
        id: 'plan-linie-produs-1',
        tenant_id: 'tenant-1',
        plan_linie_id: '00000000-0000-4000-8000-000000000002',
        ordine: 1,
        produs_id: 'produs-1',
        produs_nume_manual: null,
        produs_nume_snapshot: 'Switch 62.5 WG',
        substanta_activa_snapshot: 'ciprodinil + fludioxonil',
        tip_snapshot: 'fungicid',
        frac_irac_snapshot: '9+12',
        phi_zile_snapshot: 7,
        doza_ml_per_hl: 80,
        doza_l_per_ha: null,
        observatii: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        produs: {
          id: 'produs-1',
          tenant_id: 'tenant-1',
          nume_comercial: 'Switch 62.5 WG',
          substanta_activa: 'ciprodinil + fludioxonil',
          tip: 'fungicid',
          frac_irac: '9+12',
          doza_min_ml_per_hl: null,
          doza_max_ml_per_hl: null,
          doza_min_l_per_ha: null,
          doza_max_l_per_ha: null,
          phi_zile: 7,
          nr_max_aplicari_per_sezon: null,
          interval_min_aplicari_zile: 10,
          omologat_culturi: ['zmeur'],
          activ: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          created_by: null,
        },
      },
    ],
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

function createAppliedAplicariBuilder(aplicari: unknown[]) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(async () => ({ data: aplicari, error: null })),
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

  it('blochează pregătirea dacă data cerută este înainte de repetarea recomandată', async () => {
    const existingBuilder = createExistingAplicareBuilder(null)
    const appliedBuilder = createAppliedAplicariBuilder([
      {
        id: 'aplicare-aplicata-1',
        tenant_id: 'tenant-1',
        parcela_id: '00000000-0000-4000-8000-000000000001',
        cultura_id: null,
        plan_linie_id: '00000000-0000-4000-8000-000000000002',
        produs_id: 'produs-1',
        produs_nume_manual: null,
        data_planificata: '2026-05-01',
        data_aplicata: '2026-05-01T08:00:00Z',
        doza_ml_per_hl: 80,
        doza_l_per_ha: null,
        cantitate_totala_ml: null,
        stoc_mutatie_id: null,
        status: 'aplicata',
        sursa: 'din_plan',
        tip_interventie: 'protectie',
        scop: null,
        stadiu_fenologic_id: null,
        diferente_fata_de_plan: null,
        meteo_snapshot: null,
        stadiu_la_aplicare: 'inflorit',
        cohort_la_aplicare: null,
        observatii: null,
        operator: null,
        created_at: '2026-05-01T08:00:00Z',
        updated_at: '2026-05-01T08:00:00Z',
        created_by: null,
        updated_by: null,
      },
    ])
    const linieBuilder = createPlanLinieBuilder()
    let aplicariCall = 0
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'planuri_tratament_linii') return linieBuilder
        if (table === 'aplicari_tratament') {
          aplicariCall += 1
          return aplicariCall === 1 ? existingBuilder : appliedBuilder
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)

    await expect(
      createAplicarePlanificataDinInterventie({
        parcela_id: '00000000-0000-4000-8000-000000000001',
        plan_linie_id: '00000000-0000-4000-8000-000000000002',
        data_planificata: '2026-05-07',
      }),
    ).rejects.toThrow(/următoarea repetare recomandată/i)
  })
})
