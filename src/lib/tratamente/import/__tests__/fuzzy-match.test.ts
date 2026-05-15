import { describe, expect, it } from 'vitest'

import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { fuzzyMatchProdus } from '@/lib/tratamente/import/fuzzy-match'

function makeProdus(
  id: string,
  numeComercial: string,
  substantaActiva: string
): ProdusFitosanitar {
  return {
    id,
    tenant_id: null,
    nume_comercial: numeComercial,
    substanta_activa: substantaActiva,
    tip: 'fungicid',
    frac_irac: null,
    doza_min_ml_per_hl: null,
    doza_max_ml_per_hl: null,
    doza_min_l_per_ha: null,
    doza_max_l_per_ha: null,
    phi_zile: 3,
    nr_max_aplicari_per_sezon: null,
    interval_min_aplicari_zile: null,
    omologat_culturi: ['zmeur'],
    activ: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    created_by: null,
  }
}

const produse = [
  makeProdus('1', 'Kumulus S', 'sulf'),
  makeProdus('2', 'Mospilan 20 SG', 'acetamiprid'),
  makeProdus('3', 'Teldor 500 SC', 'fenhexamid'),
]

describe('fuzzyMatchProdus', () => {
  it('returnează fuzzy pentru „Kumulus” spre „Kumulus S”', () => {
    const result = fuzzyMatchProdus('Kumulus', produse)

    expect(result.tip).toBe('fuzzy')
    if (result.tip !== 'fuzzy') throw new Error('Expected fuzzy match')
    expect(result.sugestii[0]?.produs_nume).toBe('Kumulus S')
    expect(result.sugestii[0]?.scor).toBeGreaterThan(70)
  })

  it('returnează fuzzy pentru „Mospilan” spre „Mospilan 20 SG”', () => {
    const result = fuzzyMatchProdus('Mospilan', produse)

    expect(result.tip).toBe('fuzzy')
    if (result.tip !== 'fuzzy') throw new Error('Expected fuzzy match')
    expect(result.sugestii[0]?.produs_nume).toBe('Mospilan 20 SG')
  })

  it('returnează exact pentru lowercase fără diferențe relevante', () => {
    const result = fuzzyMatchProdus('kumulus s', produse)

    expect(result).toMatchObject({
      tip: 'exact',
      produs_nume: 'Kumulus S',
    })
  })

  it('returnează none pentru produs inexistent', () => {
    expect(fuzzyMatchProdus('XYZ inexistent', produse)).toEqual({ tip: 'none' })
  })

  it('returnează fuzzy pentru „Teldor” spre „Teldor 500 SC”', () => {
    const result = fuzzyMatchProdus('Teldor', produse)

    expect(result.tip).toBe('fuzzy')
    if (result.tip !== 'fuzzy') throw new Error('Expected fuzzy match')
    expect(result.sugestii[0]?.produs_nume).toBe('Teldor 500 SC')
    expect(result.sugestii[0]?.scor).toBeGreaterThan(60)
  })
})
