import { describe, expect, it } from 'vitest'

import { culturaNormalizata, recoltatCal1PentruStoc } from '@/lib/stoc-pe-produs'

describe('stocul cal. 1 pe produsul vândut (zmeura)', () => {
  it('două culturi (zmeură + mure): doar zmeura intră în stoc', () => {
    expect(
      recoltatCal1PentruStoc([
        { kg_cal1: 20, cultura: 'Zmeure Delniwa' },
        { kg_cal1: 10, cultura: 'Zmeură' },
        { kg_cal1: 15, cultura: 'Mure' },
      ]),
    ).toBe(30)
  })

  it('o singură cultură: același rezultat ca înainte (toate recoltările)', () => {
    const zmeura = [
      { kg_cal1: 12.5, cultura: 'zmeura' },
      { kg_cal1: 7.25, cultura: 'Zmeură' },
    ]
    expect(recoltatCal1PentruStoc(zmeura)).toBe(19.75)
    const mure = [
      { kg_cal1: 5, cultura: 'Mur' },
      { kg_cal1: 3, cultura: 'Mur' },
    ]
    expect(recoltatCal1PentruStoc(mure)).toBe(8)
  })

  it('fără zmeură deloc (solarii): toate recoltările, ca înainte', () => {
    expect(
      recoltatCal1PentruStoc([
        { kg_cal1: 10, cultura: 'Roșii' },
        { kg_cal1: 4, cultura: 'Castraveți' },
      ]),
    ).toBe(14)
  })

  it('o recoltare fără cultură cunoscută nu e numărată la zmeură', () => {
    expect(
      recoltatCal1PentruStoc([
        { kg_cal1: 10, cultura: 'Zmeură' },
        { kg_cal1: 99, cultura: null },
      ]),
    ).toBe(10)
  })

  it('normalizarea: fără diacritice, fără majuscule, fără spații la capete', () => {
    expect(culturaNormalizata('  Zmeură ')).toBe('zmeura')
    expect(culturaNormalizata('Castraveți')).toBe('castraveti')
    expect(culturaNormalizata('')).toBeNull()
  })
})
