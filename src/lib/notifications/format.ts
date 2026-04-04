/** Timp relativ scurt în română (UI notificări). */
export function formatRelativeRo(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'

  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'acum'
  if (diffMin < 60) return `acum ${diffMin} min`

  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `acum ${diffH} h`

  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)
  const startYesterday = new Date(startToday)
  startYesterday.setDate(startYesterday.getDate() - 1)

  if (d >= startYesterday && d < startToday) return 'ieri'

  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
}
