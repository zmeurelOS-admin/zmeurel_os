/**
 * Stocul cal. I pe cultură (promptul 31). Funcții pure, testate.
 *
 * Serverul dă rândurile (`stoc_cal1_pe_cultura`, migrarea 20261124100000): recoltările cu cultura lor, comenzile
 * livrate / în livrare cu numele produsului, ajustările cu cultura lor. Aici le grupăm pe culturile fermei, cu
 * aceeași normalizare ca parcelele (`cheieCultura`). Ce nu are cultură (comenzi fără produs, ajustări vechi,
 * comenzile magazinului) merge la cultura principală: zmeura dacă ferma are zmeură, ca până acum.
 *
 * O fermă cu o singură cultură nu folosește asta: cifra vine din `get_sellable_cal1_stock_summary`, ca azi.
 */
import { round2 } from '@/lib/format-ro'
import {
  cheieCultura,
  culturaPrincipala,
  culturaProdusului,
  denumireCultura,
  etichetaStocCal1,
  type CulturaFerma,
} from '@/lib/parcele/culturi-ferma'

export type SursaStocCultura = 'recoltat' | 'livrat' | 'in_livrare' | 'ajustare'

export interface RandStocCultura {
  sursa: SursaStocCultura
  /** Recoltare / ajustare: cultura; comandă: numele produsului; `null` = fără cultură. */
  cultura: string | null
  kg: number
}

export interface StocCultura {
  cheie: string
  nume: string
  forma: CulturaFerma['forma']
  recoltat: number
  livrat: number
  inLivrare: number
  ajustari: number
  /** recoltat − livrat − în livrare + ajustări. */
  disponibil: number
}

function gol(cultura: Pick<CulturaFerma, 'cheie' | 'nume' | 'forma'>): StocCultura {
  return { cheie: cultura.cheie, nume: cultura.nume, forma: cultura.forma, recoltat: 0, livrat: 0, inLivrare: 0, ajustari: 0, disponibil: 0 }
}

/**
 * Stocul fiecărei culturi a fermei, în ordinea culturilor. O cultură care apare doar în rânduri (recoltată pe o
 * parcelă acum inactivă) se adaugă la final. Fără culturi și fără rânduri: listă goală.
 */
export function stocPeCultura(randuri: readonly RandStocCultura[], culturi: readonly CulturaFerma[]): StocCultura[] {
  const peCheie = new Map<string, StocCultura>(culturi.map((cultura) => [cultura.cheie, gol(cultura)]))
  const principala = culturaPrincipala(culturi)

  const intrare = (cheie: string | null): StocCultura | null => {
    const efectiva = cheie ?? principala?.cheie ?? null
    if (!efectiva) return null
    const existent = peCheie.get(efectiva)
    if (existent) return existent
    const nou = gol({ cheie: efectiva, ...denumireCultura(efectiva) })
    peCheie.set(efectiva, nou)
    return nou
  }

  for (const rand of randuri) {
    const kg = Number(rand.kg) || 0
    if (rand.sursa === 'livrat' || rand.sursa === 'in_livrare') {
      const tinta = intrare(culturaProdusului(rand.cultura, culturi))
      if (!tinta) continue
      if (rand.sursa === 'livrat') tinta.livrat += kg
      else tinta.inLivrare += kg
      continue
    }
    const tinta = intrare(cheieCultura(rand.cultura))
    if (!tinta) continue
    if (rand.sursa === 'recoltat') tinta.recoltat += kg
    else tinta.ajustari += kg
  }

  return [...peCheie.values()].map((stoc) => {
    const recoltat = round2(stoc.recoltat)
    const livrat = round2(stoc.livrat)
    const inLivrare = round2(stoc.inLivrare)
    const ajustari = round2(stoc.ajustari)
    return { ...stoc, recoltat, livrat, inLivrare, ajustari, disponibil: round2(recoltat - livrat - inLivrare + ajustari) }
  })
}

/**
 * Eticheta cifrei mari de stoc: „Zmeură cal. I disponibilă”. Fără parcele: `null` (ecranul arată „Adaugă întâi
 * o parcelă”). Mai multe culturi fără stocul pe cultură (migrarea neaplicată): cifra serverului e a zmeurei dacă
 * ferma are zmeură, altfel a tuturor culturilor.
 */
export function etichetaStocFerma(culturi: readonly CulturaFerma[]): string | null {
  if (culturi.length === 0) return null
  const zmeura = culturi.find((cultura) => cultura.cheie === 'zmeur')
  if (culturi.length === 1 || zmeura) return etichetaStocCal1(zmeura ?? culturi[0])
  return 'Cal. I disponibil, toate culturile'
}
