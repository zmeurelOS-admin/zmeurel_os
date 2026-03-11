'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Users } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState } from '@/components/app/LoadingState'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import { AddCulegatorDialog } from '@/components/culegatori/AddCulegatorDialog'
import { CulegatorCard } from '@/components/culegatori/CulegatorCard'
import { EditCulegatorDialog } from '@/components/culegatori/EditCulegatorDialog'
import MiniCard from '@/components/ui/MiniCard'
import { SearchField } from '@/components/ui/SearchField'
import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
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
import { useAddAction } from '@/contexts/AddActionContext'
import { queryKeys } from '@/lib/query-keys'

interface Props {
  initialCulegatori: Culegator[]
}

type RankingScope = 'today' | 'season'

type WorkerStats = {
  todayKg: number
  todayCount: number
  seasonKg: number
  seasonCount: number
  totalKg: number
  totalCount: number
  lastRecoltare: {
    date: string
    parcela: string
    kg: number
    timestamp: number
  } | null
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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON', maximumFractionDigits: 0 }).format(value)
}

function getRecoltareKg(recoltare: Recoltare): number {
  return Number(recoltare.kg_cal1 ?? 0) + Number(recoltare.kg_cal2 ?? 0)
}

function getMedal(index: number): string {
  if (index === 0) return '\u{1F947}'
  if (index === 1) return '\u{1F948}'
  if (index === 2) return '\u{1F949}'
  return `${index + 1}`
}

export function CulegatorPageClient({ initialCulegatori }: Props) {
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: Culegator; index: number }>>({})
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [searchTerm, setSearchTerm] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editCulegator, setEditCulegator] = useState<Culegator | null>(null)
  const [deleting, setDeleting] = useState<Culegator | null>(null)
  const [rankingScope, setRankingScope] = useState<RankingScope>('today')
  const [selectedCulegatorId, setSelectedCulegatorId] = useState<string | null>(null)

  const {
    data: culegatori = initialCulegatori,
    isLoading: culegatoriLoading,
    isError: culegatoriError,
    error: culegatoriErrorValue,
  } = useQuery({
    queryKey: queryKeys.culegatori,
    queryFn: getCulegatori,
    initialData: initialCulegatori,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: recoltari = [], isLoading: recoltariLoading } = useQuery({
    queryKey: queryKeys.recoltari,
    queryFn: getRecoltari,
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
      toast.success('Culegator adaugat')
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
      toast.success('Culegator actualizat')
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
      toast.success('Culegator sters')
      setDeleting(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
    },
  })

  useEffect(() => {
    return () => {
      Object.values(pendingDeleteTimers.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    const unregister = registerAddAction(() => setShowAdd(true), 'Adauga culegator')
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

    toast('Element sters', {
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

  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])
  const todayIso = toIsoDate(today)
  const seasonStart = useMemo(() => {
    const start = new Date(today.getFullYear(), 2, 1)
    if (today < start) {
      start.setFullYear(today.getFullYear() - 1)
    }
    return start
  }, [today])
  const seasonStartIso = toIsoDate(seasonStart)

  const parcelaMap = useMemo(() => {
    const map: Record<string, string> = {}
    parcele.forEach((parcela) => {
      map[parcela.id] = parcela.nume_parcela || 'Parcela'
    })
    return map
  }, [parcele])

  const workerStats = useMemo(() => {
    const map = new Map<string, WorkerStats>()

    recoltari.forEach((recoltare) => {
      if (!recoltare.culegator_id) return
      const workerId = recoltare.culegator_id
      const date = toDateOnly(recoltare.data)
      const kg = getRecoltareKg(recoltare)
      const stamp = new Date(recoltare.created_at || recoltare.data).getTime()
      const normalizedStamp = Number.isNaN(stamp) ? new Date(recoltare.data).getTime() : stamp

      const current = map.get(workerId) ?? {
        todayKg: 0,
        todayCount: 0,
        seasonKg: 0,
        seasonCount: 0,
        totalKg: 0,
        totalCount: 0,
        lastRecoltare: null,
      }

      if (date === todayIso) {
        current.todayKg += kg
        current.todayCount += 1
      }
      if (date >= seasonStartIso && date <= todayIso) {
        current.seasonKg += kg
        current.seasonCount += 1
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

    return map
  }, [recoltari, todayIso, seasonStartIso, parcelaMap])

  const rankingItems = useMemo(() => {
    return culegatori
      .map((culegator) => {
        const stats = workerStats.get(culegator.id)
        const kg = rankingScope === 'today' ? stats?.todayKg ?? 0 : stats?.seasonKg ?? 0
        const count = rankingScope === 'today' ? stats?.todayCount ?? 0 : stats?.seasonCount ?? 0
        return {
          id: culegator.id,
          name: culegator.nume_prenume,
          kg,
          count,
        }
      })
      .filter((row) => row.kg > 0)
      .sort((a, b) => b.kg - a.kg)
  }, [culegatori, workerStats, rankingScope])

  const maxRankingKg = rankingItems[0]?.kg ?? 0

  const activeTodayCount = useMemo(() => {
    return Array.from(workerStats.values()).filter((stats) => stats.todayCount > 0).length
  }, [workerStats])

  const totalKgToday = useMemo(() => {
    return Array.from(workerStats.values()).reduce((sum, stats) => sum + stats.todayKg, 0)
  }, [workerStats])

  const manoperaAzi = useMemo(() => {
    const rowsToday = recoltari.filter((recoltare) => toDateOnly(recoltare.data) === todayIso)
    const hasCosts = rowsToday.some((recoltare) => Number(recoltare.valoare_munca_lei ?? 0) > 0)
    if (!hasCosts) return null
    return rowsToday.reduce((sum, recoltare) => sum + Number(recoltare.valoare_munca_lei ?? 0), 0)
  }, [recoltari, todayIso])

  const averageKgPerWorker = activeTodayCount > 0 ? totalKgToday / activeTodayCount : 0
  const belowAverageWorker = useMemo(() => {
    if (averageKgPerWorker <= 0) return null
    const threshold = averageKgPerWorker * 0.5
    return rankingItems.find((item) => item.kg > 0 && item.kg < threshold) ?? null
  }, [averageKgPerWorker, rankingItems])

  const filteredCulegatori = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return culegatori.filter((culegator) => {
      const searchMatch =
        !term ||
        culegator.nume_prenume.toLowerCase().includes(term) ||
        (culegator.telefon ?? '').toLowerCase().includes(term)

      if (!searchMatch) return false
      if (selectedCulegatorId && culegator.id !== selectedCulegatorId) return false
      return true
    })
  }, [culegatori, searchTerm, selectedCulegatorId])

  useEffect(() => {
    if (!selectedCulegatorId) return
    const target = cardRefs.current[selectedCulegatorId]
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedCulegatorId, filteredCulegatori.length])

  const isLoading = culegatoriLoading || recoltariLoading

  return (
    <AppShell
      header={<PageHeader title="Culegători" subtitle="Evidența echipei de lucru" rightSlot={<Users className="h-5 w-5" />} />}
      bottomBar={
        <StickyActionBar>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--agri-text-muted)]">Total culegători: {culegatori.length}</p>
          </div>
        </StickyActionBar>
      }
    >
      <div className="mx-auto mt-4 w-full max-w-4xl space-y-3 px-0 py-3 sm:mt-0 sm:px-3 sm:space-y-4 sm:py-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MiniCard icon={'\u{1F464}'} value={String(activeTodayCount)} sub="activi azi" label="Activi azi" />
          <MiniCard icon={'\u{1FAD0}'} value={formatKg(totalKgToday, 1)} sub="kg azi" label="Total recoltat azi" />
          <MiniCard icon={'\u{1F4B8}'} value={manoperaAzi === null ? '—' : formatCurrency(manoperaAzi)} sub="RON manopera" label="Cost manoperă azi" />
        </div>

        <div
          style={{
            borderRadius: radius.lg,
            border: `1px solid ${colors.grayLight}`,
            background: colors.white,
            boxShadow: shadows.card,
            padding: spacing.md,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.dark }}>Ranking azi</div>
            <button
              type="button"
              onClick={() => setRankingScope((prev) => (prev === 'today' ? 'season' : 'today'))}
              style={{
                border: 'none',
                background: 'transparent',
                color: colors.primary,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {rankingScope === 'today' ? 'Sezon →' : 'Azi →'}
            </button>
          </div>

          {rankingItems.length === 0 ? (
            <div style={{ fontSize: 12, color: colors.gray }}>Nicio recoltare înregistrat? azi.</div>
          ) : (
            <div style={{ display: 'grid', gap: spacing.xs }}>
              {rankingItems.map((worker, index) => {
                const progress = maxRankingKg > 0 ? (worker.kg / maxRankingKg) * 100 : 0
                const selected = selectedCulegatorId === worker.id
                return (
                  <button
                    key={worker.id}
                    type="button"
                    onClick={() => {
                      setSelectedCulegatorId((prev) => (prev === worker.id ? null : worker.id))
                    }}
                    style={{
                      borderRadius: radius.md,
                      border: `1px solid ${selected ? colors.primary : colors.grayLight}`,
                      background: selected ? colors.blueLight : colors.white,
                      textAlign: 'left',
                      cursor: 'pointer',
                      padding: spacing.sm,
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: spacing.sm, alignItems: 'center' }}>
                      <div style={{ minWidth: 24, fontSize: 14, fontWeight: 700, color: colors.dark }}>{getMedal(index)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: colors.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {worker.name}
                        </div>
                        <div style={{ marginTop: spacing.xs, height: 6, borderRadius: radius.full, background: colors.grayLight, overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: colors.green }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: colors.green }}>{formatKg(worker.kg, 1)} kg</div>
                        <div style={{ fontSize: 10, color: colors.gray }}>{worker.count} recoltări</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div
          style={{
            borderRadius: radius.lg,
            border: `1px solid ${colors.grayLight}`,
            background: colors.white,
            boxShadow: shadows.card,
            padding: spacing.md,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.dark }}>
            Medie: {formatKg(averageKgPerWorker, 1)} kg/culegator
          </div>
          {belowAverageWorker ? (
            <div style={{ marginTop: spacing.xs, fontSize: 12, color: colors.coral }}>
              {'\u26A0\uFE0F'} {belowAverageWorker.name} sub medie
            </div>
          ) : null}
        </div>

        <SearchField
          placeholder="Caută culegator..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Caută culegatori"
        />

        {selectedCulegatorId ? (
          <button
            type="button"
            onClick={() => setSelectedCulegatorId(null)}
            style={{
              border: 'none',
              background: colors.coralLight,
              color: colors.coral,
              borderRadius: radius.sm,
              padding: '6px 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {'\u2715'} Arata toti culegatorii
          </button>
        ) : null}

        {culegatoriError ? <ErrorState title="Eroare" message={(culegatoriErrorValue as Error).message} /> : null}
        {isLoading ? <LoadingState label="Se încarcă culegatorii..." /> : null}
        {!isLoading && !culegatoriError && filteredCulegatori.length === 0 ? (
          <EmptyState
            icon={<UserPlus className="h-16 w-16" />}
            title="Niciun culegator inca"
            description="Adaugă primul culegator pentru a incepe"
          />
        ) : null}

        {!isLoading && !culegatoriError && filteredCulegatori.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filteredCulegatori.map((culegator) => {
              const stats = workerStats.get(culegator.id)
              return (
                <div key={culegator.id} ref={(node) => { cardRefs.current[culegator.id] = node }}>
                  <CulegatorCard
                    culegator={culegator}
                    highlighted={selectedCulegatorId === culegator.id}
                    stats={{
                      totalKgSeason: stats?.seasonKg ?? 0,
                      totalRecoltari: stats?.totalCount ?? 0,
                      medieKgPerRecoltare: stats && stats.totalCount > 0 ? stats.totalKg / stats.totalCount : 0,
                      lastRecoltare: stats?.lastRecoltare
                        ? {
                            date: stats.lastRecoltare.date,
                            parcela: stats.lastRecoltare.parcela,
                            kg: stats.lastRecoltare.kg,
                          }
                        : null,
                    }}
                    onEdit={setEditCulegator}
                    onDelete={(id) => {
                      const target = culegatori.find((item) => item.id === id) ?? null
                      setDeleting(target)
                    }}
                  />
                </div>
              )
            })}
          </div>
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
          onOpenChange={(open) => {
            if (!open) setEditCulegator(null)
          }}
          culegator={editCulegator}
          onSubmit={async (id, formData) => {
            await updateMutation.mutateAsync({ id, formData: formData as unknown as Record<string, unknown> })
          }}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        itemType="Culegator"
        itemName={deleting?.nume_prenume || 'Culegator selectat'}
        description={`Stergi culegatorul ${deleting?.nume_prenume || 'selectat'}?`}
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
