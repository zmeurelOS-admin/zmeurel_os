import { describe, expect, it } from 'vitest'

import { tratamentePlanificateAzi } from '@/lib/notifications/zilnice/tratamente-azi'

import { aplicariDeSalvat, ceLipseste, ciornaDinTratament, pauzaCiorna, type CiornaTratament, type ProdusCiorna } from '../formular'
import { construiesteJurnal, grupeazaAplicari, planificateInZi, potrivesteFiltru, textParcele, textProduse } from '../jurnal'
import type { AplicareProdusRow, AplicareRow } from '../model'

const produsRow = (over: Partial<AplicareProdusRow> = {}): AplicareProdusRow => ({
  id: 'pr',
  ordine: 1,
  produs_id: 'sw',
  produs_nume_manual: null,
  produs_nume_snapshot: 'Switch',
  substanta_activa_snapshot: null,
  tip_snapshot: 'fungicid',
  frac_irac_snapshot: 'FRAC 9 + 12',
  phi_zile_snapshot: 7,
  doza_ml_per_hl: 100,
  doza_l_per_ha: null,
  cantitate_totala: 60,
  unitate_cantitate: 'g',
  cantitate_text: '60 g',
  ...over,
})

const aplicare = (over: Partial<AplicareRow> = {}): AplicareRow => ({
  id: 'a1',
  parcela_id: 'm1',
  status: 'aplicata',
  data_planificata: null,
  data_aplicata: '2026-07-15T08:00:00+00:00',
  metoda_aplicare: 'foliar',
  tip_interventie: 'protectie',
  sursa: 'manuala',
  observatii: null,
  created_at: '2026-07-15T08:00:00+00:00',
  produs_id: 'sw',
  produs_nume_manual: null,
  doza_ml_per_hl: null,
  doza_l_per_ha: null,
  meteo_snapshot: null,
  lot_id: null,
  produs: null,
  produse: [produsRow()],
  ...over,
})

describe('jurnalul', () => {
  it('aplicările cu același lot fac un singur rând; cantitățile se adună', () => {
    const rows = [
      aplicare({ id: 'a1', parcela_id: 'm1', lot_id: 'L' }),
      aplicare({ id: 'a2', parcela_id: 'm2', lot_id: 'L', produse: [produsRow({ cantitate_totala: 50 })] }),
      aplicare({ id: 'a3', parcela_id: 'd', lot_id: null }),
    ]
    expect(grupeazaAplicari(rows)).toHaveLength(2)
    const { facute } = construiesteJurnal({ aplicari: rows, activitati: [] })
    const lot = facute.find((rand) => rand.lotId === 'L')!
    expect(lot.parcelaIds).toEqual(['m1', 'm2'])
    expect(textProduse(lot.produse)).toBe('Switch 110 g')
    expect(lot.pauza).toEqual({ zile: 7, produs: 'Switch', panaLa: '2026-07-22' })
  })

  it('aplicările vechi fără lot apar câte una', () => {
    const rows = [aplicare({ id: 'x' }), aplicare({ id: 'y' })]
    expect(construiesteJurnal({ aplicari: rows, activitati: [] }).facute).toHaveLength(2)
  })

  it('aplicările vechi din plan, fără produse: produsul din antet', () => {
    const { facute } = construiesteJurnal({
      aplicari: [
        aplicare({
          metoda_aplicare: null,
          produse: [],
          produs: { id: 'k', nume_comercial: 'Kocide 2000', substanta_activa: null, tip: 'fungicid', frac_irac: 'FRAC M01', phi_zile: 3 },
          doza_l_per_ha: 2.5,
        }),
      ],
      activitati: [],
    })
    expect(facute[0].tip).toBe('stropire')
    expect(facute[0].produse[0].nume).toBe('Kocide 2000')
    expect(facute[0].pauza?.zile).toBe(3)
  })

  it('activitățile vechi de tratament apar „Importat”; prășitul și tăierile nu', () => {
    const { facute } = construiesteJurnal({
      aplicari: [],
      activitati: [
        { id: '1', parcela_id: 'm1', data_aplicare: '2026-06-10T08:00:00+00:00', tip_activitate: 'Fungicide/Pesticide', produs_utilizat: 'Ortiva Top', doza: '1 l/ha', timp_pauza_zile: 7 },
        { id: '2', parcela_id: 'm1', data_aplicare: '2026-06-11T08:00:00+00:00', tip_activitate: 'Fertirigare', produs_utilizat: 'Ferti', doza: null, timp_pauza_zile: 0 },
        { id: '3', parcela_id: 'm1', data_aplicare: '2026-06-12T08:00:00+00:00', tip_activitate: 'Prășit', produs_utilizat: null, doza: null, timp_pauza_zile: 0 },
        { id: '4', parcela_id: 'm1', data_aplicare: '2026-06-12T08:00:00+00:00', tip_activitate: 'Tăiere', produs_utilizat: null, doza: null, timp_pauza_zile: 0 },
        { id: '5', parcela_id: 'm1', data_aplicare: '2026-06-13T08:00:00+00:00', tip_activitate: 'Fertilizare foliară', produs_utilizat: 'Folia', doza: null, timp_pauza_zile: 0 },
      ],
    })
    expect(facute.map((rand) => rand.key)).toEqual(['activitate:5', 'activitate:2', 'activitate:1'])
    expect(facute.every((rand) => rand.importat)).toBe(true)
    expect(facute.find((rand) => rand.key === 'activitate:2')?.tip).toBe('fertirigare')
  })

  it('planificatele: separat, după dată; „De făcut azi” = cele din ziua de azi', () => {
    const rows = [
      aplicare({ id: 'p1', status: 'planificata', data_aplicata: null, data_planificata: '2026-07-19' }),
      aplicare({ id: 'p2', status: 'planificata', data_aplicata: null, data_planificata: '2026-07-17' }),
      aplicare({ id: 'x', status: 'anulata' }),
    ]
    const { facute, planificate } = construiesteJurnal({ aplicari: rows, activitati: [] })
    expect(facute).toEqual([])
    expect(planificate.map((rand) => rand.zi)).toEqual(['2026-07-17', '2026-07-19'])
    expect(planificate[0].pauza?.panaLa).toBeNull()
    expect(planificateInZi(planificate, '2026-07-17')).toHaveLength(1)
  })

  it('filtrele și textele', () => {
    const { facute } = construiesteJurnal({ aplicari: [aplicare({ metoda_aplicare: 'fertilizare_baza' })], activitati: [] })
    expect(potrivesteFiltru(facute[0], 'altele')).toBe(true)
    expect(potrivesteFiltru(facute[0], 'stropire')).toBe(false)
    const nume = new Map([['m1', 'Maravilla 1'], ['m2', 'Maravilla 2']])
    expect(textParcele(['m1', 'm2'], nume)).toBe('Maravilla 1, Maravilla 2')
    expect(textParcele(['m1', 'm2'], nume, 2)).toBe('Toate parcelele')
  })
})

const produs = (over: Partial<ProdusCiorna> = {}): ProdusCiorna => ({
  key: 'k',
  produsId: 'sw',
  nume: 'Switch',
  substanta: null,
  tip: 'fungicid',
  frac: 'FRAC 9 + 12',
  phi: 7,
  nrMaxPeSezon: 3,
  intervalMinZile: 7,
  unitate: 'g',
  doza: 100,
  gPePlanta: null,
  rezervor: 'A',
  ...over,
})

const parcele = [
  { id: 'm1', nume_parcela: 'Maravilla 1', suprafata_m2: 700, nr_plante: 500, volum_solutie_l: 60 },
  { id: 'm2', nume_parcela: 'Maravilla 2', suprafata_m2: 560, nr_plante: 400, volum_solutie_l: 50 },
  { id: 'd', nume_parcela: 'Delniwa', suprafata_m2: 1680, nr_plante: 1000, volum_solutie_l: null },
]

describe('formularul: rândurile de salvat', () => {
  it('stropire pe 2 parcele, 3 produse: o aplicare pe parcelă, cantitățile împărțite după volum', () => {
    const ciorna: CiornaTratament = {
      metoda: 'stropire',
      parcelaIds: ['m1', 'm2'],
      mod: 'hl',
      volumL: 110,
      produse: [
        produs(),
        produs({ key: 'c', produsId: null, nume: 'Calciu foliar', unitate: 'ml', doza: 250, phi: 0, frac: null }),
        produs({ key: 'j', produsId: null, nume: 'Jump Organic', unitate: 'ml', doza: 150, phi: null, frac: null }),
      ],
    }
    expect(ceLipseste(ciorna, parcele)).toBeNull()
    expect(pauzaCiorna(ciorna.produse)).toEqual({ zile: 7, produs: 'Switch' })
    const rows = aplicariDeSalvat({ ciorna, parcele, cand: { tip: 'acum' }, meteo: null, now: new Date('2026-07-17T07:00:00Z') })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ parcela_id: 'm1', status: 'aplicata', metoda_aplicare: 'foliar', produs_id: 'sw', produs_nume_manual: null })
    expect(rows[0].produse.map((p) => p.cantitate_totala)).toEqual([60, 150, 90])
    expect(rows[1].produse.map((p) => p.cantitate_totala)).toEqual([50, 125, 75])
    expect(rows[0].produse[1]).toMatchObject({ produs_id: null, produs_nume_manual: 'Calciu foliar', doza_ml_per_hl: 250, unitate_cantitate: 'ml' })
  })

  it('la ha: exact după suprafață; fără suprafață, mesaj clar', () => {
    const ciorna: CiornaTratament = { metoda: 'stropire', parcelaIds: ['m1', 'm2'], mod: 'ha', volumL: null, produse: [produs({ doza: 1 })] }
    const rows = aplicariDeSalvat({ ciorna, parcele, cand: { tip: 'acum' }, meteo: null })
    expect(rows.map((row) => row.produse[0].cantitate_totala)).toEqual([70, 56])
    expect(rows[0].produse[0]).toMatchObject({ doza_l_per_ha: 1, doza_ml_per_hl: null })
    const faraSuprafata = [{ ...parcele[0], suprafata_m2: 0 }]
    expect(ceLipseste({ ...ciorna, parcelaIds: ['m1'] }, faraSuprafata)).toContain('suprafața')
  })

  it('fertirigare pe 3 parcele, 2 g/plantă, A/B: kg pe parcelă și textul care se citește fără coloanele noi', () => {
    const ciorna: CiornaTratament = {
      metoda: 'fertirigare',
      parcelaIds: ['d', 'm1', 'm2'],
      mod: 'hl',
      volumL: null,
      produse: [
        produs({ produsId: null, nume: '15-5-30', phi: null, frac: null, gPePlanta: 2, rezervor: 'A' }),
        produs({ key: 'b', produsId: null, nume: 'Calcinit', phi: null, frac: null, gPePlanta: 2, rezervor: 'B' }),
      ],
    }
    const rows = aplicariDeSalvat({ ciorna, parcele, cand: { tip: 'acum' }, meteo: null })
    expect(rows.map((row) => row.produse[0].cantitate_totala)).toEqual([2, 1, 0.8])
    expect(rows[0].produse[1]).toMatchObject({ rezervor: 'B', doza_g_per_planta: 2, unitate_cantitate: 'kg', cantitate_text: '2 g/plantă · rezervor B' })
    expect(rows[0].metoda_aplicare).toBe('fertirigare')
  })

  it('planificat: fără data_aplicata, cu data_planificata', () => {
    const ciorna: CiornaTratament = { metoda: 'stropire', parcelaIds: ['m1'], mod: 'hl', volumL: 60, produse: [produs()] }
    const [row] = aplicariDeSalvat({ ciorna, parcele, cand: { tip: 'planifica', zi: '2026-07-19' }, meteo: { a: 1 } })
    expect(row).toMatchObject({ status: 'planificata', data_aplicata: null, data_planificata: '2026-07-19', meteo_snapshot: null })
    const [alta] = aplicariDeSalvat({ ciorna, parcele, cand: { tip: 'alta_zi', zi: '2026-07-16' }, meteo: null })
    expect(alta).toMatchObject({ status: 'aplicata', data_planificata: '2026-07-16' })
    expect(alta.data_aplicata?.slice(0, 10)).toBe('2026-07-16')
  })

  it('„Repetă”: aceleași parcele, produse și doze', () => {
    const grup = [
      aplicare({ id: 'a1', parcela_id: 'm1', lot_id: 'L' }),
      aplicare({ id: 'a2', parcela_id: 'm2', lot_id: 'L' }),
    ]
    const ciorna = ciornaDinTratament(grup, new Set(['m1', 'm2']), new Map())!
    expect(ciorna).toMatchObject({ metoda: 'stropire', parcelaIds: ['m1', 'm2'], mod: 'hl', volumL: null })
    expect(ciorna.produse[0]).toMatchObject({ produsId: 'sw', nume: 'Switch', doza: 100, unitate: 'g', phi: 7 })
    // Parcelele șterse ies.
    expect(ciornaDinTratament(grup, new Set(['m1']), new Map())!.parcelaIds).toEqual(['m1'])
  })

  it('„Repetă” fertirigarea veche: g/plantă și rezervorul din text', () => {
    const grup = [
      aplicare({
        metoda_aplicare: 'fertirigare',
        produse: [produsRow({ produs_nume_snapshot: 'Calcinit', cantitate_text: '2 g/plantă · rezervor B', unitate_cantitate: 'kg', doza_ml_per_hl: null })],
      }),
    ]
    const ciorna = ciornaDinTratament(grup, new Set(['m1']), new Map())!
    expect(ciorna.metoda).toBe('fertirigare')
    expect(ciorna.produse[0]).toMatchObject({ gPePlanta: 2, rezervor: 'B' })
  })
})

describe('notificarea de dimineață', () => {
  it('o singură notificare pe fermă, cu numărul de tratamente (loturi)', () => {
    const list = tratamentePlanificateAzi(
      [
        { id: '1', tenant_id: 'T', status: 'planificata', data_planificata: '2026-07-19', lot_id: 'L' },
        { id: '2', tenant_id: 'T', status: 'planificata', data_planificata: '2026-07-19', lot_id: 'L' },
        { id: '3', tenant_id: 'T', status: 'planificata', data_planificata: '2026-07-19', lot_id: null },
        { id: '4', tenant_id: 'T', status: 'aplicata', data_planificata: '2026-07-19', lot_id: null },
        { id: '5', tenant_id: 'T', status: 'planificata', data_planificata: '2026-07-20', lot_id: null },
        { id: '6', tenant_id: 'U', status: 'planificata', data_planificata: '2026-07-19' },
      ],
      '2026-07-19',
    )
    expect(list).toHaveLength(2)
    const t = list.find((item) => item.tenantId === 'T')!
    expect(t.title).toBe('2 tratamente planificate azi')
    expect(t.reminderKey).toBe('tratament:T:2026-07-19')
    expect(t.type).toBe('tratament_planificat')
    expect(list.find((item) => item.tenantId === 'U')!.title).toBe('1 tratament planificat azi')
  })
})
