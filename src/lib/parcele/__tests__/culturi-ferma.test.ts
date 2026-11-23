import { describe, expect, it } from 'vitest'

import {
  cheieCultura,
  culturaPrincipala,
  culturaProdusului,
  culturileFermei,
  esteParcelaActiva,
  etichetaStocCal1,
  numeMic,
  numeProdusProaspat,
} from '@/lib/parcele/culturi-ferma'

describe('cheieCultura', () => {
  it('aceeași cultură, scrisă în mai multe feluri', () => {
    expect(cheieCultura('Zmeură')).toBe('zmeur')
    expect(cheieCultura('zmeura')).toBe('zmeur')
    expect(cheieCultura('Zmeure Delniwa')).toBe('zmeur')
    expect(cheieCultura('  ZMEURĂ  Maravilla ')).toBe('zmeur')
  })

  it('pomii și culturile mari', () => {
    expect(cheieCultura('Meri')).toBe('mar')
    expect(cheieCultura('Pruni')).toBe('prun')
    expect(cheieCultura('Floarea soarelui')).toBe('floarea soarelui')
    expect(cheieCultura('Rosii')).toBe('rosie')
    expect(cheieCultura('Castraveți')).toBe('castravete')
  })

  it('o cultură necunoscută rămâne textul ei; golul e null', () => {
    expect(cheieCultura('Mix fructe')).toBe('mix fructe')
    expect(cheieCultura('')).toBeNull()
    expect(cheieCultura(null)).toBeNull()
  })

  it('o cheie dată din nou dă aceeași cheie', () => {
    for (const cheie of ['zmeur', 'afin', 'mur', 'rosie', 'mar', 'mix fructe']) expect(cheieCultura(cheie)).toBe(cheie)
  })
})

describe('culturileFermei', () => {
  it('zero parcele: nicio cultură', () => {
    expect(culturileFermei([])).toEqual([])
  })

  it('o cultură, din mai multe parcele scrise diferit', () => {
    const culturi = culturileFermei([{ cultura: 'Zmeure Delniwa' }, { cultura: 'Zmeură' }, { cultura: null, tip_fruct: 'zmeura' }])
    expect(culturi).toEqual([{ cheie: 'zmeur', nume: 'Zmeură', forma: 'f-sg', parcele: 3 }])
  })

  it('mai multe culturi: cele cu mai multe parcele întâi; parcelele inactive nu intră', () => {
    const culturi = culturileFermei([
      { cultura: 'Afine' },
      { cultura: 'Zmeure Delniwa' },
      { cultura: 'Zmeure Maravilla' },
      { cultura: 'Mure', status_operational: 'inactiv' },
      { cultura: 'Mix fructe' },
    ])
    expect(culturi.map((cultura) => cultura.nume)).toEqual(['Zmeură', 'Afine', 'Mix fructe'])
  })

  it('demo Solarii: nicio zmeură', () => {
    const culturi = culturileFermei([{ cultura: 'Rosii' }, { cultura: 'Castraveti' }, { cultura: 'Ardei' }])
    expect(culturi.map((cultura) => cultura.nume)).toEqual(['Ardei', 'Castraveți', 'Roșii'])
    expect(culturi.some((cultura) => /zmeur/i.test(cultura.nume))).toBe(false)
  })

  it('parcela activă', () => {
    expect(esteParcelaActiva({ status: 'Activ', status_operational: 'activ' })).toBe(true)
    expect(esteParcelaActiva({ status_operational: 'arhivat' })).toBe(false)
    expect(esteParcelaActiva({})).toBe(true)
  })
})

describe('etichete și acord', () => {
  const [zmeura] = culturileFermei([{ cultura: 'Zmeură' }])
  const [afine] = culturileFermei([{ cultura: 'Afine' }])
  const [ardei] = culturileFermei([{ cultura: 'Ardei' }])

  it('eticheta stocului', () => {
    expect(etichetaStocCal1(zmeura)).toBe('Zmeură cal. I disponibilă')
    expect(etichetaStocCal1(afine)).toBe('Afine cal. I disponibile')
    expect(etichetaStocCal1(ardei)).toBe('Ardei cal. I disponibili')
  })

  it('produsul proaspăt și numele mic', () => {
    expect(numeProdusProaspat(zmeura)).toBe('Zmeură proaspătă')
    expect(numeProdusProaspat(afine)).toBe('Afine proaspete')
    expect(numeProdusProaspat(ardei)).toBe('Ardei proaspeți')
    expect(numeMic(afine)).toBe('afine')
  })
})

describe('culturaProdusului și cultura principală', () => {
  const culturi = culturileFermei([{ cultura: 'Zmeure Delniwa' }, { cultura: 'Mure' }, { cultura: 'Mix fructe' }])

  it('produsul își găsește cultura', () => {
    expect(culturaProdusului('Zmeură proaspătă', culturi)).toBe('zmeur')
    expect(culturaProdusului('Mure proaspete', culturi)).toBe('mur')
    expect(culturaProdusului('Mix fructe proaspete', culturi)).toBe('mix fructe')
    expect(culturaProdusului('Gem de casă', culturi)).toBeNull()
    expect(culturaProdusului(null, culturi)).toBeNull()
  })

  it('principala e zmeura, dacă există; altfel prima cultură', () => {
    expect(culturaPrincipala(culturi)?.cheie).toBe('zmeur')
    expect(culturaPrincipala(culturileFermei([{ cultura: 'Afine' }]))?.cheie).toBe('afin')
    expect(culturaPrincipala([])).toBeNull()
  })
})
