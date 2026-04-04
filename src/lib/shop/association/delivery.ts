/**
 * Livrare magazin asociație: miercuri, prag 150 lei, cutoff marți 12:00 Europe/Bucharest.
 */

export const DELIVERY_FEE_LEI = 15
export const FREE_DELIVERY_THRESHOLD_LEI = 150
export const TIMEZONE_BUCHAREST = 'Europe/Bucharest'

type Ymd = { y: number; m: number; d: number }

function bucharestYmdFromInstant(now: Date): Ymd {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BUCHAREST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

function dowFromYmd(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function addDaysToYmd(ymd: Ymd, add: number): Ymd {
  const t = Date.UTC(ymd.y, ymd.m - 1, ymd.d + add)
  const x = new Date(t)
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() }
}

function bucharestMinutesSinceMidnight(now: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE_BUCHAREST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const min = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return h * 60 + min
}

/**
 * Data calendaristică (YYYY-MM-DD) a următoarei livrări miercuri.
 * - Înainte de marți 12:00 → miercurea din aceeași „săptămână” de livrare.
 * - După marți 12:00 → miercurea din săptămâna următoare (nu cea imediat următoare dacă e deja trecută față de cutoff).
 */
export function getNextDeliveryDateIso(now: Date = new Date()): string {
  const ymd = bucharestYmdFromInstant(now)
  const dow = dowFromYmd(ymd.y, ymd.m, ymd.d)
  const mins = bucharestMinutesSinceMidnight(now)
  const beforeTuesdayNoon = dow === 1 || (dow === 2 && mins < 12 * 60)

  let addDays: number
  if (beforeTuesdayNoon) {
    if (dow === 1) addDays = 2
    else addDays = 1
  } else {
    const afterCutoff: Record<number, number> = {
      0: 3,
      2: 8,
      3: 7,
      4: 6,
      5: 5,
      6: 4,
    }
    addDays = afterCutoff[dow] ?? 7
  }

  const target = addDaysToYmd(ymd, addDays)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${target.y}-${pad(target.m)}-${pad(target.d)}`
}

/** Pentru teste / interop: instanță Date la miezul zilei UTC pentru eticheta ISO. */
export function getNextDeliveryDate(now: Date = new Date()): Date {
  const iso = getNextDeliveryDateIso(now)
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

export function getDeliveryFee(cartTotal: number): number {
  const t = Number(cartTotal) || 0
  return t >= FREE_DELIVERY_THRESHOLD_LEI ? 0 : DELIVERY_FEE_LEI
}

export function getAmountUntilFreeDelivery(cartTotal: number): number {
  const t = Number(cartTotal) || 0
  if (t >= FREE_DELIVERY_THRESHOLD_LEI) return 0
  return Math.max(0, Math.round((FREE_DELIVERY_THRESHOLD_LEI - t) * 100) / 100)
}

/** Ex: "miercuri, 9 aprilie 2026" */
export function formatDeliveryDateFromIso(isoYmd: string): string {
  const [y, m, d] = isoYmd.split('-').map(Number)
  if (!y || !m || !d) return isoYmd
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  return dt.toLocaleDateString('ro-RO', {
    timeZone: TIMEZONE_BUCHAREST,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
