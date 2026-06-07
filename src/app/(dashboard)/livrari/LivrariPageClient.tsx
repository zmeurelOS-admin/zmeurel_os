'use client'

import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  GripVertical,
  MapPin,
  MessageCircle,
  Minus,
  Navigation,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
} from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { ErrorState } from '@/components/app/ErrorState'
import { EntityListSkeleton } from '@/components/app/ListSkeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { queryKeys } from '@/lib/query-keys'
import {
  buildDeliverySummary,
  buildLivrareWaUrl,
  formatItemsHuman,
  formatLei,
  type ShopOrderRow,
} from '@/lib/shop/b2c-order-helpers'
import { fetchShopOrdersInLivrare } from '@/lib/shop/shop-orders-queries'
import { toast } from '@/lib/ui/toast'
import type { Json } from '@/types/supabase'

type EditableOrderItem = {
  vid: string
  label: string
  qty: number
  priceLei: number
}

function formatSummaryBullets(lines: { label: string; qty: number }[]): string {
  return lines.map((line) => `${line.label} × ${line.qty}`).join(' · ')
}

function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}

function mapsHref(address: string | null): string | null {
  const destination = address?.trim()
  return destination
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
    : null
}

function parseEditableItems(items: Json): EditableOrderItem[] {
  if (!Array.isArray(items)) return []

  return items.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return []
    const item = raw as { vid?: unknown; label?: unknown; qty?: unknown; price_lei?: unknown }
    const label =
      typeof item.label === 'string' && item.label.trim()
        ? item.label.trim()
        : typeof item.vid === 'string' && item.vid.trim()
          ? item.vid.trim()
          : `Produs ${index + 1}`
    const vid =
      typeof item.vid === 'string' && item.vid.trim() ? item.vid.trim() : `item-${index + 1}`
    const qty = typeof item.qty === 'number' && item.qty > 0 ? item.qty : 1
    const priceLei = typeof item.price_lei === 'number' && item.price_lei >= 0 ? item.price_lei : 0

    return [{ vid, label, qty, priceLei }]
  })
}

export function LivrariPageClient() {
  const queryClient = useQueryClient()
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [reorderOriginalIds, setReorderOriginalIds] = useState<string[] | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [deliverTarget, setDeliverTarget] = useState<ShopOrderRow | null>(null)
  const [editTarget, setEditTarget] = useState<ShopOrderRow | null>(null)
  const [deliveredInSession, setDeliveredInSession] = useState<ShopOrderRow[]>([])

  const ordersQuery = useQuery({
    queryKey: queryKeys.shopOrdersInLivrare,
    queryFn: fetchShopOrdersInLivrare,
  })

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data])

  const orderedOrders = useMemo(() => {
    if (orderedIds.length === 0) return orders
    const byId = new Map(orders.map((order) => [order.id, order]))
    const fromOrder = orderedIds
      .map((id) => byId.get(id))
      .filter((row): row is ShopOrderRow => Boolean(row))
    if (fromOrder.length === orders.length) return fromOrder
    const seen = new Set(fromOrder.map((order) => order.id))
    return [...fromOrder, ...orders.filter((order) => !seen.has(order.id))]
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
    setOrderedIds((current) => {
      const index = current.indexOf(id)
      if (index === -1) return current
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }, [])

  const persistReorderMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      const response = await fetch('/api/shop/b2c/orders/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: orderIds }),
      })
      const json = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Nu am putut salva ordinea livrărilor.')
      }
      return orderIds
    },
    onSuccess: (orderIds) => {
      setOrderedIds(orderIds)
      setReorderOriginalIds(null)
      setReorderingId(null)
      toast.success('Ordinea livrărilor a fost salvată')
      refreshAll()
    },
    onError: (error: Error) => {
      setOrderedIds(reorderOriginalIds ?? [])
      setReorderOriginalIds(null)
      setReorderingId(null)
      toast.error(error.message)
    },
  })

  const markDeliveredMutation = useMutation({
    mutationFn: async (order: ShopOrderRow) => {
      const response = await fetch(`/api/shop/b2c/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'livrata' }),
      })
      const json = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Nu am putut marca livrarea.')
      }
      return order
    },
    onMutate: async (order) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.shopOrdersInLivrare })
      const previous = queryClient.getQueryData<ShopOrderRow[]>(queryKeys.shopOrdersInLivrare)
      const previousCount = queryClient.getQueryData<number>(
        queryKeys.shopOrdersInLivrareCount,
      )
      const previousOrderedIds = orderedIds
      queryClient.setQueryData<ShopOrderRow[]>(
        queryKeys.shopOrdersInLivrare,
        (current) => current?.filter((item) => item.id !== order.id) ?? [],
      )
      queryClient.setQueryData<number>(queryKeys.shopOrdersInLivrareCount, (current) =>
        Math.max(0, (current ?? 1) - 1),
      )
      setOrderedIds((current) => current.filter((id) => id !== order.id))
      setDeliveredInSession((current) => [
        { ...order, status: 'livrata' },
        ...current.filter((item) => item.id !== order.id),
      ])
      if (expandedId === order.id) setExpandedId(null)
      if (reorderingId === order.id) setReorderingId(null)
      setDeliverTarget(null)
      return { previous, previousCount, previousOrderedIds, order }
    },
    onSuccess: () => {
      toast.success('Comandă livrată')
      refreshAll()
    },
    onError: (error: Error, _order, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.shopOrdersInLivrare, context.previous)
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(queryKeys.shopOrdersInLivrareCount, context.previousCount)
      }
      if (context?.previousOrderedIds) {
        setOrderedIds(context.previousOrderedIds)
      }
      if (context?.order) {
        setDeliveredInSession((current) =>
          current.filter((order) => order.id !== context.order.id),
        )
      }
      toast.error(error.message)
    },
  })

  const headerSubtitle =
    orders.length === 0
      ? deliveredInSession.length > 0
        ? 'Traseul este gata'
        : 'Nicio comandă în drum'
      : `${orders.length} ${orders.length === 1 ? 'comandă' : 'comenzi'} · Rămân ${formatLei(totalLei)} lei`

  return (
    <AppShell
      header={
        <div className="flex min-h-[52px] w-full items-center justify-between gap-3 px-1">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg leading-tight text-[var(--brand-dark)] [font-weight:750]">
              Livrări de azi
            </h1>
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">{headerSubtitle}</p>
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
            <RefreshCw className={ordersQuery.isFetching ? 'animate-spin' : ''} />
          </Button>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-8">
        {ordersQuery.isLoading ? <EntityListSkeleton count={3} /> : null}

        {ordersQuery.isError ? (
          <ErrorState
            title="Eroare la încărcare"
            message={(ordersQuery.error as Error)?.message ?? 'Nu am putut încărca livrările.'}
            onRetry={() => void ordersQuery.refetch()}
          />
        ) : null}

        {!ordersQuery.isLoading && !ordersQuery.isError && orders.length > 0 ? (
          <section className="space-y-3">
            <header className="border-b border-[var(--divider)] pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[15px] text-[var(--text-primary)] [font-weight:750]">
                    🚚 De livrat
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {summaryBullets || 'Comenzi pregătite pentru traseu'}
                  </p>
                </div>
                {reorderingId ? (
                  <Button
                    type="button"
                    className="min-h-11 rounded-xl bg-[var(--status-warning-text)] px-4 text-white"
                    disabled={persistReorderMutation.isPending}
                    onClick={() =>
                      persistReorderMutation.mutate(orderedOrders.map((order) => order.id))
                    }
                  >
                    <Check />
                    {persistReorderMutation.isPending ? 'Se salvează...' : 'Gata'}
                  </Button>
                ) : (
                  <p className="shrink-0 text-base text-[var(--brand-coral)] [font-weight:750]">
                    {formatLei(summary.totalLei)} lei
                  </p>
                )}
              </div>
            </header>

            <div className="space-y-2.5">
              {orderedOrders.map((order, index) => (
                <DeliveryOrderCard
                  key={order.id}
                  order={order}
                  position={index + 1}
                  isFirst={index === 0}
                  isLast={index === orderedOrders.length - 1}
                  expanded={expandedId === order.id}
                  reordering={reorderingId === order.id}
                  marking={
                    markDeliveredMutation.isPending &&
                    markDeliveredMutation.variables?.id === order.id
                  }
                  onActivateReorder={() => {
                    const currentIds = orderedOrders.map((currentOrder) => currentOrder.id)
                    setOrderedIds(currentIds)
                    setReorderOriginalIds((current) => current ?? currentIds)
                    setReorderingId(order.id)
                    setExpandedId(null)
                  }}
                  onEdit={() => setEditTarget(order)}
                  onMarkDelivered={() => setDeliverTarget(order)}
                  onMoveDown={() => moveOrder(order.id, 'down')}
                  onMoveUp={() => moveOrder(order.id, 'up')}
                  onToggleExpand={() => {
                    if (reorderingId) return
                    setExpandedId((current) => (current === order.id ? null : order.id))
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}

        {!ordersQuery.isLoading &&
        !ordersQuery.isError &&
        orders.length === 0 &&
        deliveredInSession.length === 0 ? (
          <div className="flex flex-col items-center rounded-[22px] bg-[var(--surface-card)] px-6 py-12 text-center shadow-[var(--shadow-soft)]">
            <span
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-card-muted)] text-3xl"
              aria-hidden
            >
              🚚
            </span>
            <p className="text-base text-[var(--text-primary)] [font-weight:700]">
              Nicio livrare activă acum.
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
              Comenzile apar aici când le marchezi „În livrare” din modulul Comenzi.
            </p>
          </div>
        ) : null}

        {deliveredInSession.length > 0 ? (
          <DeliveredSection orders={deliveredInSession} />
        ) : null}
      </div>

      <DeliveryConfirmationDialog
        order={deliverTarget}
        pending={markDeliveredMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !markDeliveredMutation.isPending) setDeliverTarget(null)
        }}
        onConfirm={() => {
          if (deliverTarget) markDeliveredMutation.mutate(deliverTarget)
        }}
      />

      {editTarget ? (
        <QuickEditSheet
          key={editTarget.id}
          order={editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
        />
      ) : null}
    </AppShell>
  )
}

function DeliveryOrderCard({
  order,
  position,
  isFirst,
  isLast,
  expanded,
  reordering,
  marking,
  onActivateReorder,
  onEdit,
  onMarkDelivered,
  onMoveDown,
  onMoveUp,
  onToggleExpand,
}: {
  order: ShopOrderRow
  position: number
  isFirst: boolean
  isLast: boolean
  expanded: boolean
  reordering: boolean
  marking: boolean
  onActivateReorder: () => void
  onEdit: () => void
  onMarkDelivered: () => void
  onMoveDown: () => void
  onMoveUp: () => void
  onToggleExpand: () => void
}) {
  const whatsappHref = buildLivrareWaUrl(order)
  const navigationHref = mapsHref(order.delivery_address)
  const address = order.delivery_address?.trim() || 'Adresă necompletată'

  return (
    <article
      className={`overflow-hidden rounded-[20px] bg-[var(--surface-card)] shadow-[var(--shadow-soft)] transition ${
        reordering
          ? 'ring-2 ring-[var(--status-warning-text)] ring-offset-2 ring-offset-[var(--surface-page)]'
          : ''
      }`}
    >
      <div className="flex min-h-[82px]">
        <button
          type="button"
          className={`flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 transition active:scale-[0.985] ${
            reordering
              ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
              : 'bg-[var(--brand-coral-soft)] text-[var(--brand-coral)]'
          }`}
          aria-label={`Reordonează livrarea ${position}`}
          aria-pressed={reordering}
          onClick={onActivateReorder}
        >
          <span className="text-lg tabular-nums [font-weight:750]">{position}</span>
          <GripVertical className="h-5 w-5" aria-hidden />
        </button>

        <button
          type="button"
          className="min-w-0 flex-1 px-3 py-3 text-left transition active:scale-[0.99]"
          aria-expanded={expanded}
          onClick={onToggleExpand}
        >
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0 truncate text-[15px] text-[var(--brand-dark)] [font-weight:750]">
              {order.customer_name}
            </span>
            <span className="shrink-0 text-[16px] tabular-nums text-[var(--brand-coral)] [font-weight:750]">
              {formatLei(order.total_lei)} lei
            </span>
          </span>
          <span className="mt-1.5 flex min-w-0 items-start gap-1.5 text-xs leading-snug text-[var(--text-secondary)]">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--brand-coral)]" aria-hidden />
            <span className="line-clamp-2">{address}</span>
          </span>
        </button>

        {!reordering ? (
          <button
            type="button"
            className="flex w-11 shrink-0 items-center justify-center text-[var(--text-tertiary)]"
            aria-label={expanded ? 'Restrânge detaliile' : 'Arată detaliile'}
            aria-expanded={expanded}
            onClick={onToggleExpand}
          >
            <ChevronDown
              className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
        ) : null}
      </div>

      {reordering ? (
        <div className="grid grid-cols-2 gap-2 border-t border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3">
          <Button
            type="button"
            variant="outline"
            className="min-h-14 rounded-xl border-[var(--status-warning-border)] bg-[var(--surface-card)] text-base text-[var(--brand-dark)]"
            disabled={isFirst}
            onClick={onMoveUp}
          >
            <ArrowUp className="h-5 w-5" />
            Sus
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-14 rounded-xl border-[var(--status-warning-border)] bg-[var(--surface-card)] text-base text-[var(--brand-dark)]"
            disabled={isLast}
            onClick={onMoveDown}
          >
            <ArrowDown className="h-5 w-5" />
            Jos
          </Button>
        </div>
      ) : null}

      {expanded && !reordering ? (
        <div className="border-t border-[var(--divider)] px-3 pb-3 pt-3">
          <p className="mb-3 text-xs leading-relaxed text-[var(--text-secondary)]">
            {formatItemsHuman(order.items)}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <ActionLink href={phoneHref(order.customer_phone)} icon={Phone} label="Apel" />
            <ActionLink
              href={whatsappHref}
              icon={MessageCircle}
              label="WhatsApp"
              external
            />
            <ActionLink
              href={navigationHref}
              icon={Navigation}
              label="Navigare"
              external
              disabled={!navigationHref}
            />
            <Button
              type="button"
              variant="outline"
              className="min-h-14 rounded-xl text-sm"
              onClick={onEdit}
            >
              <Pencil className="h-5 w-5" />
              Editează
            </Button>
          </div>

          <Button
            type="button"
            className="mt-2 min-h-14 w-full rounded-xl bg-[var(--agri-primary)] text-base text-white"
            disabled={marking}
            onClick={onMarkDelivered}
          >
            <PackageCheck className="h-5 w-5" />
            {marking ? 'Se marchează...' : 'Marchează livrat'}
          </Button>
        </div>
      ) : null}
    </article>
  )
}

function ActionLink({
  href,
  icon: Icon,
  label,
  external = false,
  disabled = false,
}: {
  href: string | null
  icon: typeof Phone
  label: string
  external?: boolean
  disabled?: boolean
}) {
  if (!href || disabled) {
    return (
      <span
        className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] text-sm text-[var(--text-tertiary)] opacity-60"
        aria-disabled="true"
      >
        <Icon className="h-5 w-5" />
        {label}
      </span>
    )
  }

  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] text-sm text-[var(--brand-dark)] transition active:scale-[0.985] [font-weight:650]"
    >
      <Icon className="h-5 w-5 text-[var(--agri-primary)]" />
      {label}
    </a>
  )
}

function DeliveryConfirmationDialog({
  order,
  pending,
  onConfirm,
  onOpenChange,
}: {
  order: ShopOrderRow | null
  pending: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}) {
  return (
    <AlertDialog open={order !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Marchezi comanda ca livrată?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="rounded-2xl bg-[var(--brand-green-soft)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Sumă de încasat</p>
                <p className="mt-1 text-2xl tabular-nums text-[var(--agri-primary)] [font-weight:750]">
                  {order ? `${formatLei(order.total_lei)} lei` : '—'}
                </p>
              </div>
              <p>
                Confirmarea creează venitul în Vânzări și scade din stoc greutatea produselor
                livrate. Dacă stocul este insuficient, comanda rămâne nelivrată.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Anulează</AlertDialogCancel>
          <AlertDialogAction
            className="min-h-12 bg-[var(--agri-primary)] text-white"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
          >
            {pending ? 'Se salvează...' : 'Da, marchează livrat'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function QuickEditSheet({
  order,
  onOpenChange,
}: {
  order: ShopOrderRow
  onOpenChange: (open: boolean) => void
}) {
  const [items, setItems] = useState<EditableOrderItem[]>(() => parseEditableItems(order.items))

  const total = items.reduce((sum, item) => sum + item.qty * item.priceLei, 0)

  const updateQuantity = (vid: string, delta: number) => {
    setItems((current) =>
      current.map((item) =>
        item.vid === vid ? { ...item, qty: Math.max(1, item.qty + delta) } : item,
      ),
    )
  }

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[28px]">
        <SheetHeader>
          <SheetTitle>Editare rapidă</SheetTitle>
          <SheetDescription>
            Ajustează cantitățile pentru {order.customer_name}.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-4">
          {items.map((item) => (
            <div
              key={item.vid}
              className="flex items-center gap-3 rounded-2xl bg-[var(--surface-card-muted)] p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[var(--brand-dark)] [font-weight:700]">
                  {item.label}
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  {formatLei(item.priceLei)} lei / buc.
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-xl bg-[var(--surface-card)] p-1 shadow-[var(--shadow-soft)]">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  aria-label={`Scade cantitatea pentru ${item.label}`}
                  disabled={item.qty <= 1}
                  onClick={() => updateQuantity(item.vid, -1)}
                >
                  <Minus />
                </Button>
                <span className="min-w-8 text-center text-base tabular-nums [font-weight:750]">
                  {item.qty}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  aria-label={`Crește cantitatea pentru ${item.label}`}
                  onClick={() => updateQuantity(item.vid, 1)}
                >
                  <Plus />
                </Button>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="min-h-12 w-full rounded-xl border-dashed"
            onClick={() =>
              toast.info('Adăugarea și persistarea produselor necesită confirmarea Fazei 2.')
            }
          >
            <Plus />
            Adaugă produs
          </Button>

          <div className="flex items-center justify-between rounded-2xl bg-[var(--brand-coral-soft)] px-4 py-3">
            <span className="text-sm text-[var(--brand-dark)] [font-weight:650]">Total recalculat</span>
            <span className="text-xl tabular-nums text-[var(--brand-coral)] [font-weight:750]">
              {formatLei(total)} lei
            </span>
          </div>
        </div>

        <SheetFooter>
          <p className="text-xs text-[var(--text-secondary)]">
            Salvarea în DB este blocată până la confirmarea Fazei 2.
          </p>
          <Button type="button" className="min-h-12 w-full rounded-xl" disabled>
            Salvează modificările
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function DeliveredSection({ orders }: { orders: ShopOrderRow[] }) {
  const total = orders.reduce((sum, order) => sum + order.total_lei, 0)

  return (
    <section className="space-y-2.5 border-t border-[var(--divider)] pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)] [font-weight:700]">
          Livrate ({orders.length})
        </p>
        <p className="text-sm tabular-nums text-[var(--text-secondary)]">
          {formatLei(total)} lei
        </p>
      </div>
      <div className="space-y-2">
        {orders.map((order) => (
          <article
            key={order.id}
            className="flex items-center gap-3 rounded-2xl bg-[var(--surface-card-muted)] px-4 py-3 opacity-60"
          >
            <Check className="h-5 w-5 shrink-0 text-[var(--status-success-text)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-[var(--text-primary)] line-through [font-weight:650]">
                {order.customer_name}
              </p>
              <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)] line-through">
                {order.delivery_address?.trim() || 'Adresă necompletată'}
              </p>
            </div>
            <span className="shrink-0 text-sm tabular-nums text-[var(--text-secondary)] line-through">
              {formatLei(order.total_lei)} lei
            </span>
          </article>
        ))}
      </div>
    </section>
  )
}
