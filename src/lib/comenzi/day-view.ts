/**
 * Comenzi, pagina pe zile: în ce zi cade o comandă, totalurile cardurilor de sus, ordinea în listă
 * și calculul pentru „Pune în livrare azi” (ce încape în stoc). Funcții pure.
 */
import { daysBetween, round2 } from '@/lib/format-ro'
import type { Comanda } from '@/lib/supabase/queries/comenzi'

export type ComenziBucket = 'azi' | 'maine' | 'tarziu' | 'fara-data'

export const COMENZI_BUCKETS: readonly ComenziBucket[] = ['azi', 'maine', 'tarziu', 'fara-data']

type DayComanda = Pick<
  Comanda,
  'id' | 'status' | 'data_livrare' | 'cantitate_kg' | 'total' | 'created_at' | 'prioritara'
>

/** Comanda mai are ceva de făcut (nu e livrată și nu e anulată). */
export function isComandaDeschisa(comanda: Pick<Comanda, 'status'>): boolean {
  return comanda.status !== 'livrata' && comanda.status !== 'anulata'
}

function dayOf(value: string | null | undefined): string | null {
  const day = String(value ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null
}

/**
 * Segmentul în care apare o comandă deschisă. `null` pentru cele livrate sau anulate.
 * Pe „Azi” stau și comenzile deja puse în livrare, și cele rămase din zilele trecute (restante).
 */
export function bucketOfComanda(comanda: Pick<Comanda, 'status' | 'data_livrare'>, todayIso: string): ComenziBucket | null {
  if (!isComandaDeschisa(comanda)) return null
  if (comanda.status === 'in_livrare') return 'azi'
  const day = dayOf(comanda.data_livrare)
  if (!day) return 'fara-data'
  const diff = daysBetween(todayIso, day)
  if (diff === null) return 'fara-data'
  if (diff <= 0) return 'azi'
  if (diff === 1) return 'maine'
  return 'tarziu'
}

/** Comanda trebuia livrată într-o zi care a trecut și nu e încă în livrare. */
export function isComandaRestanta(comanda: Pick<Comanda, 'status' | 'data_livrare'>, todayIso: string): boolean {
  if (!isComandaDeschisa(comanda) || comanda.status === 'in_livrare') return false
  const day = dayOf(comanda.data_livrare)
  return day !== null && day < todayIso
}

/** Ordinea în listă: prioritarele întâi, apoi ziua livrării, apoi ordinea în care au fost notate. */
export function compareComenziForDay(left: DayComanda, right: DayComanda): number {
  const priority = Number(right.prioritara === true) - Number(left.prioritara === true)
  if (priority !== 0) return priority
  const leftDay = dayOf(left.data_livrare) ?? '9999-12-31'
  const rightDay = dayOf(right.data_livrare) ?? '9999-12-31'
  if (leftDay !== rightDay) return leftDay.localeCompare(rightDay)
  return String(left.created_at ?? '').localeCompare(String(right.created_at ?? ''))
}

export function splitComenziByBucket<T extends DayComanda>(comenzi: readonly T[], todayIso: string): Record<ComenziBucket, T[]> {
  const buckets: Record<ComenziBucket, T[]> = { azi: [], maine: [], tarziu: [], 'fara-data': [] }
  for (const comanda of comenzi) {
    const bucket = bucketOfComanda(comanda, todayIso)
    if (bucket) buckets[bucket].push(comanda)
  }
  for (const bucket of COMENZI_BUCKETS) buckets[bucket].sort(compareComenziForDay)
  return buckets
}

export interface ComenziSummary {
  count: number
  kg: number
  lei: number
  prioritareCount: number
  prioritareKg: number
}

export function summarizeComenzi(comenzi: readonly DayComanda[]): ComenziSummary {
  let kg = 0
  let lei = 0
  let prioritareCount = 0
  let prioritareKg = 0
  for (const comanda of comenzi) {
    const quantity = Number(comanda.cantitate_kg) || 0
    kg += quantity
    lei += Number(comanda.total) || 0
    if (comanda.prioritara === true) {
      prioritareCount += 1
      prioritareKg += quantity
    }
  }
  return {
    count: comenzi.length,
    kg: round2(kg),
    lei: round2(lei),
    prioritareCount,
    prioritareKg: round2(prioritareKg),
  }
}

/** Comenzile unei liste, grupate pe ziua livrării (pentru „Mai târziu”). Ordinea zilelor: crescătoare. */
export function groupComenziByDay<T extends DayComanda>(comenzi: readonly T[]): Array<{ day: string | null; comenzi: T[] }> {
  const groups = new Map<string, T[]>()
  for (const comanda of comenzi) {
    const key = dayOf(comanda.data_livrare) ?? ''
    const list = groups.get(key)
    if (list) list.push(comanda)
    else groups.set(key, [comanda])
  }
  return [...groups.entries()]
    .sort(([left], [right]) => (left || '9999').localeCompare(right || '9999'))
    .map(([day, list]) => ({ day: day || null, comenzi: [...list].sort(compareComenziForDay) }))
}

// ─── „Pune în livrare azi” ─────────────────────────────────────────────────────

/** Comenzile de pe „Azi” care nu sunt încă în livrare, cu prioritarele primele. */
export function deliveryCandidates<T extends DayComanda>(aziComenzi: readonly T[]): T[] {
  return aziComenzi.filter((comanda) => comanda.status !== 'in_livrare').sort(compareComenziForDay)
}

/** Ce e bifat la deschidere: doar prioritarele. Restul le alege fermierul, cât ajunge recolta. */
export function defaultDeliverySelection(candidates: readonly DayComanda[]): string[] {
  return candidates.filter((comanda) => comanda.prioritara === true).map((comanda) => comanda.id)
}

export interface DeliveryPlan {
  /** Kilogramele bifate. */
  selectedKg: number
  selectedCount: number
  /** Ce rămâne în stoc după comenzile bifate (negativ = bifele depășesc stocul). */
  remainingKg: number
  /** Comenzile nebifate care nu mai încap: id → câte kg lipsesc. */
  locked: Record<string, number>
  /** Prioritarele singure cer mai mult decât e în stoc. */
  prioritareExceedStock: boolean
  prioritareKg: number
  canSubmit: boolean
}

/**
 * Stocul rămas scade la fiecare bifă. O comandă nebifată care nu mai încape e blocată.
 * Garda reală e pe server (`set_comanda_in_delivery` → `STOC_INSUFICIENT`); aici doar o facem vizibilă.
 */
export function planDelivery(
  candidates: readonly DayComanda[],
  selectedIds: ReadonlySet<string> | readonly string[],
  stocDisponibilKg: number,
): DeliveryPlan {
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds as readonly string[])
  const stock = round2(Math.max(0, stocDisponibilKg))

  let selectedKg = 0
  let selectedCount = 0
  let prioritareKg = 0
  for (const comanda of candidates) {
    const kg = Number(comanda.cantitate_kg) || 0
    if (comanda.prioritara === true) prioritareKg += kg
    if (selected.has(comanda.id)) {
      selectedKg += kg
      selectedCount += 1
    }
  }
  selectedKg = round2(selectedKg)
  prioritareKg = round2(prioritareKg)
  const remainingKg = round2(stock - selectedKg)

  const locked: Record<string, number> = {}
  for (const comanda of candidates) {
    if (selected.has(comanda.id)) continue
    const kg = round2(Number(comanda.cantitate_kg) || 0)
    const missing = round2(kg - Math.max(0, remainingKg))
    if (missing > 0) locked[comanda.id] = missing
  }

  return {
    selectedKg,
    selectedCount,
    remainingKg,
    locked,
    prioritareExceedStock: prioritareKg > stock,
    prioritareKg,
    canSubmit: selectedCount > 0 && remainingKg >= 0,
  }
}

/** Eroarea serverului când stocul nu ajunge (`set_comanda_in_delivery`, `set_comanda_delivered`). */
export function parseStocInsuficient(error: unknown): { necesarKg: number; disponibilKg: number } | null {
  const raw = (error ?? {}) as { message?: string; details?: string; code?: string }
  const details = raw.details ?? ''
  const message = raw.message ?? ''
  if (!message.includes('STOC_INSUFICIENT') && !details.includes('necesar=') && !message.includes('necesar=')) {
    return null
  }
  const source = `${details} ${message}`
  const necesar = source.match(/necesar=([0-9]+(?:\.[0-9]+)?)/)
  const disponibil = source.match(/disponibil=([0-9]+(?:\.[0-9]+)?)/)
  return {
    necesarKg: round2(Number(necesar?.[1] ?? 0)),
    disponibilKg: round2(Number(disponibil?.[1] ?? 0)),
  }
}

// ─── Cantitatea din formular ───────────────────────────────────────────────────

/** Plăcile de cantitate din pasul 2 (kg). */
export const CANTITATI_KG = [2, 3, 4, 5, 6, 8, 10] as const

/** Localitatea, scurt, din adresa de livrare: prima parte până la virgulă. */
export function localitateScurta(adresa: string | null | undefined): string | null {
  const text = String(adresa ?? '').trim()
  if (!text) return null
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean)
  // „Str. Vișinilor 10, Burdujeni” → localitatea e ultima parte; o singură parte → chiar ea.
  return parts.length > 1 ? parts[parts.length - 1] : parts[0]
}
