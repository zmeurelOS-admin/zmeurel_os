'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { SearchField } from '@/components/ui/SearchField'
import Sparkline from '@/components/ui/Sparkline'
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

function getRecoltareKg(recoltare: Recoltare): number {
  return Number(recoltare.kg_cal1 ?? 0) + Number(recoltare.kg_cal2 ?? 0)
}

function formatKg(value: number, digits = 2): string {
  return `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: digits }).format(value)} kg`
}

function formatTimeFromTs(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
}

function sanitizeObservatiiForDisplay(value: string | null | undefined): string {
  return (value ?? '').replace(/\[zmeurel:harvest-crop\][\s\S]*?\[\/zmeurel:harvest-crop\]/g, '').trim()
}

function RecoltareCardNew({
  recoltare,
  parcelaNume,
  parcelaSoi,
  culegatorNume,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
}: {
  recoltare: Recoltare
  parcelaNume: string | undefined
  parcelaSoi: string | undefined
  culegatorNume: string | undefined
  isExpanded: boolean
  onToggle: (id: string) => void
  onEdit: (recoltare: Recoltare) => void
  onDelete: (recoltare: Recoltare) => void
}) {
  const kg = getRecoltareKg(recoltare)
  const cal1 = Number(recoltare.kg_cal1 ?? 0)
  const cal2 = Number(recoltare.kg_cal2 ?? 0)
  const cal1Pct = kg > 0 ? Math.round((cal1 / kg) * 100) : 0
  const ora = formatTimeFromTs(recoltare.created_at)
  const observatiiDisplay = sanitizeObservatiiForDisplay(recoltare.observatii)

  return (
    <div
      className="w-full"
      role="button"
      tabIndex={0}
      onClick={() => onToggle(recoltare.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(recoltare.id) }
      }}
      style={{
        background: 'var(--agri-surface)',
        borderRadius: 14,
        border: isExpanded ? '1.5px solid var(--soft-success-border)' : '1px solid var(--agri-border)',
        boxShadow: isExpanded ? 'var(--shadow-card-raised)' : 'var(--shadow-card-soft)',
        padding: '11px 14px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Summary row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--agri-text)', lineHeight: 1.3 }}>
            {parcelaNume || 'Parcelă'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--agri-text-muted)', marginTop: 3 }}>
            {[parcelaSoi, culegatorNume].filter(Boolean).join(' · ') || '-'}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--agri-text)' }}>
            {new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(kg)}
          </span>
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-hint)', marginLeft: 2 }}>kg</span>
        </div>
      </div>

      {/* Drag indicator */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <div style={{ width: 22, height: 2.5, borderRadius: 2, background: 'var(--text-hint)', opacity: 0.35 }} />
      </div>

      {/* Expanded section */}
      {isExpanded ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ borderTop: '1px solid var(--surface-divider)', paddingTop: 10, marginTop: 10 }}
        >
          {/* Details */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, marginBottom: 10 }}>
            <span><span style={{ color: 'var(--agri-text-muted)' }}>Cal I: </span><strong style={{ color: 'var(--value-positive)' }}>{cal1.toFixed(2)} kg</strong></span>
            <span><span style={{ color: 'var(--agri-text-muted)' }}>Cal II: </span><strong style={{ color: 'var(--status-warning-text)' }}>{cal2.toFixed(2)} kg</strong></span>
            <span><span style={{ color: 'var(--agri-text-muted)' }}>Ora: </span><strong>{ora}</strong></span>
            {culegatorNume ? <span><span style={{ color: 'var(--agri-text-muted)' }}>Culegător: </span><strong>{culegatorNume}</strong></span> : null}
            {observatiiDisplay ? <span><span style={{ color: 'var(--agri-text-muted)' }}>Obs: </span><strong>{observatiiDisplay}</strong></span> : null}
          </div>

          {/* Quality bar */}
          {kg > 0 ? (
            <div style={{ display: 'flex', gap: 2, height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--agri-surface-muted)', marginBottom: 10 }}>
              <div style={{ width: `${cal1Pct}%`, background: 'var(--value-positive)' }} />
              <div style={{ width: `${100 - cal1Pct}%`, background: 'var(--status-warning-text)' }} />
            </div>
          ) : null}

          {/* Edit / Delete */}
          <div style={{ borderTop: '1px solid var(--surface-divider)', paddingTop: 10, display: 'flex', justifyContent: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(recoltare) }}
              style={{ padding: '6px 14px', fontSize: 10, fontWeight: 600, background: 'var(--button-muted-bg)', color: 'var(--button-muted-text)', border: '1px solid var(--button-muted-border)', borderRadius: 8, cursor: 'pointer' }}
            >
              ✏️ Editează
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(recoltare) }}
              style={{ padding: '6px 14px', fontSize: 10, fontWeight: 600, background: 'var(--status-danger-bg)', color: 'var(--status-danger-text)', border: '1px solid var(--status-danger-border)', borderRadius: 8, cursor: 'pointer' }}
            >
              🗑️ Șterge
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
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
  const deleteMutateRef = useRef<(id: string) => void>(() => {})

  const [searchTerm, setSearchTerm] = useState('')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('sezon')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [aiPrefill, setAiPrefill] = useState<{ parcela_id: string; parcela_label: string; cantitate_kg: string; data: string; observatii: string } | null>(null)
  const [editingRecoltare, setEditingRecoltare] = useState<Recoltare | null>(null)
  const [deletingRecoltare, setDeletingRecoltare] = useState<Recoltare | null>(null)

  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const addFromQuery = searchParams.get('add') === '1'
  const openFormFromQuery = hasAiOpenForm(searchParams)

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
    if (!addFromQuery) return
    clearRecoltareFormQueryParams()
    setAddOpen(true)
  }, [addFromQuery, clearRecoltareFormQueryParams])

  useEffect(() => {
    if (!openFormFromQuery) return
    setAiPrefill(parseAiRecoltarePrefill(searchParams))
    clearRecoltareFormQueryParams()
    setAddOpen(true)
  }, [clearRecoltareFormQueryParams, openFormFromQuery, searchParams])

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

  const totalCantitateKg = useMemo(
    () => filteredRecoltari.reduce((sum, recoltare) => sum + getRecoltareKg(recoltare), 0),
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

  const todayTotalKg = useMemo(() => todayRows.reduce((sum, row) => sum + getRecoltareKg(row), 0), [todayRows])
  const weekTotalKg = useMemo(() => last7Rows.reduce((sum, row) => sum + getRecoltareKg(row), 0), [last7Rows])

  const weekSeries = useMemo(() => {
    return last7DaysIso.map((dayIso) =>
      searchFilteredRecoltari.reduce((sum, row) => {
        if (toDateOnly(row.data) !== dayIso) return sum
        return sum + getRecoltareKg(row)
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
        <StickyActionBar>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--agri-text-muted)]">Total: {formatKg(totalCantitateKg, 2)}</p>
          </div>
        </StickyActionBar>
      }
    >
      <div className="mx-auto mt-3 w-full max-w-7xl space-y-3 py-3 sm:mt-0 sm:space-y-4 sm:py-4">
        {initialError ? <ErrorState title="Eroare" message={initialError} /> : null}
        {isError && !initialError ? <ErrorState title="Eroare" message={(error as Error).message} /> : null}

        {!initialError && !isError ? (
          <>
            {/* Scoreboard compact */}
            {recoltari.length > 0 ? (
              <div
                style={{
                  background: 'var(--agri-surface)',
                  borderRadius: 12,
                  padding: '10px 14px',
                  border: '1px solid var(--agri-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--agri-text)', letterSpacing: '-0.03em' }}>
                      {new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(todayTotalKg)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-hint)', marginLeft: 4, fontWeight: 500 }}>kg azi</span>
                  </span>
                  {weekTotalKg > 0 ? (
                    <span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--button-muted-text)' }}>
                        {new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(weekTotalKg)}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--agri-text-muted)', marginLeft: 3 }}>săpt</span>
                    </span>
                  ) : null}
                  {calitatiSummary.cal1Pct > 0 ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--value-positive)' }}>
                      Cal I {calitatiSummary.cal1Pct}%
                    </span>
                  ) : null}
                </div>
                {shouldShowSparkline ? (
                  <Sparkline data={weekSeries} color="var(--value-positive)" width={48} height={18} />
                ) : null}
              </div>
            ) : null}

            {/* Pills time filter */}
            <div style={{ display: 'flex', gap: 6 }}>
              {timeFilterOptions.map((option) => {
                const active = timeFilter === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setTimeFilter(option.key)}
                    style={{
                      padding: '6px 14px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 20,
                      border: `1px solid ${active ? 'var(--pill-active-border)' : 'var(--pill-inactive-border)'}`,
                      background: active ? 'var(--pill-active-bg)' : 'var(--pill-inactive-bg)',
                      color: active ? 'var(--pill-active-text)' : 'var(--pill-inactive-text)',
                      cursor: 'pointer',
                    }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            {/* Search */}
            <SearchField
              placeholder="Caută după parcelă, soi, culegător sau observații..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Caută recoltări"
            />
          </>
        ) : null}

        {isLoading ? (
          <>
            <div className="overflow-hidden rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] sm:hidden">
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
          <EmptyState
            icon={<Leaf className="h-16 w-16" />}
            title="Nicio recoltare încă"
            description="Adaugă prima recoltare pentru a începe"
          />
        ) : null}

        {!isLoading && !isError && !initialError && recoltari.length > 0 && filteredRecoltari.length === 0 ? (
          <div style={{ borderRadius: 12, background: 'var(--agri-surface)', border: '1px solid var(--agri-border)', padding: '20px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🫐</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--agri-text)', marginBottom: 4 }}>
              {timeFilter === 'azi' ? 'Nicio recoltare azi' : 'Nicio recoltare pentru filtrul selectat'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-hint)' }}>
              {timeFilter === 'azi' ? 'Recoltările de azi vor apărea aici' : 'Modifică filtrul de timp sau căutarea'}
            </div>
          </div>
        ) : null}

        {!isLoading && !isError && !initialError && filteredRecoltari.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecoltari.map((recoltare) => {
              const parcelaMeta = recoltare.parcela_id ? parcelaMap[recoltare.parcela_id] : undefined
              return (
                <RecoltareCardNew
                  key={recoltare.id}
                  recoltare={recoltare}
                  parcelaNume={parcelaMeta?.name}
                  parcelaSoi={parcelaMeta?.soi}
                  culegatorNume={recoltare.culegator_id ? culegatorMap[recoltare.culegator_id]?.nume : undefined}
                  isExpanded={expandedId === recoltare.id}
                  onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
                  onEdit={setEditingRecoltare}
                  onDelete={setDeletingRecoltare}
                />
              )
            })}
          </div>
        ) : null}
      </div>

      <AddRecoltareDialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeAddDialog()
            return
          }
          setAddOpen(true)
        }}
        aiPrefill={aiPrefill}
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


