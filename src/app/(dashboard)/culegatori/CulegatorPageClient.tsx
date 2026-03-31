'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, UserRound } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { ModuleEmptyCard, ModuleScoreboard } from '@/components/app/module-list-chrome'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { ErrorState } from '@/components/app/ErrorState'
import { EntityListSkeleton } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { AddCulegatorDialog } from '@/components/culegatori/AddCulegatorDialog'
import { EditCulegatorDialog } from '@/components/culegatori/EditCulegatorDialog'
import { Button } from '@/components/ui/button'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
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
  onEdit,
}: {
  culegator: Culegator
  stats: WorkerStats | undefined
  onEdit: () => void
}) {
  const seasonKg = stats?.seasonKg ?? 0
  const seasonCount = stats?.seasonCount ?? 0
  const mainValue = `${seasonKg.toFixed(0)} kg`
  const secondary = seasonCount > 0 ? `${seasonCount} recoltări${culegator.telefon ? ` · ${culegator.telefon}` : ''}` : culegator.telefon || undefined

  return (
    <MobileEntityCard
      title={culegator.nume_prenume}
      mainValue={mainValue}
      subtitle={secondary}
      onClick={onEdit}
    />
  )
}

// ─── Page component ───────────────────────────────────────────────────────────

export function CulegatorPageClient({ initialCulegatori }: Props) {
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: Culegator; index: number }>>({})
  const deleteMutateRef = useRef<(id: string) => void>(() => {})

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
      <div className="mx-auto mt-2 w-full max-w-4xl space-y-3 py-3 sm:mt-0 sm:py-3">

        {/* Scoreboard compact */}
        <ModuleScoreboard tone="tinted" className="gap-x-3.5 gap-y-1">
          <span className="text-[15px] font-bold text-[var(--pill-active-text)]">{culegatori.length} culegători</span>
          {activeTodayCount > 0 ? (
            <>
              <span className="text-[var(--pill-active-text)]/25">·</span>
              <span className="text-[13px] text-[color-mix(in_srgb,var(--pill-active-text)_72%,transparent)]">
                {activeTodayCount} activi azi
              </span>
            </>
          ) : null}
        </ModuleScoreboard>

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
        {isLoading ? <EntityListSkeleton count={4} /> : null}

        {/* Empty state */}
        {!isLoading && !isError && filteredCulegatori.length === 0 ? (
          <ModuleEmptyCard
            emoji="👤"
            title="Niciun culegător adăugat"
            hint="Adaugă primul culegător pentru a începe"
          />
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
                onEdit={() => setEditCulegator(culegator)}
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
