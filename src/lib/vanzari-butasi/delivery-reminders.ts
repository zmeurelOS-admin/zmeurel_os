// Mementouri pentru livrarea comenzilor de material săditor.
// - cu o zi înainte, pentru orice comandă activă cu dată de livrare;
// - cu o săptămână înainte, doar pentru comenzile cu termen îndepărtat
//   (livrarea e la cel puțin 14 zile după data comenzii, ex. comenzi de toamnă pentru primăvară).
// Logică pură (fără DB), ca să poată fi testată.

export type ReminderKind = 'maine' | 'saptamana'

export interface ReminderOrderInput {
  id: string
  tenant_id: string
  client_id: string | null
  client_nume_manual: string | null
  data_comanda: string | null
  data_livrare_estimata: string | null
  status: string
  total_lei: number | null
  avans_suma: number | null
  items: Array<{ soi: string; cantitate: number }>
}

export interface TenantReminder {
  tenantId: string
  kind: ReminderKind
  deliveryDate: string
  orderIds: string[]
  /** Cheie de deduplicare: aceeași notificare nu se trimite de două ori în aceeași zi. */
  reminderKey: string
  title: string
  body: string
}

/** Câte zile trebuie să fie între comandă și livrare ca să primești și mementoul cu o săptămână înainte. */
export const LONG_LEAD_MIN_DAYS = 14

export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function todayInBucharest(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })
}

function formatLeiShort(value: number): string {
  return `${Math.round(value).toLocaleString('ro-RO')} lei`
}

function formatDeliveryDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

function describeOrder(order: ReminderOrderInput, clientName: string): string {
  const items = order.items.map((it) => `${it.soi} ${Number(it.cantitate || 0)}`).join(', ')
  const rest = Math.max(0, Number(order.total_lei || 0) - Number(order.avans_suma || 0))
  const restLabel = rest > 0 ? ` · rest ${formatLeiShort(rest)}` : ''
  return `${clientName}${items ? ` — ${items} buc` : ''}${restLabel}`
}

const isActive = (status: string) => status !== 'livrata' && status !== 'anulata'

export function buildDeliveryReminders(
  orders: ReminderOrderInput[],
  clientNames: Map<string, string>,
  today: string,
): TenantReminder[] {
  const tomorrow = addDaysYmd(today, 1)
  const inAWeek = addDaysYmd(today, 7)
  const groups = new Map<string, { tenantId: string; kind: ReminderKind; date: string; orders: ReminderOrderInput[] }>()

  for (const order of orders) {
    if (!isActive(order.status)) continue
    const delivery = order.data_livrare_estimata?.slice(0, 10)
    if (!delivery) continue

    let kind: ReminderKind | null = null
    if (delivery === tomorrow) kind = 'maine'
    else if (delivery === inAWeek) {
      const ordered = order.data_comanda?.slice(0, 10)
      if (ordered && ordered <= addDaysYmd(delivery, -LONG_LEAD_MIN_DAYS)) kind = 'saptamana'
    }
    if (!kind) continue

    const key = `${order.tenant_id}|${kind}|${delivery}`
    const group = groups.get(key) ?? { tenantId: order.tenant_id, kind, date: delivery, orders: [] }
    group.orders.push(order)
    groups.set(key, group)
  }

  return [...groups.values()].map((group) => {
    const name = (o: ReminderOrderInput) =>
      (o.client_id ? clientNames.get(o.client_id) : null) ?? o.client_nume_manual?.trim() ?? 'Client'
    const count = group.orders.length
    const when = group.kind === 'maine' ? 'Mâine' : 'Peste o săptămână'
    const title =
      count === 1 ? `${when} livrezi butași` : `${when} ai ${count} livrări de butași`

    const shown = group.orders.slice(0, 3).map((o) => describeOrder(o, name(o)))
    const more = count > 3 ? ` și încă ${count - 3}` : ''
    const prefix = group.kind === 'saptamana' ? `${formatDeliveryDay(group.date)}: ` : ''
    const body = `${prefix}${shown.join('; ')}${more}.`

    return {
      tenantId: group.tenantId,
      kind: group.kind,
      deliveryDate: group.date,
      orderIds: group.orders.map((o) => o.id),
      reminderKey: `butasi:${group.kind}:${group.date}`,
      title,
      body,
    }
  })
}
