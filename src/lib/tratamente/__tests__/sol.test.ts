import { describe, expect, it } from 'vitest'

import { jurnalParcela } from '@/lib/parcele/jurnal-parcela'
import { registruTratamente } from '@/lib/rapoarte/registru-tratamente'

import { aplicariDeSalvat, ceLipseste, ciornaDinTratament, type CiornaTratament, type ProdusCiorna } from '../formular'
import { construiesteJurnal, textProduse } from '../jurnal'
import type { AplicareProdusRow, AplicareRow } from '../model'
import { afisareSol, citesteTextSol, dozaHaSolBaza, formatCantitateSol, formatDozaHaSol, textConversieSol, textSol, totalSolBaza } from '../sol'

/** Maravilla 1 (0,25 ha) și Delniwa (0,75 ha). */
const parcele = [
  { id: 'm1', nume_parcela: 'Maravilla 1', suprafata_m2: 2500, nr_plante: 1000 },
  { id: 'd1', nume_parcela: 'Delniwa', suprafata_m2: 7500, nr_plante: 3000 },
]

const gunoi = (over: Partial<ProdusCiorna> = {}): ProdusCiorna => ({
  key: 'g',
  produsId: null,
  nume: 'Gunoi de grajd',
  substanta: null,
  tip: null,
  frac: null,
  phi: 0,
  nrMaxPeSezon: null,
  intervalMinZile: null,
  unitate: 'g',
  doza: null,
  gPePlanta: null,
  rezervor: 'A',
  ...over,
})

const ciorna = (produs: ProdusCiorna, parcelaIds = ['m1', 'd1']): CiornaTratament => ({ metoda: 'sol', parcelaIds, produse: [produs], mod: 'hl', volumL: null })

function aplicareDin(a: ReturnType<typeof aplicariDeSalvat>[number], id: string): AplicareRow {
  return {
    id,
    parcela_id: a.parcela_id,
    status: 'aplicata',
    data_planificata: null,
    data_aplicata: '2026-11-20T09:00:00Z',
    metoda_aplicare: a.metoda_aplicare,
    tip_interventie: a.tip_interventie,
    sursa: 'manuala',
    observatii: null,
    created_at: '2026-11-20T09:00:00Z',
    produs_id: a.produs_id,
    produs_nume_manual: a.produs_nume_manual,
    doza_ml_per_hl: null,
    doza_l_per_ha: null,
    meteo_snapshot: null,
    lot_id: 'L',
    produs: null,
    produse: a.produse.map((p, i) => ({ id: `${id}-${i}`, ...p }) as AplicareProdusRow),
  } as AplicareRow
}

describe('conversiile și textele (promptul 34, §8)', () => {
  it('tone → kg, la ha → total după suprafață', () => {
    expect(totalSolBaza({ doza: 1.5, mod: 'total', unitate: 't', ha: 1 })).toBe(1500)
    expect(totalSolBaza({ doza: 3, mod: 'ha', unitate: 't', ha: 0.25 })).toBe(750)
    expect(totalSolBaza({ doza: 3, mod: 'ha', unitate: 't', ha: 0 })).toBeNull()
    expect(dozaHaSolBaza({ doza: 750, mod: 'total', unitate: 'kg', ha: 0.25 })).toBe(3000)
  })

  it('afișarea în unitatea aleasă', () => {
    expect(formatCantitateSol(750, 't')).toBe('0,75 t')
    expect(formatCantitateSol(1500, 't')).toBe('1,5 t')
    expect(formatCantitateSol(750, 'kg')).toBe('750 kg')
    expect(formatDozaHaSol(3000, 't')).toBe('3 t/ha')
    expect(formatDozaHaSol(3000, 'kg')).toBe('3.000 kg/ha')
    expect(textConversieSol({ doza: 3, mod: 'ha', unitate: 't', ha: 0.25 })).toBe('3 t/ha × 0,25 ha = 0,75 t')
    expect(textConversieSol({ doza: 750, mod: 'total', unitate: 'kg', ha: 0.25 })).toBe('750 kg pe 0,25 ha = 3.000 kg/ha')
  })

  it('textul salvat se citește înapoi (unitatea și modul)', () => {
    const text = textSol({ parteBaza: 750, unitate: 't', mod: 'ha', dozaHaBaza: 3000 })
    expect(text).toBe('0,75 t · 3 t/ha')
    expect(citesteTextSol(text)).toEqual({ unitate: 't', mod: 'ha' })
    expect(citesteTextSol('750 kg')).toEqual({ unitate: 'kg', mod: 'total' })
    expect(citesteTextSol('2 g/plantă · rezervor A')).toBeNull()
    expect(afisareSol({ cantitateBaza: 3000, unitateBaza: 'kg', cantitateText: text, dozaHaBaza: 3000 })).toEqual({ cantitate: '3 t', doza: '3 t/ha' })
    // Rândurile vechi, fără text: kg, ca înainte.
    expect(afisareSol({ cantitateBaza: 40, unitateBaza: 'kg', cantitateText: null, dozaHaBaza: null })).toEqual({ cantitate: '40 kg', doza: null })
  })
})

describe('salvarea „La sol”', () => {
  it('total în tone: în bază kg, împărțit după suprafață, cu unitatea aleasă în text', () => {
    const [m1, d1] = aplicariDeSalvat({ ciorna: ciorna(gunoi({ doza: 2, unitateSol: 't', modSol: 'total' })), parcele, cand: { tip: 'acum' }, meteo: null })
    expect(m1.produse[0]).toMatchObject({ cantitate_totala: 500, unitate_cantitate: 'kg', cantitate_text: '0,5 t', doza_l_per_ha: null, produs_id: null, produs_nume_manual: 'Gunoi de grajd' })
    expect(d1.produse[0]).toMatchObject({ cantitate_totala: 1500, unitate_cantitate: 'kg', cantitate_text: '1,5 t' })
    expect(m1.produs_nume_manual).toBe('Gunoi de grajd')
  })

  it('la ha: totalul = doza × suprafața; doza la ha în kg/ha', () => {
    const [m1, d1] = aplicariDeSalvat({ ciorna: ciorna(gunoi({ doza: 3, unitateSol: 't', modSol: 'ha' })), parcele, cand: { tip: 'acum' }, meteo: null })
    expect(m1.produse[0]).toMatchObject({ cantitate_totala: 750, doza_l_per_ha: 3000, cantitate_text: '0,75 t · 3 t/ha' })
    expect(d1.produse[0]).toMatchObject({ cantitate_totala: 2250, doza_l_per_ha: 3000, cantitate_text: '2,25 t · 3 t/ha' })
  })

  it('la ha fără suprafață: nu se poate salva', () => {
    const faraSuprafata = [{ id: 'x', nume_parcela: 'X', suprafata_m2: null, nr_plante: null }]
    expect(ceLipseste(ciorna(gunoi({ doza: 3, unitateSol: 't', modSol: 'ha' }), ['x']), faraSuprafata)).toMatch(/suprafața/)
    expect(ceLipseste(ciorna(gunoi({ doza: 3, unitateSol: 't', modSol: 'total' }), ['x']), faraSuprafata)).toBeNull()
  })

  it('„Repetă” citește înapoi tonele și modul la ha', () => {
    const salvate = aplicariDeSalvat({ ciorna: ciorna(gunoi({ doza: 3, unitateSol: 't', modSol: 'ha' })), parcele, cand: { tip: 'acum' }, meteo: null })
    const grup = salvate.map((a, i) => aplicareDin(a, `a${i}`))
    const repetat = ciornaDinTratament(grup, new Set(['m1', 'd1']), new Map())
    expect(repetat?.produse[0]).toMatchObject({ unitateSol: 't', modSol: 'ha', doza: 3 })
  })
})

describe('afișarea în unitatea aleasă: jurnal, fișa parcelei, registru', () => {
  const salvate = aplicariDeSalvat({ ciorna: ciorna(gunoi({ doza: 3, unitateSol: 't', modSol: 'ha' })), parcele, cand: { tip: 'acum' }, meteo: null })
  const aplicari = salvate.map((a, i) => aplicareDin(a, `a${i}`))

  it('jurnalul Tratamente: totalul lotului în tone, cu doza la ha', () => {
    const { facute } = construiesteJurnal({ aplicari, activitati: [] })
    expect(textProduse(facute[0].produse)).toBe('Gunoi de grajd 3 t (3 t/ha)')
  })

  it('fișa parcelei: cantitatea parcelei în tone', () => {
    const zile = jurnalParcela({ parcelaId: 'm1', recoltari: [], aplicari, activitati: [], stadii: [], numeStadiu: () => '', azi: '2026-11-27' })
    const intrare = zile.flatMap((zi) => zi.intrari).find((item) => item.tip === 'tratament')
    expect(intrare?.titlu).toBe('La sol: Gunoi de grajd')
    expect(intrare?.detaliu).toBe('Gunoi de grajd 0,75 t (3 t/ha) · fără pauză')
  })

  it('registrul: doza „3 t/ha” și cantitatea „0,75 t”; pulberea la ha în kg/ha', () => {
    const randuri = registruTratamente({ aplicari, activitati: [], numeParcele: new Map([['m1', 'Maravilla 1'], ['d1', 'Delniwa']]), start: '2026-11-01', end: '2026-11-30' })
    expect(randuri.find((r) => r.parcela === 'Maravilla 1')).toMatchObject({ metoda: 'La sol', produs: 'Gunoi de grajd', doza: '3 t/ha', cantitate: '0,75 t' })
    const pulbere = aplicareDin(
      { ...salvate[0], metoda_aplicare: 'foliar', produse: [{ ...salvate[0].produse[0], doza_l_per_ha: 1.5, unitate_cantitate: 'g', cantitate_totala: 375, cantitate_text: '375 g' }] },
      'p',
    )
    const [rand] = registruTratamente({ aplicari: [pulbere], activitati: [], numeParcele: new Map([['m1', 'Maravilla 1']]), start: '2026-11-01', end: '2026-11-30' })
    expect(rand.doza).toBe('1,5 kg/ha')
  })
})
