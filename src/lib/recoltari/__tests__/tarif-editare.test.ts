import { describe, expect, it } from 'vitest'

import { estimatePaymentLei, tarifPentruPlata } from '@/lib/recoltari/day-view'

describe('recoltări — tariful la editare', () => {
  const editing = { culegator_id: 'w1', pret_lei_pe_kg_snapshot: 2 }

  it('la creare se ia tariful curent al culegătorului', () => {
    expect(tarifPentruPlata({ culegatorId: 'w1', tarifCurent: 3, editing: null })).toBe(3)
  })

  it('la editare, cu același culegător, rămâne tariful salvat (doar kg se schimbă)', () => {
    const tarif = tarifPentruPlata({ culegatorId: 'w1', tarifCurent: 3, editing })
    expect(tarif).toBe(2)
    expect(estimatePaymentLei(15, tarif)).toBe(30)
  })

  it('tariful salvat 0 e o valoare, nu lipsă', () => {
    expect(tarifPentruPlata({ culegatorId: 'w1', tarifCurent: 3, editing: { culegator_id: 'w1', pret_lei_pe_kg_snapshot: 0 } })).toBe(0)
  })

  it('la schimbarea culegătorului se ia tariful curent al noului culegător', () => {
    expect(tarifPentruPlata({ culegatorId: 'w2', tarifCurent: 3.5, editing })).toBe(3.5)
    expect(tarifPentruPlata({ culegatorId: 'w2', tarifCurent: null, editing })).toBeNull()
  })

  it('rând vechi fără tarif salvat: tariful curent', () => {
    expect(tarifPentruPlata({ culegatorId: 'w1', tarifCurent: 3, editing: { culegator_id: 'w1', pret_lei_pe_kg_snapshot: null } })).toBe(3)
  })

  it('același culegător fără tarif în profil azi: tot tariful salvat', () => {
    expect(tarifPentruPlata({ culegatorId: 'w1', tarifCurent: null, editing })).toBe(2)
  })
})
