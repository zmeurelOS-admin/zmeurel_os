import type { Json } from '@/types/supabase'

export type ShopOrderStatus = 'noua' | 'confirmata' | 'in_livrare' | 'livrata' | 'anulata'

export type ShopOrderRow = {
  id: string
  created_at: string
  customer_name: string
  customer_phone: string
  delivery_mode: string
  delivery_address: string | null
  items: Json
  total_lei: number
  notes: string | null
  status: ShopOrderStatus
  notified_wa: boolean
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

export function buildLivrareWaMessage(order: ShopOrderRow): string {
  const productLines = parseOrderItems(order.items).map((row) => {
    const label = row.label ?? row.vid ?? 'Produs'
    const qty = typeof row.qty === 'number' ? row.qty : 1
    const unitPrice = typeof row.price_lei === 'number' ? row.price_lei : 0
    return `• ${label} × ${qty} — ${formatLei(unitPrice * qty)} lei`
  })

  const productsBlock = productLines.length > 0 ? productLines.join('\n') : '• —'
  const address = order.delivery_address?.trim() || '—'

  return `Bună ${order.customer_name.trim()}! 🍓
Comanda ta de la Zmeurel este în drum spre tine.

Ce urmează să primești:
${productsBlock}

Total de plată: ${formatLei(order.total_lei)} lei (cash sau Revolut)
Adresă: ${address}

Ne vedem în curând! 🚚
— Echipa Zmeurel`
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
