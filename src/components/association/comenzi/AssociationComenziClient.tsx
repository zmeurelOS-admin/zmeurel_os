'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { MessageCircle, Phone } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
import type { AssociationOrder } from '@/lib/association/queries'
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

function shortOrderId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase()
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
  const n = o.produs?.nume?.trim()
  if (n) return `${n} · ${Number(o.cantitate_kg || 0).toFixed(2)} kg`
  return `${Number(o.cantitate_kg || 0).toFixed(2)} kg`
}

async function patchAssociationOrderStatus(orderId: string, status: ComandaStatus) {
  const res = await fetch('/api/association/orders', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, status }),
  })
  const json = (await res.json().catch(() => null)) as
    | { ok?: boolean; data?: { id: string; status: string; updated_at: string }; error?: { message?: string } }
    | null
  if (!res.ok || !json?.ok || !json.data) {
    const msg = json && typeof json === 'object' && 'error' in json && json.error?.message
    throw new Error(typeof msg === 'string' ? msg : 'Actualizare eșuată.')
  }
  return json.data
}

export type AssociationComenziClientProps = {
  initialOrders: AssociationOrder[]
  canManage: boolean
  /** Din `?status=` pe URL (ex. `noua` pentru link-uri rapide). */
  initialStatusFilter?: string
}

export function AssociationComenziClient({
  initialOrders,
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

  useEffect(() => {
    setOrders(initialOrders)
  }, [initialOrders])

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (!tabMatches(tab, o.status)) return false
      if (dateFrom && o.data_comanda < dateFrom) return false
      if (dateTo && o.data_comanda > dateTo) return false
      if (search.trim()) {
        const q = normalizeText(search.trim())
        const client = normalizeText(o.clientName ?? '')
        const prod = normalizeText(o.produs?.nume ?? '')
        const farm = normalizeText(o.farmName ?? '')
        if (!client.includes(q) && !prod.includes(q) && !farm.includes(q)) return false
      }
      return true
    })
  }, [orders, tab, search, dateFrom, dateTo])

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

  const applyStatus = useCallback(
    async (o: AssociationOrder, next: ComandaStatus) => {
      if (!canManage || next === (o.status as ComandaStatus)) return
      setStatusBusyId(o.id)
      const prev = o.status
      setOrders((prevOrders) => prevOrders.map((x) => (x.id === o.id ? { ...x, status: next } : x)))
      try {
        const data = await patchAssociationOrderStatus(o.id, next)
        setOrders((prevOrders) =>
          prevOrders.map((x) => (x.id === data.id ? { ...x, status: data.status, updated_at: data.updated_at } : x))
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
        accessorFn: (row) => shortOrderId(row.id),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-[var(--text-secondary)]">{shortOrderId(row.original.id)}</span>
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
      <DesktopInspectorSection label="Produs">
        <p className="text-sm text-[var(--text-primary)]">{productLineLabel(o)}</p>
        <p className="text-xs text-[var(--text-muted)]">
          Preț/kg: {Number(o.pret_per_kg || 0).toFixed(2)} lei · Total: {formatLei(o.total)}
        </p>
      </DesktopInspectorSection>
      <DesktopInspectorSection label="Producător">
        <p className="font-medium text-[var(--text-primary)]">{o.farmName ?? '—'}</p>
      </DesktopInspectorSection>
      {o.observatii?.trim() ? (
        <DesktopInspectorSection label="Observații">
          <p className="text-sm whitespace-pre-wrap text-[var(--text-secondary)]">{o.observatii.trim()}</p>
        </DesktopInspectorSection>
      ) : null}
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
              <DesktopInspectorPanel title={`Comandă #${shortOrderId(selected.id)}`} description={formatDate(selected.data_comanda)}>
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

      <AppDrawer
        open={mobileDetailId != null}
        onOpenChange={(o) => {
          if (!o) setMobileDetailId(null)
        }}
        title={mobileDetail ? `#${shortOrderId(mobileDetail.id)}` : 'Comandă'}
        description={mobileDetail?.clientName ?? undefined}
      >
        {mobileDetail ? (
          <div className="space-y-4 pb-6">{inspectorBody(mobileDetail, { hideClientName: true })}</div>
        ) : null}
      </AppDrawer>
    </AppShell>
  )
}
