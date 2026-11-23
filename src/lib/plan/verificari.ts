/**
 * Verificările unei intervenții din plan (pe rândul din tab-ul Plan și la completare): avertizează, nu blochează.
 *   - pauza produsului față de culesul estimat (promptul 26);
 *   - numărul de aplicări pe sezon față de `nr_max_aplicari_per_sezon`;
 *   - intervalul minim față de `interval_min_aplicari_zile`;
 *   - stocul din magazie (promptul 28).
 * Funcții pure.
 */
import { formatCantitateStoc, convertesteInStoc, type UnitateStoc } from '@/lib/magazie/unitati'
import { citesteTextFertirigare, suprafataHa, volumPropus } from '@/lib/tratamente/doze'
import { adaugaZile, zileIntre, zileText } from '@/lib/tratamente/zile'

import type { ProdusLinie } from './model'

export type TipVerificare = 'stoc' | 'pauza' | 'maxim' | 'interval'

export interface Verificare {
  tip: TipVerificare
  ok: boolean
  /** Textul scurt de pe rând: „în magazie 0,4 l”, „pauză 7 zile · culesul în ~25 de zile”. */
  text: string
  /** Eticheta: „OK”, „puțin”, „lipsă”, „atenție”. */
  eticheta: string
  /** Produsul la care se referă (stoc, maxim, interval). */
  produs?: string
}

export interface ParcelaVerificare {
  id: string
  suprafata_m2: number | null
  nr_plante: number | null
  volum_solutie_l?: number | null
}

export interface InfoCatalog {
  phi: number | null
  nrMaxPeSezon: number | null
  intervalMinZile: number | null
}

/** O aplicare făcută a unui produs (pentru maxim și interval). */
export interface AplicareProdusFacuta {
  parcela_id: string
  zi: string
  produs_id: string | null
  nume: string
}

export interface StocVerificare {
  produs_id: string
  unitate: UnitateStoc
  stoc: number
}

const potriveste = (a: AplicareProdusFacuta, produs: Pick<ProdusLinie, 'produs_id' | 'nume'>) =>
  produs.produs_id ? a.produs_id === produs.produs_id : a.nume.trim().toLocaleLowerCase('ro-RO') === produs.nume.trim().toLocaleLowerCase('ro-RO')

/**
 * Cât cere linia dintr-un produs pe parcelele date, în unitatea magaziei. `null` = nu se poate calcula (lipsește
 * suprafața, volumul sau numărul de plante; unitate incompatibilă).
 */
export function necesarProdus(produs: ProdusLinie, parcele: readonly ParcelaVerificare[], unitate: UnitateStoc): number | null {
  const fert = citesteTextFertirigare(produs.cantitate_text)
  if (fert) {
    let kg = 0
    for (const parcela of parcele) {
      const plante = Number(parcela.nr_plante) || 0
      if (plante <= 0) return null
      kg += (fert.gPePlanta * plante) / 1000
    }
    return convertesteInStoc(kg, 'kg', unitate)
  }
  const solid = produs.tip === 'ingrasamant' || unitate === 'kg'
  if (produs.doza_l_per_ha !== null && produs.doza_l_per_ha > 0) {
    const ha = suprafataHa(parcele)
    if (!(ha > 0)) return null
    return convertesteInStoc(produs.doza_l_per_ha * ha, solid ? 'kg' : 'l', unitate)
  }
  if (produs.doza_ml_per_hl !== null && produs.doza_ml_per_hl > 0) {
    const volum = volumPropus(parcele)
    if (!volum) return null
    return convertesteInStoc((produs.doza_ml_per_hl * volum) / 100, solid ? 'g' : 'ml', unitate)
  }
  return null
}

export function verificaStoc(produs: ProdusLinie, parcele: readonly ParcelaVerificare[], stoc: readonly StocVerificare[]): Verificare | null {
  const rand = produs.produs_id ? stoc.find((s) => s.produs_id === produs.produs_id) : undefined
  if (!rand) return null
  const necesar = necesarProdus(produs, parcele, rand.unitate)
  const inMagazie = `în magazie ${formatCantitateStoc(Math.max(0, rand.stoc), rand.unitate)}`
  if (rand.stoc <= 0) return { tip: 'stoc', ok: false, text: 'nu mai e în magazie', eticheta: 'lipsă', produs: produs.nume }
  if (necesar === null) return { tip: 'stoc', ok: true, text: inMagazie, eticheta: 'OK', produs: produs.nume }
  if (rand.stoc < necesar) {
    return { tip: 'stoc', ok: false, text: `${inMagazie} · trebuie ${formatCantitateStoc(necesar, rand.unitate)}`, eticheta: 'puțin', produs: produs.nume }
  }
  return { tip: 'stoc', ok: true, text: `${inMagazie} · trebuie ${formatCantitateStoc(necesar, rand.unitate)}`, eticheta: 'OK', produs: produs.nume }
}

/** Pauza (cea mai lungă dintre produse) față de culesul estimat: cea mai apropiată dată de cules a parcelelor. */
export function verificaPauza(input: { phi: number; zi: string; datesCules: ReadonlyArray<string | null> }): Verificare | null {
  const pauza = Math.max(0, Math.floor(Number(input.phi) || 0))
  if (pauza <= 0) return null
  const viitoare = input.datesCules.filter((d): d is string => Boolean(d) && (d as string) >= input.zi).sort()
  const cules = viitoare[0] ?? null
  if (!cules) return { tip: 'pauza', ok: true, text: `pauză ${zileText(pauza)}`, eticheta: 'OK' }
  const pana = zileIntre(input.zi, cules)
  const ok = adaugaZile(input.zi, pauza) <= cules
  return {
    tip: 'pauza',
    ok,
    text: `pauză ${zileText(pauza)} · culesul în ~${zileText(pana)}`,
    eticheta: ok ? 'OK' : 'atenție',
  }
}

/** „a 2-a aplicare din maxim 3 pe sezon” (cea mai încărcată parcelă). */
export function verificaMaxim(input: {
  produs: Pick<ProdusLinie, 'produs_id' | 'nume'>
  nrMax: number | null
  parcelaIds: readonly string[]
  facute: readonly AplicareProdusFacuta[]
  an: number
}): Verificare | null {
  const max = Math.floor(Number(input.nrMax) || 0)
  if (max <= 0) return null
  const prefix = `${input.an}-`
  let celMult = 0
  for (const parcelaId of input.parcelaIds) {
    const zile = new Set(input.facute.filter((a) => a.parcela_id === parcelaId && a.zi.startsWith(prefix) && potriveste(a, input.produs)).map((a) => a.zi))
    celMult = Math.max(celMult, zile.size)
  }
  const urmatoarea = celMult + 1
  const ok = urmatoarea <= max
  return {
    tip: 'maxim',
    ok,
    text: ok ? `a ${urmatoarea === 1 ? '1-a' : `${urmatoarea}-a`} aplicare din maxim ${max} pe sezon` : `ar fi a ${urmatoarea}-a aplicare; maxim ${max} pe sezon`,
    eticheta: ok ? 'OK' : 'peste maxim',
    produs: input.produs.nume,
  }
}

/** Ultima aplicare a produsului pe aceste parcele e mai aproape decât intervalul minim. */
export function verificaInterval(input: {
  produs: Pick<ProdusLinie, 'produs_id' | 'nume'>
  intervalMin: number | null
  parcelaIds: readonly string[]
  facute: readonly AplicareProdusFacuta[]
  zi: string
}): Verificare | null {
  const interval = Math.floor(Number(input.intervalMin) || 0)
  if (interval <= 0) return null
  const ultima = input.facute
    .filter((a) => input.parcelaIds.includes(a.parcela_id) && a.zi <= input.zi && potriveste(a, input.produs))
    .map((a) => a.zi)
    .sort()
    .at(-1)
  if (!ultima) return null
  const trecute = zileIntre(ultima, input.zi)
  if (trecute >= interval) return null
  return {
    tip: 'interval',
    ok: false,
    text: `ultima aplicare acum ${zileText(trecute)}; intervalul minim e ${zileText(interval)}`,
    eticheta: 'prea devreme',
    produs: input.produs.nume,
  }
}

/** Toate verificările unei intervenții, în ordinea: stoc, maxim, interval, pauză. */
export function verificariInterventie(input: {
  produse: readonly ProdusLinie[]
  parcele: readonly ParcelaVerificare[]
  zi: string
  an: number
  catalog: ReadonlyMap<string, InfoCatalog>
  facute: readonly AplicareProdusFacuta[]
  stoc: readonly StocVerificare[]
  datesCules: ReadonlyArray<string | null>
}): Verificare[] {
  const rezultat: Verificare[] = []
  const parcelaIds = input.parcele.map((p) => p.id)
  let phi = 0
  for (const produs of input.produse) {
    const info = produs.produs_id ? input.catalog.get(produs.produs_id) : undefined
    const stoc = verificaStoc(produs, input.parcele, input.stoc)
    if (stoc) rezultat.push(stoc)
    const maxim = verificaMaxim({ produs, nrMax: info?.nrMaxPeSezon ?? null, parcelaIds, facute: input.facute, an: input.an })
    if (maxim) rezultat.push(maxim)
    const interval = verificaInterval({ produs, intervalMin: info?.intervalMinZile ?? null, parcelaIds, facute: input.facute, zi: input.zi })
    if (interval) rezultat.push(interval)
    phi = Math.max(phi, Number(produs.phi ?? info?.phi ?? 0) || 0)
  }
  const pauza = verificaPauza({ phi, zi: input.zi, datesCules: input.datesCules })
  if (pauza) rezultat.push(pauza)
  return rezultat
}

/** Cea mai importantă verificare pentru rândul scurt: prima care nu e OK, altfel stocul, altfel pauza. */
export function verificarePrincipala(verificari: readonly Verificare[]): Verificare | null {
  return verificari.find((v) => !v.ok) ?? verificari.find((v) => v.tip === 'stoc') ?? verificari.find((v) => v.tip === 'pauza') ?? verificari[0] ?? null
}
