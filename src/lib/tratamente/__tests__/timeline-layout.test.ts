import { describe, expect, it } from 'vitest'

import { buildGanttLayout } from '@/lib/tratamente/conformitate'
import type { AplicareAgregata } from '@/lib/supabase/queries/tratamente'

function makeAplicare(overrides?: Partial<AplicareAgregata>): AplicareAgregata {
  return {
    id: 'a1',
    tenant_id: 't1',
    parcela_id: 'p1',
    parcela_nume: 'Parcela Nord',
    parcela_cod: 'P1',
    parcela_suprafata_m2: 1000,
    suprafata_ha: 0.1,
    produs_id: 'prod1',
    produs_nume: 'Produs 1',
    produs_tip: 'fungicid',
    produs_frac: '9+12',
    produs_phi_zile: 7,
    substanta_activa: 'cyprodinil',
    plan_id: 'plan1',
    plan_nume: 'Plan 1',
    linie_id: 'linie1',
    stadiu_trigger: 'inflorit',
    stadiu_la_aplicare: null,
    data_planificata: '2026-04-20',
    data_aplicata: null,
    status: 'planificata',
    doza_ml_per_hl: 50,
    doza_l_per_ha: null,
    cantitate_totala_ml: 500,
    observatii: null,
    operator: null,
    ...overrides,
  }
}

describe('timeline-layout', () => {
  it('returnează mereu 12 rows', () => {
    expect(buildGanttLayout([], 2026)).toHaveLength(12)
  })

  it('poziționează aplicarea pe ziua corectă', () => {
    const layout = buildGanttLayout([makeAplicare({ data_planificata: '2026-04-20' })], 2026)
    expect(layout[3]?.aplicari[0]?.ziua).toBe(20)
  })

  it('pune aplicări din luni diferite pe row-uri diferite', () => {
    const layout = buildGanttLayout([
      makeAplicare({ id: 'apr', data_planificata: '2026-04-20' }),
      makeAplicare({ id: 'mai', data_planificata: '2026-05-10' }),
    ], 2026)

    expect(layout[3]?.aplicari).toHaveLength(1)
    expect(layout[4]?.aplicari).toHaveLength(1)
  })

  it('pe an gol returnează 12 rows fără aplicări', () => {
    const layout = buildGanttLayout([], 2026)
    expect(layout.every((row) => row.aplicari.length === 0)).toBe(true)
  })

  it('sare peste aplicările fără dată fără crash', () => {
    const layout = buildGanttLayout([
      makeAplicare({ id: 'empty', data_planificata: null, data_aplicata: null }),
    ], 2026)

    expect(layout.every((row) => row.aplicari.length === 0)).toBe(true)
  })
})

