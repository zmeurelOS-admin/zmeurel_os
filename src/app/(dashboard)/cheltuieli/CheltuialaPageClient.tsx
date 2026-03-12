'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Receipt } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/lib/ui/toast'

import { AppShell } from '@/components/app/AppShell'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { ErrorState } from '@/components/app/ErrorState'
import { ListSkeletonCard, ListSkeletonRow } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import { useMobileScrollRestore } from '@/components/app/useMobileScrollRestore'
import { AddCheltuialaDialog } from '@/components/cheltuieli/AddCheltuialaDialog'
import { CheltuialaCard, getCheltuialaCategoryEmoji } from '@/components/cheltuieli/CheltuialaCard'
import { EditCheltuialaDialog } from '@/components/cheltuieli/EditCheltuialaDialog'
import { ViewCheltuialaDialog } from '@/components/cheltuieli/ViewCheltuialaDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import Sparkline from '@/components/ui/Sparkline'
import TrendBadge from '@/components/ui/TrendBadge'
import { SearchField } from '@/components/ui/SearchField'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { useAddAction } from '@/contexts/AddActionContext'
import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import { captureReactError } from '@/lib/monitoring/sentry'
import { createCheltuiala, deleteCheltuiala, getCheltuieli, updateCheltuiala, type Cheltuiala } from '@/lib/supabase/queries/cheltuieli'
import { isAutoManoperaCheltuiala } from '@/lib/supabase/queries/manopera-auto'
import { buildCheltuialaDeleteLabel } from '@/lib/ui/delete-labels'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { queryKeys } from '@/lib/query-keys'

interface CheltuialaFormData {
  client_sync_id?: string
  data: string
  categorie: string
  suma_lei: number | string
  furnizor?: string
  descriere?: string
}

interface CheltuialaPageClientProps {
  initialCheltuieli: Cheltuiala[]
}

type TemporalFilter = 'azi' | 'sapt' | 'luna' | 'sezon' | 'toate'

function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function toDateOnly(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10)
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

function getStartOfSeason(value: Date): Date {
  const date = new Date(value.getFullYear(), 0, 1)
  date.setHours(0, 0, 0, 0)
  return date
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isSchemaCacheError(error: unknown): boolean {
  const message = String((error as { message?: string })?.message ?? '').toLowerCase()
  return message.includes('schema cache') || message.includes('could not find the')
}

function handleCheltuialaError(error: unknown, fallbackMessage: string) {
  const message = String((error as { message?: string })?.message ?? fallbackMessage)
  const schemaIssue = isSchemaCacheError(error)

  captureReactError(error, {
    component: 'CheltuialaPageClient',
    tags: {
      module: 'cheltuieli',
      table: 'cheltuieli_diverse',
    },
    extra: {
      originalMessage: message,
      schemaIssue,
    },
  })

  if (schemaIssue) {
    hapticError()
    toast.error('Schema DB nu e sincronizat?. Reîncarcă aplicația sau ruleaza reload schema in Supabase.')
    return
  }

  hapticError()
  toast.error(message || fallbackMessage)
}

export function CheltuialaPageClient({ initialCheltuieli }: CheltuialaPageClientProps) {
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: Cheltuiala; index: number }>>({})

  const [search, setSearch] = useState('')
  const [temporalFilter, setTemporalFilter] = useState<TemporalFilter>('luna')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [viewing, setViewing] = useState<Cheltuiala | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<Cheltuiala | null>(null)
  const [deleting, setDeleting] = useState<Cheltuiala | null>(null)
  const addFromQuery = searchParams.get('add') === '1'

  const {
    data: cheltuieli = initialCheltuieli,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.cheltuieli,
    queryFn: getCheltuieli,
    initialData: initialCheltuieli,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  })

  useMobileScrollRestore({
    storageKey: 'scroll:cheltuieli',
    ready: !isLoading,
  })

  const createMutation = useMutation({
    mutationFn: (data: CheltuialaFormData) =>
      createCheltuiala({
        client_sync_id: data.client_sync_id,
        data: data.data,
        categorie: data.categorie,
        suma_lei: Number(data.suma_lei),
        furnizor: data.furnizor || undefined,
        descriere: data.descriere || undefined,
        document_url: undefined,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cheltuieli, exact: true })
      track('cheltuiala_add', { suma: Number(variables.suma_lei || 0), categorie: variables.categorie })
      hapticSuccess()
      toast.success('Cheltuială adaugata')
    },
    onError: (err: Error & { status?: number; code?: string }) => {
      const conflict = err?.status === 409 || err?.code === '23505'
      if (conflict) {
        toast.info('Inregistrarea era deja sincronizat?.')
        return
      }
      handleCheltuialaError(err, 'Nu am putut salva cheltuiala.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CheltuialaFormData }) =>
      updateCheltuiala(id, {
        data: payload.data,
        categorie: payload.categorie,
        suma_lei: Number(payload.suma_lei),
        furnizor: payload.furnizor || undefined,
        descriere: payload.descriere || undefined,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cheltuieli, exact: true })
      track('cheltuiala_edit', { id: variables.id })
      hapticSuccess()
      toast.success('Cheltuială actualizata')
    },
    onError: (err: Error) => {
      handleCheltuialaError(err, 'Nu am putut actualiza cheltuiala.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCheltuiala,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cheltuieli, exact: true })
      trackEvent('delete_item', 'cheltuieli')
      track('cheltuiala_delete', { id: deletedId })
      hapticSuccess()
      toast.success('Cheltuială stearsa')
      setDeleting(null)
    },
    onError: (err: Error) => {
      handleCheltuialaError(err, 'Nu am putut sterge cheltuiala.')
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
    const unregister = registerAddAction(() => setAddOpen(true), 'Adauga cheltuiala')
    return unregister
  }, [registerAddAction])

  useEffect(() => {
    const query = search.trim()
    if (!query) return
    const timer = setTimeout(() => {
      track('search', { module: 'cheltuieli', query })
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  const scheduleDelete = (cheltuiala: Cheltuiala) => {
    const cheltuialaId = cheltuiala.id
    const currentItems = queryClient.getQueryData<Cheltuiala[]>(queryKeys.cheltuieli) ?? []
    const deleteIndex = currentItems.findIndex((item) => item.id === cheltuialaId)

    pendingDeletedItems.current[cheltuialaId] = { item: cheltuiala, index: deleteIndex }
    queryClient.setQueryData<Cheltuiala[]>(queryKeys.cheltuieli, (current = []) => current.filter((item) => item.id !== cheltuialaId))

    const timer = setTimeout(() => {
      delete pendingDeleteTimers.current[cheltuialaId]
      delete pendingDeletedItems.current[cheltuialaId]
      deleteMutation.mutate(cheltuialaId)
    }, 5000)

    pendingDeleteTimers.current[cheltuialaId] = timer

    toast('Element sters', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const pendingTimer = pendingDeleteTimers.current[cheltuialaId]
          if (!pendingTimer) return
          clearTimeout(pendingTimer)
          delete pendingDeleteTimers.current[cheltuialaId]

          const pendingItem = pendingDeletedItems.current[cheltuialaId]
          delete pendingDeletedItems.current[cheltuialaId]
          if (!pendingItem) return

          queryClient.setQueryData<Cheltuiala[]>(queryKeys.cheltuieli, (current = []) => {
            if (current.some((item) => item.id === cheltuialaId)) return current
            const next = [...current]
            const insertAt = pendingItem.index >= 0 ? Math.min(pendingItem.index, next.length) : next.length
            next.splice(insertAt, 0, pendingItem.item)
            return next
          })
        },
      },
    })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = toIsoDate(today)
  const monthStartIso = toIsoDate(getStartOfMonth(today))
  const seasonStartIso = toIsoDate(getStartOfSeason(today))
  const weekStartIso = toIsoDate(getStartOfWeek(today))

  const cheltuieliLuna = useMemo(
    () => cheltuieli.filter((row) => toDateOnly(row.data) >= monthStartIso && toDateOnly(row.data) <= todayIso),
    [cheltuieli, monthStartIso, todayIso]
  )

  const cheltuieliSezon = useMemo(
    () => cheltuieli.filter((row) => toDateOnly(row.data) >= seasonStartIso && toDateOnly(row.data) <= todayIso),
    [cheltuieli, seasonStartIso, todayIso]
  )

  const searched = useMemo(() => {
    const term = normalizeText(search)
    if (!term) return cheltuieli
    return cheltuieli.filter((row) => {
      return (
        normalizeText(row.categorie).includes(term) ||
        normalizeText(row.descriere).includes(term) ||
        normalizeText(row.furnizor).includes(term)
      )
    })
  }, [cheltuieli, search])

  const temporalFiltered = useMemo(() => {
    if (temporalFilter === 'toate') return searched
    return searched.filter((row) => {
      const date = toDateOnly(row.data)
      if (temporalFilter === 'azi') return date === todayIso
      if (temporalFilter === 'sapt') return date >= weekStartIso && date <= todayIso
      if (temporalFilter === 'luna') return date >= monthStartIso && date <= todayIso
      return date >= seasonStartIso && date <= todayIso
    })
  }, [searched, temporalFilter, todayIso, weekStartIso, monthStartIso, seasonStartIso])

  const filtered = useMemo(() => {
    if (!selectedCategory) return temporalFiltered
    return temporalFiltered.filter((row) => (row.categorie || 'Altele') === selectedCategory)
  }, [temporalFiltered, selectedCategory])

  const total = useMemo(() => filtered.reduce((sum, c) => sum + Number(c.suma_lei || 0), 0), [filtered])

  const dashboardSummary = useMemo(() => {
    const totalLunaCurenta = cheltuieliLuna.reduce((sum, row) => sum + Number(row.suma_lei || 0), 0)
    const totalSezon = cheltuieliSezon.reduce((sum, row) => sum + Number(row.suma_lei || 0), 0)

    const prevMonthStart = new Date(today)
    prevMonthStart.setDate(1)
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1)
    const prevMonthStartIso = toIsoDate(prevMonthStart)

    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
    const prevMonthEndIso = toIsoDate(prevMonthEnd)

    const totalLunaTrecuta = cheltuieli.reduce((sum, row) => {
      const date = toDateOnly(row.data)
      if (date < prevMonthStartIso || date > prevMonthEndIso) return sum
      return sum + Number(row.suma_lei || 0)
    }, 0)

    const trendPercent = totalLunaTrecuta > 0 ? ((totalLunaCurenta - totalLunaTrecuta) / totalLunaTrecuta) * 100 : totalLunaCurenta > 0 ? 100 : 0

    const sparklineLuna = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today)
      day.setDate(today.getDate() - 6 + index)
      const dayIso = toIsoDate(day)
      return cheltuieli.reduce((sum, row) => (toDateOnly(row.data) === dayIso ? sum + Number(row.suma_lei || 0) : sum), 0)
    })

    const sparklineSezon = Array.from({ length: 4 }, (_, index) => {
      const end = new Date(today)
      end.setDate(today.getDate() - (3 - index) * 7)
      const start = new Date(end)
      start.setDate(end.getDate() - 6)
      const startIso = toIsoDate(start)
      const endIso = toIsoDate(end)
      return cheltuieliSezon.reduce((sum, row) => {
        const date = toDateOnly(row.data)
        if (date < startIso || date > endIso) return sum
        return sum + Number(row.suma_lei || 0)
      }, 0)
    })

    const autoManoperaLuna = cheltuieliLuna
      .filter((row) => isAutoManoperaCheltuiala(row))
      .reduce((sum, row) => sum + Number(row.suma_lei || 0), 0)

    const distinctDaysInMonth = new Set(cheltuieliLuna.map((row) => toDateOnly(row.data))).size
    const medieZilnica = distinctDaysInMonth > 0 ? totalLunaCurenta / distinctDaysInMonth : 0

    return {
      totalLunaCurenta,
      totalSezon,
      totalLunaTrecuta,
      trendPercent,
      sparklineLuna,
      sparklineSezon,
      countLuna: cheltuieliLuna.length,
      autoManoperaLuna,
      medieZilnica,
    }
  }, [cheltuieli, cheltuieliLuna, cheltuieliSezon, today])

  const topCategories = useMemo(() => {
    const grouped = new Map<string, number>()
    for (const row of cheltuieliLuna) {
      const key = row.categorie || 'Altele'
      grouped.set(key, (grouped.get(key) ?? 0) + Number(row.suma_lei || 0))
    }
    const totalMonth = cheltuieliLuna.reduce((sum, row) => sum + Number(row.suma_lei || 0), 0)
    return Array.from(grouped.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        percent: totalMonth > 0 ? (amount / totalMonth) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [cheltuieliLuna])

  return (
    <AppShell
      header={<PageHeader title="Cheltuieli" subtitle="Monitorizare costuri operaționale" />}
      bottomBar={
        <StickyActionBar>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--agri-text-muted)]">Total: {total.toFixed(2)} lei</p>
          </div>
        </StickyActionBar>
      }
    >
      <div className="mx-auto mt-4 w-full max-w-7xl space-y-3 px-0 py-3 sm:mt-0 sm:px-3 sm:space-y-4 sm:py-4">
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => setTemporalFilter('luna')}
            style={{ background: colors.white, borderRadius: radius.xl, boxShadow: shadows.card, padding: spacing.lg, minHeight: 110, cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <span style={{ fontSize: 16 }}>📉</span>
              {Math.abs(dashboardSummary.trendPercent) > 0.01 ? (
                <TrendBadge value={Number(Math.abs(dashboardSummary.trendPercent).toFixed(0))} positive={dashboardSummary.trendPercent <= 0} />
              ) : null}
            </div>
            <div style={{ fontSize: 10, color: colors.gray }}>Luna asta</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.dark }}>{dashboardSummary.totalLunaCurenta.toFixed(0)} RON</div>
            <div style={{ fontSize: 10, color: colors.gray, marginBottom: spacing.xs }}>{dashboardSummary.countLuna} înregistrări</div>
            {dashboardSummary.sparklineLuna.some((value) => value > 0) ? (
              <Sparkline data={dashboardSummary.sparklineLuna} color={colors.coral} width={120} height={26} />
            ) : null}
          </div>

          <div style={{ background: colors.white, borderRadius: radius.xl, boxShadow: shadows.card, padding: spacing.lg, minHeight: 110 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <span style={{ fontSize: 16 }}>📅</span>
            </div>
            <div style={{ fontSize: 10, color: colors.gray }}>Sezon</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.dark }}>{dashboardSummary.totalSezon.toFixed(0)} RON</div>
            <div style={{ fontSize: 10, color: colors.gray, marginBottom: spacing.xs }}>RON total sezon</div>
            {dashboardSummary.sparklineSezon.some((value) => value > 0) ? (
              <Sparkline data={dashboardSummary.sparklineSezon} color={colors.coral} width={120} height={26} />
            ) : null}
          </div>
        </div>

        <div style={{ background: colors.white, borderRadius: radius.xl, boxShadow: shadows.card, padding: spacing.lg }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: colors.dark }}>Cheltuieli pe categorii</h3>
            {selectedCategory ? (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                style={{ border: 'none', background: 'transparent', color: colors.coral, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                ✕ Reset
              </button>
            ) : null}
          </div>

          {topCategories.length === 0 ? (
            <p style={{ fontSize: 11, color: colors.gray }}>Nu există cheltuieli în luna curentă.</p>
          ) : (
            <div style={{ display: 'grid', gap: spacing.xs }}>
              {topCategories.map((item) => {
                const selected = selectedCategory === item.name
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setSelectedCategory((current) => (current === item.name ? null : item.name))}
                    style={{
                      border: 'none',
                      background: selected ? colors.primary : colors.white,
                      color: selected ? colors.white : colors.dark,
                      borderRadius: radius.md,
                      padding: `${spacing.xs + 2}px ${spacing.sm}px`,
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      <span style={{ fontSize: 15, flexShrink: 0 }}>{getCheltuialaCategoryEmoji(item.name)}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.name}
                        </div>
                        <div style={{ marginTop: 3, height: 5, borderRadius: radius.full, background: selected ? 'rgba(255,255,255,0.35)' : colors.grayLight, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(item.percent, 4)}%`, height: '100%', borderRadius: radius.full, background: selected ? colors.white : colors.coral }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{item.amount.toFixed(0)} RON</div>
                        <div style={{ fontSize: 10, opacity: selected ? 0.9 : 0.8 }}>{item.percent.toFixed(0)}%</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className={`grid gap-2 ${dashboardSummary.autoManoperaLuna > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {dashboardSummary.autoManoperaLuna > 0 ? (
            <div style={{ background: colors.blueLight, border: `1px solid ${colors.blue}`, borderRadius: radius.lg, boxShadow: shadows.card, padding: spacing.md }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                <span>👷</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: colors.dark }}>Manoperă auto</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: colors.dark }}>{dashboardSummary.autoManoperaLuna.toFixed(0)}</div>
              <div style={{ fontSize: 10, color: colors.gray }}>RON (din recoltări)</div>
            </div>
          ) : null}

          <div style={{ background: colors.white, border: `1px solid ${colors.grayLight}`, borderRadius: radius.xl, boxShadow: shadows.card, padding: spacing.lg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
              <span>📊</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: colors.dark }}>Medie/zi</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.dark }}>{dashboardSummary.medieZilnica.toFixed(0)}</div>
            <div style={{ fontSize: 10, color: colors.gray }}>RON/zi</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
          {([
            ['azi', 'Azi'],
            ['sapt', 'Sapt.'],
            ['luna', 'Luna'],
            ['sezon', 'Sezon'],
            ['toate', 'Toate'],
          ] as Array<[TemporalFilter, string]>).map(([key, label]) => {
            const active = temporalFilter === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTemporalFilter(key)}
                style={{
                  minHeight: 34,
                  borderRadius: radius.md,
                  border: active ? 'none' : `1px solid ${colors.grayLight}`,
                  background: active ? colors.primary : colors.white,
                  color: active ? colors.white : colors.gray,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '0 10px',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        <SearchField placeholder="Caută categorie, descriere, furnizor..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Caută cheltuieli" />

        {isError ? <ErrorState title="Eroare" message={(error as Error).message} /> : null}
        {isLoading ? (
          <>
            <div className="overflow-hidden rounded-xl border border-[var(--agri-border)] bg-white sm:hidden">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="border-b border-[var(--agri-border)] last:border-b-0">
                  <ListSkeletonRow />
                </div>
              ))}
            </div>
            <div className="hidden grid-cols-1 gap-2.5 sm:grid sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <ListSkeletonCard key={index} className="min-h-[146px] sm:min-h-[208px]" />
              ))}
            </div>
          </>
        ) : null}
        {!isLoading && !isError && filtered.length === 0 ? (
          <EmptyState icon={<Receipt className="h-16 w-16" />} title="Nicio cheltuială încă" description="Adaugă prima cheltuială pentru a începe" />
        ) : null}

        {!isLoading && !isError && filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((c) => (
              <CheltuialaCard
                key={c.id}
                cheltuiala={c}
                onView={setViewing}
                onEdit={(ch) => {
                  setEditing(ch)
                  setEditOpen(true)
                }}
                onDelete={(id) => {
                  const target = filtered.find((item) => item.id === id) ?? null
                  setDeleting(target)
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <AddCheltuialaDialog
        open={addOpen || addFromQuery}
        onOpenChange={setAddOpen}
        onSubmit={async (data) => {
          await createMutation.mutateAsync({
            client_sync_id: data.client_sync_id,
            data: data.data,
            categorie: data.categorie,
            suma_lei: data.suma_lei,
            furnizor: data.furnizor || undefined,
            descriere: data.descriere || undefined,
          })
        }}
      />

      <ViewCheltuialaDialog
        open={!!viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null)
        }}
        cheltuiala={viewing}
        onEdit={(ch) => {
          setViewing(null)
          setEditing(ch)
          setEditOpen(true)
        }}
        onDelete={(ch) => {
          setViewing(null)
          setDeleting(ch)
        }}
      />

      <EditCheltuialaDialog
        cheltuiala={editing}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) setEditing(null)
        }}
        onSubmit={async (id, data) => {
          await updateMutation.mutateAsync({
            id,
            payload: {
              data: data.data,
              categorie: data.categorie,
              suma_lei: data.suma_lei,
              furnizor: data.furnizor || undefined,
              descriere: data.descriere || undefined,
            },
          })
        }}
      />

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        itemType="Cheltuială"
        itemName={buildCheltuialaDeleteLabel(deleting)}
        description={
          deleting && isAutoManoperaCheltuiala(deleting)
            ? `Atenție: această cheltuială este generată automat din recoltări. Dacă o ștergi, va fi recreată la următoarea recoltare. Ești sigur??

Ștergi cheltuiala ${deleting?.categorie || deleting?.furnizor || deleting?.descriere || 'necunoscută'} din ${deleting?.data ? new Date(deleting.data).toLocaleDateString('ro-RO') : 'data necunoscută'} - ${Number(deleting?.suma_lei ?? 0).toFixed(2)} lei?`
            : `Ștergi cheltuiala ${deleting?.categorie || deleting?.furnizor || deleting?.descriere || 'necunoscută'} din ${deleting?.data ? new Date(deleting.data).toLocaleDateString('ro-RO') : 'data necunoscută'} - ${Number(deleting?.suma_lei ?? 0).toFixed(2)} lei?`
        }
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
