import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock, getTenantIdByUserIdMock, revalidatePathMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getTenantIdByUserIdMock: vi.fn(),
  revalidatePathMock: vi.fn(),
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

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock,
}))

import { montaCapcanaAction, verificaCapcanaAction } from '@/app/(dashboard)/tratamente/capcane/actions'
import {
  buildRecomandariInterventie,
  filterInterventiiRelevanteByMetoda,
  listRecomandariParcela,
  type InterventieRelevantaV2,
} from '@/lib/supabase/queries/tratamente'
import type { MetodaAplicare } from '@/types/tratamente-metode'

const PARCELA_UUID = '00000000-0000-4000-8000-000000000101'
const CAPCANA_UUID = '00000000-0000-4000-8000-000000000102'
const APLICARE_UUID = '00000000-0000-4000-8000-000000000103'
const VERIFICARE_UUID = '00000000-0000-4000-8000-000000000104'

function createAwaitable<T>(result: T) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
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

function makeInterventie(args: {
  id: string
  ordine: number
  metoda: MetodaAplicare | null
  tip: string | null
  scop?: string | null
  cantitateText?: string | null
}): InterventieRelevantaV2 {
  return {
    parcela_id: 'parcela-1',
    parcela_nume: 'Parcela Nord',
    parcela_cod: 'P-1',
    plan: {
      id: 'plan-1',
      nume: 'Plan test',
      cultura_tip: 'zmeur',
      activ: true,
      arhivat: false,
    },
    interventie: {
      id: args.id,
      tenant_id: 'tenant-1',
      plan_id: 'plan-1',
      ordine: args.ordine,
      stadiu_trigger: 'inflorit',
      cohort_trigger: null,
      tip_interventie: args.tip,
      scop: args.scop ?? `Scop ${args.id}`,
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
      sursa_linie: 'din_plan',
      motiv_adaugare: null,
      metoda_aplicare: args.metoda,
      produs: null,
      produse: [
        {
          id: `prod-${args.id}`,
          tenant_id: 'tenant-1',
          plan_linie_id: args.id,
          ordine: 1,
          produs_id: 'produs-1',
          produs_nume_manual: null,
          produs_nume_snapshot: `Produs ${args.id}`,
          substanta_activa_snapshot: null,
          tip_snapshot: 'fungicid',
          frac_irac_snapshot: null,
          phi_zile_snapshot: null,
          doza_ml_per_hl: 80,
          doza_l_per_ha: null,
          cantitate_text: args.cantitateText ?? null,
          observatii: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          produs: {
            id: 'produs-1',
            tenant_id: 'tenant-1',
            nume_comercial: `Produs ${args.id}`,
            substanta_activa: 'substanta',
            tip: 'fungicid',
            frac_irac: null,
            doza_min_ml_per_hl: null,
            doza_max_ml_per_hl: null,
            doza_min_l_per_ha: null,
            doza_max_l_per_ha: null,
            phi_zile: null,
            nr_max_aplicari_per_sezon: null,
            interval_min_aplicari_zile: null,
            omologat_culturi: [],
            activ: true,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            created_by: null,
          },
        },
      ],
    },
    produse_planificate: [
      {
        id: `prod-${args.id}`,
        tenant_id: 'tenant-1',
        plan_linie_id: args.id,
        ordine: 1,
        produs_id: 'produs-1',
        produs_nume_manual: null,
        produs_nume_snapshot: `Produs ${args.id}`,
        substanta_activa_snapshot: null,
        tip_snapshot: 'fungicid',
        frac_irac_snapshot: null,
        phi_zile_snapshot: null,
        doza_ml_per_hl: 80,
        doza_l_per_ha: null,
        cantitate_text: args.cantitateText ?? null,
        observatii: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        produs: {
          id: 'produs-1',
          tenant_id: 'tenant-1',
          nume_comercial: `Produs ${args.id}`,
          substanta_activa: 'substanta',
          tip: 'fungicid',
          frac_irac: null,
          doza_min_ml_per_hl: null,
          doza_max_ml_per_hl: null,
          doza_min_l_per_ha: null,
          doza_max_l_per_ha: null,
          phi_zile: null,
          nr_max_aplicari_per_sezon: null,
          interval_min_aplicari_zile: null,
          omologat_culturi: [],
          activ: true,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          created_by: null,
        },
      },
    ],
    fenofaza_curenta: {
      parcela_id: 'parcela-1',
      an: 2026,
      cohort: null,
      stadiu_id: 'inflorit',
      stadiu: 'inflorit',
      data_observata: '2026-05-12',
      sursa: 'manual',
      observatii: null,
    },
    ultima_aplicare: null,
    aplicare_planificata: null,
    aplicari_efectuate_count: 0,
    regula_repetare: 'fara_repetare',
    interval_repetare_zile: null,
    numar_repetari_max: null,
    urmatoarea_data_estimata: '2026-05-20',
    zile_ramase: 3,
    status_operational: 'urmeaza',
    motiv: 'Plan activ',
  }
}

function createAplicariInsertBuilder(row: Record<string, unknown>) {
  const state = {
    insertedPayloads: [] as Array<Record<string, unknown>>,
    deleteCalledWith: [] as Array<[string, unknown]>,
  }

  const deleteBuilder = {
    eq: vi.fn((column: string, value: unknown) => {
      state.deleteCalledWith.push([column, value])
      return deleteBuilder
    }),
  }

  const builder = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      state.insertedPayloads.push(payload)
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: row, error: null })),
        })),
      }
    }),
    delete: vi.fn(() => deleteBuilder),
  }

  return { builder, state, deleteBuilder }
}

function createAplicariInsertFailureBuilder(message: string) {
  const builder = {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({
          data: null,
          error: { message },
        })),
      })),
    })),
  }

  return builder
}

function createCapcaneInsertBuilder(result: { data: Record<string, unknown> | null; error: { message: string } | null }) {
  const state = {
    insertedPayloads: [] as Array<Record<string, unknown>>,
  }

  const builder = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      state.insertedPayloads.push(payload)
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => result),
        })),
      }
    }),
  }

  return { builder, state }
}

function createCapcaneMontateReadUpdateBuilder(baseRow: Record<string, unknown>) {
  const state = {
    updatedPayloads: [] as Array<Record<string, unknown>>,
    eqCalls: [] as Array<[string, unknown]>,
    maybeSingleCalls: 0,
  }

  const updateEqTenantBuilder = {
    eq: vi.fn(async (column: string, value: unknown) => {
      state.eqCalls.push([column, value])
      return { data: null, error: null }
    }),
  }

  const updateEqIdBuilder = {
    eq: vi.fn((column: string, value: unknown) => {
      state.eqCalls.push([column, value])
      return updateEqTenantBuilder
    }),
  }

  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      state.eqCalls.push([column, value])
      return builder
    }),
    maybeSingle: vi.fn(async () => {
      state.maybeSingleCalls += 1
      if (state.maybeSingleCalls === 1) {
        return { data: baseRow, error: null }
      }
      return {
        data: {
          ...baseRow,
          verificari: [],
        },
        error: null,
      }
    }),
    update: vi.fn((payload: Record<string, unknown>) => {
      state.updatedPayloads.push(payload)
      return updateEqIdBuilder
    }),
  }

  return { builder, state }
}

function createCapcaneVerificariInsertBuilder(row: Record<string, unknown>) {
  const state = {
    insertedPayloads: [] as Array<Record<string, unknown>>,
  }

  const builder = {
    insert: vi.fn((payload: Record<string, unknown>) => {
      state.insertedPayloads.push(payload)
      return {
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: row, error: null })),
        })),
      }
    }),
  }

  return { builder, state }
}

describe('tratamente metoda aplicare', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')
  })

  it('returnează doar intervențiile cu metoda exactă', () => {
    const interventii = [
      makeInterventie({ id: 'linie-1', ordine: 2, metoda: 'fertirigare', tip: 'nutritie' }),
      makeInterventie({ id: 'linie-2', ordine: 1, metoda: 'foliar', tip: 'protectie' }),
    ]

    const result = filterInterventiiRelevanteByMetoda(interventii, 'foliar')

    expect(result.map((item) => item.interventie.id)).toEqual(['linie-2'])
  })

  it('aplică euristica pentru planurile vechi cu metoda null', () => {
    const interventii = [
      makeInterventie({ id: 'linie-1', ordine: 1, metoda: null, tip: 'protectie' }),
      makeInterventie({ id: 'linie-2', ordine: 2, metoda: null, tip: 'nutritie' }),
      makeInterventie({ id: 'linie-3', ordine: 3, metoda: null, tip: 'monitorizare' }),
    ]

    expect(filterInterventiiRelevanteByMetoda(interventii, 'foliar').map((item) => item.interventie.id)).toEqual([
      'linie-1',
    ])
    expect(
      filterInterventiiRelevanteByMetoda(interventii, 'fertirigare').map((item) => item.interventie.id)
    ).toEqual(['linie-2'])
    expect(
      filterInterventiiRelevanteByMetoda(interventii, 'capcana_pus').map((item) => item.interventie.id)
    ).toEqual(['linie-3'])
  })

  it('sortează după ordine și limitează recomandările la maxim 5', () => {
    const interventii = [
      makeInterventie({ id: 'linie-6', ordine: 6, metoda: 'foliar', tip: 'protectie' }),
      makeInterventie({ id: 'linie-4', ordine: 4, metoda: 'foliar', tip: 'protectie' }),
      makeInterventie({ id: 'linie-2', ordine: 2, metoda: 'foliar', tip: 'protectie' }),
      makeInterventie({ id: 'linie-5', ordine: 5, metoda: 'foliar', tip: 'protectie' }),
      makeInterventie({ id: 'linie-1', ordine: 1, metoda: 'foliar', tip: 'protectie', cantitateText: '250 ml/10L' }),
      makeInterventie({ id: 'linie-3', ordine: 3, metoda: 'foliar', tip: 'protectie' }),
    ]

    const result = buildRecomandariInterventie(interventii)

    expect(result).toHaveLength(5)
    expect(result.map((item) => item.linieId)).toEqual([
      'linie-1',
      'linie-2',
      'linie-3',
      'linie-4',
      'linie-5',
    ])
    expect(result[0]).toMatchObject({
      titlu: 'Scop linie-1',
      produse: [
        {
          nume: 'Produs linie-1',
          dozaSugerataMlPerHl: 80,
          cantitateText: '250 ml/10L',
        },
      ],
      stadiuTrigger: 'inflorit',
    })
  })

  it('returnează [] când parcela nu are plan activ', async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'parcele') {
          return createAwaitable({
            data: {
              id: 'parcela-1',
              tenant_id: 'tenant-1',
              id_parcela: 'P-1',
              nume_parcela: 'Parcela Nord',
              cultura: 'zmeur',
              tip_fruct: 'zmeura',
              soi: 'Enrosadira',
              tip_unitate: 'camp',
              suprafata_m2: 1500,
            },
            error: null,
          })
        }

        if (table === 'parcele_planuri') {
          return createAwaitable({
            data: null,
            error: null,
          })
        }

        if (table === 'stadii_fenologice_parcela') {
          return createAwaitable({
            data: [],
            error: null,
          })
        }

        if (table === 'aplicari_tratament') {
          return createAwaitable({
            data: [],
            error: null,
          })
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)

    const result = await listRecomandariParcela({
      parcelaId: 'parcela-1',
      metodaAplicare: 'foliar',
      an: 2026,
    })

    expect(result).toEqual([])
  })
})

describe('capcane actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')
  })

  it('montaCapcanaAction creează rânduri în ambele tabele și revalidează paginile dependente', async () => {
    const aplicari = createAplicariInsertBuilder({
      id: APLICARE_UUID,
      parcela_id: PARCELA_UUID,
    })
    const capcane = createCapcaneInsertBuilder({
      data: {
        id: CAPCANA_UUID,
        parcela_id: PARCELA_UUID,
        status: 'activ',
        tip_capcana: 'feromonala',
      },
      error: null,
    })

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'aplicari_tratament') return aplicari.builder
        if (table === 'capcane_montate') return capcane.builder
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)

    const result = await montaCapcanaAction({
      parcelaId: PARCELA_UUID,
      tipCapcana: 'feromonala',
      nrBucati: 3,
      observatii: 'Rândul 2',
    })

    expect(result).toEqual({ ok: true })
    expect(aplicari.state.insertedPayloads[0]).toMatchObject({
      tenant_id: 'tenant-1',
      parcela_id: PARCELA_UUID,
      tip_interventie: 'monitorizare',
      metoda_aplicare: 'capcana_pus',
      status: 'aplicata',
    })
    expect(capcane.state.insertedPayloads[0]).toMatchObject({
      tenant_id: 'tenant-1',
      parcela_id: PARCELA_UUID,
      aplicare_id: APLICARE_UUID,
      tip_capcana: 'feromonala',
      nr_bucati: 3,
      observatii: 'Rândul 2',
    })
    expect(revalidatePathMock).toHaveBeenNthCalledWith(1, '/tratamente')
    expect(revalidatePathMock).toHaveBeenNthCalledWith(2, `/parcele/${PARCELA_UUID}/tratamente`)
  })

  it('montaCapcanaAction face rollback dacă insertul în capcane_montate eșuează', async () => {
    const aplicari = createAplicariInsertBuilder({
      id: APLICARE_UUID,
      parcela_id: PARCELA_UUID,
    })
    const capcane = createCapcaneInsertBuilder({
      data: null,
      error: { message: 'insert failed' },
    })

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'aplicari_tratament') return aplicari.builder
        if (table === 'capcane_montate') return capcane.builder
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)

    const result = await montaCapcanaAction({
      parcelaId: PARCELA_UUID,
      tipCapcana: 'altul',
      nrBucati: 1,
    })

    expect(result.ok).toBe(false)
    expect(aplicari.builder.delete).toHaveBeenCalledTimes(1)
    expect(aplicari.state.deleteCalledWith).toEqual([
      ['id', APLICARE_UUID],
      ['tenant_id', 'tenant-1'],
    ])
  })

  it('montaCapcanaAction propagă refuzul RLS ca eroare de business', async () => {
    const aplicari = createAplicariInsertFailureBuilder('new row violates row-level security policy')
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'aplicari_tratament') return aplicari
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)

    const result = await montaCapcanaAction({
      parcelaId: PARCELA_UUID,
      tipCapcana: 'lipicioasa_galbena',
      nrBucati: 2,
    })

    expect(result.ok).toBe(false)
    expect(revalidatePathMock).not.toHaveBeenCalled()
  })

  it('verificaCapcanaAction creează verificarea și marchează capcana drept scoasă când actiunea este scos', async () => {
    const capcanaRow = {
      id: CAPCANA_UUID,
      tenant_id: 'tenant-1',
      parcela_id: PARCELA_UUID,
      status: 'activ',
    }
    const capcaneMontate = createCapcaneMontateReadUpdateBuilder(capcanaRow)
    const aplicari = createAplicariInsertBuilder({
      id: APLICARE_UUID,
      parcela_id: PARCELA_UUID,
    })
    const verificari = createCapcaneVerificariInsertBuilder({
      id: VERIFICARE_UUID,
      capcana_montata_id: CAPCANA_UUID,
      actiune: 'scos',
      nr_capturati: 4,
      prag_depasit: true,
    })

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'capcane_montate') return capcaneMontate.builder
        if (table === 'aplicari_tratament') return aplicari.builder
        if (table === 'capcane_verificari') return verificari.builder
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)

    const result = await verificaCapcanaAction({
      capcanaMontataId: CAPCANA_UUID,
      nrCapturati: 4,
      actiune: 'scos',
      pragDepasit: true,
      observatii: 'Scoasă după vânt',
    })

    expect(result).toEqual({ ok: true })
    expect(aplicari.state.insertedPayloads[0]).toMatchObject({
      parcela_id: PARCELA_UUID,
      tip_interventie: 'monitorizare',
      metoda_aplicare: 'capcana_verificat',
    })
    expect(verificari.state.insertedPayloads[0]).toMatchObject({
      tenant_id: 'tenant-1',
      capcana_montata_id: CAPCANA_UUID,
      aplicare_id: APLICARE_UUID,
      actiune: 'scos',
      nr_capturati: 4,
      prag_depasit: true,
    })
    expect(capcaneMontate.state.updatedPayloads[0]).toMatchObject({
      status: 'scos',
    })
    expect(revalidatePathMock).toHaveBeenNthCalledWith(1, '/tratamente')
    expect(revalidatePathMock).toHaveBeenNthCalledWith(2, `/parcele/${PARCELA_UUID}/tratamente`)
  })

  it('verificaCapcanaAction validează nrCapturati >= 0', async () => {
    const result = await verificaCapcanaAction({
      capcanaMontataId: CAPCANA_UUID,
      nrCapturati: -1,
      actiune: 'doar_observat',
    })

    expect(result.ok).toBe(false)
    expect(createClientMock).not.toHaveBeenCalled()
  })
})
