export interface BucharestNowContext {
  nowIso: string
  nowLocalDate: string
  nowLocalDateTime: string
  timezone: 'Europe/Bucharest'
}

export function getTodayInBucharest(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
}

export function getYesterdayInBucharest(): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Bucharest' }))
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
}

export function getShiftedDayInBucharest(days: number): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Bucharest' }))
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
}

export function getBucharestNowContext(now: Date = new Date()): BucharestNowContext {
  const timezone = 'Europe/Bucharest' as const
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  const year = get('year')
  const month = get('month')
  const day = get('day')
  const hour = get('hour')
  const minute = get('minute')
  const second = get('second')
  const nowLocalDate = `${year}-${month}-${day}`
  const nowLocalDateTime = `${nowLocalDate} ${hour}:${minute}:${second}`
  return {
    nowIso: now.toISOString(),
    nowLocalDate,
    nowLocalDateTime,
    timezone,
  }
}
