import { describe, expect, it } from 'vitest'

import { ETICHETA_COMUNE, pretMediuIncasat, profitPeParcele, REGULA_PROFIT_PARCELA, TITLU_PROFIT_PARCELA } from '@/lib/rapoarte/profit-parcela'

const START = '2026-06-01'
const END = '2026-08-31'

const parcele = [
  { id: 'm1', nume_parcela: 'Maravilla 1', nr_plante: 100 },
  { id: 'm2', nume_parcela: 'Maravilla 2', nr_plante: 50 },
  { id: 'gr', nume_parcela: 'Grădina', rol: 'personal' },
]

const rec = (id: string, parcela: string, kg: number, munca = 0, data = '2026-07-01') => ({ id, data, parcela_id: parcela, culegator_id: null, kg_cal1: kg, kg_cal2: 0, valoare_munca_lei: munca })

describe('profitul estimat pe parcelă (promptul 35, §8)', () => {
  it('textele: „estimat” în titlu și regula scrisă', () => {
    expect(TITLU_PROFIT_PARCELA.toLowerCase()).toContain('estimat')
    expect(REGULA_PROFIT_PARCELA).toContain('Comune, neîmpărțite pe parcele')
    expect(ETICHETA_COMUNE).toBe('Comune, neîmpărțite pe parcele')
  })

  it('prețul mediu: doar vânzările încasate în perioadă, la ziua încasării', () => {
    expect(
      pretMediuIncasat(
        [
          { id: 'a', data: '2026-07-01', client_id: null, cantitate_kg: 10, pret_lei_kg: 30, status_plata: 'platit', data_incasare: '2026-07-02' },
          { id: 'b', data: '2026-07-01', client_id: null, cantitate_kg: 10, pret_lei_kg: 20, status_plata: 'platit', data_incasare: '2026-07-03' },
          { id: 'c', data: '2026-07-01', client_id: null, cantitate_kg: 100, pret_lei_kg: 1, status_plata: 'neplatit', data_incasare: null },
          { id: 'd', data: '2026-05-01', client_id: null, cantitate_kg: 100, pret_lei_kg: 1, status_plata: 'platit', data_incasare: '2026-05-02' },
        ],
        START,
        END,
      ),
    ).toBe(25)
    expect(pretMediuIncasat([], START, END)).toBeNull()
  })

  it('venitul = kg × preț mediu; directele = cules + tratamente din Magazie; restul la „Comune”', () => {
    const rezultat = profitPeParcele({
      recoltari: [rec('r1', 'm1', 100, 200), rec('r2', 'm2', 40, 80), rec('r3', 'gr', 30, 0), rec('vechi', 'm1', 999, 0, '2026-05-01')],
      parcele,
      vanzari: [{ id: 'v', data: '2026-07-05', client_id: null, cantitate_kg: 10, pret_lei_kg: 20, status_plata: 'platit', data_incasare: '2026-07-05' }],
      cheltuieli: [
        { id: 'c1', data: '2026-07-10', categorie: 'Tratamente', suma_lei: 300 },
        { id: 'c2', data: '2026-07-11', categorie: 'Combustibil', suma_lei: 500 },
        { id: 'c0', data: '2026-01-11', categorie: 'Altele', suma_lei: 9999 },
      ],
      miscariMagazie: [
        { produs_id: 'p', tip: 'intrare', cantitate: 2, data: '2026-06-01', pret_total_lei: 100 },
        { produs_id: 'fara-pret', tip: 'intrare', cantitate: 2, data: '2026-06-01', pret_total_lei: null },
      ],
      iesiri: [
        { produs_id: 'p', cantitate: -0.5, data: '2026-07-02', parcela_id: 'm1' },
        { produs_id: 'p', cantitate: -0.2, data: '2026-07-02', parcela_id: 'm2' },
        { produs_id: 'fara-pret', cantitate: -1, data: '2026-07-02', parcela_id: 'm2' },
      ],
      start: START,
      end: END,
    })
    expect(rezultat.pretMediuKg).toBe(20)
    expect(rezultat.parcele.map((rand) => rand.id)).toEqual(['m1', 'm2'])
    const [m1, m2] = rezultat.parcele
    expect(m1).toMatchObject({ kg: 100, venit: 2000, cules: 200, tratamente: 25, directe: 225, rezultat: 1775 })
    expect(m2).toMatchObject({ kg: 40, venit: 800, cules: 80, tratamente: 10, directe: 90, rezultat: 710 })
    expect(rezultat.totalCheltuieli).toBe(800)
    expect(rezultat.comune).toBe(485)
    expect(rezultat.total).toBe(1775 + 710 - 485)
  })

  it('fără vânzări încasate: venitul și rezultatul lipsesc; comunele nu scad sub zero', () => {
    const rezultat = profitPeParcele({
      recoltari: [rec('r1', 'm1', 10, 500)],
      parcele,
      vanzari: [],
      cheltuieli: [{ id: 'c', data: '2026-07-01', categorie: 'x', suma_lei: 100 }],
      miscariMagazie: [],
      iesiri: [],
      start: START,
      end: END,
    })
    expect(rezultat.parcele[0]).toMatchObject({ venit: null, rezultat: null, directe: 500 })
    expect(rezultat.comune).toBe(0)
    expect(rezultat.total).toBeNull()
  })
})
