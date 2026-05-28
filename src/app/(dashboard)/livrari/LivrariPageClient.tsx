'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, GripVertical, MessageCircle, RefreshCw } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { ErrorState } from '@/components/app/ErrorState'
import { EntityListSkeleton } from '@/components/app/ListSkeleton'
import { Button } from '@/components/ui/button'
import { queryKeys } from '@/lib/query-keys'
import {
  buildDeliverySummary,
  buildLivrareWaUrl,
  formatItemsHuman,
  formatLei,
  waUrlForPhone,
  type ShopOrderRow,
} from '@/lib/shop/b2c-order-helpers'
import { fetchShopOrdersInLivrare } from '@/lib/shop/shop-orders-queries'
import { toast } from '@/lib/ui/toast'

function todayBucharestKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Bucharest',
  }).format(new Date())
}

function livrariOrderStorageKey(): string {
  return `livrari-order-${todayBucharestKey()}`
}

function loadStoredOrderIds(currentIds: string[]): string[] {
  if (typeof window === 'undefined' || currentIds.length === 0) return currentIds
  try {
    const raw = localStorage.getItem(livrariOrderStorageKey())
    if (!raw) return currentIds
    const stored = JSON.parse(raw) as unknown
    if (!Array.isArray(stored)) return currentIds
    const storedIds = stored.filter((id): id is string => typeof id === 'string')
    const currentSet = new Set(currentIds)
    const ordered = storedIds.filter((id) => currentSet.has(id))
    const appended = currentIds.filter((id) => !ordered.includes(id))
    return [...ordered, ...appended]
  } catch {
    return currentIds
  }
}

function saveStoredOrderIds(ids: string[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(livrariOrderStorageKey(), JSON.stringify(ids))
}

function formatSummaryBullets(lines: { label: string; qty: number }[]): string {
  return lines.map((line) => `${line.label} × ${line.qty}`).join(' · ')
}

function telHref(phone: string) {
  const digits = phone.replace(/\s/g, '')
  return digits.startsWith('+') ? `tel:${digits}` : `tel:${digits.replace(/^0/, '+40')}`
}

export function LivrariPageClient() {
  const queryClient = useQueryClient()
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const ordersQuery = useQuery({
    queryKey: queryKeys.shopOrdersInLivrare,
    queryFn: fetchShopOrdersInLivrare,
  })

  const orders = ordersQuery.data ?? []
  const orderIdsKey = useMemo(() => orders.map((o) => o.id).join('|'), [orders])

  useEffect(() => {
    const ids = orders.map((o) => o.id)
    if (ids.length === 0) {
      setOrderedIds([])
      return
    }
    setOrderedIds(loadStoredOrderIds(ids))
  }, [orderIdsKey])

  const orderedOrders = useMemo(() => {
    const byId = new Map(orders.map((o) => [o.id, o]))
    const fromOrder = orderedIds
      .map((id) => byId.get(id))
      .filter((row): row is ShopOrderRow => Boolean(row))
    if (fromOrder.length === orders.length) return fromOrder
    const seen = new Set(fromOrder.map((o) => o.id))
    const rest = orders.filter((o) => !seen.has(o.id))
    return [...fromOrder, ...rest]
  }, [orders, orderedIds])

  const totalLei = orders.reduce((sum, order) => sum + order.total_lei, 0)
  const summary = buildDeliverySummary(orders)
  const summaryBullets = formatSummaryBullets(summary.lines)

  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrdersInLivrare })
    void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrdersInLivrareCount })
    void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrders })
  }, [queryClient])

  const moveOrder = useCallback((id: string, direction: 'up' | 'down') => {
    setOrderedIds((prev) => {
      const index = prev.indexOf(id)
      if (index === -1) return prev
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      saveStoredOrderIds(next)
      return next
    })
  }, [])

  const markDeliveredMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/shop/b2c/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'livrata' }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Nu am putut marca livrarea.')
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.shopOrdersInLivrare })
      const previous = queryClient.getQueryData<ShopOrderRow[]>(queryKeys.shopOrdersInLivrare)
      queryClient.setQueryData<ShopOrderRow[]>(
        queryKeys.shopOrdersInLivrare,
        (current) => current?.filter((order) => order.id !== id) ?? [],
      )
      queryClient.setQueryData<number>(queryKeys.shopOrdersInLivrareCount, (current) =>
        Math.max(0, (current ?? 1) - 1),
      )
      setOrderedIds((prev) => {
        const next = prev.filter((rowId) => rowId !== id)
        saveStoredOrderIds(next)
        return next
      })
      if (expandedId === id) setExpandedId(null)
      return { previous }
    },
    onSuccess: () => {
      toast.success('✓ Marcată livrată')
      refreshAll()
    },
    onError: (err: Error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.shopOrdersInLivrare, context.previous)
      }
      toast.error(err.message)
    },
  })

  const headerSubtitle =
    orders.length === 0
      ? 'Nicio comandă în drum'
      : `${orders.length} ${orders.length === 1 ? 'comandă' : 'comenzi'} · Total ${formatLei(totalLei)} lei`

  return (
    <AppShell
      header={
        <div className="flex min-h-[52px] w-full items-center justify-between gap-3 px-1">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight text-[var(--text-primary)]">Livrări de azi</h1>
            <p className="mt-0.5 text-[14px] text-[var(--text-secondary)]">{headerSubtitle}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Reîncarcă livrările"
            disabled={ordersQuery.isFetching}
            onClick={() => {
              refreshAll()
              void ordersQuery.refetch()
            }}
          >
            <RefreshCw className={`h-5 w-5 ${ordersQuery.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-8">
        {ordersQuery.isLoading ? <EntityListSkeleton count={3} /> : null}

        {ordersQuery.isError ? (
          <ErrorState
            title="Eroare la încărcare"
            message={(ordersQuery.error as Error)?.message ?? 'Nu am putut încărca livrările.'}
            onRetry={() => void ordersQuery.refetch()}
          />
        ) : null}

        {!ordersQuery.isLoading && !ordersQuery.isError && orders.length > 0 ? (
          <>
            <header className="border-b border-[var(--border-default)] pb-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-bold text-[var(--text-primary)]">🚚 Livrări de azi</p>
                <p className="shrink-0 text-[15px] font-bold text-[#F16B6B]">
                  {formatLei(summary.totalLei)} lei total
                </p>
              </div>
              {summaryBullets ? (
                <p className="mt-2 text-[13px] leading-snug text-[var(--text-secondary)]">
                  {summaryBullets}
                </p>
              ) : null}
            </header>

            <div className="space-y-2">
              {orderedOrders.map((order, index) => (
                <DeliveryOrderAccordion
                  key={order.id}
                  order={order}
                  position={index + 1}
                  isFirst={index === 0}
                  isLast={index === orderedOrders.length - 1}
                  expanded={expandedId === order.id}
                  marking={
                    markDeliveredMutation.isPending && markDeliveredMutation.variables === order.id
                  }
                  onToggleExpand={() =>
                    setExpandedId((current) => (current === order.id ? null : order.id))
                  }
                  onMoveUp={() => moveOrder(order.id, 'up')}
                  onMoveDown={() => moveOrder(order.id, 'down')}
                  onMarkDelivered={() => markDeliveredMutation.mutate(order.id)}
                />
              ))}
            </div>
          </>
        ) : null}

        {!ordersQuery.isLoading && !ordersQuery.isError && orders.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] px-6 py-12 text-center shadow-[var(--shadow-soft)]">
            <span
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-card-muted)] text-3xl"
              aria-hidden
            >
              🚚
            </span>
            <p className="text-base font-semibold text-[var(--text-primary)]">Nicio livrare activă acum.</p>
            <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-[var(--text-secondary)]">
              Comenzile apar aici când le marchezi «În livrare» din modulul Comenzi.
            </p>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}

function ReorderGrip({
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  isFirst: boolean
  isLast: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <div
      className="relative flex h-11 w-7 shrink-0 cursor-grab active:cursor-grabbing"
      aria-label="Reordonare"
    >
      <button
        type="button"
        className="absolute inset-x-0 top-0 z-10 h-1/2 opacity-0 disabled:pointer-events-none"
        disabled={isFirst}
        aria-label="Mută mai sus"
        onClick={(e) => {
          e.stopPropagation()
          onMoveUp()
        }}
      />
      <button
        type="button"
        className="absolute inset-x-0 bottom-0 z-10 h-1/2 opacity-0 disabled:pointer-events-none"
        disabled={isLast}
        aria-label="Mută mai jos"
        onClick={(e) => {
          e.stopPropagation()
          onMoveDown()
        }}
      />
      <span className="pointer-events-none flex h-full w-full items-center justify-center text-[var(--text-tertiary)]">
        <GripVertical className="h-5 w-5" aria-hidden />
      </span>
    </div>
  )
}

function DeliveryOrderAccordion({
  order,
  position,
  isFirst,
  isLast,
  expanded,
  marking,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onMarkDelivered,
}: {
  order: ShopOrderRow
  position: number
  isFirst: boolean
  isLast: boolean
  expanded: boolean
  marking: boolean
  onToggleExpand: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onMarkDelivered: () => void
}) {
  const chatWaUrl = waUrlForPhone(order.customer_phone)
  const messageWaUrl = buildLivrareWaUrl(order)
  const productsLabel = formatItemsHuman(order.items)
  const addressFull = (order.delivery_address ?? '').trim() || '—'

  return (
    <article
      className={`overflow-hidden border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)] ${
        expanded ? 'rounded-2xl' : 'rounded-2xl'
      }`}
    >
      <div className="px-3 py-2.5">
        <div className="flex min-h-[44px] items-center gap-2">
          <span
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg text-xs font-extrabold tabular-nums"
            style={{ background: '#FCE3DF', color: '#E15453' }}
            aria-label={`Poziția ${position}`}
          >
            {position}
          </span>

          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-[16px] font-bold leading-tight text-[var(--text-primary)]"
            onClick={onToggleExpand}
          >
            {order.customer_name}
          </button>

          <span className="shrink-0 text-[17px] font-extrabold tabular-nums text-[#F16B6B]">
            {formatLei(order.total_lei)}
          </span>

          <a
            href={chatWaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white transition active:scale-[0.98]"
            aria-label="Deschide WhatsApp"
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
          </a>

          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-[var(--text-tertiary)]"
            aria-expanded={expanded}
            aria-label={expanded ? 'Restrânge detaliile' : 'Arată detaliile'}
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
          >
            <ChevronDown
              className={`h-5 w-5 transition-transform duration-200 ease-out ${
                expanded ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>

          <ReorderGrip
            isFirst={isFirst}
            isLast={isLast}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
          />
        </div>

        <p
          className="mt-1 line-clamp-2 pl-[34px] text-[11px] leading-[1.4] text-[var(--text-secondary)]"
        >
          📍 {addressFull}
        </p>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-dashed border-[var(--border-default)] px-3.5 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-[var(--text-secondary)]">
              <p className="min-w-0 flex-1">
                <span className="font-semibold text-[var(--text-primary)]">Produse: </span>
                {productsLabel}
              </p>
            </div>
            <p className="mt-2 text-[13px]">
              <span className="font-semibold text-[var(--text-primary)]">Telefon: </span>
              <a
                href={telHref(order.customer_phone)}
                className="font-medium text-[#1868DB] underline-offset-2 hover:underline"
              >
                {order.customer_phone}
              </a>
            </p>

            <div className="mt-3 flex gap-2">
              <a
                href={messageWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 min-h-11 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-3 text-[14px] font-bold text-white transition active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                Mesaj WA
              </a>
              <Button
                type="button"
                variant="outline"
                className="h-11 min-h-11 flex-1 rounded-xl border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[14px] font-semibold text-[var(--text-primary)]"
                disabled={marking}
                onClick={onMarkDelivered}
              >
                {marking ? '…' : '✓ Livrat'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}
