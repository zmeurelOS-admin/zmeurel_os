import {
  getOrdine,
  listStadiiInOrdine,
  normalizeStadiu,
  type StadiuCod,
} from '@/lib/tratamente/stadii-canonic'

export const STADII_ORDINE: readonly StadiuCod[] = listStadiiInOrdine()

/**
 * Returnează ordinea logică a unui stadiu fenologic; stadiile necunoscute cad la final.
 * Exemplu: `getStadiuOrdine('inflorit')`
 */
export function getStadiuOrdine(stadiu: string): number {
  const cod = normalizeStadiu(stadiu)
  return cod ? getOrdine(cod) : Number.MAX_SAFE_INTEGER
}

/**
 * Returnează codul stadiului următor din secvența canonică.
 * Exemplu: `getStadiulUrmator('buton_verde')`
 */
export function getStadiulUrmator(stadiu: string): StadiuCod | null {
  const cod = normalizeStadiu(stadiu)
  if (!cod) {
    return null
  }

  const currentIndex = STADII_ORDINE.indexOf(cod)
  if (currentIndex === -1 || currentIndex === STADII_ORDINE.length - 1) {
    return null
  }

  return STADII_ORDINE[currentIndex + 1] ?? null
}
