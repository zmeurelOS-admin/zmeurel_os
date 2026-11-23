import { describe, expect, it } from 'vitest'

import { culturileFermei } from '@/lib/parcele/culturi-ferma'
import { etichetaStocFerma, stocPeCultura } from '@/lib/stocuri/pe-cultura'

describe('stocPeCultura', () => {
  const culturi = culturileFermei([{ cultura: 'Zmeure Delniwa' }, { cultura: 'Zmeură' }, { cultura: 'Mure' }])

  it('fiecare cultură cu recoltările, comenzile și ajustările ei', () => {
    const stoc = stocPeCultura(
      [
        { sursa: 'recoltat', cultura: 'zmeure delniwa', kg: 100 },
        { sursa: 'recoltat', cultura: 'zmeura', kg: 20 },
        { sursa: 'recoltat', cultura: 'mure', kg: 30 },
        { sursa: 'livrat', cultura: 'Zmeură proaspătă', kg: 40 },
        { sursa: 'in_livrare', cultura: 'Mure proaspete', kg: 5 },
        { sursa: 'ajustare', cultura: 'mur', kg: -2.5 },
      ],
      culturi,
    )
    expect(stoc).toEqual([
      { cheie: 'zmeur', nume: 'Zmeură', forma: 'f-sg', recoltat: 120, livrat: 40, inLivrare: 0, ajustari: 0, disponibil: 80 },
      { cheie: 'mur', nume: 'Mure', forma: 'f-pl', recoltat: 30, livrat: 0, inLivrare: 5, ajustari: -2.5, disponibil: 22.5 },
    ])
  })

  it('ce nu are cultură merge la zmeură, ca până acum', () => {
    const stoc = stocPeCultura(
      [
        { sursa: 'recoltat', cultura: 'zmeura', kg: 50 },
        { sursa: 'livrat', cultura: null, kg: 10 },
        { sursa: 'ajustare', cultura: null, kg: -5 },
      ],
      culturi,
    )
    expect(stoc[0]).toMatchObject({ cheie: 'zmeur', disponibil: 35 })
    expect(stoc[1]).toMatchObject({ cheie: 'mur', disponibil: 0 })
  })

  it('o cultură recoltată pe o parcelă inactivă apare la final', () => {
    const stoc = stocPeCultura([{ sursa: 'recoltat', cultura: 'afine', kg: 7 }], culturi)
    expect(stoc.map((rand) => rand.nume)).toEqual(['Zmeură', 'Mure', 'Afine'])
    expect(stoc[2].disponibil).toBe(7)
  })

  it('fără culturi și fără rânduri: nimic', () => {
    expect(stocPeCultura([], [])).toEqual([])
    expect(stocPeCultura([{ sursa: 'livrat', cultura: null, kg: 3 }], [])).toEqual([])
  })
})

describe('etichetaStocFerma', () => {
  it('fără parcele: null', () => {
    expect(etichetaStocFerma([])).toBeNull()
  })

  it('o cultură: acordul ei', () => {
    expect(etichetaStocFerma(culturileFermei([{ cultura: 'Afine' }]))).toBe('Afine cal. I disponibile')
    expect(etichetaStocFerma(culturileFermei([{ cultura: 'Zmeure Maravilla' }]))).toBe('Zmeură cal. I disponibilă')
  })

  it('mai multe culturi: zmeura dacă există, altfel toate', () => {
    expect(etichetaStocFerma(culturileFermei([{ cultura: 'Zmeură' }, { cultura: 'Mure' }]))).toBe('Zmeură cal. I disponibilă')
    expect(etichetaStocFerma(culturileFermei([{ cultura: 'Rosii' }, { cultura: 'Ardei' }]))).toBe('Cal. I disponibil, toate culturile')
  })
})
