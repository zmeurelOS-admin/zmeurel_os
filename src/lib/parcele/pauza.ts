type ActivityPauseInput = {
  data_aplicare?: string | null
  timp_pauza_zile?: number | null
  produs_utilizat?: string | null
}

export type ParcelPauseStatus = {
  remainingDays: number
  products: string[]
}

export type PauseVisualTone = 'default' | 'danger' | 'warning'

function toDateOnly(value: string): Date | null {
  if (!value) return null
  const datePart = value.slice(0, 10)
  const [year, month, day] = datePart.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function normalizeToday(today?: Date): Date {
  const base = today ?? new Date()
  return new Date(base.getFullYear(), base.getMonth(), base.getDate())
}

function diffDays(start: Date, end: Date): number {
  const msInDay = 1000 * 60 * 60 * 24
  return Math.floor((end.getTime() - start.getTime()) / msInDay)
}

export function computeActivityRemainingDays(activity: ActivityPauseInput, today?: Date): number {
  const pauzaZile = Number(activity.timp_pauza_zile ?? 0)
  if (!Number.isFinite(pauzaZile) || pauzaZile <= 0) return 0

  const appliedDate = toDateOnly(activity.data_aplicare ?? '')
  if (!appliedDate) return 0

  const now = normalizeToday(today)
  const daysSince = Math.max(0, diffDays(appliedDate, now))
  return Math.max(0, pauzaZile - daysSince)
}

export function computeParcelPauseStatus(activities: ActivityPauseInput[], today?: Date): ParcelPauseStatus {
  const products = new Set<string>()
  let remainingDays = 0

  activities.forEach((activity) => {
    const activityRemainingDays = computeActivityRemainingDays(activity, today)
    if (activityRemainingDays <= 0) return

    remainingDays = Math.max(remainingDays, activityRemainingDays)
    const product = (activity.produs_utilizat ?? '').trim()
    if (product) products.add(product)
  })

  return {
    remainingDays,
    products: Array.from(products),
  }
}

export function getPauseVisualTone(remainingDays: number): PauseVisualTone {
  if (remainingDays <= 0) return 'default'
  if (remainingDays < 3) return 'warning'
  return 'danger'
}

/*
Deterministic examples (date-only math):

1) data_aplicare=2026-02-20, timp_pauza_zile=7, today=2026-02-25
   days_since=5 -> remaining=2

2) data_aplicare=2026-02-20, timp_pauza_zile=5, today=2026-02-25
   days_since=5 -> remaining=0

3) Two activities on same parcel:
   A: remaining=2, B: remaining=4 -> parcel remaining=4 (max)
*/
