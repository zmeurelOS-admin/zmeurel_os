import { describe, expect, it } from 'vitest'

import {
  ajustariPeZile,
  cal2InSezon,
  deltaKgText,
  descompunereStoc,
  etichetaAjustare,
  problemaAjustare,
} from '@/lib/stocuri/stoc'

describe('descompunereStoc', () => {
  it('se leagă exact de cifra mare: recoltat − livrat − în livrare + ajustări', () => {
    const d = descompunereStoc({
      recoltatCal1Kg: 1804,
      consumatDefinitivCal1Kg: 1590,
      rezervatActivCal1Kg: 25,
      stocCal1LedgerKg: 196,
      disponibilCal1Kg: 171,
    })
    expect(d).toEqual({ disponibil: 171, recoltat: 1804, livrat: 1590, inLivrare: 25, ajustari: -18 })
    expect(d.recoltat - d.livrat - d.inLivrare + d.ajustari).toBe(d.disponibil)
  })

  it('ajustări pozitive și zecimale', () => {
    const d = descompunereStoc({
      recoltatCal1Kg: 10.5,
      consumatDefinitivCal1Kg: 2.25,
      rezervatActivCal1Kg: 0,
      stocCal1LedgerKg: 11.25,
      disponibilCal1Kg: 11.25,
    })
    expect(d.ajustari).toBe(3)
  })
})

describe('cal2InSezon', () => {
  const parcele = [
    { id: 'z', cultura: 'Zmeură', tip_fruct: null },
    { id: 'm', cultura: null, tip_fruct: 'Mure' },
  ]

  it('doar sezonul curent și doar zmeura când ferma are zmeură', () => {
    const recoltari = [
      { data: '2025-08-01', parcela_id: 'z', kg_cal2: 100 },
      { data: '2026-06-10', parcela_id: 'z', kg_cal2: 4 },
      { data: '2026-07-01', parcela_id: 'z', kg_cal2: 6.5 },
      { data: '2026-07-01', parcela_id: 'm', kg_cal2: 20 },
      { data: '2026-12-01', parcela_id: 'z', kg_cal2: 9 },
    ]
    expect(cal2InSezon(recoltari, parcele, '2026-11-21')).toBe(10.5)
  })

  it('fără zmeură numără toate culturile', () => {
    const recoltari = [{ data: '2026-07-01', parcela_id: 'm', kg_cal2: 3 }]
    expect(cal2InSezon(recoltari, parcele, '2026-11-21')).toBe(3)
  })
})

describe('problemaAjustare', () => {
  it('cere motivul și kg', () => {
    expect(problemaAjustare(null, 2, 10)).toBe('Alege motivul.')
    expect(problemaAjustare('pierdere', null, 10)).toBe('Scrie câte kilograme.')
  })

  it('o scădere nu duce disponibilul sub 0', () => {
    expect(problemaAjustare('pierdere', 2, 10)).toBeNull()
    expect(problemaAjustare('corectie_minus', 10, 10)).toBeNull()
    expect(problemaAjustare('corectie_minus', 10.01, 10)).toMatch(/doar 10 kg/)
    expect(problemaAjustare('congelat', 1, 0)).toMatch(/nu ai ce scădea/)
  })

  it('corecția în plus nu are limită', () => {
    expect(problemaAjustare('corectie_plus', 500, 0)).toBeNull()
  })
})

describe('istoricul ajustărilor', () => {
  it('grupează pe zile, cea mai nouă întâi', () => {
    const grupe = ajustariPeZile([
      { id: 'a', data: '2026-11-05', delta_kg: -8, tip: 'pierdere', motiv: null, created_at: '2026-11-05T08:00:00Z' },
      { id: 'b', data: '2026-11-09', delta_kg: -10, tip: 'congelat', motiv: 'gem', created_at: '2026-11-09T08:00:00Z' },
      { id: 'c', data: '2026-11-09', delta_kg: 2, tip: 'corectie_plus', motiv: null, created_at: '2026-11-09T09:00:00Z' },
    ])
    expect(grupe.map((g) => g.zi)).toEqual(['2026-11-09', '2026-11-05'])
    expect(grupe[0].randuri.map((r) => r.id)).toEqual(['c', 'b'])
  })

  it('textele', () => {
    expect(deltaKgText(-10)).toBe('− 10 kg')
    expect(deltaKgText(4.5)).toBe('+ 4,5 kg')
    expect(etichetaAjustare('procesat')).toBe('Procesat (gem, suc)')
    expect(etichetaAjustare('necunoscut')).toBe('necunoscut')
  })
})

describe('cal2InSezon pe cultură', () => {
  it('doar recoltările culturii cerute', async () => {
    const { cal2InSezon: cal2 } = await import('@/lib/stocuri/stoc')
    const parcele = [
      { id: 'z', cultura: 'Zmeure Delniwa', tip_fruct: null },
      { id: 'm', cultura: 'Mure', tip_fruct: null },
    ]
    const recoltari = [
      { data: '2026-11-20', parcela_id: 'z', kg_cal2: 4 },
      { data: '2026-11-20', parcela_id: 'm', kg_cal2: 6 },
    ]
    expect(cal2(recoltari, parcele, '2026-11-21', 'mur')).toBe(6)
    expect(cal2(recoltari, parcele, '2026-11-21', 'zmeur')).toBe(4)
    expect(cal2(recoltari, parcele, '2026-11-21')).toBe(4)
  })
})
