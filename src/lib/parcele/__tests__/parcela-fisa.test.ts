import { describe, expect, it } from 'vitest'

import { jurnalParcela } from '@/lib/parcele/jurnal-parcela'
import { semnalParcela, textPlanificat } from '@/lib/parcele/semnal'
import { kgPeParcela, sezonParcela } from '@/lib/parcele/sezon-parcela'
import { stadiuCurentParcela } from '@/lib/parcele/stadiu-curent'
import type { AplicareRow } from '@/lib/tratamente/model'
import type { ParcelaStadiuCanonic } from '@/lib/supabase/queries/parcela-stadii'

const AZI = '2026-07-17'

describe('semnalul pe parcelă: pauza > planificat > stadiu', () => {
  const pauza = { parcelaId: 'p1', panaLa: '2026-07-18', zileRamase: 1, ziAplicare: '2026-07-15', zilePauza: 3, produs: 'Scala', produse: ['Scala'] }

  it('pauza bate planificatul și stadiul', () => {
    expect(semnalParcela({ pauza, planificate: [{ zi: AZI, tip: 'tratament' }], stadiu: 'Înflorire', azi: AZI })).toEqual({
      tip: 'pauza',
      text: 'Pauză până sâmbătă 18.07',
      ton: 'warning',
    })
  })

  it('planificatul bate stadiul; cel mai apropiat întâi', () => {
    const semnal = semnalParcela({
      pauza: null,
      planificate: [
        { zi: '2026-07-19', tip: 'tratament' },
        { zi: '2026-07-18', tip: 'lucrare', eticheta: 'Palisare' },
      ],
      stadiu: 'Înflorire',
      azi: AZI,
    })
    expect(semnal).toEqual({ tip: 'planificat', text: 'Palisare planificată mâine', ton: 'info' })
  })

  it('planificatul întârziat e avertisment', () => {
    expect(textPlanificat({ zi: '2026-07-15', tip: 'tratament' }, AZI)).toBe('Tratament planificat, întârziat')
    expect(semnalParcela({ pauza: null, planificate: [{ zi: '2026-07-15', tip: 'lucrare', eticheta: 'Legat' }], stadiu: null, azi: AZI })?.ton).toBe('warning')
    expect(textPlanificat({ zi: '2026-07-19', tip: 'tratament' }, AZI)).toBe('Tratament planificat duminică 19.07')
  })

  it('doar stadiul, sau nimic', () => {
    expect(semnalParcela({ pauza: null, planificate: [], stadiu: 'Primocane: înflorire', azi: AZI })).toEqual({ tip: 'stadiu', text: 'Primocane: înflorire', ton: 'success' })
    expect(semnalParcela({ pauza: null, planificate: [], stadiu: null, azi: AZI })).toBeNull()
  })
})

const aplicare = (overrides: Partial<AplicareRow>): AplicareRow => ({
  id: 'a1',
  parcela_id: 'p1',
  status: 'aplicata',
  data_planificata: null,
  data_aplicata: '2026-07-15T08:00:00Z',
  metoda_aplicare: 'foliar',
  tip_interventie: null,
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
      id: 'pp1',
      ordine: 1,
      produs_id: null,
      produs_nume_manual: null,
      produs_nume_snapshot: 'Scala',
      substanta_activa_snapshot: null,
      tip_snapshot: 'fungicid',
      frac_irac_snapshot: null,
      phi_zile_snapshot: 3,
      doza_ml_per_hl: null,
      doza_l_per_ha: null,
      cantitate_totala: null,
      unitate_cantitate: null,
      cantitate_text: null,
    },
  ],
  ...overrides,
})

describe('sezonul pe parcelă', () => {
  const recoltari = [
    { parcela_id: 'p1', data: '2026-06-20', kg_cal1: 40, kg_cal2: 2 },
    { parcela_id: 'p1', data: '2026-07-17', kg_cal1: 10, kg_cal2: null },
    { parcela_id: 'p1', data: '2025-07-01', kg_cal1: 999, kg_cal2: 0 },
    { parcela_id: 'p2', data: '2026-07-01', kg_cal1: 5, kg_cal2: 0 },
  ]

  it('kg din sezon, pe parcelă', () => {
    const map = kgPeParcela(recoltari, '2026-06-20', AZI)
    expect(map.get('p1')).toBe(52)
    expect(map.get('p2')).toBe(5)
  })

  it('kg/plantă, tratamente din anul curent (noi + vechi), ultima fertirigare', () => {
    const sezon = sezonParcela({
      parcela: { id: 'p1', nr_plante: 26 },
      recoltari,
      aplicari: [
        aplicare({ id: 'a1' }),
        aplicare({ id: 'a2', metoda_aplicare: 'fertirigare', data_aplicata: '2026-07-16T08:00:00Z' }),
        aplicare({ id: 'a3', status: 'planificata', data_aplicata: null, data_planificata: '2026-07-20' }),
        aplicare({ id: 'a4', parcela_id: 'p2' }),
      ],
      activitati: [
        { id: 'v1', parcela_id: 'p1', data_aplicare: '2026-04-01T08:00:00Z', tip_activitate: 'Fertirigare', produs_utilizat: null, doza: null, timp_pauza_zile: 0 },
        { id: 'v2', parcela_id: 'p1', data_aplicare: '2026-04-02T08:00:00Z', tip_activitate: 'Tăiere', produs_utilizat: null, doza: null, timp_pauza_zile: 0 },
        { id: 'v3', parcela_id: 'p1', data_aplicare: '2025-04-02T08:00:00Z', tip_activitate: 'Stropire', produs_utilizat: null, doza: null, timp_pauza_zile: 0 },
      ],
      start: '2026-06-20',
      azi: AZI,
    })
    expect(sezon).toEqual({ kg: 52, kgPePlanta: 2, tratamente: 3, ultimaFertirigare: '2026-07-16' })
  })

  it('fără plante: kg/plantă lipsește', () => {
    expect(sezonParcela({ parcela: { id: 'p9', nr_plante: null }, recoltari, aplicari: [], activitati: [], start: '2026-01-01', azi: AZI }).kgPePlanta).toBeNull()
  })
})

const stadiu = (overrides: Partial<ParcelaStadiuCanonic> & Pick<ParcelaStadiuCanonic, 'id' | 'stadiu'>): ParcelaStadiuCanonic => ({
  tenant_id: 't',
  parcela_id: 'p1',
  an: 2026,
  cohort: null,
  data_observata: '2026-07-13',
  sursa: 'manual',
  observatii: null,
  created_at: '2026-07-13T08:00:00Z',
  updated_at: '2026-07-13T08:00:00Z',
  created_by: null,
  ...overrides,
})

describe('stadiul curent', () => {
  it('mono-cohort: ultimul stadiu', () => {
    const result = stadiuCurentParcela({
      stadii: [stadiu({ id: '1', stadiu: 'inflorit', created_at: '2026-07-10T00:00:00Z' }), stadiu({ id: '2', stadiu: 'fruct_verde', created_at: '2026-07-13T00:00:00Z' })],
      grup: null,
      config: null,
    })
    expect(result.mixt).toBe(false)
    expect(result.text).toBeTruthy()
    expect(result.ziua).toBe('2026-07-13')
  })

  it('zmeură remontantă: câte un stadiu pe cohortă', () => {
    const result = stadiuCurentParcela({
      stadii: [stadiu({ id: '1', stadiu: 'inflorit', cohort: 'primocane' }), stadiu({ id: '2', stadiu: 'maturitate', cohort: 'floricane', data_observata: '2026-07-14' })],
      grup: 'rubus',
      config: { sistem_conducere: 'mixt_floricane_primocane' },
    })
    expect(result.mixt).toBe(true)
    expect(result.text).toMatch(/^Floricane: .+ · Primocane: .+$/)
    expect(result.ziua).toBe('2026-07-14')
  })

  it('fără stadii', () => {
    expect(stadiuCurentParcela({ stadii: [], grup: 'rubus', config: null })).toEqual({ text: null, ziua: null, mixt: false })
  })
})

describe('jurnalul parcelei, pe zile', () => {
  it('recoltări adunate pe zi, tratamente noi și vechi, lucrări, stadii; planificatele nu intră', () => {
    const zile = jurnalParcela({
      parcelaId: 'p1',
      recoltari: [
        { id: 'r1', parcela_id: 'p1', data: AZI, kg_cal1: 30, kg_cal2: 0, culegator_id: 'c1', created_at: '2026-07-17T10:00:00Z' },
        { id: 'r2', parcela_id: 'p1', data: AZI, kg_cal1: 10, kg_cal2: 2, culegator_id: 'c2', created_at: '2026-07-17T11:00:00Z' },
        { id: 'r3', parcela_id: 'p2', data: AZI, kg_cal1: 99, kg_cal2: 0, culegator_id: 'c3', created_at: '2026-07-17T11:00:00Z' },
      ],
      aplicari: [aplicare({ id: 'a1' }), aplicare({ id: 'a2', status: 'planificata', data_aplicata: null, data_planificata: '2026-07-20' })],
      activitati: [
        { id: 'v1', parcela_id: 'p1', data_aplicare: '2026-07-15T09:00:00Z', tip_activitate: 'copilit', produs_utilizat: null, doza: null, timp_pauza_zile: 0, operator: 'Proprietarul', observatii: null, created_at: '2026-07-15T09:00:00Z' },
        { id: 'v2', parcela_id: 'p1', data_aplicare: '2026-07-10T09:00:00Z', tip_activitate: 'Stropire', produs_utilizat: 'Switch', doza: null, timp_pauza_zile: 7, operator: null, observatii: null, created_at: '2026-07-10T09:00:00Z' },
        { id: 'v3', parcela_id: 'p1', data_aplicare: '2026-07-21T12:00:00Z', tip_activitate: 'Legat', produs_utilizat: null, doza: null, timp_pauza_zile: 0, operator: null, observatii: null, created_at: '2026-07-16T09:00:00Z', status: 'planificata' },
      ],
      stadii: [{ id: 's1', parcela_id: 'p1', stadiu: 'inflorit', cohort: null, data_observata: '2026-07-15', observatii: null, created_at: '2026-07-15T07:00:00Z' }],
      numeStadiu: () => 'Înflorire',
      textCine: (cine) => (cine === 'Proprietarul' ? 'Tu' : cine),
    })

    expect(zile.map((zi) => zi.zi)).toEqual(['2026-07-17', '2026-07-15', '2026-07-10'])
    expect(zile[0].intrari).toEqual([expect.objectContaining({ tip: 'recoltare', titlu: 'Recoltare 42 kg', detaliu: '2 culegători' })])
    expect(zile[1].intrari.map((intrare) => intrare.titlu)).toEqual(['Lucrare: copilit', 'Stropire: Scala', 'Stadiu: Înflorire'])
    expect(zile[1].intrari[0].detaliu).toBe('Tu')
    expect(zile[1].intrari[1].detaliu).toBe('pauză 3 zile')
    expect(zile[2].intrari[0]).toEqual(expect.objectContaining({ titlu: 'Stropire: Switch', detaliu: 'importat · pauză 7 zile' }))
  })
})
