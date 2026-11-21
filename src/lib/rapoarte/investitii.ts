/**
 * Investițiile în Rapoarte: secțiune proprie, cu totalul perioadei. Nu intră la costuri și nu scad din
 * profit (profitul rămâne venituri − cheltuieli). Funcție pură.
 */
import { resolveInvestitieCategorie, type CategorieInvestitie } from '@/lib/financial/categories'
import { round2 } from '@/lib/format-ro'

export interface InvestitieRaport {
  id: string
  data: string
  categorie: string | null
  suma_lei: number | string | null
}

export interface InvestitiiPerioada {
  totalLei: number
  count: number
  /** Pe categorii (cele 6 noi; numele vechi trec prin `resolveInvestitieCategorie`), cea mai mare întâi. */
  peCategorii: { categorie: CategorieInvestitie; lei: number; count: number }[]
}

/** Investițiile dintre `startIso` și `endIso` (zile `YYYY-MM-DD`, capetele incluse), după data investiției. */
export function investitiiInPerioada(rows: readonly InvestitieRaport[], startIso: string, endIso: string): InvestitiiPerioada {
  let total = 0
  let count = 0
  const byCategorie = new Map<CategorieInvestitie, { lei: number; count: number }>()
  for (const row of rows) {
    const day = String(row.data ?? '').slice(0, 10)
    if (!day || day < startIso || day > endIso) continue
    const suma = Number(row.suma_lei) || 0
    total += suma
    count += 1
    const categorie = resolveInvestitieCategorie(row.categorie)
    const current = byCategorie.get(categorie) ?? { lei: 0, count: 0 }
    current.lei += suma
    current.count += 1
    byCategorie.set(categorie, current)
  }
  const peCategorii = [...byCategorie.entries()]
    .map(([categorie, value]) => ({ categorie, lei: round2(value.lei), count: value.count }))
    .sort((a, b) => b.lei - a.lei)
  return { totalLei: round2(total), count, peCategorii }
}
