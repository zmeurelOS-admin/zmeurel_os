import { describe, expect, it } from 'vitest'

import { catreCsv, celulaCsv, numarCsv, numeFisierCsv } from '@/lib/export/csv'

describe('CSV pentru Excel în română (promptul 35, §4)', () => {
  it('numerele: virgulă zecimală, fără separator de mii, rotunjite la 2 zecimale', () => {
    expect(numarCsv(1250)).toBe('1250')
    expect(numarCsv(12.5)).toBe('12,5')
    expect(numarCsv(0.1 + 0.2)).toBe('0,3')
    expect(numarCsv(Number.NaN)).toBe('')
  })

  it('textul: ghilimele la `;`, ghilimele și rând nou; diacriticele rămân', () => {
    expect(celulaCsv('Mega Image; Suceava')).toBe('"Mega Image; Suceava"')
    expect(celulaCsv('Spune "da"')).toBe('"Spune ""da"""')
    expect(celulaCsv('rând 1\nrând 2')).toBe('"rând 1\nrând 2"')
    expect(celulaCsv('Ștefan cel Mare')).toBe('Ștefan cel Mare')
    expect(celulaCsv(null)).toBe('')
    expect(celulaCsv(true)).toBe('da')
  })

  it('formulele nu se execută în Excel; telefoanele și numerele negative rămân', () => {
    expect(celulaCsv('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(celulaCsv('@cmd')).toBe("'@cmd")
    expect(celulaCsv('-abc')).toBe("'-abc")
    expect(celulaCsv('+40 744 112 233')).toBe('+40 744 112 233')
    expect(celulaCsv(-12.5)).toBe('-12,5')
  })

  it('documentul: BOM, `;`, CRLF', () => {
    const csv = catreCsv(['Client', 'kg'], [['Ana', 12.5], ['Ion; Pop', 4]])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toBe('﻿Client;kg\r\nAna;12,5\r\n"Ion; Pop";4\r\n')
  })

  it('numele fișierului: fără diacritice și spații', () => {
    expect(numeFisierCsv('Comenzi', '2026-11-28')).toBe('comenzi-2026-11-28.csv')
    expect(numeFisierCsv('Încasări și plăți', '2026-11-28')).toBe('incasari-si-plati-2026-11-28.csv')
  })
})
