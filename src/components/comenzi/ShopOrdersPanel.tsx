'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Phone } from 'lucide-react'

import { ErrorState } from '@/components/app/ErrorState'
import { EntityListSkeleton } from '@/components/app/ListSkeleton'
import { ModuleEmptyCard, ModulePillFilterButton, ModulePillRow } from '@/components/app/module-list-chrome'
import { Button } from '@/components/ui/button'
import { getSupabase } from '@/lib/supabase/client'
import { toast } from '@/lib/ui/toast'
import type { Json } from '@/types/supabase'

const SHOP_ORDERS_QUERY_KEY = ['shop_orders'] as const
const SHOP_NOTIFY_QUERY_KEY = ['shop_notify_requests'] as const

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

export type ShopNotifyRow = {
  id: string
  created_at: string
  customer_name: string
  customer_phone: string
  product_id: string
  product_name: string
  notified_at: string | null
}

type ShopPanelTab = 'comenzi' | 'anunta'

const STATUS_OPTIONS: ShopOrderStatus[] = [
  'noua',
  'confirmata',
  'in_livrare',
  'livrata',
  'anulata',
]

const STATUS_LABELS: Record<ShopOrderStatus, string> = {
  noua: 'Nouă',
  confirmata: 'Confirmată',
  in_livrare: 'În livrare',
  livrata: 'Livrată',
  anulata: 'Anulată',
}

const STATUS_BADGE: Record<ShopOrderStatus, { bg: string; text: string }> = {
  noua: { bg: '#F59E0B', text: '#92400E' },
  confirmata: { bg: '#3B82F6', text: '#1E3A8A' },
  in_livrare: { bg: '#F97316', text: '#7C2D12' },
  livrata: { bg: '#22C55E', text: '#14532D' },
  anulata: { bg: '#6B7280', text: '#F3F4F6' },
}

function formatOrderDate(iso: string) {
  return new Intl.DateTimeFormat('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Bucharest',
  }).format(new Date(iso))
}

function formatLei(value: number) {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(value)
}

function waUrlForPhone(phone: string) {
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')
  const normalized = digits.startsWith('40') ? digits : `40${digits.replace(/^0/, '')}`
  return `https://wa.me/${normalized}`
}

function formatItemsHuman(items: Json): string {
  if (!Array.isArray(items)) return '—'
  return items
    .map((raw) => {
      if (!raw || typeof raw !== 'object') return null
      const row = raw as { label?: string; vid?: string; qty?: number }
      const label = row.label ?? row.vid ?? 'Produs'
      const qty = typeof row.qty === 'number' ? row.qty : 1
      return `${label} × ${qty}`
    })
    .filter(Boolean)
    .join(' · ')
}

async function fetchShopOrders(): Promise<ShopOrderRow[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('shop_orders')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ShopOrderRow[]
}

async function fetchShopNotifyRequests(): Promise<ShopNotifyRow[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('shop_notify_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ShopNotifyRow[]
}

function StatusBadge({ status }: { status: ShopOrderStatus }) {
  const tone = STATUS_BADGE[status] ?? STATUS_BADGE.noua
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: tone.bg, color: tone.text }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function DeliveryBadge({ mode }: { mode: string }) {
  const isLivrare = mode === 'livrare'
  return (
    <span className="inline-flex rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
      {isLivrare ? '🚚 Livrare' : '🧺 Ridicare'}
    </span>
  )
}

export function ShopOrdersPanel() {
  const queryClient = useQueryClient()
  const [panelTab, setPanelTab] = useState<ShopPanelTab>('comenzi')

  const ordersQuery = useQuery({
    queryKey: SHOP_ORDERS_QUERY_KEY,
    queryFn: fetchShopOrders,
  })

  const notifyQuery = useQuery({
    queryKey: SHOP_NOTIFY_QUERY_KEY,
    queryFn: fetchShopNotifyRequests,
  })

  const patchOrderMutation = useMutation({
    mutationFn: async (input: { id: string; status?: ShopOrderStatus; notified_wa?: boolean }) => {
      const res = await fetch(`/api/shop/b2c/orders/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.notified_wa !== undefined ? { notified_wa: input.notified_wa } : {}),
        }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Actualizare eșuată')
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SHOP_ORDERS_QUERY_KEY })
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const patchNotifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/shop/b2c/notify/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notified_at: new Date().toISOString() }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Actualizare eșuată')
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SHOP_NOTIFY_QUERY_KEY })
      toast.success('Marcat ca notificat')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  return (
    <div className="flex flex-col gap-3">
      <ModulePillRow>
        <ModulePillFilterButton active={panelTab === 'comenzi'} onClick={() => setPanelTab('comenzi')}>
          Comenzi
        </ModulePillFilterButton>
        <ModulePillFilterButton active={panelTab === 'anunta'} onClick={() => setPanelTab('anunta')}>
          Anunță-mă
        </ModulePillFilterButton>
      </ModulePillRow>

      {panelTab === 'comenzi' ? (
        <ShopOrdersTab
          orders={ordersQuery.data ?? []}
          isLoading={ordersQuery.isLoading}
          isError={ordersQuery.isError}
          error={ordersQuery.error as Error | null}
          isUpdating={patchOrderMutation.isPending}
          onStatusChange={(id, status) => patchOrderMutation.mutate({ id, status })}
          onNotifiedWa={(id) => patchOrderMutation.mutate({ id, notified_wa: true })}
        />
      ) : (
        <ShopNotifyTab
          rows={notifyQuery.data ?? []}
          isLoading={notifyQuery.isLoading}
          isError={notifyQuery.isError}
          error={notifyQuery.error as Error | null}
          isUpdating={patchNotifyMutation.isPending}
          onMarkNotified={(id) => patchNotifyMutation.mutate(id)}
        />
      )}
    </div>
  )
}

function ShopOrdersTab({
  orders,
  isLoading,
  isError,
  error,
  isUpdating,
  onStatusChange,
  onNotifiedWa,
}: {
  orders: ShopOrderRow[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  isUpdating: boolean
  onStatusChange: (id: string, status: ShopOrderStatus) => void
  onNotifiedWa: (id: string) => void
}) {
  if (isLoading) return <EntityListSkeleton />
  if (isError) {
    return <ErrorState title="Eroare" message={error?.message ?? 'Nu am putut încărca comenzile shop.'} />
  }
  if (orders.length === 0) {
    return (
      <ModuleEmptyCard
        emoji="🛒"
        title="Nicio comandă shop"
        hint="Comenzile de pe /comanda apar aici după ce clienții finalizează formularul."
      />
    )
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {orders.map((order) => (
          <ShopOrderCard
            key={order.id}
            order={order}
            disabled={isUpdating}
            onStatusChange={onStatusChange}
            onNotifiedWa={onNotifiedWa}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] md:block">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-[var(--border-default)] bg-[var(--surface-card-muted)] text-xs font-semibold text-[var(--text-tertiary)]">
            <tr>
              <th className="px-3 py-2.5">Data</th>
              <th className="px-3 py-2.5">Client</th>
              <th className="px-3 py-2.5">Produse</th>
              <th className="px-3 py-2.5">Total</th>
              <th className="px-3 py-2.5">Livrare</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <ShopOrderTableRow
                key={order.id}
                order={order}
                disabled={isUpdating}
                onStatusChange={onStatusChange}
                onNotifiedWa={onNotifiedWa}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ShopOrderCard({
  order,
  disabled,
  onStatusChange,
  onNotifiedWa,
}: {
  order: ShopOrderRow
  disabled: boolean
  onStatusChange: (id: string, status: ShopOrderStatus) => void
  onNotifiedWa: (id: string) => void
}) {
  return (
    <article className="rounded-[22px] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[var(--text-primary)]">{order.customer_name}</p>
          <a
            href={`tel:${order.customer_phone.replace(/\s/g, '')}`}
            className="mt-0.5 inline-flex items-center gap-1 text-sm text-[var(--info-text)]"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden />
            {order.customer_phone}
          </a>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <p className="mt-2 text-xs text-[var(--text-tertiary)]">{formatOrderDate(order.created_at)}</p>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{formatItemsHuman(order.items)}</p>
      <p className="mt-2 text-base font-bold tabular-nums text-[var(--text-primary)]">
        {formatLei(order.total_lei)} lei
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <DeliveryBadge mode={order.delivery_mode} />
        {order.notified_wa ? (
          <span className="text-xs font-medium text-[var(--success-text)]">Notificat WA</span>
        ) : null}
      </div>

      {order.delivery_mode === 'livrare' && order.delivery_address ? (
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">{order.delivery_address}</p>
      ) : null}

      <ShopOrderActions
        order={order}
        disabled={disabled}
        onStatusChange={onStatusChange}
        onNotifiedWa={onNotifiedWa}
        className="mt-4"
      />
    </article>
  )
}

function ShopOrderTableRow({
  order,
  disabled,
  onStatusChange,
  onNotifiedWa,
}: {
  order: ShopOrderRow
  disabled: boolean
  onStatusChange: (id: string, status: ShopOrderStatus) => void
  onNotifiedWa: (id: string) => void
}) {
  return (
    <tr className="border-b border-[var(--border-default)] last:border-0">
      <td className="px-3 py-3 align-top text-xs text-[var(--text-tertiary)]">
        {formatOrderDate(order.created_at)}
      </td>
      <td className="px-3 py-3 align-top">
        <p className="font-semibold text-[var(--text-primary)]">{order.customer_name}</p>
        <a href={`tel:${order.customer_phone.replace(/\s/g, '')}`} className="text-xs text-[var(--info-text)]">
          {order.customer_phone}
        </a>
      </td>
      <td className="max-w-[220px] px-3 py-3 align-top text-sm text-[var(--text-secondary)]">
        {formatItemsHuman(order.items)}
      </td>
      <td className="px-3 py-3 align-top font-bold tabular-nums">{formatLei(order.total_lei)} lei</td>
      <td className="px-3 py-3 align-top">
        <DeliveryBadge mode={order.delivery_mode} />
      </td>
      <td className="px-3 py-3 align-top">
        <StatusBadge status={order.status} />
      </td>
      <td className="px-3 py-3 align-top text-right">
        <ShopOrderActions
          order={order}
          disabled={disabled}
          onStatusChange={onStatusChange}
          onNotifiedWa={onNotifiedWa}
          compact
        />
      </td>
    </tr>
  )
}

function ShopOrderActions({
  order,
  disabled,
  onStatusChange,
  onNotifiedWa,
  className = '',
  compact = false,
}: {
  order: ShopOrderRow
  disabled: boolean
  onStatusChange: (id: string, status: ShopOrderStatus) => void
  onNotifiedWa: (id: string) => void
  className?: string
  compact?: boolean
}) {
  return (
    <div className={`flex flex-col gap-2 ${compact ? 'items-end' : ''} ${className}`}>
      <select
        value={order.status}
        disabled={disabled}
        onChange={(e) => onStatusChange(order.id, e.target.value as ShopOrderStatus)}
        className="w-full max-w-[200px] rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] px-2 py-1.5 text-xs font-medium"
        aria-label="Schimbă statusul comenzii"
      >
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      <div className={`flex flex-wrap gap-2 ${compact ? 'justify-end' : ''}`}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          disabled={disabled}
          onClick={() => window.open(waUrlForPhone(order.customer_phone), '_blank', 'noopener,noreferrer')}
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          WhatsApp
        </Button>
        {!order.notified_wa ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9"
            disabled={disabled}
            onClick={() => onNotifiedWa(order.id)}
          >
            Notificat WA
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function ShopNotifyTab({
  rows,
  isLoading,
  isError,
  error,
  isUpdating,
  onMarkNotified,
}: {
  rows: ShopNotifyRow[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  isUpdating: boolean
  onMarkNotified: (id: string) => void
}) {
  if (isLoading) return <EntityListSkeleton />
  if (isError) {
    return (
      <ErrorState title="Eroare" message={error?.message ?? 'Nu am putut încărca cererile Anunță-mă.'} />
    )
  }
  if (rows.length === 0) {
    return (
      <ModuleEmptyCard
        emoji="🔔"
        title="Nicio cerere"
        hint="Cererile „Anunță-mă” de pe /comanda apar aici."
      />
    )
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <ShopNotifyCard key={row.id} row={row} disabled={isUpdating} onMarkNotified={onMarkNotified} />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-[var(--border-default)] bg-[var(--surface-card-muted)] text-xs font-semibold text-[var(--text-tertiary)]">
            <tr>
              <th className="px-3 py-2.5">Data</th>
              <th className="px-3 py-2.5">Nume</th>
              <th className="px-3 py-2.5">Telefon</th>
              <th className="px-3 py-2.5">Produs</th>
              <th className="px-3 py-2.5">Stare</th>
              <th className="px-3 py-2.5 text-right">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--border-default)] last:border-0">
                <td className="px-3 py-3 text-xs text-[var(--text-tertiary)]">
                  {formatOrderDate(row.created_at)}
                </td>
                <td className="px-3 py-3 font-medium">{row.customer_name}</td>
                <td className="px-3 py-3">
                  <a href={`tel:${row.customer_phone.replace(/\s/g, '')}`} className="text-[var(--info-text)]">
                    {row.customer_phone}
                  </a>
                </td>
                <td className="px-3 py-3">{row.product_name}</td>
                <td className="px-3 py-3">
                  <NotifyStateBadge notifiedAt={row.notified_at} />
                </td>
                <td className="px-3 py-3 text-right">
                  <ShopNotifyActions row={row} disabled={isUpdating} onMarkNotified={onMarkNotified} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function ShopNotifyCard({
  row,
  disabled,
  onMarkNotified,
}: {
  row: ShopNotifyRow
  disabled: boolean
  onMarkNotified: (id: string) => void
}) {
  return (
    <article className="rounded-[22px] border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-sm">
      <p className="text-xs text-[var(--text-tertiary)]">{formatOrderDate(row.created_at)}</p>
      <p className="mt-1 font-semibold text-[var(--text-primary)]">{row.customer_name}</p>
      <a href={`tel:${row.customer_phone.replace(/\s/g, '')}`} className="text-sm text-[var(--info-text)]">
        {row.customer_phone}
      </a>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{row.product_name}</p>
      <div className="mt-3">
        <NotifyStateBadge notifiedAt={row.notified_at} />
      </div>
      <ShopNotifyActions row={row} disabled={disabled} onMarkNotified={onMarkNotified} className="mt-4" />
    </article>
  )
}

function NotifyStateBadge({ notifiedAt }: { notifiedAt: string | null }) {
  if (notifiedAt) {
    return (
      <div className="inline-flex flex-col gap-0.5">
        <span
          className="inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ backgroundColor: '#22C55E', color: '#14532D' }}
        >
          Notificat
        </span>
        <span className="text-[10px] text-[var(--text-tertiary)]">{formatOrderDate(notifiedAt)}</span>
      </div>
    )
  }
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: '#F59E0B', color: '#92400E' }}
    >
      Așteaptă
    </span>
  )
}

function ShopNotifyActions({
  row,
  disabled,
  onMarkNotified,
  className = '',
}: {
  row: ShopNotifyRow
  disabled: boolean
  onMarkNotified: (id: string) => void
  className?: string
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1.5"
        disabled={disabled}
        onClick={() => window.open(waUrlForPhone(row.customer_phone), '_blank', 'noopener,noreferrer')}
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
        WhatsApp
      </Button>
      {!row.notified_at ? (
        <Button
          type="button"
          size="sm"
          className="h-9"
          disabled={disabled}
          onClick={() => onMarkNotified(row.id)}
        >
          Marchează notificat
        </Button>
      ) : null}
    </div>
  )
}
