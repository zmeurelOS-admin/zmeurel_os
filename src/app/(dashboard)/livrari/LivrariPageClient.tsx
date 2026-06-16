'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  GripVertical,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Pencil,
  Phone,
  RefreshCw,
} from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { ErrorState } from '@/components/app/ErrorState'
import { EntityListSkeleton } from '@/components/app/ListSkeleton'
import { EditOrderSheet } from '@/components/comenzi/EditOrderSheet'
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
import { mapB2bToUnified, mapShopToUnified } from '@/lib/comenzi/unified-orders'
import { normalizeComanda, normalizeShopOrder, type DeliveryItem } from '@/lib/livrari/types'
import { queryKeys } from '@/lib/query-keys'
import {
  buildDeliverySummary,
  buildLivrareWaUrl,
  formatItemsHuman,
  formatLei,
  type ShopOrderRow,
} from '@/lib/shop/b2c-order-helpers'
import {
  fetchShopOrdersInLivrare,
  fetchShopOrdersScheduledToday,
} from '@/lib/shop/shop-orders-queries'
import { getClienți, type Client } from '@/lib/supabase/queries/clienti'
import {
  deliverComanda,
  deliverShopOrderPartial,
  fetchComenziManualInLivrare,
  type Comanda,
} from '@/lib/supabase/queries/comenzi'
import { toast } from '@/lib/ui/toast'

type EditTarget =
  | { type: 'shop'; order: ShopOrderRow }
  | { type: 'manual'; order: Comanda }
  | null

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

export function LivrariPageClient() {
  const queryClient = useQueryClient()
  const { tenantId } = useDashboardAuth()
  const [orderedIds, setOrderedIds] = useState<string[]>([])
  const [reorderOriginalIds, setReorderOriginalIds] = useState<string[] | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [deliverTarget, setDeliverTarget] = useState<DeliveryItem | null>(null)
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [deliveredInSession, setDeliveredInSession] = useState<DeliveryItem[]>([])
  const [scheduledTodayExpanded, setScheduledTodayExpanded] = useState(false)

  const ordersQuery = useQuery({
    queryKey: queryKeys.shopOrdersInLivrare,
    queryFn: fetchShopOrdersInLivrare,
  })
  const scheduledTodayQuery = useQuery({
    queryKey: queryKeys.shopOrdersScheduledToday(tenantId),
    queryFn: () => fetchShopOrdersScheduledToday(tenantId!),
    enabled: Boolean(tenantId),
  })
  const comenziManualQuery = useQuery({
    queryKey: queryKeys.comenziManualInLivrare,
    queryFn: fetchComenziManualInLivrare,
  })
  const clientiQuery = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
  })

  const shopOrders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data])
  const manualOrders = useMemo(() => comenziManualQuery.data ?? [], [comenziManualQuery.data])
  const scheduledToday = useMemo(
    () => scheduledTodayQuery.data ?? [],
    [scheduledTodayQuery.data],
  )
  const clientMap = useMemo(() => {
    const map: Record<string, Client> = {}
    for (const client of clientiQuery.data ?? []) {
      map[client.id] = client
    }
    return map
  }, [clientiQuery.data])
  const deliveryItems = useMemo(() => {
    return [...shopOrders.map(normalizeShopOrder), ...manualOrders.map(normalizeComanda)].sort(
      (a, b) => {
        if (a.delivery_position !== null && b.delivery_position !== null) {
          return a.delivery_position - b.delivery_position
        }
        if (a.delivery_position !== null) return -1
        if (b.delivery_position !== null) return 1
        return a.created_at < b.created_at ? 1 : -1
      },
    )
  }, [manualOrders, shopOrders])
  const editUnified = useMemo(() => {
    if (!editTarget) return null
    if (editTarget.type === 'shop') return mapShopToUnified(editTarget.order)
    return mapB2bToUnified(editTarget.order, clientMap)
  }, [clientMap, editTarget])

  const orderedOrders = useMemo(() => {
    if (orderedIds.length === 0) return deliveryItems
    const byId = new Map(deliveryItems.map((order) => [order.id, order]))
    const fromOrder = orderedIds
      .map((id) => byId.get(id))
      .filter((row): row is DeliveryItem => Boolean(row))
    if (fromOrder.length === deliveryItems.length) return fromOrder
    const seen = new Set(fromOrder.map((order) => order.id))
    return [...fromOrder, ...deliveryItems.filter((order) => !seen.has(order.id))]
  }, [deliveryItems, orderedIds])

  const totalKg = deliveryItems.reduce((sum, item) => sum + (item.cantitate_kg ?? 0), 0)
  const totalLei = deliveryItems.reduce((sum, order) => sum + order.total_lei, 0)
  const summary = buildDeliverySummary(shopOrders)
  const summaryBullets = formatSummaryBullets(summary.lines)
  const isFetchingAny = ordersQuery.isFetching || comenziManualQuery.isFetching

  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrdersInLivrare })
    void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrdersInLivrareCount })
    void queryClient.invalidateQueries({ queryKey: queryKeys.comenziManualInLivrare })
    void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrders })
    void queryClient.invalidateQueries({
      queryKey: queryKeys.shopOrdersScheduledToday(tenantId),
    })
  }, [queryClient, tenantId])

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
        { ...normalizeShopOrder(order), status: 'livrata' },
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

  const deliverPartialManualMutation = useMutation({
    mutationFn: async ({ comanda, kgLivrat }: { comanda: Comanda; kgLivrat: number }) =>
      deliverComanda({
        comandaId: comanda.id,
        cantitateLivrataKg: kgLivrat,
        plata: 'integral',
        dataLivrareRamasa: null,
      }),
    onSuccess: () => {
      toast.success('Livrare parțială înregistrată')
      setDeliverTarget(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.comenziManualInLivrare })
      void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrdersInLivrare })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const deliverPartialShopMutation = useMutation({
    mutationFn: async ({
      shopOrder,
      kgLivrat,
    }: {
      shopOrder: ShopOrderRow
      kgLivrat: number
    }) =>
      deliverShopOrderPartial({
        shopOrderId: shopOrder.id,
        deliveredKg: kgLivrat,
        plata: 'platit',
      }),
    onSuccess: () => {
      toast.success('Livrare parțială înregistrată')
      setDeliverTarget(null)
      refreshAll()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleConfirmPartial = useCallback(
    (kgLivrat: number) => {
      if (!deliverTarget) return
      if (deliverTarget._comanda) {
        deliverPartialManualMutation.mutate({
          comanda: deliverTarget._comanda,
          kgLivrat,
        })
        return
      }
      if (deliverTarget._shopOrder) {
        deliverPartialShopMutation.mutate({
          shopOrder: deliverTarget._shopOrder,
          kgLivrat,
        })
      }
    },
    [deliverPartialManualMutation, deliverPartialShopMutation, deliverTarget],
  )

  const headerSubtitle =
    deliveryItems.length === 0
      ? deliveredInSession.length > 0
        ? 'Traseul este gata'
        : 'Nicio comandă în drum'
      : `${deliveryItems.length} ${deliveryItems.length === 1 ? 'comandă' : 'comenzi'} · ${totalKg.toFixed(1)} kg · Rămân ${formatLei(totalLei)} lei`

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
            disabled={isFetchingAny}
            onClick={() => {
              refreshAll()
              void Promise.all([ordersQuery.refetch(), comenziManualQuery.refetch()])
            }}
          >
            <RefreshCw className={isFetchingAny ? 'animate-spin' : ''} />
          </Button>
        </div>
      }
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-8">
        {ordersQuery.isLoading || comenziManualQuery.isLoading ? (
          <EntityListSkeleton count={3} />
        ) : null}

        {ordersQuery.isError || comenziManualQuery.isError ? (
          <ErrorState
            title="Eroare la încărcare"
            message={
              (ordersQuery.error as Error)?.message ??
              (comenziManualQuery.error as Error)?.message ??
              'Nu am putut încărca livrările.'
            }
            onRetry={() => void Promise.all([ordersQuery.refetch(), comenziManualQuery.refetch()])}
          />
        ) : null}

        {scheduledToday.length > 0 ? (
          <section className="overflow-hidden rounded-[20px] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] shadow-[var(--shadow-soft)]">
            <button
              type="button"
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
              aria-expanded={scheduledTodayExpanded}
              onClick={() => setScheduledTodayExpanded((current) => !current)}
            >
              <span className="text-sm font-bold leading-relaxed">
                📋 {scheduledToday.length}{' '}
                {scheduledToday.length === 1 ? 'comandă programată' : 'comenzi programate'} pentru
                azi — {scheduledToday.length === 1 ? 'nu este' : 'nu sunt'} încă în livrare
              </span>
              <span className="shrink-0 text-xs font-bold">
                {scheduledTodayExpanded ? 'Ascunde ↑' : 'Vezi comenzile →'}
              </span>
            </button>

            {scheduledTodayExpanded ? (
              <div className="space-y-2 border-t border-[var(--status-warning-border)] px-3 py-3">
                {scheduledToday.map((order) => (
                  <article
                    key={order.id}
                    className="rounded-xl bg-[var(--surface-card)] px-3 py-3 text-[var(--text-primary)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{order.customer_name}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                          {order.delivery_address?.trim() || 'Adresă necompletată'}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-[var(--brand-coral)]">
                        {formatLei(order.total_lei)} lei
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      {formatItemsHuman(order.items)}
                    </p>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {!ordersQuery.isLoading &&
        !comenziManualQuery.isLoading &&
        !ordersQuery.isError &&
        !comenziManualQuery.isError &&
        deliveryItems.length > 0 ? (
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
                      persistReorderMutation.mutate(
                        orderedOrders
                          .filter((order) => Boolean(order._shopOrder))
                          .map((order) => order.id),
                      )
                    }
                  >
                    <Check />
                    {persistReorderMutation.isPending ? 'Se salvează...' : 'Gata'}
                  </Button>
                ) : (
                  <p className="shrink-0 text-base text-[var(--brand-coral)] [font-weight:750]">
                    {formatLei(totalLei)} lei
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
                  onActivateReorder={
                    order._shopOrder
                      ? () => {
                          const currentIds = orderedOrders
                            .filter((currentOrder) => Boolean(currentOrder._shopOrder))
                            .map((currentOrder) => currentOrder.id)
                          setOrderedIds(currentIds)
                          setReorderOriginalIds((current) => current ?? currentIds)
                          setReorderingId(order.id)
                          setExpandedId(null)
                        }
                      : undefined
                  }
                  onEdit={
                    order._shopOrder
                      ? () => setEditTarget({ type: 'shop', order: order._shopOrder! })
                      : order._comanda
                        ? () => setEditTarget({ type: 'manual', order: order._comanda! })
                        : undefined
                  }
                  onMarkDelivered={
                    order._shopOrder || order._comanda
                      ? () => setDeliverTarget(order)
                      : undefined
                  }
                  onMoveDown={order._shopOrder ? () => moveOrder(order.id, 'down') : undefined}
                  onMoveUp={order._shopOrder ? () => moveOrder(order.id, 'up') : undefined}
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
        !comenziManualQuery.isLoading &&
        !ordersQuery.isError &&
        !comenziManualQuery.isError &&
        deliveryItems.length === 0 &&
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
        pending={
          markDeliveredMutation.isPending ||
          (Boolean(deliverTarget?._comanda) && deliverPartialManualMutation.isPending)
        }
        pendingPartial={
          deliverPartialManualMutation.isPending || deliverPartialShopMutation.isPending
        }
        onOpenChange={(open) => {
          if (
            !open &&
            !markDeliveredMutation.isPending &&
            !deliverPartialManualMutation.isPending &&
            !deliverPartialShopMutation.isPending
          ) {
            setDeliverTarget(null)
          }
        }}
        onConfirm={() => {
          if (deliverTarget?._shopOrder) {
            markDeliveredMutation.mutate(deliverTarget._shopOrder)
            return
          }
          if (deliverTarget?._comanda && deliverTarget.cantitate_kg) {
            handleConfirmPartial(deliverTarget.cantitate_kg)
          }
        }}
        onConfirmPartial={handleConfirmPartial}
      />

      {editTarget && editUnified ? (
        <EditOrderSheet
          key={`edit-${editTarget.type}-${editTarget.order.id}`}
          open
          order={editUnified}
          clienti={clientiQuery.data ?? []}
          onOpenChange={(open) => !open && setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            void queryClient.invalidateQueries({ queryKey: queryKeys.comenziManualInLivrare })
            void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrdersInLivrare })
          }}
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
  order: DeliveryItem
  position: number
  isFirst: boolean
  isLast: boolean
  expanded: boolean
  reordering: boolean
  marking: boolean
  onActivateReorder?: () => void
  onEdit?: () => void
  onMarkDelivered?: () => void
  onMoveDown?: () => void
  onMoveUp?: () => void
  onToggleExpand: () => void
}) {
  const whatsappHref = order._shopOrder
    ? buildLivrareWaUrl(order._shopOrder)
    : order.customer_phone
      ? `https://wa.me/4${order.customer_phone.replace(/\D/g, '').replace(/^0/, '')}`
      : null
  const navigationHref = mapsHref(order.delivery_address)
  const address = order.delivery_address?.trim() || 'Adresă necompletată'
  const itemLabel =
    order.items != null
      ? formatItemsHuman(order.items)
      : order.notes?.trim() || 'Comandă manuală'

  return (
    <article
      className={`overflow-hidden rounded-[20px] bg-[var(--surface-card)] shadow-[var(--shadow-soft)] transition ${
        reordering
          ? 'ring-2 ring-[var(--status-warning-text)] ring-offset-2 ring-offset-[var(--surface-page)]'
          : ''
      }`}
    >
      <div className="flex min-h-[82px]">
        {onActivateReorder ? (
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
        ) : (
          <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 bg-[var(--surface-card-muted)] text-[var(--text-secondary)]">
            <span className="text-lg tabular-nums [font-weight:750]">{position}</span>
          </div>
        )}

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
            <span className="shrink-0 text-right">
              {order.cantitate_kg != null ? (
                <span className="block text-xs text-[var(--text-secondary)]">
                  {order.cantitate_kg.toFixed(1)} kg
                </span>
              ) : null}
              <span className="text-[16px] tabular-nums text-[var(--brand-coral)] [font-weight:750]">
                {formatLei(order.total_lei)} lei
              </span>
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

      {order.milestone_reward ? (
        <div className="border-t border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-2 text-sm font-bold text-[var(--status-warning-text)]">
          ⚠️ Include bonus: {order.milestone_reward.reward_label}
        </div>
      ) : null}

      {reordering && onMoveUp && onMoveDown ? (
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
          <p className="mb-3 text-xs leading-relaxed text-[var(--text-secondary)]">{itemLabel}</p>

          <div className="grid grid-cols-2 gap-2">
            {order.customer_phone ? (
              <ActionLink href={phoneHref(order.customer_phone)} icon={Phone} label="Apel" />
            ) : null}
            <ActionLink href={whatsappHref} icon={MessageCircle} label="WhatsApp" external />
            <ActionLink
              href={navigationHref}
              icon={Navigation}
              label="Navigare"
              external
              disabled={!navigationHref}
            />
            {onEdit ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-14 rounded-xl text-sm"
                onClick={onEdit}
              >
                <Pencil className="h-5 w-5" />
                Editează
              </Button>
            ) : null}
          </div>

          {onMarkDelivered ? (
            <Button
              type="button"
              className="mt-2 min-h-14 w-full rounded-xl bg-[var(--agri-primary)] text-base text-white"
              disabled={marking}
              onClick={onMarkDelivered}
            >
              <PackageCheck className="h-5 w-5" />
              {marking ? 'Se marchează...' : 'Marchează livrat'}
            </Button>
          ) : null}
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
  pendingPartial,
  onConfirm,
  onConfirmPartial,
  onOpenChange,
}: {
  order: DeliveryItem | null
  pending: boolean
  pendingPartial: boolean
  onConfirm: () => void
  onConfirmPartial: (kgLivrat: number) => void
  onOpenChange: (open: boolean) => void
}) {
  const [partialMode, setPartialMode] = useState(false)
  const [partialKg, setPartialKg] = useState('')

  useEffect(() => {
    if (!order) {
      setPartialMode(false)
      setPartialKg('')
    }
  }, [order])

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
        {order?.cantitate_kg != null ? (
          !partialMode ? (
            <div className="px-4 pb-4 text-center">
              <button
                type="button"
                className="text-xs text-[var(--text-secondary)] underline underline-offset-2"
                onClick={() => {
                  setPartialMode(true)
                  setPartialKg(String(order.cantitate_kg ?? ''))
                }}
              >
                Livrat parțial →
              </button>
            </div>
          ) : (
            <div className="space-y-3 border-t border-[var(--divider)] px-4 pb-4 pt-3">
              <p className="text-sm text-[var(--text-secondary)]">
                Câți kg ai livrat din {order.cantitate_kg} kg?
              </p>
              <input
                type="number"
                min={0.1}
                max={order.cantitate_kg}
                step={0.1}
                value={partialKg}
                onChange={(event) => setPartialKg(event.target.value)}
                className="w-full rounded-xl border border-[var(--divider)] bg-[var(--surface-input)] px-3 py-2 text-base tabular-nums"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 rounded-xl"
                  onClick={() => setPartialMode(false)}
                >
                  Înapoi
                </Button>
                <Button
                  type="button"
                  className="min-h-11 rounded-xl bg-[var(--agri-primary)] text-white"
                  disabled={
                    !partialKg ||
                    Number(partialKg) <= 0 ||
                    Number(partialKg) > order.cantitate_kg ||
                    pendingPartial
                  }
                  onClick={() => onConfirmPartial(Number(partialKg))}
                >
                  {pendingPartial ? 'Se salvează...' : 'Confirmă parțial'}
                </Button>
              </div>
            </div>
          )
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  )
}
function DeliveredSection({ orders }: { orders: DeliveryItem[] }) {
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
