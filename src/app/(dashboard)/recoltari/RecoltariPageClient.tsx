'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, CircleDot, Layers2, Scale, Users } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { DashboardContentShell } from '@/components/app/DashboardContentShell'
import { DesktopKpiStrip } from '@/components/app/DesktopKpiStrip'
import {
  ModuleEmptyCard,
  ModulePillFilterButton,
  ModulePillRow,
  ModuleScoreboard,
} from '@/components/app/module-list-chrome'
import { ErrorState } from '@/components/app/ErrorState'
import { EntityListSkeleton } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import { useMobileScrollRestore } from '@/components/app/useMobileScrollRestore'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { Button } from '@/components/ui/button'
import { DesktopInspectorPanel, DesktopInspectorSection, DesktopSplitPane } from '@/components/ui/desktop'
import { SearchField } from '@/components/ui/SearchField'
import Sparkline from '@/components/ui/Sparkline'
import { ViewRecoltareDialog } from '@/components/recoltari/ViewRecoltareDialog'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { getHarvestCropSelection, stripHiddenAgricultureMetadata } from '@/lib/parcele/crop-config'
import { formatUnitateDisplayName, getUnitateTipLabel } from '@/lib/parcele/unitate'
import { aggregateRecoltariByCulegator, type RecoltareWorkerAggregate } from '@/lib/recoltari/aggregate-by-culegator'
import { getCulegatori } from '@/lib/supabase/queries/culegatori'
import { getRecoltareDeleteImpact } from '@/lib/supabase/queries/miscari-stoc'
import { getParcele, type Parcela } from '@/lib/supabase/queries/parcele'
import { deleteRecoltare, getRecoltari, getRecoltareTotalKg, type Recoltare } from '@/lib/supabase/queries/recoltari'
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
const DeleteConfirmDialog = dynamic(
  () => import('@/components/parcele/DeleteConfirmDialog').then((mod) => mod.DeleteConfirmDialog),
  { ssr: false }
)

type TimeFilter = 'azi' | 'toate'

interface RecoltariPageClientProps {
  initialRecoltari?: Recoltare[]
  parcele?: Parcela[]
  initialError?: string | null
}

export function hasAiOpenForm(searchParams: Pick<URLSearchParams, 'get'>): boolean {
  return searchParams.get('openForm') === '1'
}

export function parseAiRecoltarePrefill(searchParams: Pick<URLSearchParams, 'get'>): {
  parcela_id: string
  parcela_label: string
  cantitate_kg: string
  data: string
  observatii: string
} {
  return {
    parcela_id: (searchParams.get('parcela_id') ?? '').trim(),
    parcela_label: (searchParams.get('parcela_label') ?? searchParams.get('parcela') ?? '').trim(),
    cantitate_kg: (searchParams.get('cantitate_kg') ?? '').trim(),
    data: (searchParams.get('data') ?? '').trim(),
    observatii: (searchParams.get('observatii') ?? '').trim(),
  }
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

function formatKg(value: number, digits = 2): string {
  return `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: digits }).format(value)} kg`
}

function formatKgValue(value: number, digits = 2): string {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: digits }).format(value)
}

function formatLei(value: number): string {
  return `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(value)} lei`
}

function formatTableDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value.slice(0, 10))
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ro-RO')
}

function calculateCal1Pct(cal1: number, cal2: number): number {
  const total = cal1 + cal2
  if (total <= 0) return 0
  return Math.round((cal1 / total) * 100)
}

type ParcelaMetaMap = Record<
  string,
  { name: string; displayName: string; soi: string; status: string; tipLabel: string }
>

function formatHarvestCount(value: number): string {
  return `${value} ${value === 1 ? 'recoltare' : 'recoltări'}`
}

function formatRatePerKg(value: number): string {
  return `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(value)} lei/kg`
}

function formatAggregateRate(aggregate: RecoltareWorkerAggregate): string | null {
  if (aggregate.hasVariableRate) return 'Rată variabilă'
  if (aggregate.uniformSnapshotRateLeiKg === null) return null
  return formatRatePerKg(aggregate.uniformSnapshotRateLeiKg)
}

function RecoltareAggregateCard({
  aggregate,
  expanded = false,
  selected = false,
  showInlineDetails = true,
  parcelaMap,
  onToggle,
  onViewHarvest,
}: {
  aggregate: RecoltareWorkerAggregate
  expanded?: boolean
  selected?: boolean
  showInlineDetails?: boolean
  parcelaMap: ParcelaMetaMap
  onToggle: () => void
  onViewHarvest: (recoltare: Recoltare) => void
}) {
  const rateLabel = formatAggregateRate(aggregate)

  return (
    <div
      className={[
        'overflow-hidden rounded-[22px] bg-[var(--surface-card)] shadow-[var(--shadow-soft)] transition-[transform,box-shadow,border-color] duration-150 ease-out',
        selected ? 'ring-2 ring-[color:color-mix(in_srgb,var(--success-text)_28%,transparent)]' : '',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={showInlineDetails ? expanded : undefined}
        className="flex w-full items-start gap-3 p-[18px] text-left transition-transform duration-150 ease-out active:scale-[0.985]"
      >
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base text-[var(--text-primary)] [font-weight:700]">{aggregate.workerName}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {formatHarvestCount(aggregate.harvestCount)}
                {rateLabel ? ` · ${rateLabel}` : ''}
              </p>
            </div>
            <div className="shrink-0 rounded-2xl bg-[var(--success-text)] px-3 py-2 text-right text-white shadow-[0_6px_18px_rgba(13,155,92,0.18)]">
              <p className="text-[10px] uppercase tracking-[0.08em] text-white/80">De plătit</p>
              <p className="text-sm [font-weight:700]">{formatLei(aggregate.totalPaymentLei)}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-[var(--surface-muted)] px-3 py-2">
              <p className="text-[11px] text-[var(--text-secondary)]">Total</p>
              <p className="text-sm text-[var(--text-primary)] [font-weight:700]">{formatKgValue(aggregate.totalKg, 2)} kg</p>
            </div>
            <div className="rounded-2xl bg-[color:color-mix(in_srgb,var(--success-bg)_78%,var(--surface-card))] px-3 py-2">
              <p className="text-[11px] text-[var(--text-secondary)]">Cal I</p>
              <p className="text-sm text-[var(--success-text)] [font-weight:700]">{formatKgValue(aggregate.totalCal1Kg, 2)} kg</p>
            </div>
            <div className="rounded-2xl bg-[color:color-mix(in_srgb,var(--warning-bg)_82%,var(--surface-card))] px-3 py-2">
              <p className="text-[11px] text-[var(--text-secondary)]">Cal II</p>
              <p className="text-sm text-[var(--warning-text)] [font-weight:700]">{formatKgValue(aggregate.totalCal2Kg, 2)} kg</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            {showInlineDetails ? (
              expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : selected ? (
              <ChevronRight className="h-4 w-4" />
            ) : null}
            <span>
              {showInlineDetails
                ? expanded
                  ? 'Ascunde recoltările individuale'
                  : 'Vezi recoltările individuale'
                : 'Selectează pentru detalii'}
            </span>
          </div>
        </div>
      </button>

      {showInlineDetails && expanded ? (
        <div className="border-t border-[var(--border-default)] bg-[var(--surface-muted)] px-[18px] py-3">
          <div className="space-y-2">
            {aggregate.harvests.map((recoltare) => {
              const parcelaMeta = recoltare.parcela_id ? parcelaMap[recoltare.parcela_id] : undefined
              const totalKg = getRecoltareTotalKg(recoltare)

              return (
                <button
                  key={recoltare.id}
                  type="button"
                  onClick={() => onViewHarvest(recoltare)}
                  className="w-full rounded-2xl bg-[var(--surface-card)] px-4 py-3 text-left shadow-[var(--shadow-soft)] transition-transform duration-150 ease-out active:scale-[0.985]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--text-primary)] [font-weight:650]">
                        {parcelaMeta?.displayName || parcelaMeta?.name || 'Parcelă'}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{formatTableDate(recoltare.data)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[var(--text-primary)] [font-weight:700]">{formatKgValue(totalKg, 2)} kg</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        {formatRatePerKg(Number(recoltare.pret_lei_pe_kg_snapshot ?? 0))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
                    <span>Cal I {formatKgValue(Number(recoltare.kg_cal1 ?? 0), 2)} kg</span>
                    <span>Cal II {formatKgValue(Number(recoltare.kg_cal2 ?? 0), 2)} kg</span>
                    <span className="text-[var(--success-text)] [font-weight:650]">
                      {formatLei(Number(recoltare.valoare_munca_lei ?? 0))}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function RecoltariPageClient({
  parcele: initialParcele = [],
  initialError = null,
}: RecoltariPageClientProps) {
  useTrackModuleView('recoltari')
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const { memberRole, accessLevel } = useDashboardAuth()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: Recoltare; index: number }>>({})
  const deleteMutateRef = useRef<(id: string) => void>(() => {})

  const [searchTerm, setSearchTerm] = useState('')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('azi')
  const [addOpen, setAddOpen] = useState(false)
  const [aiPrefill, setAiPrefill] = useState<{ parcela_id: string; parcela_label: string; cantitate_kg: string; data: string; observatii: string } | null>(null)
  const [editingRecoltare, setEditingRecoltare] = useState<Recoltare | null>(null)
  const [deletingRecoltare, setDeletingRecoltare] = useState<Recoltare | null>(null)
  const [viewingRecoltare, setViewingRecoltare] = useState<Recoltare | null>(null)
  const [expandedAggregateKey, setExpandedAggregateKey] = useState<string | null>(null)
  const [desktopSelectedAggregateKey, setDesktopSelectedAggregateKey] = useState<string | null>(null)

  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const addFromQuery = searchParams.get('add') === '1'
  const openFormFromQuery = hasAiOpenForm(searchParams)
  const isOperator = memberRole === 'operator'
  const canWriteRecoltari = !isOperator || accessLevel === 'write'
  const canDeleteRecoltari = !isOperator
  const queryAiPrefill = useMemo(
    () => (openFormFromQuery ? parseAiRecoltarePrefill(searchParams) : null),
    [openFormFromQuery, searchParams]
  )
  const resolvedAiPrefill = openFormFromQuery ? queryAiPrefill : aiPrefill
  const isAddDialogOpen = canWriteRecoltari && (addOpen || addFromQuery || openFormFromQuery)

  const clearRecoltareFormQueryParams = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('add')
    nextParams.delete('openForm')
    nextParams.delete('cantitate_kg')
    nextParams.delete('parcela')
    nextParams.delete('parcela_id')
    nextParams.delete('parcela_label')
    nextParams.delete('data')
    nextParams.delete('calitate')
    nextParams.delete('culegator')
    nextParams.delete('observatii')
    const query = nextParams.toString()
    const nextUrl = query ? `${pathname}?${query}` : pathname

    if (typeof window !== 'undefined') {
      const currentUrl = `${window.location.pathname}${window.location.search}`
      if (currentUrl !== nextUrl) {
        window.history.replaceState(window.history.state, '', nextUrl)
      }
    }

    router.replace(nextUrl, { scroll: false })
  }, [pathname, router, searchParams])

  const closeAddDialog = useCallback(() => {
    setAddOpen(false)
    setAiPrefill(null)
    clearRecoltareFormQueryParams()
  }, [clearRecoltareFormQueryParams])

  const today = useMemo(() => {
    const current = new Date()
    current.setHours(0, 0, 0, 0)
    return current
  }, [])
  const todayIso = toIsoDate(today)
  const last7StartIso = toIsoDate(shiftDays(today, -6))
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
    initialData: initialParcele.length > 0 ? initialParcele : undefined,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: culegatori = [] } = useQuery({
    queryKey: queryKeys.culegatori,
    queryFn: getCulegatori,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const { data: recoltareDeleteImpact } = useQuery({
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
    if (!canWriteRecoltari) return
    const unregister = registerAddAction(() => setAddOpen(true), 'Adauga recoltare')
    return unregister
  }, [canWriteRecoltari, registerAddAction])

  useEffect(() => {
    const query = searchTerm.trim()
    if (!query) return

    const timer = setTimeout(() => {
      track('search', { module: 'recoltari', query })
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const scheduleDelete = (recoltare: Recoltare) => {
    if (!canDeleteRecoltari) {
      toast.error('Operatorii nu pot șterge recoltări.')
      return
    }
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

  const seasonParcelaChips = useMemo(() => {
    const grouped = new Map<string, { displayName: string; kgCal1: number; kgCal2: number }>()

    recoltari.forEach((recoltare) => {
      const parcelaId = recoltare.parcela_id
      const date = toDateOnly(recoltare.data)
      if (!parcelaId || !date || date < seasonStartIso || date > todayIso) return

      const parcelaMeta = parcelaMap[parcelaId]
      const displayName = parcelaMeta?.displayName || parcelaMeta?.name || 'Parcelă'
      const current = grouped.get(parcelaId) ?? { displayName, kgCal1: 0, kgCal2: 0 }

      current.kgCal1 += Number(recoltare.kg_cal1 ?? 0)
      current.kgCal2 += Number(recoltare.kg_cal2 ?? 0)
      grouped.set(parcelaId, current)
    })

    return Array.from(grouped.entries())
      .map(([parcelaId, item]) => ({
        parcelaId,
        displayName: item.displayName,
        totalKg: item.kgCal1 + item.kgCal2,
        cal1Pct: calculateCal1Pct(item.kgCal1, item.kgCal2),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ro-RO'))
  }, [parcelaMap, recoltari, seasonStartIso, todayIso])

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

  const filteredRecoltari = useMemo(() => {
    return searchFilteredRecoltari.filter((recoltare) => {
      const date = toDateOnly(recoltare.data)
      if (!date) return false

      if (timeFilter === 'azi') return date === todayIso
      return true
    })
  }, [searchFilteredRecoltari, timeFilter, todayIso])

  const totalCantitateKg = useMemo(
    () => filteredRecoltari.reduce((sum, recoltare) => sum + getRecoltareTotalKg(recoltare), 0),
    [filteredRecoltari]
  )

  const todayRows = useMemo(
    () => searchFilteredRecoltari.filter((recoltare) => toDateOnly(recoltare.data) === todayIso),
    [searchFilteredRecoltari, todayIso]
  )

  const last7Rows = useMemo(
    () =>
      searchFilteredRecoltari.filter((recoltare) => {
        const date = toDateOnly(recoltare.data)
        return date >= last7StartIso && date <= todayIso
      }),
    [searchFilteredRecoltari, last7StartIso, todayIso]
  )

  const todayTotalKg = useMemo(() => todayRows.reduce((sum, row) => sum + getRecoltareTotalKg(row), 0), [todayRows])
  const weekTotalKg = useMemo(() => last7Rows.reduce((sum, row) => sum + getRecoltareTotalKg(row), 0), [last7Rows])
  const todayCal1Kg = useMemo(() => todayRows.reduce((sum, row) => sum + Number(row.kg_cal1 ?? 0), 0), [todayRows])
  const todayCal2Kg = useMemo(() => todayRows.reduce((sum, row) => sum + Number(row.kg_cal2 ?? 0), 0), [todayRows])

  const weekSeries = useMemo(() => {
    return last7DaysIso.map((dayIso) =>
      searchFilteredRecoltari.reduce((sum, row) => {
        if (toDateOnly(row.data) !== dayIso) return sum
        return sum + getRecoltareTotalKg(row)
      }, 0)
    )
  }, [last7DaysIso, searchFilteredRecoltari])

  const shouldShowSparkline = weekSeries.filter((value) => value > 0).length >= 2

  const kpiCal1Kg = useMemo(
    () => filteredRecoltari.reduce((sum, row) => sum + Number(row.kg_cal1 ?? 0), 0),
    [filteredRecoltari],
  )
  const kpiCal2Kg = useMemo(
    () => filteredRecoltari.reduce((sum, row) => sum + Number(row.kg_cal2 ?? 0), 0),
    [filteredRecoltari],
  )
  const kpiCulegatoriImplicati = useMemo(() => {
    const ids = new Set<string>()
    filteredRecoltari.forEach((row) => {
      if (row.culegator_id) ids.add(row.culegator_id)
    })
    return ids.size
  }, [filteredRecoltari])

  const recoltariDesktopKpiItems = useMemo(() => {
    if (recoltari.length === 0) return []
    return [
      {
        icon: Scale,
        label: 'Total recoltat',
        value: formatKg(totalCantitateKg, 2),
      },
      {
        icon: CircleDot,
        label: 'Calitate CAL 1',
        value: formatKg(kpiCal1Kg, 2),
      },
      {
        icon: Layers2,
        label: 'Calitate CAL 2',
        value: formatKg(kpiCal2Kg, 2),
      },
      {
        icon: Users,
        label: 'Culegători implicați',
        value: String(kpiCulegatoriImplicati),
      },
    ]
  }, [recoltari.length, totalCantitateKg, kpiCal1Kg, kpiCal2Kg, kpiCulegatoriImplicati])

  const culegatorAggregates = useMemo(
    () =>
      aggregateRecoltariByCulegator({
        recoltari: filteredRecoltari,
        resolveWorkerName: (workerId) => (workerId ? culegatorMap[workerId]?.nume : undefined),
      }),
    [filteredRecoltari, culegatorMap],
  )

  const totalFilteredPaymentLei = useMemo(
    () => culegatorAggregates.reduce((sum, aggregate) => sum + aggregate.totalPaymentLei, 0),
    [culegatorAggregates],
  )

  const desktopSelectedAggregate =
    culegatorAggregates.find((aggregate) => aggregate.workerKey === desktopSelectedAggregateKey) ??
    culegatorAggregates[0] ??
    null

  useEffect(() => {
    if (culegatorAggregates.length === 0) {
      setDesktopSelectedAggregateKey(null)
      setExpandedAggregateKey(null)
      return
    }

    if (!desktopSelectedAggregateKey || !culegatorAggregates.some((item) => item.workerKey === desktopSelectedAggregateKey)) {
      setDesktopSelectedAggregateKey(culegatorAggregates[0].workerKey)
    }

    if (expandedAggregateKey && !culegatorAggregates.some((item) => item.workerKey === expandedAggregateKey)) {
      setExpandedAggregateKey(null)
    }
  }, [culegatorAggregates, desktopSelectedAggregateKey, expandedAggregateKey])

  const timeFilterOptions: Array<{ key: TimeFilter; label: string }> = [
    { key: 'azi', label: 'Azi' },
    { key: 'toate', label: 'Toate perioadele' },
  ]

  return (
    <AppShell
      header={<PageHeader title="Recoltări" subtitle="Evidența producției zilnice" contentVariant="workspace" />}
      bottomBar={
        <div className="md:hidden">
          <StickyActionBar>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[var(--agri-text-muted)]">
                Total: {formatKg(totalCantitateKg, 2)}
              </p>
            </div>
          </StickyActionBar>
        </div>
      }
    >
      <DashboardContentShell variant="workspace" className="mt-2 space-y-3 py-3 sm:mt-0 sm:space-y-4 sm:py-3">
        {initialError ? <ErrorState title="Eroare" message={initialError} /> : null}
        {isError && !initialError ? <ErrorState title="Eroare" message={(error as Error).message} /> : null}

        {!initialError && !isError ? (
          <>
            {/* Scoreboard compact — doar mobil */}
            {recoltari.length > 0 ? (
              <ModuleScoreboard className="items-center justify-between gap-3 border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)] md:hidden">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <span>
                      <span className="text-[22px] font-extrabold tracking-[-0.03em] text-[var(--text-primary)]">
                        {new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(todayTotalKg)}
                      </span>
                      <span className="ml-1 text-[11px] font-medium text-[var(--text-secondary)]">kg azi</span>
                    </span>
                    {weekTotalKg > 0 ? (
                      <span>
                        <span className="text-[15px] font-bold text-[var(--text-primary)]">
                          {new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(weekTotalKg)}
                        </span>
                        <span className="ml-1 text-[11px] text-[var(--text-secondary)]">săpt</span>
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                    <span className="rounded-full bg-[color:color-mix(in_srgb,var(--success-bg)_78%,var(--surface-card))] px-2.5 py-1 text-[var(--success-text)]">
                      Cal I {formatKgValue(todayCal1Kg, 1)} kg
                    </span>
                    <span className="rounded-full bg-[color:color-mix(in_srgb,var(--warning-bg)_82%,var(--surface-card))] px-2.5 py-1 text-[var(--warning-text)]">
                      Cal II {formatKgValue(todayCal2Kg, 1)} kg
                    </span>
                  </div>
                </div>
                {shouldShowSparkline ? (
                  <Sparkline data={weekSeries} color="var(--success-text)" width={48} height={18} />
                ) : null}
              </ModuleScoreboard>
            ) : null}

            <DesktopKpiStrip items={recoltariDesktopKpiItems} />

            {seasonParcelaChips.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Sezon pe parcelă</p>
                  <p className="text-xs text-[var(--text-secondary)]">Atinge o parcelă pentru filtrare</p>
                </div>
                <div className="overflow-x-auto pb-1 [scrollbar-width:none]">
                  <div className="flex min-w-max gap-2">
                    {seasonParcelaChips.map((chip) => {
                      const isActive = searchTerm.trim().toLowerCase() === chip.displayName.toLowerCase()

                      return (
                        <button
                          key={chip.parcelaId}
                          type="button"
                          onClick={() => setSearchTerm(chip.displayName)}
                          className={[
                            'shrink-0 rounded-2xl border px-3 py-2 text-left shadow-[var(--shadow-soft)] transition-[transform,box-shadow,border-color,background-color] duration-150 ease-out',
                            'active:scale-[0.985]',
                            isActive
                              ? 'border-[var(--success-text)] bg-[color:color-mix(in_srgb,var(--success-bg)_72%,var(--surface-card))]'
                              : 'border-[var(--border-default)] bg-[var(--surface-card)]'
                          ].join(' ')}
                          aria-label={`Filtrează după ${chip.displayName}`}
                        >
                          <span className="block whitespace-nowrap text-[13px] leading-snug text-[var(--text-primary)] [font-weight:650]">
                            {chip.displayName}
                          </span>
                          <span className="mt-1 block whitespace-nowrap text-[11px] leading-snug text-[var(--text-secondary)]">
                            {formatKgValue(chip.totalKg, 2)} kg · Cal I {chip.cal1Pct}%
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-3 md:hidden">
              <ModulePillRow>
                {timeFilterOptions.map((option) => (
                  <ModulePillFilterButton
                    key={option.key}
                    active={timeFilter === option.key}
                    activeStyle="minimal"
                    onClick={() => setTimeFilter(option.key)}
                  >
                    {option.label}
                  </ModulePillFilterButton>
                ))}
              </ModulePillRow>
              <SearchField
                placeholder="Caută după culegător, parcelă sau observații..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                aria-label="Caută recoltări agregate"
              />
            </div>

            <div className="hidden space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)] md:block">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <ModulePillRow>
                  {timeFilterOptions.map((option) => (
                    <ModulePillFilterButton
                      key={option.key}
                      active={timeFilter === option.key}
                      activeStyle="minimal"
                      onClick={() => setTimeFilter(option.key)}
                    >
                      {option.label}
                    </ModulePillFilterButton>
                  ))}
                </ModulePillRow>
                <div className="flex flex-shrink-0 flex-wrap items-center gap-x-2 text-sm text-[var(--text-secondary)]">
                  <span>
                    <span className="font-semibold text-[var(--text-primary)]">{formatKg(totalCantitateKg, 2)}</span>
                    <span className="ml-1 text-xs text-[var(--text-tertiary)]">în perioadă</span>
                  </span>
                  <span className="text-[var(--text-tertiary)]">·</span>
                  <span>
                    {culegatorAggregates.length} {culegatorAggregates.length === 1 ? 'culegător' : 'culegători'}
                  </span>
                  <span className="text-[var(--text-tertiary)]">·</span>
                  <span>
                    <span className="font-semibold text-[var(--text-primary)]">{formatLei(totalFilteredPaymentLei)}</span>
                    <span className="ml-1 text-xs text-[var(--text-tertiary)]">de plată</span>
                  </span>
                </div>
              </div>
              <SearchField
                containerClassName="w-full max-w-2xl"
                placeholder="Caută după culegător, parcelă sau observații..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                aria-label="Caută recoltări agregate (desktop)"
              />
            </div>
          </>
        ) : null}

        {isLoading ? <EntityListSkeleton /> : null}

        {!isLoading && !isError && !initialError && recoltari.length === 0 ? (
          <ModuleEmptyCard
            emoji="🌿"
            title="Nicio recoltare încă"
            hint="Adaugă prima recoltare pentru a începe"
            action={
              canWriteRecoltari ? (
                <Button type="button" className="agri-cta" onClick={() => setAddOpen(true)}>
                  Adaugă recoltare
                </Button>
              ) : undefined
            }
          />
        ) : null}

        {!isLoading && !isError && !initialError && recoltari.length > 0 && culegatorAggregates.length === 0 ? (
          <ModuleEmptyCard
            emoji="🫐"
            title="Nimic recoltat în perioada selectată"
            hint={timeFilter === 'azi' ? 'Recoltările de azi vor apărea aici' : 'Modifică căutarea sau revino pe Azi'}
          />
        ) : null}

        {!isLoading && !isError && !initialError && culegatorAggregates.length > 0 ? (
          <>
            <div className="space-y-3 md:hidden">
              {culegatorAggregates.map((aggregate) => (
                <RecoltareAggregateCard
                  key={aggregate.workerKey}
                  aggregate={aggregate}
                  expanded={expandedAggregateKey === aggregate.workerKey}
                  parcelaMap={parcelaMap}
                  onToggle={() =>
                    setExpandedAggregateKey((current) => (current === aggregate.workerKey ? null : aggregate.workerKey))
                  }
                  onViewHarvest={(recoltare) => setViewingRecoltare(recoltare)}
                />
              ))}
            </div>

            <div className="hidden md:block">
              <DesktopSplitPane
                master={
                  <div className="space-y-3">
                    {culegatorAggregates.map((aggregate) => (
                      <RecoltareAggregateCard
                        key={aggregate.workerKey}
                        aggregate={aggregate}
                        selected={desktopSelectedAggregate?.workerKey === aggregate.workerKey}
                        showInlineDetails={false}
                        parcelaMap={parcelaMap}
                        onToggle={() => setDesktopSelectedAggregateKey(aggregate.workerKey)}
                        onViewHarvest={(recoltare) => setViewingRecoltare(recoltare)}
                      />
                    ))}
                  </div>
                }
                detail={
                  <DesktopInspectorPanel
                    title={desktopSelectedAggregate ? desktopSelectedAggregate.workerName : 'Detalii culegător'}
                    description={
                      desktopSelectedAggregate
                        ? `${formatHarvestCount(desktopSelectedAggregate.harvestCount)} în ${timeFilter === 'azi' ? 'azi' : 'toată perioada'}`
                        : undefined
                    }
                  >
                    {desktopSelectedAggregate ? (
                      <>
                        <DesktopInspectorSection label="Sumar">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
                              <p className="text-xs text-[var(--text-secondary)]">Total</p>
                              <p className="mt-1 text-base text-[var(--text-primary)] [font-weight:700]">
                                {formatKg(desktopSelectedAggregate.totalKg, 2)}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-[color:color-mix(in_srgb,var(--success-bg)_78%,var(--surface-card))] p-3">
                              <p className="text-xs text-[var(--text-secondary)]">De plătit</p>
                              <p className="mt-1 text-base text-[var(--success-text)] [font-weight:700]">
                                {formatLei(desktopSelectedAggregate.totalPaymentLei)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                            <span>Cal I {formatKg(desktopSelectedAggregate.totalCal1Kg, 2)}</span>
                            <span>Cal II {formatKg(desktopSelectedAggregate.totalCal2Kg, 2)}</span>
                            {formatAggregateRate(desktopSelectedAggregate) ? (
                              <span>{formatAggregateRate(desktopSelectedAggregate)}</span>
                            ) : null}
                          </div>
                        </DesktopInspectorSection>

                        <DesktopInspectorSection label="Recoltări individuale">
                          <div className="space-y-2">
                            {desktopSelectedAggregate.harvests.map((recoltare) => {
                              const parcelaMeta = recoltare.parcela_id ? parcelaMap[recoltare.parcela_id] : undefined
                              const selectedCrop = getHarvestCropSelection(recoltare.observatii)
                              const visibleObservatii = stripHiddenAgricultureMetadata(recoltare.observatii)

                              return (
                                <button
                                  key={recoltare.id}
                                  type="button"
                                  onClick={() => setViewingRecoltare(recoltare)}
                                  className="w-full rounded-2xl bg-[var(--surface-muted)] p-3 text-left transition-transform duration-150 ease-out hover:translate-y-[-1px]"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm text-[var(--text-primary)] [font-weight:650]">
                                        {parcelaMeta?.displayName || parcelaMeta?.name || 'Parcelă'}
                                      </p>
                                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{formatTableDate(recoltare.data)}</p>
                                      {selectedCrop ? (
                                        <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]">
                                          {[selectedCrop.culture, selectedCrop.variety].filter(Boolean).join(' · ')}
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm text-[var(--text-primary)] [font-weight:700]">
                                        {formatKgValue(getRecoltareTotalKg(recoltare), 2)} kg
                                      </p>
                                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                        {formatRatePerKg(Number(recoltare.pret_lei_pe_kg_snapshot ?? 0))}
                                      </p>
                                      <p className="mt-1 text-xs text-[var(--success-text)] [font-weight:650]">
                                        {formatLei(Number(recoltare.valoare_munca_lei ?? 0))}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--text-secondary)]">
                                    <span>Cal I {formatKgValue(Number(recoltare.kg_cal1 ?? 0), 2)} kg</span>
                                    <span>Cal II {formatKgValue(Number(recoltare.kg_cal2 ?? 0), 2)} kg</span>
                                  </div>
                                  {visibleObservatii.trim() ? (
                                    <p className="mt-2 line-clamp-2 text-xs text-[var(--text-tertiary)]">{visibleObservatii}</p>
                                  ) : null}
                                </button>
                              )
                            })}
                          </div>
                        </DesktopInspectorSection>
                      </>
                    ) : (
                      <p className="text-sm text-[var(--text-secondary)]">
                        Selectează un culegător pentru a vedea recoltările din agregare.
                      </p>
                    )}
                  </DesktopInspectorPanel>
                }
              />
            </div>
          </>
        ) : null}
      </DashboardContentShell>

      <ViewRecoltareDialog
        open={Boolean(viewingRecoltare)}
        onOpenChange={(open) => {
          if (!open) setViewingRecoltare(null)
        }}
        recoltare={viewingRecoltare}
        parcelaNume={viewingRecoltare?.parcela_id ? parcelaMap[viewingRecoltare.parcela_id]?.name : undefined}
        parcelaTip={viewingRecoltare?.parcela_id ? parcelaMap[viewingRecoltare.parcela_id]?.tipLabel : undefined}
        culegatorNume={
          viewingRecoltare?.culegator_id ? culegatorMap[viewingRecoltare.culegator_id]?.nume : undefined
        }
        onEdit={(recoltare) => {
          if (!canWriteRecoltari) return
          setViewingRecoltare(null)
          setEditingRecoltare(recoltare)
        }}
        onDelete={(recoltare) => {
          if (!canDeleteRecoltari) return
          setViewingRecoltare(null)
          setDeletingRecoltare(recoltare)
        }}
        readOnlyActions={!canWriteRecoltari}
        hideDelete={!canDeleteRecoltari}
      />

      <AddRecoltareDialog
        open={canWriteRecoltari && isAddDialogOpen}
        onOpenChange={(open) => {
          if (!canWriteRecoltari) return
          if (!open) {
            closeAddDialog()
            return
          }
          setAddOpen(true)
        }}
        aiPrefill={resolvedAiPrefill}
        onSuccessfulSave={closeAddDialog}
        hideTrigger
      />

      <EditRecoltareDialog
        recoltare={editingRecoltare}
        open={canWriteRecoltari && !!editingRecoltare}
        onOpenChange={(open) => {
          if (!canWriteRecoltari) return
          if (!open) setEditingRecoltare(null)
        }}
      />

      <DeleteConfirmDialog
        open={canDeleteRecoltari && !!deletingRecoltare}
        onOpenChange={(open) => {
          if (!open) setDeletingRecoltare(null)
        }}
        onConfirm={() => {
          if (!deletingRecoltare) return
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
          recoltareDeleteImpact?.hasDownstreamSales
            ? 'Această recoltare are vânzări asociate și nu poate fi ștearsă.'
            : recoltareDeleteImpact?.hasStock
              ? `Ștergerea va elimina și ${formatKg(recoltareDeleteImpact.stockToRemoveKg)} din stoc.`
              : undefined
        }
      />
    </AppShell>
  )
}


