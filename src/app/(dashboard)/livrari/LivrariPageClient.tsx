'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, GripVertical, RefreshCw } from 'lucide-react'
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { AppShell } from '@/components/app/AppShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { ErrorState } from '@/components/app/ErrorState'
import { EntityListSkeleton } from '@/components/app/ListSkeleton'
import { EditOrderSheet } from '@/components/comenzi/EditOrderSheet'
import { PaymentStatusToggle } from '@/components/comenzi/PaymentStatusToggle'
import { UnifiedOrderCard } from '@/components/comenzi/UnifiedOrderCard'
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
  getUnifiedOrderEffectiveDate,
  KG_PER_CASEROLĂ,
  mapB2bToUnified,
  mapShopToUnified,
  type UnifiedOrderItem,
} from '@/lib/comenzi/unified-orders'
import { queryKeys } from '@/lib/query-keys'
import {
  formatItemsHuman,
  formatLei,
  todayBucharestDate,
  type ShopOrderStatus,
  type ShopOrderRow,
} from '@/lib/shop/b2c-order-helpers'
import {
  fetchShopOrdersInLivrare,
  fetchShopOrdersScheduledToday,
  reorderShopDeliveriesToday,
} from '@/lib/shop/shop-orders-queries'
import { getClienți, type Client } from '@/lib/supabase/queries/clienti'
import {
  deliverComanda,
  deliverShopOrderPartial,
  fetchComenziManualInLivrare,
  updateComanda,
  type Comanda,
  type ComandaPaymentStatus,
} from '@/lib/supabase/queries/comenzi'
import { toast } from '@/lib/ui/toast'

type EditTarget =
  | { type: 'shop'; order: ShopOrderRow }
  | { type: 'manual'; order: Comanda }
  | null

type DeliveryTarget = UnifiedOrderItem & {
  total_lei: number
  cantitate_kg: number
  customer_name: string
  delivery_address: string | null
  _shopOrder?: ShopOrderRow
  _comanda?: Comanda
}

function getDeliverableKg(order: UnifiedOrderItem): number {
  if (order.source === 'shop') {
    return Math.round(order.quantity * KG_PER_CASEROLĂ * 100) / 100
  }
  return Math.round(order.quantity * 100) / 100
}

function compareUnifiedDeliveryFifo(a: UnifiedOrderItem, b: UnifiedOrderItem): number {
  const aDate = Date.parse(`${getUnifiedOrderEffectiveDate(a)}T12:00:00.000Z`)
  const bDate = Date.parse(`${getUnifiedOrderEffectiveDate(b)}T12:00:00.000Z`)
  if (aDate !== bDate) return aDate - bDate

  const createdDiff = Date.parse(a.createdAt) - Date.parse(b.createdAt)
  if (createdDiff !== 0) return createdDiff

  return a.id.localeCompare(b.id)
}

async function patchShopOrder(input: {
  id: string
  status?: ShopOrderStatus
  delivery_date?: string | null
  notified_wa?: boolean
  status_plata?: ComandaPaymentStatus
}): Promise<void> {
  const response = await fetch(`/api/shop/b2c/orders/${input.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = (await response.json()) as { success?: boolean; error?: string }
  if (!response.ok || !json.success) {
    throw new Error(json.error ?? 'Nu am putut actualiza comanda din shop.')
  }
}

function toDeliveryTarget(order: UnifiedOrderItem): DeliveryTarget {
  const deliveryAddress =
    order.source === 'shop'
      ? [order.shopOrder?.delivery_address?.trim(), order.shopOrder?.delivery_city?.trim()]
          .filter(Boolean)
          .join(', ') || null
      : order.b2bComanda?.locatie_livrare?.trim() || null

  return {
    ...order,
    total_lei: order.totalLei,
    cantitate_kg: getDeliverableKg(order),
    customer_name: order.customerName,
    delivery_address: deliveryAddress,
    _shopOrder: order.shopOrder,
    _comanda: order.b2bComanda,
  }
}

export function LivrariPageClient() {
  const queryClient = useQueryClient()
  const { tenantId } = useDashboardAuth()
  const [deliverTarget, setDeliverTarget] = useState<DeliveryTarget | null>(null)
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [deliveredInSession, setDeliveredInSession] = useState<DeliveryTarget[]>([])
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
  const deliveryItems = useMemo(
    () =>
      [
        ...manualOrders.map((comanda) => mapB2bToUnified(comanda, clientMap)),
        ...shopOrders.map((order) => mapShopToUnified(order)),
      ].sort(compareUnifiedDeliveryFifo),
    [clientMap, manualOrders, shopOrders],
  )
  const editUnified = useMemo(() => {
    if (!editTarget) return null
    if (editTarget.type === 'shop') return mapShopToUnified(editTarget.order)
    return mapB2bToUnified(editTarget.order, clientMap)
  }, [clientMap, editTarget])
  const totalLei = deliveryItems.reduce((sum, order) => sum + order.totalLei, 0)
  const kgB2b = deliveryItems
    .filter((item) => item.source === 'b2b' && (item.clientTip === 'patiserie' || item.clientTip === 'magazin'))
    .reduce((sum, item) => sum + getDeliverableKg(item), 0)
  const kgClienti = deliveryItems
    .filter((item) => item.source === 'b2b' && item.clientTip === 'standard')
    .reduce((sum, item) => sum + getDeliverableKg(item), 0)
  const kgShop = deliveryItems
    .filter((item) => item.source === 'shop')
    .reduce((sum, item) => sum + getDeliverableKg(item), 0)
  const [isReorderMode, setIsReorderMode] = useState(false)
  const [customOrderIds, setCustomOrderIds] = useState<string[]>([])

  useEffect(() => {
    if (!tenantId) return
    const today = new Date().toISOString().slice(0, 10)
    const stored = localStorage.getItem(`livrari-order-${tenantId}-${today}`)
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCustomOrderIds(JSON.parse(stored) as string[])
      } catch {}
    }
  }, [tenantId])

  const saveOrder = useCallback(
    (ids: string[]) => {
      if (!tenantId) return
      const today = new Date().toISOString().slice(0, 10)
      localStorage.setItem(`livrari-order-${tenantId}-${today}`, JSON.stringify(ids))
      setCustomOrderIds(ids)
      console.log('[reorder] saveOrder called, wrote to localStorage + setCustomOrderIds', ids)
    },
    [tenantId],
  )

  console.log('[reorder] render, customOrderIds =', customOrderIds)

  const orderedDeliveryItems = useMemo(() => {
    if (customOrderIds.length === 0) return deliveryItems
    const idMap = new Map(deliveryItems.map((item) => [item.id, item]))
    const result: typeof deliveryItems = []
    for (const id of customOrderIds) {
      const item = idMap.get(id)
      if (item) result.push(item)
    }
    for (const item of deliveryItems) {
      if (!customOrderIds.includes(item.id)) result.push(item)
    }
    return result
  }, [customOrderIds, deliveryItems])

  const reorderShopDeliveriesMutation = useMutation({
    mutationFn: reorderShopDeliveriesToday,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrdersInLivrare })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Nu am putut salva ordinea livrărilor pentru livrator.')
      void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrdersInLivrare })
    },
  })

  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null)
      const { active, over } = event
      const ids = orderedDeliveryItems.map((i) => i.id)
      const from = ids.indexOf(active.id as string)
      const to = over ? ids.indexOf(over.id as string) : -1
      console.log('[reorder] dragEnd', {
        activeId: active.id,
        overId: over?.id ?? null,
        from,
        to,
        idsBeforeDrag: ids,
      })
      if (!over || active.id === over.id) return
      if (from === -1 || to === -1) return
      const newIds = arrayMove(ids, from, to)
      console.log('[reorder] newIds after arrayMove', newIds)
      saveOrder(newIds)

      const today = todayBucharestDate()
      const itemById = new Map(orderedDeliveryItems.map((item) => [item.id, item]))
      const shopOrderIdsToday = newIds.filter((id) => {
        const item = itemById.get(id)
        return item?.source === 'shop' && getUnifiedOrderEffectiveDate(item) === today
      })
      if (shopOrderIdsToday.length > 0) {
        reorderShopDeliveriesMutation.mutate(shopOrderIdsToday)
      }
    },
    [orderedDeliveryItems, saveOrder, reorderShopDeliveriesMutation],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const measuring = useMemo(
    () => ({ droppable: { strategy: MeasuringStrategy.Always } }),
    [],
  )

  const orderedOrders = useMemo(
    () => orderedDeliveryItems.map(toDeliveryTarget),
    [orderedDeliveryItems],
  )
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

  const patchShopOrderMutation = useMutation({
    mutationFn: patchShopOrder,
    onSuccess: (_, variables) => {
      if (variables.delivery_date !== undefined) {
        toast.success(
          variables.delivery_date
            ? 'Data livrării a fost actualizată.'
            : 'Data livrării a fost ștearsă.',
        )
      }
      refreshAll()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const updateManualOrderMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateComanda>[1] }) =>
      updateComanda(id, payload),
    onSuccess: (_, variables) => {
      if (variables.payload.data_livrare !== undefined) {
        toast.success(
          variables.payload.data_livrare
            ? 'Data livrării a fost actualizată.'
            : 'Data livrării a fost ștearsă.',
        )
      }
      refreshAll()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const markDeliveredMutation = useMutation({
    mutationFn: async ({
      order,
      statusPlata,
    }: {
      order: ShopOrderRow
      statusPlata: ComandaPaymentStatus
    }) => {
      const response = await fetch(`/api/shop/b2c/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'livrata', status_plata: statusPlata }),
      })
      const json = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Nu am putut marca livrarea.')
      }
      return order
    },
    onMutate: async ({ order }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.shopOrdersInLivrare })
      const previous = queryClient.getQueryData<ShopOrderRow[]>(queryKeys.shopOrdersInLivrare)
      const previousCount = queryClient.getQueryData<number>(
        queryKeys.shopOrdersInLivrareCount,
      )
      queryClient.setQueryData<ShopOrderRow[]>(
        queryKeys.shopOrdersInLivrare,
        (current) => current?.filter((item) => item.id !== order.id) ?? [],
      )
      queryClient.setQueryData<number>(queryKeys.shopOrdersInLivrareCount, (current) =>
        Math.max(0, (current ?? 1) - 1),
      )
      setDeliveredInSession((current) => [
        toDeliveryTarget(mapShopToUnified({ ...order, status: 'livrata' })),
        ...current.filter((item) => item.id !== order.id),
      ])
      setDeliverTarget(null)
      return { previous, previousCount, order }
    },
    onSuccess: () => {
      toast.success('Comandă livrată')
      refreshAll()
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.shopOrdersInLivrare, context.previous)
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(queryKeys.shopOrdersInLivrareCount, context.previousCount)
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
    mutationFn: async ({
      comanda,
      kgLivrat,
      statusPlata,
    }: {
      comanda: Comanda
      kgLivrat: number
      statusPlata: ComandaPaymentStatus
    }) =>
      deliverComanda({
        comandaId: comanda.id,
        cantitateLivrataKg: kgLivrat,
        statusPlata,
        dataLivrareRamasa: null,
      }),
    onSuccess: (result) => {
      toast.success('Livrare parțială înregistrată')
      setDeliveredInSession((current) => [
        toDeliveryTarget(mapB2bToUnified(result.deliveredOrder, clientMap)),
        ...current.filter((item) => item.id !== result.deliveredOrder.id),
      ])
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
      statusPlata,
    }: {
      shopOrder: ShopOrderRow
      kgLivrat: number
      statusPlata: ComandaPaymentStatus
    }) =>
      deliverShopOrderPartial({
        shopOrderId: shopOrder.id,
        deliveredKg: kgLivrat,
        statusPlata,
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
    (kgLivrat: number, statusPlata: ComandaPaymentStatus) => {
      if (!deliverTarget) return
      if (deliverTarget.b2bComanda) {
        deliverPartialManualMutation.mutate({
          comanda: deliverTarget.b2bComanda,
          kgLivrat,
          statusPlata,
        })
        return
      }
      if (deliverTarget.shopOrder) {
        deliverPartialShopMutation.mutate({
          shopOrder: deliverTarget.shopOrder,
          kgLivrat,
          statusPlata,
        })
      }
    },
    [deliverPartialManualMutation, deliverPartialShopMutation, deliverTarget],
  )

  const handleManualStatusChange = useCallback(
    (id: string, status: Parameters<typeof updateComanda>[1]['status']) => {
      const order = deliveryItems.find((item) => item.id === id && item.source === 'b2b')
      if (!order?.b2bComanda || !status) return
      if (status === 'livrata') {
        setDeliverTarget(toDeliveryTarget(order))
        return
      }
      updateManualOrderMutation.mutate({ id, payload: { status } })
    },
    [deliveryItems, updateManualOrderMutation],
  )

  const handleShopStatusChange = useCallback(
    (id: string, status: ShopOrderStatus) => {
      const order = deliveryItems.find((item) => item.id === id && item.source === 'shop')
      if (!order?.shopOrder) return
      if (status === 'livrata') {
        setDeliverTarget(toDeliveryTarget(order))
        return
      }
      patchShopOrderMutation.mutate({ id, status })
    },
    [deliveryItems, patchShopOrderMutation],
  )

  const headerSubtitle =
    deliveryItems.length === 0
      ? deliveredInSession.length > 0
        ? 'Traseul este gata'
        : 'Nicio comandă în drum'
      : [
          kgB2b > 0 ? `${kgB2b.toFixed(1)} kg B2B` : null,
          kgClienti > 0 ? `${kgClienti.toFixed(1)} kg clienți` : null,
          kgShop > 0 ? `${kgShop.toFixed(1)} kg shop` : null,
        ].filter(Boolean).join(' · ') + ` · ${formatLei(totalLei)} lei`

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
                    {deliveryItems.length}{' '}
                    {deliveryItems.length === 1 ? 'comandă' : 'comenzi'} · {formatLei(totalLei)} lei
                  </p>
                </div>
                {isReorderMode ? (
                  <Button
                    type="button"
                    className="min-h-11 rounded-xl bg-[var(--agri-primary)] px-4 text-white"
                    onClick={() => setIsReorderMode(false)}
                  >
                    <Check />
                    Gata
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 rounded-xl px-4"
                    onClick={() => setIsReorderMode(true)}
                  >
                    <GripVertical className="h-4 w-4" />
                    Reordonează
                  </Button>
                )}
              </div>
            </header>

            {isReorderMode ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                measuring={measuring}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragCancel={() => setActiveDragId(null)}
              >
                <SortableContext
                  items={orderedOrders.map((o) => o.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {orderedOrders.map((order, index) => (
                      <SortableDeliveryCard key={order.id} id={order.id} position={index + 1}>
                        <UnifiedOrderCard
                          item={order}
                          disabled
                          onB2bStatusChange={handleManualStatusChange}
                          onB2bDeliveryDateChange={() => undefined}
                          onShopStatusChange={handleShopStatusChange}
                          onShopConfirmedChange={() => undefined}
                          onShopNotifiedChange={() => undefined}
                          onShopDeliveryDateChange={() => undefined}
                          onEdit={() => undefined}
                        />
                      </SortableDeliveryCard>
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeDragId
                    ? (() => {
                        const activeOrder = orderedOrders.find((o) => o.id === activeDragId)
                        if (!activeOrder) return null
                        return (
                          <div className="rounded-xl shadow-2xl">
                            <UnifiedOrderCard
                              item={activeOrder}
                              disabled
                              onB2bStatusChange={() => undefined}
                              onB2bDeliveryDateChange={() => undefined}
                              onShopStatusChange={() => undefined}
                              onShopConfirmedChange={() => undefined}
                              onShopNotifiedChange={() => undefined}
                              onShopDeliveryDateChange={() => undefined}
                              onEdit={() => undefined}
                            />
                          </div>
                        )
                      })()
                    : null}
                </DragOverlay>
              </DndContext>
            ) : (
              <div className="space-y-2.5">
                {orderedOrders.map((order) => (
                  <UnifiedOrderCard
                    key={`${order.source}-${order.id}`}
                    item={order}
                    disabled={
                      markDeliveredMutation.isPending ||
                      deliverPartialManualMutation.isPending ||
                      deliverPartialShopMutation.isPending ||
                      patchShopOrderMutation.isPending ||
                      updateManualOrderMutation.isPending
                    }
                    onB2bStatusChange={handleManualStatusChange}
                    onB2bDeliveryDateChange={(id, data_livrare) => {
                      updateManualOrderMutation.mutate({ id, payload: { data_livrare } })
                    }}
                    onShopStatusChange={handleShopStatusChange}
                    onShopConfirmedChange={(id, confirmed) => {
                      patchShopOrderMutation.mutate({ id, notified_wa: confirmed })
                    }}
                    onShopNotifiedChange={(id, notified) => {
                      patchShopOrderMutation.mutate({ id, notified_wa: notified })
                    }}
                    onShopDeliveryDateChange={(id, delivery_date) => {
                      patchShopOrderMutation.mutate({ id, delivery_date })
                    }}
                    onEdit={(_, source) => {
                      if (source === 'shop' && order.shopOrder) {
                        setEditTarget({ type: 'shop', order: order.shopOrder })
                        return
                      }
                      if (source === 'manual' && order.b2bComanda) {
                        setEditTarget({ type: 'manual', order: order.b2bComanda })
                      }
                    }}
                  />
                ))}
              </div>
            )}
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
        key={deliverTarget ? `${deliverTarget.source}-${deliverTarget.id}` : 'closed'}
        order={deliverTarget}
        pending={
          markDeliveredMutation.isPending ||
          (Boolean(deliverTarget?.b2bComanda) && deliverPartialManualMutation.isPending)
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
        onConfirm={(statusPlata) => {
          if (deliverTarget?.shopOrder) {
            markDeliveredMutation.mutate({
              order: deliverTarget.shopOrder,
              statusPlata,
            })
            return
          }
          if (deliverTarget?.b2bComanda) {
            const kg = getDeliverableKg(deliverTarget)
            if (kg > 0) {
              handleConfirmPartial(kg, statusPlata)
            } else {
              toast.error('Comanda nu are cantitate configurată. Editează comanda înainte de livrare.')
            }
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

function SortableDeliveryCard({
  id,
  position,
  children,
}: {
  id: string
  position: number
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl ${isDragging ? 'opacity-0' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex h-11 touch-none cursor-grab items-center justify-between rounded-t-xl bg-[var(--agri-primary)] px-4 active:cursor-grabbing"
        aria-label={`Poziția ${position} — trage pentru a reordona`}
      >
        <span className="text-sm text-white [font-weight:700]">#{position}</span>
        <GripVertical className="h-5 w-5 text-white/80" />
      </div>
      <div className="[&>article]:rounded-t-none">{children}</div>
    </div>
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
  order: DeliveryTarget | null
  pending: boolean
  pendingPartial: boolean
  onConfirm: (statusPlata: ComandaPaymentStatus) => void
  onConfirmPartial: (kgLivrat: number, statusPlata: ComandaPaymentStatus) => void
  onOpenChange: (open: boolean) => void
}) {
  const [partialMode, setPartialMode] = useState(false)
  const [partialKg, setPartialKg] = useState('')
  const [statusPlata, setStatusPlata] = useState<ComandaPaymentStatus>('platit')

  return (
    <AlertDialog open={order !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <AlertDialogHeader>
          <AlertDialogTitle>Marchezi comanda ca livrată?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <div className="rounded-2xl bg-[var(--brand-green-soft)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Sumă de încasat</p>
                <p className="mt-1 text-2xl tabular-nums text-[var(--agri-primary)] [font-weight:750]">
                  {order ? `${formatLei(order.total_lei)} lei` : '—'}
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Cantitate livrată: {order ? `${order.cantitate_kg} kg` : '—'}
                </p>
              </div>
              <PaymentStatusToggle
                value={statusPlata}
                onChange={setStatusPlata}
                disabled={pending || pendingPartial}
              />
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
              onConfirm(statusPlata)
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
                  onClick={() => onConfirmPartial(Number(partialKg), statusPlata)}
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
function DeliveredSection({ orders }: { orders: DeliveryTarget[] }) {
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