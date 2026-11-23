/**
 * Stadiul parcelei, pentru plan: stadiul de acum (cel de pe fișă: ultima înregistrare a omului, pe fiecare cohortă la
 * zmeura remontantă) și stadiul dintr-o zi anume (pentru gruparea aplicărilor de anul trecut). Funcții pure, fără
 * Supabase (se folosesc și în cronul de dimineață).
 */
import { normalizeStadiu, type StadiuCod } from '@/lib/parcele/stadii-canonic'

import type { Cohorta } from './model'

export interface StadiuRand {
  parcela_id: string
  an?: number | null
  stadiu: string | null
  cohort?: string | null
  data_observata: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface StadiuCurent {
  cohort: Cohorta | null
  stadiu: StadiuCod
  /** Ziua în care omul a notat stadiul (intrarea în stadiu). */
  din: string
}

const cohorta = (value: unknown): Cohorta | null => (value === 'floricane' || value === 'primocane' ? value : null)

const moment = (rand: StadiuRand): number => {
  const created = Date.parse(String(rand.created_at ?? ''))
  const updated = Date.parse(String(rand.updated_at ?? ''))
  const best = Math.max(Number.isFinite(created) ? created : 0, Number.isFinite(updated) ? updated : 0)
  if (best > 0) return best
  const zi = Date.parse(`${String(rand.data_observata ?? '').slice(0, 10)}T12:00:00Z`)
  return Number.isFinite(zi) ? zi : 0
}

/**
 * Stadiul de acum al unei parcele, din stadiile ei din sezon (ca fișa: ultima înregistrare validă, după momentul
 * notării). Dacă există stadii pe cohorte (zmeura remontantă), câte unul pe fiecare cohortă notată.
 */
export function stadiiCurente(stadii: readonly StadiuRand[]): StadiuCurent[] {
  const valide = stadii.filter((rand) => normalizeStadiu(String(rand.stadiu ?? '')) !== null)
  if (valide.length === 0) return []
  const peCohorte = valide.some((rand) => cohorta(rand.cohort) !== null)
  const grupuri = new Map<string, StadiuRand[]>()
  for (const rand of valide) {
    const cheie = peCohorte ? (cohorta(rand.cohort) ?? '') : ''
    if (peCohorte && !cheie) continue
    grupuri.set(cheie, [...(grupuri.get(cheie) ?? []), rand])
  }
  const rezultat: StadiuCurent[] = []
  for (const [cheie, randuri] of grupuri) {
    const ultim = [...randuri].sort((a, b) => moment(b) - moment(a))[0]
    rezultat.push({
      cohort: cohorta(cheie),
      stadiu: normalizeStadiu(String(ultim.stadiu)) as StadiuCod,
      din: String(ultim.data_observata ?? '').slice(0, 10),
    })
  }
  return rezultat.sort((a, b) => String(a.cohort ?? '').localeCompare(String(b.cohort ?? '')))
}

/** Stadiile curente pe parcele (cheia: parcela). */
export function stadiiCurentePeParcele(stadii: readonly StadiuRand[]): Map<string, StadiuCurent[]> {
  const pe = new Map<string, StadiuRand[]>()
  for (const rand of stadii) pe.set(rand.parcela_id, [...(pe.get(rand.parcela_id) ?? []), rand])
  const rezultat = new Map<string, StadiuCurent[]>()
  for (const [parcelaId, randuri] of pe) rezultat.set(parcelaId, stadiiCurente(randuri))
  return rezultat
}

/**
 * Stadiul parcelei într-o zi (pentru o aplicare de anul trecut): ultimul stadiu observat până în ziua aceea. La
 * cohorte, cel notat cel mai recent. `null` = niciun stadiu notat până atunci.
 */
export function stadiuLaData(stadii: readonly StadiuRand[], parcelaId: string, zi: string): StadiuCod | null {
  let best: { zi: string; cod: StadiuCod } | null = null
  for (const rand of stadii) {
    if (rand.parcela_id !== parcelaId) continue
    const ziua = String(rand.data_observata ?? '').slice(0, 10)
    if (!ziua || ziua > zi) continue
    const cod = normalizeStadiu(String(rand.stadiu ?? ''))
    if (!cod) continue
    if (!best || ziua >= best.zi) best = { zi: ziua, cod }
  }
  return best?.cod ?? null
}

/** Prima zi în care parcela a fost notată în `stadiu` (pe cohorta dată, dacă e), în stadiile date. */
export function primaZiInStadiu(stadii: readonly StadiuRand[], parcelaId: string, stadiu: StadiuCod, cohort: Cohorta | null): string | null {
  let prima: string | null = null
  for (const rand of stadii) {
    if (rand.parcela_id !== parcelaId) continue
    if (normalizeStadiu(String(rand.stadiu ?? '')) !== stadiu) continue
    if (cohort && cohorta(rand.cohort) && cohorta(rand.cohort) !== cohort) continue
    const zi = String(rand.data_observata ?? '').slice(0, 10)
    if (zi && (prima === null || zi < prima)) prima = zi
  }
  return prima
}
