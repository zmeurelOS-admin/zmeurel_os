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

export function assignFinalPrizes(
  leaderboard: CampaignAdminLeaderboardEntry[],
): CampaignAdminLeaderboardEntry[] {
  return leaderboard.map((entry) => {
    let finalPrize: string | null = null

    if (entry.rang === 1) {
      finalPrize = '2 kg zmeură + jeleu + miere Zmeurel'
    } else if (entry.rang === 2) {
      finalPrize = '1 kg zmeură + jeleu'
    } else if (entry.rang === 3) {
      finalPrize = '1 kg zmeură'
    } else if (entry.rang <= 10) {
      finalPrize = 'Voucher sezon următor'
    }

    return { ...entry, finalPrize }
  })
}
