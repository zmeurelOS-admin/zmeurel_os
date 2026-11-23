import { describe, expect, it } from 'vitest'

import {
  anunturiNoi,
  calculeazaPlan,
  ciornaDinLinie,
  destinatariPlan,
  grupeazaAnTrecut,
  grupeazaDeFacut,
  idDerivat,
  intervalTipic,
  intrebariParcela,
  linieDinRand,
  notificarePlan,
  randuriAnuntate,
  randuriPlanNou,
  stadiiCurente,
  stadiiCurentePeParcele,
  stadiiUrmatoare,
  stareLinieAn,
  textGrup,
  textStareAn,
  verificaInterval,
  verificaMaxim,
  verificaPauza,
  verificaStoc,
  verificariInterventie,
  type AplicarePlan,
  type ContextPlan,
  type LiniePlan,
  type ParcelaPlan,
  type PlanTratament,
  type ProdusLinie,
  type StadiuRand,
} from '@/lib/plan'
import { aplicariDeSalvat } from '@/lib/tratamente/formular'
import type { ProdusCatalog } from '@/lib/tratamente/model'

const produs = (over: Partial<ProdusLinie> = {}): ProdusLinie => ({
  id: 'lp1',
  ordine: 1,
  produs_id: 'borofol',
  nume: 'Borofol',
  tip: 'foliar',
  phi: 0,
  doza_ml_per_hl: null,
  doza_l_per_ha: 1.5,
  cantitate_text: null,
  ...over,
})

const linie = (over: Partial<LiniePlan> = {}): LiniePlan => ({
  id: 'l-inflorit',
  plan_id: 'plan',
  ordine: 1,
  stadiu: 'inflorit',
  stadiu_brut: 'inflorit',
  cohort: null,
  scop: 'bor la înflorire',
  tip_interventie: 'nutritie',
  metoda: 'foliar',
  repetare: null,
  observatii: null,
  produse: [produs()],
  ...over,
})

const plan = (linii: LiniePlan[]): PlanTratament => ({ id: 'plan', nume: 'Zmeură 2027', cultura_tip: 'zmeur', descriere: null, activ: true, arhivat: false, linii })

const stadiu = (parcela_id: string, s: string, zi: string, cohort: string | null = null): StadiuRand => ({
  parcela_id,
  stadiu: s,
  cohort,
  data_observata: zi,
  created_at: `${zi}T08:00:00Z`,
  updated_at: `${zi}T08:00:00Z`,
})

const asocieri: ParcelaPlan[] = [
  { plan_id: 'plan', parcela_id: 'p1', an: 2027, activ: true },
  { plan_id: 'plan', parcela_id: 'p2', an: 2027, activ: true },
]

function ctx(over: Partial<ContextPlan> & { stadiiRanduri?: StadiuRand[] } = {}): ContextPlan {
  const { stadiiRanduri = [stadiu('p1', 'inflorit', '2027-05-20'), stadiu('p2', 'buton_verde', '2027-05-10')], ...rest } = over
  return { azi: '2027-05-25', an: 2027, stadii: stadiiCurentePeParcele(stadiiRanduri), aplicari: [], sarite: [], exceptii: [], ...rest }
}

const aplicare = (over: Partial<AplicarePlan>): AplicarePlan => ({ id: 'a', parcela_id: 'p1', plan_linie_id: 'l-inflorit', status: 'aplicata', zi: '2027-05-21', ...over })

describe('stadiul de acum', () => {
  it('ia ultima înregistrare, pe cohorte la zmeura remontantă', () => {
    expect(stadiiCurente([stadiu('p', 'buton_verde', '2027-05-01'), stadiu('p', 'inflorit', '2027-05-20')])).toEqual([
      { cohort: null, stadiu: 'inflorit', din: '2027-05-20' },
    ])
    const mixt = stadiiCurente([stadiu('p', 'maturitate', '2027-07-01', 'floricane'), stadiu('p', 'inflorit', '2027-07-05', 'primocane')])
    expect(mixt.map((s) => `${s.cohort}:${s.stadiu}`)).toEqual(['floricane:maturitate', 'primocane:inflorit'])
  })

  it('ignoră stadiile necunoscute', () => {
    expect(stadiiCurente([stadiu('p', 'ceva', '2027-05-01')])).toEqual([])
  })
})

describe('ce urmează', () => {
  const linii = [
    linie(),
    linie({ id: 'l-fruct', stadiu: 'fruct_verde', ordine: 2, scop: 'fertirigare', produse: [produs({ id: null, produs_id: 'ferti', nume: 'Ferti' })] }),
    linie({ id: 'l-muguri', stadiu: 'umflare_muguri', ordine: 0, scop: 'preventiv' }),
  ]

  it('linia stadiului de acum e „acum”; cea de după, „urmează”; cea de dinainte, „nefăcut”', () => {
    const calcul = calculeazaPlan(plan(linii), asocieri, ctx())
    expect(calcul.stari.get('l-inflorit:p1')?.stare).toBe('acum')
    expect(calcul.stari.get('l-fruct:p1')?.stare).toBe('urmeaza')
    expect(calcul.stari.get('l-muguri:p1')?.stare).toBe('nefacut')
    expect(calcul.stari.get('l-inflorit:p2')?.stare).toBe('urmeaza')
    expect(calcul.deFacut.map((d) => `${d.linie.id}:${d.parcelaId}`)).toEqual(['l-inflorit:p1'])
  })

  it('făcut în sezon → „făcut”; o aplicare de anul trecut nu contează', () => {
    expect(calculeazaPlan(plan(linii), asocieri, ctx({ aplicari: [aplicare({})] })).stari.get('l-inflorit:p1')?.stare).toBe('facut')
    expect(calculeazaPlan(plan(linii), asocieri, ctx({ aplicari: [aplicare({ zi: '2026-05-21' })] })).stari.get('l-inflorit:p1')?.stare).toBe('acum')
  })

  it('planificat din plan → „planificat”, nu apare la „E timpul pentru”', () => {
    const calcul = calculeazaPlan(plan(linii), asocieri, ctx({ aplicari: [aplicare({ status: 'planificata', zi: '2027-05-26' })] }))
    expect(calcul.stari.get('l-inflorit:p1')?.stare).toBe('planificat')
    expect(calcul.deFacut).toHaveLength(0)
  })

  it('sărit pe parcelă și an → „sărit”, cu motivul; alt an nu contează', () => {
    const sarit = calculeazaPlan(plan(linii), asocieri, ctx({ sarite: [{ plan_linie_id: 'l-inflorit', parcela_id: 'p1', an: 2027, motiv: 'ploaie' }] }))
    expect(sarit.stari.get('l-inflorit:p1')).toMatchObject({ stare: 'sarit', motiv: 'ploaie' })
    expect(sarit.deFacut).toHaveLength(0)
    const altAn = calculeazaPlan(plan(linii), asocieri, ctx({ sarite: [{ plan_linie_id: 'l-inflorit', parcela_id: 'p1', an: 2026, motiv: null }] }))
    expect(altAn.stari.get('l-inflorit:p1')?.stare).toBe('acum')
  })

  it('excepția pe parcelă scoate linia doar de pe parcela aceea', () => {
    const calcul = calculeazaPlan(plan(linii), asocieri, ctx({ exceptii: [{ plan_linie_id: 'l-inflorit', parcela_id: 'p1' }] }))
    expect(calcul.stari.get('l-inflorit:p1')?.stare).toBe('exceptie')
    expect(calcul.stari.get('l-inflorit:p2')?.stare).toBe('urmeaza')
    expect(calcul.deFacut).toHaveLength(0)
  })

  it('repetă la N zile, de M ori, cât timp parcela e în stadiu', () => {
    const rep = [linie({ repetare: { zile: 7, ori: 3 } })]
    const o = [aplicare({ zi: '2027-05-18' })]
    // A doua aplicare: peste 7 zile de la prima (25 mai = azi).
    expect(calculeazaPlan(plan(rep), asocieri, ctx({ aplicari: o })).stari.get('l-inflorit:p1')).toMatchObject({ stare: 'acum', repetare: 2 })
    // Încă nu a trecut intervalul.
    expect(calculeazaPlan(plan(rep), asocieri, ctx({ azi: '2027-05-22', aplicari: o })).stari.get('l-inflorit:p1')).toMatchObject({ stare: 'facut', urmatoarea: '2027-05-25' })
    // Maximul atins: gata.
    const trei = [aplicare({ id: '1', zi: '2027-05-04' }), aplicare({ id: '2', zi: '2027-05-11' }), aplicare({ id: '3', zi: '2027-05-18' })]
    expect(calculeazaPlan(plan(rep), asocieri, ctx({ aplicari: trei })).stari.get('l-inflorit:p1')).toMatchObject({ stare: 'facut', urmatoarea: null })
    // Parcela a trecut în stadiul următor: nu se mai repetă.
    const dupa = ctx({ aplicari: o, stadiiRanduri: [stadiu('p1', 'inflorit', '2027-05-10'), { ...stadiu('p1', 'fruct_verde', '2027-05-24'), created_at: '2027-05-24T09:00:00Z' }] })
    expect(calculeazaPlan(plan(rep), asocieri, dupa).stari.get('l-inflorit:p1')?.stare).toBe('facut')
  })

  it('linia cu cohortă se uită doar la cohorta ei', () => {
    const l = [linie({ cohort: 'primocane' })]
    const c = ctx({ stadiiRanduri: [stadiu('p1', 'inflorit', '2027-07-01', 'floricane'), stadiu('p1', 'buton_verde', '2027-07-01', 'primocane')] })
    expect(calculeazaPlan(plan(l), asocieri, c).stari.get('l-inflorit:p1')?.stare).toBe('urmeaza')
    expect(calculeazaPlan(plan([linie()]), asocieri, c).stari.get('l-inflorit:p1')?.stare).toBe('acum')
  })

  it('fără stadiu notat: „fără stadiu”, nu „acum”', () => {
    const calcul = calculeazaPlan(plan(linii), [{ plan_id: 'plan', parcela_id: 'p3', an: 2027, activ: true }], ctx())
    expect(calcul.stari.get('l-inflorit:p3')?.stare).toBe('fara_stadiu')
  })

  it('doar parcelele planului în anul curent, active', () => {
    const calcul = calculeazaPlan(plan(linii), [...asocieri, { plan_id: 'plan', parcela_id: 'p9', an: 2026, activ: true }, { plan_id: 'plan', parcela_id: 'p8', an: 2027, activ: false }], ctx())
    expect(calcul.parcelaIds).toEqual(['p1', 'p2'])
  })

  it('grupează pe stadii și arată ce urmează, cu parcelele care n-au ajuns', () => {
    const p = plan(linii)
    const c = ctx()
    const calcul = calculeazaPlan(p, asocieri, c)
    const grupuri = grupeazaDeFacut(p, calcul.deFacut)
    expect(grupuri).toHaveLength(1)
    expect(grupuri[0]).toMatchObject({ stadiu: 'inflorit', parcelaIds: ['p1'] })
    const urm = stadiiUrmatoare(p, calcul, c.stadii)
    expect(urm.map((u) => u.stadiu)).toEqual(['inflorit', 'fruct_verde'])
    expect(urm[0].parcele).toEqual([{ parcelaId: 'p2', stadiu: 'buton_verde' }])
  })

  it('starea pe an: acum > urmează > făcut > sărit', () => {
    const p = plan(linii)
    expect(stareLinieAn(linii[0], calculeazaPlan(p, asocieri, ctx())).stare).toBe('acum')
    const facut = calculeazaPlan(p, asocieri, ctx({ aplicari: [aplicare({}), aplicare({ id: 'b', parcela_id: 'p2' })] }))
    expect(stareLinieAn(linii[0], facut)).toMatchObject({ stare: 'facut', facute: 2, total: 2 })
    // Făcut pe o parcelă, cealaltă încă n-a ajuns: „făcut 1 din 2”.
    const partial = calculeazaPlan(p, asocieri, ctx({ aplicari: [aplicare({})] }))
    expect(stareLinieAn(linii[0], partial)).toMatchObject({ stare: 'facut', facute: 1, total: 2 })
    expect(textStareAn(stareLinieAn(linii[0], partial))).toBe('făcut 1 din 2')
    const sarit = calculeazaPlan(p, asocieri, ctx({ sarite: ['p1', 'p2'].map((parcela_id) => ({ plan_linie_id: 'l-inflorit', parcela_id, an: 2027, motiv: null })) }))
    expect(stareLinieAn(linii[0], sarit).stare).toBe('sarit')
  })
})

describe('liniile vechi din bază', () => {
  it('citesc produsul de pe linie când n-au rânduri de produse', () => {
    const l = linieDinRand({
      id: 'x',
      plan_id: 'plan',
      ordine: 2,
      stadiu_trigger: 'inflorit',
      regula_repetare: 'fara_repetare',
      produs_id: 'c1',
      produs_nume_manual: null,
      doza_ml_per_hl: 100,
      doza_l_per_ha: null,
      produs: { nume_comercial: 'Switch', tip: 'fungicid', phi_zile: 7 },
      produse: [],
    })
    expect(l.produse).toEqual([{ id: null, ordine: 1, produs_id: 'c1', nume: 'Switch', tip: 'fungicid', phi: 7, doza_ml_per_hl: 100, doza_l_per_ha: null, cantitate_text: null }])
    expect(l.repetare).toBeNull()
  })

  it('cu rânduri de produse și repetare', () => {
    const l = linieDinRand({
      id: 'x',
      plan_id: 'plan',
      ordine: 1,
      stadiu_trigger: 'fruct_verde',
      regula_repetare: 'interval',
      interval_repetare_zile: 10,
      numar_repetari_max: 3,
      metoda_aplicare: 'fertirigare',
      produse: [
        { id: 'b', ordine: 2, produs_nume_snapshot: 'Calcinit', cantitate_text: '2 g/plantă · rezervor B' },
        { id: 'a', ordine: 1, produs_nume_snapshot: 'Ferti', cantitate_text: '2 g/plantă · rezervor A' },
      ],
    })
    expect(l.produse.map((p) => p.nume)).toEqual(['Ferti', 'Calcinit'])
    expect(l.repetare).toEqual({ zile: 10, ori: 3 })
    expect(l.metoda).toBe('fertirigare')
  })
})

describe('din anul trecut', () => {
  const stadii = [stadiu('p1', 'inflorit', '2026-06-01'), stadiu('p1', 'fruct_verde', '2026-06-15'), stadiu('p2', 'inflorit', '2026-06-02')]
  const pa = (produs_id: string | null, nume: string) => ({ produs_id, nume, tip: null, phi: null, doza_ml_per_hl: null, doza_l_per_ha: null, cantitate_text: null })

  it('grupează pe stadiul din ziua aplicării; același tratament pe mai multe parcele = o dată', () => {
    const grupuri = grupeazaAnTrecut(
      [
        { id: '1', parcela_id: 'p1', zi: '2026-06-05', metoda: 'foliar', produse: [pa('b', 'Borofol'), pa('a', 'Atonik')] },
        { id: '2', parcela_id: 'p2', zi: '2026-06-05', metoda: 'foliar', produse: [pa('a', 'Atonik'), pa('b', 'Borofol')] },
        { id: '3', parcela_id: 'p1', zi: '2026-06-16', metoda: 'fertirigare', produse: [pa(null, 'Kristalon')] },
        { id: '4', parcela_id: 'p1', zi: '2026-06-26', metoda: 'fertirigare', produse: [pa(null, 'kristalon ')] },
        { id: '5', parcela_id: 'p1', zi: '2026-07-06', metoda: 'fertirigare', produse: [pa(null, 'Kristalon')] },
        { id: '6', parcela_id: 'p3', zi: '2026-07-02', metoda: 'foliar', produse: [pa('c', 'Azotat')] },
      ],
      stadii,
    )
    expect(grupuri.map((g) => [g.stadiu, g.zile.length, g.parcelaIds.length])).toEqual([
      ['inflorit', 1, 2],
      ['fruct_verde', 3, 1],
      [null, 1, 1],
    ])
    expect(grupuri[1].repetare).toEqual({ zile: 10, ori: 3 })
    expect(textGrup(grupuri[1])).toBe('aplicat de 3 ori, la ~10 zile')
    expect(textGrup(grupuri[0])).toBe('aplicat 5 iun. 2026')
  })

  it('intervalul tipic e mediana', () => {
    expect(intervalTipic(['2026-06-01'])).toBeNull()
    expect(intervalTipic(['2026-06-01', '2026-06-08', '2026-06-20'])).toBe(10)
  })
})

describe('verificările la completare', () => {
  const parcele = [{ id: 'p1', suprafata_m2: 1000, nr_plante: 900, volum_solutie_l: 60 }]

  it('stocul: ajunge, puțin, lipsă, neurmărit', () => {
    expect(verificaStoc(produs(), parcele, [{ produs_id: 'borofol', unitate: 'l', stoc: 0.4 }])).toMatchObject({ ok: true, eticheta: 'OK' })
    expect(verificaStoc(produs({ doza_l_per_ha: 5 }), parcele, [{ produs_id: 'borofol', unitate: 'l', stoc: 0.4 }])).toMatchObject({ ok: false, eticheta: 'puțin' })
    expect(verificaStoc(produs(), parcele, [{ produs_id: 'borofol', unitate: 'l', stoc: 0 }])).toMatchObject({ ok: false, eticheta: 'lipsă' })
    expect(verificaStoc(produs(), parcele, [])).toBeNull()
    // Fertirigare: 2 g × 900 plante = 1,8 kg.
    const fert = produs({ produs_id: 'ferti', cantitate_text: '2 g/plantă · rezervor A', doza_l_per_ha: null })
    expect(verificaStoc(fert, parcele, [{ produs_id: 'ferti', unitate: 'kg', stoc: 1 }])).toMatchObject({ ok: false })
    expect(verificaStoc(fert, parcele, [{ produs_id: 'ferti', unitate: 'kg', stoc: 5 }])).toMatchObject({ ok: true })
  })

  it('pauza față de culesul estimat', () => {
    expect(verificaPauza({ phi: 7, zi: '2027-05-25', datesCules: ['2027-06-19'] })).toMatchObject({ ok: true, text: 'pauză 7 zile · culesul în ~25 de zile' })
    expect(verificaPauza({ phi: 7, zi: '2027-06-15', datesCules: ['2027-06-19'] })).toMatchObject({ ok: false, eticheta: 'atenție' })
    expect(verificaPauza({ phi: 0, zi: '2027-06-15', datesCules: ['2027-06-19'] })).toBeNull()
    expect(verificaPauza({ phi: 3, zi: '2027-06-15', datesCules: [null] })).toMatchObject({ ok: true, text: 'pauză 3 zile' })
  })

  it('maximul pe sezon', () => {
    const facute = [
      { parcela_id: 'p1', zi: '2027-05-01', produs_id: 'sw', nume: 'Switch' },
      { parcela_id: 'p1', zi: '2026-05-01', produs_id: 'sw', nume: 'Switch' },
    ]
    expect(verificaMaxim({ produs: { produs_id: 'sw', nume: 'Switch' }, nrMax: 3, parcelaIds: ['p1'], facute, an: 2027 })).toMatchObject({ ok: true, text: 'a 2-a aplicare din maxim 3 pe sezon' })
    expect(verificaMaxim({ produs: { produs_id: 'sw', nume: 'Switch' }, nrMax: 1, parcelaIds: ['p1'], facute, an: 2027 })).toMatchObject({ ok: false })
    expect(verificaMaxim({ produs: { produs_id: 'sw', nume: 'Switch' }, nrMax: null, parcelaIds: ['p1'], facute, an: 2027 })).toBeNull()
  })

  it('intervalul minim', () => {
    const facute = [{ parcela_id: 'p1', zi: '2027-05-21', produs_id: 'sw', nume: 'Switch' }]
    expect(verificaInterval({ produs: { produs_id: 'sw', nume: 'Switch' }, intervalMin: 7, parcelaIds: ['p1'], facute, zi: '2027-05-25' })).toMatchObject({ ok: false, text: 'ultima aplicare acum 4 zile; intervalul minim e 7 zile' })
    expect(verificaInterval({ produs: { produs_id: 'sw', nume: 'Switch' }, intervalMin: 3, parcelaIds: ['p1'], facute, zi: '2027-05-25' })).toBeNull()
    expect(verificaInterval({ produs: { produs_id: 'sw', nume: 'Switch' }, intervalMin: 7, parcelaIds: ['p2'], facute, zi: '2027-05-25' })).toBeNull()
  })

  it('toate împreună, în ordine', () => {
    const v = verificariInterventie({
      produse: [produs({ produs_id: 'sw', nume: 'Switch', phi: 7 })],
      parcele,
      zi: '2027-05-25',
      an: 2027,
      catalog: new Map([['sw', { phi: 7, nrMaxPeSezon: 3, intervalMinZile: 7 }]]),
      facute: [{ parcela_id: 'p1', zi: '2027-05-21', produs_id: 'sw', nume: 'Switch' }],
      stoc: [{ produs_id: 'sw', unitate: 'l', stoc: 2 }],
      datesCules: ['2027-06-19'],
    })
    expect(v.map((x) => x.tip)).toEqual(['stoc', 'maxim', 'interval', 'pauza'])
  })
})

describe('formularul completat din plan', () => {
  const catalog = new Map<string, ProdusCatalog>([
    ['borofol', { id: 'borofol', tenant_id: 't', nume_comercial: 'Borofol', substanta_activa: 'B', tip: 'foliar', frac_irac: null, doza_min_ml_per_hl: null, doza_max_ml_per_hl: null, doza_min_l_per_ha: null, doza_max_l_per_ha: null, phi_zile: 0, nr_max_aplicari_per_sezon: 3, interval_min_aplicari_zile: 7, omologat_culturi: null, activ: true }],
  ])

  it('ia parcelele, produsele, dozele și metoda; salvarea poartă `plan_linie_id`', () => {
    const ciorna = ciornaDinLinie(linie(), ['p1'], catalog)
    expect(ciorna).toMatchObject({ metoda: 'stropire', mod: 'ha', parcelaIds: ['p1'] })
    expect(ciorna.produse[0]).toMatchObject({ produsId: 'borofol', doza: 1.5, nrMaxPeSezon: 3, planLinieProdusId: 'lp1' })
    const rows = aplicariDeSalvat({ ciorna, parcele: [{ id: 'p1', nume_parcela: 'P1', suprafata_m2: 1000, nr_plante: 10 }], cand: { tip: 'acum' }, meteo: null, planLinieId: 'l-inflorit' })
    expect(rows[0]).toMatchObject({ sursa: 'din_plan', plan_linie_id: 'l-inflorit' })
    expect(rows[0].produse[0].plan_linie_produs_id).toBe('lp1')
    const manual = aplicariDeSalvat({ ciorna, parcele: [{ id: 'p1', nume_parcela: 'P1', suprafata_m2: 1000, nr_plante: 10 }], cand: { tip: 'acum' }, meteo: null })
    expect(manual[0].sursa).toBe('manuala')
    expect('plan_linie_id' in manual[0]).toBe(false)
  })

  it('fertirigarea citește grame pe plantă', () => {
    const ciorna = ciornaDinLinie(linie({ metoda: 'fertirigare', produse: [produs({ id: null, produs_id: null, nume: 'Ferti', tip: 'ingrasamant', cantitate_text: '2 g/plantă · rezervor B' })] }), ['p1'], catalog)
    expect(ciorna.metoda).toBe('fertirigare')
    expect(ciorna.produse[0]).toMatchObject({ gPePlanta: 2, rezervor: 'B', planLinieProdusId: null })
  })
})

describe('plan nou', () => {
  it('id-uri derivate stabile (reîncercarea nu dublează)', () => {
    const cheie = '11111111-2222-4333-8444-5555ffffffff'
    expect(idDerivat(cheie, 0)).toBe(cheie)
    expect(idDerivat(cheie, 1)).toBe('11111111-2222-4333-8444-555500000000')
    const a = randuriPlanNou({ cheie, tenantId: 't', userId: 'u', nume: 'Zmeură 2027', culturaTip: 'zmeur', linii: [{ stadiu: 'inflorit', cohort: null, scop: null, metoda: 'foliar', repetare: null, produse: [{ produs_id: null, nume: 'X', tip: null, phi: null, doza_ml_per_hl: 100, doza_l_per_ha: null, cantitate_text: null }] }], parcelaIds: ['p1', 'p2'], an: 2027 })
    const b = randuriPlanNou({ cheie, tenantId: 't', userId: 'u', nume: 'Zmeură 2027', culturaTip: 'zmeur', linii: [{ stadiu: 'inflorit', cohort: null, scop: null, metoda: 'foliar', repetare: null, produse: [{ produs_id: null, nume: 'X', tip: null, phi: null, doza_ml_per_hl: 100, doza_l_per_ha: null, cantitate_text: null }] }], parcelaIds: ['p1', 'p2'], an: 2027 })
    expect(a).toEqual(b)
    expect(a.linii[0]).toMatchObject({ plan_id: cheie, stadiu_trigger: 'inflorit', produs_id: null, produs_nume_manual: 'X', regula_repetare: 'fara_repetare' })
    expect(a.produse[0]).toMatchObject({ plan_linie_id: a.linii[0].id, produs_nume_snapshot: 'X', ordine: 1 })
    expect(new Set([a.plan.id, ...a.linii.map((l) => l.id), ...a.produse.map((p) => p.id), ...a.parcele.map((p) => p.id)]).size).toBe(5)
  })
})

describe('întrebarea „A început…?”', () => {
  const curente = stadiiCurente([stadiu('p1', 'buton_roz', '2027-05-20')])
  const anTrecut = [stadiu('p1', 'inflorit', '2026-06-01')]

  it('apare cu 3 zile înainte de ziua de anul trecut și tace după „Încă nu”', () => {
    expect(intrebariParcela({ parcelaId: 'p1', grup: 'rubus', curente, stadiiAnTrecut: anTrecut, an: 2027, azi: '2027-05-27' })).toEqual([])
    const [q] = intrebariParcela({ parcelaId: 'p1', grup: 'rubus', curente, stadiiAnTrecut: anTrecut, an: 2027, azi: '2027-05-29' })
    expect(q).toMatchObject({ urmator: 'inflorit', zi: '2027-06-01', intrebare: 'A început înflorirea?' })
    expect(intrebariParcela({ parcelaId: 'p1', grup: 'rubus', curente, stadiiAnTrecut: anTrecut, an: 2027, azi: '2027-05-29', amanate: new Map([[q.cheie, '2027-06-01']]) })).toEqual([])
  })

  it('fără istoric, la coacere se uită la culesul estimat', () => {
    const c = stadiiCurente([stadiu('p1', 'fruct_verde', '2027-06-01')])
    expect(intrebariParcela({ parcelaId: 'p1', grup: 'rubus', curente: c, stadiiAnTrecut: [], an: 2027, azi: '2027-06-10', dataCules: '2027-06-20' })[0]).toMatchObject({ urmator: 'parga', zi: '2027-06-13' })
    expect(intrebariParcela({ parcelaId: 'p1', grup: 'rubus', curente: c, stadiiAnTrecut: [], an: 2027, azi: '2027-06-10' })).toEqual([])
  })
})

describe('notificarea', () => {
  const p = plan([linie(), linie({ id: 'l2', ordine: 2, scop: 'botritis' })])
  const deFacut = calculeazaPlan(p, asocieri, ctx()).deFacut

  it('nu se repetă pe linie, parcelă și repetare', () => {
    const noi = anunturiNoi(deFacut, [], 2027)
    expect(noi).toHaveLength(2)
    const deja = randuriAnuntate('t', noi)
    expect(anunturiNoi(deFacut, deja, 2027)).toHaveLength(0)
    // A doua repetare e altă intervenție.
    expect(anunturiNoi(deFacut.map((d) => ({ ...d, repetare: 2 })), deja, 2027)).toHaveLength(2)
  })

  it('textul și cheia pe utilizator', () => {
    const n = notificarePlan({ tenantId: 't', userId: 'u1', azi: '2027-05-25', noi: deFacut, numeParcele: new Map([['p1', 'Maravilla']]) })
    expect(n).toMatchObject({ type: 'plan_tratament', title: 'E timpul pentru Înflorit la Maravilla · 2 intervenții', reminderKey: 'plan:t:2027-05-25:u1' })
    expect(notificarePlan({ tenantId: 't', userId: 'u1', azi: '2027-05-25', noi: [], numeParcele: new Map() })).toBeNull()
  })

  it('destinatarii: proprietarul și operatorii activi cu „Scrie” pe Tratamente', () => {
    const membri = [
      { user_id: 'scrie', role: 'operator', is_active: true, modules_access: [{ module: 'tratamente', level: 'write' }] },
      { user_id: 'citeste', role: 'operator', is_active: true, modules_access: [{ module: 'tratamente', level: 'read' }] },
      { user_id: 'oprit', role: 'operator', is_active: false, modules_access: [{ module: 'tratamente', level: 'write' }] },
    ]
    expect(destinatariPlan({ ownerUserId: 'owner', membri })).toEqual(['owner', 'scrie'])
  })
})

describe('cronul planului', () => {
  it('fără migrare (lipsește `planuri_anuntate`) nu trimite nimic', async () => {
    const { deAnuntatFerma } = await import('@/lib/plan/memento-cron')
    const query = {
      select: () => query,
      eq: () => query,
      then: (resolve: (value: unknown) => void) => resolve({ data: null, error: { code: '42P01', message: 'relation "planuri_anuntate" does not exist' } }),
    }
    const admin = { from: () => query }
    expect(await deAnuntatFerma(admin, 't', '2027-05-25')).toBeNull()
  })
})
