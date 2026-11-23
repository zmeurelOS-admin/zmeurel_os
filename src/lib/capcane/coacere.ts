/**
 * „În coacere”, pentru pragul la capcane: parcela e în stadiul de coacere sau de recoltare (stadiul de pe fișa
 * parcelei, valabil în ziua verificării), sau ziua e în fereastra culesului estimat (promptul 26,
 * `estimeazaCules`), de la cu 7 zile înainte de început încolo. Funcții pure.
 */
import { adaugaZile } from '@/lib/notifications/zilnice/common'
import { normalizeStadiu, type StadiuCod } from '@/lib/parcele/stadii-canonic'

/** Stadiile care înseamnă „coacere sau recoltare” (zmeura: „Început de coacere”, „Recoltare / fruct copt”). */
export const STADII_COACERE: ReadonlySet<StadiuCod> = new Set<StadiuCod>(['parga', 'maturitate'])

/** Fereastra culesului începe cu atâtea zile înainte de data estimată. */
export const ZILE_INAINTE_DE_CULES = 7

export interface StadiuObservat {
  stadiu: string | null
  data_observata: string | null
  cohort?: string | null
}

/**
 * Stadiile valabile în ziua `zi`: pe fiecare cohortă (floricane / primocane / fără), ultimul stadiu observat
 * până în ziua aceea, inclusiv.
 */
export function stadiiLaData(stadii: readonly StadiuObservat[], zi: string): StadiuCod[] {
  const ultimul = new Map<string, { zi: string; cod: StadiuCod }>()
  for (const stadiu of stadii) {
    const ziua = String(stadiu.data_observata ?? '').slice(0, 10)
    if (!ziua || ziua > zi) continue
    const cod = normalizeStadiu(String(stadiu.stadiu ?? ''))
    if (!cod) continue
    const cheie = stadiu.cohort ?? ''
    const curent = ultimul.get(cheie)
    if (!curent || ziua >= curent.zi) ultimul.set(cheie, { zi: ziua, cod })
  }
  return [...ultimul.values()].map((item) => item.cod)
}

export function inCoacere(input: { stadii: readonly StadiuObservat[]; dataCules: string | null; zi: string }): boolean {
  if (stadiiLaData(input.stadii, input.zi).some((cod) => STADII_COACERE.has(cod))) return true
  if (input.dataCules && input.zi >= adaugaZile(input.dataCules.slice(0, 10), -ZILE_INAINTE_DE_CULES)) return true
  return false
}
