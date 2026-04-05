'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { MessageCircle, Phone } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { AppDialog } from '@/components/app/AppDialog'
import { AppDrawer } from '@/components/app/AppDrawer'
import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { Button } from '@/components/ui/button'
import {
  DesktopInspectorPanel,
  DesktopInspectorSection,
  DesktopSplitPane,
  DesktopToolbar,
} from '@/components/ui/desktop'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import { ResponsiveDataView } from '@/components/ui/ResponsiveDataView'
import { SearchField } from '@/components/ui/SearchField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import StatusBadge from '@/components/ui/StatusBadge'
import type { AssociationOrder, AssociationProduct } from '@/lib/association/queries'
import { COMENZI_STATUSES, type ComandaStatus } from '@/lib/supabase/queries/comenzi'
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

const statusLabelMap: Record<ComandaStatus, string> = {
  noua: 'Nouă',
  confirmata: 'Confirmată',
  programata: 'Programată',
  in_livrare: 'În livrare',
  livrata: 'Livrată',
  anulata: 'Anulată',
}

const statusVariantMap: Record<ComandaStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'> = {
  noua: 'neutral',
  confirmata: 'warning',
  programata: 'warning',
  in_livrare: 'warning',
  livrata: 'success',
  anulata: 'danger',
}

const channelLabelMap: Record<'whatsapp' | 'sms' | 'apel', string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  apel: 'Apel telefonic',
}

function normalizeText(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('ro-RO')
}

function formatLei(n: number): string {
  return `${Number(n || 0).toFixed(2)} lei`
}

function shortOrderId(order: Pick<AssociationOrder, 'id' | 'numar_comanda_scurt'>): string {
  return order.numar_comanda_scurt?.trim() || order.id.replace(/-/g, '').slice(0, 8).toUpperCase()
}

function parseInitialTab(raw: string | undefined): TabId | null {
  if (!raw || typeof raw !== 'string') return null
  const id = raw.trim().toLowerCase().replace(/-/g, '_')
  const allowed: TabId[] = ['all', 'noua', 'confirmate', 'in_livrare', 'livrata', 'anulata']
  return allowed.includes(id as TabId) ? (id as TabId) : null
}

function tabMatches(tab: TabId, status: string): boolean {
  const s = status.toLowerCase()
  switch (tab) {
    case 'all':
      return true
    case 'noua':
      return s === 'noua'
    case 'confirmate':
      return s === 'confirmata' || s === 'programata'
    case 'in_livrare':
      return s === 'in_livrare'
    case 'livrata':
      return s === 'livrata'
    case 'anulata':
      return s === 'anulata'
    default:
      return true
  }
}

function productLineLabel(o: AssociationOrder): string {
  if (o.lineCount > 1) {
    return `${o.lineCount} produse`
  }
  const line = o.lines[0]
  if (line) return `${line.productName} · ${line.qtyKg.toFixed(2)} kg`
  const n = o.produs?.nume?.trim()
  if (n) return `${n} · ${Number(o.cantitate_kg || 0).toFixed(2)} kg`
  return `${Number(o.cantitate_kg || 0).toFixed(2)} kg`
}

async function patchAssociationOrder(body: {
  orderId: string
  status?: ComandaStatus
  note_interne?: string | null
}) {
  const res = await fetch('/api/association/orders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => null)) as
    | {
        ok?: boolean
        data?: { id: string; status: string; updated_at: string; note_interne?: string | null }
        error?: { message?: string }
      }
    | null
  if (!res.ok || !json?.ok || !json.data) {
    const msg = json && typeof json === 'object' && 'error' in json && json.error?.message
    throw new Error(typeof msg === 'string' ? msg : 'Actualizare eșuată.')
  }
  return json.data
}

async function addAssociationOrderLine(body: {
  orderId: string
  produsId: string
  cantitate: number
  pretUnitar: number
}) {
  const res = await fetch('/api/association/orders/add-line', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => null)) as
    | {
        ok?: boolean
        data?: { insertedOrderId: string; totalLei: number }
        error?: { message?: string }
      }
    | null
  if (!res.ok || !json?.ok || !json.data) {
    const msg = json && typeof json === 'object' && 'error' in json && json.error?.message
    throw new Error(typeof msg === 'string' ? msg : 'Nu am putut adăuga produsul.')
  }
  return json.data
}

export type AssociationComenziClientProps = {
  initialOrders: AssociationOrder[]
  availableProducts: AssociationProduct[]
  canManage: boolean
  /** Din `?status=` pe URL (ex. `noua` pentru link-uri rapide). */
  initialStatusFilter?: string
}

export function AssociationComenziClient({
  initialOrders,
  availableProducts,
  canManage,
  initialStatusFilter,
}: AssociationComenziClientProps) {
  const router = useRouter()
  const [orders, setOrders] = useState<AssociationOrder[]>(initialOrders)
  const [tab, setTab] = useState<TabId>(() => parseInitialTab(initialStatusFilter) ?? 'all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mobileDetailId, setMobileDetailId] = useState<string | null>(null)
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [noteBusyId, setNoteBusyId] = useState<string | null>(null)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [addLineBusy, setAddLineBusy] = useState(false)
  const [addLineDraft, setAddLineDraft] = useState<{
    produsId: string
    cantitate: string
    pretUnitar: string
  }>({
    produsId: '',
    cantitate: '1',
    pretUnitar: '',
  })

  useEffect(() => {
    setOrders(initialOrders)
  }, [initialOrders])

  useEffect(() => {
    setNoteDrafts((prev) => {
      const next = { ...prev }
      let changed = false
      for (const order of initialOrders) {
        if (next[order.id] === undefined) {
          next[order.id] = order.note_interne ?? ''
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [initialOrders])

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (!tabMatches(tab, o.status)) return false
      if (dateFrom && o.data_comanda < dateFrom) return false
      if (dateTo && o.data_comanda > dateTo) return false
      if (search.trim()) {
        const q = normalizeText(search.trim())
        const client = normalizeText(o.clientName ?? '')
        const prod = normalizeText(o.lines.map((line) => line.productName).join(' '))
        const farm = normalizeText(o.farmName ?? '')
        if (!client.includes(q) && !prod.includes(q) && !farm.includes(q)) return false
      }
      return true
    })
  }, [orders, tab, search, dateFrom, dateTo])

  const listedProducts = useMemo(
    () =>
      availableProducts.filter(
        (product) => product.association_listed && product.status === 'activ' && product.tenantIsAssociationApproved,
      ),
    [availableProducts],
  )

  const resolvedSelectedId = useMemo(() => {
    if (filtered.length === 0) return null
    if (selectedId && filtered.some((o) => o.id === selectedId)) return selectedId
    return filtered[0].id
  }, [filtered, selectedId])

  const selected = useMemo(
    () => (resolvedSelectedId ? filtered.find((o) => o.id === resolvedSelectedId) ?? null : null),
    [filtered, resolvedSelectedId]
  )

  const mobileDetail = useMemo(
    () => (mobileDetailId ? orders.find((o) => o.id === mobileDetailId) ?? null : null),
    [orders, mobileDetailId]
  )

  const selectedAddProduct = useMemo(
    () => listedProducts.find((product) => product.id === addLineDraft.produsId) ?? null,
    [listedProducts, addLineDraft.produsId],
  )
  const addLineTotalLei = useMemo(() => {
    const qty = Number(addLineDraft.cantitate.replace(',', '.'))
    const price = Number(addLineDraft.pretUnitar.replace(',', '.'))
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) return 0
    return qty * price
  }, [addLineDraft.cantitate, addLineDraft.pretUnitar])

  useEffect(() => {
    if (!showAddProduct) return
    const fallback = selectedAddProduct ?? listedProducts[0] ?? null
    if (!fallback) return
    const fallbackPrice = Number(fallback.association_price ?? fallback.pret_unitar ?? 0)
    setAddLineDraft((prev) => {
      if (prev.produsId && prev.pretUnitar) return prev
      return {
        produsId: prev.produsId || fallback.id,
        cantitate: prev.cantitate || '1',
        pretUnitar: prev.pretUnitar || (fallbackPrice > 0 ? String(fallbackPrice) : ''),
      }
    })
  }, [showAddProduct, listedProducts, selectedAddProduct])

  const applyStatus = useCallback(
    async (o: AssociationOrder, next: ComandaStatus) => {
      if (!canManage || next === (o.status as ComandaStatus)) return
      setStatusBusyId(o.id)
      const prev = o.status
      setOrders((prevOrders) => prevOrders.map((x) => (x.id === o.id ? { ...x, status: next } : x)))
      try {
        const data = await patchAssociationOrder({ orderId: o.id, status: next })
        setOrders((prevOrders) =>
          prevOrders.map((x) =>
            x.id === data.id ? { ...x, status: data.status, updated_at: data.updated_at } : x,
          ),
        )
        toast.success('Status actualizat.')
        router.refresh()
      } catch (e) {
        setOrders((prevOrders) => prevOrders.map((x) => (x.id === o.id ? { ...x, status: prev } : x)))
        toast.error(e instanceof Error ? e.message : 'Nu am putut salva.')
      } finally {
        setStatusBusyId(null)
      }
    },
    [canManage, router]
  )

  const handleSaveNote = useCallback(
    async (order: AssociationOrder) => {
      if (!canManage) return
      setNoteBusyId(order.id)
      try {
        const data = await patchAssociationOrder({
          orderId: order.id,
          note_interne: noteDrafts[order.id] ?? '',
        })
        setOrders((prevOrders) =>
          prevOrders.map((item) =>
            item.id === data.id
              ? {
                  ...item,
                  note_interne: data.note_interne ?? '',
                  updated_at: data.updated_at,
                }
              : item,
          ),
        )
        toast.success('Nota internă a fost salvată.')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Nu am putut salva nota internă.')
      } finally {
        setNoteBusyId(null)
      }
    },
    [canManage, noteDrafts, router],
  )

  const handleAddProduct = useCallback(
    async (order: AssociationOrder) => {
      const qty = Number(addLineDraft.cantitate.replace(',', '.'))
      const price = Number(addLineDraft.pretUnitar.replace(',', '.'))
      if (!addLineDraft.produsId || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
        toast.error('Completează un produs, o cantitate și un preț valid.')
        return
      }

      setAddLineBusy(true)
      try {
        await addAssociationOrderLine({
          orderId: order.id,
          produsId: addLineDraft.produsId,
          cantitate: qty,
          pretUnitar: price,
        })
        toast.success('Produsul a fost adăugat la comandă.')
        setShowAddProduct(false)
        setAddLineDraft({ produsId: '', cantitate: '1', pretUnitar: '' })
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Nu am putut adăuga produsul.')
      } finally {
        setAddLineBusy(false)
      }
    },
    [addLineDraft, router],
  )

  const statusSelect = useCallback(
    (o: AssociationOrder, compact?: boolean) => {
      const st = o.status as ComandaStatus
      if (!canManage) {
        return (
          <StatusBadge text={statusLabelMap[st] ?? o.status} variant={statusVariantMap[st] ?? 'neutral'} />
        )
      }
      return (
        <Select
          value={st}
          disabled={statusBusyId === o.id}
          onValueChange={(v) => void applyStatus(o, v as ComandaStatus)}
        >
          <SelectTrigger
            className={cn('h-9', compact ? 'w-[160px]' : 'w-full max-w-[220px]')}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMENZI_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusLabelMap[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    },
    [applyStatus, canManage, statusBusyId]
  )

  const desktopColumns = useMemo<ColumnDef<AssociationOrder>[]>(
    () => [
      {
        id: 'shortId',
        header: '#',
        accessorFn: (row) => shortOrderId(row),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-[var(--text-secondary)]">{shortOrderId(row.original)}</span>
        ),
      },
      {
        id: 'client',
        header: 'Client',
        accessorFn: (row) => row.clientName ?? '',
        cell: ({ row }) => (
          <span className="font-medium text-[var(--text-primary)]">{row.original.clientName ?? '—'}</span>
        ),
      },
      {
        id: 'telefon',
        header: 'Telefon',
        accessorFn: (row) => row.telefon ?? '',
        cell: ({ row }) => row.original.telefon ?? '—',
      },
      {
        id: 'produs',
        header: 'Produs(e)',
        accessorFn: (row) => productLineLabel(row),
        cell: ({ row }) => (
          <span className="text-sm text-[var(--text-secondary)]">{productLineLabel(row.original)}</span>
        ),
      },
      {
        id: 'ferma',
        header: 'Producător',
        accessorFn: (row) => row.farmName ?? '',
        cell: ({ row }) => row.original.farmName ?? '—',
      },
      {
        id: 'total',
        header: 'Sumă',
        accessorFn: (row) => row.total,
        cell: ({ row }) => (
          <span className="tabular-nums font-semibold text-[var(--text-primary)]">
            {formatLei(row.original.total)}
          </span>
        ),
        meta: { numeric: true },
      },
      {
        id: 'status',
        header: 'Status',
        accessorFn: (row) => row.status,
        cell: ({ row }) => statusSelect(row.original, true),
      },
      {
        id: 'data',
        header: 'Data comenzii',
        accessorFn: (row) => row.data_comanda,
        cell: ({ row }) => formatDate(row.original.data_comanda),
      },
    ],
    [statusSelect]
  )

  const inspectorBody = (o: AssociationOrder, opts?: { hideClientName?: boolean }) => {
    const hideClientName = opts?.hideClientName === true
    const telefon = (o.telefon ?? '').trim()
    const hasTelefon = telefon.length > 0
    const whatsappPhone = telefon.replace(/[^\d+]/g, '').replace(/^\+/, '')
    const whatsappUrl = hasTelefon && whatsappPhone ? `https://wa.me/${whatsappPhone}` : ''
    return (
    <>
      <DesktopInspectorSection label="Client">
        {hideClientName ? null : (
          <p className="font-medium text-[var(--text-primary)]">{o.clientName ?? '—'}</p>
        )}
        <p className="text-sm text-[var(--text-secondary)]">{o.telefon ?? '—'}</p>
        <p className="text-sm text-[var(--text-secondary)]">{o.localitate ?? '—'}</p>
        {o.canal_confirmare ? (
          <p className="mt-2 text-xs font-medium text-[var(--text-muted)]">
            Canal confirmare: {channelLabelMap[o.canal_confirmare]}
          </p>
        ) : null}
        {hasTelefon ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1" asChild>
              <a href={`tel:${telefon}`}>
                <Phone className="h-3.5 w-3.5" aria-hidden />
                Apel
              </a>
            </Button>
            {whatsappUrl ? (
              <Button type="button" variant="outline" size="sm" className="gap-1" asChild>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-3.5 w-3.5 text-green-600" aria-hidden />
                  WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}
      </DesktopInspectorSection>
      <DesktopInspectorSection label="Produse comandate">
        <div className="space-y-3">
          {o.lines.map((line) => (
            <div
              key={line.id}
              className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {line.productName} · {line.qtyKg.toFixed(2)} kg
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {line.farmName ?? 'Fermă'} · {line.unitPriceLei.toFixed(2)} lei/kg
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                  {formatLei(line.lineTotalLei)}
                </p>
              </div>
              <p className="mt-1 text-[11px] italic text-[var(--text-muted)]">→ {line.sourceLabel}</p>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setShowAddProduct(true)}
            disabled={!canManage || listedProducts.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--agri-primary)] px-3 py-2 text-sm font-semibold text-[var(--agri-primary)] transition hover:bg-[var(--surface-card-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden>➕</span>
            Adaugă produs la comandă
          </button>

          <div className="space-y-1 rounded-xl bg-[var(--surface-card-muted)] px-3 py-3">
            <div className="flex items-center justify-between gap-3 text-sm text-[var(--text-secondary)]">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatLei(o.subtotalLei)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm text-[var(--text-secondary)]">
              <span>Livrare</span>
              <span className="tabular-nums">{formatLei(o.deliveryFeeLei)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm font-semibold text-[var(--text-primary)]">
              <span>Total</span>
              <span className="tabular-nums">{formatLei(o.total)}</span>
            </div>
          </div>
        </div>
      </DesktopInspectorSection>
      <DesktopInspectorSection label="Producători">
        <p className="font-medium text-[var(--text-primary)]">{o.farmName ?? '—'}</p>
      </DesktopInspectorSection>
      {o.observatii?.trim() ? (
        <DesktopInspectorSection label="Observații">
          <p className="text-sm whitespace-pre-wrap text-[var(--text-secondary)]">{o.observatii.trim()}</p>
        </DesktopInspectorSection>
      ) : null}
      <DesktopInspectorSection label="Note interne">
        <textarea
          value={noteDrafts[o.id] ?? ''}
          onChange={(event) =>
            setNoteDrafts((prev) => ({
              ...prev,
              [o.id]: event.target.value,
            }))
          }
          disabled={!canManage || noteBusyId === o.id}
          placeholder="Note vizibile doar echipei (ex: clientul a cerut livrare după ora 14)"
          rows={3}
          className="agri-control min-h-[84px] w-full rounded-xl px-3 py-2 text-sm"
        />
        {canManage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={noteBusyId === o.id}
            onClick={() => void handleSaveNote(o)}
          >
            {noteBusyId === o.id ? 'Se salvează...' : 'Salvează nota'}
          </Button>
        ) : (
          <p className="mt-2 text-xs text-[var(--text-muted)]">Doar echipa asociației poate salva note interne.</p>
        )}
      </DesktopInspectorSection>
      <DesktopInspectorSection label="Istoric (simplu)">
        <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
          <li>
            <span className="font-medium text-[var(--text-primary)]">Comandă plasată</span>
            <br />
            {formatDate(o.data_comanda)} · {new Date(o.created_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
          </li>
          <li>
            <span className="font-medium text-[var(--text-primary)]">Ultima modificare</span>
            <br />
            {formatDate(o.updated_at)} · {new Date(o.updated_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
          </li>
        </ul>
      </DesktopInspectorSection>
      <DesktopInspectorSection label="Schimbă status">
        {statusSelect(o)}
        {!canManage ? (
          <p className="mt-2 text-xs text-[var(--text-muted)]">Doar moderatorii și administratorii pot modifica statusul.</p>
        ) : null}
      </DesktopInspectorSection>
    </>
  )
  }

  return (
    <AppShell
      header={<PageHeader title="Comenzi" subtitle="Comenzi din magazinul Gustă din Bucovina" />}
    >
      <div className="mx-auto w-full max-w-6xl space-y-4 py-3">
        <DesktopToolbar className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-2">
            {TAB_DEFS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'h-9 rounded-full px-3 text-xs font-semibold transition',
                  tab === t.id
                    ? 'bg-[var(--agri-primary)] text-white'
                    : 'border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <SearchField
            containerClassName="w-full min-w-[200px] max-w-sm flex-1"
            placeholder="Client, produs sau fermă..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Căutare comenzi"
          />
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-[148px] flex-col gap-1">
              <label
                htmlFor="assoc_ord_from"
                className="text-xs font-medium text-[var(--text-secondary)]"
              >
                De la (dată)
              </label>
              <input
                id="assoc_ord_from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="agri-control h-9 w-full min-w-0 rounded-xl px-2 text-sm text-[var(--text-primary)]"
              />
            </div>
            <span className="hidden pb-2 text-xs text-[var(--text-muted)] sm:inline sm:pb-0">—</span>
            <div className="flex min-w-[148px] flex-col gap-1">
              <label
                htmlFor="assoc_ord_to"
                className="text-xs font-medium text-[var(--text-secondary)]"
              >
                Până la (dată)
              </label>
              <input
                id="assoc_ord_to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="agri-control h-9 w-full min-w-0 rounded-xl px-2 text-sm text-[var(--text-primary)]"
              />
            </div>
            {dateFrom || dateTo ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo('') }}>
                Resetează perioada
              </Button>
            ) : null}
          </div>
        </DesktopToolbar>

        <DesktopSplitPane
          master={
            <ResponsiveDataView
              columns={desktopColumns}
              data={filtered}
              getRowId={(row) => row.id}
              skipDesktopDataFilter
              hideDesktopSearchRow
              mobileContainerClassName="grid-cols-1 gap-2"
              emptyMessage="Nicio comandă în acest filtru."
              onDesktopRowClick={(row) => setSelectedId(row.id)}
              isDesktopRowSelected={(row) => row.id === resolvedSelectedId}
              renderCard={(item) => {
                const st = item.status as ComandaStatus
                return (
                  <MobileEntityCard
                    title={item.clientName ?? 'Client'}
                    subtitle={item.farmName ?? ''}
                    mainValue={formatLei(item.total)}
                    secondaryValue={productLineLabel(item)}
                    statusLabel={statusLabelMap[st] ?? item.status}
                    statusTone={
                      statusVariantMap[st] === 'success'
                        ? 'success'
                        : statusVariantMap[st] === 'danger'
                          ? 'danger'
                          : 'neutral'
                    }
                    interactive
                    showChevron
                    onClick={() => {
                      setSelectedId(item.id)
                      setMobileDetailId(item.id)
                    }}
                    ariaLabel={`Comandă ${item.clientName}`}
                  />
                )
              }}
            />
          }
          detail={
            selected ? (
              <DesktopInspectorPanel title={`Comandă #${shortOrderId(selected)}`} description={formatDate(selected.data_comanda)}>
                {inspectorBody(selected)}
              </DesktopInspectorPanel>
            ) : (
              <aside className="hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-6 text-center text-sm text-[var(--text-secondary)] md:block">
                Selectează o comandă.
              </aside>
            )
          }
        />
      </div>

      <AppDialog
        open={showAddProduct && selected != null}
        onOpenChange={(open) => {
          setShowAddProduct(open)
          if (!open) {
            setAddLineDraft({ produsId: '', cantitate: '1', pretUnitar: '' })
          }
        }}
        title={selected ? `Adaugă produs la comanda #${shortOrderId(selected)}` : 'Adaugă produs'}
        description="Completează linia suplimentară confirmată telefonic cu clientul."
        footer={
          selected ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowAddProduct(false)}>
                Anulează
              </Button>
              <Button
                type="button"
                disabled={!selectedAddProduct || addLineBusy}
                onClick={() => void handleAddProduct(selected)}
              >
                {addLineBusy ? 'Se adaugă...' : 'Adaugă'}
              </Button>
            </div>
          ) : null
        }
        contentClassName="sm:max-w-lg"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="assoc-order-add-product" className="text-xs font-semibold text-[var(--text-secondary)]">
              Produs
            </label>
            <select
              id="assoc-order-add-product"
              value={addLineDraft.produsId}
              onChange={(event) => {
                const nextProduct = listedProducts.find((product) => product.id === event.target.value) ?? null
                const nextPrice = Number(nextProduct?.association_price ?? nextProduct?.pret_unitar ?? 0)
                setAddLineDraft((prev) => ({
                  ...prev,
                  produsId: event.target.value,
                  pretUnitar: nextPrice > 0 ? String(nextPrice) : prev.pretUnitar,
                }))
              }}
              className="agri-control h-10 w-full rounded-xl px-3 text-sm"
            >
              <option value="">Alege un produs listat</option>
              {listedProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.nume} · {product.farmName ?? 'Fermă'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="assoc-order-add-qty" className="text-xs font-semibold text-[var(--text-secondary)]">
                Cantitate
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="assoc-order-add-qty"
                  value={addLineDraft.cantitate}
                  onChange={(event) => setAddLineDraft((prev) => ({ ...prev, cantitate: event.target.value }))}
                  inputMode="decimal"
                  className="agri-control h-10 w-full rounded-xl px-3 text-sm"
                />
                <span className="text-sm text-[var(--text-secondary)]">
                  {selectedAddProduct?.unitate_vanzare ?? 'kg'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="assoc-order-add-price" className="text-xs font-semibold text-[var(--text-secondary)]">
                Preț unitar
              </label>
              <input
                id="assoc-order-add-price"
                value={addLineDraft.pretUnitar}
                onChange={(event) => setAddLineDraft((prev) => ({ ...prev, pretUnitar: event.target.value }))}
                inputMode="decimal"
                className="agri-control h-10 w-full rounded-xl px-3 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl bg-[var(--surface-card-muted)] px-3 py-3 text-sm">
            <p className="font-medium text-[var(--text-primary)]">
              Total linie: <span className="tabular-nums">{formatLei(addLineTotalLei)}</span>
            </p>
            {selectedAddProduct ? (
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                Preț implicit: {formatLei(Number(selectedAddProduct.association_price ?? selectedAddProduct.pret_unitar ?? 0))}
              </p>
            ) : null}
          </div>
        </div>
      </AppDialog>

      <AppDrawer
        open={mobileDetailId != null}
        onOpenChange={(o) => {
          if (!o) setMobileDetailId(null)
        }}
        title={mobileDetail ? `#${shortOrderId(mobileDetail)}` : 'Comandă'}
        description={mobileDetail?.clientName ?? undefined}
      >
        {mobileDetail ? (
          <div className="space-y-4 pb-6">{inspectorBody(mobileDetail, { hideClientName: true })}</div>
        ) : null}
      </AppDrawer>
    </AppShell>
  )
}
