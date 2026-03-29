'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { ErrorState } from '@/components/app/ErrorState'
import { ListSkeletonCard } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { AddCulegatorDialog } from '@/components/culegatori/AddCulegatorDialog'
import { EditCulegatorDialog } from '@/components/culegatori/EditCulegatorDialog'
import { Button } from '@/components/ui/button'
import { ResponsiveDataView } from '@/components/ui/ResponsiveDataView'
import { SearchField } from '@/components/ui/SearchField'
import { useAddAction } from '@/contexts/AddActionContext'
import { queryKeys } from '@/lib/query-keys'
import {
  createCulegator,
  deleteCulegator,
  getCulegatori,
  updateCulegator,
  type CreateCulegatorInput,
  type Culegator,
  type UpdateCulegatorInput,
} from '@/lib/supabase/queries/culegatori'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { getRecoltari, type Recoltare } from '@/lib/supabase/queries/recoltari'

interface Props {
  initialCulegatori: Culegator[]
}

type WorkerStats = {
  todayKg: number
  todayCount: number
  seasonKg: number
  seasonCount: number
  seasonDays: number
  totalKg: number
  totalCount: number
  lastRecoltare: { date: string; parcela: string; kg: number; timestamp: number } | null
}

type DesktopCulegatorRow = {
  id: string
  data: string | null
  dataSort: number
  lucrator: string
  activitate: string
  cantitateLabel: string
  cantitateKg: number
  cost: number
  raw: Culegator
}

function toDateOnly(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10)
}

function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function formatKg(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits }).format(value)
}

function getRecoltareKg(recoltare: Recoltare): number {
  return Number(recoltare.kg_cal1 ?? 0) + Number(recoltare.kg_cal2 ?? 0)
}

// ─── Inline card component ────────────────────────────────────────────────────

function CulegatorCardNew({
  culegator,
  stats,
  recentRecoltari,
  parcelaMap,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  culegator: Culegator
  stats: WorkerStats | undefined
  recentRecoltari: Recoltare[]
  parcelaMap: Record<string, string>
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const hasPhone = Boolean(culegator.telefon)
  const phoneClean = (culegator.telefon ?? '').replace(/\s+/g, '')
  const isActiv = culegator.status_activ !== false
  const seasonKg = stats?.seasonKg ?? 0
  const avgKgPerDay = stats && stats.seasonDays > 0 ? seasonKg / stats.seasonDays : 0

  return (
    <div
      style={{
        background: 'var(--agri-surface)',
        borderRadius: 14,
        border: '1px solid var(--agri-border)',
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10,
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1, marginTop: 1 }}>👤</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--agri-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {culegator.nume_prenume}
            </span>
            <span style={{ fontSize: 16, color: 'var(--agri-text-muted)', flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: 3 }}>
            <span style={{
              borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 600,
              background: isActiv ? 'var(--status-success-bg)' : 'var(--status-neutral-bg)',
              color: isActiv ? 'var(--status-success-text)' : 'var(--status-neutral-text)',
            }}>
              {isActiv ? '● Activ' : '○ Inactiv'}
            </span>
            {seasonKg > 0 && (
              <span style={{ fontSize: 12, color: 'var(--value-positive)', fontWeight: 600 }}>{formatKg(seasonKg)} kg sezon</span>
            )}
            {culegator.tarif_lei_kg ? (
              <span style={{ fontSize: 12, color: 'var(--agri-text-muted)' }}>{culegator.tarif_lei_kg} RON/kg</span>
            ) : null}
          </div>
        </div>
      </button>

      {/* Expanded section */}
      {expanded && (
        <div style={{ padding: '0 14px 14px' }}>
          {/* Contact actions */}
          {hasPhone && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <a
                href={`tel:${phoneClean}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                  background: 'var(--button-muted-bg)', color: 'var(--button-muted-text)', textDecoration: 'none',
                  border: '1px solid var(--button-muted-border)',
                }}
              >
                📞 Sună
              </a>
              <a
                href={`https://wa.me/${phoneClean.replace(/^\+?0/, '40')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                  background: 'var(--status-success-bg)', color: 'var(--status-success-text)', textDecoration: 'none',
                  border: '1px solid var(--status-success-border)',
                }}
              >
                💬 WhatsApp
              </a>
            </div>
          )}

          {/* Season stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div style={{ background: 'var(--agri-surface-muted)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--value-positive)' }}>{formatKg(seasonKg)}</div>
              <div style={{ fontSize: 10, color: 'var(--agri-text-muted)', marginTop: 2 }}>kg sezon</div>
            </div>
            <div style={{ background: 'var(--agri-surface-muted)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--agri-text)' }}>{formatKg(avgKgPerDay)}</div>
              <div style={{ fontSize: 10, color: 'var(--agri-text-muted)', marginTop: 2 }}>kg/zi medie</div>
            </div>
            <div style={{ background: 'var(--agri-surface-muted)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--agri-text)' }}>{stats?.seasonDays ?? 0}</div>
              <div style={{ fontSize: 10, color: 'var(--agri-text-muted)', marginTop: 2 }}>zile lucrate</div>
            </div>
          </div>

          {/* Last 5 recoltari */}
          {recentRecoltari.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--agri-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Ultimele recoltări
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {recentRecoltari.map((r) => {
                  const kg = getRecoltareKg(r)
                  const parcelaName = r.parcela_id ? (parcelaMap[r.parcela_id] ?? 'Parcela') : 'Parcela'
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'var(--agri-text)' }}>
                      <span>{toDateOnly(r.data)} · {parcelaName}</span>
                      <span style={{ fontWeight: 600, color: 'var(--value-positive)' }}>{formatKg(kg)} kg</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Edit / Delete */}
          <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--agri-border)', paddingTop: 12 }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              style={{
                flex: 1, padding: '8px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: 'var(--button-muted-bg)', border: '1px solid var(--button-muted-border)', color: 'var(--button-muted-text)', cursor: 'pointer',
              }}
            >
              ✏️ Editează
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              style={{
                flex: 1, padding: '8px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: 'var(--status-danger-bg)', border: '1px solid var(--status-danger-border)', color: 'var(--status-danger-text)', cursor: 'pointer',
              }}
            >
              🗑️ Șterge
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

export function CulegatorPageClient({ initialCulegatori }: Props) {
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: Culegator; index: number }>>({})
  const deleteMutateRef = useRef<(id: string) => void>(() => {})

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editCulegator, setEditCulegator] = useState<Culegator | null>(null)
  const [deleting, setDeleting] = useState<Culegator | null>(null)

  const {
    data: culegatori = initialCulegatori,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.culegatori,
    queryFn: getCulegatori,
    initialData: initialCulegatori,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: recoltari = [] } = useQuery({
    queryKey: queryKeys.recoltari,
    queryFn: getRecoltari,
    initialData: [],
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: parcele = [] } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const createMutation = useMutation({
    mutationFn: async (formData: Record<string, unknown>) => {
      const input: CreateCulegatorInput = {
        nume_prenume: String(formData.nume_prenume ?? ''),
        telefon: formData.telefon ? String(formData.telefon) : undefined,
        tip_angajare: String(formData.tip_angajare ?? 'Sezonier'),
        tarif_lei_kg: parseFloat(String(formData.tarif_lei_kg ?? 0)),
        data_angajare: formData.data_angajare ? String(formData.data_angajare) : undefined,
        status_activ: Boolean(formData.status_activ),
      }
      return createCulegator(input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.culegatori })
      toast.success('Culegător adăugat')
      setShowAdd(false)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: string; formData: Record<string, unknown> }) => {
      const input: UpdateCulegatorInput = {
        nume_prenume: String(formData.nume_prenume ?? ''),
        telefon: formData.telefon ? String(formData.telefon) : undefined,
        tip_angajare: String(formData.tip_angajare ?? 'Sezonier'),
        tarif_lei_kg: parseFloat(String(formData.tarif_lei_kg ?? 0)),
        data_angajare: formData.data_angajare ? String(formData.data_angajare) : undefined,
        status_activ: Boolean(formData.status_activ),
      }
      return updateCulegator(id, input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.culegatori })
      toast.success('Culegător actualizat')
      setEditCulegator(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCulegator,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.culegatori })
      toast.success('Culegător șters')
      setDeleting(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  useEffect(() => { deleteMutateRef.current = (id) => deleteMutation.mutate(id) })
  useEffect(() => {
    return () => {
      Object.keys(pendingDeleteTimers.current).forEach((id) => {
        clearTimeout(pendingDeleteTimers.current[id])
        if (pendingDeletedItems.current[id]) {
          delete pendingDeletedItems.current[id]
          deleteMutateRef.current(id)
        }
      })
      pendingDeleteTimers.current = {}
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const unregister = registerAddAction(() => setShowAdd(true), 'Adaugă culegător')
    return unregister
  }, [registerAddAction])

  const scheduleDelete = (culegator: Culegator) => {
    const culegatorId = culegator.id
    const currentItems = queryClient.getQueryData<Culegator[]>(queryKeys.culegatori) ?? []
    const deleteIndex = currentItems.findIndex((item) => item.id === culegatorId)

    pendingDeletedItems.current[culegatorId] = { item: culegator, index: deleteIndex }
    queryClient.setQueryData<Culegator[]>(queryKeys.culegatori, (current = []) =>
      current.filter((item) => item.id !== culegatorId)
    )

    const timer = setTimeout(() => {
      delete pendingDeleteTimers.current[culegatorId]
      delete pendingDeletedItems.current[culegatorId]
      deleteMutation.mutate(culegatorId)
    }, 5000)

    pendingDeleteTimers.current[culegatorId] = timer

    toast('Element șters', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const pendingTimer = pendingDeleteTimers.current[culegatorId]
          if (!pendingTimer) return
          clearTimeout(pendingTimer)
          delete pendingDeleteTimers.current[culegatorId]
          const pendingItem = pendingDeletedItems.current[culegatorId]
          delete pendingDeletedItems.current[culegatorId]
          if (!pendingItem) return
          queryClient.setQueryData<Culegator[]>(queryKeys.culegatori, (current = []) => {
            if (current.some((item) => item.id === culegatorId)) return current
            const next = [...current]
            const insertAt = pendingItem.index >= 0 ? Math.min(pendingItem.index, next.length) : next.length
            next.splice(insertAt, 0, pendingItem.item)
            return next
          })
        },
      },
    })
  }

  // ── Computed data ──────────────────────────────────────────────────────────

  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])
  const todayIso = toIsoDate(today)

  const seasonStart = useMemo(() => {
    const start = new Date(today.getFullYear(), 2, 1)
    if (today < start) start.setFullYear(today.getFullYear() - 1)
    return start
  }, [today])
  const seasonStartIso = toIsoDate(seasonStart)

  const parcelaMap = useMemo(() => {
    const map: Record<string, string> = {}
    parcele.forEach((p) => { map[p.id] = p.nume_parcela || 'Parcela' })
    return map
  }, [parcele])

  const workerStats = useMemo(() => {
    const map = new Map<string, WorkerStats>()
    const seasonDatesMap = new Map<string, Set<string>>()

    recoltari.forEach((recoltare) => {
      if (!recoltare.culegator_id) return
      const workerId = recoltare.culegator_id
      const date = toDateOnly(recoltare.data)
      const kg = getRecoltareKg(recoltare)
      const stamp = new Date(recoltare.created_at || recoltare.data).getTime()
      const normalizedStamp = Number.isNaN(stamp) ? new Date(recoltare.data).getTime() : stamp

      const current = map.get(workerId) ?? {
        todayKg: 0, todayCount: 0, seasonKg: 0, seasonCount: 0, seasonDays: 0,
        totalKg: 0, totalCount: 0, lastRecoltare: null,
      }

      if (date === todayIso) {
        current.todayKg += kg
        current.todayCount += 1
      }
      if (date >= seasonStartIso && date <= todayIso) {
        current.seasonKg += kg
        current.seasonCount += 1
        if (!seasonDatesMap.has(workerId)) seasonDatesMap.set(workerId, new Set())
        seasonDatesMap.get(workerId)!.add(date)
      }

      current.totalKg += kg
      current.totalCount += 1

      if (!current.lastRecoltare || normalizedStamp > current.lastRecoltare.timestamp) {
        current.lastRecoltare = {
          date: new Date(recoltare.data).toLocaleDateString('ro-RO'),
          parcela: recoltare.parcela_id ? parcelaMap[recoltare.parcela_id] || 'Parcela' : 'Parcela',
          kg,
          timestamp: normalizedStamp,
        }
      }

      map.set(workerId, current)
    })

    // Assign seasonDays from the sets
    for (const [workerId, dates] of seasonDatesMap) {
      const stats = map.get(workerId)
      if (stats) stats.seasonDays = dates.size
    }

    return map
  }, [recoltari, todayIso, seasonStartIso, parcelaMap])

  const activeTodayCount = useMemo(
    () => Array.from(workerStats.values()).filter((s) => s.todayCount > 0).length,
    [workerStats]
  )

  const recoltariByWorker = useMemo(() => {
    const map: Record<string, Recoltare[]> = {}
    for (const r of recoltari) {
      if (!r.culegator_id) continue
      if (!map[r.culegator_id]) map[r.culegator_id] = []
      map[r.culegator_id].push(r)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => b.data.localeCompare(a.data))
    }
    return map
  }, [recoltari])

  const filteredCulegatori = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return culegatori
    return culegatori.filter((c) =>
      c.nume_prenume.toLowerCase().includes(term) ||
      (c.telefon ?? '').toLowerCase().includes(term)
    )
  }, [culegatori, searchTerm])
  const desktopRows = useMemo<DesktopCulegatorRow[]>(() => {
    return filteredCulegatori.map((culegator) => {
      const stats = workerStats.get(culegator.id)
      const latest = stats?.lastRecoltare
      const cantitateKg = stats?.todayKg && stats.todayKg > 0 ? stats.todayKg : (stats?.seasonKg ?? 0)

      return {
        id: culegator.id,
        data: latest?.date ?? null,
        dataSort: latest?.timestamp ?? 0,
        lucrator: culegator.nume_prenume,
        activitate: latest ? `Recoltare • ${latest.parcela}` : 'Fără activitate recentă',
        cantitateLabel: stats?.todayKg && stats.todayKg > 0 ? `${formatKg(stats.todayKg)} kg azi` : `${formatKg(stats?.seasonKg ?? 0)} kg sezon`,
        cantitateKg,
        cost: Number(culegator.tarif_lei_kg ?? 0),
        raw: culegator,
      }
    })
  }, [filteredCulegatori, workerStats])
  const desktopColumns = useMemo<ColumnDef<DesktopCulegatorRow>[]>(() => [
    {
      id: 'data',
      header: 'Data',
      accessorFn: (row) => row.dataSort,
      cell: ({ row }) => row.original.data || '-',
      meta: {
        searchValue: (row: DesktopCulegatorRow) => row.data,
      },
    },
    {
      accessorKey: 'lucrator',
      header: 'Lucrător',
      cell: ({ row }) => <span className="font-medium">{row.original.lucrator}</span>,
    },
    {
      accessorKey: 'activitate',
      header: 'Activitate',
    },
    {
      accessorKey: 'cantitateLabel',
      header: 'Ore/Cantitate',
      cell: ({ row }) => row.original.cantitateLabel,
      meta: {
        searchValue: (row: DesktopCulegatorRow) => [row.cantitateLabel, row.cantitateKg].join(' '),
      },
    },
    {
      accessorKey: 'cost',
      header: 'Cost',
      cell: ({ row }) => (row.original.cost > 0 ? `${row.original.cost} RON/kg` : '-'),
      meta: {
        searchValue: (row: DesktopCulegatorRow) => row.cost,
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
            aria-label="Editează culegătorul"
            onClick={(event) => {
              event.stopPropagation()
              setEditCulegator(row.original.raw)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Șterge culegătorul"
            onClick={(event) => {
              event.stopPropagation()
              setDeleting(row.original.raw)
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell
      header={<PageHeader title="Culegători" subtitle="Evidența echipei de lucru" rightSlot={<span style={{ fontSize: 22 }}>👤</span>} />}
    >
      <div className="mx-auto mt-3 w-full max-w-4xl space-y-3 py-3 sm:mt-0">

        {/* Scoreboard compact */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center',
          padding: '10px 14px', background: 'var(--pill-active-bg)', borderRadius: 14,
        }}>
          <span style={{ color: 'var(--pill-active-text)', fontWeight: 700, fontSize: 15 }}>{culegatori.length} culegători</span>
          {activeTodayCount > 0 && (
            <>
              <span style={{ color: 'color-mix(in srgb, var(--pill-active-text) 25%, transparent)' }}>·</span>
              <span style={{ color: 'color-mix(in srgb, var(--pill-active-text) 72%, transparent)', fontSize: 13 }}>{activeTodayCount} activi azi</span>
            </>
          )}
        </div>

        {/* Search */}
        <SearchField
          containerClassName="md:hidden"
          placeholder="Caută culegător..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Caută culegători"
        />

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

        {/* Empty state */}
        {!isLoading && !isError && filteredCulegatori.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--agri-text)', marginBottom: 6 }}>Niciun culegător adăugat</p>
            <p style={{ fontSize: 13, color: 'var(--agri-text-muted)' }}>Adaugă primul culegător pentru a începe</p>
          </div>
        ) : null}

        {/* Cards */}
        {!isLoading && !isError && filteredCulegatori.length > 0 ? (
          <ResponsiveDataView
            columns={desktopColumns}
            data={desktopRows}
            mobileData={filteredCulegatori}
            getRowId={(row) => row.id}
            getMobileRowId={(row) => row.id}
            searchPlaceholder="Caută în manoperă..."
            emptyMessage="Nu am găsit culegători pentru filtrele curente."
            renderCard={(culegator) => (
              <CulegatorCardNew
                culegator={culegator}
                stats={workerStats.get(culegator.id)}
                recentRecoltari={(recoltariByWorker[culegator.id] ?? []).slice(0, 5)}
                parcelaMap={parcelaMap}
                expanded={expandedId === culegator.id}
                onToggle={() => setExpandedId(expandedId === culegator.id ? null : culegator.id)}
                onEdit={() => setEditCulegator(culegator)}
                onDelete={() => setDeleting(culegator)}
              />
            )}
          />
        ) : null}
      </div>

      <AddCulegatorDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        onSubmit={async (formData) => {
          await createMutation.mutateAsync(formData as unknown as Record<string, unknown>)
        }}
      />

      {editCulegator ? (
        <EditCulegatorDialog
          open={!!editCulegator}
          onOpenChange={(open) => { if (!open) setEditCulegator(null) }}
          culegator={editCulegator}
          onSubmit={async (id, formData) => {
            await updateMutation.mutateAsync({ id, formData: formData as unknown as Record<string, unknown> })
          }}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        itemType="Culegător"
        itemName={deleting?.nume_prenume || 'Culegător selectat'}
        description={`Ștergi culegătorul ${deleting?.nume_prenume || 'selectat'}?`}
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleting) return
          scheduleDelete(deleting)
          setDeleting(null)
        }}
      />
    </AppShell>
  )
}
