import type { Comanda, ComandaStatus } from '@/lib/supabase/queries/comenzi'
import type { Client } from '@/lib/supabase/queries/clienti'
import {
  formatItemsHuman,
  type ShopOrderRow,
  type ShopOrderStatus,
} from '@/lib/shop/b2c-order-helpers'
import { LOCALITIES, type DeliveryZone } from '@/lib/shop/delivery-zones'

export type UnifiedOrderSource = 'b2b' | 'shop'
export type UnifiedOrderSort = 'created_at' | 'delivery_date' | 'locality'

export type UnifiedOrderItem = {
  id: string
  source: UnifiedOrderSource
  createdAt: string
  deliveryDate: string | null
  customerName: string
  phone: string
  productsLabel: string
  quantity: number
  quantityUnit: 'kg' | 'caserole'
  totalLei: number
  deliveryLabel: string
  addressShort: string
  localityLabel: string
  deliveryZone: DeliveryZone
  status: string
  statusLabel: string
  confirmed: boolean
  b2bComanda?: Comanda
  shopOrder?: ShopOrderRow
}

export type UnifiedOrderGroup = {
  date: string | null
  orders: UnifiedOrderItem[]
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

function normalizeLocation(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('ro-RO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function inferLocation(value: string | null | undefined): {
  localityLabel: string
  deliveryZone: DeliveryZone
} {
  const raw = (value ?? '').trim()
  if (!raw) return { localityLabel: 'Necunoscută', deliveryZone: 'zona4' }
  if (normalizeLocation(raw).includes('ridicare')) {
    return { localityLabel: 'Ridicare Văratec', deliveryZone: 'ridicare' }
  }

  const normalized = normalizeLocation(raw)
  for (const locality of LOCALITIES) {
    for (const village of locality.villages ?? []) {
      if (normalized.includes(normalizeLocation(village.name))) {
        return { localityLabel: village.name, deliveryZone: village.zone }
      }
    }
    if (normalized.includes(normalizeLocation(locality.name))) {
      return { localityLabel: locality.name, deliveryZone: locality.zone }
    }
  }

  return {
    localityLabel: raw.split(',')[0]?.trim() || raw,
    deliveryZone: 'zona4',
  }
}

export function mapB2bToUnified(comanda: Comanda, clientMap: Record<string, Client>): UnifiedOrderItem {
  const cantitateKg = Number(comanda.cantitate_kg || 0)
  const pretPerKg = Number(comanda.pret_per_kg || 0)
  const totalLei = Number(comanda.total || cantitateKg * Number(comanda.pret_per_kg || 0))
  const location = inferLocation(comanda.locatie_livrare)
  const productsLabel =
    (comanda.observatii ?? '').trim() ||
    `${formatNumberRo(cantitateKg)} kg · ${formatLeiRo(pretPerKg)} lei/kg · Total ${formatLeiRo(totalLei)} lei`

  return {
    id: comanda.id,
    source: 'b2b',
    createdAt: comanda.created_at,
    deliveryDate: comanda.data_livrare,
    customerName: getB2bClientName(comanda, clientMap),
    phone: (comanda.telefon ?? '').trim(),
    productsLabel,
    quantity: cantitateKg,
    quantityUnit: 'kg',
    totalLei,
    deliveryLabel: comanda.data_livrare ? `Livrare ${formatDateShort(comanda.data_livrare)}` : 'Livrare',
    addressShort: truncateAddress(comanda.locatie_livrare),
    localityLabel: location.localityLabel,
    deliveryZone: location.deliveryZone,
    status: comanda.status,
    statusLabel: B2B_STATUS_LABELS[comanda.status] ?? comanda.status,
    confirmed: false,
    b2bComanda: comanda,
  }
}

export function mapShopToUnified(order: ShopOrderRow): UnifiedOrderItem {
  const deliveryLabel = order.delivery_mode === 'livrare' ? 'Livrare' : 'Ridicare'
  const quantity = getShopOrderQuantity(order)
  const fallbackLocation = inferLocation(order.delivery_city || order.delivery_address)
  return {
    id: order.id,
    source: 'shop',
    createdAt: order.created_at,
    deliveryDate: order.delivery_date,
    customerName: order.customer_name,
    phone: order.customer_phone.trim(),
    productsLabel: formatItemsHuman(order.items),
    quantity,
    quantityUnit: 'caserole',
    totalLei: order.total_lei,
    deliveryLabel,
    addressShort: truncateAddress(order.delivery_address),
    localityLabel:
      order.delivery_mode === 'ridicare'
        ? 'Ridicare Văratec'
        : order.delivery_city?.trim() || fallbackLocation.localityLabel,
    deliveryZone:
      order.delivery_mode === 'ridicare'
        ? 'ridicare'
        : order.delivery_zone ?? fallbackLocation.deliveryZone,
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
): Array<{ date: string | null; orders: ShopOrderRow[]; totalQty: number }> {
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

const ZONE_ORDER: Record<DeliveryZone, number> = {
  zona1: 1,
  zona2: 2,
  zona3: 3,
  zona4: 4,
  ridicare: 5,
}

function compareCreatedAt(a: UnifiedOrderItem, b: UnifiedOrderItem): number {
  return a.createdAt.localeCompare(b.createdAt)
}

function compareDeliveryDate(a: UnifiedOrderItem, b: UnifiedOrderItem): number {
  if (!a.deliveryDate && !b.deliveryDate) return compareCreatedAt(a, b)
  if (!a.deliveryDate) return 1
  if (!b.deliveryDate) return -1
  return a.deliveryDate.localeCompare(b.deliveryDate) || compareCreatedAt(a, b)
}

function compareLocality(a: UnifiedOrderItem, b: UnifiedOrderItem): number {
  return (
    ZONE_ORDER[a.deliveryZone] - ZONE_ORDER[b.deliveryZone] ||
    a.localityLabel.localeCompare(b.localityLabel, 'ro-RO') ||
    compareCreatedAt(a, b)
  )
}

export function groupAllOrdersByDeliveryDate(
  orders: UnifiedOrderItem[],
  sort: UnifiedOrderSort = 'created_at',
): UnifiedOrderGroup[] {
  if (sort === 'locality') {
    const byZone = new Map<DeliveryZone, UnifiedOrderItem[]>()
    for (const order of [...orders].sort(compareLocality)) {
      const current = byZone.get(order.deliveryZone) ?? []
      current.push(order)
      byZone.set(order.deliveryZone, current)
    }

    return [...byZone.entries()]
      .sort(([zoneA], [zoneB]) => ZONE_ORDER[zoneA] - ZONE_ORDER[zoneB])
      .map(([zone, groupedOrders]) => ({
        date: `zone:${zone}`,
        orders: groupedOrders,
        totalQty: groupedOrders.reduce((total, order) => total + order.quantity, 0),
      }))
  }

  const comparator = sort === 'delivery_date' ? compareDeliveryDate : compareCreatedAt
  const byDate = new Map<string, UnifiedOrderItem[]>()
  const unscheduled: UnifiedOrderItem[] = []

  for (const order of [...orders].sort(comparator)) {
    if (!order.deliveryDate) {
      unscheduled.push(order)
      continue
    }
    const current = byDate.get(order.deliveryDate) ?? []
    current.push(order)
    byDate.set(order.deliveryDate, current)
  }

  const scheduled = [...byDate.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, groupedOrders]) => ({
      date,
      orders: groupedOrders,
      totalQty: groupedOrders.reduce((total, order) => total + order.quantity, 0),
    }))
  const unscheduledGroup = unscheduled.length
    ? [{
        date: null,
        orders: unscheduled,
        totalQty: unscheduled.reduce((total, order) => total + order.quantity, 0),
      }]
    : []

  return sort === 'delivery_date'
    ? [...scheduled, ...unscheduledGroup]
    : [...unscheduledGroup, ...scheduled]
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
  const parts = new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Europe/Bucharest',
  }).formatToParts(new Date(iso))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const month = String(values.month ?? '').replace('.', '')
  return `${values.day} ${month} · ${values.hour}:${values.minute}`
}
