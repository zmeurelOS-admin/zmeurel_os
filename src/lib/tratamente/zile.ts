/**
 * Zilele din modulul Tratamente: totul pe zile calendaristice, în ora României.
 * Fără React și fără Supabase (se folosește și pe server, și în teste).
 */

export const FUS_ORAR_RO = 'Europe/Bucharest'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Ziua (`YYYY-MM-DD`) în București.
 * - o zi simplă (`2026-07-15`, coloanele `date`) rămâne cum e;
 * - un moment (`timestamptz`: `2026-07-15T22:30:00+00`) se mută în ora României (aici: 16 iulie).
 * `null` pentru text gol sau nevalid.
 */
export function ziuaRo(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (ISO_DAY.test(trimmed)) return trimmed
    // PostgREST întoarce `2026-07-15 22:30:00+00`; `Date.parse` vrea `T`.
    const normalized = trimmed.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
    const time = Date.parse(normalized)
    if (!Number.isFinite(time)) return null
    return formatZiRo(new Date(time))
  }
  if (!Number.isFinite(value.getTime())) return null
  return formatZiRo(value)
}

function formatZiRo(moment: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUS_ORAR_RO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(moment)
}

/** Azi, în București. */
export function aziRo(now: Date = new Date()): string {
  return formatZiRo(now)
}

/** `2026-07-15` + 3 → `2026-07-18`. */
export function adaugaZile(ziua: string, zile: number): string {
  const [y, m, d] = ziua.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + zile)
  return date.toISOString().slice(0, 10)
}

/** Câte zile de la `de` la `pana` (negativ = în urmă). */
export function zileIntre(de: string, pana: string): number {
  const a = Date.UTC(Number(de.slice(0, 4)), Number(de.slice(5, 7)) - 1, Number(de.slice(8, 10)))
  const b = Date.UTC(Number(pana.slice(0, 4)), Number(pana.slice(5, 7)) - 1, Number(pana.slice(8, 10)))
  return Math.round((b - a) / 86_400_000)
}

const ZILE = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'] as const

/** „vineri 18.07” (ca în mockup). */
export function ziCuDataRo(ziua: string): string {
  const [y, m, d] = ziua.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${ZILE[weekday]} ${d}.${String(m).padStart(2, '0')}`
}

/** „Vineri 18.07”. */
export function ZiCuDataRo(ziua: string): string {
  const text = ziCuDataRo(ziua)
  return text.charAt(0).toLocaleUpperCase('ro-RO') + text.slice(1)
}

/** „Azi”, „Ieri”, „Mâine”, altfel „Marți 15.07”. */
export function ziRelativaRo(ziua: string, azi: string): string {
  const diff = zileIntre(azi, ziua)
  if (diff === 0) return 'Azi'
  if (diff === -1) return 'Ieri'
  if (diff === 1) return 'Mâine'
  return ZiCuDataRo(ziua)
}

/** „1 zi”, „3 zile”, „20 de zile”. */
export function zileText(n: number): string {
  if (n === 1) return '1 zi'
  const rest = Math.abs(n) % 100
  return `${n} ${n !== 0 && (rest === 0 || rest >= 20) ? 'de ' : ''}zile`
}
