import type { Json } from '@/types/supabase'

export type ShopOrderStatus = 'noua' | 'confirmata' | 'in_livrare' | 'livrata' | 'anulata'

export type ShopOrderMilestoneReward = {
  reward_label: string
  status: 'pending' | 'validated'
}

export type ShopOrderRow = {
  id: string
  created_at: string
  customer_name: string
  customer_phone: string
  delivery_mode: string
  delivery_address: string | null
  delivery_city?: string | null
  in_suceava?: boolean | null
  delivery_date: string | null
  delivery_position: number | null
  items: Json
  total_lei: number
  notes: string | null
  status: ShopOrderStatus
  notified_wa: boolean
  milestone_reward?: ShopOrderMilestoneReward | null
}

export function todayBucharestDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
  }).format(new Date())
}

function bucharestMidnightUtc(year: number, month: number, day: number): number {
  const desiredUtc = Date.UTC(year, month - 1, day)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const adjustGuess = (utcGuess: number) => {
    const values = Object.fromEntries(
      formatter.formatToParts(new Date(utcGuess)).map((part) => [part.type, part.value]),
    )
    const representedUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    )
    return utcGuess - (representedUtc - desiredUtc)
  }

  return adjustGuess(adjustGuess(desiredUtc))
}

export function getBucharestDayUtcRange(dateKey = todayBucharestDate()): {
  startIso: string
  endIso: string
} {
  const [year, month, day] = dateKey.split('-').map(Number)
  const startMs = bucharestMidnightUtc(year, month, day)
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1))
  const endMs = bucharestMidnightUtc(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth() + 1,
    nextDate.getUTCDate(),
  )

  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  }
}

type ShopOrderItem = {
  vid?: string
  label?: string
  qty?: number
  price_lei?: number
}

export function formatLei(value: number) {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(value)
}

export function formatOrderDate(iso: string) {
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(iso))
}

export function waUrlForPhone(phone: string) {
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')
  const normalized = digits.startsWith('40') ? digits : `40${digits.replace(/^0/, '')}`
  return `https://wa.me/${normalized}`
}

export function formatItemsHuman(items: Json): string {
  if (!Array.isArray(items)) return '—'
  return items
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null
      const row = raw as ShopOrderItem
      const label = row.label ?? row.vid ?? 'Produs'
      const qty = typeof row.qty === 'number' ? row.qty : 1
      return `${label} × ${qty}`
    })
    .filter(Boolean)
    .join(', ')
}

function parseOrderItems(items: Json): ShopOrderItem[] {
  if (!Array.isArray(items)) return []
  return items
    .map((raw) => (raw && typeof raw === 'object' ? (raw as ShopOrderItem) : null))
    .filter((row): row is ShopOrderItem => row !== null)
}

function hasAddress(order: ShopOrderRow): boolean {
  return typeof order.delivery_address === 'string' && order.delivery_address.trim().length > 0
}

export function buildLivrareWaMessage(order: ShopOrderRow): string {
  const productLines = parseOrderItems(order.items).map((row) => {
    const label = row.label ?? row.vid ?? 'Produs'
    const qty = typeof row.qty === 'number' ? row.qty : 1
    const unitPrice = typeof row.price_lei === 'number' ? row.price_lei : 0
    return `• ${label} × ${qty} — ${formatLei(unitPrice * qty)} lei`
  })

  const productsBlock = productLines.length > 0 ? productLines.join('\n') : '• —'
  const customerName = order.customer_name.trim()
  const totalLine = `Total: ${formatLei(order.total_lei)} lei (numerar)`

  const closingBlock = hasAddress(order)
    ? `Dacă aveți modificări (cantitate, adresă, oră), vă rugăm să ne scrieți la acest mesaj.`
    : `Vă rugăm să ne comunicați adresa de livrare răspunzând la acest mesaj.
Dacă aveți și alte modificări (cantitate, oră), ne puteți scrie tot aici.`

  return `Bună ziua, ${customerName}! 🍓
Comanda dvs. este programată pentru livrare astăzi.

Ce primiți:
${productsBlock}

${totalLine}

${closingBlock}

— Ferma Zmeurel, Văratec 📍`
}

export function buildLivrareWaUrl(order: ShopOrderRow): string {
  return `${waUrlForPhone(order.customer_phone)}?text=${encodeURIComponent(buildLivrareWaMessage(order))}`
}

export type DeliverySummaryLine = {
  vid: string
  label: string
  qty: number
}

export function buildDeliverySummary(orders: ShopOrderRow[]) {
  const byVid = new Map<string, DeliverySummaryLine>()
  let totalLei = 0

  for (const order of orders) {
    totalLei += order.total_lei
    for (const row of parseOrderItems(order.items)) {
      const vid = row.vid ?? row.label ?? 'produs'
      const label = row.label ?? row.vid ?? 'Produs'
      const qty = typeof row.qty === 'number' ? row.qty : 1
      const existing = byVid.get(vid)
      if (existing) {
        existing.qty += qty
      } else {
        byVid.set(vid, { vid, label, qty })
      }
    }
  }

  return {
    lines: [...byVid.values()],
    totalLei,
  }
}
