/**
 * Livrare magazin asociație: miercuri, prag 150 lei, cutoff marți 12:00 Europe/Bucharest.
 */

import {
  ASSOCIATION_DAY_IDS,
  ASSOCIATION_DAY_LABELS,
  DEFAULT_ASSOCIATION_SETTINGS,
  type AssociationDayId,
  type AssociationPublicSettings,
} from '@/lib/association/public-settings'

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

const DAY_TO_UTC_DOW: Record<AssociationDayId, number> = {
  luni: 1,
  marti: 2,
  miercuri: 3,
  joi: 4,
  vineri: 5,
  sambata: 6,
  duminica: 0,
}

function normalizeDeliveryDays(days?: readonly AssociationDayId[] | null): AssociationDayId[] {
  const normalized = [...new Set((days ?? []).filter((day): day is AssociationDayId => ASSOCIATION_DAY_IDS.includes(day)))]
  return normalized.length > 0 ? normalized : [...DEFAULT_ASSOCIATION_SETTINGS.deliveryDays]
}

function legacyWednesdayDeliveryDateIso(now: Date): string {
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

function isLegacyWednesdayOnlyConfig(days: readonly AssociationDayId[]): boolean {
  return days.length === 1 && days[0] === 'miercuri'
}

export function getAssociationDeliveryDays(settings?: Pick<AssociationPublicSettings, 'deliveryDays'> | null): AssociationDayId[] {
  return normalizeDeliveryDays(settings?.deliveryDays)
}

export function isAssociationDeliveryDayToday(
  settings?: Pick<AssociationPublicSettings, 'deliveryDays'> | null,
  now: Date = new Date(),
): boolean {
  const ymd = bucharestYmdFromInstant(now)
  const dow = dowFromYmd(ymd.y, ymd.m, ymd.d)
  return getAssociationDeliveryDays(settings).some((day) => DAY_TO_UTC_DOW[day] === dow)
}

export function getNextAssociationDeliveryDayId(
  settings?: Pick<AssociationPublicSettings, 'deliveryDays'> | null,
  now: Date = new Date(),
  options?: { includeToday?: boolean },
): AssociationDayId {
  const days = getAssociationDeliveryDays(settings)
  const ymd = bucharestYmdFromInstant(now)
  const dow = dowFromYmd(ymd.y, ymd.m, ymd.d)
  const startOffset = options?.includeToday ? 0 : 1

  for (let offset = startOffset; offset < 14; offset += 1) {
    const candidateDow = (dow + offset) % 7
    const dayId = days.find((day) => DAY_TO_UTC_DOW[day] === candidateDow)
    if (dayId) {
      return dayId
    }
  }

  return days[0] ?? DEFAULT_ASSOCIATION_SETTINGS.deliveryDays[0]
}

export function getNextAssociationDeliveryDayLabel(
  settings?: Pick<AssociationPublicSettings, 'deliveryDays'> | null,
  now: Date = new Date(),
  options?: { includeToday?: boolean },
): string {
  return ASSOCIATION_DAY_LABELS[getNextAssociationDeliveryDayId(settings, now, options)]
}

export function getAssociationDeliveryCutoffText(
  settings?: Pick<AssociationPublicSettings, 'deliveryCutoffText'> | null,
): string {
  return settings?.deliveryCutoffText?.trim() || DEFAULT_ASSOCIATION_SETTINGS.deliveryCutoffText
}

/**
 * Data calendaristică (YYYY-MM-DD) a următoarei livrări miercuri.
 * - Înainte de marți 12:00 → miercurea din aceeași „săptămână” de livrare.
 * - După marți 12:00 → miercurea din săptămâna următoare (nu cea imediat următoare dacă e deja trecută față de cutoff).
 */
export function getNextDeliveryDateIso(
  nowOrSettings?: Date | Pick<AssociationPublicSettings, 'deliveryDays'> | null,
  maybeNow?: Date,
): string {
  const now = nowOrSettings instanceof Date ? nowOrSettings : maybeNow ?? new Date()
  const settings = nowOrSettings instanceof Date ? null : nowOrSettings
  const deliveryDays = getAssociationDeliveryDays(settings)

  if (isLegacyWednesdayOnlyConfig(deliveryDays)) {
    return legacyWednesdayDeliveryDateIso(now)
  }

  const ymd = bucharestYmdFromInstant(now)
  const dow = dowFromYmd(ymd.y, ymd.m, ymd.d)
  let addDays = 1

  for (let offset = 1; offset < 14; offset += 1) {
    const candidateDow = (dow + offset) % 7
    if (deliveryDays.some((day) => DAY_TO_UTC_DOW[day] === candidateDow)) {
      addDays = offset
      break
    }
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
