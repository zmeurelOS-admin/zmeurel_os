import { describe, expect, it } from 'vitest'

import { documentHtml, documentRegistru, escapeHtml, numeFisier } from '@/lib/rapoarte/export'
import { luniRaport, peClienti, peCulegatori, peParcele, perioadaRaport, sumarRaport, type DateRaport } from '@/lib/rapoarte/raport'
import { registruTratamente } from '@/lib/rapoarte/registru-tratamente'
import type { AplicareRow } from '@/lib/tratamente/model'

const date: DateRaport = {
  recoltari: [
    { id: 'r1', data: '2026-06-10', parcela_id: 'p1', culegator_id: 'c1', kg_cal1: 40, kg_cal2: 10, valoare_munca_lei: 100 },
    { id: 'r2', data: '2026-07-02', parcela_id: 'p2', culegator_id: 'c1', kg_cal1: 20, kg_cal2: 0, valoare_munca_lei: 40 },
    { id: 'r3', data: '2026-07-03', parcela_id: 'pp', culegator_id: null, kg_cal1: 5, kg_cal2: 0 },
    { id: 'r4', data: '2025-07-03', parcela_id: 'p1', culegator_id: 'c1', kg_cal1: 999, kg_cal2: 0 },
  ],
  vanzari: [
    { id: 'v1', data: '2026-07-01', client_id: 'k1', cantitate_kg: 10, pret_lei_kg: 30, status_plata: 'platit', data_incasare: '2026-07-05' },
    { id: 'v2', data: '2026-07-01', client_id: 'k2', cantitate_kg: 10, pret_lei_kg: 30, status_plata: 'neplatit' },
    { id: 'v3', data: '2026-11-10', client_id: 'k1', cantitate_kg: 2, pret_lei_kg: 25, status_plata: 'platit', data_incasare: null },
  ],
  cheltuieli: [
    { id: 'c1', data: '2026-07-10', categorie: 'Ambalaje', suma_lei: 50 },
    { id: 'c2', data: '2026-11-02', categorie: 'Combustibil', suma_lei: 20 },
  ],
  butasi: [{ status: 'livrata', total_lei: 100, data_livrare_estimata: '2026-11-05', data_comanda: '2026-10-01' }],
  investitii: [{ id: 'i1', data: '2026-08-01', categorie: 'Irigații', suma_lei: 1000 }],
  parcele: [
    { id: 'p1', nume_parcela: 'Maravilla 1', nr_plante: 50, rol: 'comercial' },
    { id: 'p2', nume_parcela: 'Delniwa', nr_plante: null, rol: null },
    { id: 'pp', nume_parcela: 'Grădina', nr_plante: 10, rol: 'personal' },
  ],
  culegatori: [{ id: 'c1', nume_prenume: 'Ana Pavel' }],
  clienti: [
    { id: 'k1', nume_client: 'Ion' },
    { id: 'k2', nume_client: 'Maria' },
  ],
}

describe('perioada', () => {
  it('luna, sezonul (prima recoltare din an), anul', () => {
    expect(perioadaRaport('luna', '2026-11-21', date.recoltari)).toMatchObject({ start: '2026-11-01', end: '2026-11-21', eticheta: 'în noiembrie 2026' })
    expect(perioadaRaport('sezon', '2026-11-21', date.recoltari)).toMatchObject({ start: '2026-06-10', eticheta: 'în sezonul 2026' })
    expect(perioadaRaport('an', '2026-11-21', date.recoltari)).toMatchObject({ start: '2026-01-01', eticheta: 'în 2026' })
  })
})

describe('sumarul', () => {
  it('profit = încasat − cheltuieli; investițiile separat; parcelele personale scoase din kg', () => {
    const sumar = sumarRaport(date, { start: '2026-01-01', end: '2026-11-21' })
    expect(sumar.incasat).toBe(300 + 50 + 100)
    expect(sumar.cheltuieli).toBe(70)
    expect(sumar.profit).toBe(380)
    expect(sumar.recoltatKg).toBe(70)
    expect(sumar.investitii.totalLei).toBe(1000)
  })

  it('luna doar cu ce e în ea', () => {
    const sumar = sumarRaport(date, { start: '2026-11-01', end: '2026-11-21' })
    expect(sumar).toMatchObject({ incasat: 150, cheltuieli: 20, profit: 130, recoltatKg: 0 })
  })

  it('lunile, inclusiv cele goale', () => {
    const luni = luniRaport(date, { start: '2026-06-10', end: '2026-11-21' })
    expect(luni.map((luna) => luna.eticheta)).toEqual(['iun', 'iul', 'aug', 'sep', 'oct', 'nov'])
    expect(luni[1]).toMatchObject({ incasat: 300, cheltuieli: 50 })
    expect(luni[2]).toMatchObject({ incasat: 0, cheltuieli: 0 })
    expect(luni[5]).toMatchObject({ incasat: 150, cheltuieli: 20 })
  })
})

describe('listele', () => {
  const perioada = { start: '2026-01-01', end: '2026-11-21' }
  it('pe parcele, cu kg/plantă și personalele la sfârșit', () => {
    expect(peParcele(date, perioada)).toEqual([
      { id: 'p1', nume: 'Maravilla 1', kg: 50, nrPlante: 50, kgPePlanta: 1, personal: false },
      { id: 'p2', nume: 'Delniwa', kg: 20, nrPlante: null, kgPePlanta: null, personal: false },
      { id: 'pp', nume: 'Grădina', kg: 5, nrPlante: 10, kgPePlanta: 0.5, personal: true },
    ])
  })
  it('pe culegători, kg și plată', () => {
    expect(peCulegatori(date, perioada)).toEqual([
      { id: 'c1', nume: 'Ana Pavel', kg: 70, plata: 140 },
      { id: 'fara', nume: 'Fără culegător', kg: 5, plata: 0 },
    ])
  })
  it('pe clienți, doar încasat', () => {
    expect(peClienti(date, perioada)).toEqual([{ id: 'k1', nume: 'Ion', incasat: 350 }])
  })
})

const aplicare = (over: Partial<AplicareRow>): AplicareRow => ({
  id: 'a1',
  parcela_id: 'p1',
  status: 'aplicata',
  data_planificata: null,
  data_aplicata: '2026-07-15T08:00:00Z',
  metoda_aplicare: 'foliar',
  tip_interventie: 'protectie',
  sursa: 'manual',
  observatii: null,
  created_at: '2026-07-15T08:00:00Z',
  produs_id: null,
  produs_nume_manual: null,
  doza_ml_per_hl: null,
  doza_l_per_ha: null,
  meteo_snapshot: null,
  produs: null,
  produse: [
    {
      id: 'x',
      ordine: 1,
      produs_id: 'cat',
      produs_nume_manual: null,
      produs_nume_snapshot: 'Switch',
      substanta_activa_snapshot: 'ciprodinil + fludioxonil',
      tip_snapshot: 'fungicid',
      frac_irac_snapshot: null,
      phi_zile_snapshot: 3,
      doza_ml_per_hl: 100,
      doza_l_per_ha: null,
      cantitate_totala: 110,
      unitate_cantitate: 'g',
      cantitate_text: null,
    },
  ],
  ...over,
})

describe('registrul de tratamente', () => {
  const numeParcele = new Map([['p1', 'Maravilla 1']])
  it('ambele surse, în perioadă, cu pauza și ziua de recoltare', () => {
    const randuri = registruTratamente({
      aplicari: [aplicare({}), aplicare({ id: 'a2', status: 'planificata' }), aplicare({ id: 'a3', data_aplicata: '2025-07-01T08:00:00Z' })],
      activitati: [
        { id: 'v1', parcela_id: 'p1', data_aplicare: '2026-06-01', tip_activitate: 'Fungicide/Pesticide', produs_utilizat: 'Topas', doza: '4 ml/16 l', timp_pauza_zile: 14 },
        { id: 'v2', parcela_id: 'p1', data_aplicare: '2026-06-02', tip_activitate: 'Prășit', produs_utilizat: null, doza: null, timp_pauza_zile: 0 },
      ],
      numeParcele,
      start: '2026-01-01',
      end: '2026-11-21',
    })
    expect(randuri).toHaveLength(2)
    expect(randuri[0]).toMatchObject({ data: '2026-06-01', produs: 'Topas', doza: '4 ml/16 l', pauzaZile: 14, recoltarePermisa: '2026-06-15', importat: true, metoda: 'Stropire' })
    expect(randuri[1]).toMatchObject({
      data: '2026-07-15',
      parcela: 'Maravilla 1',
      metoda: 'Stropire',
      produs: 'Switch',
      substanta: 'ciprodinil + fludioxonil',
      doza: '100 ml/hl',
      pauzaZile: 3,
      recoltarePermisa: '2026-07-18',
      importat: false,
    })
    expect(randuri[1].cantitate).toMatch(/110/)

    const doc = documentHtml(documentRegistru(randuri, '2026-01-01', '2026-11-21'), true)
    expect(doc).toContain('Registrul de tratamente')
    expect(doc).toContain('18.07.2026')
    expect(doc).toContain('Stropire (din Activități)')
    expect(doc).not.toMatch(/#[0-9a-f]{3}/i)
  })
})

describe('registrul: substanța din catalog', () => {
  it('când aplicarea nu are snapshot, ia substanța după produs_id', () => {
    const fara = aplicare({})
    fara.produse = [{ ...fara.produse[0], substanta_activa_snapshot: null }]
    const [rand] = registruTratamente({
      aplicari: [fara],
      activitati: [],
      numeParcele: new Map(),
      substantePeProdus: new Map([['cat', 'ciprodinil']]),
      start: '2026-01-01',
      end: '2026-12-31',
    })
    expect(rand.substanta).toBe('ciprodinil')
  })
})

describe('exportul', () => {
  it('scapă textul și numește fișierul', () => {
    expect(escapeHtml('<b>"Ion" & co</b>')).toBe('&lt;b&gt;&quot;Ion&quot; &amp; co&lt;/b&gt;')
    expect(numeFisier('Raport în sezonul 2026', '2026-11-21', 'xls')).toBe('raport-in-sezonul-2026-2026-11-21.xls')
  })
})
