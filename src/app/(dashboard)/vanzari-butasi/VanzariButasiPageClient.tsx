'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  ArrowDownUp,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Search,
  Send,
  Sprout,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { ErrorState } from '@/components/app/ErrorState'
import { ListSkeletonCard } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { useAddAction } from '@/contexts/AddActionContext'
import { getClienți } from '@/lib/supabase/queries/clienti'
import {
  SURSA_COMANDA_BUTASI_LABELS,
  SURSE_COMANDA_BUTASI,
  deleteVanzareButasi,
  getVanzariButasi,
  updateVanzareButasi,
  type SursaComandaButasi,
  type VanzareButasi,
} from '@/lib/supabase/queries/vanzari-butasi'
import { buildButasiOrderDeleteLabel } from '@/lib/ui/delete-labels'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import type { SharedContact } from '@/lib/vanzari-butasi/shared-contact'

// Dialoguri mari deschise doar la interacțiune — code-split (ssr:false), ca în
// modulele deja optimizate. Nu randează DOM când sunt închise.
const ComandaButasiWizard = dynamic(
  () => import('@/components/vanzari-butasi/ComandaButasiWizard').then((mod) => mod.ComandaButasiWizard),
  { ssr: false }
)
const DeleteConfirmDialog = dynamic(
  () => import('@/components/parcele/DeleteConfirmDialog').then((mod) => mod.DeleteConfirmDialog),
  { ssr: false }
)

interface Client {
  id: string
  nume_client: string
  telefon: string | null
}

interface Parcela {
  id: string
  nume_parcela: string
}

interface VanzariButasiPageClientProps {
  initialVanzari: VanzareButasi[]
  clienti: Client[]
  parcele: Parcela[]
}

type ViewFilter = 'active' | 'luna' | 'toate'
type SursaFilter = 'toate' | SursaComandaButasi
type SortKey = 'noi' | 'vechi' | 'livrare' | 'rest'

const SORT_OPTIONS: Array<{ key: SortKey; label: string; hint: string }> = [
  { key: 'noi', label: 'Cele mai noi', hint: 'după data comenzii' },
  { key: 'vechi', label: 'Cele mai vechi', hint: 'după data comenzii' },
  { key: 'livrare', label: 'Livrare apropiată', hint: 'primele de livrat' },
  { key: 'rest', label: 'Rest de încasat', hint: 'cine are de dat cel mai mult' },
]

const SURSA_ICONS: Record<SursaComandaButasi, LucideIcon> = {
  whatsapp: MessageCircle,
  telefon: Phone,
  messenger: Send,
  instagram: Camera,
  facebook: Users,
  personal: UserRound,
  altul: MoreHorizontal,
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const toIso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const isoInDays = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return toIso(d)
}

function dayLabel(value: string | null | undefined): string {
  if (!value) return ''
  const v = value.slice(0, 10)
  if (v === isoInDays(0)) return 'azi'
  if (v === isoInDays(-1)) return 'ieri'
  if (v === isoInDays(1)) return 'mâine'
  const d = new Date(`${v}T12:00:00`)
  if (Number.isNaN(d.getTime())) return v
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('ro-RO', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
}

const formatLei = (value: number) => `${Math.round(value).toLocaleString('ro-RO')} lei`

const isActiveOrder = (v: VanzareButasi) => v.status !== 'livrata' && v.status !== 'anulata'
const orderRest = (v: VanzareButasi) => Math.max(0, Number(v.total_lei || 0) - Number(v.avans_suma || 0))

function statusInfo(status: string): { label: string; className: string } {
  if (status === 'livrata') return { label: 'Livrată', className: 'bg-[var(--soft-success-bg)] text-[var(--soft-success-text)]' }
  if (status === 'anulata') return { label: 'Anulată', className: 'bg-[var(--soft-danger-bg)] text-[var(--soft-danger-text)]' }
  if (status === 'confirmata' || status === 'pregatita')
    return { label: 'În curs', className: 'bg-[var(--soft-warning-bg)] text-[var(--soft-warning-text)]' }
  return { label: 'Nouă', className: 'bg-[var(--soft-info-bg)] text-[var(--soft-info-text)]' }
}

// ─── Card comandă ─────────────────────────────────────────────────────────────

function ButasiOrderCard({
  vanzare,
  clientNume,
  onOpen,
  onDeliver,
}: {
  vanzare: VanzareButasi
  clientNume: string | undefined
  onOpen: () => void
  onDeliver: () => void
}) {
  const title = clientNume ?? vanzare.client_nume_manual ?? '—'
  const status = statusInfo(vanzare.status)
  const rest = orderRest(vanzare)
  const active = isActiveOrder(vanzare)
  const SursaIcon = vanzare.sursa_comanda ? SURSA_ICONS[vanzare.sursa_comanda] : null
  const livrare = vanzare.data_livrare_estimata?.slice(0, 10) ?? null
  const livrareSoon = Boolean(livrare && active && livrare >= isoInDays(0) && livrare <= isoInDays(2))
  const items = vanzare.items?.length
    ? vanzare.items
    : vanzare.soi_butasi
      ? [{ id: 'legacy', soi: vanzare.soi_butasi, cantitate: vanzare.cantitate_butasi }]
      : []

  return (
    <div className="overflow-hidden rounded-[22px] border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)]">
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Deschide comanda lui ${title}`}
      className="flex w-full flex-col gap-3 p-4 text-left transition-transform active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[19px] font-extrabold leading-tight tracking-[-0.01em] text-[var(--text-primary)]">
            {title}
          </span>
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm font-medium text-[var(--text-secondary)]">
            <span>Comandat {dayLabel(vanzare.data_comanda) || '—'}</span>
            {SursaIcon && vanzare.sursa_comanda ? (
              <>
                <span aria-hidden className="h-1 w-1 rounded-full bg-[var(--text-secondary)] opacity-50" />
                <span className="inline-flex items-center gap-1">
                  <SursaIcon className="h-3.5 w-3.5" aria-hidden />
                  {SURSA_COMANDA_BUTASI_LABELS[vanzare.sursa_comanda]}
                </span>
              </>
            ) : null}
          </span>
        </div>
        <span className="shrink-0 text-[22px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">
          {formatLei(Number(vanzare.total_lei || 0))}
        </span>
      </div>

      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item.id}
              className="inline-flex h-8 items-center rounded-[10px] bg-[color-mix(in_srgb,var(--agri-primary)_14%,var(--surface-card))] px-3 text-sm font-bold text-[var(--text-primary)]"
            >
              {item.soi} · {Number(item.cantitate || 0)} buc
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 border-t border-[var(--border-default)] pt-3">
        <span
          className={cn(
            'inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold',
            livrareSoon ? 'text-[var(--soft-warning-text)]' : 'text-[var(--text-primary)]',
            !livrare && 'font-medium text-[var(--text-secondary)]',
          )}
        >
          {vanzare.status === 'livrata' ? (
            <>Livrată{livrare ? ` ${dayLabel(livrare)}` : ''}</>
          ) : livrare ? (
            <>
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Livrare {dayLabel(livrare)}</span>
            </>
          ) : (
            'Fără dată de livrare'
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {vanzare.status !== 'anulata' ? (
            <span
              className={cn(
                'inline-flex h-[30px] items-center rounded-full px-3 text-[13px] font-bold',
                rest > 0
                  ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
                  : 'bg-[var(--soft-success-bg)] text-[var(--success-text)]',
              )}
            >
              {rest > 0 ? `rest ${formatLei(rest)}` : 'achitat'}
            </span>
          ) : null}
          <span className={cn('inline-flex h-[30px] items-center rounded-full px-3 text-[13px] font-bold', status.className)}>
            {status.label}
          </span>
          <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden />
        </span>
      </div>
    </button>
    {active ? (
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={onDeliver}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--agri-primary)] text-base font-bold text-[var(--agri-primary-contrast)] active:opacity-90"
        >
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          Marchează livrată
        </button>
      </div>
    ) : null}
    </div>
  )
}

// ─── Confirmare livrare ───────────────────────────────────────────────────────

function DeliverSheet({
  vanzare,
  clientNume,
  pending,
  onClose,
  onConfirm,
}: {
  vanzare: VanzareButasi
  clientNume: string | undefined
  pending: boolean
  onClose: () => void
  onConfirm: (incasat: boolean) => void
}) {
  const rest = orderRest(vanzare)
  const total = Number(vanzare.total_lei || 0)
  return (
    <div
      className="fixed inset-0 z-[1001] flex items-end justify-center bg-black/45 md:items-center"
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !pending) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Marchează comanda livrată"
        className="w-full max-w-md space-y-3 rounded-t-[28px] bg-[var(--surface-card)] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-3 md:rounded-[28px]"
      >
        <div className="mx-auto mb-1 h-1.5 w-11 rounded-full bg-[var(--border-default)]" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-[22px] font-extrabold leading-tight text-[var(--text-primary)]">Comanda e livrată?</h2>
            <p className="text-base text-[var(--text-secondary)]">
              {clientNume ?? vanzare.client_nume_manual ?? 'Client'} · {formatLei(total)}
            </p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={pending}
            aria-label="Închide"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--agri-surface-muted)] text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {rest > 0 ? (
          <>
            <p className="rounded-2xl bg-[var(--status-warning-bg)] px-4 py-3 text-[15px] font-semibold text-[var(--status-warning-text)]">
              Mai are de plată {formatLei(rest)}.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={() => onConfirm(true)}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[var(--agri-primary)] px-4 text-[17px] font-extrabold text-[var(--agri-primary-contrast)] disabled:opacity-60"
            >
              {pending ? 'Se salvează…' : `Livrată și încasată (${formatLei(rest)})`}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => onConfirm(false)}
              className="flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-[var(--border-default)] px-4 text-base font-bold text-[var(--text-primary)] disabled:opacity-60"
            >
              Livrată, încasez mai târziu
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => onConfirm(false)}
            className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-[var(--agri-primary)] px-4 text-[17px] font-extrabold text-[var(--agri-primary-contrast)] disabled:opacity-60"
          >
            {pending ? 'Se salvează…' : 'Da, e livrată'}
          </button>
        )}
        <p className="text-center text-[13px] text-[var(--text-secondary)]">Totalul comenzii intră la venituri, la data livrării.</p>
      </div>
    </div>
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

export function VanzariButasiPageClient({ initialVanzari, clienti }: VanzariButasiPageClientProps) {
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()

  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: VanzareButasi; index: number }>>({})
  const deleteMutateRef = useRef<(id: string) => void>(() => {})

  const [searchTerm, setSearchTerm] = useState('')
  const [viewFilter, setViewFilter] = useState<ViewFilter>('active')
  const [sursaFilter, setSursaFilter] = useState<SursaFilter>('toate')
  const [sortKey, setSortKey] = useState<SortKey>('noi')
  const [sortOpen, setSortOpen] = useState(false)
  const [deliveringVanzare, setDeliveringVanzare] = useState<VanzareButasi | null>(null)
  const [sharedContact, setSharedContact] = useState<SharedContact | null>(null)

  // „Distribuie” din Contacte → /api/share/contact → aici, cu contactul în fragmentul URL (#contact=…).
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith('#contact')) return
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    if (!hash.startsWith('#contact=')) {
      toast.error('Nu am putut citi contactul distribuit. Scrie-l de mână, te rog.')
      return
    }
    try {
      const data = JSON.parse(decodeURIComponent(hash.slice('#contact='.length))) as { n?: unknown; t?: unknown }
      const contact = {
        name: typeof data.n === 'string' ? data.n.slice(0, 120) : '',
        phone: typeof data.t === 'string' ? data.t.slice(0, 40) : '',
      }
      if (!contact.name && !contact.phone) throw new Error('empty')
      setSharedContact(contact)
      setAddOpen(true)
    } catch {
      toast.error('Nu am putut citi contactul distribuit. Scrie-l de mână, te rog.')
    }
  }, [])
  const [addOpen, setAddOpen] = useState(false)
  const [editingVanzare, setEditingVanzare] = useState<VanzareButasi | null>(null)
  const [deletingVanzare, setDeletingVanzare] = useState<VanzareButasi | null>(null)

  const {
    data: vanzari = initialVanzari,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.vanzariButasi,
    queryFn: getVanzariButasi,
    initialData: initialVanzari,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteVanzareButasi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzariButasi })
      toast.success('Comanda ștearsă')
      setDeletingVanzare(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  useEffect(() => {
    deleteMutateRef.current = (id) => deleteMutation.mutate(id)
  }, [deleteMutation])
  useEffect(() => {
    const pendingTimersRef = pendingDeleteTimers
    const pendingItemsRef = pendingDeletedItems
    return () => {
      Object.keys(pendingTimersRef.current).forEach((id) => {
        clearTimeout(pendingTimersRef.current[id])
        if (pendingItemsRef.current[id]) {
          delete pendingItemsRef.current[id]
          deleteMutateRef.current(id)
        }
      })
      pendingTimersRef.current = {}
    }
  }, [])

  useEffect(() => {
    const unregister = registerAddAction(() => setAddOpen(true), 'Adaugă vânzare material săditor')
    return unregister
  }, [registerAddAction])

  const scheduleDelete = (order: VanzareButasi) => {
    const orderId = order.id
    const currentItems = queryClient.getQueryData<VanzareButasi[]>(queryKeys.vanzariButasi) ?? []
    const deleteIndex = currentItems.findIndex((item) => item.id === orderId)

    pendingDeletedItems.current[orderId] = { item: order, index: deleteIndex }
    queryClient.setQueryData<VanzareButasi[]>(queryKeys.vanzariButasi, (current = []) =>
      current.filter((item) => item.id !== orderId)
    )

    const timer = setTimeout(() => {
      delete pendingDeleteTimers.current[orderId]
      delete pendingDeletedItems.current[orderId]
      deleteMutation.mutate(orderId)
    }, 5000)

    pendingDeleteTimers.current[orderId] = timer

    toast('Element șters', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const pendingTimer = pendingDeleteTimers.current[orderId]
          if (!pendingTimer) return
          clearTimeout(pendingTimer)
          delete pendingDeleteTimers.current[orderId]
          const pendingItem = pendingDeletedItems.current[orderId]
          delete pendingDeletedItems.current[orderId]
          if (!pendingItem) return
          queryClient.setQueryData<VanzareButasi[]>(queryKeys.vanzariButasi, (current = []) => {
            if (current.some((item) => item.id === orderId)) return current
            const next = [...current]
            const insertAt = pendingItem.index >= 0 ? Math.min(pendingItem.index, next.length) : next.length
            next.splice(insertAt, 0, pendingItem.item)
            return next
          })
        },
      },
    })
  }

  const { data: clientiData = clienti } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
    initialData: clienti as Parameters<typeof getClienți> extends never ? never : Awaited<ReturnType<typeof getClienți>>,
    staleTime: 0,
    refetchOnMount: true,
  })

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {}
    clientiData.forEach((c) => { map[c.id] = c.nume_client || 'Client' })
    return map
  }, [clientiData])

  const deliverMutation = useMutation({
    mutationFn: async ({ vanzare, incasat }: { vanzare: VanzareButasi; incasat: boolean }) => {
      const today = isoInDays(0)
      const livrare = vanzare.data_livrare_estimata?.slice(0, 10)
      return updateVanzareButasi(vanzare.id, {
        status: 'livrata',
        // Data livrării devine azi dacă lipsea sau era în viitor (contează la venituri pe data asta).
        ...(!livrare || livrare > today ? { data_livrare_estimata: today } : {}),
        ...(incasat ? { avans_suma: Number(vanzare.total_lei || 0), avans_data: today } : {}),
      })
    },
    onSuccess: (_saved, { incasat }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzariButasi })
      toast.success(incasat ? 'Livrată și încasată — a intrat la venituri' : 'Marcată livrată — a intrat la venituri')
      setDeliveringVanzare(null)
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error && err.message ? err.message : 'Nu am putut marca comanda ca livrată.')
    },
  })

  // ── Computed ───────────────────────────────────────────────────────────────

  const currentMonth = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const stats = useMemo(() => {
    const lunaOrders = vanzari.filter((v) => (v.data_comanda ?? '').startsWith(currentMonth))
    const totalButasi = lunaOrders.reduce(
      (sum, v) => sum + (v.items ?? []).reduce((s, item) => s + Number(item.cantitate || 0), 0),
      0,
    )
    // De încasat: tot ce nu e anulat și n-a fost plătit integral (inclusiv livrate cu rest).
    const deIncasat = vanzari.filter((v) => v.status !== 'anulata').reduce((sum, v) => sum + orderRest(v), 0)
    return {
      nrLuna: lunaOrders.length,
      totalButasi,
      deIncasat,
      nrActive: vanzari.filter(isActiveOrder).length,
      nrTotal: vanzari.length,
    }
  }, [vanzari, currentMonth])

  const viewRows = useMemo(() => {
    if (viewFilter === 'active') return vanzari.filter(isActiveOrder)
    if (viewFilter === 'luna') return vanzari.filter((v) => (v.data_comanda ?? '').startsWith(currentMonth))
    return vanzari
  }, [vanzari, viewFilter, currentMonth])

  // Sursele care apar efectiv în vederea aleasă, cu numărul de comenzi.
  const sursaCounts = useMemo(() => {
    const counts = new Map<SursaComandaButasi, number>()
    viewRows.forEach((v) => {
      if (v.sursa_comanda) counts.set(v.sursa_comanda, (counts.get(v.sursa_comanda) ?? 0) + 1)
    })
    return SURSE_COMANDA_BUTASI.filter((key) => counts.has(key)).map((key) => ({ key, count: counts.get(key) ?? 0 }))
  }, [viewRows])

  // Dacă sursa aleasă nu mai există în vederea curentă, revenim la „Toate sursele”.
  const activeSursa: SursaFilter =
    sursaFilter !== 'toate' && sursaCounts.some((c) => c.key === sursaFilter) ? sursaFilter : 'toate'

  const filteredVanzari = useMemo(() => {
    let rows = viewRows

    if (activeSursa !== 'toate') {
      rows = rows.filter((v) => v.sursa_comanda === activeSursa)
    }

    const term = searchTerm.toLowerCase().trim()
    if (term) {
      rows = rows.filter((order) => {
        const clientName = order.client_id
          ? clientMap[order.client_id]?.toLowerCase()
          : (order.client_nume_manual?.toLowerCase() ?? '')
        const itemNames = (order.items ?? []).map((item) => item.soi.toLowerCase()).join(' ')
        const sursa = order.sursa_comanda ? SURSA_COMANDA_BUTASI_LABELS[order.sursa_comanda].toLowerCase() : ''
        return (
          clientName?.includes(term) ||
          order.observatii?.toLowerCase().includes(term) ||
          order.adresa_livrare?.toLowerCase().includes(term) ||
          itemNames.includes(term) ||
          sursa.includes(term)
        )
      })
    }

    const byCreated = (a: VanzareButasi, b: VanzareButasi) => (b.created_at ?? '').localeCompare(a.created_at ?? '')
    return [...rows].sort((a, b) => {
      if (sortKey === 'rest') return orderRest(b) - orderRest(a) || byCreated(a, b)
      if (sortKey === 'livrare') {
        const la = a.data_livrare_estimata ?? ''
        const lb = b.data_livrare_estimata ?? ''
        if (!la && !lb) return byCreated(a, b)
        if (!la) return 1
        if (!lb) return -1
        return la.localeCompare(lb)
      }
      const byDate = (a.data_comanda ?? '').localeCompare(b.data_comanda ?? '')
      if (sortKey === 'vechi') return byDate || -byCreated(a, b)
      return -byDate || byCreated(a, b)
    })
  }, [viewRows, activeSursa, searchTerm, clientMap, sortKey])

  const sortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? 'Sortare'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell
      header={
        <PageHeader
          title="Material săditor"
          subtitle="Comenzi material săditor"
          rightSlot={<Sprout className="h-5 w-5 shrink-0 text-[var(--agri-text-muted)]" aria-hidden />}
        />
      }
    >
      <div className="mx-auto mt-2 w-full max-w-4xl space-y-3 px-0 pb-24 pt-3 sm:mt-0 sm:px-3">

        {/* Cifre */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="flex min-h-[78px] flex-col justify-center gap-0.5 rounded-[18px] bg-[#1b3a2a] p-3 text-white">
            <span className="text-[22px] font-extrabold leading-none tracking-[-0.02em]">{stats.nrLuna}</span>
            <span className="text-[12.5px] font-medium leading-tight text-[#b9d4c5]">comenzi luna asta</span>
          </div>
          <div className="flex min-h-[78px] flex-col justify-center gap-0.5 rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-card)] p-3">
            <span className="text-[22px] font-extrabold leading-none tracking-[-0.02em] text-[var(--text-primary)]">
              {stats.totalButasi.toLocaleString('ro-RO')}
            </span>
            <span className="text-[12.5px] font-medium leading-tight text-[var(--text-secondary)]">butași luna asta</span>
          </div>
          <div className="flex min-h-[78px] flex-col justify-center gap-0.5 rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-card)] p-3">
            <span className="text-[22px] font-extrabold leading-none tracking-[-0.02em] text-[var(--status-warning-text)]">
              {Math.round(stats.deIncasat).toLocaleString('ro-RO')}
            </span>
            <span className="text-[12.5px] font-medium leading-tight text-[var(--text-secondary)]">lei de încasat</span>
          </div>
        </div>

        {/* Vedere */}
        <div
          role="group"
          aria-label="Ce comenzi arăt"
          className="grid grid-cols-3 gap-1 rounded-2xl bg-[var(--agri-surface-muted)] p-1"
        >
          {(
            [
              ['active', 'De livrat', stats.nrActive],
              ['luna', 'Luna asta', stats.nrLuna],
              ['toate', 'Toate', stats.nrTotal],
            ] as Array<[ViewFilter, string, number]>
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setViewFilter(value)}
              aria-pressed={viewFilter === value}
              className={cn(
                'h-11 rounded-xl text-[15px] font-bold text-[var(--text-secondary)]',
                viewFilter === value && 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-[var(--shadow-soft)]',
              )}
            >
              {label} <span className="font-semibold opacity-70">{count}</span>
            </button>
          ))}
        </div>

        {/* Căutare + sortare */}
        <div className="flex gap-2.5">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-secondary)]" aria-hidden />
            <label htmlFor="vb_search" className="sr-only">
              Caută comenzi material săditor
            </label>
            <input
              id="vb_search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Caută client sau soi"
              autoComplete="off"
              className="h-[52px] w-full rounded-2xl border-2 border-[var(--border-default)] bg-[var(--surface-card)] pl-11 pr-3 text-base text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] focus:border-[var(--agri-primary)]"
            />
          </div>
          <button
            type="button"
            onClick={() => setSortOpen(true)}
            aria-label={`Sortare: ${sortLabel}. Schimbă`}
            className="flex h-[52px] shrink-0 items-center gap-2 rounded-2xl border-2 border-[var(--border-default)] bg-[var(--surface-card)] px-3.5 text-[15px] font-bold text-[var(--text-primary)]"
          >
            <ArrowDownUp className="h-5 w-5" aria-hidden />
            <span className="max-[360px]:hidden">{sortLabel}</span>
          </button>
        </div>

        {/* Surse — pe mai multe rânduri, ca să nu se taie */}
        {sursaCounts.length > 0 ? (
          <div role="group" aria-label="Filtrează după sursa comenzii" className="flex flex-wrap gap-2">
            {[{ key: 'toate' as const, count: viewRows.length }, ...sursaCounts].map(({ key, count }) => {
              const on = activeSursa === key
              const Icon = key === 'toate' ? null : SURSA_ICONS[key]
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSursaFilter(key)}
                  aria-pressed={on}
                  className={cn(
                    'inline-flex h-11 items-center gap-1.5 rounded-full border-2 px-4 text-[15px] font-bold',
                    on
                      ? 'border-[var(--agri-primary)] bg-[var(--agri-primary)] text-[var(--agri-primary-contrast)]'
                      : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)]',
                  )}
                >
                  {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
                  {key === 'toate' ? 'Toate sursele' : SURSA_COMANDA_BUTASI_LABELS[key]}
                  <span className="font-semibold opacity-75">{count}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        {/* Error */}
        {isError ? <ErrorState title="Eroare" message={(error as Error).message} /> : null}

        {/* Loading */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <ListSkeletonCard key={i} className="min-h-[72px]" />
            ))}
          </div>
        ) : null}

        {!isLoading && !isError ? (
          <p className="px-0.5 pt-1 text-sm font-semibold text-[var(--text-secondary)]">
            {filteredVanzari.length} {filteredVanzari.length === 1 ? 'comandă' : 'comenzi'}
          </p>
        ) : null}

        {/* Empty state */}
        {!isLoading && !isError && filteredVanzari.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Sprout className="mx-auto mb-3 h-10 w-10 text-[var(--text-secondary)]" aria-hidden />
            <p className="mb-1 text-base font-bold text-[var(--text-primary)]">
              {vanzari.length ? 'Nicio comandă aici' : 'Nicio comandă adăugată'}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              {vanzari.length ? 'Schimbă filtrul sau caută altceva.' : 'Adaugă prima comandă de material săditor.'}
            </p>
          </div>
        ) : null}

        {/* Cards */}
        {!isLoading && !isError && filteredVanzari.length > 0 ? (
          <div className="space-y-3">
            {filteredVanzari.map((vanzare) => (
              <ButasiOrderCard
                key={vanzare.id}
                vanzare={vanzare}
                clientNume={vanzare.client_id ? clientMap[vanzare.client_id] : (vanzare.client_nume_manual ?? undefined)}
                onOpen={() => setEditingVanzare(vanzare)}
                onDeliver={() => setDeliveringVanzare(vanzare)}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Sortare — foaie de jos */}
      {sortOpen ? (
        <div
          className="fixed inset-0 z-[1001] flex items-end justify-center bg-black/45 md:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSortOpen(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setSortOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sortează comenzile"
            className="w-full max-w-md space-y-2.5 rounded-t-[28px] bg-[var(--surface-card)] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] pt-3 md:rounded-[28px]"
          >
            <div className="mx-auto mb-1 h-1.5 w-11 rounded-full bg-[var(--border-default)]" aria-hidden />
            <div className="flex items-center justify-between">
              <h2 className="text-[22px] font-extrabold text-[var(--text-primary)]">Sortează după</h2>
              <button
                type="button"
                autoFocus
                onClick={() => setSortOpen(false)}
                aria-label="Închide"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--agri-surface-muted)] text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {SORT_OPTIONS.map((option) => {
              const on = option.key === sortKey
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setSortKey(option.key)
                    setSortOpen(false)
                  }}
                  aria-pressed={on}
                  className={cn(
                    'flex min-h-[60px] w-full items-center justify-between rounded-2xl border-2 px-4 text-left',
                    on
                      ? 'border-[var(--agri-primary)] bg-[color-mix(in_srgb,var(--agri-primary)_12%,var(--surface-card))]'
                      : 'border-[var(--border-default)] bg-[var(--surface-card)]',
                  )}
                >
                  <span className="flex flex-col">
                    <span className="text-[17px] font-bold text-[var(--text-primary)]">{option.label}</span>
                    <span className="text-[13px] text-[var(--text-secondary)]">{option.hint}</span>
                  </span>
                  {on ? <Check className="h-5 w-5 text-[var(--agri-primary)]" aria-hidden /> : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <ComandaButasiWizard
        open={addOpen}
        onOpenChange={(next) => {
          setAddOpen(next)
          if (!next) setSharedContact(null)
        }}
        initialContact={sharedContact}
      />

      <ComandaButasiWizard
        open={!!editingVanzare}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditingVanzare(null)
        }}
        editOrder={editingVanzare}
        editClientName={editingVanzare?.client_id ? (clientMap[editingVanzare.client_id] ?? '') : ''}
        onDelete={(order) => scheduleDelete(order)}
      />

      {/* Marchează livrată — foaie de jos */}
      {deliveringVanzare ? (
        <DeliverSheet
          vanzare={deliveringVanzare}
          clientNume={
            deliveringVanzare.client_id
              ? clientMap[deliveringVanzare.client_id]
              : (deliveringVanzare.client_nume_manual ?? undefined)
          }
          pending={deliverMutation.isPending}
          onClose={() => setDeliveringVanzare(null)}
          onConfirm={(incasat) => deliverMutation.mutate({ vanzare: deliveringVanzare, incasat })}
        />
      ) : null}

      <DeleteConfirmDialog
        open={!!deletingVanzare}
        onOpenChange={(nextOpen) => { if (!nextOpen) setDeletingVanzare(null) }}
        onConfirm={() => {
          if (!deletingVanzare) return
          scheduleDelete(deletingVanzare)
          setDeletingVanzare(null)
        }}
        itemName={buildButasiOrderDeleteLabel(
          deletingVanzare,
          deletingVanzare?.client_id ? clientMap[deletingVanzare.client_id] : (deletingVanzare?.client_nume_manual || '')
        )}
        itemType="comanda"
        description={`Ștergi comanda din ${deletingVanzare?.data_comanda ? new Date(deletingVanzare.data_comanda).toLocaleDateString('ro-RO') : 'data necunoscută'} către ${deletingVanzare?.client_id ? clientMap[deletingVanzare.client_id] : (deletingVanzare?.client_nume_manual || 'client necunoscut')}?`}
      />
    </AppShell>
  )
}
