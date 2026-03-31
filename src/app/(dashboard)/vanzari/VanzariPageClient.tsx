'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { ErrorState } from '@/components/app/ErrorState'
import { TableCardsSkeleton } from '@/components/app/ModuleSkeletons'
import { PageHeader } from '@/components/app/PageHeader'
import { Button } from '@/components/ui/button'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import { ResponsiveDataView } from '@/components/ui/ResponsiveDataView'
import { SearchField } from '@/components/ui/SearchField'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { getComenzi } from '@/lib/supabase/queries/comenzi'
import { getClienți } from '@/lib/supabase/queries/clienti'
import { deleteVanzare, getVanzari, updateVanzare, type Vanzare } from '@/lib/supabase/queries/vanzari'
import { useAddAction } from '@/contexts/AddActionContext'
import { queryKeys } from '@/lib/query-keys'

const AddVanzareDialog = dynamic(
  () => import('@/components/vanzari/AddVanzareDialog').then((mod) => mod.AddVanzareDialog),
  { ssr: false }
)
const EditVanzareDialog = dynamic(
  () => import('@/components/vanzari/EditVanzareDialog').then((mod) => mod.EditVanzareDialog),
  { ssr: false }
)
const ConfirmDeleteDialog = dynamic(
  () => import('@/components/app/ConfirmDeleteDialog').then((mod) => mod.ConfirmDeleteDialog),
  { ssr: false }
)

interface Client {
  id: string
  nume: string
  telefon: string | null
}

interface VanzariPageClientProps {
  initialVanzari?: Vanzare[]
  clienti?: Client[]
}

type TemporalFilter = 'luna' | 'sapt' | 'toate'

function toDateOnly(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10)
}

function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function getStartOfWeek(value: Date): Date {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  const weekday = date.getDay()
  const shift = weekday === 0 ? 6 : weekday - 1
  date.setDate(date.getDate() - shift)
  return date
}

function getStartOfMonth(value: Date): Date {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  date.setDate(1)
  return date
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isIncasata(status: string | null | undefined): boolean {
  const normalized = normalizeText(status)
  return normalized.includes('incasat') || normalized.includes('platit') || normalized.includes('achitat')
}

function formatData(value: string): string {
  const d = new Date(value)
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })
}

function formatRon(value: number): string {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(value)
}

interface EnrichedVanzare extends Vanzare {
  clientNume: string
  telefon: string | null
  totalRon: number
  incasata: boolean
}

interface VanzareCardNewProps {
  vanzare: EnrichedVanzare
  isExpanded: boolean
  onToggle: () => void
  onMarkPaid: () => void
  onMarkUnpaid: () => void
  onEdit: () => void
  onDelete: () => void
  onOpenComanda: () => void
}

function VanzareCardNew({ vanzare, isExpanded, onToggle, onMarkPaid, onMarkUnpaid, onEdit, onDelete, onOpenComanda }: VanzareCardNewProps) {
  return (
    <MobileEntityCard
      title={vanzare.clientNume}
      mainValue={`${formatRon(vanzare.totalRon)} RON`}
      subtitle={`${Number(vanzare.cantitate_kg || 0).toFixed(1)} kg · ${formatData(vanzare.data)}`}
      meta={vanzare.comanda_id ? 'Din comandă' : undefined}
      statusLabel={vanzare.incasata ? 'Încasat' : 'Neîncasat'}
      statusTone={vanzare.incasata ? 'success' : 'warning'}
      onClick={onToggle}
      bottomSlot={isExpanded ? (
        <>
          {/* DETALII */}
          <div className="flex flex-wrap gap-2 text-xs text-[var(--agri-text)]">
            <span>
              <span className="text-[var(--agri-text-muted)]">Cantitate: </span>
              <span className="font-semibold">{Number(vanzare.cantitate_kg || 0).toFixed(2)} kg</span>
            </span>
            <span>
              <span className="text-[var(--agri-text-muted)]">Preț: </span>
              <span className="font-semibold">{Number(vanzare.pret_lei_kg || 0).toFixed(2)} RON/kg</span>
            </span>
            <span>
              <span className="text-[var(--agri-text-muted)]">Total: </span>
              <span className="font-semibold text-[var(--value-positive)]">{formatRon(vanzare.totalRon)} RON</span>
            </span>
            <span>
              <span className="text-[var(--agri-text-muted)]">Data: </span>
              <span className="font-semibold">{new Date(vanzare.data).toLocaleDateString('ro-RO')}</span>
            </span>
            <span>
              <span className="text-[var(--agri-text-muted)]">Încasat: </span>
              <span
                className="font-semibold"
                style={{
                  color: vanzare.incasata ? 'var(--status-success-text)' : 'var(--status-warning-text)',
                }}
              >
                {vanzare.incasata ? 'Da' : 'Nu'}
              </span>
            </span>
          </div>

          {/* LINK COMANDA */}
          {vanzare.comanda_id ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenComanda()
                }}
                className="min-h-9 rounded-lg border border-[var(--soft-info-border)] bg-[var(--soft-info-bg)] px-3 text-[11px] font-semibold text-[var(--soft-info-text)]"
              >
                Vezi comanda
              </button>
            </div>
          ) : null}

          {/* CONTACT BUTTONS */}
          {vanzare.telefon ? (
            <div className="mt-3 flex gap-2">
              <a
                href={`tel:${vanzare.telefon}`}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-h-11 rounded-xl border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-3 text-center text-sm font-semibold leading-[44px] text-[var(--button-muted-text)]"
              >
                Sună
              </a>
              <a
                href={`https://wa.me/${vanzare.telefon.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-h-11 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 text-center text-sm font-semibold leading-[44px] text-[var(--status-success-text)]"
              >
                WhatsApp
              </a>
            </div>
          ) : null}

          {/* TOGGLE INCASARE */}
          {!vanzare.incasata ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMarkPaid()
              }}
              className="mt-3 min-h-11 w-full rounded-xl bg-[var(--brand-blue)] px-3 text-sm font-bold text-white"
            >
              Marchează ca încasat
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMarkUnpaid()
              }}
              className="mt-3 min-h-11 w-full rounded-xl border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-3 text-sm font-semibold text-[var(--agri-text-muted)]"
            >
              Marchează ca neîncasat
            </button>
          )}

          {/* EDIT / DELETE */}
          <div className="mt-3 flex justify-center gap-2 border-t border-[var(--surface-divider)] pt-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="min-h-9 rounded-lg border border-[var(--button-muted-border)] bg-[var(--button-muted-bg)] px-3 text-[11px] font-semibold text-[var(--button-muted-text)]"
            >
              ✏️ Editează
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="min-h-9 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 text-[11px] font-semibold text-[var(--status-danger-text)]"
            >
              🗑️ Șterge
            </button>
          </div>
        </>
      ) : undefined}
    />
  )
}

export function VanzariPageClient({ initialVanzari = [], clienti: initialClienți = [] }: VanzariPageClientProps) {
  useTrackModuleView('vanzari')
  const router = useRouter()
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: Vanzare; index: number }>>({})
  const deleteMutateRef = useRef<(id: string) => void>(() => {})

  const [searchTerm, setSearchTerm] = useState('')
  const [temporalFilter, setTemporalFilter] = useState<TemporalFilter>('luna')
  const [addOpen, setAddOpen] = useState(false)
  const [editingVanzare, setEditingVanzare] = useState<Vanzare | null>(null)
  const [deletingVanzare, setDeletingVanzare] = useState<Vanzare | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const {
    data: vanzari = initialVanzari,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.vanzari,
    queryFn: getVanzari,
    initialData: initialVanzari,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: comenzi = [] } = useQuery({
    queryKey: queryKeys.comenzi,
    queryFn: getComenzi,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: clienti = initialClienți } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: async () => {
      const rows = await getClienți()
      return rows.map((client) => ({
        id: client.id,
        nume: client.nume_client,
        telefon: client.telefon,
      }))
    },
    initialData: initialClienți,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const restorePendingDeleteItem = (vanzareId: string) => {
    const pendingItem = pendingDeletedItems.current[vanzareId]
    if (!pendingItem) return

    delete pendingDeletedItems.current[vanzareId]
    queryClient.setQueryData<Vanzare[]>(queryKeys.vanzari, (current = []) => {
      if (current.some((item) => item.id === vanzareId)) return current

      const next = [...current]
      const insertAt = pendingItem.index >= 0 ? Math.min(pendingItem.index, next.length) : next.length
      next.splice(insertAt, 0, pendingItem.item)
      return next
    })
  }

  const deleteMutation = useMutation({
    mutationFn: deleteVanzare,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzari, exact: true })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal, exact: true })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard, exact: true })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocuriLocatiiRoot })
      queryClient.invalidateQueries({ queryKey: queryKeys.miscariStoc })
      delete pendingDeletedItems.current[deletedId]
      trackEvent('delete_item', 'vanzari')
      track('vanzare_delete', { id: deletedId })
      toast.success('Vânzare ștearsă')
      setDeletingVanzare(null)
    },
    onError: (err: Error, deletedId) => {
      restorePendingDeleteItem(deletedId)
      toast.error(err.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzari, exact: true })
    },
  })

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => updateVanzare(id, { status_plata: 'platit' }),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzari, exact: true })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard, exact: true })
      toast.success('✓ Marcat ca încasat')
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const markUnpaidMutation = useMutation({
    mutationFn: (id: string) => updateVanzare(id, { status_plata: 'restanta' }),
    onSuccess: (result) => {
      if (!result.success) {
        toast.error(result.error)
        return
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzari, exact: true })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard, exact: true })
      toast.success('Marcat ca neîncasat')
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
    const unregister = registerAddAction(() => setAddOpen(true), '💰 Vânzare directă')
    return unregister
  }, [registerAddAction])

  useEffect(() => {
    const query = searchTerm.trim()
    if (!query) return

    const timer = setTimeout(() => {
      track('search', { module: 'vanzari', query })
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const scheduleDelete = (vanzare: Vanzare) => {
    const vanzareId = vanzare.id
    const currentItems = queryClient.getQueryData<Vanzare[]>(queryKeys.vanzari) ?? []
    const deleteIndex = currentItems.findIndex((item) => item.id === vanzareId)

    pendingDeletedItems.current[vanzareId] = { item: vanzare, index: deleteIndex }
    queryClient.setQueryData<Vanzare[]>(queryKeys.vanzari, (current = []) => current.filter((item) => item.id !== vanzareId))

    const timer = setTimeout(() => {
      delete pendingDeleteTimers.current[vanzareId]
      deleteMutation.mutate(vanzareId)
    }, 5000)

    pendingDeleteTimers.current[vanzareId] = timer

    toast('Element șters', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const pendingTimer = pendingDeleteTimers.current[vanzareId]
          if (!pendingTimer) return
          clearTimeout(pendingTimer)
          delete pendingDeleteTimers.current[vanzareId]
          const pendingItem = pendingDeletedItems.current[vanzareId]
          delete pendingDeletedItems.current[vanzareId]
          if (!pendingItem) return

          queryClient.setQueryData<Vanzare[]>(queryKeys.vanzari, (current = []) => {
            if (current.some((item) => item.id === vanzareId)) return current
            const next = [...current]
            const insertAt = pendingItem.index >= 0 ? Math.min(pendingItem.index, next.length) : next.length
            next.splice(insertAt, 0, pendingItem.item)
            return next
          })
        },
      },
    })
  }

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {}
    clienti.forEach((c) => { map[c.id] = c.nume })
    return map
  }, [clienti])

  const clientPhoneMap = useMemo(() => {
    const map: Record<string, string | null> = {}
    clienti.forEach((c) => { map[c.id] = c.telefon })
    return map
  }, [clienti])

  const comandaMap = useMemo(() => {
    const map = new Map<string, (typeof comenzi)[number]>()
    for (const row of comenzi) {
      map.set(row.id, row)
    }
    return map
  }, [comenzi])

  const allVanzari = useMemo<EnrichedVanzare[]>(() => {
    return vanzari.map((row) => {
      const fromComanda = row.comanda_id ? comandaMap.get(row.comanda_id) : null
      const fallbackClient = fromComanda?.client_nume || fromComanda?.client_nume_manual || 'Client necunoscut'
      const clientNume = row.client_id ? clientMap[row.client_id] || fallbackClient : fallbackClient
      const telefon = row.client_id ? clientPhoneMap[row.client_id] || fromComanda?.telefon || null : fromComanda?.telefon || null

      return {
        ...row,
        clientNume,
        telefon,
        totalRon: Number(row.cantitate_kg || 0) * Number(row.pret_lei_kg || 0),
        incasata: isIncasata(row.status_plata),
      }
    })
  }, [vanzari, clientMap, clientPhoneMap, comandaMap])

  const temporalVanzari = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = toIsoDate(today)
    const weekStartIso = toIsoDate(getStartOfWeek(today))
    const monthStartIso = toIsoDate(getStartOfMonth(today))

    if (temporalFilter === 'toate') return allVanzari

    return allVanzari.filter((row) => {
      const rowDate = toDateOnly(row.data)
      if (temporalFilter === 'sapt') return rowDate >= weekStartIso && rowDate <= todayIso
      return rowDate >= monthStartIso && rowDate <= todayIso
    })
  }, [allVanzari, temporalFilter])

  const filteredVanzari = useMemo(() => {
    const term = normalizeText(searchTerm)
    if (!term) return temporalVanzari
    return temporalVanzari.filter((row) =>
      normalizeText(row.clientNume).includes(term) ||
      normalizeText(row.status_plata).includes(term) ||
      normalizeText(row.observatii_ladite).includes(term)
    )
  }, [temporalVanzari, searchTerm])

  const scoreboard = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayIso = toIsoDate(today)
    const monthStartIso = toIsoDate(getStartOfMonth(today))

    const lunaVanzari = allVanzari.filter((row) => {
      const rowDate = toDateOnly(row.data)
      return rowDate >= monthStartIso && rowDate <= todayIso
    })

    const vanzariLunaRon = lunaVanzari.reduce((sum, row) => sum + row.totalRon, 0)
    const vanzariLunaKg = lunaVanzari.reduce((sum, row) => sum + Number(row.cantitate_kg || 0), 0)
    const neincasatRon = allVanzari.reduce((sum, row) => sum + (!row.incasata ? row.totalRon : 0), 0)

    return { vanzariLunaRon, vanzariLunaKg, neincasatRon }
  }, [allVanzari])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.vanzari, exact: true })
  }

  const PILL_FILTERS: { key: TemporalFilter; label: string }[] = [
    { key: 'luna', label: 'Luna' },
    { key: 'sapt', label: 'Săpt.' },
    { key: 'toate', label: 'Toate' },
  ]
  const desktopColumns = useMemo<ColumnDef<EnrichedVanzare>[]>(() => [
    {
      accessorKey: 'data',
      header: 'Data',
      cell: ({ row }) => formatData(row.original.data),
      meta: {
        searchValue: (row: EnrichedVanzare) => row.data,
      },
    },
    {
      accessorKey: 'clientNume',
      header: 'Client',
      cell: ({ row }) => <span className="font-medium">{row.original.clientNume}</span>,
    },
    {
      id: 'produse',
      header: 'Produse',
      cell: () => '1',
      meta: {
        searchValue: () => '1',
        numeric: true,
      },
    },
    {
      accessorKey: 'cantitate_kg',
      header: 'Cantitate',
      cell: ({ row }) => `${Number(row.original.cantitate_kg || 0).toFixed(1)} kg`,
      meta: {
        searchValue: (row: EnrichedVanzare) => row.cantitate_kg,
        numeric: true,
      },
    },
    {
      accessorKey: 'totalRon',
      header: 'Valoare',
      cell: ({ row }) => `${formatRon(row.original.totalRon)} RON`,
      meta: {
        searchValue: (row: EnrichedVanzare) => row.totalRon,
        numeric: true,
      },
    },
    {
      id: 'actions',
      header: 'Acțiuni',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Editează vânzarea"
            onClick={(event) => {
              event.stopPropagation()
              setEditingVanzare(row.original)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Șterge vânzarea"
            onClick={(event) => {
              event.stopPropagation()
              setDeletingVanzare(row.original)
            }}
          >
            <Trash2 className="h-4 w-4 text-[var(--soft-danger-text)]" />
          </Button>
        </div>
      ),
      meta: {
        searchable: false,
        sticky: 'right',
        headerClassName: 'w-[104px] text-right',
        cellClassName: 'w-[104px] text-right',
      },
    },
  ], [])

  return (
    <AppShell
      header={<PageHeader title="Vânzări" subtitle="Registrul livrărilor finalizate" />}
      bottomBar={null}
    >
      <div className="mx-auto mt-2 w-full max-w-4xl py-3 sm:mt-0 sm:py-3 lg:max-w-4xl">

        {/* SCOREBOARD */}
        {scoreboard.vanzariLunaRon > 0 ? (
          <div style={{
            background: 'var(--agri-surface)', borderRadius: 12, padding: '10px 14px',
            border: '1px solid var(--agri-border)', marginBottom: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--value-positive)', letterSpacing: '-0.03em' }}>
                  {formatRon(scoreboard.vanzariLunaRon)}
                </span>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-hint)', marginLeft: 4 }}>RON luna</span>
              </span>
              {scoreboard.vanzariLunaKg > 0 ? (
                <span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--agri-text)' }}>
                    {scoreboard.vanzariLunaKg.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--agri-text-muted)', marginLeft: 2 }}>kg</span>
                </span>
              ) : null}
            </div>
            {scoreboard.neincasatRon > 0 ? (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--agri-text-muted)' }}>neîncasat</div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--status-warning-text)' }}>
                    {formatRon(scoreboard.neincasatRon)}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-hint)', marginLeft: 2 }}>RON</span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* PILLS */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {PILL_FILTERS.map(({ key, label }) => {
            const active = temporalFilter === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTemporalFilter(key)}
                style={{
                  padding: '6px 14px', fontSize: 11, fontWeight: 600,
                  borderRadius: 20, border: 'none', cursor: 'pointer',
                  background: active ? 'var(--pill-active-bg)' : 'var(--pill-inactive-bg)',
                  color: active ? 'var(--pill-active-text)' : 'var(--pill-inactive-text)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* SEARCH */}
        {allVanzari.length > 5 ? (
          <div style={{ marginBottom: 10 }}>
            <SearchField
              containerClassName="md:hidden"
              placeholder="Caută după client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Caută vânzări"
            />
          </div>
        ) : null}

        {isError ? <ErrorState title="Eroare la încărcare" message={(error as Error).message} onRetry={refresh} /> : null}
        {isLoading ? <TableCardsSkeleton /> : null}

        {/* EMPTY STATE */}
        {!isLoading && !isError && filteredVanzari.length === 0 ? (
          <div style={{
            background: 'var(--agri-surface)', borderRadius: 14, padding: '36px 20px',
            textAlign: 'center', border: '1px solid var(--agri-border)',
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>💰</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--agri-text)', marginBottom: 6 }}>Nicio vânzare încă</div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>
              Vânzările se creează automat când livrezi o comandă
            </div>
          </div>
        ) : null}

        {/* LIST */}
        {!isLoading && !isError && filteredVanzari.length > 0 ? (
          <ResponsiveDataView
            columns={desktopColumns}
            data={filteredVanzari}
            getRowId={(row) => row.id}
            searchPlaceholder="Caută în vânzări..."
            emptyMessage="Nu am găsit vânzări pentru filtrele curente."
            renderCard={(vanzare) => (
              <VanzareCardNew
                vanzare={vanzare}
                isExpanded={expandedId === vanzare.id}
                onToggle={() => setExpandedId(expandedId === vanzare.id ? null : vanzare.id)}
                onMarkPaid={() => markPaidMutation.mutate(vanzare.id)}
                onMarkUnpaid={() => markUnpaidMutation.mutate(vanzare.id)}
                onEdit={() => setEditingVanzare(vanzare)}
                onDelete={() => scheduleDelete(vanzare)}
                onOpenComanda={() => router.push('/comenzi')}
              />
            )}
          />
        ) : null}

      </div>

      <AddVanzareDialog open={addOpen} onOpenChange={setAddOpen} hideTrigger />

      <EditVanzareDialog
        vanzare={editingVanzare}
        open={!!editingVanzare}
        onOpenChange={(open) => {
          if (!open) setEditingVanzare(null)
        }}
      />

      <ConfirmDeleteDialog
        open={!!deletingVanzare}
        onOpenChange={(open) => {
          if (!open) setDeletingVanzare(null)
        }}
        onConfirm={() => {
          if (deletingVanzare) deleteMutation.mutate(deletingVanzare.id)
        }}
        loading={deleteMutation.isPending}
        title="Șterge vânzarea?"
        description="Această acțiune va șterge vânzarea și va restaura stocul. Nu poate fi anulată."
      />
    </AppShell>
  )
}
