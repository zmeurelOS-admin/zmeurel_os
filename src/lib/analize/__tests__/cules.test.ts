import { describe, expect, it } from 'vitest'

import {
  culesConteaza,
  estimeazaCules,
  lipsaDataCulesConteaza,
  estimeazaCulesParcele,
  faraDataCules,
  mutaInAnul,
  nicioParcelaCuDataCules,
  primaRecoltareInAn,
} from '@/lib/analize/cules'

const recoltari = [
  { parcela_id: 'm1', data: '2025-06-28' },
  { parcela_id: 'm1', data: '2025-06-24' },
  { parcela_id: 'm1', data: '2026-06-20' },
  { parcela_id: 'm2', data: '2024-07-01' },
  { parcela_id: null, data: '2025-06-01' },
]

describe('estimarea culesului (cele 3 surse)', () => {
  it('1. data pusă de mână câștigă', () => {
    expect(estimeazaCules({ parcelaId: 'm1', an: 2026, manual: '2026-06-15', recoltari })).toEqual({
      parcelaId: 'm1',
      data: '2026-06-15',
      sursa: 'manual',
      primaRecoltareAnTrecut: '2025-06-24',
    })
  })

  it('2. fără dată de mână: prima recoltare de anul trecut, mutată în anul curent', () => {
    const e = estimeazaCules({ parcelaId: 'm1', an: 2026, manual: null, recoltari })
    expect(e.data).toBe('2026-06-24')
    expect(e.sursa).toBe('anul_trecut')
  })

  it('3. nimic: data e null (fișa cere „Pune data culesului”)', () => {
    // m2 are recoltare doar acum doi ani, nu anul trecut.
    expect(estimeazaCules({ parcelaId: 'm2', an: 2026, recoltari })).toEqual({ parcelaId: 'm2', data: null, sursa: null, primaRecoltareAnTrecut: null })
  })

  it('o dată de mână nevalidă nu contează', () => {
    expect(estimeazaCules({ parcelaId: 'm1', an: 2026, manual: 'mâine', recoltari }).sursa).toBe('anul_trecut')
  })

  it('29 februarie devine 28 februarie într-un an fără zi bisectă', () => {
    expect(mutaInAnul('2024-02-29', 2025)).toBe('2025-02-28')
    expect(mutaInAnul('2024-02-29', 2028)).toBe('2028-02-29')
  })

  it('prima recoltare din an ignoră alte parcele și alți ani', () => {
    expect(primaRecoltareInAn(recoltari, 'm1', 2025)).toBe('2025-06-24')
    expect(primaRecoltareInAn(recoltari, 'm1', 2024)).toBeNull()
  })

  it('pe mai multe parcele', () => {
    const m = estimeazaCulesParcele({ parcelaIds: ['m1', 'm2'], an: 2026, manuale: new Map([['m2', '2026-07-10']]), recoltari })
    expect(m.get('m1')?.data).toBe('2026-06-24')
    expect(m.get('m2')?.sursa).toBe('manual')
  })
})

describe('parcelele fără dată de cules (eticheta din listă, mesajul de pe fișă și din foaie)', () => {
  const estimari = (manuale: Record<string, string | null>) =>
    estimeazaCulesParcele({ parcelaIds: ['m1', 'm2', 'd'], an: 2026, manuale: new Map(Object.entries(manuale)), recoltari })

  it('fără dată = nici pusă de mână, nici din anul trecut', () => {
    const e = estimari({})
    expect(faraDataCules(e.get('m1'))).toBe(false) // din prima recoltare din 2025
    expect(faraDataCules(e.get('m2'))).toBe(true) // recoltare doar în 2024
    expect(faraDataCules(e.get('d'))).toBe(true)
    expect(faraDataCules(estimari({ d: '2026-07-01' }).get('d'))).toBe(false)
  })

  it('mesajul apare doar când nicio parcelă de vânzare nu are dată', () => {
    expect(nicioParcelaCuDataCules(estimari({}))).toBe(false)
    const fara = estimeazaCulesParcele({ parcelaIds: ['m2', 'd'], an: 2026, manuale: new Map(), recoltari })
    expect(nicioParcelaCuDataCules(fara)).toBe(true)
    expect(nicioParcelaCuDataCules(new Map())).toBe(false)
  })
})

// Promptul 33, 9.2: „fără dată de cules” doar când contează.
describe('culesConteaza: între „Legare fruct” și „Recoltare”, pe oricare lăstar, în anul acesta', () => {
  const AN = 2026
  it('legare fruct, fructe verzi, pârgă, recoltare: da', () => {
    for (const stadiu of ['legare_fruct', 'fruct_verde', 'parga', 'maturitate']) {
      expect(culesConteaza([{ stadiu, zi: '2026-06-10' }], AN)).toBe(true)
    }
  })

  it('repaus, înflorit, după recoltare, tăiat, păstrat sau fără stadiu: nu', () => {
    for (const stadiu of ['repaus_vegetativ', 'inflorit', 'post_recoltare', 'pastrat', 'umflare_muguri', null]) {
      expect(culesConteaza([{ stadiu, zi: '2026-06-10' }], AN)).toBe(false)
    }
    expect(culesConteaza([], AN)).toBe(false)
  })

  it('pe oricare lăstar: an 2 în repaus, an 1 cu legare fruct = da', () => {
    expect(culesConteaza([{ stadiu: 'pastrat', zi: '2025-11-01' }, { stadiu: 'legare_fruct', zi: '2026-07-20' }], AN)).toBe(true)
  })

  it('un stadiu rămas de anul trecut nu contează (ianuarie, „Recoltare” din vara trecută)', () => {
    expect(culesConteaza([{ stadiu: 'maturitate', zi: '2025-07-15' }], AN)).toBe(false)
  })

  it('mesajul „Pune data culesului…”: doar dacă nicio parcelă n-are dată și una e într-un stadiu în care contează', () => {
    const recoltari: Array<{ parcela_id: string; data: string }> = []
    const fara = estimeazaCulesParcele({ parcelaIds: ['a', 'b'], an: AN, manuale: new Map(), recoltari })
    expect(lipsaDataCulesConteaza(fara, (id) => id === 'b')).toBe(true)
    expect(lipsaDataCulesConteaza(fara, () => false)).toBe(false)
    // O parcelă cu dată pusă de mână: neschimbat, nu apare mesajul, oricare ar fi stadiul.
    const cuData = estimeazaCulesParcele({ parcelaIds: ['a', 'b'], an: AN, manuale: new Map([['a', '2026-07-01']]), recoltari })
    expect(lipsaDataCulesConteaza(cuData, () => true)).toBe(false)
    expect(faraDataCules(cuData.get('a'))).toBe(false)
  })
})
