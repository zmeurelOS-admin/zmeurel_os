'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, Pencil, Trash2, UserCheck, UserRound, Users, Wallet } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { DesktopKpiStrip } from '@/components/app/DesktopKpiStrip'
import { AppDialog } from '@/components/app/AppDialog'
import { ModuleEmptyCard, ModuleScoreboard } from '@/components/app/module-list-chrome'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { ErrorState } from '@/components/app/ErrorState'
import { EntityListSkeleton } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { AddCulegatorDialog } from '@/components/culegatori/AddCulegatorDialog'
import { EditCulegatorDialog } from '@/components/culegatori/EditCulegatorDialog'
import { Button } from '@/components/ui/button'
import { DesktopInspectorPanel, DesktopInspectorSection, DesktopSplitPane } from '@/components/ui/desktop'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import { ResponsiveDataView } from '@/components/ui/ResponsiveDataView'
import { SearchField } from '@/components/ui/SearchField'
import StatusBadge from '@/components/ui/StatusBadge'
import { useAddAction } from '@/contexts/AddActionContext'
import { useMediaQuery } from '@/hooks/useMediaQuery'
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
  onOpenDetails,
}: {
  culegator: Culegator
  stats: WorkerStats | undefined
  onOpenDetails: () => void
}) {
  const seasonKg = stats?.seasonKg ?? 0
  const seasonCount = stats?.seasonCount ?? 0
  const todayKg = stats?.todayKg ?? 0
  const lastSignal = stats?.lastRecoltare
    ? `Ultima: ${stats.lastRecoltare.date} · ${stats.lastRecoltare.parcela}`
    : undefined
  const mainValue = `${seasonKg.toFixed(0)} kg sezon`
  const subtitle = culegator.telefon || 'Fără telefon'
  const secondaryValue = [
    seasonCount > 0 ? `${seasonCount} recoltări` : null,
    todayKg > 0 ? `${todayKg.toFixed(0)} kg azi` : null,
  ].filter(Boolean).join(' • ') || undefined
  const statusLabel = todayKg > 0 ? 'Activ azi' : seasonCount > 0 ? 'Activ sezon' : 'Fără activitate'
  const statusTone = todayKg > 0 ? 'success' : seasonCount > 0 ? 'warning' : 'neutral'

  return (
    <MobileEntityCard
      title={culegator.nume_prenume}
      mainValue={mainValue}
      subtitle={subtitle}
      secondaryValue={secondaryValue}
      meta={lastSignal}
      statusLabel={statusLabel}
      statusTone={statusTone}
      showChevron
      onClick={onOpenDetails}
    />
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

export function CulegatorPageClient({ initialCulegatori }: Props) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: Culegator; index: number }>>({})
  const deleteMutateRef = useRef<(id: string) => void>(() => {})

  const [searchTerm, setSearchTerm] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [detailsCulegator, setDetailsCulegator] = useState<Culegator | null>(null)
  const [desktopSelectedCulegatorId, setDesktopSelectedCulegatorId] = useState<string | null>(null)
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

  const filteredCulegatori = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return culegatori
    return culegatori.filter((c) =>
      c.nume_prenume.toLowerCase().includes(term) ||
      (c.telefon ?? '').toLowerCase().includes(term)
    )
  }, [culegatori, searchTerm])

  const kpiActiviAziFiltered = useMemo(
    () =>
      filteredCulegatori.filter((c) => (workerStats.get(c.id)?.todayCount ?? 0) > 0).length,
    [filteredCulegatori, workerStats],
  )

  const kpiPlatiSezonFiltered = useMemo(() => {
    let sum = 0
    filteredCulegatori.forEach((c) => {
      const s = workerStats.get(c.id)
      if (!s) return
      sum += s.seasonKg * Number(c.tarif_lei_kg ?? 0)
    })
    return sum
  }, [filteredCulegatori, workerStats])

  const kpiParceleAlocateFiltered = useMemo(() => {
    const ids = new Set(filteredCulegatori.map((c) => c.id))
    const parc = new Set<string>()
    recoltari.forEach((r) => {
      if (r.culegator_id && ids.has(r.culegator_id) && r.parcela_id) parc.add(r.parcela_id)
    })
    return parc.size
  }, [filteredCulegatori, recoltari])

  const culegatoriDesktopKpiItems = useMemo(() => {
    if (culegatori.length === 0) return []
    return [
      {
        icon: Users,
        label: 'Total culegători',
        value: String(filteredCulegatori.length),
      },
      {
        icon: UserCheck,
        label: 'Activi azi',
        value: String(kpiActiviAziFiltered),
      },
      {
        icon: Wallet,
        label: 'Plăți sezon',
        value: `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(kpiPlatiSezonFiltered)} lei`,
      },
      {
        icon: MapPin,
        label: 'Parcele alocate',
        value: String(kpiParceleAlocateFiltered),
      },
    ]
  }, [
    culegatori.length,
    filteredCulegatori.length,
    kpiActiviAziFiltered,
    kpiPlatiSezonFiltered,
    kpiParceleAlocateFiltered,
  ])

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

  const desktopSelectedRow =
    desktopRows.find((row) => row.id === desktopSelectedCulegatorId) ?? desktopRows[0] ?? null
  const desktopSelectedCulegator = desktopSelectedRow?.raw ?? null

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
      header={
        <PageHeader
          title="Culegători"
          subtitle="Evidența echipei de lucru"
          rightSlot={<UserRound className="h-5 w-5 shrink-0 text-[var(--agri-text-muted)]" aria-hidden />}
        />
      }
    >
      <div className="mt-2 w-full space-y-3 px-4 py-3 sm:mt-0 sm:py-3 lg:px-6 xl:px-8">
        <ModuleScoreboard
          tone="surface"
          className="gap-x-3.5 gap-y-1 border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)] md:hidden"
        >
          <span className="text-[15px] font-bold text-[var(--text-primary)]">{culegatori.length} culegători</span>
          {activeTodayCount > 0 ? (
            <>
              <span className="text-[var(--text-tertiary)]">·</span>
              <span className="text-[13px] text-[var(--text-secondary)]">{activeTodayCount} activi azi</span>
            </>
          ) : null}
        </ModuleScoreboard>

        <DesktopKpiStrip items={culegatoriDesktopKpiItems} />

        <SearchField
          containerClassName="md:hidden"
          placeholder="Caută culegător..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Caută culegători"
        />

        <div className="hidden flex-col gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)] md:flex">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {filteredCulegatori.length}{' '}
              {filteredCulegatori.length === 1 ? 'culegător' : 'culegători'}
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">{filteredCulegatori.length}</span>
              <span className="ml-1">
                {filteredCulegatori.length === 1 ? 'culegător în listă' : 'culegători în listă'}
              </span>
            </span>
          </div>
          <SearchField
            containerClassName="w-full max-w-2xl"
            placeholder="Caută culegător..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Caută culegători (desktop)"
          />
        </div>

        {/* Error */}
        {isError ? <ErrorState title="Eroare" message={(error as Error).message} /> : null}

        {/* Loading */}
        {isLoading ? <EntityListSkeleton count={4} /> : null}

        {/* Empty state */}
        {!isLoading && !isError && filteredCulegatori.length === 0 ? (
          <ModuleEmptyCard
            emoji="👤"
            title={culegatori.length === 0 ? 'Niciun culegător adăugat' : 'Niciun rezultat'}
            hint={
              culegatori.length === 0
                ? 'Adaugă primul culegător pentru a începe'
                : 'Încearcă alt termen de căutare'
            }
            action={
              culegatori.length === 0 ? (
                <Button type="button" className="agri-cta" onClick={() => setShowAdd(true)}>
                  Adaugă culegător
                </Button>
              ) : undefined
            }
          />
        ) : null}

        {/* Cards */}
        {!isLoading && !isError && filteredCulegatori.length > 0 ? (
          <DesktopSplitPane
            master={
              <ResponsiveDataView
                columns={desktopColumns}
                data={desktopRows}
                mobileData={filteredCulegatori}
                mobileContainerClassName="grid-cols-1"
                getRowId={(row) => row.id}
                getMobileRowId={(row) => row.id}
                searchPlaceholder="Caută în manoperă..."
                emptyMessage="Nu am găsit culegători pentru filtrele curente."
                desktopContainerClassName="md:min-w-0"
                skipDesktopDataFilter
                hideDesktopSearchRow
                desktopRowSelectionTone="accent"
                onDesktopRowClick={(row) => setDesktopSelectedCulegatorId(row.id)}
                isDesktopRowSelected={(row) => desktopSelectedRow?.id === row.id}
                renderCard={(culegator) => (
                  <CulegatorCardNew
                    culegator={culegator}
                    stats={workerStats.get(culegator.id)}
                    onOpenDetails={() => setDetailsCulegator(culegator)}
                  />
                )}
              />
            }
            detail={
              <DesktopInspectorPanel
                title="Detalii culegător"
                description={
                  desktopSelectedCulegator
                    ? `${desktopSelectedCulegator.id_culegator || desktopSelectedCulegator.id.slice(0, 8)}`
                    : undefined
                }
                footer={
                  desktopSelectedCulegator ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="agri-cta"
                        onClick={() => setEditCulegator(desktopSelectedCulegator)}
                      >
                        Editează
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="agri-cta"
                        onClick={() => setDeleting(desktopSelectedCulegator)}
                      >
                        Șterge
                      </Button>
                    </div>
                  ) : null
                }
              >
                {desktopSelectedCulegator ? (
                  (() => {
                    const c = desktopSelectedCulegator
                    const stats = workerStats.get(c.id)
                    const todayKg = stats?.todayKg ?? 0
                    const seasonCount = stats?.seasonCount ?? 0
                    const statusLabel =
                      todayKg > 0 ? 'Activ azi' : seasonCount > 0 ? 'Activ sezon' : 'Fără activitate'
                    const statusVariant =
                      todayKg > 0 ? 'success' : seasonCount > 0 ? 'warning' : 'neutral'

                    return (
                      <>
                        <DesktopInspectorSection label="Sumar">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge text={statusLabel} variant={statusVariant} />
                            <span className="text-xs text-[var(--text-tertiary)]">
                              {c.status_activ ? 'În evidență (activ)' : 'Marcat inactiv'}
                            </span>
                          </div>
                        </DesktopInspectorSection>
                        <DesktopInspectorSection label="Contact / identificare">
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Nume: </span>
                            {c.nume_prenume}
                          </p>
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Telefon: </span>
                            {c.telefon || '—'}
                          </p>
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Tip angajare: </span>
                            {c.tip_angajare || '—'}
                          </p>
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Data angajării: </span>
                            {c.data_angajare
                              ? new Date(c.data_angajare.slice(0, 10)).toLocaleDateString('ro-RO')
                              : '—'}
                          </p>
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Tarif: </span>
                            {Number(c.tarif_lei_kg ?? 0) > 0
                              ? `${Number(c.tarif_lei_kg ?? 0)} RON/kg`
                              : '—'}
                          </p>
                        </DesktopInspectorSection>
                        <DesktopInspectorSection label="Activitate / recoltări">
                          {!stats ? (
                            <p className="text-[var(--text-tertiary)]">Nu există activitate înregistrată.</p>
                          ) : (
                            <>
                              <p>
                                <span className="font-medium text-[var(--text-primary)]">Sezon: </span>
                                {formatKg(stats.seasonKg)} kg · {stats.seasonCount} recoltări
                                {stats.seasonDays > 0 ? ` · ${stats.seasonDays} zile cu activitate` : null}
                              </p>
                              <p>
                                <span className="font-medium text-[var(--text-primary)]">Azi: </span>
                                {formatKg(stats.todayKg)} kg · {stats.todayCount} recoltări
                              </p>
                              <p>
                                <span className="font-medium text-[var(--text-primary)]">Total (istoric): </span>
                                {formatKg(stats.totalKg)} kg · {stats.totalCount} recoltări
                              </p>
                              <p>
                                <span className="font-medium text-[var(--text-primary)]">Ultima recoltare: </span>
                                {stats.lastRecoltare
                                  ? `${stats.lastRecoltare.date} · ${stats.lastRecoltare.parcela} · ${formatKg(stats.lastRecoltare.kg)} kg`
                                  : '—'}
                              </p>
                            </>
                          )}
                        </DesktopInspectorSection>
                        {c.observatii?.trim() ? (
                          <DesktopInspectorSection label="Observații">
                            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                              {c.observatii}
                            </p>
                          </DesktopInspectorSection>
                        ) : null}
                      </>
                    )
                  })()
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">
                    Selectează un culegător din tabel pentru a vedea detaliile.
                  </p>
                )}
              </DesktopInspectorPanel>
            }
          />
        ) : null}
      </div>

      <AppDialog
        open={Boolean(detailsCulegator) && !isDesktop}
        onOpenChange={(open) => {
          if (!open) setDetailsCulegator(null)
        }}
        title={detailsCulegator?.nume_prenume || 'Detalii culegător'}
        description="Detalii activitate și date de contact"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetailsCulegator(null)}
            >
              Închide
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!detailsCulegator) return
                setDetailsCulegator(null)
                setDeleting(detailsCulegator)
              }}
            >
              Șterge
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!detailsCulegator) return
                setDetailsCulegator(null)
                setEditCulegator(detailsCulegator)
              }}
            >
              Editează
            </Button>
          </div>
        }
      >
        {detailsCulegator ? (
          <div className="space-y-2 text-sm">
            <p className="text-[var(--agri-text-muted)]">
              Telefon: <span className="font-semibold text-[var(--agri-text)]">{detailsCulegator.telefon || '—'}</span>
            </p>
            <p className="text-[var(--agri-text-muted)]">
              Tarif: <span className="font-semibold text-[var(--agri-text)]">{Number(detailsCulegator.tarif_lei_kg ?? 0)} RON/kg</span>
            </p>
            <p className="text-[var(--agri-text-muted)]">
              Status: <span className="font-semibold text-[var(--agri-text)]">{detailsCulegator.status_activ ? 'Activ' : 'Inactiv'}</span>
            </p>
            {(() => {
              const stats = workerStats.get(detailsCulegator.id)
              if (!stats) {
                return (
                  <p className="text-[var(--agri-text-muted)]">Nu există activitate înregistrată.</p>
                )
              }
              return (
                <>
                  <p className="text-[var(--agri-text-muted)]">
                    Sezon: <span className="font-semibold text-[var(--agri-text)]">{formatKg(stats.seasonKg)} kg · {stats.seasonCount} recoltări</span>
                  </p>
                  <p className="text-[var(--agri-text-muted)]">
                    Azi: <span className="font-semibold text-[var(--agri-text)]">{formatKg(stats.todayKg)} kg · {stats.todayCount} recoltări</span>
                  </p>
                  <p className="text-[var(--agri-text-muted)]">
                    Ultima recoltare:{' '}
                    <span className="font-semibold text-[var(--agri-text)]">
                      {stats.lastRecoltare
                        ? `${stats.lastRecoltare.date} · ${stats.lastRecoltare.parcela} · ${formatKg(stats.lastRecoltare.kg)} kg`
                        : '—'}
                    </span>
                  </p>
                </>
              )
            })()}
          </div>
        ) : null}
      </AppDialog>

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
          activitySummary={workerStats.get(editCulegator.id) ?? null}
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
