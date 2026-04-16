'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, Phone, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { AppDialog } from '@/components/app/AppDialog'
import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import { SearchField } from '@/components/ui/SearchField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import StatusBadge from '@/components/ui/StatusBadge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
import {
  ASSOCIATION_ORDER_STATUS_LABELS,
  ASSOCIATION_ORDER_STATUS_VARIANTS,
  getAllowedAssociationOrderTransitions,
  type AssociationOrderStatus,
} from '@/lib/association/order-status'
import type { AssociationOrder, AssociationOrderLine, AssociationProduct } from '@/lib/association/queries'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'

const TAB_DEFS = [
  { id: 'all' as const, label: 'Toate' },
  { id: 'noua' as const, label: 'Noi' },
  { id: 'confirmate' as const, label: 'Confirmate' },
  { id: 'in_livrare' as const, label: 'În livrare' },
  { id: 'livrata' as const, label: 'Livrate' },
  { id: 'anulata' as const, label: 'Anulate' },
]

type TabId = (typeof TAB_DEFS)[number]['id']

const channelLabelMap: Record<'whatsapp' | 'sms' | 'apel', string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  apel: 'Apel telefonic',
}

// Units that should always display as integers (not weight-based)
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

type GroupedLine = {
  key: string
  produsId: string | null
  tenantId: string | null
  productName: string
  unitLabel: string
  farmName: string | null
  totalQty: number
  unitPriceLei: number
  totalLei: number
}

function groupLines(lines: AssociationOrderLine[]): GroupedLine[] {
  const map = new Map<string, GroupedLine>()
  for (const l of lines) {
    const key = `${l.produsId ?? 'null'}__${l.tenantId ?? 'null'}`
    const existing = map.get(key)
    if (existing) {
      existing.totalQty = Number((existing.totalQty + l.qtyKg).toFixed(4))
      existing.totalLei = Number((existing.totalLei + l.lineTotalLei).toFixed(2))
    } else {
      map.set(key, {
        key,
        produsId: l.produsId,
        tenantId: l.tenantId,
        productName: l.productName,
        unitLabel: l.unitLabel,
        farmName: l.farmName,
        totalQty: l.qtyKg,
        unitPriceLei: l.unitPriceLei,
        totalLei: l.lineTotalLei,
      })
    }
  }
  return [...map.values()]
}

export type AssociationComenziClientProps = {
  initialOrders: AssociationOrder[]
  availableProducts: AssociationProduct[]
  canManage: boolean
  initialStatusFilter?: string
}

function n(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
function d(v: string | null | undefined) {
  if (!v) return '—'
  const x = new Date(v)
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleDateString('ro-RO')
}
function dt(v: string | null | undefined) {
  if (!v) return '—'
  const x = new Date(v)
  return Number.isNaN(x.getTime()) ? '—' : x.toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' })
}
function lei(v: number) {
  return `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(Number(v || 0))} lei`
}
function shortId(o: Pick<AssociationOrder, 'id' | 'numar_comanda_scurt'>) {
  return o.numar_comanda_scurt?.trim() || o.id.replace(/-/g, '').slice(0, 8).toUpperCase()
}
function parseTab(raw: string | undefined): TabId | null {
  const id = (raw ?? '').trim().toLowerCase().replace(/-/g, '_')
  return (['all', 'noua', 'confirmate', 'in_livrare', 'livrata', 'anulata'] as const).includes(id as TabId)
    ? (id as TabId)
    : null
}
function matchTab(tab: TabId, status: string) {
  const s = status.toLowerCase()
  return tab === 'all'
    ? true
    : tab === 'noua'
      ? s === 'noua'
      : tab === 'confirmate'
        ? s === 'confirmata' || s === 'programata'
        : tab === 'in_livrare'
          ? s === 'in_livrare'
          : tab === 'livrata'
            ? s === 'livrata'
            : s === 'anulata'
}
function lineLabel(o: AssociationOrder) {
  if (o.lineCount > 1) return `${o.lineCount} produse`
  const l = o.lines[0]
  if (l) return `${l.productName} · ${formatQty(l.qtyKg, l.unitLabel)} ${l.unitLabel}`
  return `${Number(o.cantitate_kg || 0).toFixed(2)} kg`
}
function telHref(v: string | null | undefined) {
  const d = (v ?? '').replace(/[^\d+]/g, '')
  return d.length >= 7 ? `tel:${d}` : null
}
function waHref(v: string | null | undefined) {
  const d = (v ?? '').replace(/\D/g, '')
  if (!d) return null
  return `https://wa.me/${d.startsWith('0') ? `4${d}` : d}`
}

function isFinalStatus(status: string) {
  return status === 'livrata' || status === 'anulata'
}

function patchOrder(body: {
  orderId: string
  lineIds: string[]
  status?: AssociationOrderStatus
  note_interne?: string | null
}) {
  return fetch('/api/association/orders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { id: string; status: string; updated_at: string; note_interne?: string | null }; error?: { message?: string } } | null
    if (!res.ok || !json?.ok || !json.data) throw new Error(json?.error?.message ?? 'Actualizare eșuată.')
    return json.data
  })
}

function postAddLine(body: { orderId: string; productId: string; quantity: number }) {
  return fetch('/api/association/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => {
    const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { lineId: string }; error?: { message?: string } } | null
    if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? 'Adăugare eșuată.')
    return json.data as { lineId: string }
  })
}

function OrderDetails({
  order,
  canManage,
  noteDraft,
  setNoteDraft,
  saveNote,
  noteBusy,
  openStatus,
  onCancel,
  onAddLine,
}: {
  order: AssociationOrder
  canManage: boolean
  noteDraft: string
  setNoteDraft: (v: string) => void
  saveNote: () => void
  noteBusy: boolean
  openStatus: () => void
  onCancel: () => void
  onAddLine: () => void
}) {
  const t = telHref(order.telefon)
  const w = waHref(order.telefon)
  const status = order.status as AssociationOrderStatus
  const transitions = getAllowedAssociationOrderTransitions(order.status)
  const canChangeStatus = canManage && transitions.length > 0
  const variant = ASSOCIATION_ORDER_STATUS_VARIANTS[status] ?? 'neutral'
  const canActOnOrder = canManage && !isFinalStatus(order.status)
  const grouped = useMemo(() => groupLines(order.lines), [order.lines])

  return (
    <div className="grid gap-4 rounded-[24px] bg-[var(--surface-card-muted)] p-4 md:grid-cols-2 md:p-[18px]">
      {/* LEFT: Client + Note interne */}
      <section className="space-y-4 rounded-[20px] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Client</p>
          <p className="mt-2 text-base font-bold text-[var(--text-primary)]">{order.clientName ?? '—'}</p>
        </div>
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <p><span className="font-semibold text-[var(--text-primary)]">Telefon:</span> {order.telefon ? <a className="underline underline-offset-2" href={t ?? undefined}>{order.telefon}</a> : '—'}</p>
          <p><span className="font-semibold text-[var(--text-primary)]">Adresă:</span> {order.localitate ?? '—'}</p>
          <p><span className="font-semibold text-[var(--text-primary)]">Canal confirmare:</span> {order.canal_confirmare ? channelLabelMap[order.canal_confirmare] : '—'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild><a href={t ?? undefined}><Phone className="h-3.5 w-3.5" aria-hidden />Apel</a></Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild><a href={w ?? undefined} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3.5 w-3.5 text-green-600" aria-hidden />WhatsApp</a></Button>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Note interne</p>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            disabled={!canManage}
            rows={4}
            className="agri-control min-h-[100px] w-full rounded-[18px] px-3 py-2 text-sm"
            placeholder="Note vizibile doar echipei"
          />
          {canManage ? (
            <Button type="button" size="sm" className="w-full" onClick={saveNote} disabled={noteBusy}>
              {noteBusy ? 'Se salvează...' : 'Salvează nota'}
            </Button>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">Doar echipa asociației poate salva note interne.</p>
          )}
        </div>
      </section>

      {/* RIGHT: Produse + Sumar + Istoric + Status */}
      <section className="space-y-4 rounded-[20px] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Produse comandate</p>
            {canActOnOrder ? (
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={onAddLine}>
                <Plus className="h-3 w-3" aria-hidden />
                Adaugă produs
              </Button>
            ) : null}
          </div>
          <div className="mt-3 space-y-2">
            {grouped.map((g) => (
              <div key={g.key} className="rounded-[16px] border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{g.productName}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      {formatQty(g.totalQty, g.unitLabel)} {g.unitLabel} × {g.unitPriceLei.toFixed(2)} lei/{g.unitLabel}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{g.farmName ?? 'Fermă locală'}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-[var(--text-primary)]">{lei(g.totalLei)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[18px] bg-[var(--surface-card-muted)] px-3 py-3 text-sm">
          <div className="flex justify-between gap-3"><span className="text-[var(--text-secondary)]">Subtotal</span><span className="tabular-nums">{lei(order.subtotalLei)}</span></div>
          <div className="mt-1 flex justify-between gap-3"><span className="text-[var(--text-secondary)]">Livrare</span><span className="tabular-nums">{lei(order.deliveryFeeLei)}</span></div>
          <div className="mt-2 flex justify-between gap-3 border-t border-[var(--border-default)] pt-2 font-semibold"><span>Total</span><span className="tabular-nums">{lei(order.total)}</span></div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Istoric</p>
          <div className="rounded-[18px] bg-[var(--surface-card-muted)] px-3 py-3 text-sm text-[var(--text-secondary)]">
            <p>Plasată: <span className="font-medium text-[var(--text-primary)]">{dt(order.created_at)}</span></p>
            <p className="mt-1">Ultima modificare: <span className="font-medium text-[var(--text-primary)]">{dt(order.updated_at)}</span></p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Status actual</p>
          <StatusBadge text={ASSOCIATION_ORDER_STATUS_LABELS[status] ?? order.status} variant={variant} />
          <div className="flex flex-wrap gap-2">
            {canChangeStatus ? (
              <Button type="button" variant="outline" size="sm" onClick={openStatus}>Schimbă status</Button>
            ) : null}
            {canActOnOrder ? (
              <Button type="button" variant="destructive" size="sm" onClick={onCancel}>
                Anulează comanda
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}

export function AssociationComenziInlineClient({ initialOrders, availableProducts, canManage, initialStatusFilter }: AssociationComenziClientProps) {
  const router = useRouter()
  const [orders, setOrders] = useState(initialOrders)
  const [tab, setTab] = useState<TabId>(() => parseTab(initialStatusFilter) ?? 'all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  // Status dialog
  const [statusDialogOrderId, setStatusDialogOrderId] = useState<string | null>(null)
  const [statusDialogNext, setStatusDialogNext] = useState<AssociationOrderStatus | ''>('')
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)

  // Note drafts
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [noteBusyId, setNoteBusyId] = useState<string | null>(null)

  // Cancel dialog
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null)
  const [cancelBusy, setCancelBusy] = useState(false)

  // Add line dialog
  const [addLineOrderId, setAddLineOrderId] = useState<string | null>(null)
  const [addLineProductId, setAddLineProductId] = useState<string>('')
  const [addLineQty, setAddLineQty] = useState<string>('1')
  const [addLineBusy, setAddLineBusy] = useState(false)

  useEffect(() => setOrders(initialOrders), [initialOrders])
  useEffect(() => {
    setNoteDrafts((prev) => {
      const next = { ...prev }
      let changed = false
      for (const o of initialOrders) if (next[o.id] === undefined) { next[o.id] = o.note_interne ?? ''; changed = true }
      return changed ? next : prev
    })
  }, [initialOrders])

  const filtered = useMemo(
    () => orders.filter((o) => {
      if (!matchTab(tab, o.status)) return false
      if (dateFrom && o.data_comanda < dateFrom) return false
      if (dateTo && o.data_comanda > dateTo) return false
      if (search.trim()) {
        const q = n(search.trim())
        if (![o.clientName ?? '', o.farmName ?? '', o.lines.map((l) => l.productName).join(' ')].some((v) => n(v).includes(q))) return false
      }
      return true
    }),
    [orders, tab, search, dateFrom, dateTo],
  )

  const listedProducts = useMemo(
    () => availableProducts.filter((p) => p.association_listed && p.status === 'activ' && p.tenantIsAssociationApproved),
    [availableProducts],
  )

  const statusOrder = useMemo(() => (statusDialogOrderId ? orders.find((o) => o.id === statusDialogOrderId) ?? null : null), [orders, statusDialogOrderId])
  const statusOptions = useMemo(() => getAllowedAssociationOrderTransitions(statusOrder?.status), [statusOrder?.status])
  const cancelOrder = useMemo(() => (cancelOrderId ? orders.find((o) => o.id === cancelOrderId) ?? null : null), [orders, cancelOrderId])
  const addLineOrder = useMemo(() => (addLineOrderId ? orders.find((o) => o.id === addLineOrderId) ?? null : null), [orders, addLineOrderId])

  useEffect(() => setStatusDialogNext(statusOptions[0] ?? ''), [statusOptions])
  useEffect(() => { if (expandedOrderId && !filtered.some((o) => o.id === expandedOrderId)) setExpandedOrderId(null) }, [expandedOrderId, filtered])

  const applyStatus = useCallback(async (order: AssociationOrder, next: AssociationOrderStatus) => {
    if (!canManage || next === (order.status as AssociationOrderStatus)) return
    setStatusBusyId(order.id)
    const prev = order.status
    setOrders((rows) => rows.map((x) => (x.id === order.id ? { ...x, status: next } : x)))
    try {
      const data = await patchOrder({ orderId: order.id, lineIds: order.lines.map((l) => l.id), status: next })
      setOrders((rows) => rows.map((x) => (x.id === data.id ? { ...x, status: data.status, updated_at: data.updated_at } : x)))
      toast.success('Status actualizat.')
      setStatusDialogOrderId(null)
      router.refresh()
    } catch (e) {
      setOrders((rows) => rows.map((x) => (x.id === order.id ? { ...x, status: prev } : x)))
      toast.error(e instanceof Error ? e.message : 'Nu am putut salva.')
    } finally {
      setStatusBusyId(null)
    }
  }, [canManage, router])

  const saveNote = useCallback(async (order: AssociationOrder) => {
    if (!canManage) return
    setNoteBusyId(order.id)
    try {
      const data = await patchOrder({ orderId: order.id, lineIds: order.lines.map((l) => l.id), note_interne: noteDrafts[order.id] ?? '' })
      setOrders((rows) => rows.map((x) => (x.id === data.id ? { ...x, note_interne: data.note_interne ?? '', updated_at: data.updated_at } : x)))
      toast.success('Nota internă a fost salvată.')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nu am putut salva nota internă.')
    } finally {
      setNoteBusyId(null)
    }
  }, [canManage, noteDrafts, router])

  const confirmCancel = useCallback(async () => {
    if (!cancelOrder || !canManage) return
    setCancelBusy(true)
    const prev = cancelOrder.status
    setOrders((rows) => rows.map((x) => (x.id === cancelOrder.id ? { ...x, status: 'anulata' } : x)))
    try {
      const data = await patchOrder({ orderId: cancelOrder.id, lineIds: cancelOrder.lines.map((l) => l.id), status: 'anulata' })
      setOrders((rows) => rows.map((x) => (x.id === data.id ? { ...x, status: data.status, updated_at: data.updated_at } : x)))
      toast.success('Comanda a fost anulată.')
      setCancelOrderId(null)
      router.refresh()
    } catch (e) {
      setOrders((rows) => rows.map((x) => (x.id === cancelOrder.id ? { ...x, status: prev } : x)))
      toast.error(e instanceof Error ? e.message : 'Nu am putut anula comanda.')
    } finally {
      setCancelBusy(false)
    }
  }, [cancelOrder, canManage, router])

  const confirmAddLine = useCallback(async () => {
    if (!addLineOrder || !canManage || !addLineProductId) return
    const qty = parseInt(addLineQty, 10)
    if (!qty || qty < 1) { toast.error('Cantitate invalidă.'); return }
    setAddLineBusy(true)
    try {
      await postAddLine({ orderId: addLineOrder.id, productId: addLineProductId, quantity: qty })
      toast.success('Produsul a fost adăugat la comandă.')
      setAddLineOrderId(null)
      setAddLineProductId('')
      setAddLineQty('1')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Nu am putut adăuga produsul.')
    } finally {
      setAddLineBusy(false)
    }
  }, [addLineOrder, canManage, addLineProductId, addLineQty, router])

  const openOrder = (id: string) => setExpandedOrderId((cur) => (cur === id ? null : id))

  return (
    <AppShell header={<PageHeader title="Comenzi" subtitle="Comenzi din magazinul Gustă din Bucovina" />}>
      <div className="w-full space-y-4 py-3 md:space-y-5">
        <div className="rounded-[24px] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-2">
              {TAB_DEFS.map((t) => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cn('h-9 rounded-full px-3 text-xs font-semibold transition active:scale-[0.98]', tab === t.id ? 'bg-[var(--agri-primary)] text-white' : 'border border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)]')}>{t.label}</button>
              ))}
            </div>
            <SearchField containerClassName="w-full min-w-[220px] max-w-sm flex-1" placeholder="Client, produs sau fermă..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Căutare comenzi" />
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-[148px] flex-col gap-1"><label htmlFor="assoc_ord_from" className="text-xs font-medium text-[var(--text-secondary)]">De la (dată)</label><input id="assoc_ord_from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="agri-control h-9 w-full min-w-0 rounded-xl px-2 text-sm text-[var(--text-primary)]" /></div>
              <span className="hidden pb-2 text-xs text-[var(--text-muted)] sm:inline sm:pb-0">—</span>
              <div className="flex min-w-[148px] flex-col gap-1"><label htmlFor="assoc_ord_to" className="text-xs font-medium text-[var(--text-secondary)]">Până la (dată)</label><input id="assoc_ord_to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="agri-control h-9 w-full min-w-0 rounded-xl px-2 text-sm text-[var(--text-primary)]" /></div>
              {dateFrom || dateTo ? <Button type="button" variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo('') }}>Resetează perioada</Button> : null}
            </div>
          </div>
        </div>

        <div className="rounded-[26px] bg-[var(--surface-card)] shadow-[var(--shadow-soft)]">
          {/* Desktop table */}
          <div className="hidden md:block">
            <Table containerClassName="w-full overflow-x-auto">
              <TableHeader><TableRow className="hover:bg-transparent"><TableHead className="w-[70px]">#</TableHead><TableHead>Client</TableHead><TableHead>Telefon</TableHead><TableHead>Produs(e)</TableHead><TableHead>Producător</TableHead><TableHead className="text-right">Sumă</TableHead><TableHead>Status</TableHead><TableHead>Data comenzii</TableHead></TableRow></TableHeader>
              <TableBody>
                {filtered.length > 0 ? filtered.map((order) => {
                  const isExpanded = expandedOrderId === order.id
                  const status = order.status as AssociationOrderStatus
                  const tone = ASSOCIATION_ORDER_STATUS_VARIANTS[status] ?? 'neutral'
                  return (
                    <AnimatePresence key={order.id} initial={false}>
                      <TableRow data-selected={isExpanded ? 'true' : undefined} className={cn('cursor-pointer border-[var(--border-default)] transition-colors', isExpanded ? 'bg-[color:color-mix(in_srgb,var(--agri-primary)_6%,var(--surface-card))] hover:bg-[color:color-mix(in_srgb,var(--agri-primary)_6%,var(--surface-card))]' : '')} onClick={() => openOrder(order.id)}>
                        <TableCell className="font-mono text-xs text-[var(--text-secondary)]">{shortId(order)}</TableCell>
                        <TableCell className="font-medium text-[var(--text-primary)]">{order.clientName ?? '—'}</TableCell>
                        <TableCell>{order.telefon ?? '—'}</TableCell>
                        <TableCell className="text-sm text-[var(--text-secondary)]">{lineLabel(order)}</TableCell>
                        <TableCell>{order.farmName ?? '—'}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-[var(--text-primary)]">{lei(order.total)}</TableCell>
                        <TableCell><StatusBadge text={ASSOCIATION_ORDER_STATUS_LABELS[status] ?? order.status} variant={tone} /></TableCell>
                        <TableCell>{d(order.data_comanda)}</TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <motion.tr key={`detail-${order.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <TableCell colSpan={8} className="p-0">
                            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
                              <div className="border-t border-[var(--border-default)] bg-[var(--surface-card-muted)] p-4">
                                <OrderDetails
                                  order={order}
                                  canManage={canManage}
                                  noteDraft={noteDrafts[order.id] ?? order.note_interne ?? ''}
                                  setNoteDraft={(v) => setNoteDrafts((p) => ({ ...p, [order.id]: v }))}
                                  saveNote={() => void saveNote(order)}
                                  noteBusy={noteBusyId === order.id}
                                  openStatus={() => setStatusDialogOrderId(order.id)}
                                  onCancel={() => setCancelOrderId(order.id)}
                                  onAddLine={() => { setAddLineOrderId(order.id); setAddLineProductId(''); setAddLineQty('1') }}
                                />
                              </div>
                            </motion.div>
                          </TableCell>
                        </motion.tr>
                      ) : null}
                    </AnimatePresence>
                  )
                }) : <TableRow><TableCell colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">Nicio comandă în acest filtru.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 p-4 md:hidden">
            {filtered.length > 0 ? filtered.map((order) => {
              const isExpanded = expandedOrderId === order.id
              const status = order.status as AssociationOrderStatus
              const tone = ASSOCIATION_ORDER_STATUS_VARIANTS[status] ?? 'neutral'
              return (
                <div key={order.id} className="space-y-2">
                  <MobileEntityCard title={order.clientName ?? 'Client'} subtitle={order.farmName ?? ''} mainValue={lei(order.total)} secondaryValue={lineLabel(order)} statusLabel={ASSOCIATION_ORDER_STATUS_LABELS[status] ?? order.status} statusTone={tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : 'neutral'} variant={isExpanded ? 'highlight' : 'default'} interactive showChevron onClick={() => openOrder(order.id)} ariaLabel={`Comandă ${order.clientName ?? shortId(order)}`} />
                  <AnimatePresence initial={false}>
                    {isExpanded ? (
                      <motion.div key={`m-${order.id}`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                        <OrderDetails
                          order={order}
                          canManage={canManage}
                          noteDraft={noteDrafts[order.id] ?? order.note_interne ?? ''}
                          setNoteDraft={(v) => setNoteDrafts((p) => ({ ...p, [order.id]: v }))}
                          saveNote={() => void saveNote(order)}
                          noteBusy={noteBusyId === order.id}
                          openStatus={() => setStatusDialogOrderId(order.id)}
                          onCancel={() => setCancelOrderId(order.id)}
                          onAddLine={() => { setAddLineOrderId(order.id); setAddLineProductId(''); setAddLineQty('1') }}
                        />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              )
            }) : <div className="rounded-[22px] bg-[var(--surface-card-muted)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">Nicio comandă în acest filtru.</div>}
          </div>
        </div>
      </div>

      {/* Dialog: Schimbă status */}
      <AppDialog
        open={statusOrder != null}
        onOpenChange={(open) => { if (!open) { setStatusDialogOrderId(null); setStatusDialogNext('') } }}
        title={statusOrder ? `Actualizează statusul comenzii #${shortId(statusOrder)}` : 'Actualizează statusul'}
        description={statusOrder ? `${statusOrder.clientName ?? 'Client'} · ${d(statusOrder.data_comanda)}` : undefined}
        footer={statusOrder ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => { setStatusDialogOrderId(null); setStatusDialogNext('') }}>Închide</Button>
            <Button type="button" disabled={statusBusyId === statusOrder.id || !statusDialogNext} onClick={async () => { if (!statusDialogNext) return; await applyStatus(statusOrder, statusDialogNext) }}>
              {statusBusyId === statusOrder.id ? 'Se actualizează...' : 'Actualizează status'}
            </Button>
          </div>
        ) : null}
        contentClassName="sm:max-w-md"
      >
        {statusOrder ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-[var(--surface-card-muted)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{statusOrder.clientName ?? 'Client necunoscut'}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Comandă #{shortId(statusOrder)} · {d(statusOrder.data_comanda)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Status actual</p>
              <StatusBadge text={ASSOCIATION_ORDER_STATUS_LABELS[statusOrder.status as AssociationOrderStatus] ?? statusOrder.status} variant={ASSOCIATION_ORDER_STATUS_VARIANTS[statusOrder.status as AssociationOrderStatus] ?? 'neutral'} />
            </div>
            <div className="space-y-2">
              <label htmlFor="assoc-order-status-next" className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Status nou</label>
              <Select value={statusDialogNext || undefined} disabled={statusOptions.length === 0} onValueChange={(v) => setStatusDialogNext(v as AssociationOrderStatus)}>
                <SelectTrigger id="assoc-order-status-next" className="h-11 w-full"><SelectValue placeholder="Alege statusul următor" /></SelectTrigger>
                <SelectContent>{statusOptions.map((s) => <SelectItem key={s} value={s}>{ASSOCIATION_ORDER_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
              </Select>
              {statusOptions.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">Comanda este într-o stare finală și nu mai poate fi modificată.</p> : null}
            </div>
          </div>
        ) : null}
      </AppDialog>

      {/* Dialog: Confirmare anulare */}
      <AlertDialog open={cancelOrder != null} onOpenChange={(open) => { if (!open) setCancelOrderId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anulezi comanda #{cancelOrder ? shortId(cancelOrder) : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelOrder
                ? `Ești sigur că vrei să anulezi comanda #${shortId(cancelOrder)} a clientului ${cancelOrder.clientName ?? 'necunoscut'}? Această acțiune nu poate fi anulată.`
                : 'Această acțiune nu poate fi anulată.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelBusy}>Nu, renunț</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmCancel()}
            >
              {cancelBusy ? 'Se anulează...' : 'Da, anulează comanda'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Adaugă produs la comandă */}
      <AppDialog
        open={addLineOrder != null}
        onOpenChange={(open) => { if (!open) { setAddLineOrderId(null); setAddLineProductId(''); setAddLineQty('1') } }}
        title={addLineOrder ? `Adaugă produs la comanda #${shortId(addLineOrder)}` : 'Adaugă produs'}
        description={addLineOrder ? `${addLineOrder.clientName ?? 'Client'} · ${d(addLineOrder.data_comanda)}` : undefined}
        footer={addLineOrder ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={addLineBusy} onClick={() => { setAddLineOrderId(null); setAddLineProductId(''); setAddLineQty('1') }}>Anulează</Button>
            <Button type="button" disabled={addLineBusy || !addLineProductId || !addLineQty} onClick={() => void confirmAddLine()}>
              {addLineBusy ? 'Se adaugă...' : 'Adaugă produs'}
            </Button>
          </div>
        ) : null}
        contentClassName="sm:max-w-md"
      >
        {addLineOrder ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="add-line-product" className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Produs</label>
              <Select value={addLineProductId || undefined} onValueChange={setAddLineProductId}>
                <SelectTrigger id="add-line-product" className="h-11 w-full"><SelectValue placeholder="Alege produsul" /></SelectTrigger>
                <SelectContent>
                  {listedProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nume} — {p.farmName ?? 'Fermă'} ({p.pret_unitar != null ? `${p.pret_unitar} lei/${p.unitate_vanzare}` : 'preț lipsă'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="add-line-qty" className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Cantitate</label>
              <input
                id="add-line-qty"
                type="number"
                min={1}
                step={1}
                value={addLineQty}
                onChange={(e) => setAddLineQty(e.target.value)}
                className="agri-control h-11 w-full rounded-xl px-3 text-sm"
                placeholder="1"
              />
              {addLineProductId ? (() => {
                const p = listedProducts.find((x) => x.id === addLineProductId)
                const qty = parseInt(addLineQty, 10)
                if (!p || !qty || qty < 1) return null
                const total = (Number(p.pret_unitar || 0) * qty).toFixed(2)
                return <p className="text-xs text-[var(--text-secondary)]">Total linie: <span className="font-semibold text-[var(--text-primary)]">{total} lei</span></p>
              })() : null}
            </div>
          </div>
        ) : null}
      </AppDialog>
    </AppShell>
  )
}
