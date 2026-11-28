/**
 * Tabelul parcelelor pe desktop (promptul 35, §6): ultima lucrare făcută pe fiecare parcelă și ordinea listei. Pur,
 * testat; lucrările vin din jurnalul Lucrărilor (`construiesteJurnalLucrari`).
 */
import { construiesteJurnalLucrari, type LucrareRow } from '@/lib/lucrari/jurnal'
import { titluLucrare } from '@/lib/lucrari/tipuri'

export interface UltimaLucrare {
  titlu: string
  zi: string
}

/** Ultima lucrare făcută pe fiecare parcelă (o lucrare pe mai multe parcele contează la fiecare). */
export function ultimaLucrarePeParcela(lucrari: readonly LucrareRow[], azi: string | null): Map<string, UltimaLucrare> {
  const rezultat = new Map<string, UltimaLucrare>()
  // `facute` vin de la cea mai nouă: prima întâlnită pe o parcelă e ultima făcută.
  for (const rand of construiesteJurnalLucrari(lucrari, azi).facute) {
    if (!rand.zi) continue
    for (const parcelaId of rand.parcelaIds) {
      if (!rezultat.has(parcelaId)) rezultat.set(parcelaId, { titlu: titluLucrare(rand), zi: rand.zi })
    }
  }
  return rezultat
}

/** Comercialele întâi, apoi după nume (ca lista de pe telefon). */
export function ordoneazaParcele<T extends { nume_parcela: string | null; rol?: string | null }>(parcele: readonly T[], estePersonala: (parcela: T) => boolean): T[] {
  return [...parcele].sort(
    (a, b) => Number(estePersonala(a)) - Number(estePersonala(b)) || (a.nume_parcela ?? '').localeCompare(b.nume_parcela ?? '', 'ro', { numeric: true }),
  )
}
