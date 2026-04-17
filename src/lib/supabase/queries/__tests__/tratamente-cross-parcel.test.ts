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

import {
  getStatisticiAplicariCrossParcel,
  listAplicariCrossParcelPentruInterval,
} from '@/lib/supabase/queries/tratamente'

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

describe('tratamente cross-parcel queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mapează structura aplicărilor cross-parcel cu plan, produs și parcelă', async () => {
    const aplicariRows = [
      {
        id: 'ap-1',
        tenant_id: 'tenant-1',
        parcela_id: 'parcela-1',
        cultura_id: null,
        plan_linie_id: 'linie-1',
        produs_id: 'produs-1',
        produs_nume_manual: null,
        data_planificata: '2026-04-18',
        data_aplicata: null,
        doza_ml_per_hl: 80,
        doza_l_per_ha: null,
        cantitate_totala_ml: null,
        stoc_mutatie_id: null,
        status: 'planificata',
        meteo_snapshot: null,
        stadiu_la_aplicare: null,
        observatii: 'Aplicați dimineața',
        operator: null,
        created_at: '2026-04-15T08:00:00Z',
        updated_at: '2026-04-15T08:00:00Z',
        created_by: null,
        updated_by: null,
        produs: {
          id: 'produs-1',
          tenant_id: 'tenant-1',
          nume_comercial: 'Switch 62.5 WG',
          substanta_activa: 'cyprodinil',
          tip: 'fungicid',
          frac_irac: '9+12',
          phi_zile: 7,
          nr_max_aplicari_per_sezon: null,
          activ: true,
        },
        linie: {
          id: 'linie-1',
          tenant_id: 'tenant-1',
          plan_id: 'plan-1',
          ordine: 1,
          stadiu_trigger: 'inflorit',
          produs_id: 'produs-1',
          produs_nume_manual: null,
          doza_ml_per_hl: 80,
          doza_l_per_ha: null,
          observatii: null,
          created_at: '2026-04-01T00:00:00Z',
          updated_at: '2026-04-01T00:00:00Z',
          plan: {
            id: 'plan-1',
            nume: 'Plan zmeur 2026',
            cultura_tip: 'zmeur',
            activ: true,
            arhivat: false,
          },
        },
        parcela: {
          id: 'parcela-1',
          id_parcela: 'P-1',
          nume_parcela: 'Parcela Nord',
          suprafata_m2: 1500,
          latitudine: 47.6514,
          longitudine: 26.2553,
          gps_lat: null,
          gps_lng: null,
        },
      },
    ]

    const recoltariRows = [
      {
        parcela_id: 'parcela-1',
        data: '2026-04-24',
      },
    ]

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'aplicari_tratament') {
          return createAwaitable({ data: aplicariRows, error: null })
        }

        if (table === 'recoltari') {
          return createAwaitable({ data: recoltariRows, error: null })
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')

    const result = await listAplicariCrossParcelPentruInterval({
      dataStart: new Date('2026-04-17T00:00:00.000Z'),
      dataEnd: new Date('2026-04-25T23:59:59.999Z'),
    })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'ap-1',
      parcela_nume: 'Parcela Nord',
      plan_nume: 'Plan zmeur 2026',
      stadiu_trigger: 'inflorit',
      produs_nume: 'Switch 62.5 WG',
      produs_phi_zile: 7,
      phi_warning: true,
      parcela_lat: 47.6514,
      parcela_lng: 26.2553,
    })
  })

  it('calculează statisticile agregate pentru interval', async () => {
    const aplicariRows = [
      {
        id: 'ap-1',
        tenant_id: 'tenant-1',
        parcela_id: 'parcela-1',
        cultura_id: null,
        plan_linie_id: 'linie-1',
        produs_id: 'produs-1',
        produs_nume_manual: null,
        data_planificata: '2026-04-18',
        data_aplicata: null,
        doza_ml_per_hl: 80,
        doza_l_per_ha: null,
        cantitate_totala_ml: null,
        stoc_mutatie_id: null,
        status: 'planificata',
        meteo_snapshot: null,
        stadiu_la_aplicare: null,
        observatii: null,
        operator: null,
        created_at: '2026-04-15T08:00:00Z',
        updated_at: '2026-04-15T08:00:00Z',
        created_by: null,
        updated_by: null,
        produs: {
          id: 'produs-1',
          tenant_id: 'tenant-1',
          nume_comercial: 'Switch 62.5 WG',
          substanta_activa: 'cyprodinil',
          tip: 'fungicid',
          frac_irac: '9+12',
          phi_zile: 7,
          nr_max_aplicari_per_sezon: null,
          activ: true,
        },
        linie: {
          id: 'linie-1',
          tenant_id: 'tenant-1',
          plan_id: 'plan-1',
          ordine: 1,
          stadiu_trigger: 'inflorit',
          produs_id: 'produs-1',
          produs_nume_manual: null,
          doza_ml_per_hl: 80,
          doza_l_per_ha: null,
          observatii: null,
          created_at: '2026-04-01T00:00:00Z',
          updated_at: '2026-04-01T00:00:00Z',
          plan: {
            id: 'plan-1',
            nume: 'Plan zmeur 2026',
            cultura_tip: 'zmeur',
            activ: true,
            arhivat: false,
          },
        },
        parcela: {
          id: 'parcela-1',
          id_parcela: 'P-1',
          nume_parcela: 'Parcela Nord',
          suprafata_m2: 1500,
          latitudine: 47.6514,
          longitudine: 26.2553,
          gps_lat: null,
          gps_lng: null,
        },
      },
      {
        id: 'ap-2',
        tenant_id: 'tenant-1',
        parcela_id: 'parcela-2',
        cultura_id: null,
        plan_linie_id: 'linie-2',
        produs_id: 'produs-2',
        produs_nume_manual: null,
        data_planificata: '2026-04-19',
        data_aplicata: '2026-04-19T06:00:00.000Z',
        doza_ml_per_hl: 60,
        doza_l_per_ha: null,
        cantitate_totala_ml: null,
        stoc_mutatie_id: null,
        status: 'aplicata',
        meteo_snapshot: null,
        stadiu_la_aplicare: null,
        observatii: null,
        operator: 'Ion',
        created_at: '2026-04-15T08:00:00Z',
        updated_at: '2026-04-15T08:00:00Z',
        created_by: null,
        updated_by: null,
        produs: {
          id: 'produs-2',
          tenant_id: 'tenant-1',
          nume_comercial: 'Mospilan',
          substanta_activa: 'acetamiprid',
          tip: 'insecticid',
          frac_irac: '4A',
          phi_zile: 3,
          nr_max_aplicari_per_sezon: null,
          activ: true,
        },
        linie: {
          id: 'linie-2',
          tenant_id: 'tenant-1',
          plan_id: 'plan-1',
          ordine: 2,
          stadiu_trigger: 'fructificare',
          produs_id: 'produs-2',
          produs_nume_manual: null,
          doza_ml_per_hl: 60,
          doza_l_per_ha: null,
          observatii: null,
          created_at: '2026-04-01T00:00:00Z',
          updated_at: '2026-04-01T00:00:00Z',
          plan: {
            id: 'plan-1',
            nume: 'Plan zmeur 2026',
            cultura_tip: 'zmeur',
            activ: true,
            arhivat: false,
          },
        },
        parcela: {
          id: 'parcela-2',
          id_parcela: 'P-2',
          nume_parcela: 'Parcela Sud',
          suprafata_m2: 900,
          latitudine: 47.65,
          longitudine: 26.23,
          gps_lat: null,
          gps_lng: null,
        },
      },
      {
        id: 'ap-3',
        tenant_id: 'tenant-1',
        parcela_id: 'parcela-3',
        cultura_id: null,
        plan_linie_id: 'linie-3',
        produs_id: 'produs-3',
        produs_nume_manual: null,
        data_planificata: '2026-04-20',
        data_aplicata: null,
        doza_ml_per_hl: 50,
        doza_l_per_ha: null,
        cantitate_totala_ml: null,
        stoc_mutatie_id: null,
        status: 'anulata',
        meteo_snapshot: null,
        stadiu_la_aplicare: null,
        observatii: null,
        operator: null,
        created_at: '2026-04-15T08:00:00Z',
        updated_at: '2026-04-15T08:00:00Z',
        created_by: null,
        updated_by: null,
        produs: {
          id: 'produs-3',
          tenant_id: 'tenant-1',
          nume_comercial: 'Produs X',
          substanta_activa: 'x',
          tip: 'fungicid',
          frac_irac: null,
          phi_zile: null,
          nr_max_aplicari_per_sezon: null,
          activ: true,
        },
        linie: {
          id: 'linie-3',
          tenant_id: 'tenant-1',
          plan_id: 'plan-2',
          ordine: 1,
          stadiu_trigger: 'parga',
          produs_id: 'produs-3',
          produs_nume_manual: null,
          doza_ml_per_hl: 50,
          doza_l_per_ha: null,
          observatii: null,
          created_at: '2026-04-01T00:00:00Z',
          updated_at: '2026-04-01T00:00:00Z',
          plan: {
            id: 'plan-2',
            nume: 'Plan căpșun',
            cultura_tip: 'căpșun',
            activ: true,
            arhivat: false,
          },
        },
        parcela: {
          id: 'parcela-3',
          id_parcela: 'P-3',
          nume_parcela: 'Parcela Vest',
          suprafata_m2: 600,
          latitudine: 47.61,
          longitudine: 26.11,
          gps_lat: null,
          gps_lng: null,
        },
      },
    ]

    const recoltariRows = [
      { parcela_id: 'parcela-1', data: '2026-04-23' },
      { parcela_id: 'parcela-2', data: '2026-04-30' },
      { parcela_id: 'parcela-3', data: '2026-05-10' },
    ]

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'aplicari_tratament') {
          return createAwaitable({ data: aplicariRows, error: null })
        }

        if (table === 'recoltari') {
          return createAwaitable({ data: recoltariRows, error: null })
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')

    const result = await getStatisticiAplicariCrossParcel({
      dataStart: new Date('2026-04-17T00:00:00.000Z'),
      dataEnd: new Date('2026-04-30T23:59:59.999Z'),
    })

    expect(result).toEqual({
      total: 3,
      programate: 1,
      aplicate: 1,
      anulate: 1,
      in_phi_warning: 1,
      cu_meteo_favorabila: 0,
    })
  })
})
