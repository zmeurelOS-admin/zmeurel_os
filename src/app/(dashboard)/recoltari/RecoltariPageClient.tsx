'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Leaf } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/app/ErrorState'
import { ListSkeletonCard, ListSkeletonRow } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import { useMobileScrollRestore } from '@/components/app/useMobileScrollRestore'
import { SectionTitle } from '@/components/dashboard/SectionTitle'
import { RecoltareCard } from '@/components/recoltari/RecoltareCard'
import MiniCard from '@/components/ui/MiniCard'
import { SearchField } from '@/components/ui/SearchField'
import Sparkline from '@/components/ui/Sparkline'
import TrendBadge from '@/components/ui/TrendBadge'
import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { formatUnitateDisplayName, getUnitateTipLabel } from '@/lib/parcele/unitate'
import { getCulegatori } from '@/lib/supabase/queries/culegatori'
import { getRecoltareDeleteImpact } from '@/lib/supabase/queries/miscari-stoc'
import { getParcele, type Parcela } from '@/lib/supabase/queries/parcele'
import { deleteRecoltare, getRecoltari, type Recoltare } from '@/lib/supabase/queries/recoltari'
import { buildRecoltareDeleteLabel } from '@/lib/ui/delete-labels'
import { useAddAction } from '@/contexts/AddActionContext'
import { queryKeys } from '@/lib/query-keys'

const AddRecoltareDialog = dynamic(
  () => import('@/components/recoltari/AddRecoltareDialog').then((mod) => mod.AddRecoltareDialog),
  { ssr: false }
)
const EditRecoltareDialog = dynamic(
  () => import('@/components/recoltari/EditRecoltareDialog').then((mod) => mod.EditRecoltareDialog),
  { ssr: false }
)
const ViewRecoltareDialog = dynamic(
  () => import('@/components/recoltari/ViewRecoltareDialog').then((mod) => mod.ViewRecoltareDialog),
  { ssr: false }
)
const DeleteConfirmDialog = dynamic(
  () => import('@/components/parcele/DeleteConfirmDialog').then((mod) => mod.DeleteConfirmDialog),
  { ssr: false }
)

type TimeFilter = 'azi' | 'saptamana' | 'luna' | 'sezon'

interface RecoltariPageClientProps {
  initialRecoltari?: Recoltare[]
  parcele?: Parcela[]
  initialError?: string | null
}

function toDateOnly(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10)
}

function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function shiftDays(base: Date, days: number): Date {
  const date = new Date(base)
  date.setDate(date.getDate() + days)
  return date
}

function getRecoltareKg(recoltare: Recoltare): number {
  return Number(recoltare.kg_cal1 ?? 0) + Number(recoltare.kg_cal2 ?? 0)
}

function formatKg(value: number, digits = 2): string {
  return `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: digits }).format(value)} kg`
}

function computeTrend(currentValue: number, previousValue: number): { value: number; positive: boolean } | undefined {
  if (!Number.isFinite(previousValue) || previousValue <= 0) return undefined
  const change = ((currentValue - previousValue) / previousValue) * 100
  if (!Number.isFinite(change)) return undefined
  return {
    value: Math.round(Math.abs(change)),
    positive: change >= 0,
  }
}

function getMedal(index: number): string {
  if (index === 0) return '\u{1F947}'
  if (index === 1) return '\u{1F948}'
  if (index === 2) return '\u{1F949}'
  return `${index + 1}.`
}

export function RecoltariPageClient({
  initialRecoltari: _initialRecoltari = [],
  parcele: initialParcele = [],
  initialError = null,
}: RecoltariPageClientProps) {
  useTrackModuleView('recoltari')
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: Recoltare; index: number }>>({})

  const [searchTerm, setSearchTerm] = useState('')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('sezon')
  const [selectedParcelaId, setSelectedParcelaId] = useState<string | null>(null)
  const [selectedCulegatorId, setSelectedCulegatorId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [viewingRecoltare, setViewingRecoltare] = useState<Recoltare | null>(null)
  const [editingRecoltare, setEditingRecoltare] = useState<Recoltare | null>(null)
  const [deletingRecoltare, setDeletingRecoltare] = useState<Recoltare | null>(null)

  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const addFromQuery = searchParams.get('add') === '1'

  const today = useMemo(() => {
    const current = new Date()
    current.setHours(0, 0, 0, 0)
    return current
  }, [])
  const todayIso = toIsoDate(today)
  const yesterdayIso = toIsoDate(shiftDays(today, -1))
  const last7StartIso = toIsoDate(shiftDays(today, -6))
  const previous7StartIso = toIsoDate(shiftDays(today, -13))
  const previous7EndIso = toIsoDate(shiftDays(today, -7))
  const monthStartIso = toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1))
  const seasonStartDate = (() => {
    const seasonStart = new Date(today.getFullYear(), 2, 1)
    if (today < seasonStart) {
      seasonStart.setFullYear(today.getFullYear() - 1)
    }
    return seasonStart
  })()
  const seasonStartIso = toIsoDate(seasonStartDate)

  const last7DaysIso = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => toIsoDate(shiftDays(today, -6 + index)))
  }, [today])

  const {
    data: recoltari = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.recoltari,
    queryFn: getRecoltari,
    enabled: !initialError,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: parcele = initialParcele } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
    initialData: initialParcele,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: culegatori = [] } = useQuery({
    queryKey: queryKeys.culegatori,
    queryFn: getCulegatori,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: recoltareDeleteImpact, isLoading: isLoadingDeleteImpact } = useQuery({
    queryKey: ['recoltare-delete-impact', deletingRecoltare?.id ?? null],
    queryFn: () => getRecoltareDeleteImpact(deletingRecoltare!.id),
    enabled: Boolean(deletingRecoltare?.id),
    staleTime: 10000,
    refetchOnWindowFocus: false,
  })

  useMobileScrollRestore({
    storageKey: 'scroll:recoltari',
    ready: !isLoading,
  })

  const restorePendingDeleteItem = (recoltareId: string) => {
    const pendingItem = pendingDeletedItems.current[recoltareId]
    if (!pendingItem) return

    delete pendingDeletedItems.current[recoltareId]
    queryClient.setQueryData<Recoltare[]>(queryKeys.recoltari, (current = []) => {
      if (current.some((item) => item.id === recoltareId)) return current

      const next = [...current]
      const insertAt = pendingItem.index >= 0 ? Math.min(pendingItem.index, next.length) : next.length
      next.splice(insertAt, 0, pendingItem.item)
      return next
    })
  }

  const deleteMutation = useMutation({
    mutationFn: deleteRecoltare,
    onSuccess: (result, deletedId) => {
      if (!result.success) {
        restorePendingDeleteItem(deletedId)
        toast.error(result.error)
        return
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.recoltari, exact: true })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal, exact: true })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard, exact: true })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocuriLocatiiRoot })
      queryClient.invalidateQueries({ queryKey: queryKeys.miscariStoc })
      queryClient.invalidateQueries({ queryKey: queryKeys.cheltuieli })
      delete pendingDeletedItems.current[deletedId]
      trackEvent('delete_item', 'recoltari')
      track('recoltare_delete', { id: deletedId })
      if (result.warning) {
        toast.warning(result.warning)
      } else {
        toast.success('Recoltare stearsa')
      }
      setDeletingRecoltare(null)
    },
    onError: (err: Error, deletedId) => {
      restorePendingDeleteItem(deletedId)
      toast.error(err.message)
    },
  })

  useEffect(() => {
    return () => {
      Object.values(pendingDeleteTimers.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    if (!addFromQuery) return
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('add')
    const query = nextParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [addFromQuery, pathname, router, searchParams])

  useEffect(() => {
    const unregister = registerAddAction(() => setAddOpen(true), 'Adauga recoltare')
    return unregister
  }, [registerAddAction])

  useEffect(() => {
    const query = searchTerm.trim()
    if (!query) return

    const timer = setTimeout(() => {
      track('search', { module: 'recoltari', query })
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const scheduleDelete = (recoltare: Recoltare) => {
    const recoltareId = recoltare.id
    const currentItems = queryClient.getQueryData<Recoltare[]>(queryKeys.recoltari) ?? []
    const deleteIndex = currentItems.findIndex((item) => item.id === recoltareId)

    pendingDeletedItems.current[recoltareId] = { item: recoltare, index: deleteIndex }
    queryClient.setQueryData<Recoltare[]>(queryKeys.recoltari, (current = []) => current.filter((item) => item.id !== recoltareId))

    const timer = setTimeout(() => {
      delete pendingDeleteTimers.current[recoltareId]
      deleteMutation.mutate(recoltareId)
    }, 5000)

    pendingDeleteTimers.current[recoltareId] = timer

    toast('Element sters', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const pendingTimer = pendingDeleteTimers.current[recoltareId]
          if (!pendingTimer) return

          clearTimeout(pendingTimer)
          delete pendingDeleteTimers.current[recoltareId]

          const pendingItem = pendingDeletedItems.current[recoltareId]
          delete pendingDeletedItems.current[recoltareId]
          if (!pendingItem) return

          queryClient.setQueryData<Recoltare[]>(queryKeys.recoltari, (current = []) => {
            if (current.some((item) => item.id === recoltareId)) return current

            const next = [...current]
            const insertAt = pendingItem.index >= 0 ? Math.min(pendingItem.index, next.length) : next.length
            next.splice(insertAt, 0, pendingItem.item)
            return next
          })
        },
      },
    })
  }

  const parcelaMap = useMemo(() => {
    const map: Record<string, { name: string; displayName: string; soi: string; status: string; tipLabel: string }> = {}
    parcele.forEach((p) => {
      const tipLabel = getUnitateTipLabel(p.tip_unitate)
      map[p.id] = {
        name: p.nume_parcela || 'Parcela',
        displayName: formatUnitateDisplayName(p.nume_parcela, p.tip_unitate),
        soi: p.soi_plantat || p.tip_fruct || 'Soi',
        status: String(p.status || ''),
        tipLabel,
      }
    })
    return map
  }, [parcele])

  const culegatorMap = useMemo(() => {
    const map: Record<string, { nume: string; tarif: number }> = {}
    culegatori.forEach((c) => {
      map[c.id] = {
        nume: c.nume_prenume,
        tarif: Number(c.tarif_lei_kg || 0),
      }
    })
    return map
  }, [culegatori])

  const activeParcele = useMemo(
    () =>
      parcele
        .filter((parcela) => String(parcela.status || '').toLowerCase() !== 'anulat')
        .map((parcela) => ({
          id: parcela.id,
          name: parcela.nume_parcela || 'Parcela',
          displayName: formatUnitateDisplayName(parcela.nume_parcela, parcela.tip_unitate),
          tipLabel: getUnitateTipLabel(parcela.tip_unitate),
          soi: parcela.soi_plantat || parcela.tip_fruct || 'Soi',
        })),
    [parcele]
  )

  const parcelPalette = [colors.greenLight, colors.blueLight, colors.yellowLight]
  const parcelaColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    activeParcele.forEach((parcela, index) => {
      map[parcela.id] = parcelPalette[index % parcelPalette.length]
    })
    return map
  }, [activeParcele])

  const searchFilteredRecoltari = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return recoltari

    return recoltari.filter((recoltare) => {
      const parcelaName = recoltare.parcela_id ? parcelaMap[recoltare.parcela_id]?.name || '' : ''
      const parcelaDisplay = recoltare.parcela_id ? parcelaMap[recoltare.parcela_id]?.displayName || '' : ''
      const parcelaSoi = recoltare.parcela_id ? parcelaMap[recoltare.parcela_id]?.soi || '' : ''
      const parcelaTip = recoltare.parcela_id ? parcelaMap[recoltare.parcela_id]?.tipLabel || '' : ''
      const culegatorName = recoltare.culegator_id ? culegatorMap[recoltare.culegator_id]?.nume || '' : ''
      return (
        parcelaName.toLowerCase().includes(term) ||
        parcelaDisplay.toLowerCase().includes(term) ||
        parcelaSoi.toLowerCase().includes(term) ||
        parcelaTip.toLowerCase().includes(term) ||
        culegatorName.toLowerCase().includes(term) ||
        (recoltare.observatii?.toLowerCase().includes(term) ?? false)
      )
    })
  }, [recoltari, searchTerm, parcelaMap, culegatorMap])

  const entityFilteredRecoltari = useMemo(() => {
    return searchFilteredRecoltari.filter((recoltare) => {
      if (selectedParcelaId && recoltare.parcela_id !== selectedParcelaId) return false
      if (selectedCulegatorId && recoltare.culegator_id !== selectedCulegatorId) return false
      return true
    })
  }, [searchFilteredRecoltari, selectedParcelaId, selectedCulegatorId])

  const filteredRecoltari = useMemo(() => {
    return entityFilteredRecoltari.filter((recoltare) => {
      const date = toDateOnly(recoltare.data)
      if (!date) return false

      if (timeFilter === 'azi') return date === todayIso
      if (timeFilter === 'saptamana') return date >= last7StartIso && date <= todayIso
      if (timeFilter === 'luna') return date >= monthStartIso && date <= todayIso
      return date >= seasonStartIso && date <= todayIso
    })
  }, [entityFilteredRecoltari, timeFilter, todayIso, last7StartIso, monthStartIso, seasonStartIso])

  const totalCantitateKg = useMemo(
    () => filteredRecoltari.reduce((sum, recoltare) => sum + getRecoltareKg(recoltare), 0),
    [filteredRecoltari]
  )

  const todayRows = useMemo(
    () => entityFilteredRecoltari.filter((recoltare) => toDateOnly(recoltare.data) === todayIso),
    [entityFilteredRecoltari, todayIso]
  )

  const yesterdayRows = useMemo(
    () => entityFilteredRecoltari.filter((recoltare) => toDateOnly(recoltare.data) === yesterdayIso),
    [entityFilteredRecoltari, yesterdayIso]
  )

  const last7Rows = useMemo(
    () =>
      entityFilteredRecoltari.filter((recoltare) => {
        const date = toDateOnly(recoltare.data)
        return date >= last7StartIso && date <= todayIso
      }),
    [entityFilteredRecoltari, last7StartIso, todayIso]
  )

  const previous7Rows = useMemo(
    () =>
      entityFilteredRecoltari.filter((recoltare) => {
        const date = toDateOnly(recoltare.data)
        return date >= previous7StartIso && date <= previous7EndIso
      }),
    [entityFilteredRecoltari, previous7StartIso, previous7EndIso]
  )

  const todayTotalKg = useMemo(() => todayRows.reduce((sum, row) => sum + getRecoltareKg(row), 0), [todayRows])
  const yesterdayTotalKg = useMemo(() => yesterdayRows.reduce((sum, row) => sum + getRecoltareKg(row), 0), [yesterdayRows])
  const weekTotalKg = useMemo(() => last7Rows.reduce((sum, row) => sum + getRecoltareKg(row), 0), [last7Rows])
  const previousWeekTotalKg = useMemo(() => previous7Rows.reduce((sum, row) => sum + getRecoltareKg(row), 0), [previous7Rows])

  const weekSeries = useMemo(() => {
    return last7DaysIso.map((dayIso) =>
      entityFilteredRecoltari.reduce((sum, row) => {
        if (toDateOnly(row.data) !== dayIso) return sum
        return sum + getRecoltareKg(row)
      }, 0)
    )
  }, [last7DaysIso, entityFilteredRecoltari])

  const shouldShowSparkline = weekSeries.filter((value) => value > 0).length >= 2
  const trendAzi = computeTrend(todayTotalKg, yesterdayTotalKg)
  const trendSaptamana = computeTrend(weekTotalKg, previousWeekTotalKg)

  const medieZilnica = weekTotalKg / 7

  const rowsForTopWorker = useMemo(() => {
    return searchFilteredRecoltari.filter((recoltare) => {
      if (selectedParcelaId && recoltare.parcela_id !== selectedParcelaId) return false
      return toDateOnly(recoltare.data) === todayIso
    })
  }, [searchFilteredRecoltari, selectedParcelaId, todayIso])

  const rankingCulegatoriAzi = useMemo(() => {
    const byWorker = new Map<string, { id: string; name: string; kg: number }>()

    rowsForTopWorker.forEach((recoltare) => {
      if (!recoltare.culegator_id) return
      const workerId = recoltare.culegator_id
      const workerName = culegatorMap[workerId]?.nume || 'Culegator'
      const kg = getRecoltareKg(recoltare)
      const existing = byWorker.get(workerId)

      if (existing) {
        existing.kg += kg
      } else {
        byWorker.set(workerId, {
          id: workerId,
          name: workerName,
          kg,
        })
      }
    })

    return Array.from(byWorker.values()).sort((a, b) => b.kg - a.kg)
  }, [rowsForTopWorker, culegatorMap])

  const topCulegatorAzi = rankingCulegatoriAzi[0]

  const calitatiSummary = useMemo(() => {
    const cal1 = filteredRecoltari.reduce((sum, row) => sum + Number(row.kg_cal1 ?? 0), 0)
    const cal2 = filteredRecoltari.reduce((sum, row) => sum + Number(row.kg_cal2 ?? 0), 0)
    const total = cal1 + cal2
    if (total <= 0) {
      return { cal1Pct: 0, cal2Pct: 0 }
    }

    return {
      cal1Pct: Math.round((cal1 / total) * 100),
      cal2Pct: Math.round((cal2 / total) * 100),
    }
  }, [filteredRecoltari])

  const rowsForParcelStrip = useMemo(() => {
    return searchFilteredRecoltari.filter((recoltare) => {
      if (selectedCulegatorId && recoltare.culegator_id !== selectedCulegatorId) return false
      return toDateOnly(recoltare.data) === todayIso
    })
  }, [searchFilteredRecoltari, selectedCulegatorId, todayIso])

  const todayKgByParcela = useMemo(() => {
    const map = new Map<string, number>()
    rowsForParcelStrip.forEach((recoltare) => {
      if (!recoltare.parcela_id) return
      map.set(recoltare.parcela_id, (map.get(recoltare.parcela_id) ?? 0) + getRecoltareKg(recoltare))
    })
    return map
  }, [rowsForParcelStrip])

  const toggleParcelaFilter = (parcelaId: string) => {
    setSelectedParcelaId((previous) => (previous === parcelaId ? null : parcelaId))
    setSelectedCulegatorId(null)
  }

  const toggleCulegatorFilter = (culegatorId: string) => {
    setSelectedCulegatorId((previous) => (previous === culegatorId ? null : culegatorId))
    setSelectedParcelaId(null)
  }

  const resetEntityFilters = () => {
    setSelectedParcelaId(null)
    setSelectedCulegatorId(null)
  }

  const activeFilterLabel = selectedParcelaId
    ? `${'\u{1F4CD}'} ${parcelaMap[selectedParcelaId]?.displayName || 'Parcela'}`
    : selectedCulegatorId
      ? `${'\u{1F464}'} ${culegatorMap[selectedCulegatorId]?.nume || 'Culegator'}`
      : null

  const timeFilterOptions: Array<{ key: TimeFilter; label: string }> = [
    { key: 'azi', label: 'Azi' },
    { key: 'saptamana', label: 'Sapt.' },
    { key: 'luna', label: 'Luna' },
    { key: 'sezon', label: 'Sezon' },
  ]

  const maxRankingKg = rankingCulegatoriAzi[0]?.kg ?? 0

  return (
    <AppShell
      header={<PageHeader title="Recoltări" subtitle="Evidența producției zilnice" />}
      bottomBar={
        <StickyActionBar>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--agri-text-muted)]">Total: {formatKg(totalCantitateKg, 2)}</p>
          </div>
        </StickyActionBar>
      }
    >
      <div className="mx-auto mt-3 w-full max-w-7xl space-y-3 px-0 py-3 sm:mt-0 sm:px-3 sm:space-y-4 sm:py-4">
        {initialError ? <ErrorState title="Eroare" message={initialError} /> : null}
        {isError && !initialError ? <ErrorState title="Eroare" message={(error as Error).message} /> : null}

        {!initialError && !isError ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.sm }}>
              <button
                type="button"
                className="min-h-[110px] sm:min-h-0 flex flex-col justify-between"
                onClick={() => setTimeFilter('azi')}
                style={{
                  border: `1px solid ${colors.grayLight}`,
                  borderRadius: radius.lg,
                  background: colors.white,
                  boxShadow: shadows.card,
                  padding: spacing.md,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: colors.dark }}>{'\u{1FAD0}'} Azi</span>
                  {trendAzi ? <TrendBadge value={trendAzi.value} positive={trendAzi.positive} /> : null}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: colors.dark }}>{formatKg(todayTotalKg, 1)}</div>
                <div style={{ fontSize: 11, color: colors.gray }}>{todayRows.length} recoltări</div>
                {shouldShowSparkline ? (
                  <div style={{ marginTop: spacing.sm }}>
                    <Sparkline data={weekSeries} color={colors.green} width={88} height={24} />
                  </div>
                ) : null}
              </button>

              <button
                type="button"
                className="min-h-[110px] sm:min-h-0 flex flex-col justify-between"
                onClick={() => setTimeFilter('saptamana')}
                style={{
                  border: `1px solid ${colors.grayLight}`,
                  borderRadius: radius.lg,
                  background: colors.white,
                  boxShadow: shadows.card,
                  padding: spacing.md,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: colors.dark }}>{'\u{1F4C5}'} Săptămâna</span>
                  {trendSaptamana ? <TrendBadge value={trendSaptamana.value} positive={trendSaptamana.positive} /> : null}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: colors.dark }}>{formatKg(weekTotalKg, 1)}</div>
                <div style={{ fontSize: 11, color: colors.gray }}>{last7Rows.length} recoltări</div>
                {shouldShowSparkline ? (
                  <div style={{ marginTop: spacing.sm }}>
                    <Sparkline data={weekSeries} color={colors.primary} width={88} height={24} />
                  </div>
                ) : null}
              </button>
            </div>

            <div className="sm:hidden">
              <div
                style={{
                  borderRadius: radius.lg,
                  background: colors.white,
                  boxShadow: shadows.card,
                  border: `1px solid ${colors.grayLight}`,
                  padding: spacing.md,
                  minHeight: 110,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.dark, marginBottom: spacing.xs }}>Calitate recoltă</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: colors.dark }}>
                  <span style={{ color: colors.green }}>{calitatiSummary.cal1Pct}% Cal I</span>
                  <span style={{ color: colors.gray }}> | </span>
                  <span style={{ color: colors.coral }}>{calitatiSummary.cal2Pct}% Cal II</span>
                </div>
                <div
                  style={{
                    marginTop: spacing.sm,
                    height: 12,
                    borderRadius: radius.full,
                    background: colors.grayLight,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${calitatiSummary.cal1Pct}%`,
                      background: colors.green,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="hidden sm:grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: spacing.sm }}>
              <MiniCard
                icon={'\u{1F4CA}'}
                label="Medie/zi"
                value={new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(medieZilnica)}
                sub="kg"
              />

              <div
                style={{
                  borderRadius: radius.lg,
                  border: `2px solid ${selectedCulegatorId && selectedCulegatorId === topCulegatorAzi?.id ? colors.primary : 'transparent'}`,
                }}
              >
                <MiniCard
                  icon={'\u{1F3C6}'}
                  label="Top azi"
                  value={topCulegatorAzi?.name || '-'}
                  sub={topCulegatorAzi ? `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(topCulegatorAzi.kg)} kg` : 'fără date'}
                  onClick={topCulegatorAzi ? () => toggleCulegatorFilter(topCulegatorAzi.id) : undefined}
                />
              </div>

              <div
                style={{
                  borderRadius: radius.lg,
                  background: colors.white,
                  boxShadow: shadows.card,
                  border: `1px solid ${colors.grayLight}`,
                  padding: spacing.md,
                }}
              >
                <div style={{ fontSize: 10, color: colors.gray, marginBottom: spacing.xs }}>Cal I / II</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: colors.dark }}>
                  <span style={{ color: colors.green }}>{calitatiSummary.cal1Pct}%</span> / <span style={{ color: colors.coral }}>{calitatiSummary.cal2Pct}%</span>
                </div>
                <div
                  style={{
                    marginTop: spacing.sm,
                    height: 8,
                    borderRadius: radius.full,
                    background: colors.grayLight,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${calitatiSummary.cal1Pct}%`,
                      background: colors.green,
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: spacing.sm, overflowX: 'auto', paddingBottom: 2 }}>
              {activeParcele.map((parcela) => {
                const kgAzi = todayKgByParcela.get(parcela.id) ?? 0
                const selected = selectedParcelaId === parcela.id
                return (
                  <button
                    key={parcela.id}
                    type="button"
                    onClick={() => toggleParcelaFilter(parcela.id)}
                    style={{
                      minWidth: 148,
                      borderRadius: radius.lg,
                      border: `${selected ? 2 : 1}px solid ${selected ? colors.primary : kgAzi > 0 ? colors.green : colors.grayLight}`,
                      background: kgAzi > 0 ? colors.greenLight : colors.grayLight,
                      padding: spacing.sm,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: colors.dark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {parcela.name}
                      </div>
                      <span
                        style={{
                          borderRadius: radius.full,
                          background: colors.grayLight,
                          color: colors.gray,
                          fontSize: 10,
                          fontWeight: 700,
                          lineHeight: 1,
                          padding: '4px 7px',
                          flexShrink: 0,
                        }}
                      >
                        {parcela.tipLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: colors.gray, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{parcela.soi}</div>
                    <div style={{ marginTop: spacing.xs, fontSize: 18, fontWeight: 700, color: kgAzi > 0 ? colors.green : colors.gray }}>
                      {new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(kgAzi)}
                    </div>
                    <div style={{ fontSize: 9, color: colors.gray }}>kg</div>
                  </button>
                )
              })}
            </div>

            <div
              style={{
                borderRadius: radius.lg,
                background: colors.white,
                boxShadow: shadows.card,
                border: `1px solid ${colors.grayLight}`,
                padding: spacing.md,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                <SectionTitle className="flex-1" title="Culegători azi" />
                {selectedCulegatorId ? (
                  <button
                    type="button"
                    onClick={() => setSelectedCulegatorId(null)}
                    style={{
                      border: 'none',
                      background: colors.coralLight,
                      color: colors.coral,
                      borderRadius: radius.sm,
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {'\u2715'} reset
                  </button>
                ) : null}
              </div>

              {rankingCulegatoriAzi.length === 0 ? (
                <div style={{ fontSize: 12, color: colors.gray }}>Nu există recoltări azi.</div>
              ) : (
                <div style={{ display: 'grid', gap: spacing.xs }}>
                  {rankingCulegatoriAzi.map((worker, index) => {
                    const progress = maxRankingKg > 0 ? (worker.kg / maxRankingKg) * 100 : 0
                    const selected = selectedCulegatorId === worker.id
                    return (
                      <button
                        key={worker.id}
                        type="button"
                        onClick={() => toggleCulegatorFilter(worker.id)}
                        style={{
                          border: `1px solid ${selected ? colors.primary : colors.grayLight}`,
                          background: selected ? colors.blueLight : colors.white,
                          borderRadius: radius.md,
                          padding: spacing.sm,
                          textAlign: 'left',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: colors.dark, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {getMedal(index)} {worker.name}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: colors.dark }}>{formatKg(worker.kg, 1)}</div>
                        </div>
                        <div
                          style={{
                            marginTop: spacing.xs,
                            height: 6,
                            borderRadius: radius.full,
                            background: colors.grayLight,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${progress}%`,
                              height: '100%',
                              background: selected ? colors.primary : colors.green,
                            }}
                          />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <SearchField
              placeholder="Caută după parcelă, soi, culegător sau observații..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Caută recoltări"
            />

            <div style={{ display: 'flex', gap: spacing.sm, overflowX: 'auto' }}>
              {timeFilterOptions.map((option) => {
                const active = timeFilter === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setTimeFilter(option.key)}
                    style={{
                      borderRadius: radius.md,
                      border: `1px solid ${active ? colors.primary : colors.grayLight}`,
                      background: active ? colors.primary : colors.white,
                      color: active ? colors.white : colors.gray,
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            {activeFilterLabel ? (
              <div
                style={{
                  borderRadius: radius.md,
                  background: colors.blueLight,
                  border: `1px solid ${colors.blue}`,
                  padding: `${spacing.sm}px ${spacing.md}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.sm,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: colors.dark }}>{activeFilterLabel}</span>
                <button
                  type="button"
                  onClick={resetEntityFilters}
                  style={{
                    border: 'none',
                    background: colors.coral,
                    color: colors.white,
                    borderRadius: radius.sm,
                    padding: '5px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {'\u2715'} Arata toate
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {isLoading ? (
          <>
            <div className="overflow-hidden rounded-xl border border-[var(--agri-border)] bg-white sm:hidden">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="border-b border-[var(--agri-border)] last:border-b-0">
                  <ListSkeletonRow />
                </div>
              ))}
            </div>
            <div className="hidden grid-cols-1 gap-2.5 sm:grid sm:gap-3 md:grid-cols-2 lg:grid-cols-3 lg:gap-4 xl:gap-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <ListSkeletonCard key={index} className="min-h-[146px] sm:min-h-[208px]" />
              ))}
            </div>
          </>
        ) : null}

        {!isLoading && !isError && !initialError && recoltari.length === 0 ? (
          <EmptyState icon={<Leaf className="h-16 w-16" />} title="Nicio recoltare încă" description="Adaugă prima recoltare pentru a începe" />
        ) : null}

        {!isLoading && !isError && !initialError && recoltari.length > 0 && filteredRecoltari.length === 0 ? (
          <div
            style={{
              borderRadius: radius.lg,
              background: colors.white,
              border: `1px solid ${colors.grayLight}`,
              boxShadow: shadows.card,
              padding: spacing.lg,
              color: colors.gray,
              fontSize: 13,
            }}
          >
            Nu există recoltări pentru filtrele selectate.
          </div>
        ) : null}

        {!isLoading && !isError && !initialError && filteredRecoltari.length > 0 ? (
          <div style={{ display: 'grid', gap: spacing.sm }}>
            {filteredRecoltari.map((recoltare) => {
              const parcelaMeta = recoltare.parcela_id ? parcelaMap[recoltare.parcela_id] : undefined
              return (
                <RecoltareCard
                  key={recoltare.id}
                  recoltare={recoltare}
                  culegatorNume={recoltare.culegator_id ? culegatorMap[recoltare.culegator_id]?.nume : undefined}
                  culegatorTarif={recoltare.culegator_id ? culegatorMap[recoltare.culegator_id]?.tarif : undefined}
                  parcelaNume={parcelaMeta?.name}
                  parcelaTip={parcelaMeta?.tipLabel}
                  parcelaSoi={parcelaMeta?.soi}
                  iconBackground={recoltare.parcela_id ? parcelaColorMap[recoltare.parcela_id] : colors.grayLight}
                  onView={setViewingRecoltare}
                  onDelete={setDeletingRecoltare}
                  onEdit={setEditingRecoltare}
                />
              )
            })}
          </div>
        ) : null}
      </div>

      <AddRecoltareDialog open={addOpen || addFromQuery} onOpenChange={setAddOpen} hideTrigger />

      <ViewRecoltareDialog
        open={!!viewingRecoltare}
        onOpenChange={(open) => {
          if (!open) setViewingRecoltare(null)
        }}
        recoltare={viewingRecoltare}
        parcelaNume={viewingRecoltare?.parcela_id ? parcelaMap[viewingRecoltare.parcela_id]?.name : undefined}
        parcelaTip={viewingRecoltare?.parcela_id ? parcelaMap[viewingRecoltare.parcela_id]?.tipLabel : undefined}
        culegatorNume={viewingRecoltare?.culegator_id ? culegatorMap[viewingRecoltare.culegator_id]?.nume : undefined}
        onEdit={setEditingRecoltare}
        onDelete={setDeletingRecoltare}
      />

      <EditRecoltareDialog
        recoltare={editingRecoltare}
        open={!!editingRecoltare}
        onOpenChange={(open) => {
          if (!open) setEditingRecoltare(null)
        }}
      />

      <DeleteConfirmDialog
        open={!!deletingRecoltare}
        onOpenChange={(open) => {
          if (!open) setDeletingRecoltare(null)
        }}
        onConfirm={() => {
          if (!deletingRecoltare) return
          if (isLoadingDeleteImpact) return
          if (recoltareDeleteImpact?.hasDownstreamSales) {
            toast.error('Această recoltare are vânzări asociate și nu poate fi ștearsă.')
            return
          }
          scheduleDelete(deletingRecoltare)
          setDeletingRecoltare(null)
        }}
        itemName={buildRecoltareDeleteLabel(
          deletingRecoltare,
          deletingRecoltare?.parcela_id ? parcelaMap[deletingRecoltare.parcela_id]?.name || '' : ''
        )}
        itemType="recoltare"
        description={
          isLoadingDeleteImpact
            ? 'Se verifică impactul acestei ștergeri asupra stocului...'
            : recoltareDeleteImpact?.hasDownstreamSales
              ? 'Această recoltare are vânzări asociate și nu poate fi ștearsă.'
              : recoltareDeleteImpact?.hasStock
                ? `Ștergerea va elimina și ${formatKg(recoltareDeleteImpact.stockToRemoveKg)} din stoc.`
                : `Stergi recoltarea din ${deletingRecoltare?.data ? new Date(deletingRecoltare.data).toLocaleDateString('ro-RO') : 'data necunoscuta'} - parcelă ${deletingRecoltare?.parcela_id ? parcelaMap[deletingRecoltare.parcela_id]?.name || 'necunoscuta' : 'necunoscuta'}?`
        }
      />
    </AppShell>
  )
}
