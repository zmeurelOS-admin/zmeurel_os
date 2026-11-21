import { describe, expect, it } from 'vitest'

import {
  cantitateStropire,
  citesteTextFertirigare,
  dozaDinCatalog,
  formatCantitate,
  formatDoza,
  imparteProportional,
  kgFertirigare,
  modImplicit,
  partiPeParcele,
  suprafataHa,
  textFertirigare,
  unitateImplicita,
  volumeDeSalvat,
  volumPropus,
} from '../doze'

describe('doze la stropire', () => {
  it('la 100 l: doza × volum / 100', () => {
    expect(cantitateStropire({ doza: 100, mod: 'hl', volumL: 110, suprafataHa: 0 })).toBe(110)
    expect(cantitateStropire({ doza: 250, mod: 'hl', volumL: 110, suprafataHa: 0 })).toBe(275)
  })

  it('la ha: doza × suprafața (în unitatea mică)', () => {
    // Maravilla 1 (700 m²) + Maravilla 2 (560 m²) = 0,126 ha; Switch 1 kg/ha → 126 g.
    const ha = suprafataHa([{ suprafata_m2: 700 }, { suprafata_m2: 560 }])
    expect(ha).toBeCloseTo(0.126)
    expect(cantitateStropire({ doza: 1, mod: 'ha', volumL: null, suprafataHa: ha })).toBe(126)
  })

  it('fără volum sau fără suprafață: nu se poate calcula', () => {
    expect(cantitateStropire({ doza: 100, mod: 'hl', volumL: null, suprafataHa: 1 })).toBeNull()
    expect(cantitateStropire({ doza: 1, mod: 'ha', volumL: 100, suprafataHa: 0 })).toBeNull()
    expect(cantitateStropire({ doza: null, mod: 'hl', volumL: 100, suprafataHa: 0 })).toBeNull()
  })

  it('afișarea urcă la kg / l de la 1000', () => {
    expect(formatCantitate(110, 'g')).toBe('110 g')
    expect(formatCantitate(1500, 'g')).toBe('1,5 kg')
    expect(formatCantitate(2750, 'ml')).toBe('2,75 l')
    expect(formatDoza(100, 'hl', 'g')).toBe('100 g / 100 l')
    expect(formatDoza(1, 'ha', 'g')).toBe('1 kg / ha')
    expect(formatDoza(0.8, 'ha', 'ml')).toBe('0,8 l / ha')
  })

  it('unitatea implicită din formulare și modul din etichetă', () => {
    expect(unitateImplicita({ nume_comercial: 'Switch 62.5 WG' })).toBe('g')
    expect(unitateImplicita({ nume_comercial: 'Nissorun 10 WP' })).toBe('g')
    expect(unitateImplicita({ nume_comercial: 'Karate Zeon' })).toBe('ml')
    expect(unitateImplicita({ nume_comercial: 'Calcinit', tip: 'ingrasamant' })).toBe('g')
    expect(modImplicit({ doza_min_l_per_ha: 1 })).toBe('ha')
    expect(modImplicit({ doza_min_ml_per_hl: 15, doza_min_l_per_ha: 0.15 })).toBe('hl')
    expect(dozaDinCatalog({ doza_min_ml_per_hl: 15, doza_max_ml_per_hl: 20 }, 'hl')).toBe(15)
    expect(dozaDinCatalog({ doza_min_l_per_ha: null, doza_max_l_per_ha: 2.5 }, 'ha')).toBe(2.5)
  })
})

describe('fertirigare', () => {
  it('kg pe parcelă = g/plantă × plante / 1000', () => {
    expect(kgFertirigare(2, 1000)).toBe(2)
    expect(kgFertirigare(2, 450)).toBe(0.9)
    expect(kgFertirigare(2, null)).toBeNull()
  })

  it('textul din cantitate_text se citește înapoi', () => {
    expect(textFertirigare(2.5, 'B')).toBe('2,5 g/plantă · rezervor B')
    expect(citesteTextFertirigare('2,5 g/plantă · rezervor B')).toEqual({ gPePlanta: 2.5, rezervor: 'B' })
    expect(citesteTextFertirigare('1 kg')).toBeNull()
  })
})

describe('volumul de soluție', () => {
  it('propus = suma parcelelor; dacă una n-are volum, pornește gol', () => {
    expect(volumPropus([{ id: 'a', volum_solutie_l: 60 }, { id: 'b', volum_solutie_l: 50 }])).toBe(110)
    expect(volumPropus([{ id: 'a', volum_solutie_l: 60 }, { id: 'b', volum_solutie_l: null }])).toBeNull()
    expect(volumPropus([])).toBeNull()
  })

  it('se învață la primul tratament: doar parcelele fără volum, restul împărțit după suprafață', () => {
    expect(
      volumeDeSalvat(
        [
          { id: 'a', volum_solutie_l: null, suprafata_m2: 700 },
          { id: 'b', volum_solutie_l: null, suprafata_m2: 700 },
        ],
        120,
      ),
    ).toEqual([
      { id: 'a', volum: 60 },
      { id: 'b', volum: 60 },
    ])
    expect(
      volumeDeSalvat(
        [
          { id: 'a', volum_solutie_l: 60, suprafata_m2: 700 },
          { id: 'b', volum_solutie_l: null, suprafata_m2: 560 },
        ],
        110,
      ),
    ).toEqual([{ id: 'b', volum: 50 }])
    // Nu suprascrie și nu inventează când volumul e mai mic decât cel știut.
    expect(volumeDeSalvat([{ id: 'a', volum_solutie_l: 60 }, { id: 'b', volum_solutie_l: null }], 50)).toEqual([])
    expect(volumeDeSalvat([{ id: 'a', volum_solutie_l: 60 }], 200)).toEqual([])
  })

  it('împărțirea pe parcele dă exact totalul', () => {
    const parti = imparteProportional(100, [1, 1, 1])
    expect(parti.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10)
    expect(imparteProportional(10, [0, 0])).toEqual([5, 5])
    expect(partiPeParcele({ mod: 'ha', total: 126 }, [{ id: 'a', suprafata_m2: 700 }, { id: 'b', suprafata_m2: 560 }])).toEqual([70, 56])
    expect(partiPeParcele({ mod: 'hl', total: 110 }, [{ id: 'a', volum_solutie_l: 60 }, { id: 'b', volum_solutie_l: 50 }])).toEqual([60, 50])
  })
})
