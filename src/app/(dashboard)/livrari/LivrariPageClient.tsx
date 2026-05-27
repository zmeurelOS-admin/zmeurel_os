'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Phone, RefreshCw, Truck } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { ErrorState } from '@/components/app/ErrorState'
import { EntityListSkeleton } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { Button } from '@/components/ui/button'
import { queryKeys } from '@/lib/query-keys'
import {
  buildDeliverySummary,
  buildLivrareWaUrl,
  formatItemsHuman,
  formatLei,
  formatOrderDate,
  type ShopOrderRow,
} from '@/lib/shop/b2c-order-helpers'
import {
  fetchShopOrdersInLivrare,
} from '@/lib/shop/shop-orders-queries'
import { toast } from '@/lib/ui/toast'

function telHref(phone: string) {
  const digits = phone.replace(/\s/g, '')
  return digits.startsWith('+') ? `tel:${digits}` : `tel:${digits.replace(/^0/, '+40')}`
}

export function LivrariPageClient() {
  const queryClient = useQueryClient()

  const ordersQuery = useQuery({
    queryKey: queryKeys.shopOrdersInLivrare,
    queryFn: fetchShopOrdersInLivrare,
  })

  const orders = ordersQuery.data ?? []
  const totalLei = orders.reduce((sum, order) => sum + order.total_lei, 0)
  const summary = buildDeliverySummary(orders)

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrdersInLivrare })
    void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrdersInLivrareCount })
    void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrders })
  }

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
        <PageHeader
          title="Livrări de azi"
          subtitle={headerSubtitle}
          contentVariant="workspace"
          expandRightSlotOnMobile
          rightSlot={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                refreshAll()
                void ordersQuery.refetch()
              }}
              disabled={ordersQuery.isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${ordersQuery.isFetching ? 'animate-spin' : ''}`} />
              Reîncarcă
            </Button>
          }
        />
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
            <section
              className="rounded-2xl px-4 py-4"
              style={{ background: '#FCE3DF' }}
            >
              <p className="text-sm font-bold text-[var(--text-primary)]">Ce ai de livrat azi:</p>
              <ul className="mt-3 space-y-1.5 text-sm text-[var(--text-primary)]">
                {summary.lines.map((line) => (
                  <li key={line.vid}>
                    • {line.label}: {line.qty} {line.qty === 1 ? 'casetă' : 'casete'}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm font-bold text-[#F16B6B]">
                Total de încasat: {formatLei(summary.totalLei)} lei
              </p>
            </section>

            <div className="space-y-3">
              {orders.map((order) => (
                <DeliveryOrderCard
                  key={order.id}
                  order={order}
                  marking={markDeliveredMutation.isPending && markDeliveredMutation.variables === order.id}
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
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">
              Comenzile apar aici când le marchezi «În livrare» din modulul Comenzi.
            </p>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}

function DeliveryOrderCard({
  order,
  marking,
  onMarkDelivered,
}: {
  order: ShopOrderRow
  marking: boolean
  onMarkDelivered: () => void
}) {
  const waUrl = buildLivrareWaUrl(order)
  const productsLabel = formatItemsHuman(order.items)

  return (
    <article className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{order.customer_name}</h3>
          <a
            href={telHref(order.customer_phone)}
            className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-secondary)] underline-offset-2 hover:underline"
          >
            <Phone className="h-4 w-4 shrink-0" aria-hidden />
            {order.customer_phone}
          </a>
        </div>
        <p className="text-xl font-bold text-[#F16B6B]">{formatLei(order.total_lei)} lei</p>
      </div>

      <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
        <p>
          <span className="font-semibold text-[var(--text-primary)]">Adresă: </span>
          {order.delivery_address?.trim() || '—'}
        </p>
        <p>
          <span className="font-semibold text-[var(--text-primary)]">Produse: </span>
          {productsLabel}
        </p>
        <p className="text-xs text-[var(--text-tertiary)]">{formatOrderDate(order.created_at)}</p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition active:scale-[0.98]"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          Trimite mesaj WhatsApp
        </a>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1 gap-2 rounded-full font-semibold"
          disabled={marking}
          onClick={onMarkDelivered}
        >
          <Truck className="h-4 w-4" aria-hidden />
          {marking ? 'Se salvează…' : 'Marchează livrată'}
        </Button>
      </div>
    </article>
  )
}
