import { describe, expect, it } from 'vitest'

import { investitiiInPerioada } from '@/lib/rapoarte/investitii'

const rows = [
  { id: 'a', data: '2026-11-03', categorie: 'Sistem irigație', suma_lei: 1200 },
  { id: 'b', data: '2026-11-15', categorie: 'Sistem irigație', suma_lei: 300.5 },
  { id: 'c', data: '2026-11-20', categorie: 'Utilaje și echipamente', suma_lei: 5000 },
  { id: 'd', data: '2026-10-31', categorie: 'Sistem irigație', suma_lei: 999 },
  { id: 'e', data: '2026-12-01', categorie: 'Utilaje și echipamente', suma_lei: 999 },
]

describe('Rapoarte — investițiile, separat', () => {
  it('totalul perioadei, cu capetele incluse', () => {
    const result = investitiiInPerioada(rows, '2026-11-01', '2026-11-30')
    expect(result.totalLei).toBe(6500.5)
    expect(result.count).toBe(3)
  })

  it('pe categorii, cea mai mare întâi', () => {
    const result = investitiiInPerioada(rows, '2026-11-01', '2026-11-30')
    expect(result.peCategorii.map((item) => item.lei)).toEqual([5000, 1500.5])
    expect(result.peCategorii[0].count).toBe(1)
  })

  it('nimic în perioadă: 0', () => {
    expect(investitiiInPerioada(rows, '2025-01-01', '2025-12-31')).toEqual({ totalLei: 0, count: 0, peCategorii: [] })
  })
})
