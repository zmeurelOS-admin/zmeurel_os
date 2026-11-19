/**
 * Culegători: kilogramele de azi și din sezon, cât s-a plătit și ultimele zile ale fiecăruia.
 * Funcții pure, peste recoltări. Plata se calculează și se achită la înregistrarea recoltării
 * (kg × tariful de atunci), deci „plătit” e suma valorilor din recoltări, fără avans și fără rest.
 */
import { round2 } from '@/lib/format-ro'
import type { Culegator } from '@/lib/supabase/queries/culegatori'
import { getRecoltareTotalKg, type Recoltare } from '@/lib/supabase/queries/recoltari'

export const TIPURI_ANGAJARE = ['Sezonier', 'Permanent', 'Zilier', 'Colaborator'] as const
export type TipAngajare = (typeof TIPURI_ANGAJARE)[number]

export interface CulegatorZi {
  data: string
  parcelaId: string | null
  kg: number
}

export interface CulegatorStats {
  kgAzi: number
  kgSezon: number
  platitSezon: number
  /** Zilele de cules, cele mai noi întâi (o intrare pe zi și parcelă). */
  zile: CulegatorZi[]
}

const EMPTY_STATS: CulegatorStats = { kgAzi: 0, kgSezon: 0, platitSezon: 0, zile: [] }

const dayOf = (value: string | null | undefined) => String(value ?? '').slice(0, 10)

/** Sezonul = anul calendaristic al zilei de azi. */
export function buildCulegatorStats(recoltari: readonly Recoltare[], todayIso: string): Map<string, CulegatorStats> {
  const year = todayIso.slice(0, 4)
  const stats = new Map<string, CulegatorStats>()
  const dayTotals = new Map<string, Map<string, CulegatorZi>>()

  for (const recoltare of recoltari) {
    const id = recoltare.culegator_id
    const day = dayOf(recoltare.data)
    if (!id || !day.startsWith(year)) continue

    const entry = stats.get(id) ?? { ...EMPTY_STATS, zile: [] }
    const kg = getRecoltareTotalKg(recoltare)
    entry.kgSezon = round2(entry.kgSezon + kg)
    entry.platitSezon = round2(entry.platitSezon + (Number(recoltare.valoare_munca_lei) || 0))
    if (day === todayIso) entry.kgAzi = round2(entry.kgAzi + kg)
    stats.set(id, entry)

    const perDay = dayTotals.get(id) ?? new Map<string, CulegatorZi>()
    const key = `${day}|${recoltare.parcela_id ?? ''}`
    const current = perDay.get(key)
    if (current) current.kg = round2(current.kg + kg)
    else perDay.set(key, { data: day, parcelaId: recoltare.parcela_id ?? null, kg })
    dayTotals.set(id, perDay)
  }

  for (const [id, perDay] of dayTotals) {
    const entry = stats.get(id)
    if (entry) entry.zile = [...perDay.values()].sort((left, right) => right.data.localeCompare(left.data))
  }

  return stats
}

export function statsOf(stats: ReadonlyMap<string, CulegatorStats>, culegatorId: string): CulegatorStats {
  return stats.get(culegatorId) ?? EMPTY_STATS
}

export interface CulegatoriSummary {
  kgAzi: number
  /** Câți au cules azi. */
  culesAziCount: number
  kgSezon: number
  platitSezon: number
}

export function culegatoriSummary(stats: ReadonlyMap<string, CulegatorStats>): CulegatoriSummary {
  let kgAzi = 0
  let culesAziCount = 0
  let kgSezon = 0
  let platitSezon = 0
  for (const entry of stats.values()) {
    kgAzi += entry.kgAzi
    kgSezon += entry.kgSezon
    platitSezon += entry.platitSezon
    if (entry.kgAzi > 0) culesAziCount += 1
  }
  return { kgAzi: round2(kgAzi), culesAziCount, kgSezon: round2(kgSezon), platitSezon: round2(platitSezon) }
}

/** Activi sau inactivi, în ordine alfabetică. */
export function culegatoriByStatus<T extends Pick<Culegator, 'status_activ' | 'nume_prenume'>>(
  culegatori: readonly T[],
  activi: boolean,
): T[] {
  return culegatori
    .filter((culegator) => Boolean(culegator.status_activ) === activi)
    .sort((left, right) => (left.nume_prenume || '').localeCompare(right.nume_prenume || '', 'ro'))
}

/** Tipul salvat, adus la una dintre cele patru variante (valorile vechi necunoscute devin „Sezonier”). */
export function normalizeTipAngajare(value: string | null | undefined): TipAngajare {
  const match = TIPURI_ANGAJARE.find((tip) => tip.toLowerCase() === String(value ?? '').trim().toLowerCase())
  return match ?? 'Sezonier'
}
