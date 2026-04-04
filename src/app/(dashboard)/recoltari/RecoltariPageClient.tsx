'use client'

import dynamic from 'next/dynamic'
import type { ColumnDef } from '@tanstack/react-table'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
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
import Sparkline from '@/components/ui/Sparkline'
import StatusBadge from '@/components/ui/StatusBadge'
import { ViewRecoltareDialog } from '@/components/recoltari/ViewRecoltareDialog'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import { getHarvestCropSelection, stripHiddenAgricultureMetadata } from '@/lib/parcele/crop-config'
import { formatUnitateDisplayName, getUnitateTipLabel } from '@/lib/parcele/unitate'
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

type TimeFilter = 'azi' | 'saptamana' | 'luna' | 'sezon'

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

function formatLei(value: number): string {
  return `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(value)} lei`
}

function formatTableDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value.slice(0, 10))
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('ro-RO')
}

function relativeHarvestDateLabel(daysAgo: number | null): string {
  if (daysAgo === null) return '-'
  if (daysAgo === 0) return 'azi'
  if (daysAgo === 1) return 'ieri'
  return `acum ${daysAgo} zile`
}

export function RecoltariPageClient({
  parcele: initialParcele = [],
  initialError = null,
}: RecoltariPageClientProps) {
  useTrackModuleView('recoltari')
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: Recoltare; index: number }>>({})
  const deleteMutateRef = useRef<(id: string) => void>(() => {})

  const [searchTerm, setSearchTerm] = useState('')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('sezon')
  const [addOpen, setAddOpen] = useState(false)
  const [aiPrefill, setAiPrefill] = useState<{ parcela_id: string; parcela_label: string; cantitate_kg: string; data: string; observatii: string } | null>(null)
  const [editingRecoltare, setEditingRecoltare] = useState<Recoltare | null>(null)
  const [deletingRecoltare, setDeletingRecoltare] = useState<Recoltare | null>(null)
  const [viewingRecoltare, setViewingRecoltare] = useState<Recoltare | null>(null)
  const [desktopSelectedRecoltareId, setDesktopSelectedRecoltareId] = useState<string | null>(null)

  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const addFromQuery = searchParams.get('add') === '1'
  const openFormFromQuery = hasAiOpenForm(searchParams)
  const queryAiPrefill = useMemo(
    () => (openFormFromQuery ? parseAiRecoltarePrefill(searchParams) : null),
    [openFormFromQuery, searchParams]
  )
  const resolvedAiPrefill = openFormFromQuery ? queryAiPrefill : aiPrefill
  const isAddDialogOpen = addOpen || addFromQuery || openFormFromQuery

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
      if (timeFilter === 'saptamana') return date >= last7StartIso && date <= todayIso
      if (timeFilter === 'luna') return date >= monthStartIso && date <= todayIso
      return date >= seasonStartIso && date <= todayIso
    })
  }, [searchFilteredRecoltari, timeFilter, todayIso, last7StartIso, monthStartIso, seasonStartIso])

  const desktopSelectedRecoltare =
    filteredRecoltari.find((r) => r.id === desktopSelectedRecoltareId) ?? filteredRecoltari[0] ?? null

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

  const weekSeries = useMemo(() => {
    return last7DaysIso.map((dayIso) =>
      searchFilteredRecoltari.reduce((sum, row) => {
        if (toDateOnly(row.data) !== dayIso) return sum
        return sum + getRecoltareTotalKg(row)
      }, 0)
    )
  }, [last7DaysIso, searchFilteredRecoltari])

  const shouldShowSparkline = weekSeries.filter((value) => value > 0).length >= 2

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

  const desktopColumns = useMemo<ColumnDef<Recoltare>[]>(() => {
    return [
      {
        id: 'data',
        header: 'Data',
        accessorFn: (row) => row.data,
        cell: ({ row }) => formatTableDate(row.original.data),
        meta: {
          searchValue: (row: Recoltare) => formatTableDate(row.data),
        },
      },
      {
        id: 'parcela',
        header: 'Parcelă / teren',
        accessorFn: (row) => {
          const meta = row.parcela_id ? parcelaMap[row.parcela_id] : undefined
          return meta?.displayName || meta?.name || ''
        },
        cell: ({ row }) => {
          const meta = row.original.parcela_id ? parcelaMap[row.original.parcela_id] : undefined
          return <span className="font-medium">{meta?.displayName || meta?.name || '—'}</span>
        },
        meta: {
          searchValue: (row: Recoltare) => {
            const m = row.parcela_id ? parcelaMap[row.parcela_id] : undefined
            return [m?.displayName, m?.name, m?.soi, m?.tipLabel].filter(Boolean).join(' ')
          },
        },
      },
      {
        id: 'culegator',
        header: 'Culegător',
        accessorFn: (row) => (row.culegator_id ? culegatorMap[row.culegator_id]?.nume ?? '' : ''),
        cell: ({ row }) =>
          row.original.culegator_id ? culegatorMap[row.original.culegator_id]?.nume ?? '—' : '—',
        meta: {
          searchValue: (row: Recoltare) =>
            row.culegator_id ? culegatorMap[row.culegator_id]?.nume ?? '' : '',
        },
      },
      {
        accessorKey: 'kg_cal1',
        header: 'Cal I',
        cell: ({ row }) =>
          new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(
            Number(row.original.kg_cal1 ?? 0),
          ),
        meta: {
          searchValue: (row: Recoltare) => row.kg_cal1,
          numeric: true,
        },
      },
      {
        accessorKey: 'kg_cal2',
        header: 'Cal II',
        cell: ({ row }) =>
          new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(
            Number(row.original.kg_cal2 ?? 0),
          ),
        meta: {
          searchValue: (row: Recoltare) => row.kg_cal2,
          numeric: true,
        },
      },
      {
        id: 'total_kg',
        header: 'Total',
        accessorFn: (row) => getRecoltareTotalKg(row),
        cell: ({ row }) => (
          <span className="font-semibold">
            {new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(
              getRecoltareTotalKg(row.original),
            )}{' '}
            kg
          </span>
        ),
        meta: {
          searchValue: (row: Recoltare) => getRecoltareTotalKg(row),
          numeric: true,
        },
      },
    ]
  }, [parcelaMap, culegatorMap])

  const timeFilterOptions: Array<{ key: TimeFilter; label: string }> = [
    { key: 'azi', label: 'Azi' },
    { key: 'saptamana', label: 'Săpt.' },
    { key: 'luna', label: 'Lună' },
    { key: 'sezon', label: 'Sezon' },
  ]

  return (
    <AppShell
      header={<PageHeader title="Recoltări" subtitle="Evidența producției zilnice" />}
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
      <div className="mx-auto mt-2 w-full max-w-7xl space-y-3 py-3 sm:mt-0 sm:space-y-4 sm:py-3">
        {initialError ? <ErrorState title="Eroare" message={initialError} /> : null}
        {isError && !initialError ? <ErrorState title="Eroare" message={(error as Error).message} /> : null}

        {!initialError && !isError ? (
          <>
            {/* Scoreboard compact */}
            {recoltari.length > 0 ? (
              <ModuleScoreboard className="items-center justify-between gap-3">
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <span>
                    <span className="text-[22px] font-extrabold tracking-[-0.03em] text-[var(--agri-text)]">
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
                  {calitatiSummary.cal1Pct > 0 ? (
                    <span className="text-[11px] font-bold text-[var(--success-text)]">
                      Cal I {calitatiSummary.cal1Pct}%
                    </span>
                  ) : null}
                </div>
                {shouldShowSparkline ? (
                  <Sparkline data={weekSeries} color="var(--success-text)" width={48} height={18} />
                ) : null}
              </ModuleScoreboard>
            ) : null}

            <ModulePillRow>
              {timeFilterOptions.map((option) => (
                <ModulePillFilterButton
                  key={option.key}
                  active={timeFilter === option.key}
                  onClick={() => setTimeFilter(option.key)}
                >
                  {option.label}
                </ModulePillFilterButton>
              ))}
            </ModulePillRow>

            {/* Search mobil */}
            <SearchField
              containerClassName="md:hidden"
              placeholder="Caută după parcelă, soi, culegător sau observații..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Caută recoltări"
            />

            <DesktopToolbar
              className="hidden md:flex"
              trailing={
                <div className="flex flex-wrap items-center justify-end gap-x-2 text-sm text-[var(--text-secondary)]">
                  <span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {formatKg(totalCantitateKg, 2)}
                    </span>
                    <span className="ml-1 text-xs text-[var(--text-tertiary)]">în filtru</span>
                  </span>
                  <span className="text-[var(--text-tertiary)]">·</span>
                  <span>
                    {filteredRecoltari.length}{' '}
                    {filteredRecoltari.length === 1 ? 'recoltare' : 'recoltări'}
                  </span>
                </div>
              }
            >
              <SearchField
                containerClassName="w-full max-w-md min-w-[200px]"
                placeholder="Caută după parcelă, soi, culegător sau observații..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                aria-label="Caută recoltări (desktop)"
              />
            </DesktopToolbar>
          </>
        ) : null}

        {isLoading ? <EntityListSkeleton /> : null}

        {!isLoading && !isError && !initialError && recoltari.length === 0 ? (
          <ModuleEmptyCard
            emoji="🌿"
            title="Nicio recoltare încă"
            hint="Adaugă prima recoltare pentru a începe"
          />
        ) : null}

        {!isLoading && !isError && !initialError && recoltari.length > 0 && filteredRecoltari.length === 0 ? (
          <ModuleEmptyCard
            emoji="🫐"
            title={timeFilter === 'azi' ? 'Nicio recoltare azi' : 'Nicio recoltare pentru filtrul selectat'}
            hint={timeFilter === 'azi' ? 'Recoltările de azi vor apărea aici' : 'Modifică filtrul de timp sau căutarea'}
          />
        ) : null}

        {!isLoading && !isError && !initialError && filteredRecoltari.length > 0 ? (
          <DesktopSplitPane
            master={
              <ResponsiveDataView
                columns={desktopColumns}
                data={filteredRecoltari}
                getRowId={(row) => row.id}
                mobileContainerClassName="grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
                searchPlaceholder="Caută în recoltări..."
                emptyMessage="Nu am găsit recoltări pentru filtrele curente."
                desktopContainerClassName="md:min-w-0"
                skipDesktopDataFilter
                hideDesktopSearchRow
                onDesktopRowClick={(row) => setDesktopSelectedRecoltareId(row.id)}
                isDesktopRowSelected={(row) => desktopSelectedRecoltare?.id === row.id}
                renderCard={(recoltare) => {
                  const parcelaMeta = recoltare.parcela_id ? parcelaMap[recoltare.parcela_id] : undefined
                  const parcelaName = parcelaMeta?.displayName || parcelaMeta?.name || 'Parcelă'
                  const soiName = parcelaMeta?.soi || 'Soi'
                  const kg = getRecoltareTotalKg(recoltare)
                  const cal1 = Number(recoltare.kg_cal1 ?? 0)
                  const cal2 = Number(recoltare.kg_cal2 ?? 0)
                  const dateOnly = toDateOnly(recoltare.data)
                  const parsed = dateOnly ? new Date(dateOnly) : null
                  const daysAgo =
                    parsed && !Number.isNaN(parsed.getTime())
                      ? Math.floor(
                          (today.getTime() -
                            new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime()) /
                            (1000 * 60 * 60 * 24),
                        )
                      : null

                  const qualityBreakdown =
                    [
                      cal1 > 0
                        ? `Cal1 ${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(cal1)}`
                        : null,
                      cal2 > 0
                        ? `Cal2 ${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(cal2)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || undefined

                  const culegatorName = recoltare.culegator_id
                    ? culegatorMap[recoltare.culegator_id]?.nume
                    : undefined
                  const subtitle = dateOnly ? new Date(dateOnly).toLocaleDateString('ro-RO') : '-'
                  const meta =
                    [soiName !== 'Soi' ? soiName : null, culegatorName ? `Culegător: ${culegatorName}` : null]
                      .filter(Boolean)
                      .join(' • ') || undefined

                  return (
                    <MobileEntityCard
                      title={parcelaName}
                      mainValue={`${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(kg)} kg`}
                      subtitle={subtitle}
                      secondaryValue={qualityBreakdown}
                      meta={meta}
                      statusLabel={relativeHarvestDateLabel(daysAgo)}
                      statusTone={daysAgo === 0 ? 'success' : daysAgo === 1 ? 'warning' : 'neutral'}
                      showChevron
                      onClick={() => setViewingRecoltare(recoltare)}
                    />
                  )
                }}
              />
            }
            detail={
              <DesktopInspectorPanel
                title="Detalii recoltare"
                description={
                  desktopSelectedRecoltare
                    ? `ID ${desktopSelectedRecoltare.id_recoltare || desktopSelectedRecoltare.id.slice(0, 8)}`
                    : undefined
                }
                footer={
                  desktopSelectedRecoltare ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="agri-cta"
                        onClick={() => setEditingRecoltare(desktopSelectedRecoltare)}
                      >
                        Editează
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="agri-cta"
                        onClick={() => setDeletingRecoltare(desktopSelectedRecoltare)}
                      >
                        Șterge
                      </Button>
                    </div>
                  ) : null
                }
              >
                {desktopSelectedRecoltare ? (
                  (() => {
                    const sel = desktopSelectedRecoltare
                    const parcelaMeta = sel.parcela_id ? parcelaMap[sel.parcela_id] : undefined
                    const dateOnly = toDateOnly(sel.data)
                    const parsed = dateOnly ? new Date(dateOnly) : null
                    const daysAgo =
                      parsed && !Number.isNaN(parsed.getTime())
                        ? Math.floor(
                            (today.getTime() -
                              new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime()) /
                              (1000 * 60 * 60 * 24),
                          )
                        : null
                    const kgCal1 = Number(sel.kg_cal1 || 0)
                    const kgCal2 = Number(sel.kg_cal2 || 0)
                    const totalKg = kgCal1 + kgCal2
                    const selectedCrop = getHarvestCropSelection(sel.observatii)
                    const visibleObservatii = stripHiddenAgricultureMetadata(sel.observatii)
                    const culegNume = sel.culegator_id ? culegatorMap[sel.culegator_id]?.nume : undefined
                    const tarif = sel.culegator_id ? culegatorMap[sel.culegator_id]?.tarif : undefined

                    return (
                      <>
                        <DesktopInspectorSection label="Sumar">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge
                              text={relativeHarvestDateLabel(daysAgo)}
                              variant={
                                daysAgo === 0 ? 'success' : daysAgo === 1 ? 'warning' : 'neutral'
                              }
                            />
                            <span className="text-xs text-[var(--text-tertiary)]">
                              {formatTableDate(sel.data)}
                            </span>
                          </div>
                        </DesktopInspectorSection>
                        <DesktopInspectorSection label="Parcelă / context">
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Denumire: </span>
                            {parcelaMeta?.displayName || parcelaMeta?.name || 'Nespecificată'}
                          </p>
                          {parcelaMeta?.tipLabel ? (
                            <p>
                              <span className="font-medium text-[var(--text-primary)]">Tip: </span>
                              {parcelaMeta.tipLabel}
                            </p>
                          ) : null}
                          {parcelaMeta?.soi && parcelaMeta.soi !== 'Soi' ? (
                            <p>
                              <span className="font-medium text-[var(--text-primary)]">Soi / cultură: </span>
                              {parcelaMeta.soi}
                            </p>
                          ) : null}
                          {selectedCrop ? (
                            <p>
                              <span className="font-medium text-[var(--text-primary)]">Produs recoltat: </span>
                              {[selectedCrop.culture, selectedCrop.variety].filter(Boolean).join(' · ') ||
                                '—'}
                            </p>
                          ) : null}
                        </DesktopInspectorSection>
                        <DesktopInspectorSection label="Cantități">
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Cal. I: </span>
                            {formatKg(kgCal1, 2)}
                          </p>
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Cal. II: </span>
                            {formatKg(kgCal2, 2)}
                          </p>
                          <p className="text-base font-semibold text-[var(--text-primary)]">
                            <span className="font-medium">Total: </span>
                            {formatKg(totalKg, 2)}
                          </p>
                        </DesktopInspectorSection>
                        <DesktopInspectorSection label="Operator / plată">
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Culegător: </span>
                            {culegNume || '—'}
                          </p>
                          {tarif != null && tarif > 0 ? (
                            <p className="text-xs text-[var(--text-tertiary)]">
                              Tarif referință: {formatLei(tarif)} / kg
                            </p>
                          ) : null}
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Preț/kg (snapshot): </span>
                            {formatLei(Number(sel.pret_lei_pe_kg_snapshot || 0))}
                          </p>
                          <p>
                            <span className="font-medium text-[var(--text-primary)]">Valoare muncă: </span>
                            {formatLei(Number(sel.valoare_munca_lei || 0))}
                          </p>
                        </DesktopInspectorSection>
                        {visibleObservatii.trim() ? (
                          <DesktopInspectorSection label="Observații">
                            <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                              {visibleObservatii}
                            </p>
                          </DesktopInspectorSection>
                        ) : null}
                      </>
                    )
                  })()
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">
                    Selectează o recoltare din listă pentru a vedea detaliile.
                  </p>
                )}
              </DesktopInspectorPanel>
            }
          />
        ) : null}
      </div>

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
          setViewingRecoltare(null)
          setEditingRecoltare(recoltare)
        }}
        onDelete={(recoltare) => {
          setViewingRecoltare(null)
          setDeletingRecoltare(recoltare)
        }}
      />

      <AddRecoltareDialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
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


