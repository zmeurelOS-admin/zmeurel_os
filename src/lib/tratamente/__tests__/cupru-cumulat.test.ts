import { calculeazaCupruCumulatAnual } from '@/lib/tratamente/cupru-cumulat'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

const produse = [
  {
    id: 'p-cu',
    tenant_id: null,
    nume_comercial: 'Kocide 2000',
    substanta_activa: 'hidroxid de cupru',
    tip: 'fungicid',
    frac_irac: 'FRAC M01',
    doza_min_ml_per_hl: null,
    doza_max_ml_per_hl: null,
    doza_min_l_per_ha: 2.5,
    doza_max_l_per_ha: 2.5,
    phi_zile: 3,
    nr_max_aplicari_per_sezon: 4,
    interval_min_aplicari_zile: 7,
    omologat_culturi: ['zmeur'],
    activ: true,
    created_at: '2026-04-16T00:00:00.000Z',
    updated_at: '2026-04-16T00:00:00.000Z',
    created_by: null,
  },
] satisfies ProdusFitosanitar[]

describe('cupru-cumulat', () => {
  it('calculează consumul anual de cupru și pragul de warning', () => {
    const result = calculeazaCupruCumulatAnual(
      [
        {
          aplicareId: 'a1',
          produsId: 'p-cu',
          produsNume: 'Kocide 2000',
          dataAplicata: '2026-04-10',
          dozaLPerHa: 2.5,
        },
        {
          aplicareId: 'a2',
          produsId: 'p-cu',
          produsNume: 'Kocide 2000',
          dataAplicata: '2026-05-01',
          dozaLPerHa: 7.0,
        },
      ],
      produse,
      2026
    )

    expect(result.totalKgHa).toBeCloseTo(3.325, 3)
    expect(result.alertLevel).toBe('warning')
  })

  it('returnează alertLevel ok când consumul e sub 75% din limită', () => {
    const result = calculeazaCupruCumulatAnual(
      [
        {
          aplicareId: 'a-ok',
          produsId: 'p-cu',
          produsNume: 'Kocide 2000',
          dataAplicata: '2026-04-10',
          dozaLPerHa: 6,
        },
      ],
      produse,
      2026
    )

    expect(result.totalKgHa).toBeCloseTo(2.1, 3)
    expect(result.alertLevel).toBe('ok')
  })

  it('returnează alertLevel exceeded când consumul depășește 4 kg/ha', () => {
    const result = calculeazaCupruCumulatAnual(
      [
        {
          aplicareId: 'a-exceeded',
          produsId: 'p-cu',
          produsNume: 'Kocide 2000',
          dataAplicata: '2026-04-10',
          dozaLPerHa: 12.5,
        },
      ],
      produse,
      2026
    )

    expect(result.totalKgHa).toBeCloseTo(4.375, 3)
    expect(result.alertLevel).toBe('exceeded')
  })

  it('returnează 0 și ok fără aplicări cu cupru', () => {
    const result = calculeazaCupruCumulatAnual(
      [
        {
          aplicareId: 'a-fara-cupru',
          produsNume: 'Topas 100 EC',
          dataAplicata: '2026-04-10',
          dozaLPerHa: 0.5,
        },
      ],
      produse,
      2026
    )

    expect(result.totalKgHa).toBe(0)
    expect(result.alertLevel).toBe('ok')
  })
})
