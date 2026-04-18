import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PlanSaveInput } from '@/lib/tratamente/import/types'

const mocks = vi.hoisted(() => ({
  createProdusFitosanitar: vi.fn(),
  upsertPlanTratamentCuLinii: vi.fn(),
  mapTratamenteError: vi.fn((_error: unknown, fallback: string) => ({ message: fallback })),
  revalidatePath: vi.fn(),
}))

describe('saveImportedPlansAction dedupe produse de creat', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mocks.createProdusFitosanitar.mockImplementation(async (_payload: unknown) => ({
      id: `produs-nou-${mocks.createProdusFitosanitar.mock.calls.length}`,
    }))
    mocks.upsertPlanTratamentCuLinii.mockResolvedValue({ id: 'plan-1' })
  })

  it('apelează createProdusFitosanitar o singură dată pentru linii identice', async () => {
    vi.doMock('next/cache', () => ({
      revalidatePath: mocks.revalidatePath,
    }))
    vi.doMock('@/lib/supabase/queries/tratamente', () => ({
      createProdusFitosanitar: mocks.createProdusFitosanitar,
      upsertPlanTratamentCuLinii: mocks.upsertPlanTratamentCuLinii,
      mapTratamenteError: mocks.mapTratamenteError,
    }))

    const { saveImportedPlansAction } = await import(
      '@/app/(dashboard)/tratamente/planuri/import/actions'
    )

    const produsDeCreat = {
      nume_comercial: 'Produs Test Duplicat',
      substanta_activa: 'substanta duplicata',
      tip: 'fungicid' as const,
      frac_irac: null,
      phi_zile: 3,
      doza_min_ml_per_hl: null,
      doza_max_ml_per_hl: null,
      doza_min_l_per_ha: null,
      doza_max_l_per_ha: null,
      nr_max_aplicari_per_sezon: null,
      interval_min_aplicari_zile: null,
      omologat_culturi: ['zmeur'],
      activ: true,
    }

    const payload: PlanSaveInput[] = [
      {
        plan_metadata: {
          nume: 'Plan dedupe',
          cultura_tip: 'zmeur',
          descriere: 'Descriere',
        },
        linii: [1, 2, 3].map((ordine) => ({
          ordine,
          stadiu_trigger: 'prefloral',
          produs_id: null,
          produs_nume_manual: null,
          doza_ml_per_hl: 50,
          doza_l_per_ha: null,
          observatii: `Linia ${ordine}`,
          produs_de_creat: produsDeCreat,
        })),
      },
    ]

    const result = await saveImportedPlansAction(payload, 2026)

    expect(result).toEqual({ success: 1, failed: [] })
    expect(mocks.createProdusFitosanitar).toHaveBeenCalledTimes(1)
  })

  it('apelează createProdusFitosanitar de două ori pentru două produse distincte', async () => {
    vi.doMock('next/cache', () => ({
      revalidatePath: mocks.revalidatePath,
    }))
    vi.doMock('@/lib/supabase/queries/tratamente', () => ({
      createProdusFitosanitar: mocks.createProdusFitosanitar,
      upsertPlanTratamentCuLinii: mocks.upsertPlanTratamentCuLinii,
      mapTratamenteError: mocks.mapTratamenteError,
    }))

    const { saveImportedPlansAction } = await import(
      '@/app/(dashboard)/tratamente/planuri/import/actions'
    )

    const produsDuplicat = {
      nume_comercial: 'Produs Test Duplicat',
      substanta_activa: 'substanta duplicata',
      tip: 'fungicid' as const,
      frac_irac: null,
      phi_zile: 3,
      doza_min_ml_per_hl: null,
      doza_max_ml_per_hl: null,
      doza_min_l_per_ha: null,
      doza_max_l_per_ha: null,
      nr_max_aplicari_per_sezon: null,
      interval_min_aplicari_zile: null,
      omologat_culturi: ['zmeur'],
      activ: true,
    }

    const produsDiferit = {
      ...produsDuplicat,
      nume_comercial: 'Produs Test Diferit',
      substanta_activa: 'substanta diferita',
    }

    const payload: PlanSaveInput[] = [
      {
        plan_metadata: {
          nume: 'Plan dedupe mix',
          cultura_tip: 'zmeur',
          descriere: 'Descriere',
        },
        linii: [
          {
            ordine: 1,
            stadiu_trigger: 'prefloral',
            produs_id: null,
            produs_nume_manual: null,
            doza_ml_per_hl: 50,
            doza_l_per_ha: null,
            observatii: 'Linia 1',
            produs_de_creat: produsDuplicat,
          },
          {
            ordine: 2,
            stadiu_trigger: 'prefloral',
            produs_id: null,
            produs_nume_manual: null,
            doza_ml_per_hl: 50,
            doza_l_per_ha: null,
            observatii: 'Linia 2',
            produs_de_creat: produsDuplicat,
          },
          {
            ordine: 3,
            stadiu_trigger: 'prefloral',
            produs_id: null,
            produs_nume_manual: null,
            doza_ml_per_hl: 50,
            doza_l_per_ha: null,
            observatii: 'Linia 3',
            produs_de_creat: produsDiferit,
          },
        ],
      },
    ]

    const result = await saveImportedPlansAction(payload, 2026)

    expect(result).toEqual({ success: 1, failed: [] })
    expect(mocks.createProdusFitosanitar).toHaveBeenCalledTimes(2)
  })

  it('nu dedupează produse cu același nume comercial dar substanță activă diferită', async () => {
    vi.doMock('next/cache', () => ({
      revalidatePath: mocks.revalidatePath,
    }))
    vi.doMock('@/lib/supabase/queries/tratamente', () => ({
      createProdusFitosanitar: mocks.createProdusFitosanitar,
      upsertPlanTratamentCuLinii: mocks.upsertPlanTratamentCuLinii,
      mapTratamenteError: mocks.mapTratamenteError,
    }))

    const { saveImportedPlansAction } = await import(
      '@/app/(dashboard)/tratamente/planuri/import/actions'
    )

    const payload: PlanSaveInput[] = [
      {
        plan_metadata: {
          nume: 'Plan dedupe substanță',
          cultura_tip: 'zmeur',
          descriere: 'Descriere',
        },
        linii: [
          {
            ordine: 1,
            stadiu_trigger: 'prefloral',
            produs_id: null,
            produs_nume_manual: null,
            doza_ml_per_hl: 50,
            doza_l_per_ha: null,
            observatii: 'Linia 1',
            produs_de_creat: {
              nume_comercial: 'Produs Test',
              substanta_activa: 'substanta A',
              tip: 'fungicid',
              frac_irac: null,
              phi_zile: 3,
              doza_min_ml_per_hl: null,
              doza_max_ml_per_hl: null,
              doza_min_l_per_ha: null,
              doza_max_l_per_ha: null,
              nr_max_aplicari_per_sezon: null,
              interval_min_aplicari_zile: null,
              omologat_culturi: ['zmeur'],
              activ: true,
            },
          },
          {
            ordine: 2,
            stadiu_trigger: 'prefloral',
            produs_id: null,
            produs_nume_manual: null,
            doza_ml_per_hl: 50,
            doza_l_per_ha: null,
            observatii: 'Linia 2',
            produs_de_creat: {
              nume_comercial: 'Produs Test',
              substanta_activa: 'substanta B',
              tip: 'fungicid',
              frac_irac: null,
              phi_zile: 3,
              doza_min_ml_per_hl: null,
              doza_max_ml_per_hl: null,
              doza_min_l_per_ha: null,
              doza_max_l_per_ha: null,
              nr_max_aplicari_per_sezon: null,
              interval_min_aplicari_zile: null,
              omologat_culturi: ['zmeur'],
              activ: true,
            },
          },
        ],
      },
    ]

    const result = await saveImportedPlansAction(payload, 2026)

    expect(result).toEqual({ success: 1, failed: [] })
    expect(mocks.createProdusFitosanitar).toHaveBeenCalledTimes(2)
  })
})
