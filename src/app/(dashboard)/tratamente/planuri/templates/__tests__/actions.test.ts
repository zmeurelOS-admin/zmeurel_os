import { beforeEach, describe, expect, it, vi } from 'vitest'

const templateId = '11111111-1111-4111-8111-111111111111'
const planId = '22222222-2222-4222-8222-222222222222'

const { createClientMock, upsertMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  upsertMock: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/supabase/queries/tratamente', () => ({
  upsertPlanTratamentCuLinii: upsertMock,
}))

function makeQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null }),
    single: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null }),
    then(resolve: (value: { data: unknown; error: null }) => unknown) {
      return Promise.resolve(resolve({ data, error: null }))
    },
  }
}

const templateRow = {
  id: templateId,
  cod: 'zmeur_primocane',
  nume: 'Zmeur primocane',
  cultura_tip: 'zmeur',
  cohort: 'primocane',
  descriere: 'Template test',
  durata_sezon_estimata: 'martie - octombrie',
  nr_interventii: 2,
  activ: true,
  ordine: 1,
}

const lineRows = [
  {
    id: 'linie-template-1',
    template_id: templateId,
    ordine: 1,
    stadiu_trigger: 'umflare_muguri',
    cohort_trigger: 'primocane',
    tip_interventie: 'nutritie',
    metoda_aplicare: 'fertilizare_baza',
    scop: 'Fertilizare bază',
    regula_repetare: 'fara_repetare',
    interval_repetare_zile: null,
    numar_repetari_max: null,
    fereastra_start_offset_zile: null,
    fereastra_end_offset_zile: null,
    produs_sugerat_nume: 'NPK 16-16-16',
    produs_sugerat_substanta: null,
    produs_sugerat_doza_text: '200 kg/ha',
    observatii: null,
  },
  {
    id: 'linie-template-2',
    template_id: templateId,
    ordine: 2,
    stadiu_trigger: 'fruct_verde',
    cohort_trigger: 'primocane',
    tip_interventie: 'monitorizare',
    metoda_aplicare: 'capcana_verificat',
    scop: 'Verificare Drosophila',
    regula_repetare: 'interval',
    interval_repetare_zile: 5,
    numar_repetari_max: null,
    fereastra_start_offset_zile: null,
    fereastra_end_offset_zile: null,
    produs_sugerat_nume: null,
    produs_sugerat_substanta: null,
    produs_sugerat_doza_text: 'la 5 zile',
    observatii: null,
  },
]

function setupClient() {
  createClientMock.mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'planuri_template') return makeQuery([templateRow])
      if (table === 'planuri_template_linii') return makeQuery(lineRows)
      throw new Error(`Unexpected table ${table}`)
    }),
  })
}

describe('planuri template actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupClient()
    upsertMock.mockResolvedValue({ id: planId })
  })

  it('listTemplatesActive returnează template-urile active', async () => {
    const { listTemplatesActive } = await import('../actions')

    const result = await listTemplatesActive()

    expect(result).toEqual([
      expect.objectContaining({
        id: templateId,
        cod: 'zmeur_primocane',
        nume: 'Zmeur primocane',
        nr_interventii: 2,
      }),
    ])
  })

  it('clonezaTemplateInPlanNou mapează liniile template în payload pentru upsert', async () => {
    const { clonezaTemplateInPlanNou } = await import('../actions')

    const result = await clonezaTemplateInPlanNou({
      templateId,
      numePlan: 'Plan Maravilla 2026',
      parcelaId: '33333333-3333-4333-8333-333333333333',
      an: 2026,
    })

    expect(result).toEqual({ planId })
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nume: 'Plan Maravilla 2026',
        cultura_tip: 'zmeur',
      }),
      expect.arrayContaining([
        expect.objectContaining({
          metoda_aplicare: 'fertilizare_baza',
          produs_nume_manual: 'NPK 16-16-16',
        }),
        expect.objectContaining({
          metoda_aplicare: 'capcana_verificat',
          regula_repetare: 'interval',
          interval_repetare_zile: 5,
        }),
      ]),
      ['33333333-3333-4333-8333-333333333333'],
      2026
    )
  })
})
