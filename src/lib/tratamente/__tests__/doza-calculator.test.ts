import { calculeazaCantitateTotala } from '@/lib/tratamente/doza-calculator'

describe('doza-calculator', () => {
  it('calculează cantitatea totală din l/ha', () => {
    const result = calculeazaCantitateTotala(
      { doza_l_per_ha: 1.5, doza_ml_per_hl: null },
      0.8
    )

    expect(result).toEqual({ cantitateMl: 1200 })
  })

  it('calculează cantitatea totală din ml/hl', () => {
    const result = calculeazaCantitateTotala(
      { doza_l_per_ha: null, doza_ml_per_hl: 250 },
      1.2,
      12
    )

    expect(result).toEqual({ cantitateMl: 3600 })
  })

  it('returnează null când datele sunt insuficiente', () => {
    const result = calculeazaCantitateTotala(
      { doza_l_per_ha: null, doza_ml_per_hl: null },
      1
    )

    expect(result).toBeNull()
  })
})
