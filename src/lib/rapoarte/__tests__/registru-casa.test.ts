import { describe, expect, it } from 'vitest'

import { luniCuMiscari, registruCasa } from '@/lib/rapoarte/registru-casa'

const nume = (id: string | null) => (id === 'k1' ? 'Selgros' : 'Client fără nume')

describe('registrul de încasări și plăți (promptul 35, §8)', () => {
  const registru = registruCasa({
    luna: '2026-11',
    vanzari: [
      { id: 'v1', data: '2026-11-20', client_id: 'k1', cantitate_kg: 15, pret_lei_kg: 26, status_plata: 'platit', data_incasare: '2026-11-22' },
      { id: 'v2', data: '2026-11-21', client_id: null, cantitate_kg: 4, pret_lei_kg: 30, status_plata: 'neplatit', data_incasare: null },
      { id: 'v3', data: '2026-10-30', client_id: null, cantitate_kg: 4, pret_lei_kg: 30, status_plata: 'platit', data_incasare: '2026-11-02' },
      { id: 'v4', data: '2026-11-30', client_id: null, cantitate_kg: 4, pret_lei_kg: 30, status_plata: 'platit', data_incasare: '2026-12-01' },
    ],
    butasi: [{ id: 'b1', status: 'livrata', total_lei: 250, data_livrare_estimata: '2026-11-15', data_comanda: '2026-10-01' }],
    cheltuieli: [
      { id: 'c1', data: '2026-11-20', categorie: 'Tratamente', suma_lei: 412, furnizor: 'Agrofarm', document_url: 'bonuri/x.jpg' },
      { id: 'c2', data: '2026-11-02', categorie: 'Combustibil', suma_lei: 100 },
    ],
    investitii: [{ id: 'i1', data: '2026-11-15', categorie: 'Irigații', suma_lei: 3800, descriere: 'Sistem irigare' }],
    numeClient: nume,
  })

  it('încasările la ziua încasării (neîncasatele nu intră), plățile = cheltuieli + investiții', () => {
    expect(registru.randuri.map((rand) => [rand.data, rand.tip, rand.incasare, rand.plata])).toEqual([
      ['2026-11-02', 'incasare', 120, 0],
      ['2026-11-02', 'cheltuiala', 0, 100],
      ['2026-11-15', 'incasare', 250, 0],
      ['2026-11-15', 'investitie', 0, 3800],
      ['2026-11-20', 'cheltuiala', 0, 412],
      ['2026-11-22', 'incasare', 390, 0],
    ])
  })

  it('explicația, documentul și totalurile lunii (fără sold)', () => {
    expect(registru.randuri.find((rand) => rand.id === 'v-v1')?.explicatie).toBe('Selgros · 15 kg')
    expect(registru.randuri.find((rand) => rand.id === 'c-c1')).toMatchObject({ explicatie: 'Agrofarm · Tratamente', document: 'bonuri/x.jpg' })
    expect(registru.randuri.find((rand) => rand.id === 'i-i1')?.explicatie).toBe('Investiție · Sistem irigare · Irigații')
    expect(registru.totalIncasari).toBe(760)
    expect(registru.totalPlati).toBe(4312)
    expect(registru.diferenta).toBe(-3552)
    expect(registru).not.toHaveProperty('sold')
  })

  it('luna fără mișcări: gol, totaluri zero', () => {
    const gol = registruCasa({ luna: '2026-03', vanzari: [], butasi: [], cheltuieli: [], investitii: [], numeClient: nume })
    expect(gol).toEqual({ luna: '2026-03', randuri: [], totalIncasari: 0, totalPlati: 0, diferenta: 0 })
  })

  it('lunile de ales: luna curentă prima, apoi cele cu mișcări', () => {
    expect(luniCuMiscari('2026-11-28', ['2026-10-02', '2026-11-01', null, '2025-07-01'])).toEqual(['2026-11', '2026-10', '2025-07'])
  })
})
