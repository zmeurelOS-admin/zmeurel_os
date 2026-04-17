import {
  detectConsecutiveFrac,
  extractFracHistory,
  suggestNextFracGroup,
} from '@/lib/tratamente/rotatie-frac'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

const produse = [
  {
    id: 'p1',
    tenant_id: null,
    nume_comercial: 'Switch 62.5 WG',
    substanta_activa: 'ciprodinil + fludioxonil',
    tip: 'fungicid',
    frac_irac: 'FRAC 9 + 12',
    doza_min_ml_per_hl: null,
    doza_max_ml_per_hl: null,
    doza_min_l_per_ha: 1,
    doza_max_l_per_ha: 1,
    phi_zile: 3,
    nr_max_aplicari_per_sezon: 3,
    interval_min_aplicari_zile: 7,
    omologat_culturi: ['zmeur'],
    activ: true,
    created_at: '2026-04-16T00:00:00.000Z',
    updated_at: '2026-04-16T00:00:00.000Z',
    created_by: null,
  },
  {
    id: 'p2',
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
  {
    id: 'p3',
    tenant_id: null,
    nume_comercial: 'Topas 100 EC',
    substanta_activa: 'penconazol',
    tip: 'fungicid',
    frac_irac: 'FRAC 3',
    doza_min_ml_per_hl: null,
    doza_max_ml_per_hl: null,
    doza_min_l_per_ha: 0.5,
    doza_max_l_per_ha: 0.5,
    phi_zile: 14,
    nr_max_aplicari_per_sezon: 2,
    interval_min_aplicari_zile: 10,
    omologat_culturi: ['zmeur'],
    activ: true,
    created_at: '2026-04-16T00:00:00.000Z',
    updated_at: '2026-04-16T00:00:00.000Z',
    created_by: null,
  },
] satisfies ProdusFitosanitar[]

describe('rotatie-frac', () => {
  it('extrage cronologia codurilor FRAC', () => {
    const timeline = extractFracHistory(
      [
        { aplicareId: 'a1', produsId: 'p2', produsNume: 'Kocide 2000', dataAplicata: '2026-04-10' },
        { aplicareId: 'a2', produsId: 'p1', produsNume: 'Switch 62.5 WG', dataAplicata: '2026-04-17' },
      ],
      produse
    )

    expect(timeline[0]?.codPrincipal).toBe('M01')
    expect(timeline[1]?.coduri).toEqual(['9', '12'])
  })

  it('detectează secvențe consecutive peste prag', () => {
    const timeline = extractFracHistory(
      [
        { aplicareId: 'a1', produsId: 'p2', produsNume: 'Kocide 2000', dataAplicata: '2026-04-10' },
        { aplicareId: 'a2', produsId: 'p2', produsNume: 'Kocide 2000', dataAplicata: '2026-04-17' },
        { aplicareId: 'a3', produsId: 'p2', produsNume: 'Kocide 2000', dataAplicata: '2026-04-24' },
      ],
      produse
    )

    const violations = detectConsecutiveFrac(timeline, 2)
    expect(violations).toHaveLength(1)
    expect(violations[0]?.code).toBe('M01')
    expect(violations[0]?.count).toBe(3)
  })

  it('exclude din timeline aplicările cu frac_irac null', () => {
    const timeline = extractFracHistory(
      [
        { aplicareId: 'a-fara-frac', produsNume: 'Produs fără FRAC', dataAplicata: '2026-04-05' },
      ],
      [
        ...produse,
        {
          id: 'p4',
          tenant_id: null,
          nume_comercial: 'Produs fără FRAC',
          substanta_activa: 'extract natural',
          tip: 'altul',
          frac_irac: null,
          doza_min_ml_per_hl: null,
          doza_max_ml_per_hl: null,
          doza_min_l_per_ha: null,
          doza_max_l_per_ha: null,
          phi_zile: null,
          nr_max_aplicari_per_sezon: null,
          interval_min_aplicari_zile: null,
          omologat_culturi: ['zmeur'],
          activ: true,
          created_at: '2026-04-16T00:00:00.000Z',
          updated_at: '2026-04-16T00:00:00.000Z',
          created_by: null,
        },
      ]
    )

    expect(timeline).toHaveLength(1)
    expect(timeline[0]?.coduri).toEqual([])
    expect(timeline[0]?.codPrincipal).toBeNull()
  })

  it('detectConsecutiveFrac pe timeline gol returnează []', () => {
    expect(detectConsecutiveFrac([])).toEqual([])
  })

  it('sugerează coduri alternative pentru următoarea aplicare', () => {
    const timeline = extractFracHistory(
      [
        { aplicareId: 'a1', produsId: 'p2', produsNume: 'Kocide 2000', dataAplicata: '2026-04-10' },
        { aplicareId: 'a2', produsId: 'p2', produsNume: 'Kocide 2000', dataAplicata: '2026-04-17' },
      ],
      produse
    )

    const suggestions = suggestNextFracGroup(timeline, produse)
    expect(suggestions).not.toContain('M01')
    expect(suggestions).toContain('3')
  })
})
