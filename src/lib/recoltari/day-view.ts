/**
 * Recoltări, pagina unei zile: totaluri, insignele culegătorilor, valori implicite și
 * protecția la dublare. Funcții pure, fără React și fără acces la bază.
 */
import { getRecoltareTotalKg, type Recoltare } from '@/lib/supabase/queries/recoltari'

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

function dayOf(recoltare: Pick<Recoltare, 'data'>): string {
  return String(recoltare.data ?? '').slice(0, 10)
}

/** Recoltările unei zile (`2026-11-19`). */
export function recoltariOfDay(recoltari: readonly Recoltare[], dayIso: string): Recoltare[] {
  return recoltari.filter((recoltare) => dayOf(recoltare) === dayIso)
}

export interface RecoltariDaySummary {
  totalKg: number
  cal1Kg: number
  cal2Kg: number
  paymentLei: number
  /** Culegători diferiți; recoltările fără culegător nu se numără. */
  workerCount: number
  harvestCount: number
}

/** Totalurile cardului de sus, pentru recoltările primite (deja filtrate pe zi). */
export function summarizeRecoltariDay(dayRecoltari: readonly Recoltare[]): RecoltariDaySummary {
  const workers = new Set<string>()
  let cal1Kg = 0
  let cal2Kg = 0
  let totalKg = 0
  let paymentLei = 0

  for (const recoltare of dayRecoltari) {
    cal1Kg += Math.max(0, Number(recoltare.kg_cal1) || 0)
    cal2Kg += Math.max(0, Number(recoltare.kg_cal2) || 0)
    totalKg += getRecoltareTotalKg(recoltare)
    paymentLei += Number(recoltare.valoare_munca_lei) || 0
    if (recoltare.culegator_id) workers.add(recoltare.culegator_id)
  }

  return {
    totalKg: round2(totalKg),
    cal1Kg: round2(cal1Kg),
    cal2Kg: round2(cal2Kg),
    paymentLei: round2(paymentLei),
    workerCount: workers.size,
    harvestCount: dayRecoltari.length,
  }
}

/** Kilogramele notate în ziua respectivă, pe culegător (pentru insigna „✓ azi N kg”). */
export function kgByCulegator(dayRecoltari: readonly Recoltare[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const recoltare of dayRecoltari) {
    if (!recoltare.culegator_id) continue
    totals[recoltare.culegator_id] = round2((totals[recoltare.culegator_id] ?? 0) + getRecoltareTotalKg(recoltare))
  }
  return totals
}

/** Parcela ultimei recoltări salvate (după momentul creării), dintre cele care mai există. */
export function lastUsedParcelaId(
  recoltari: readonly Recoltare[],
  existingParcelaIds?: ReadonlySet<string>,
): string | null {
  let latest: Recoltare | null = null
  for (const recoltare of recoltari) {
    if (!recoltare.parcela_id) continue
    if (existingParcelaIds && !existingParcelaIds.has(recoltare.parcela_id)) continue
    if (!latest || String(recoltare.created_at ?? '') > String(latest.created_at ?? '')) latest = recoltare
  }
  return latest?.parcela_id ?? null
}

export interface WorkerNameParts {
  /** Litera din cercul plăcii. */
  initial: string
  /** Primul cuvânt (rândul mare al plăcii). */
  first: string
  /** Restul numelui (rândul mic); gol dacă numele are un singur cuvânt. */
  rest: string
}

export function splitWorkerName(fullName: string | null | undefined): WorkerNameParts {
  const words = String(fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { initial: '?', first: 'Fără nume', rest: '' }
  const [first, ...others] = words
  return { initial: first.charAt(0).toLocaleUpperCase('ro-RO'), first, rest: others.join(' ') }
}

/** Plata estimată: kg × tarif. `null` când culegătorul nu are tarif (serverul ar refuza salvarea). */
export function estimatePaymentLei(totalKg: number, tarifLeiKg: number | null | undefined): number | null {
  if (tarifLeiKg === null || tarifLeiKg === undefined) return null
  const tarif = Number(tarifLeiKg)
  if (!Number.isFinite(tarif) || tarif < 0) return null
  return round2(Math.max(0, totalKg) * tarif)
}

export interface RecoltareAttempt {
  culegator_id: string
  parcela_id: string
  data: string
  kg_cal1: number
  kg_cal2: number
}

/**
 * Protecția la dublare, fără cheie pe server: după o trimitere rămasă fără răspuns, caută o recoltare
 * apărută între timp (id necunoscut înainte de prima trimitere) care are exact datele trimise.
 * Dacă există, trimiterea a ajuns de fapt la server și nu se mai repetă.
 * Compară id-uri, nu ore: ceasul telefonului poate fi decalat față de al serverului.
 */
export function findNewMatchingRecoltare(params: {
  recoltari: readonly Recoltare[]
  knownIds: ReadonlySet<string>
  attempt: RecoltareAttempt
}): Recoltare | null {
  const { recoltari, knownIds, attempt } = params
  const candidates = recoltari.filter(
    (recoltare) =>
      !knownIds.has(recoltare.id) &&
      recoltare.culegator_id === attempt.culegator_id &&
      recoltare.parcela_id === attempt.parcela_id &&
      dayOf(recoltare) === attempt.data &&
      round2(recoltare.kg_cal1) === round2(attempt.kg_cal1) &&
      round2(recoltare.kg_cal2) === round2(attempt.kg_cal2),
  )
  if (candidates.length === 0) return null
  return candidates.reduce((latest, current) =>
    String(current.created_at ?? '') > String(latest.created_at ?? '') ? current : latest,
  )
}

/** Ce a salvat serverul diferă de ce s-a trimis (ex. aceeași cheie, kilograme schimbate între încercări). */
export function savedDiffersFromAttempt(saved: Recoltare, attempt: RecoltareAttempt): boolean {
  return (
    saved.culegator_id !== attempt.culegator_id ||
    saved.parcela_id !== attempt.parcela_id ||
    dayOf(saved) !== attempt.data ||
    round2(saved.kg_cal1) !== round2(attempt.kg_cal1) ||
    round2(saved.kg_cal2) !== round2(attempt.kg_cal2)
  )
}

// ─── Afișare ───────────────────────────────────────────────────────────────────

function shiftIsoDay(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day + days, 12)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Ziua, pe scurt, pentru pastila de dată: „Azi, 19 nov.”, „Ieri, 18 nov.”, „17 nov.”. */
export function shortDayLabel(iso: string, todayIso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  const short = new Date(year, month - 1, day, 12).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
  if (iso === todayIso) return `Azi, ${short}`
  if (iso === shiftIsoDay(todayIso, -1)) return `Ieri, ${short}`
  return short
}

/** 27.35 → „27,35”; 12 → „12”. Fără unitate. */
export function formatKgValue(value: number): string {
  return round2(value).toLocaleString('ro-RO', { maximumFractionDigits: 2 })
}

/** 27.35 → „27,35 kg”. */
export function formatKg(value: number): string {
  return `${formatKgValue(value)} kg`
}

/** 68.375 → „68,38 lei”; 50 → „50,00 lei”. */
export function formatLei(value: number): string {
  return `${round2(value).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`
}

/** 2.5 → „2,50 lei/kg”. */
export function formatTarif(value: number): string {
  return `${round2(value).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei/kg`
}
