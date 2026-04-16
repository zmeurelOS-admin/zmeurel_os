'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { CheckCircle2, GripVertical, MessageCircle, Phone, Truck } from 'lucide-react'

import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
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
  type AssociationOrder,
} from '@/lib/association/queries'
import { readDeliveryLocalOrder, writeDeliveryLocalOrder, mergeDeliveryLocalOrder } from '@/lib/association/delivery-local-order'
import type { AssociationPublicSettings } from '@/lib/association/public-settings'
import {
  formatAssociationDeliveryDays,
} from '@/lib/association/public-settings'
import {
  getNextAssociationDeliveryDayLabel,
  isAssociationDeliveryDayToday,
} from '@/lib/shop/association/delivery'
import { toast } from '@/lib/ui/toast'

type Props = {
  initialOrders: AssociationOrder[]
  settings: AssociationPublicSettings
}

type DeliveryFetchResponse = {
  ok?: boolean
  data?: {
    orders?: AssociationOrder[]
    settings?: AssociationPublicSettings
  }
  error?: {
    message?: string
  }
}

function shortOrderId(id: string, shortId: string | null): string {
  return shortId?.trim() || id.replace(/-/g, '').slice(0, 8).toUpperCase()
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatLei(value: number): string {
  return `${new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))} lei`
}

const WEIGHT_UNITS = new Set(['kg', 'g', 'gram', 'grame', 'kilogram', 'kilograme'])

function formatQty(qty: number, unitLabel: string): string {
  const u = unitLabel.toLowerCase().trim()
  if (WEIGHT_UNITS.has(u)) {
    const n = Number(qty)
    if (Number.isNaN(n)) return '0'
    if (n % 1 === 0) return n.toFixed(0)
    return n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  }
  return Math.round(qty).toString()
}

function normalizePhoneForTel(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/[^\d+]/g, '')
  return digits.length >= 7 ? digits : null
}

function normalizePhoneForWhatsApp(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('40')) return digits
  if (digits.startsWith('0')) return `4${digits}`
  return digits
}

function buildStorageScope(settings: AssociationPublicSettings): string {
  return `delivery:${settings.deliveryDays.join('-')}`
}

function filterActiveOrders(orders: AssociationOrder[]): AssociationOrder[] {
  return orders.filter((order) => order.status === 'confirmata' || order.status === 'in_livrare')
}

function sortOrdersWithLocalPreference(orders: AssociationOrder[], settings: AssociationPublicSettings) {
  return mergeDeliveryLocalOrder(orders, readDeliveryLocalOrder(buildStorageScope(settings)))
}

type SortableDeliveryCardProps = {
  order: AssociationOrder
  expanded: boolean
  disabledDeliver: boolean
  onToggleExpand: () => void
  onDeliver: () => void
}

function SortableDeliveryCard({
  order,
  expanded,
  disabledDeliver,
  onToggleExpand,
  onDeliver,
}: SortableDeliveryCardProps) {
  const controls = useDragControls()
  const holdTimerRef = useRef<number | null>(null)
  const telHref = normalizePhoneForTel(order.telefon)
  const whatsappPhone = normalizePhoneForWhatsApp(order.telefon)

  const clearHoldTimer = () => {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  return (
    <Reorder.Item
      value={order}
      dragControls={controls}
      dragListener={false}
      className="list-none"
      whileDrag={{ scale: 1.01, boxShadow: '0 18px 34px rgba(12,15,19,0.14)' }}
    >
      <article
        className="overflow-hidden rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[0_12px_28px_rgba(12,15,19,0.08)]"
      >
        <div className="flex items-start gap-3 px-4 pb-3 pt-4">
          <button
            type="button"
            aria-label="Reordonează traseul"
            className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--surface-card-muted)] text-[var(--text-secondary)] active:scale-[0.96]"
            onPointerDown={(event) => {
              clearHoldTimer()
              const nativeEvent = event.nativeEvent
              holdTimerRef.current = window.setTimeout(() => {
                controls.start(nativeEvent)
              }, 180)
            }}
            onPointerUp={clearHoldTimer}
            onPointerCancel={clearHoldTimer}
            onPointerLeave={clearHoldTimer}
          >
            <GripVertical className="h-5 w-5" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onToggleExpand}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--surface-card-muted)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-secondary)]">
                #{shortOrderId(order.id, order.numar_comanda_scurt)}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  order.status === 'in_livrare'
                    ? 'bg-[rgba(13,99,66,0.12)] text-[#0D6342]'
                    : 'bg-[rgba(179,90,0,0.12)] text-[#B35A00]'
                }`}
              >
                {order.status === 'in_livrare' ? 'În livrare' : 'Confirmată'}
              </span>
            </div>
            <p className="mt-3 text-lg leading-tight [font-weight:750] text-[var(--text-primary)]">
              {order.clientName ?? 'Client necunoscut'}
            </p>
            <p className="mt-1 text-sm leading-snug text-[var(--text-secondary)]">
              {order.localitate ?? order.locatie_livrare ?? 'Adresă lipsă'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-secondary)]">
              <span>{order.lineCount} produse</span>
              <span>{formatLei(order.total)}</span>
              <span>{formatDate(order.data_livrare)}</span>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <a
            href={telHref ? `tel:${telHref}` : undefined}
            className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border text-sm font-semibold ${
              telHref
                ? 'border-[rgba(24,104,219,0.22)] bg-[rgba(24,104,219,0.08)] text-[#1868DB]'
                : 'pointer-events-none border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-muted)]'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <Phone className="h-4 w-4" aria-hidden />
            Apel
          </a>
          <a
            href={whatsappPhone ? `https://wa.me/${whatsappPhone}` : undefined}
            target="_blank"
            rel="noreferrer"
            className={`flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border text-sm font-semibold ${
              whatsappPhone
                ? 'border-[rgba(13,155,92,0.22)] bg-[rgba(13,155,92,0.08)] text-[#0D9B5C]'
                : 'pointer-events-none border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-muted)]'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            WhatsApp
          </a>
          <Button
            type="button"
            className={`col-span-2 min-h-[52px] rounded-2xl text-base font-bold ${
              disabledDeliver
                ? 'bg-[var(--surface-card-muted)] text-[var(--text-muted)] hover:bg-[var(--surface-card-muted)]'
                : 'bg-[#0D9B5C] text-white hover:bg-[#0C8B54]'
            }`}
            disabled={disabledDeliver}
            onClick={(event) => {
              event.stopPropagation()
              if (!disabledDeliver) {
                onDeliver()
              }
            }}
          >
            {disabledDeliver ? 'Pornește livrarea întâi' : '✅ Marchează LIVRAT'}
          </Button>
        </div>

        {expanded ? (
          <div className="border-t border-[var(--border-default)] bg-[var(--surface-card-muted)] px-4 py-4">
            <div className="space-y-2">
              {order.lines.map((line) => (
                <div key={line.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text-primary)]">{line.productName}</p>
                    <p className="mt-0.5 text-[var(--text-secondary)]">{line.farmName ?? 'Fermă locală'}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-[var(--text-primary)]">
                    {formatQty(line.qtyKg, line.unitLabel)} {line.unitLabel}
                  </span>
                </div>
              ))}
            </div>
            {order.customerNote ? (
              <div className="mt-4 rounded-2xl bg-white px-3 py-3 text-sm text-[var(--text-secondary)] shadow-[0_8px_20px_rgba(12,15,19,0.05)]">
                <p className="mb-1 font-semibold text-[var(--text-primary)]">Notă client</p>
                <p className="whitespace-pre-wrap">{order.customerNote}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </article>
    </Reorder.Item>
  )
}

export function AssociationLivrariClient({ initialOrders, settings: initialSettings }: Props) {
  const [settings, setSettings] = useState(initialSettings)
  const [activeOrders, setActiveOrders] = useState<AssociationOrder[]>(
    sortOrdersWithLocalPreference(initialOrders, initialSettings),
  )
  const [deliveredArchive, setDeliveredArchive] = useState<AssociationOrder[]>([])
  const [expandedOrderIds, setExpandedOrderIds] = useState<string[]>([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [deliverTarget, setDeliverTarget] = useState<AssociationOrder | null>(null)
  const [loading, setLoading] = useState(false)

  const todayIsDeliveryDay = useMemo(() => isAssociationDeliveryDayToday(settings), [settings])
  const nextDeliveryDayLabel = useMemo(
    () => getNextAssociationDeliveryDayLabel(settings, new Date(), { includeToday: !todayIsDeliveryDay }),
    [settings, todayIsDeliveryDay],
  )

  const confirmataCount = useMemo(
    () => activeOrders.filter((order) => order.status === 'confirmata').length,
    [activeOrders],
  )
  const totalTracked = activeOrders.length + deliveredArchive.length
  const deliveredCount = deliveredArchive.length
  const progressPercent = totalTracked > 0 ? Math.round((deliveredCount / totalTracked) * 100) : 0

  useEffect(() => {
    writeDeliveryLocalOrder(buildStorageScope(settings), activeOrders.map((order) => order.id))
  }, [activeOrders, settings])

  const toggleExpanded = (orderId: string) => {
    setExpandedOrderIds((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    )
  }

  const reloadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/association/deliveries', {
        credentials: 'same-origin',
      })

      const json = (await res.json().catch(() => null)) as DeliveryFetchResponse | null
      if (!res.ok || !json?.ok || !json.data?.orders || !json.data.settings) {
        const message = json?.error?.message
        toast.error(typeof message === 'string' ? message : 'Nu am putut reîmprospăta livrările.')
        return
      }

      setSettings(json.data.settings)
      setActiveOrders(sortOrdersWithLocalPreference(filterActiveOrders(json.data.orders), json.data.settings))
    } finally {
      setLoading(false)
    }
  }

  const handleBulkStart = async () => {
    if (confirmataCount === 0) {
      setBulkOpen(false)
      return
    }

    setLoading(true)
    try {
      const groups = activeOrders.map((order) => ({
        orderId: order.id,
        lineIds: order.lines.map((line) => line.id),
      }))

      const res = await fetch('/api/association/deliveries', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          action: 'start_all',
          groups,
        }),
      })

      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; data?: { startedCount?: number }; error?: { message?: string } }
        | null

      if (!res.ok || !json?.ok) {
        const message = json?.error?.message
        toast.error(typeof message === 'string' ? message : 'Nu am putut porni livrările.')
        return
      }

      toast.success(
        json.data?.startedCount
          ? `Livrarea a pornit pentru ${json.data.startedCount} ${json.data.startedCount === 1 ? 'comandă' : 'comenzi'}.`
          : 'Nu existau comenzi confirmate de pornit.',
      )
      setBulkOpen(false)
      await reloadData()
    } finally {
      setLoading(false)
    }
  }

  const handleDeliver = async () => {
    if (!deliverTarget) return

    setLoading(true)
    try {
      const res = await fetch('/api/association/deliveries/deliver', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          Origin: window.location.origin,
        },
        body: JSON.stringify({
          orderId: deliverTarget.id,
          lineIds: deliverTarget.lines.map((line) => line.id),
          clientName: deliverTarget.clientName ?? undefined,
          orderLabel: `#${shortOrderId(deliverTarget.id, deliverTarget.numar_comanda_scurt)}`,
        }),
      })

      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; data?: { warnings?: string[] }; error?: { message?: string } }
        | null

      if (!res.ok || !json?.ok) {
        const message = json?.error?.message
        toast.error(typeof message === 'string' ? message : 'Nu am putut marca livrarea.')
        return
      }

      setActiveOrders((current) => current.filter((order) => order.id !== deliverTarget.id))
      setDeliveredArchive((current) => [deliverTarget, ...current])
      setExpandedOrderIds((current) => current.filter((id) => id !== deliverTarget.id))

      if (Array.isArray(json.data?.warnings) && json.data.warnings.length > 0) {
        toast.success(`Comanda #${shortOrderId(deliverTarget.id, deliverTarget.numar_comanda_scurt)} a fost livrată. Au rămas avertismente de stoc.`)
      } else {
        toast.success(`Comanda #${shortOrderId(deliverTarget.id, deliverTarget.numar_comanda_scurt)} livrată cu succes.`)
      }

      setDeliverTarget(null)
      void reloadData()
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell
      header={
        <PageHeader
          title="Livrări azi"
          subtitle="Comenzi active pentru traseul livratorului"
          rightSlot={
            <span className="rounded-full bg-white/16 px-3 py-1 text-xs font-bold text-[var(--text-on-accent)]">
              {activeOrders.length} comenzi
            </span>
          }
          expandRightSlotOnMobile
        />
      }
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 pb-28 pt-3">
        <section
          className={`rounded-[26px] px-4 py-4 shadow-[0_12px_28px_rgba(12,15,19,0.08)] ${
            todayIsDeliveryDay ? 'bg-[#EAF7EF] text-[#0D6342]' : 'bg-[#FFF4E8] text-[#B35A00]'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                todayIsDeliveryDay ? 'bg-white/70' : 'bg-white/80'
              }`}
            >
              <Truck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold">
                {todayIsDeliveryDay
                  ? 'Azi e zi de livrare!'
                  : `Azi nu e zi de livrare. Următoarea livrare: ${nextDeliveryDayLabel}`}
              </p>
              <p className="mt-1 text-xs opacity-80">
                Zile configurate: {formatAssociationDeliveryDays(settings.deliveryDays)}
              </p>
            </div>
          </div>
        </section>

        <section className="sticky top-0 z-10 rounded-[26px] bg-[var(--surface-card)]/95 px-3 py-3 shadow-[0_12px_28px_rgba(12,15,19,0.08)] backdrop-blur">
          <Button
            type="button"
            className="min-h-[54px] w-full rounded-2xl bg-[#0D6342] text-base font-bold text-white hover:bg-[#0B5538] disabled:bg-[var(--surface-card-muted)] disabled:text-[var(--text-muted)]"
            disabled={confirmataCount === 0 || loading}
            onClick={() => setBulkOpen(true)}
          >
            Pornește livrarea ({confirmataCount} {confirmataCount === 1 ? 'comandă' : 'comenzi'})
          </Button>
        </section>

        {activeOrders.length === 0 ? (
          <section className="rounded-[28px] border border-dashed border-[var(--border-default)] bg-[var(--surface-card)] px-6 py-12 text-center shadow-[0_12px_28px_rgba(12,15,19,0.05)]">
            <p className="text-lg [font-weight:750] text-[var(--text-primary)]">Nu ai comenzi active de livrat</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Când apar comenzi confirmate sau în livrare, le vei vedea aici.
            </p>
          </section>
        ) : (
          <Reorder.Group
            axis="y"
            values={activeOrders}
            onReorder={(nextOrder) => setActiveOrders(nextOrder)}
            className="grid gap-4 md:grid-cols-2"
          >
            {activeOrders.map((order) => (
              <SortableDeliveryCard
                key={order.id}
                order={order}
                expanded={expandedOrderIds.includes(order.id)}
                disabledDeliver={order.status !== 'in_livrare' || loading}
                onToggleExpand={() => toggleExpanded(order.id)}
                onDeliver={() => setDeliverTarget(order)}
              />
            ))}
          </Reorder.Group>
        )}

        {deliveredArchive.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <CheckCircle2 className="h-4 w-4 text-[#0D9B5C]" aria-hidden />
              <p className="text-sm font-semibold text-[var(--text-primary)]">Livrate în sesiunea asta</p>
            </div>
            <div className="space-y-3">
              {deliveredArchive.map((order) => (
                <article
                  key={`delivered-${order.id}`}
                  className="rounded-[24px] border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-4 py-4 opacity-80"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold line-through text-[var(--text-secondary)]">
                        #{shortOrderId(order.id, order.numar_comanda_scurt)} · {order.clientName ?? 'Client'}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{formatLei(order.total)}</p>
                    </div>
                    <span className="rounded-full bg-[rgba(13,155,92,0.12)] px-2.5 py-1 text-[11px] font-bold text-[#0D9B5C]">
                      Livrată
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--border-default)] bg-[var(--surface-card)]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur md:left-auto md:right-auto md:mx-auto md:max-w-6xl md:rounded-t-[28px]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Livrate: {deliveredCount} / {totalTracked}
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {loading ? 'Se sincronizează…' : 'Ordinea cardurilor rămâne salvată doar pe acest dispozitiv.'}
              </p>
            </div>
            <span className="text-sm font-bold text-[#0D6342]">{progressPercent}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-card-muted)]">
            <div
              className="h-full rounded-full bg-[#0D9B5C] transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </section>
      </div>

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pornești livrarea pentru toate comenzile confirmate?</AlertDialogTitle>
            <AlertDialogDescription>
              Vor fi trecute în statusul „În livrare” toate comenzile confirmate vizibile în ecranul curent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleBulkStart()}>
              Pornește livrarea
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deliverTarget != null} onOpenChange={(open) => !open && setDeliverTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmi livrarea?</AlertDialogTitle>
            <AlertDialogDescription>
              {deliverTarget
                ? `Confirmi livrarea comenzii #${shortOrderId(deliverTarget.id, deliverTarget.numar_comanda_scurt)} către ${deliverTarget.clientName ?? 'client'}?`
                : 'Confirmi livrarea acestei comenzi?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeliver()}>
              Marchează livrat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
