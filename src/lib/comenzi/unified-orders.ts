import type { Comanda, ComandaStatus } from '@/lib/supabase/queries/comenzi'
import type { Client } from '@/lib/supabase/queries/clienti'
import {
  formatItemsHuman,
  type ShopOrderRow,
  type ShopOrderStatus,
} from '@/lib/shop/b2c-order-helpers'

export type UnifiedOrderSource = 'b2b' | 'shop'

export type UnifiedOrderItem = {
  id: string
  source: UnifiedOrderSource
  createdAt: string
  customerName: string
  phone: string
  productsLabel: string
  totalLei: number
  deliveryLabel: string
  addressShort: string
  status: string
  statusLabel: string
  confirmed: boolean
  b2bComanda?: Comanda
  shopOrder?: ShopOrderRow
}

export type ShopOrderDeliveryGroup = {
  date: string | null
  orders: ShopOrderRow[]
  totalQty: number
}

export const SHOP_STATUS_LABELS: Record<ShopOrderStatus, string> = {
  noua: 'Nouă',
  confirmata: 'Confirmată',
  in_livrare: 'În livrare',
  livrata: 'Livrată',
  anulata: 'Anulată',
}

export const B2B_STATUS_LABELS: Record<ComandaStatus, string> = {
  noua: 'Nouă',
  confirmata: 'Confirmată',
  programata: 'Programată',
  in_livrare: 'În livrare',
  livrata: 'Livrată',
  anulata: 'Anulată',
}

export function getB2bClientName(comanda: Comanda, clientMap: Record<string, Client>): string {
  if (comanda.client_id && clientMap[comanda.client_id]) {
    return clientMap[comanda.client_id].nume_client
  }
  return comanda.client_nume || comanda.client_nume_manual || 'Client manual'
}

function truncateAddress(value: string | null | undefined, max = 48): string {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return '—'
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

export function mapB2bToUnified(comanda: Comanda, clientMap: Record<string, Client>): UnifiedOrderItem {
  const cantitateKg = Number(comanda.cantitate_kg || 0)
  const pretPerKg = Number(comanda.pret_per_kg || 0)
  const totalLei = Number(comanda.total || cantitateKg * Number(comanda.pret_per_kg || 0))
  const productsLabel =
    (comanda.observatii ?? '').trim() ||
    `${formatNumberRo(cantitateKg)} kg · ${formatLeiRo(pretPerKg)} lei/kg · Total ${formatLeiRo(totalLei)} lei`

  return {
    id: comanda.id,
    source: 'b2b',
    createdAt: comanda.created_at,
    customerName: getB2bClientName(comanda, clientMap),
    phone: (comanda.telefon ?? '').trim(),
    productsLabel,
    totalLei,
    deliveryLabel: comanda.data_livrare ? `Livrare ${formatDateShort(comanda.data_livrare)}` : 'Livrare',
    addressShort: truncateAddress(comanda.locatie_livrare),
    status: comanda.status,
    statusLabel: B2B_STATUS_LABELS[comanda.status] ?? comanda.status,
    confirmed: false,
    b2bComanda: comanda,
  }
}

export function mapShopToUnified(order: ShopOrderRow): UnifiedOrderItem {
  const deliveryLabel = order.delivery_mode === 'livrare' ? 'Livrare' : 'Ridicare'
  return {
    id: order.id,
    source: 'shop',
    createdAt: order.created_at,
    customerName: order.customer_name,
    phone: order.customer_phone.trim(),
    productsLabel: formatItemsHuman(order.items),
    totalLei: order.total_lei,
    deliveryLabel,
    addressShort: truncateAddress(order.delivery_address),
    status: order.status,
    statusLabel: SHOP_STATUS_LABELS[order.status] ?? order.status,
    confirmed: order.notified_wa,
    shopOrder: order,
  }
}

export function isUnifiedOpenStatus(status: string): boolean {
  return status !== 'livrata' && status !== 'anulata'
}

export function getShopOrderQuantity(order: ShopOrderRow): number {
  if (!Array.isArray(order.items)) return 0

  return order.items.reduce<number>((total, raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return total
    const qty = Number((raw as { qty?: unknown }).qty)
    return Number.isFinite(qty) && qty > 0 ? total + qty : total
  }, 0)
}

export function groupShopOrdersByDeliveryDate(
  orders: ShopOrderRow[],
): ShopOrderDeliveryGroup[] {
  const eligible = orders
    .filter((order) => order.order_kind === 'preorder' && order.status !== 'anulata')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const byDate = new Map<string, ShopOrderRow[]>()
  const unscheduled: ShopOrderRow[] = []

  for (const order of eligible) {
    if (!order.delivery_date) {
      unscheduled.push(order)
      continue
    }
    const current = byDate.get(order.delivery_date) ?? []
    current.push(order)
    byDate.set(order.delivery_date, current)
  }

  const toGroup = (date: string | null, groupedOrders: ShopOrderRow[]) => ({
    date,
    orders: groupedOrders,
    totalQty: groupedOrders.reduce((total, order) => total + getShopOrderQuantity(order), 0),
  })

  return [
    ...(unscheduled.length > 0 ? [toGroup(null, unscheduled)] : []),
    ...[...byDate.entries()]
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, groupedOrders]) => toGroup(date, groupedOrders)),
  ]
}

export function mergeUnifiedOrders(
  comenzi: Comanda[],
  shopOrders: ShopOrderRow[],
  clientMap: Record<string, Client>,
): UnifiedOrderItem[] {
  const merged = [
    ...comenzi.map((item) => mapB2bToUnified(item, clientMap)),
    ...shopOrders.map(mapShopToUnified),
  ]
  return merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

function formatDateShort(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('ro-RO')
}

function formatNumberRo(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatLeiRo(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

export function formatOrderDateTime(iso: string) {
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(iso))
}
