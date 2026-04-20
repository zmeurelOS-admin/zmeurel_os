import { addDays, subDays } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { buildConformitateMetrici } from '@/lib/tratamente/conformitate'
import type { AplicareAgregata, ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

function makeProdus(overrides?: Partial<ProdusFitosanitar>): ProdusFitosanitar {
  return {
    id: 'prod1',
    tenant_id: 't1',
    nume_comercial: 'Kocide 2000',
    substanta_activa: 'hidroxid de cupru',
    tip: 'fungicid',
    frac_irac: 'FRAC M01',
    doza_min_ml_per_hl: null,
    doza_max_ml_per_hl: null,
    doza_min_l_per_ha: 2,
    doza_max_l_per_ha: 2.5,
    phi_zile: 7,
    nr_max_aplicari_per_sezon: 3,
    interval_min_aplicari_zile: null,
    omologat_culturi: null,
    activ: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null,
    ...overrides,
  }
}

function makeAplicare(overrides?: Partial<AplicareAgregata>): AplicareAgregata {
  return {
    id: 'a1',
    tenant_id: 't1',
    parcela_id: 'p1',
    parcela_nume: 'Parcela',
    parcela_cod: 'P1',
    parcela_suprafata_m2: 10000,
    suprafata_ha: 1,
    produs_id: 'prod1',
    produs_nume: 'Kocide 2000',
    produs_tip: 'fungicid',
    produs_frac: 'FRAC M01',
    produs_phi_zile: 7,
    substanta_activa: 'hidroxid de cupru',
    plan_id: 'plan1',
    plan_nume: 'Plan 1',
    linie_id: 'lin1',
    stadiu_trigger: 'inflorit',
    stadiu_la_aplicare: null,
    data_planificata: null,
    data_aplicata: null,
    status: 'planificata',
    doza_ml_per_hl: null,
    doza_l_per_ha: 2,
    cantitate_totala_ml: 2000,
    observatii: null,
    operator: null,
    ...overrides,
  }
}

describe('build-metrici', () => {
  it('fără aplicări returnează metrici zero', () => {
    const result = buildConformitateMetrici([], [makeProdus()], 2026)
    expect(result.totalAplicari).toBe(0)
    expect(result.cupruKgHa).toBe(0)
    expect(result.fracViolatii).toBe(0)
  })

  it('cu aplicări mixte produce metrici consistente', () => {
    const future = addDays(new Date(), 5).toISOString().slice(0, 10)
    const past = subDays(new Date(), 2).toISOString()
    const result = buildConformitateMetrici([
      makeAplicare({ id: 'a1', status: 'aplicata', data_aplicata: past }),
      makeAplicare({ id: 'a2', status: 'planificata', data_planificata: future }),
      makeAplicare({ id: 'a3', status: 'aplicata', data_aplicata: subDays(new Date(), 1).toISOString() }),
    ], [makeProdus()], 2026)

    expect(result.totalAplicari).toBe(3)
    expect(result.cupruKgHa).toBeGreaterThan(0)
    expect(result.ultimaAplicare?.produs).toBe('Kocide 2000')
  })

  it('alege următoarea aplicare ca cea mai timpurie planificată din viitor', () => {
    const result = buildConformitateMetrici([
      makeAplicare({ id: 'soon', status: 'planificata', data_planificata: addDays(new Date(), 2).toISOString().slice(0, 10), produs_nume: 'Produs aproape' }),
      makeAplicare({ id: 'later', status: 'planificata', data_planificata: addDays(new Date(), 10).toISOString().slice(0, 10), produs_nume: 'Produs târziu' }),
    ], [makeProdus()], 2026)

    expect(result.urmatoareaAplicare?.produs).toBe('Produs aproape')
  })

  it('alege ultima aplicare ca cea mai recentă aplicată din trecut', () => {
    const result = buildConformitateMetrici([
      makeAplicare({ id: 'old', status: 'aplicata', data_aplicata: subDays(new Date(), 7).toISOString(), produs_nume: 'Produs vechi' }),
      makeAplicare({ id: 'new', status: 'aplicata', data_aplicata: subDays(new Date(), 1).toISOString(), produs_nume: 'Produs nou' }),
    ], [makeProdus()], 2026)

    expect(result.ultimaAplicare?.produs).toBe('Produs nou')
  })
})
