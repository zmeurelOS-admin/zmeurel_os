import type { DashboardAttentionItem } from '@/components/dashboard/DashboardV2Sections'
import type { DashboardTaskItem } from '@/components/dashboard/TaskList'
import type { DashboardAlert, ParcelAttentionFlag } from '@/lib/dashboard/engine'

export type AttentionParcelSlice = {
  parcelaId: string
  displayName: string
  attentionFlags: ParcelAttentionFlag[]
}

type AttentionConcern = 'meteo' | 'orders' | 'stock' | 'treatments' | 'pause' | 'parcels' | 'other'

type AttentionCandidate = {
  id: string
  concern: AttentionConcern
  priority: number
  sourceRank: number
  item: DashboardAttentionItem
}

type BuildAttentionNowItemsInput = {
  alerts: DashboardAlert[]
  /** Folosit doar pentru deduplicare față de „Ce ai de făcut azi” / alert-uri duplicate. */
  tasks: DashboardTaskItem[]
  parcelAttentionItems: AttentionParcelSlice[]
  recommendationIds: Set<string>
  /** Când există cardul V2 „Următorul tratament”, nu repeta același semnal în „Atenție azi”. */
  hasNextTreatmentSuggestionCard?: boolean
}

const MAX_ATTENTION_ITEMS = 4

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function alertTone(alert: DashboardAlert): DashboardAttentionItem['tone'] {
  if (alert.severity === 'critical') return 'critical'
  if (alert.severity === 'warning') return 'warning'
  return 'info'
}

function alertHref(alert: DashboardAlert): string | undefined {
  if (alert.category === 'comenzi') return '/comenzi'
  if (alert.category === 'stoc') return '/stocuri'
  if (alert.category === 'tratamente') return '/tratamente'
  if (alert.category === 'parcele') return '/parcele'
  return undefined
}

function alertDetail(alert: DashboardAlert): string | undefined {
  if (alert.category === 'comenzi') return 'Verifică livrările și statusurile active.'
  if (alert.category === 'stoc') return 'Confirmă produsele care au ajuns aproape de limită.'
  if (alert.category === 'tratamente') return 'Deschide hub-ul Protecție & Nutriție pentru detalii.'
  if (alert.category === 'parcele') return 'Uită-te la terenurile care cer încă o verificare.'
  if (alert.category === 'meteo') return 'Ține cont de condițiile de astăzi înainte de tratamente.'
  return undefined
}

function alertBadge(alert: DashboardAlert): string {
  if (alert.severity === 'critical') return 'Critic'
  if (alert.severity === 'warning') return 'Azi'
  return 'Info'
}

function priorityFromAlert(alert: DashboardAlert): { concern: AttentionConcern; priority: number } {
  if (alert.category === 'meteo') return { concern: 'meteo', priority: 100 }
  if (alert.category === 'comenzi') return { concern: 'orders', priority: 90 }
  if (alert.category === 'stoc') return { concern: 'stock', priority: 80 }
  if (alert.category === 'tratamente') return { concern: 'treatments', priority: 70 }
  if (alert.id === 'alert:pauza-activa') return { concern: 'pause', priority: 62 }
  if (alert.category === 'parcele') return { concern: 'parcels', priority: 55 }
  return { concern: 'other', priority: 40 }
}

function alertDuplicatedByOperationalTask(alert: DashboardAlert, taskIds: Set<string>): boolean {
  if (alert.id === 'alert:comenzi-restante') return taskIds.has('comenzi:restante')
  if (alert.id === 'alert:stoc-critic') return taskIds.has('stoc:critic')
  if (alert.id === 'alert:tratamente-depasite') {
    return [...taskIds].some((id) => id.startsWith('tratament:'))
  }
  if (alert.id === 'alert:pauza-activa') return taskIds.has('pauza:activa')
  return false
}

function concernCoveredByRecommendations(
  concern: AttentionConcern,
  recIds: Set<string>,
  hasNextTreatmentSuggestionCard?: boolean,
): boolean {
  if (concern === 'meteo') return true
  switch (concern) {
    case 'orders':
      return (
        recIds.has('rec-orders-overdue') ||
        recIds.has('rec-orders-today') ||
        recIds.has('rec-orders-tomorrow')
      )
    case 'stock':
      return recIds.has('rec-stock-low')
    case 'treatments':
      return (
        Boolean(hasNextTreatmentSuggestionCard) ||
        recIds.has('rec-treatment-alerts') ||
        recIds.has('rec-parcel-treatment') ||
        recIds.has('rec-next-treatment')
      )
    case 'pause':
      return recIds.has('rec-pause')
    case 'parcels':
      return recIds.has('rec-parcel-idle')
    default:
      return false
  }
}

function buildParcelCandidate(
  parcel: AttentionParcelSlice,
  taskIds: Set<string>,
): AttentionCandidate | null {
  // Parcel attention flags rămân doar ca fallback legacy atunci când dashboard-ul
  // nu are încă semnal V2 pentru Tratamente.
  if (parcel.attentionFlags.includes('treatment_overdue')) {
    if (taskIds.has(`tratament:${parcel.parcelaId}`)) return null
    return {
      id: `parcel:treatment-overdue:${normalizeKey(parcel.displayName)}`,
      concern: 'treatments',
      priority: 71,
      sourceRank: 3,
      item: {
        id: `parcel:treatment-overdue:${normalizeKey(parcel.displayName)}`,
        label: `Tratament urgent: ${parcel.displayName}`,
        detail: 'Există semnale de tratament întârziat pe această parcelă.',
        tone: 'warning',
        badge: 'Azi',
        href: '/tratamente',
      },
    }
  }

  if (parcel.attentionFlags.includes('treatment_due_soon')) {
    return {
      id: `parcel:treatment-soon:${normalizeKey(parcel.displayName)}`,
      concern: 'treatments',
      priority: 68,
      sourceRank: 3,
      item: {
        id: `parcel:treatment-soon:${normalizeKey(parcel.displayName)}`,
        label: `Tratament aproape scadent: ${parcel.displayName}`,
        detail: 'Planifică intervenția înainte să intre în întârziere.',
        tone: 'info',
        badge: 'Info',
        href: '/tratamente',
      },
    }
  }

  if (parcel.attentionFlags.includes('pause_active')) {
    if (taskIds.has('pauza:activa')) return null
    return {
      id: `parcel:pause:${normalizeKey(parcel.displayName)}`,
      concern: 'pause',
      priority: 61,
      sourceRank: 3,
      item: {
        id: `parcel:pause:${normalizeKey(parcel.displayName)}`,
        label: `Pauză activă: ${parcel.displayName}`,
        detail: 'Respectă intervalul de pauză înainte de următorul tratament.',
        tone: 'warning',
        badge: 'Azi',
        href: '/tratamente',
      },
    }
  }

  if (parcel.attentionFlags.includes('no_recent_activity')) {
    if (taskIds.has('parcele:fara-activitate')) return null
    return {
      id: `parcel:inactive:${normalizeKey(parcel.displayName)}`,
      concern: 'parcels',
      priority: 50,
      sourceRank: 3,
      item: {
        id: `parcel:inactive:${normalizeKey(parcel.displayName)}`,
        label: `Fără activitate recentă: ${parcel.displayName}`,
        detail: 'Verifică terenul și confirmă următorul pas operațional.',
        tone: 'info',
        badge: 'Info',
        href: '/parcele',
      },
    }
  }

  return null
}

/**
 * Construiește item-urile pentru cardul „Atenție azi”.
 * Prioritate: meteo nefavorabil -> comenzi -> stoc -> tratamente/parcele -> pauze -> rest.
 * Deduplicare: o singură intrare pe concern major + dedupe text.
 * Nu include task-uri operaționale (sunt în „Ce ai de făcut azi”) și exclude meteo (card Meteo).
 */
export function buildAttentionNowItems(input: BuildAttentionNowItemsInput): DashboardAttentionItem[] {
  const { alerts, tasks, parcelAttentionItems, recommendationIds, hasNextTreatmentSuggestionCard } = input
  const candidates: AttentionCandidate[] = []
  const taskIds = new Set(tasks.map((t) => t.id))

  for (const alert of alerts) {
    if (alert.category === 'meteo') continue
    if (alertDuplicatedByOperationalTask(alert, taskIds)) continue
    const { concern, priority } = priorityFromAlert(alert)
    candidates.push({
      id: `alert:${alert.id}`,
      concern,
      priority,
      sourceRank: 1,
      item: {
        id: alert.id,
        label: alert.message,
        detail: alertDetail(alert),
        tone: alertTone(alert),
        badge: alertBadge(alert),
        href: alertHref(alert),
      },
    })
  }

  for (const parcel of parcelAttentionItems) {
    const parcelCandidate = buildParcelCandidate(parcel, taskIds)
    if (parcelCandidate) candidates.push(parcelCandidate)
  }

  if (candidates.length === 0) return []

  const byConcern = new Map<AttentionConcern, AttentionCandidate>()
  for (const candidate of candidates) {
    const previous = byConcern.get(candidate.concern)
    if (!previous) {
      byConcern.set(candidate.concern, candidate)
      continue
    }
    const shouldReplace =
      candidate.priority > previous.priority ||
      (candidate.priority === previous.priority && candidate.sourceRank < previous.sourceRank)
    if (shouldReplace) byConcern.set(candidate.concern, candidate)
  }

  const sorted = [...byConcern.values()]
    .filter((c) => !concernCoveredByRecommendations(c.concern, recommendationIds, hasNextTreatmentSuggestionCard))
    .sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority
      if (a.sourceRank !== b.sourceRank) return a.sourceRank - b.sourceRank
      return a.id.localeCompare(b.id)
    })

  const seenLabels = new Set<string>()
  const result: DashboardAttentionItem[] = []
  for (const candidate of sorted) {
    const labelKey = normalizeKey(candidate.item.label)
    if (seenLabels.has(labelKey)) continue
    seenLabels.add(labelKey)
    result.push(candidate.item)
    if (result.length >= MAX_ATTENTION_ITEMS) break
  }

  return result
}
