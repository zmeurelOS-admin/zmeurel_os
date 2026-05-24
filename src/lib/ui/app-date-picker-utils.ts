/** Parsare/format fără conversii UTC — păstrează ziua calendaristică din string. */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const ISO_DATE_TIME_RE = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/

export type AppDatePickerMode = 'date' | 'datetime'

export function parseIsoDateOnly(value: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE_RE.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return { year, month, day }
}

export function toIsoDateOnly(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseDateTimeLocalValue(value: string): { date: string; time: string } | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = ISO_DATE_TIME_RE.exec(trimmed)
  if (!match) {
    const dateOnly = parseIsoDateOnly(trimmed)
    if (!dateOnly) return null
    return { date: toIsoDateOnly(dateOnly.year, dateOnly.month, dateOnly.day), time: '00:00' }
  }
  const time = match[2] && match[3] ? `${match[2]}:${match[3]}` : '00:00'
  return { date: match[1], time }
}

export function toDateTimeLocalValue(date: string, time: string): string {
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) ? time : '00:00'
  return `${date}T${normalizedTime}`
}

export function formatDateDisplayRo(value: string): string {
  const parsed = parseIsoDateOnly(value) ?? parseDateTimeLocalValue(value)?.date
  if (!parsed) return ''
  const parts = typeof parsed === 'string' ? parseIsoDateOnly(parsed) : parsed
  if (!parts) return ''
  return `${String(parts.day).padStart(2, '0')}.${String(parts.month).padStart(2, '0')}.${parts.year}`
}

export function formatDateTimeDisplayRo(value: string): string {
  const parsed = parseDateTimeLocalValue(value)
  if (!parsed) return formatDateDisplayRo(value)
  return `${formatDateDisplayRo(parsed.date)}, ${parsed.time}`
}

export function getLocalTodayIsoDate(): string {
  const now = new Date()
  return toIsoDateOnly(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function getLocalNowDateTimeValue(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${toIsoDateOnly(now.getFullYear(), now.getMonth() + 1, now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export function localDateFromParts(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function localDateFromIsoDate(value: string): Date | null {
  const parsed = parseIsoDateOnly(value)
  if (!parsed) return null
  return localDateFromParts(parsed.year, parsed.month, parsed.day)
}

export function isSameIsoDate(a: string, b: string): boolean {
  const pa = parseIsoDateOnly(a)
  const pb = parseIsoDateOnly(b)
  if (!pa || !pb) return false
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day
}
