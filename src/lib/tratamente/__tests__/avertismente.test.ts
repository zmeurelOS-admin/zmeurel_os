import { describe, expect, it } from 'vitest'

import { avertismentMeteo, avertismenteStropire, grupeRezistenta, type AplicareIstoric, type ProdusNou } from '../avertismente'

const M1 = { id: 'm1', nume: 'Maravilla 1' }

const switchProdus: ProdusNou = { produsId: 'sw', nume: 'Switch', frac: 'FRAC 9 + 12', nrMaxPeSezon: 3, intervalMinZile: 7 }
const serenade: ProdusNou = { produsId: 'se', nume: 'Serenade ASO', frac: null, nrMaxPeSezon: null, intervalMinZile: null }

const scalaMarti: AplicareIstoric = {
  parcelaId: 'm1',
  zi: '2026-07-15',
  produse: [{ produsId: 'sc', nume: 'Scala', frac: 'FRAC 9' }],
}

describe('grupele FRAC / IRAC', () => {
  it('desparte și normalizează', () => {
    expect(grupeRezistenta('FRAC 9 + 12')).toEqual(['FRAC 9', 'FRAC 12'])
    expect(grupeRezistenta('FRAC 7 + 11')).toEqual(['FRAC 7', 'FRAC 11'])
    expect(grupeRezistenta('IRAC 3A')).toEqual(['IRAC 3A'])
    expect(grupeRezistenta('FRAC M01')).toEqual(['FRAC M1'])
    expect(grupeRezistenta('M1')).toEqual(['FRAC M1'])
    expect(grupeRezistenta(null)).toEqual([])
  })
})

describe('avertismentele la stropire', () => {
  it('aceeași grupă ca tratamentul anterior pe parcelă', () => {
    const list = avertismenteStropire({ produse: [switchProdus], parcele: [M1], istoric: [scalaMarti], zi: '2026-07-17', azi: '2026-07-17' })
    expect(list.map((item) => item.tip)).toEqual(['frac'])
    expect(list[0].titlu).toBe('Grupa FRAC 9, de două ori la rând')
    // Mai multe grupe comune: un singur avertisment pe produs.
    const dublu = avertismenteStropire({
      produse: [switchProdus],
      parcele: [M1],
      istoric: [{ ...scalaMarti, produse: [{ produsId: 'sw', nume: 'Switch', frac: 'FRAC 9 + 12' }] }],
      zi: '2026-07-17',
      azi: '2026-07-17',
    }).filter((item) => item.tip === 'frac')
    expect(dublu.map((item) => item.titlu)).toEqual(['Grupa FRAC 9 și 12, de două ori la rând'])
    expect(list[0].detaliu).toContain('ca Scala')
  })

  it('fără avertisment când grupa diferă sau tratamentul e mai vechi de 30 de zile', () => {
    expect(avertismenteStropire({ produse: [serenade], parcele: [M1], istoric: [scalaMarti], zi: '2026-07-17', azi: '2026-07-17' })).toEqual([])
    expect(
      avertismenteStropire({ produse: [switchProdus], parcele: [M1], istoric: [{ ...scalaMarti, zi: '2026-06-01' }], zi: '2026-07-17', azi: '2026-07-17' }),
    ).toEqual([])
    // Altă parcelă: nu contează.
    expect(
      avertismenteStropire({ produse: [switchProdus], parcele: [{ id: 'd', nume: 'Delniwa' }], istoric: [scalaMarti], zi: '2026-07-17', azi: '2026-07-17' }),
    ).toEqual([])
  })

  it('numărul maxim pe sezon (anul calendaristic) atins', () => {
    const istoric: AplicareIstoric[] = ['2026-05-01', '2026-06-01', '2026-06-20'].map((zi) => ({
      parcelaId: 'm1',
      zi,
      produse: [{ produsId: 'sw', nume: 'Switch', frac: null }],
    }))
    const list = avertismenteStropire({ produse: [{ ...switchProdus, frac: null }], parcele: [M1], istoric, zi: '2026-07-17', azi: '2026-07-17' })
    expect(list.map((item) => item.tip)).toEqual(['max_sezon'])
    // Anul trecut nu se numără.
    const anTrecut = istoric.map((item) => ({ ...item, zi: item.zi.replace('2026', '2025') }))
    expect(avertismenteStropire({ produse: [{ ...switchProdus, frac: null }], parcele: [M1], istoric: anTrecut, zi: '2026-07-17', azi: '2026-07-17' })).toEqual([])
  })

  it('intervalul minim neatins', () => {
    const istoric: AplicareIstoric[] = [{ parcelaId: 'm1', zi: '2026-07-13', produse: [{ produsId: 'sw', nume: 'Switch', frac: null }] }]
    const list = avertismenteStropire({ produse: [{ ...switchProdus, frac: null }], parcele: [M1], istoric, zi: '2026-07-17', azi: '2026-07-17' })
    expect(list.map((item) => item.tip)).toEqual(['interval'])
    expect(list[0].detaliu).toContain('4 zile')
  })

  it('meteo: doar când prognoza spune că nu se poate stropi', () => {
    expect(avertismentMeteo({ canSpray: true })).toBeNull()
    expect(avertismentMeteo(null)).toBeNull()
    expect(avertismentMeteo({ canSpray: false, reason: 'Ploaie în 3 ore' })?.detaliu).toBe('Ploaie în 3 ore')
  })
})
