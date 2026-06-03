import { redirect } from 'next/navigation'

import { getBadgeColor, getCustomerLabel } from '@/lib/shop/customer-labels'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdOrNull } from '@/lib/tenant/get-tenant'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type CustomerRow = {
  id: string
  name: string | null
  phone: string
  default_delivery_city: string | null
  order_count: number | null
  total_value_lei: number | null
  avg_order_value_lei: number | null
  last_order_at: string | null
}

function formatLei(value: number | null | undefined): string {
  return `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(value ?? 0)} lei`
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export default async function ClientiMagazinPage() {
  const supabase = await createClient()
  const tenantId = await getTenantIdOrNull(supabase)

  if (!tenantId) {
    redirect('/login')
  }

  const { data, error } = await supabase
    .from('shop_customers')
    .select(
      'id,name,phone,default_delivery_city,order_count,total_value_lei,avg_order_value_lei,last_order_at',
    )
    .eq('tenant_id', tenantId)
    .order('last_order_at', { ascending: false, nullsFirst: false })
    .limit(500)

  if (error) {
    throw error
  }

  const customers = (data ?? []) as CustomerRow[]

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
              Magazin public
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
              Clienți magazin
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
              Clienți anonimi identificați prin telefon, cu etichete calculate din comenzile existente.
            </p>
          </div>
          <span className="w-fit rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-1 text-xs font-bold text-[var(--text-secondary)]">
            {customers.length} clienți
          </span>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-[var(--border-default)]">
          <table className="min-w-[880px] w-full divide-y divide-[var(--border-default)] text-sm">
            <thead className="bg-[var(--surface-card-muted)] text-left text-xs font-bold uppercase tracking-wide text-[var(--text-tertiary)]">
              <tr>
                <th className="px-3 py-3">Nume</th>
                <th className="px-3 py-3">Telefon</th>
                <th className="px-3 py-3">Localitate</th>
                <th className="px-3 py-3 text-right">Comenzi</th>
                <th className="px-3 py-3 text-right">Total lei</th>
                <th className="px-3 py-3 text-right">Medie/comandă</th>
                <th className="px-3 py-3">Ultima comandă</th>
                <th className="px-3 py-3">Etichetă</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)] bg-[var(--surface-card)]">
              {customers.map((customer) => {
                const label = getCustomerLabel(customer)
                return (
                  <tr key={customer.id} className="text-[var(--text-primary)]">
                    <td className="px-3 py-3 font-semibold">{customer.name || '—'}</td>
                    <td className="px-3 py-3 tabular-nums text-[var(--text-secondary)]">{customer.phone}</td>
                    <td className="px-3 py-3 text-[var(--text-secondary)]">
                      {customer.default_delivery_city || '—'}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{customer.order_count ?? 0}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatLei(customer.total_value_lei)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatLei(customer.avg_order_value_lei)}
                    </td>
                    <td className="px-3 py-3 text-[var(--text-secondary)]">
                      {formatDate(customer.last_order_at)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2.5 py-1 text-xs font-bold',
                          getBadgeColor(label),
                        )}
                      >
                        {label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-sm text-[var(--text-secondary)]">
                    Încă nu există clienți salvați pentru magazin.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
