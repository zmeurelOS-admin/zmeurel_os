import { computeActivityRemainingDays } from '@/lib/parcele/pauza'

export type TimelineActivityRow = {
  id?: string
  parcela_id?: string | null
  data_aplicare?: string | null
  tip_activitate?: string | null
  produs_utilizat?: string | null
  timp_pauza_zile?: number | null
  created_at?: string | null
  updated_at?: string | null
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function toDateOnly(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10)
}

function parseIso(value: string | null | undefined): number {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function parseDateOnlyMs(value: string | null | undefined): number {
  const dateOnly = toDateOnly(value)
  if (!dateOnly) return 0
  const parsed = new Date(`${dateOnly}T12:00:00`).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

export function isTreatmentActivity(tipActivitate: string | null | undefined): boolean {
  const tip = normalize(tipActivitate)
  return (
    tip.includes('tratament') ||
    tip.includes('fungic') ||
    tip.includes('pestic') ||
    tip.includes('erbic') ||
    tip.includes('insecticid')
  )
}

export function compareActivityRecency(a: TimelineActivityRow, b: TimelineActivityRow): number {
  const byDateOnly = parseDateOnlyMs(b.data_aplicare) - parseDateOnlyMs(a.data_aplicare)
  if (byDateOnly !== 0) return byDateOnly

  const byCreated = parseIso(b.created_at) - parseIso(a.created_at)
  if (byCreated !== 0) return byCreated

  return parseIso(b.updated_at) - parseIso(a.updated_at)
}

export function buildLatestActivityByParcela<T extends TimelineActivityRow>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>()

  for (const row of rows) {
    const parcelaId = row.parcela_id ?? ''
    if (!parcelaId) continue

    const current = map.get(parcelaId)
    if (!current || compareActivityRecency(row, current) < 0) {
      map.set(parcelaId, row)
    }
  }

  return map
}

export function getActivityDaysAgo(
  row: Pick<TimelineActivityRow, 'data_aplicare'> | null | undefined,
  today: Date
): number | null {
  if (!row?.data_aplicare) return null
  const activityMs = parseDateOnlyMs(row.data_aplicare)
  if (!activityMs) return null
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return Math.floor((todayMs - activityMs) / (1000 * 60 * 60 * 24))
}

export function getActivityPauseRemainingDays(row: TimelineActivityRow, today: Date): number {
  if (!isTreatmentActivity(row.tip_activitate)) return 0
  return computeActivityRemainingDays(row, today)
}
