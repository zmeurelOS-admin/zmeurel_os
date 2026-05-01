'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/lib/ui/toast'

import { AddActivitateAgricolaDialog } from '@/components/activitati-agricole/AddActivitateAgricolaDialog'
import { EditActivitateAgricolaDialog } from '@/components/activitati-agricole/EditActivitateAgricolaDialog'
import { AppShell } from '@/components/app/AppShell'
import {
  ModuleEmptyCard,
  ModulePillFilterButton,
  ModulePillRow,
} from '@/components/app/module-list-chrome'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState } from '@/components/app/LoadingState'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import { Button } from '@/components/ui/button'
import { SearchField } from '@/components/ui/SearchField'
import { cn } from '@/lib/utils'
import { useAddAction } from '@/contexts/AddActionContext'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { useTrackModuleView } from '@/lib/analytics/useTrackModuleView'
import {
  buildLatestActivityByParcela,
} from '@/lib/activitati/timeline'
import { deleteActivitateAgricola, getActivitatiAgricole, type ActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { queryKeys } from '@/lib/query-keys'

type TipFilter = 'toate' | 'arhivate_pn' | 'taiere' | 'altele'

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function activityKind(tip: string | null | undefined): TipFilter {
  const value = normalizeText(tip)
  if (value.includes('tund') || value.includes('tai') || value.includes('curata') || value.includes('copilit') || value.includes('defolier')) return 'taiere'
  if (value.includes('toate')) return 'toate'
  return 'altele'
}

function activityEmojiByTip(tip: string | null | undefined): string {
  const t = normalizeText(tip)
  if (t.includes('fungic') || t.includes('pestic') || t.includes('erbic') || t.includes('insecticid') || t.includes('tratament')) return '🧪'
  if (t.includes('fertirig') || (t.includes('irig') && t.includes('fert'))) return '💧'
  if (t.includes('fertiliz') || t.includes('foliar')) return '🌿'
  if (t.includes('tund') || t.includes('tai') || t.includes('curata') || t.includes('copilit') || t.includes('defolier')) return '✂️'
  return '🔧'
}

function activityDisplayLabel(tip: string | null | undefined): string {
  const t = normalizeText(tip)
  if (t.includes('fungic') || t.includes('pestic') || t.includes('erbic') || t.includes('insecticid') || t.includes('tratament')) return 'Fungicide/Pesticide'
  if (t.includes('fertirig') || (t.includes('irig') && t.includes('fert'))) return 'Fertirigare'
  if (t.includes('fertiliz') || t.includes('foliar')) return 'Fertilizare foliară'
  if (t.includes('tund') || t.includes('tai') || t.includes('curata') || t.includes('copilit') || t.includes('defolier')) return 'Tăiere'
  return 'Altele'
}

type TemporalBadge = {
  label: string
  className: string
}

function toStartOfDay(value: Date): Date {
  const copy = new Date(value)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function getDaysFromActivity(dataAplicare: string | null | undefined, today: Date): number | null {
  if (!dataAplicare) return null
  const parsed = new Date(dataAplicare)
  if (Number.isNaN(parsed.getTime())) return null
  const activityDay = toStartOfDay(parsed)
  const diff = today.getTime() - activityDay.getTime()
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)))
}

function temporalBadgeForActivity(activity: ActivitateAgricola, today: Date): TemporalBadge {
  const daysSince = getDaysFromActivity(activity.data_aplicare, today)
  const pauseInterval = Number(activity.timp_pauza_zile ?? 0)

  if (pauseInterval > 0 && daysSince !== null) {
    const remaining = pauseInterval - daysSince
    if (remaining > 2) {
      return {
        label: `⏳ Pauză ${remaining} zile`,
        className: 'border border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger-text)]',
      }
    }
    if (remaining >= 1 && remaining <= 2) {
      return {
        label: `⚠️ Încă ${remaining} zile`,
        className: 'border border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]',
      }
    }
    return {
      label: '✅ Sigur de cules',
      className: 'border border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success-text)]',
    }
  }

  if (daysSince === 0) {
    return {
      label: 'azi',
      className: 'border border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral-text)]',
    }
  }
  if (daysSince === 1) {
    return {
      label: 'ieri',
      className: 'border border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral-text)]',
    }
  }
  if (daysSince !== null) {
    return {
      label: `acum ${daysSince} zile`,
      className: 'border border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral-text)]',
    }
  }

  return {
    label: 'fără dată',
    className: 'border border-[var(--neutral-border)] bg-[var(--neutral-bg)] text-[var(--neutral-text)]',
  }
}

function formatDateShort(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
}

function getArchivedActivityLabel(activity: Pick<ActivitateAgricola, 'tip_activitate'>): string {
  return `${activity.tip_activitate || 'Activitate'} · Arhivat`
}

const QUICK_ADD_PILLS = [
  { emoji: '💧', label: 'Irigare', value: 'irigatie' },
  { emoji: '✂️', label: 'Tăiere', value: 'Tundere/Curatare' },
  { emoji: '📋', label: 'Altele', value: 'altele' },
]

const SECTION_LABEL_CLASS =
  'mb-2 block text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--text-tertiary)]'

function hasAiActivityOpenForm(searchParams: Pick<URLSearchParams, 'get'>): boolean {
  return searchParams.get('openForm') === '1'
}

type AiActivitatePrefill = {
  tip: string
  parcela_id: string
  parcela_label: string
  produs: string
  doza: string
  data: string
  observatii: string
}

function parseAiActivitatePrefill(searchParams: Pick<URLSearchParams, 'get'>): AiActivitatePrefill {
  return {
    tip: (searchParams.get('tip') ?? '').trim(),
    parcela_id: (searchParams.get('parcela_id') ?? '').trim(),
    parcela_label: (searchParams.get('parcela_label') ?? searchParams.get('parcela') ?? '').trim(),
    produs: (searchParams.get('produs') ?? '').trim(),
    doza: (searchParams.get('doza') ?? '').trim(),
    data: (searchParams.get('data') ?? '').trim(),
    observatii: (searchParams.get('observatii') ?? '').trim(),
  }
}

export default function ActivitatiPage() {
  useTrackModuleView('activitati')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingDeletedItems = useRef<Record<string, { item: ActivitateAgricola; index: number }>>({})
  const deleteMutateRef = useRef<(id: string) => void>(() => {})

  const {
    data: activitati = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.activitati,
    queryFn: getActivitatiAgricole,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    retry: 1,
  })
  const { data: parcele = [] } = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })

  const [addOpen, setAddOpen] = useState(false)
  const [aiPrefill, setAiPrefill] = useState<AiActivitatePrefill | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [tipFilter, setTipFilter] = useState<TipFilter>('toate')
  const [selectedParcelaId, setSelectedParcelaId] = useState<string | null>(null)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [editingActivity, setEditingActivity] = useState<ActivitateAgricola | null>(null)
  const openFormFromQuery = hasAiActivityOpenForm(searchParams)
  const queryAiPrefill = useMemo(
    () => (openFormFromQuery ? parseAiActivitatePrefill(searchParams) : null),
    [openFormFromQuery, searchParams]
  )
  const resolvedAiPrefill = openFormFromQuery ? queryAiPrefill : aiPrefill
  const isAddDialogOpen = addOpen || openFormFromQuery

  const clearActivitateFormQueryParams = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('openForm')
    nextParams.delete('tip')
    nextParams.delete('parcela')
    nextParams.delete('parcela_id')
    nextParams.delete('parcela_label')
    nextParams.delete('produs')
    nextParams.delete('doza')
    nextParams.delete('data')
    nextParams.delete('observatii')
    const query = nextParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const deleteMutation = useMutation({
    mutationFn: deleteActivitateAgricola,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activitati })
      trackEvent('delete_item', 'activitati')
      track('activitate_delete', { id: deletedId })
      toast.success('Activitate stearsa')
    },
    onError: (err: Error) => {
      toast.error(err.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.activitati })
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
    const unregister = registerAddAction(() => {
      setAiPrefill(null)
      setAddOpen(true)
    }, 'Adauga activitate')
    return unregister
  }, [registerAddAction])

  useEffect(() => {
    const query = searchQuery.trim()
    if (!query) return
    const timer = setTimeout(() => {
      track('search', { module: 'activitati', query })
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const parcelaMap = useMemo(() => {
    const map: Record<string, string> = {}
    parcele.forEach((p) => {
      map[p.id] = p.nume_parcela || 'Teren'
    })
    return map
  }, [parcele])

  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])

  const stareParceleRows = useMemo(() => {
    const activeParcele = parcele.filter((item) => {
      const status = normalizeText(item.status)
      if (!status) return true
      return !status.includes('inactiv')
    })

    const latestByParcela = buildLatestActivityByParcela(activitati)

    return activeParcele.map((parcela) => {
      const latest = latestByParcela.get(parcela.id) ?? null
      if (!latest) {
        return {
          parcela,
          latest: null as null | ActivitateAgricola,
          daysAgo: null as number | null,
        }
      }
      return { parcela, latest }
    })
  }, [activitati, parcele])

  const filteredActivitati = useMemo(() => {
    const term = normalizeText(searchQuery)
    return activitati.filter((item) => {
      if (tipFilter === 'arhivate_pn' && !item.tip_deprecat) return false
      if (
        tipFilter !== 'toate' &&
        tipFilter !== 'arhivate_pn' &&
        activityKind(item.tip_activitate) !== tipFilter
      ) {
        return false
      }
      if (selectedParcelaId && item.parcela_id !== selectedParcelaId) return false
      if (!term) return true
      return [
        item.tip_activitate,
        item.produs_utilizat,
        item.doza,
        item.observatii,
        item.operator,
        item.id_activitate,
      ]
        .filter(Boolean)
        .some((value) => normalizeText(value).includes(term))
    })
  }, [activitati, searchQuery, selectedParcelaId, tipFilter])

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.activitati })

  return (
    <AppShell
      header={<PageHeader title="Activități Agricole" subtitle="Istoric lucrări și tratamente" />}
      bottomBar={
        <div className="md:hidden">
          <StickyActionBar>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-[var(--text-secondary)]">Total activități: {activitati.length}</p>
            </div>
          </StickyActionBar>
        </div>
      }
    >
      <div className="mt-2 w-full space-y-4 px-4 py-3 sm:mt-0 sm:space-y-5 sm:py-3 lg:px-6 xl:px-8">
        {/* STARE TERENURI */}
        {stareParceleRows.length > 0 ? (
          <div>
            <span className={SECTION_LABEL_CLASS}>Stare terenuri</span>
            <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-soft)]">
              {stareParceleRows.map((row) => {
                const badge = row.latest ? temporalBadgeForActivity(row.latest, today) : null
                const emoji = activityEmojiByTip(row.latest?.tip_activitate)
                const archivedLabel = row.latest?.tip_deprecat ? getArchivedActivityLabel(row.latest) : null
                const isSel = selectedParcelaId === row.parcela.id
                return (
                  <button
                    key={row.parcela.id}
                    type="button"
                    onClick={() => setSelectedParcelaId((prev) => (prev === row.parcela.id ? null : row.parcela.id))}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2.5 border-b border-[var(--divider)] px-3.5 py-2.5 text-left transition-colors last:border-b-0 md:gap-3',
                      isSel
                        ? 'border-l-[3px] border-l-[var(--success-text)] bg-[color:color-mix(in_srgb,var(--surface-card-muted)_40%,var(--surface-card))]'
                        : 'hover:bg-[color:color-mix(in_srgb,var(--surface-card-muted)_35%,var(--surface-card))]',
                    )}
                  >
                    <span className="shrink-0 text-base md:text-[15px]">{row.latest ? emoji : '📋'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-[var(--text-primary)]">
                        {row.parcela.nume_parcela || 'Teren'}
                      </div>
                      <div className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
                        {row.latest
                          ? `${activityDisplayLabel(row.latest.tip_activitate)} · ${formatDateShort(row.latest.data_aplicare)}`
                          : 'Nicio activitate'}
                      </div>
                      {archivedLabel ? (
                        <div
                          className="mt-1 max-w-full truncate text-xs text-[var(--warning-text)]"
                          title="Acest tip se înregistrează acum în modulul Protecție & Nutriție"
                        >
                          {archivedLabel}
                        </div>
                      ) : null}
                    </div>
                    {badge ? (
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-[var(--neutral-border)] bg-[var(--neutral-bg)] px-2 py-1 text-[10px] font-semibold text-[var(--neutral-text)]">
                        Nicio activitate
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {QUICK_ADD_PILLS.length > 0 ? (
          <div className="hidden md:block">
            <span className={cn(SECTION_LABEL_CLASS, 'mt-1')}>Adaugă rapid</span>
            <div className="flex flex-wrap gap-2">
              {QUICK_ADD_PILLS.map((pill) => (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => {
                    setAiPrefill({
                      tip: pill.value,
                      parcela_id: '',
                      parcela_label: '',
                      produs: '',
                      doza: '',
                      data: '',
                      observatii: '',
                    })
                    setAddOpen(true)
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-[var(--shadow-soft)] transition-colors hover:bg-[var(--surface-card-muted)]"
                >
                  <span className="text-sm" aria-hidden>
                    {pill.emoji}
                  </span>
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <span className={cn(SECTION_LABEL_CLASS, 'mt-1')}>Recente</span>

          <div className="space-y-3 md:hidden">
            <ModulePillRow className="gap-1.5">
              {(
                [
                  { key: 'toate' as const, label: 'Toate' },
                  {
                    key: 'arhivate_pn' as const,
                    label: (
                      <span className="inline-flex items-center gap-1">
                        <Archive className="h-3.5 w-3.5" aria-hidden />
                        Arhivate P&N
                      </span>
                    ),
                  },
                  { key: 'taiere' as const, label: '✂️ Tăiere' },
                  { key: 'altele' as const, label: 'Altele' },
                ] as const
              ).map(({ key, label }) => (
                <ModulePillFilterButton
                  key={key}
                  active={tipFilter === key}
                  activeStyle="minimal"
                  onClick={() => setTipFilter(key)}
                >
                  {label}
                </ModulePillFilterButton>
              ))}
              {selectedParcelaId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full border-[var(--status-danger-border)] text-[11px] font-semibold text-[var(--status-danger-text)]"
                  onClick={() => setSelectedParcelaId(null)}
                >
                  ✕ Reset teren
                </Button>
              ) : null}
            </ModulePillRow>
            <SearchField
              placeholder="Caută activitate, produs, doză..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Caută activități"
            />
          </div>

          <div className="hidden space-y-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-soft)] md:block">
            <ModulePillRow className="gap-1.5">
              {(
                [
                  { key: 'toate' as const, label: 'Toate' },
                  {
                    key: 'arhivate_pn' as const,
                    label: (
                      <span className="inline-flex items-center gap-1">
                        <Archive className="h-3.5 w-3.5" aria-hidden />
                        Arhivate P&N
                      </span>
                    ),
                  },
                  { key: 'taiere' as const, label: '✂️ Tăiere' },
                  { key: 'altele' as const, label: 'Altele' },
                ] as const
              ).map(({ key, label }) => (
                <ModulePillFilterButton
                  key={key}
                  active={tipFilter === key}
                  activeStyle="minimal"
                  onClick={() => setTipFilter(key)}
                >
                  {label}
                </ModulePillFilterButton>
              ))}
              {selectedParcelaId ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full border-[var(--status-danger-border)] text-[11px] font-semibold text-[var(--status-danger-text)]"
                  onClick={() => setSelectedParcelaId(null)}
                >
                  ✕ Reset teren
                </Button>
              ) : null}
            </ModulePillRow>
            <SearchField
              containerClassName="max-w-2xl"
              placeholder="Caută activitate, produs, doză..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Caută activități (desktop)"
            />
          </div>
        </div>

        {isError ? <ErrorState title="Eroare la încărcare" message={(error as Error).message} onRetry={refresh} /> : null}
        {isLoading ? <LoadingState label="Se încarcă activitățile..." /> : null}

        {!isLoading && !isError && activitati.length === 0 ? (
          <ModuleEmptyCard
            emoji="✂️"
            title="Nu ai înregistrat activități recente"
            hint="Adaugă activități pentru un istoric complet"
            action={
              <Button type="button" className="agri-cta" onClick={() => setAddOpen(true)}>
                Adaugă activitate
              </Button>
            }
          />
        ) : null}

        {!isLoading && !isError && activitati.length > 0 && filteredActivitati.length === 0 ? (
          <EmptyState
            icon={<span style={{ fontSize: 40 }}>📋</span>}
            title="Nicio activitate găsită"
            description="Modifică filtrul sau căutarea"
          />
        ) : null}

        {filteredActivitati.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {filteredActivitati.map((a) => {
              const parcelaName = a.parcela_id ? parcelaMap[a.parcela_id] || 'Teren' : 'Teren'
              const badge = temporalBadgeForActivity(a, today)
              const isExpanded = expandedCardId === a.id
              const isArchived = Boolean(a.tip_deprecat)
              const archivedLabel = getArchivedActivityLabel(a)
              const actEmoji = activityEmojiByTip(a.tip_activitate)

              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3.5 shadow-[var(--shadow-soft)]"
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setExpandedCardId((prev) => (prev === a.id ? null : a.id))}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex gap-2.5">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--surface-page)] text-base dark:bg-[var(--surface-card-muted)]"
                        aria-hidden
                      >
                        {actEmoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-[var(--text-primary)]">
                              {isArchived ? a.tip_activitate || 'Activitate' : activityDisplayLabel(a.tip_activitate)}
                            </div>
                            {isArchived ? (
                              <span
                                title="Acest tip se înregistrează acum în modulul Protecție & Nutriție"
                                className="mt-1 inline-flex max-w-full items-center rounded-full border border-[var(--warning-border)] bg-[var(--warning-bg)] px-2 py-1 text-[10px] font-semibold leading-tight text-[var(--warning-text)]"
                              >
                                <span className="max-w-full whitespace-normal break-words text-left">
                                  {archivedLabel}
                                </span>
                              </span>
                            ) : null}
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div className="mt-2 flex items-end justify-between gap-2 border-t border-[var(--divider)] pt-2">
                          <p className="truncate text-xs text-[var(--text-secondary)]">
                            {[a.produs_utilizat, a.doza].filter(Boolean).join(' · ') || 'Fără produs/doză'}
                          </p>
                          <p className="max-w-[45%] truncate text-right text-xs font-medium text-[var(--text-tertiary)]">
                            {parcelaName}
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="mt-3 space-y-2 border-t border-[var(--divider)] pt-3">
                      <p className="text-xs text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">Data:</span>{' '}
                        {a.data_aplicare ? new Date(a.data_aplicare).toLocaleDateString('ro-RO') : '-'}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">Parcelă:</span> {parcelaName}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">Observații:</span> {a.observatii?.trim() || '—'}
                      </p>

                      <div className="mt-2 flex gap-2">
                        {!isArchived ? (
                          <button
                            type="button"
                            className="flex-1 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-xs font-semibold text-[var(--warning-text)] transition hover:brightness-[0.98]"
                            onClick={() => setEditingActivity(a)}
                          >
                            ✏️ Edit
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="flex-1 rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-3 py-2 text-xs font-semibold text-[var(--danger-text)] transition hover:brightness-[0.98]"
                          onClick={() => {
                            const confirmed = window.confirm('Ștergi această activitate?')
                            if (confirmed) deleteMutation.mutate(a.id)
                          }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>

      <AddActivitateAgricolaDialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAddOpen(false)
            setAiPrefill(null)
            clearActivitateFormQueryParams()
            return
          }
          setAddOpen(true)
        }}
        hideTrigger
        aiPrefill={resolvedAiPrefill}
      />

      {editingActivity ? (
        <EditActivitateAgricolaDialog
          activitate={editingActivity}
          open={Boolean(editingActivity)}
          onOpenChange={(open) => {
            if (!open) {
              setEditingActivity(null)
              queryClient.invalidateQueries({ queryKey: queryKeys.activitati })
            }
          }}
        />
      ) : null}
    </AppShell>
  )
}
