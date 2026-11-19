/**
 * Afișarea cifrelor și a zilelor în modulele refăcute (Comenzi, Livrări, Acasă, Clienți, Vânzări, Cheltuieli).
 * Funcții pure. Zilele sunt text ISO (`2026-11-19`), în ora locală a telefonului.
 */

export function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

/** 27.35 → „27,35”; 12 → „12”. */
export function formatNumber(value: number, maxDecimals = 2): string {
  return round2(value).toLocaleString('ro-RO', { maximumFractionDigits: maxDecimals })
}

/** 27.35 → „27,35 kg”; 12 → „12 kg”. */
export function formatKg(value: number): string {
  return `${formatNumber(value)} kg`
}

/** 105 → „105 lei”; 87.5 → „87,50 lei”. Zecimalele apar doar când există. */
export function formatLei(value: number): string {
  const rounded = round2(value)
  const whole = Number.isInteger(rounded)
  return `${rounded.toLocaleString('ro-RO', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })} lei`
}

/** 35 → „35 lei/kg”; 22.5 → „22,50 lei/kg”. */
export function formatLeiKg(value: number): string {
  return `${formatLei(value)}/kg`
}

function parseIso(iso: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
}

const pad = (value: number) => String(value).padStart(2, '0')

export function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Ziua aflată la `days` zile de `iso`. Text nevalid → neschimbat. */
export function shiftIso(iso: string, days: number): string {
  const date = parseIso(iso)
  if (!date) return iso
  date.setDate(date.getDate() + days)
  return toIso(date)
}

/** Câte zile sunt de la `fromIso` la `toIso` (negativ = în urmă). `null` dacă una nu e validă. */
export function daysBetween(fromIso: string, toIsoDay: string): number | null {
  const from = parseIso(fromIso)
  const to = parseIso(toIsoDay)
  if (!from || !to) return null
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/** „19 nov.” */
export function shortDateRo(iso: string | null | undefined): string {
  const date = parseIso(iso)
  if (!date) return '—'
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
}

/** „joi, 19 nov.” */
export function weekdayDateRo(iso: string | null | undefined): string {
  const date = parseIso(iso)
  if (!date) return '—'
  return date.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** „Azi”, „Mâine”, „Poimâine”, „Ieri”, altfel „joi, 19 nov.”. */
export function relativeDayRo(iso: string | null | undefined, todayIso: string): string {
  if (!iso) return 'Fără dată'
  const day = iso.slice(0, 10)
  const diff = daysBetween(todayIso, day)
  if (diff === 0) return 'Azi'
  if (diff === 1) return 'Mâine'
  if (diff === 2) return 'Poimâine'
  if (diff === -1) return 'Ieri'
  return weekdayDateRo(day)
}

/** „noiembrie 2026” */
export function monthYearRo(year: number, month: number): string {
  return new Date(year, month - 1, 1, 12).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })
}

/** Prima literă mare (numele lunilor și ale zilelor vin cu literă mică). */
export function capitalizeRo(text: string): string {
  return text.charAt(0).toLocaleUpperCase('ro-RO') + text.slice(1)
}

/** Inițialele unui nume: „Ion Popescu” → „IP”; un singur cuvânt → prima literă. */
export function initialsOf(name: string | null | undefined): string {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0].charAt(0)
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : ''
  return (first + last).toLocaleUpperCase('ro-RO')
}

/** Text fără diacritice și cu litere mici, pentru căutare. */
export function searchKey(value: string | null | undefined): string {
  return String(value ?? '')
    .toLocaleLowerCase('ro-RO')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/** Doar cifrele unui telefon, pentru căutare („0745 123” găsește „+40745123…”). */
export function phoneDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '')
}
