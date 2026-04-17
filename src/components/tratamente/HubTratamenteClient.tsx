'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueries } from '@tanstack/react-query'
import { addDays, endOfDay, isAfter, isBefore, startOfDay } from 'date-fns'
import { CalendarCheck2, CalendarDays, CloudSun, SprayCan, TriangleAlert } from 'lucide-react'

import { loadHubMeteoParcelaAction } from '@/app/(dashboard)/tratamente/actions'
import { AppShell } from '@/components/app/AppShell'
import { PageHeader } from '@/components/app/PageHeader'
import { HubAplicareCard } from '@/components/tratamente/HubAplicareCard'
import { isAplicareProgramata } from '@/components/tratamente/aplicare-status'
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { queryKeys } from '@/lib/query-keys'
import type {
  AplicareCrossParcelItem,
  StatisticiAplicariCrossParcel,
} from '@/lib/supabase/queries/tratamente'
import type { MeteoZi } from '@/lib/tratamente/meteo'
import { cn } from '@/lib/utils'

type HubTab = 'today' | 'week' | 'all'
type HubStatusFilter = 'all' | 'programate' | 'aplicata' | 'anulata' | 'omisa' | 'phi'

interface HubTratamenteClientProps {
  initialAplicari: AplicareCrossParcelItem[]
  initialStatistici: StatisticiAplicariCrossParcel
  loadMeteoForParcela?: (parcelaId: string) => Promise<MeteoZi | null>
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

const TAB_OPTIONS: Array<{ id: HubTab; label: string }> = [
  { id: 'today', label: 'Astăzi' },
  { id: 'week', label: 'Săptămâna asta' },
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
}: HubTratamenteClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<HubTab>('today')
  const [selectedParcele, setSelectedParcele] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<HubStatusFilter>('all')

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
    () => parcelFilteredAplicari.filter((aplicare) => matchesStatusFilter(aplicare, statusFilter)),
    [parcelFilteredAplicari, statusFilter]
  )

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
    setSelectedParcele((current) =>
      current.includes(parcelaId)
        ? current.filter((value) => value !== parcelaId)
        : [...current, parcelaId]
    )
  }

  const emptyStateDescription =
    activeTab === 'today'
      ? 'Nu există aplicări programate pentru astăzi pe parcelele selectate.'
      : activeTab === 'week'
        ? 'Nu există aplicări programate în următoarele 7 zile pe parcelele selectate.'
        : 'Nu există încă aplicări în intervalul încărcat pentru hub.'

  return (
    <AppShell
      header={
        <PageHeader
          title="Tratamente"
          subtitle="Hub global pentru aplicările fermei"
          summary={
            <p className="text-xs text-[var(--text-secondary)]">
              {initialStatistici.total} aplicări în intervalul inițial încărcat
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
          <div className="grid grid-cols-3 gap-2">
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
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
                onClick={() => setSelectedParcele([])}
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

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setStatusFilter(option.id)}
                  className={cn(
                    'min-h-9 rounded-full px-3 text-xs font-semibold transition',
                    statusFilter === option.id
                      ? 'bg-[var(--text-primary)] text-white'
                      : 'border border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)]'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {visibleAplicari.length === 0 ? (
          <EmptyState
            icon={<SprayCan className="h-6 w-6" />}
            title="Niciun tratament programat"
            description={emptyStateDescription}
            actionLabel="Creează plan tratament"
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
                showMeteoBar={activeTab !== 'all' && canShowMeteoForAplicare(aplicare, twoDayEnd)}
              />
            ))}
          </div>
        )}

        {visibleAplicari.length > 0 ? (
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
      </div>
    </AppShell>
  )
}
