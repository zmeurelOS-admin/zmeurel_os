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

import { getTratamenteGlobalStats } from '@/lib/supabase/queries/tratamente'

function createAwaitable<T>(result: T) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (onFulfilled?: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }

  return builder
}

function buildAplicareRow(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 'ap-1',
    tenant_id: 'tenant-1',
    parcela_id: overrides.parcela_id ?? 'parcela-1',
    cultura_id: null,
    plan_linie_id: overrides.plan_linie_id ?? 'linie-1',
    produs_id: overrides.produs_id ?? 'produs-1',
    produs_nume_manual: null,
    data_planificata: overrides.data_planificata ?? '2026-04-18',
    data_aplicata: overrides.data_aplicata ?? null,
    doza_ml_per_hl: overrides.doza_ml_per_hl ?? null,
    doza_l_per_ha: overrides.doza_l_per_ha ?? 1,
    cantitate_totala_ml: overrides.cantitate_totala_ml ?? null,
    stoc_mutatie_id: null,
    status: overrides.status ?? 'aplicata',
    meteo_snapshot: null,
    stadiu_la_aplicare: null,
    observatii: null,
    operator: null,
    created_at: '2026-04-10T08:00:00Z',
    updated_at: '2026-04-10T08:00:00Z',
    created_by: null,
    updated_by: null,
    produs: {
      id: overrides.produs_id ?? 'produs-1',
      tenant_id: 'tenant-1',
      nume_comercial: overrides.nume_comercial ?? 'Produs test',
      substanta_activa: overrides.substanta_activa ?? 'substanță activă',
      tip: overrides.tip ?? 'fungicid',
      frac_irac: overrides.frac_irac ?? 'FRAC 3',
      phi_zile: overrides.phi_zile ?? 7,
      nr_max_aplicari_per_sezon: null,
      activ: true,
    },
    linie: {
      id: overrides.plan_linie_id ?? 'linie-1',
      tenant_id: 'tenant-1',
      plan_id: overrides.plan_id ?? 'plan-1',
      ordine: overrides.ordine ?? 1,
      stadiu_trigger: overrides.stadiu_trigger ?? 'inflorit',
      produs_id: overrides.produs_id ?? 'produs-1',
      produs_nume_manual: null,
      doza_ml_per_hl: overrides.doza_ml_per_hl ?? null,
      doza_l_per_ha: overrides.doza_l_per_ha ?? 1,
      observatii: null,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
      plan: {
        id: overrides.plan_id ?? 'plan-1',
        nume: 'Plan test',
        cultura_tip: 'zmeur',
        activ: true,
        arhivat: false,
      },
    },
    parcela: {
      id: overrides.parcela_id ?? 'parcela-1',
      id_parcela: overrides.parcela_cod ?? 'P-1',
      nume_parcela: overrides.parcela_nume ?? 'Parcela Nord',
      suprafata_m2: overrides.suprafata_m2 ?? 10000,
      cultura: 'zmeur',
      tip_fruct: 'zmeur',
      soi: 'Delniwa',
      tip_unitate: 'camp',
    },
  }
}

describe('getTratamenteGlobalStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pentru tenant fără date întoarce toate valorile 0', async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'aplicari_tratament') {
          return createAwaitable({ data: [], error: null })
        }
        if (table === 'parcele_planuri') {
          return createAwaitable({ data: [], error: null })
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')

    await expect(getTratamenteGlobalStats(2026)).resolves.toEqual({
      aplicariAzi: 0,
      aplicariMaine: 0,
      aplicariAplicateSezon: 0,
      parceleCuPlan: 0,
      alerteFracTotal: 0,
      alerteCupruTotal: 0,
    })
  })

  it('calculează corect valorile pentru date mixte', async () => {
    const aplicariRows = [
      buildAplicareRow({
        id: 'plan-azi',
        status: 'planificata',
        data_planificata: '2026-04-18',
        data_aplicata: null,
        parcela_id: 'parcela-plan',
        produs_id: 'prod-plan',
        nume_comercial: 'Switch',
      }),
      buildAplicareRow({
        id: 'replan-azi',
        status: 'reprogramata',
        data_planificata: '2026-04-18',
        data_aplicata: null,
        parcela_id: 'parcela-plan',
        produs_id: 'prod-plan-2',
        nume_comercial: 'Mospilan',
      }),
      buildAplicareRow({
        id: 'plan-maine',
        status: 'planificata',
        data_planificata: '2026-04-19',
        data_aplicata: null,
        parcela_id: 'parcela-plan',
        produs_id: 'prod-plan-3',
        nume_comercial: 'Teldor',
      }),
      buildAplicareRow({
        id: 'frac-1',
        parcela_id: 'parcela-frac',
        produs_id: 'prod-frac',
        data_planificata: '2026-04-10',
        data_aplicata: '2026-04-10T06:00:00Z',
        frac_irac: 'FRAC 3',
        substanta_activa: 'penconazol',
      }),
      buildAplicareRow({
        id: 'frac-2',
        parcela_id: 'parcela-frac',
        produs_id: 'prod-frac',
        plan_linie_id: 'linie-frac-2',
        data_planificata: '2026-04-11',
        data_aplicata: '2026-04-11T06:00:00Z',
        frac_irac: 'FRAC 3',
        substanta_activa: 'penconazol',
        ordine: 2,
      }),
      buildAplicareRow({
        id: 'frac-3',
        parcela_id: 'parcela-frac',
        produs_id: 'prod-frac',
        plan_linie_id: 'linie-frac-3',
        data_planificata: '2026-04-12',
        data_aplicata: '2026-04-12T06:00:00Z',
        frac_irac: 'FRAC 3',
        substanta_activa: 'penconazol',
        ordine: 3,
      }),
      ...Array.from({ length: 12 }, (_, index) =>
        buildAplicareRow({
          id: `cupru-${index + 1}`,
          parcela_id: 'parcela-cupru',
          produs_id: 'prod-cupru',
          plan_linie_id: `linie-cupru-${index + 1}`,
          data_planificata: `2026-03-${String(index + 1).padStart(2, '0')}`,
          data_aplicata: `2026-03-${String(index + 1).padStart(2, '0')}T06:00:00Z`,
          nume_comercial: 'Kocide 2000',
          substanta_activa: 'hidroxid de cupru',
          frac_irac: 'FRAC M01',
          doza_l_per_ha: 1,
          ordine: index + 1,
        })
      ),
    ]

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'aplicari_tratament') {
          return createAwaitable({ data: aplicariRows, error: null })
        }
        if (table === 'parcele_planuri') {
          return createAwaitable({
            data: [
              { parcela_id: 'parcela-frac' },
              { parcela_id: 'parcela-cupru' },
              { parcela_id: 'parcela-cupru' },
            ],
            error: null,
          })
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')

    await expect(getTratamenteGlobalStats(2026)).resolves.toEqual({
      aplicariAzi: 2,
      aplicariMaine: 1,
      aplicariAplicateSezon: 15,
      parceleCuPlan: 2,
      alerteFracTotal: 2,
      alerteCupruTotal: 1,
    })
  })
})
