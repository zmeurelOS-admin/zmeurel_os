'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useQueries } from '@tanstack/react-query'
import { addDays, endOfDay, isAfter, isBefore, startOfDay } from 'date-fns'
import { CalendarCheck2, CalendarDays, CloudSun, SprayCan, TriangleAlert } from 'lucide-react'

import {
  createManualInterventieAction,
  loadHubMeteoParcelaAction,
  planificaInterventieRelevantaAction,
} from '@/app/(dashboard)/tratamente/actions'
import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { HubAplicareCard } from '@/components/tratamente/HubAplicareCard'
import {
  getInterventieKey,
  InterventiiRelevanteCard,
} from '@/components/tratamente/InterventiiRelevanteCard'
import { isAplicareProgramata } from '@/components/tratamente/aplicare-status'
import { MarkAplicataSheet, type MarkAplicataFormValues } from '@/components/tratamente/MarkAplicataSheet'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAddAction } from '@/contexts/AddActionContext'
import { queryKeys } from '@/lib/query-keys'
import { toast } from '@/lib/ui/toast'
import type {
  AplicareCrossParcelItem,
  InterventieRelevantaV2,
  ProdusFitosanitar,
  StatisticiAplicariCrossParcel,
  ParcelaTratamenteSelectOption,
} from '@/lib/supabase/queries/tratamente'
import type { MeteoZi } from '@/lib/tratamente/meteo'
import { cn } from '@/lib/utils'

type HubTab = 'today' | 'week' | 'relevant' | 'all'
type HubStatusFilter = 'all' | 'programate' | 'aplicata' | 'anulata' | 'omisa' | 'phi'
type HubSourceFilter = 'all' | 'din_plan' | 'manuala'
type HubStageFilter = 'all' | string
type HubTypeFilter = 'all' | string

interface HubFilterState {
  activeTab: HubTab
  selectedParcele: string[]
  sourceFilter: HubSourceFilter
  statusFilter: HubStatusFilter
  stageFilter: HubStageFilter
  tipFilter: HubTypeFilter
}

interface HubTratamenteClientProps {
  initialAplicari: AplicareCrossParcelItem[]
  initialStatistici: StatisticiAplicariCrossParcel
  loadMeteoForParcela?: (parcelaId: string) => Promise<MeteoZi | null>
  produseFitosanitare?: ProdusFitosanitar[]
  parceleSelector?: ParcelaTratamenteSelectOption[]
  interventiiRelevante?: InterventieRelevantaV2[]
}

function getAplicareDate(value: AplicareCrossParcelItem): Date | null {
  const raw = value.data_aplicata ?? value.data_programata
  if (!raw) return null

  const parsed = new Date(
    raw.includes('T') ? raw : `${raw}T00:00:00.000Z`
  )
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isDateInRange(date: Date, start: Date, end: Date): boolean {
  if (isBefore(date, start)) return false
  if (isAfter(date, end)) return false
  return true
}

function sameDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function canShowMeteoForAplicare(aplicare: AplicareCrossParcelItem, twoDayEnd: Date): boolean {
  if (!isAplicareProgramata(aplicare.status)) return false
  const date = getAplicareDate(aplicare)
  if (!date) return false
  return date.getTime() <= twoDayEnd.getTime()
}

function matchesStatusFilter(aplicare: AplicareCrossParcelItem, filter: HubStatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'programate') return aplicare.status === 'planificata' || aplicare.status === 'reprogramata'
  if (filter === 'phi') return aplicare.phi_warning
  return aplicare.status === filter
}

function hasSafeWindow(meteoZi: MeteoZi | null): boolean {
  return Boolean(meteoZi?.ferestre_24h.some((slot) => slot.safe))
}

function normalizeFilterValue(value: string | null | undefined): string {
  return value
    ?.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll(' ', '_') ?? ''
}

function humanizeFilterValue(value: string | null | undefined): string {
  const normalized = value?.trim()
  if (!normalized) return '—'
  const words = normalized.replaceAll('_', ' ').split(/\s+/).filter(Boolean)
  if (words.length === 0) return '—'
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function parseListParam(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function readHubFiltersFromUrl(): HubFilterState {
  if (typeof window === 'undefined') {
    return {
      activeTab: 'today',
      selectedParcele: [],
      sourceFilter: 'all',
      statusFilter: 'all',
      stageFilter: 'all',
      tipFilter: 'all',
    }
  }

  const searchParams = new URLSearchParams(window.location.search)
  const tab = searchParams.get('tab')
  const source = searchParams.get('source')
  const status = searchParams.get('status')
  const stage = searchParams.get('stage')
  const tip = searchParams.get('tip')

  return {
    activeTab: tab === 'week' || tab === 'relevant' || tab === 'all' ? tab : 'today',
    selectedParcele: parseListParam(searchParams.get('parcele')),
    sourceFilter: source === 'din_plan' || source === 'manuala' ? source : 'all',
    statusFilter: status === 'programate' || status === 'aplicata' || status === 'anulata' || status === 'omisa' || status === 'phi'
      ? status
      : 'all',
    stageFilter: stage ? stage : 'all',
    tipFilter: tip ? tip : 'all',
  }
}

const TAB_OPTIONS: Array<{ id: HubTab; label: string }> = [
  { id: 'today', label: 'Astăzi' },
  { id: 'week', label: 'Săptămâna asta' },
  { id: 'relevant', label: 'Relevante acum' },
  { id: 'all', label: 'Toate' },
]

const STATUS_OPTIONS: Array<{ id: HubStatusFilter; label: string }> = [
  { id: 'all', label: 'Toate statusurile' },
  { id: 'programate', label: 'Programate' },
  { id: 'aplicata', label: 'Aplicate' },
  { id: 'anulata', label: 'Anulate' },
  { id: 'omisa', label: 'Omise' },
  { id: 'phi', label: 'În PHI warning' },
]

function KpiCard({
  title,
  value,
  tone = 'neutral',
  subtitle,
}: {
  title: string
  value: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
  subtitle?: string
}) {
  const toneClass =
    tone === 'success'
      ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)]'
      : tone === 'warning'
        ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]'
        : tone === 'danger'
          ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)]'
          : 'border-[var(--border-default)] bg-[var(--surface-card)]'

  return (
    <AppCard className={cn('rounded-[22px] p-4', toneClass)}>
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">{title}</p>
      <p className="mt-2 text-2xl text-[var(--text-primary)] [font-weight:750]">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{subtitle}</p> : null}
    </AppCard>
  )
}

export function HubTratamenteClient({
  initialAplicari,
  initialStatistici,
  loadMeteoForParcela = loadHubMeteoParcelaAction,
  produseFitosanitare = [],
  parceleSelector = [],
  interventiiRelevante = [],
}: HubTratamenteClientProps) {
  const router = useRouter()
  const { registerAddAction } = useAddAction()
  const [filters, setFilters] = useState<HubFilterState>(() => readHubFiltersFromUrl())
  const [manualOpen, setManualOpen] = useState(false)
  const [pendingInterventieId, setPendingInterventieId] = useState<string | null>(null)
  const [isManualSaving, startManualTransition] = useTransition()
  const [isPlanificaPending, startPlanificaTransition] = useTransition()

  const activeTab = filters.activeTab
  const selectedParcele = filters.selectedParcele
  const statusFilter = filters.statusFilter
  const sourceFilter = filters.sourceFilter
  const stageFilter = filters.stageFilter
  const tipFilter = filters.tipFilter

  const today = useMemo(() => startOfDay(new Date()), [])
  const todayKey = useMemo(() => sameDayKey(today), [today])
  const weekEnd = useMemo(() => endOfDay(addDays(today, 7)), [today])
  const twoDayEnd = useMemo(() => endOfDay(addDays(today, 2)), [today])

  const parcelaOptions = useMemo(() => {
    const seen = new Set<string>()
    return initialAplicari
      .filter((aplicare) => {
        if (seen.has(aplicare.parcela_id)) return false
        seen.add(aplicare.parcela_id)
        return true
      })
      .map((aplicare) => ({
        id: aplicare.parcela_id,
        label: aplicare.parcela_nume ?? 'Parcelă',
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ro'))
  }, [initialAplicari])

  const meteoParcelIds = useMemo(
    () =>
      Array.from(
        new Set(
          initialAplicari
            .filter((aplicare) => canShowMeteoForAplicare(aplicare, twoDayEnd))
            .map((aplicare) => aplicare.parcela_id)
        )
      ),
    [initialAplicari, twoDayEnd]
  )

  const meteoQueries = useQueries({
    queries: meteoParcelIds.map((parcelaId) => ({
      queryKey: queryKeys.tratamenteHubMeteo(parcelaId),
      queryFn: () => loadMeteoForParcela(parcelaId),
      staleTime: 60 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    })),
  })

  const meteoByParcela = useMemo(() => {
    const map = new Map<string, MeteoZi | null>()
    meteoParcelIds.forEach((parcelaId, index) => {
      map.set(parcelaId, meteoQueries[index]?.data ?? null)
    })
    return map
  }, [meteoParcelIds, meteoQueries])

  const meteoLoadingByParcela = useMemo(() => {
    const map = new Map<string, boolean>()
    meteoParcelIds.forEach((parcelaId, index) => {
      map.set(parcelaId, Boolean(meteoQueries[index]?.isLoading))
    })
    return map
  }, [meteoParcelIds, meteoQueries])

  useEffect(() => {
    const unregister = registerAddAction(() => setManualOpen(true), '+ Intervenție manuală')
    return unregister
  }, [registerAddAction])

  const manualParcelaOptions = useMemo(
    () =>
      parceleSelector
        .map((parcela) => ({
          value: parcela.id,
          label: parcela.nume_parcela ?? parcela.id_parcela ?? 'Parcelă',
        }))
        .sort((first, second) => first.label.localeCompare(second.label, 'ro')),
    [parceleSelector]
  )

  const syncFilters = (next: HubFilterState) => {
    setFilters(next)
    if (typeof window !== 'undefined') {
      const query = buildHubQueryString(next)
      const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname
      router.replace(nextUrl, { scroll: false })
    }
  }

  const defaultManualParcelaId = selectedParcele.length === 1 ? selectedParcele[0] : null
  const defaultManualParcelaLabel =
    defaultManualParcelaId ? parcelaOptions.find((item) => item.id === defaultManualParcelaId)?.label ?? 'Parcelă' : null

  const handleManualInterventie = async (values: MarkAplicataFormValues) => {
    startManualTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', values.manual_parcela_id ?? defaultManualParcelaId ?? '')
      formData.set('status', values.manual_status ?? 'aplicata')
      formData.set('data', values.manual_data ?? '')
      formData.set('tip_interventie', values.tip_interventie ?? '')
      formData.set('scop', values.scop ?? '')
      formData.set('stadiu_la_aplicare', values.stadiu_la_aplicare ?? '')
      if (values.cohort_la_aplicare) {
        formData.set('cohort_la_aplicare', values.cohort_la_aplicare)
      }
      formData.set('operator', values.operator ?? '')
      formData.set('observatii', values.observatii ?? '')
      formData.set('cantitate_totala_ml', values.cantitate_totala_ml ?? '')
      formData.set('produse', JSON.stringify(values.produse))
      if (values.diferenteFataDePlan) {
        formData.set('diferente_fata_de_plan', JSON.stringify(values.diferenteFataDePlan))
      }

      const result = await createManualInterventieAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Intervenția manuală a fost salvată.')
      setManualOpen(false)
      router.refresh()
    })
  }

  const handlePlanificaInterventie = (interventie: InterventieRelevantaV2) => {
    const key = getInterventieKey(interventie)
    setPendingInterventieId(key)
    startPlanificaTransition(async () => {
      const formData = new FormData()
      formData.set('parcelaId', interventie.parcela_id)
      formData.set('planLinieId', interventie.interventie.id)
      formData.set('dataPlanificata', interventie.urmatoarea_data_estimata ?? new Date().toISOString().slice(0, 10))
      if (interventie.fenofaza_curenta?.cohort) {
        formData.set('cohortLaAplicare', interventie.fenofaza_curenta.cohort)
      }

      const result = await planificaInterventieRelevantaAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        setPendingInterventieId(null)
        return
      }

      toast.success('Aplicarea din plan a fost pregătită.')
      setPendingInterventieId(null)
      router.refresh()
    })
  }

  const tabFilteredAplicari = useMemo(() => {
    return initialAplicari.filter((aplicare) => {
      const date = getAplicareDate(aplicare)
      if (!date) return false

      if (activeTab === 'today') {
        return sameDayKey(date) === todayKey
      }

      if (activeTab === 'week') {
        return isDateInRange(date, today, weekEnd)
      }

      return true
    })
  }, [activeTab, initialAplicari, today, todayKey, weekEnd])

  const parcelFilteredAplicari = useMemo(() => {
    if (selectedParcele.length === 0) return tabFilteredAplicari
    return tabFilteredAplicari.filter((aplicare) => selectedParcele.includes(aplicare.parcela_id))
  }, [selectedParcele, tabFilteredAplicari])

  const visibleAplicari = useMemo(
    () =>
      sortAplicariForHub(
        parcelFilteredAplicari.filter((aplicare) => isAplicareRelevantForFilters(aplicare, filters))
      ),
    [filters, parcelFilteredAplicari]
  )

  const compactAplicariFiltersOnMobile = visibleAplicari.length <= 4

  const visibleInterventiiRelevante = useMemo(() => {
    if (selectedParcele.length === 0) return interventiiRelevante
    return interventiiRelevante.filter((interventie) => selectedParcele.includes(interventie.parcela_id))
  }, [interventiiRelevante, selectedParcele])

  const kpis = useMemo(() => {
    const base = parcelFilteredAplicari
    const programateAzi = base.filter((aplicare) => {
      const date = getAplicareDate(aplicare)
      return date ? sameDayKey(date) === todayKey && isAplicareProgramata(aplicare.status) : false
    }).length

    const aplicateAzi = base.filter((aplicare) => {
      if (aplicare.status !== 'aplicata' || !aplicare.data_aplicata) return false
      const date = getAplicareDate(aplicare)
      return date ? sameDayKey(date) === todayKey : false
    }).length

    const phiWarnings = base.filter((aplicare) => aplicare.phi_warning).length
    const meteoEligible = base.filter((aplicare) => canShowMeteoForAplicare(aplicare, twoDayEnd))
    const meteoFavorable = meteoEligible.filter((aplicare) => hasSafeWindow(meteoByParcela.get(aplicare.parcela_id) ?? null)).length

    return {
      programateAzi,
      aplicateAzi,
      phiWarnings,
      meteoFavorable,
      meteoEligibleCount: meteoEligible.length,
    }
  }, [meteoByParcela, parcelFilteredAplicari, todayKey, twoDayEnd])

  const toggleParcela = (parcelaId: string) => {
    syncFilters({
      ...filters,
      selectedParcele: filters.selectedParcele.includes(parcelaId)
        ? filters.selectedParcele.filter((value) => value !== parcelaId)
        : [...filters.selectedParcele, parcelaId],
    })
  }

  const emptyStateDescription =
    visibleAplicari.length === 0 && parcelFilteredAplicari.length > 0
      ? 'Nicio aplicare nu se potrivește filtrelor selectate.'
      : activeTab === 'today'
        ? 'Nu există aplicări programate pentru astăzi pe parcelele selectate.'
        : activeTab === 'week'
          ? 'Nu există aplicări programate în următoarele 7 zile pe parcelele selectate.'
          : 'Nu există încă aplicări în intervalul încărcat pentru hub.'

  return (
    <AppShell
      header={
        <PageHeader
          title="Protecție & Nutriție"
          subtitle="Hub global pentru aplicări, planuri și intervenții relevante"
          summary={
            <p className="text-xs text-[var(--text-secondary)]">
              {initialStatistici.total} aplicări încărcate · {initialAplicari.filter((item) => resolveAplicareSource(item) === 'manuala').length} manuale · {initialAplicari.filter((item) => resolveAplicareSource(item) === 'din_plan').length} din plan · {interventiiRelevante.length} intervenții relevante
            </p>
          }
          rightSlot={
            <Button type="button" className="bg-[var(--agri-primary)] text-white" onClick={() => router.push('/tratamente/planuri/nou')}>
              + Plan nou
            </Button>
          }
          expandRightSlotOnMobile
          stackMobileRightSlotBelowTitle
        />
      }
    >
      <div className="mx-auto mt-2 w-full max-w-7xl space-y-4 py-3 sm:mt-0 md:py-4">
        <div className="sticky top-2 z-20 rounded-[24px] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--surface-page)_92%,white)] p-2 shadow-[var(--shadow-soft)] backdrop-blur">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => syncFilters({ ...filters, activeTab: tab.id })}
                className={cn(
                  'min-h-11 rounded-2xl px-3 text-sm font-semibold transition',
                  activeTab === tab.id
                    ? 'bg-[var(--agri-primary)] text-white shadow-[var(--shadow-soft)]'
                    : 'bg-[var(--surface-card-muted)] text-[var(--text-secondary)]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard title="Programate azi" value={`${kpis.programateAzi}`} />
          <KpiCard
            title="În PHI warning"
            value={`${kpis.phiWarnings}`}
            tone={kpis.phiWarnings > 0 ? 'danger' : 'neutral'}
          />
          <KpiCard
            title="Fereastră meteo OK"
            value={`${kpis.meteoFavorable}/${kpis.meteoEligibleCount}`}
            tone={kpis.meteoFavorable > 0 ? 'success' : 'warning'}
            subtitle={kpis.meteoEligibleCount === 0 ? 'Meteo doar pentru aplicările din următoarele 2 zile' : undefined}
          />
          <KpiCard
            title="Aplicate azi"
            value={`${kpis.aplicateAzi}`}
            tone={kpis.aplicateAzi > 0 ? 'success' : 'neutral'}
          />
        </div>

        <div className="sticky top-[5.25rem] z-10 space-y-3 rounded-[24px] border border-[var(--border-default)] bg-[color:color-mix(in_srgb,var(--surface-page)_94%,white)] p-3 shadow-[var(--shadow-soft)] backdrop-blur">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Parcele</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => syncFilters({ ...filters, selectedParcele: [] })}
                className={cn(
                  'min-h-9 rounded-full px-3 text-xs font-semibold transition',
                  selectedParcele.length === 0
                    ? 'bg-[var(--agri-primary)] text-white'
                    : 'border border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)]'
                )}
              >
                Toate parcelele
              </button>
              {parcelaOptions.map((parcela) => {
                const active = selectedParcele.includes(parcela.id)
                return (
                  <button
                    key={parcela.id}
                    type="button"
                    onClick={() => toggleParcela(parcela.id)}
                    className={cn(
                      'min-h-9 rounded-full px-3 text-xs font-semibold transition',
                      active
                        ? 'bg-[var(--brand-blue)] text-white'
                        : 'border border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)]'
                    )}
                  >
                    {parcela.label}
                  </button>
                )
              })}
            </div>
          </div>

          {activeTab !== 'relevant' ? (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Filtre aplicări</p>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <select
                aria-label="Filtru sursă"
                className="agri-control h-10 rounded-xl text-sm"
                value={sourceFilter}
                onChange={(event) =>
                  syncFilters({ ...filters, sourceFilter: event.target.value as HubSourceFilter })
                }
              >
                <option value="all">Toate sursele</option>
                <option value="din_plan">Din plan</option>
                <option value="manuala">Manuale</option>
              </select>
              <select
                aria-label="Filtru status"
                className="agri-control h-10 rounded-xl text-sm"
                value={statusFilter}
                onChange={(event) =>
                  syncFilters({ ...filters, statusFilter: event.target.value as HubStatusFilter })
                }
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtru tip"
                className={cn(
                  'agri-control h-10 rounded-xl text-sm',
                  compactAplicariFiltersOnMobile && 'max-md:hidden',
                )}
                value={tipFilter}
                onChange={(event) =>
                  syncFilters({ ...filters, tipFilter: event.target.value })
                }
              >
                <option value="all">Toate tipurile</option>
                {Array.from(
                  new Set(
                    initialAplicari
                      .map((aplicare) => aplicare.tip_interventie)
                      .filter((value): value is string => Boolean(value?.trim()))
                      .map((value) => value.trim())
                  )
                )
                  .sort((first, second) => first.localeCompare(second, 'ro'))
                  .map((value) => (
                    <option key={value} value={value}>
                      {humanizeFilterValue(value)}
                    </option>
                  ))}
              </select>
              <select
                aria-label="Filtru fenofază"
                className={cn(
                  'agri-control h-10 rounded-xl text-sm',
                  compactAplicariFiltersOnMobile && 'max-md:hidden',
                )}
                value={stageFilter}
                onChange={(event) =>
                  syncFilters({ ...filters, stageFilter: event.target.value })
                }
              >
                <option value="all">Toate fenofazele</option>
                {Array.from(
                  new Map(
                    initialAplicari
                      .map((aplicare) => aplicare.stadiu_trigger)
                      .filter((value): value is string => Boolean(value?.trim()))
                      .map((value) => [normalizeFilterValue(value), humanizeFilterValue(value)])
                  ).entries()
                )
                  .sort((first, second) => first[1].localeCompare(second[1], 'ro'))
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          ) : null}
        </div>

        {activeTab === 'relevant' ? (
          <InterventiiRelevanteCard
            description="Intervenții din planurile active care se potrivesc cu fenofaza observată pe parcelă."
            interventii={visibleInterventiiRelevante}
            onPlanifica={handlePlanificaInterventie}
            pendingInterventieId={isPlanificaPending ? pendingInterventieId : null}
            showFilters
            showParcela
            title="Relevante operațional"
          />
        ) : visibleAplicari.length === 0 ? (
          <EmptyState
            icon={<SprayCan className="h-6 w-6" />}
            title="Nicio aplicare programată"
            description={emptyStateDescription}
            actionLabel="Creează plan nou"
            onAction={() => router.push('/tratamente/planuri/nou')}
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {visibleAplicari.map((aplicare) => (
              <HubAplicareCard
                key={aplicare.id}
                aplicare={aplicare}
                meteoLoading={meteoLoadingByParcela.get(aplicare.parcela_id) ?? false}
                meteoZi={meteoByParcela.get(aplicare.parcela_id) ?? null}
                produseFitosanitare={produseFitosanitare}
                showMeteoBar={activeTab !== 'all' && canShowMeteoForAplicare(aplicare, twoDayEnd)}
              />
            ))}
          </div>
        )}

        {activeTab !== 'relevant' && visibleAplicari.length > 0 ? (
          <AppCard className="rounded-[22px] bg-[var(--surface-card-muted)] p-4 text-sm text-[var(--text-secondary)]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" aria-hidden />
                {activeTab === 'today' ? 'Filtru: astăzi' : activeTab === 'week' ? 'Filtru: următoarele 7 zile' : 'Filtru: toate aplicările încărcate'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarCheck2 className="h-4 w-4" aria-hidden />
                {visibleAplicari.length} aplicări în listă
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CloudSun className="h-4 w-4" aria-hidden />
                Meteo deduplicat pe {meteoParcelIds.length} parcele
              </span>
              {kpis.phiWarnings > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-[var(--status-danger-text)]">
                  <TriangleAlert className="h-4 w-4" aria-hidden />
                  {kpis.phiWarnings} avertismente PHI
                </span>
              ) : null}
            </div>
          </AppCard>
        ) : null}

        <MarkAplicataSheet
          mode="manual"
          defaultCantitateMl={null}
          defaultOperator=""
          defaultStadiu={null}
          defaultManualParcelaId={defaultManualParcelaId}
          defaultManualParcelaLabel={defaultManualParcelaLabel}
          defaultManualStatus="aplicata"
          configurareSezon={null}
          isRubusMixt={false}
          manualParcele={manualParcelaOptions}
          meteoSnapshot={null}
          onOpenChange={setManualOpen}
          onSubmit={handleManualInterventie}
          open={manualOpen}
          pending={isManualSaving}
          produseFitosanitare={produseFitosanitare}
        />
      </div>
    </AppShell>
  )
}

function buildHubQueryString(filters: HubFilterState): string {
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)

  params.delete('tab')
  params.delete('parcele')
  params.delete('source')
  params.delete('status')
  params.delete('stage')
  params.delete('tip')

  if (filters.activeTab !== 'today') params.set('tab', filters.activeTab)
  if (filters.selectedParcele.length > 0) params.set('parcele', filters.selectedParcele.join(','))
  if (filters.sourceFilter !== 'all') params.set('source', filters.sourceFilter)
  if (filters.statusFilter !== 'all') params.set('status', filters.statusFilter)
  if (filters.stageFilter !== 'all') params.set('stage', filters.stageFilter)
  if (filters.tipFilter !== 'all') params.set('tip', filters.tipFilter)

  return params.toString()
}

function resolveAplicareSource(aplicare: Pick<AplicareCrossParcelItem, 'sursa' | 'plan_linie_id'>): 'din_plan' | 'manuala' {
  return aplicare.sursa === 'manuala' ? 'manuala' : aplicare.plan_linie_id ? 'din_plan' : 'manuala'
}

function isAplicareRelevantForFilters(aplicare: AplicareCrossParcelItem, filters: HubFilterState): boolean {
  if (filters.sourceFilter !== 'all' && resolveAplicareSource(aplicare) !== filters.sourceFilter) return false
  if (filters.statusFilter !== 'all' && !matchesStatusFilter(aplicare, filters.statusFilter)) return false
  if (filters.tipFilter !== 'all' && normalizeFilterValue(aplicare.tip_interventie) !== normalizeFilterValue(filters.tipFilter)) return false
  if (filters.stageFilter !== 'all' && normalizeFilterValue(aplicare.stadiu_trigger) !== normalizeFilterValue(filters.stageFilter)) return false
  return true
}

function getAplicareSortPriority(status: AplicareCrossParcelItem['status']): number {
  if (status === 'planificata' || status === 'reprogramata') return 0
  if (status === 'omisa') return 1
  if (status === 'aplicata') return 2
  if (status === 'anulata') return 3
  return 4
}

function sortAplicariForHub(aplicari: AplicareCrossParcelItem[]): AplicareCrossParcelItem[] {
  return [...aplicari].sort((first, second) => {
    const priorityDiff = getAplicareSortPriority(first.status) - getAplicareSortPriority(second.status)
    if (priorityDiff !== 0) return priorityDiff

    const dateFirst = getAplicareDate(first)?.getTime() ?? Number.MAX_SAFE_INTEGER
    const dateSecond = getAplicareDate(second)?.getTime() ?? Number.MAX_SAFE_INTEGER
    if (first.status === 'aplicata' && second.status === 'aplicata') {
      const appliedDiff = dateSecond - dateFirst
      if (appliedDiff !== 0) return appliedDiff
    } else {
      const dateDiff = dateFirst - dateSecond
      if (dateDiff !== 0) return dateDiff
    }

    return (first.parcela_nume ?? '').localeCompare(second.parcela_nume ?? '', 'ro')
  })
}
