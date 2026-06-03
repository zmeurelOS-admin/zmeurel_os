import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getBadgeColor, getCustomerLabel } from '@/lib/shop/customer-labels'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdOrNull } from '@/lib/tenant/get-tenant'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type RangeDays = 30 | 90 | 365

type CustomerRow = {
  id: string
  name: string | null
  phone: string
  default_delivery_city: string | null
  acquisition_source: string | null
  order_count: number | null
  total_value_lei: number | null
  avg_order_value_lei: number | null
  first_order_at: string | null
  last_order_at: string | null
}

type OrderRow = {
  delivery_city: string | null
  total_lei: number
  created_at: string
}

function parseRange(value: string | string[] | undefined): RangeDays {
  const raw = Array.isArray(value) ? value[0] : value
  if (raw === '90') return 90
  if (raw === '365') return 365
  return 30
}

function formatLei(value: number): string {
  return `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(value)} lei`
}

function sourceLabel(value: string | null): string {
  switch (value) {
    case 'facebook':
      return 'Facebook'
    case 'instagram':
      return 'Instagram'
    case 'recomandare':
      return 'Recomandare'
    case 'google':
      return 'Google'
    case 'altceva':
      return 'Altceva'
    default:
      return 'Necunoscut'
  }
}

function countBy<T extends string>(values: T[]): Array<{ key: T; count: number }> {
  const counts = new Map<T, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

export default async function AnalyticsMagazinPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = (await searchParams) ?? {}
  const rangeDays = parseRange(params.range)
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString()

  const supabase = await createClient()
  const tenantId = await getTenantIdOrNull(supabase)

  if (!tenantId) {
    redirect('/login')
  }

  const [customersResult, ordersResult] = await Promise.all([
    supabase
      .from('shop_customers')
      .select(
        'id,name,phone,default_delivery_city,acquisition_source,order_count,total_value_lei,avg_order_value_lei,first_order_at,last_order_at',
      )
      .eq('tenant_id', tenantId)
      .limit(1000),
    supabase
      .from('shop_orders')
      .select('delivery_city,total_lei,created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5000),
  ])

  if (customersResult.error) throw customersResult.error
  if (ordersResult.error) throw ordersResult.error

  const customers = (customersResult.data ?? []) as CustomerRow[]
  const orders = (ordersResult.data ?? []) as OrderRow[]
  const customersInRange = customers.filter((customer) => {
    const firstOrderAt = customer.first_order_at ? new Date(customer.first_order_at).getTime() : 0
    const lastOrderAt = customer.last_order_at ? new Date(customer.last_order_at).getTime() : 0
    const sinceMs = new Date(since).getTime()
    return firstOrderAt >= sinceMs || lastOrderAt >= sinceMs
  })

  const totalSales = orders.reduce((sum, order) => sum + (order.total_lei ?? 0), 0)
  const averageOrderValue = orders.length > 0 ? Math.round(totalSales / orders.length) : 0
  const newCustomers = customers.filter((customer) => {
    if (!customer.first_order_at) return false
    return new Date(customer.first_order_at).getTime() >= new Date(since).getTime()
  }).length
  const recurringCustomers = customers.filter((customer) => (customer.order_count ?? 0) >= 2).length

  const topCities = countBy(
    orders.map((order) => (order.delivery_city?.trim() || 'Necunoscut') as string),
  ).slice(0, 5)
  const topCustomers = [...customersInRange]
    .sort((a, b) => (b.total_value_lei ?? 0) - (a.total_value_lei ?? 0))
    .slice(0, 10)
  const acquisitionSources = countBy(customers.map((customer) => sourceLabel(customer.acquisition_source)))

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
            Magazin public
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Analytics magazin
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
            Indicatori simpli, calculați server-side din clienți și comenzi.
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          {[30, 90, 365].map((days) => (
            <Link
              key={days}
              href={`/analytics-magazin?range=${days}`}
              className={cn(
                'flex-1 rounded-full border px-3 py-2 text-center text-xs font-bold sm:flex-none',
                rangeDays === days
                  ? 'border-[var(--success-border)] bg-[var(--success-surface)] text-[var(--success-text)]'
                  : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]',
              )}
            >
              {days} zile
            </Link>
          ))}
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total clienți unici" value={String(customers.length)} />
        <StatCard label="Clienți noi" value={String(newCustomers)} />
        <StatCard label="Clienți recurenți" value={String(recurringCustomers)} />
        <StatCard label="Valoare medie comandă" value={formatLei(averageOrderValue)} />
        <StatCard label="Total vânzări" value={formatLei(totalSales)} />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-3">
        <SimpleTable title="Top localități" empty="Nu există comenzi în interval.">
          {topCities.map((city) => (
            <TableRow key={city.key} label={city.key} value={`${city.count} comenzi`} />
          ))}
        </SimpleTable>

        <SimpleTable title="Top clienți" empty="Nu există clienți în interval.">
          {topCustomers.map((customer) => {
            const label = getCustomerLabel(customer)
            return (
              <div
                key={customer.id}
                className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[var(--text-primary)]">
                    {customer.name || customer.phone}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{formatLei(customer.total_value_lei ?? 0)}</p>
                </div>
                <span className={cn('rounded-full border px-2 py-1 text-xs font-bold', getBadgeColor(label))}>
                  {label}
                </span>
              </div>
            )
          })}
        </SimpleTable>

        <SimpleTable title="Surse achiziție" empty="Nu există surse salvate.">
          {acquisitionSources.map((source) => (
            <TableRow key={source.key} label={source.key} value={`${source.count} clienți`} />
          ))}
        </SimpleTable>
      </section>
    </main>
  )
}

function SimpleTable({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: React.ReactNode
}) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : []

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)]">
      <h2 className="border-b border-[var(--border-default)] px-4 py-3 text-sm font-extrabold text-[var(--text-primary)]">
        {title}
      </h2>
      {rows.length > 0 ? rows : <p className="px-4 py-6 text-sm text-[var(--text-secondary)]">{empty}</p>}
    </div>
  )
}

function TableRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3 last:border-b-0">
      <span className="min-w-0 truncate text-sm font-semibold text-[var(--text-primary)]">{label}</span>
      <span className="shrink-0 text-sm text-[var(--text-secondary)]">{value}</span>
    </div>
  )
}
