/**
 * Textele pauzei, aceleași în jurnal, Acasă, Recoltări și Mai mult.
 */
import type { PauzaParcela } from './pauza'
import { ziCuDataRo, zileText, ziRelativaRo } from './zile'

/** „Maravilla 1: nu recolta până vineri 18.07”. */
export function titluPauza(numeParcela: string, pauza: Pick<PauzaParcela, 'panaLa'>): string {
  return `${numeParcela}: nu recolta până ${ziCuDataRo(pauza.panaLa)}`
}

/** „Pauză 3 zile după Scala, stropit marți 15.07. Mai e 1 zi.” */
export function detaliuPauza(pauza: Pick<PauzaParcela, 'zilePauza' | 'produs' | 'ziAplicare' | 'zileRamase'>, azi: string): string {
  const dupa = pauza.produs ? ` după ${pauza.produs}` : ' după tratament'
  const cand = ziRelativaRo(pauza.ziAplicare, azi)
  return `Pauză ${zileText(pauza.zilePauza)}${dupa}, aplicat ${cand.toLocaleLowerCase('ro-RO')}. Mai ${pauza.zileRamase === 1 ? 'e' : 'sunt'} ${zileText(pauza.zileRamase)}.`
}

/** Pastila scurtă: „Pauză: Maravilla 1” sau „Pauză: 3 parcele”. */
export function pastilaPauza(nume: readonly string[]): string | null {
  if (nume.length === 0) return null
  if (nume.length === 1) return `Pauză: ${nume[0]}`
  return `Pauză: ${nume.length} parcele`
}

/** „Pauză până sâmbătă 18.07 · Scala” (sub numele parcelei, în Recoltări). */
export function subtitluPauza(pauza: Pick<PauzaParcela, 'panaLa' | 'produs'>): string {
  return `Pauză până ${ziCuDataRo(pauza.panaLa)}${pauza.produs ? ` · ${pauza.produs}` : ''}`
}
