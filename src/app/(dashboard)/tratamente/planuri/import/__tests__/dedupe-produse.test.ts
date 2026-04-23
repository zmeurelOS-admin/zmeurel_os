import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PlanSaveInput } from '@/lib/tratamente/import/types'

const mocks = vi.hoisted(() => ({
  createProdusFitosanitar: vi.fn(),
  upsertPlanTratamentCuLinii: vi.fn(),
  mapTratamenteError: vi.fn((error: unknown, fallback: string) => ({
    message: error instanceof Error ? error.message : fallback,
  })),
  revalidatePath: vi.fn(),
}))

function makeImportLine(
  ordine: number,
  produsDeCreat: NonNullable<PlanSaveInput['linii'][number]['produse'][number]['produs_de_creat']>,
  observatii = `Linia ${ordine}`
): PlanSaveInput['linii'][number] {
  return {
    ordine,
    stadiu_trigger: 'prefloral',
    cohort_trigger: null,
    tip_interventie: null,
    scop: null,
    regula_repetare: 'fara_repetare',
    interval_repetare_zile: null,
    numar_repetari_max: null,
    observatii,
    produse: [
      {
        ordine: 1,
        produs_id: null,
        produs_nume_manual: null,
        produs_nume_snapshot: produsDeCreat.nume_comercial,
        substanta_activa_snapshot: produsDeCreat.substanta_activa,
        tip_snapshot: produsDeCreat.tip,
        frac_irac_snapshot: produsDeCreat.frac_irac,
        phi_zile_snapshot: produsDeCreat.phi_zile,
        doza_ml_per_hl: 50,
        doza_l_per_ha: null,
        observatii,
        produs_de_creat: produsDeCreat,
      },
    ],
  }
}

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
        linii: [1, 2, 3].map((ordine) => makeImportLine(ordine, produsDeCreat)),
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
          makeImportLine(1, produsDuplicat),
          makeImportLine(2, produsDuplicat),
          makeImportLine(3, produsDiferit),
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
          makeImportLine(1, {
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
            }),
          makeImportLine(2, {
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
            }),
        ],
      },
    ]

    const result = await saveImportedPlansAction(payload, 2026)

    expect(result).toEqual({ success: 1, failed: [] })
    expect(mocks.createProdusFitosanitar).toHaveBeenCalledTimes(2)
  })

  it('dedupează produse de creat cu diferențe de diacritice și spațiere', async () => {
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

    const produsBase = {
      nume_comercial: 'Produs Șoc',
      substanta_activa: 'substanță activă',
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
          nume: 'Plan dedupe diacritice',
          cultura_tip: 'zmeur',
          descriere: 'Descriere',
        },
        linii: [
          makeImportLine(1, produsBase),
          makeImportLine(2, {
            ...produsBase,
            nume_comercial: '  Produs Soc  ',
            substanta_activa: 'substanta activa',
          }),
        ],
      },
    ]

    const result = await saveImportedPlansAction(payload, 2026)

    expect(result).toEqual({ success: 1, failed: [] })
    expect(mocks.createProdusFitosanitar).toHaveBeenCalledTimes(1)
  })

  it('refuză salvarea unei intervenții importate fără produse reale', async () => {
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
          nume: 'Plan fără produse',
          cultura_tip: 'zmeur',
          descriere: 'Descriere',
        },
        linii: [
          {
            ordine: 1,
            stadiu_trigger: 'buton_verde',
            cohort_trigger: null,
            tip_interventie: null,
            scop: null,
            regula_repetare: 'fara_repetare',
            interval_repetare_zile: null,
            numar_repetari_max: null,
            observatii: null,
            produse: [],
          },
        ],
      },
    ]

    const result = await saveImportedPlansAction(payload, 2026)

    expect(result.success).toBe(0)
    expect(result.failed[0]?.error).toBe('Intervenția 1 nu are produse de importat.')
    expect(mocks.upsertPlanTratamentCuLinii).not.toHaveBeenCalled()
  })
})
