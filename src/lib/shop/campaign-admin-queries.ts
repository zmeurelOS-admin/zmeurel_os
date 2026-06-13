import type { ShopOrderRow } from '@/lib/shop/b2c-order-helpers'

export type CampaignAdminLeaderboardEntry = {
  rang: number
  customerName: string
  customerPhone: string
  city: string | null
  totalQty: number
  orderCount: number
  totalLei: number
  lastOrderAt: string
  finalPrize: string | null
}

export type CampaignAdminMilestoneStatus =
  | 'unreached'
  | 'pending'
  | 'validated'
  | 'cancelled'
  | 'voided'

export type CampaignAdminMilestone = {
  id: string
  threshold: number
  rewardLabel: string
  reached: boolean
  reachedAt: string | null
  rewardStatus: CampaignAdminMilestoneStatus
  winnerName: string | null
  winnerPhone: string | null
}

export type CampaignAdminTotals = {
  orderCount: number
  totalQty: number
  totalLei: number
}

export type CampaignAdminDailySummary = CampaignAdminTotals & {
  date: string
}

export type CampaignAdminDeliverySummary = CampaignAdminTotals & {
  mode: 'livrare' | 'ridicare'
}

export type CampaignAdminZoneSummary = {
  zone: 'suceava' | 'exterior' | 'unclassified'
  orderCount: number
  totalQty: number
}

export type CampaignAdminStatusSummary = {
  status: string
  orderCount: number
}

export type CampaignAdminPayload = {
  campaign: {
    id: string
    slug: string
    title: string
    currentCount: number
    targetQty: number
    status: string
  }
  leaderboard: CampaignAdminLeaderboardEntry[]
  milestones: CampaignAdminMilestone[]
  activeTotals: CampaignAdminTotals
  dailySummary: CampaignAdminDailySummary[]
  deliverySummary: CampaignAdminDeliverySummary[]
  zoneSummary: CampaignAdminZoneSummary[]
  statusSummary: CampaignAdminStatusSummary[]
}

type MutableLeaderboardEntry = Omit<
  CampaignAdminLeaderboardEntry,
  'rang' | 'finalPrize' | 'customerName'
> & {
  customerName: string
}

function quantityFromItems(items: ShopOrderRow['items']): number {
  if (!Array.isArray(items)) return 0

  return items.reduce<number>((total, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return total
    const qty = Number((item as Record<string, unknown>).qty)
    return Number.isFinite(qty) ? total + qty : total
  }, 0)
}

function bucharestDateKey(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function aggregateLeaderboard(
  orders: ShopOrderRow[],
): CampaignAdminLeaderboardEntry[] {
  const byPhone = new Map<string, MutableLeaderboardEntry>()

  for (const order of orders) {
    const phone = order.customer_phone.trim()
    if (!phone) continue

    const current = byPhone.get(phone)
    const customerName = order.customer_name.trim()
    const city = order.delivery_city?.trim() || null

    if (!current) {
      byPhone.set(phone, {
        customerName,
        customerPhone: phone,
        city,
        totalQty: quantityFromItems(order.items),
        orderCount: 1,
        totalLei: Number(order.total_lei) || 0,
        lastOrderAt: order.created_at,
      })
      continue
    }

    current.totalQty += quantityFromItems(order.items)
    current.orderCount += 1
    current.totalLei += Number(order.total_lei) || 0
    if (!current.customerName && customerName) current.customerName = customerName
    if (!current.city && city) current.city = city
    if (order.created_at > current.lastOrderAt) current.lastOrderAt = order.created_at
  }

  return [...byPhone.values()]
    .sort(
      (left, right) =>
        right.totalQty - left.totalQty ||
        left.lastOrderAt.localeCompare(right.lastOrderAt) ||
        left.customerPhone.localeCompare(right.customerPhone),
    )
    .map((entry, index) => ({
      ...entry,
      customerName: entry.customerName || entry.customerPhone,
      rang: index + 1,
      finalPrize: null,
    }))
}

export function summarizeLeaderboard(
  leaderboard: CampaignAdminLeaderboardEntry[],
): CampaignAdminTotals {
  return leaderboard.reduce<CampaignAdminTotals>(
    (totals, entry) => ({
      orderCount: totals.orderCount + entry.orderCount,
      totalQty: totals.totalQty + entry.totalQty,
      totalLei: totals.totalLei + entry.totalLei,
    }),
    { orderCount: 0, totalQty: 0, totalLei: 0 },
  )
}

export function aggregateOrdersByDay(
  orders: ShopOrderRow[],
): CampaignAdminDailySummary[] {
  const byDate = new Map<string, CampaignAdminTotals>()

  for (const order of orders) {
    const date = bucharestDateKey(order.created_at)
    const current = byDate.get(date) ?? { orderCount: 0, totalQty: 0, totalLei: 0 }
    current.orderCount += 1
    current.totalQty += quantityFromItems(order.items)
    current.totalLei += Number(order.total_lei) || 0
    byDate.set(date, current)
  }

  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, totals]) => ({ date, ...totals }))
}

export function aggregateOrdersByDeliveryMode(
  orders: ShopOrderRow[],
): CampaignAdminDeliverySummary[] {
  const summaries: Record<'livrare' | 'ridicare', CampaignAdminTotals> = {
    livrare: { orderCount: 0, totalQty: 0, totalLei: 0 },
    ridicare: { orderCount: 0, totalQty: 0, totalLei: 0 },
  }

  for (const order of orders) {
    const mode = order.delivery_mode === 'ridicare' ? 'ridicare' : 'livrare'
    summaries[mode].orderCount += 1
    summaries[mode].totalQty += quantityFromItems(order.items)
    summaries[mode].totalLei += Number(order.total_lei) || 0
  }

  return (['livrare', 'ridicare'] as const).map((mode) => ({
    mode,
    ...summaries[mode],
  }))
}

export function aggregateOrdersByZone(
  orders: ShopOrderRow[],
): CampaignAdminZoneSummary[] {
  const summaries: Record<CampaignAdminZoneSummary['zone'], Omit<CampaignAdminZoneSummary, 'zone'>> = {
    suceava: { orderCount: 0, totalQty: 0 },
    exterior: { orderCount: 0, totalQty: 0 },
    unclassified: { orderCount: 0, totalQty: 0 },
  }

  for (const order of orders) {
    const zone =
      order.in_suceava === true
        ? 'suceava'
        : order.in_suceava === false
          ? 'exterior'
          : 'unclassified'
    summaries[zone].orderCount += 1
    summaries[zone].totalQty += quantityFromItems(order.items)
  }

  return (['suceava', 'exterior', 'unclassified'] as const).map((zone) => ({
    zone,
    ...summaries[zone],
  }))
}

export function aggregateOrderStatuses(
  orders: Array<Pick<ShopOrderRow, 'status'>>,
): CampaignAdminStatusSummary[] {
  const knownStatuses = ['noua', 'confirmata', 'in_livrare', 'livrata', 'anulata']
  const counts = new Map(knownStatuses.map((status) => [status, 0]))

  for (const order of orders) {
    counts.set(order.status, (counts.get(order.status) ?? 0) + 1)
  }

  return [...counts.entries()].map(([status, orderCount]) => ({ status, orderCount }))
}

export function assignFinalPrizes(
  leaderboard: CampaignAdminLeaderboardEntry[],
): CampaignAdminLeaderboardEntry[] {
  return leaderboard.map((entry) => {
    let finalPrize: string | null = null

    if (entry.rang === 1) {
      finalPrize = '2 kg zmeură + miere + jeleu de zmeure'
    } else if (entry.rang === 2) {
      finalPrize = '1 kg zmeură + miere'
    } else if (entry.rang === 3) {
      finalPrize = '1 kg zmeură'
    } else if (entry.rang <= 10) {
      finalPrize = 'Voucher sezon următor'
    }

    return { ...entry, finalPrize }
  })
}
