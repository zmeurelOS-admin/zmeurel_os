/**
 * Ce spune magazia în formularul de tratament (ultimul pas) și pe lista de aplicări. Funcții pure.
 */
import { formatCantitateStoc, type UnitateStoc } from './unitati'
import { iesireDorita } from './iesiri'

export interface NecesarProdus {
  produsId: string | null
  nume: string
  /** Cantitatea totală din tratament (toate parcelele), în unitatea din formular. */
  cantitate: number | null
  unitate: string | null
}

export interface StocPentruFormular {
  produs_id: string
  unitate: UnitateStoc
  stoc: number
  pret_mediu: number | null
  /** Ziua primei intrări sau corecții (pentru „tratamentele vechi nu scad”). Lipsă = se presupune că scade. */
  start?: string | null
}

export type VerificareProdus =
  | { tip: 'ajunge'; nume: string; necesar: number; inMagazie: number; ramane: number; unitate: UnitateStoc; cost: number | null }
  | { tip: 'lipsa'; nume: string; necesar: number; inMagazie: number; lipsesc: number; unitate: UnitateStoc; cost: number | null }
  | { tip: 'neurmarit'; nume: string }
  | { tip: 'incompatibil'; nume: string; unitate: UnitateStoc }
  | { tip: 'nu_scade'; nume: string }

/**
 * Pentru fiecare produs: „în magazie X · rămân Y” sau „lipsesc Z”. `facut = false` (planificat) nu scade nimic.
 * `zi` = ziua tratamentului (o zi dinainte de prima intrare nu scade).
 */
export function verificaMagazie(input: {
  produse: readonly NecesarProdus[]
  stoc: readonly StocPentruFormular[]
  facut: boolean
  zi: string
}): VerificareProdus[] {
  const stocPeProdus = new Map(input.stoc.map((rand) => [rand.produs_id, rand]))
  // Același produs de două ori (rar): necesarul se adună, ca „rămân” să fie corect.
  const dejaCerut = new Map<string, number>()
  return input.produse.map((produs) => {
    const rand = produs.produsId ? stocPeProdus.get(produs.produsId) : undefined
    if (!produs.produsId || !rand) return { tip: 'neurmarit', nume: produs.nume }
    if (!input.facut) return { tip: 'nu_scade', nume: produs.nume }
    const dorit = iesireDorita(
      { status: 'aplicata', produsId: produs.produsId, cantitate: produs.cantitate, unitate: produs.unitate, zi: input.zi },
      { unitate: rand.unitate, start: rand.start === undefined ? input.zi : rand.start },
    )
    if (dorit.cantitate === null) {
      if (dorit.motiv === 'incompatibil' || dorit.motiv === 'fara_cantitate') return { tip: 'incompatibil', nume: produs.nume, unitate: rand.unitate }
      return { tip: 'nu_scade', nume: produs.nume }
    }
    const cerutInainte = dejaCerut.get(produs.produsId) ?? 0
    dejaCerut.set(produs.produsId, cerutInainte + dorit.cantitate)
    const inMagazie = rand.stoc - cerutInainte
    const ramane = inMagazie - dorit.cantitate
    const cost = rand.pret_mediu !== null ? rand.pret_mediu * dorit.cantitate : null
    if (ramane < 0) {
      return { tip: 'lipsa', nume: produs.nume, necesar: dorit.cantitate, inMagazie, lipsesc: -ramane, unitate: rand.unitate, cost }
    }
    return { tip: 'ajunge', nume: produs.nume, necesar: dorit.cantitate, inMagazie, ramane, unitate: rand.unitate, cost }
  })
}

/** Costul estimat al tratamentului (doar produsele cu preț). `null` = niciun produs cu preț. */
export function costEstimat(verificari: readonly VerificareProdus[]): number | null {
  let total = 0
  let are = false
  for (const verificare of verificari) {
    if ((verificare.tip === 'ajunge' || verificare.tip === 'lipsa') && verificare.cost !== null) {
      total += verificare.cost
      are = true
    }
  }
  return are ? total : null
}

/** Textul de pe rând: „în magazie 18 kg · rămân 16”, „în magazie 0,8 kg · lipsesc 0,4”. */
export function textVerificare(verificare: VerificareProdus): string {
  switch (verificare.tip) {
    case 'ajunge':
      return `în magazie ${formatCantitateStoc(verificare.inMagazie, verificare.unitate)} · rămân ${formatCantitateStoc(verificare.ramane, null)}`
    case 'lipsa':
      return `în magazie ${formatCantitateStoc(verificare.inMagazie, verificare.unitate)} · lipsesc ${formatCantitateStoc(verificare.lipsesc, null)}`
    case 'incompatibil':
      return `altă unitate decât în magazie (${verificare.unitate}): nu se scade`
    case 'nu_scade':
      return 'planificat: nu scade din magazie'
    default:
      return 'nu e în magazie'
  }
}

/** „−1,2 kg din magazie”, „−0,6 l și −0,15 l din magazie” (o aplicare sau un lot întreg). */
export function textIesiri(iesiri: readonly { cantitate: number; unitate: string | null }[]): string | null {
  const pozitive = iesiri.filter((iesire) => iesire.cantitate > 0)
  if (pozitive.length === 0) return null
  return `${pozitive.map((iesire) => formatCantitateStoc(-iesire.cantitate, iesire.unitate)).join(' și ')} din magazie`
}

/** Ieșirile unui lot, adunate pe produs (aplicările unui lot = câte una pe parcelă). */
export function iesiriPeLot(
  aplicareIds: readonly string[],
  iesiri: readonly { aplicare_id: string; produs_id: string; cantitate: number; unitate: string | null }[],
): { produsId: string; cantitate: number; unitate: string | null }[] {
  const ids = new Set(aplicareIds)
  const peProdus = new Map<string, { produsId: string; cantitate: number; unitate: string | null }>()
  for (const iesire of iesiri) {
    if (!ids.has(iesire.aplicare_id)) continue
    const curent = peProdus.get(iesire.produs_id) ?? { produsId: iesire.produs_id, cantitate: 0, unitate: iesire.unitate }
    curent.cantitate += Number(iesire.cantitate) || 0
    peProdus.set(iesire.produs_id, curent)
  }
  return [...peProdus.values()]
}
