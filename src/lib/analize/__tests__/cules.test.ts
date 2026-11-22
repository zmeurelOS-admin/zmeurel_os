import { describe, expect, it } from 'vitest'

import { estimeazaCules, estimeazaCulesParcele, mutaInAnul, primaRecoltareInAn } from '@/lib/analize/cules'

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
