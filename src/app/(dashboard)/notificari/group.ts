/**
 * Notificările pe grupuri de zile (Azi / Ieri / Săptămâna asta / Mai vechi) și ora din rând.
 * Zilele se socotesc după ora României.
 */

const TIME_ZONE = 'Europe/Bucharest'

export type DaySection<T> = { title: string; items: T[] }

/** `YYYY-MM-DD` în București. */
function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

/** Câte zile calendaristice (în București) sunt între `date` și `now`. 0 = azi. */
export function daysAgo(date: Date, now: Date = new Date()): number {
  const a = Date.parse(`${dayKey(date)}T00:00:00Z`)
  const b = Date.parse(`${dayKey(now)}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

export function sectionTitleFor(date: Date, now: Date = new Date()): string {
  const days = daysAgo(date, now)
  if (days <= 0) return 'Azi'
  if (days === 1) return 'Ieri'
  if (days < 7) return 'Săptămâna asta'
  return 'Mai vechi'
}

/** Lista vine deja ordonată (cele noi primele); grupurile păstrează ordinea. */
export function groupNotificationsByDay<T extends { created_at: string }>(items: T[], now: Date = new Date()): DaySection<T>[] {
  const sections: DaySection<T>[] = []
  for (const item of items) {
    const date = new Date(item.created_at)
    const title = Number.isNaN(date.getTime()) ? 'Mai vechi' : sectionTitleFor(date, now)
    const last = sections[sections.length - 1]
    if (last && last.title === title) last.items.push(item)
    else {
      const existing = sections.find((section) => section.title === title)
      if (existing) existing.items.push(item)
      else sections.push({ title, items: [item] })
    }
  }
  return sections
}

/** Azi și ieri: ora („07:10”). În ultima săptămână: ziua („luni”). Mai vechi: data („12 nov.”). */
export function notificationTimeLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const days = daysAgo(date, now)
  if (days <= 1) {
    return new Intl.DateTimeFormat('ro-RO', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
  }
  if (days < 7) {
    return new Intl.DateTimeFormat('ro-RO', { timeZone: TIME_ZONE, weekday: 'long' }).format(date)
  }
  return new Intl.DateTimeFormat('ro-RO', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' }).format(date)
}
