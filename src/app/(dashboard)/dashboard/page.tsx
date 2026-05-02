'use client'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

import { useCallback, useEffect, useMemo, useState } from 'react'
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
import { DashboardContentShell } from '@/components/app/DashboardContentShell'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState as BaseLoadingState } from '@/components/app/LoadingState'
import { DashboardSkeleton } from '@/components/app/ModuleSkeletons'
import { PageHeader } from '@/components/app/PageHeader'
import {
  ActivitatiPlanificateWidget,
  ComenziRecenteWidget,
  KpiSummaryWidget,
  RecoltariRecenteWidget,
  StocuriCriticeWidget,
  SumarVenituriWidget,
} from '@/components/dashboard/DashboardWidgets'
import {
  DASHBOARD_PRIMARY_QUICK_ACTIONS,
  DashboardAttentionCard,
  DashboardComenziSnapshotCard,
  DashboardCommercialSnapshotCard,
  DashboardFarmPulseCard,
  DashboardNextTreatmentCard,
  DashboardQuickActionsCard,
  DashboardRecommendationsCard,
  DashboardTodayCard,
  DashboardUnifiedFinancialCard,
  type DashboardAttentionItem,
  type DashboardQuickActionItem,
  type DashboardRecommendationItem,
  type DashboardTodayStatItem,
} from '@/components/dashboard/DashboardV2Sections'
import { MeteoDashboardCard } from '@/components/dashboard/MeteoDashboardCard'
import { TaskList, type DashboardTaskItem } from '@/components/dashboard/TaskList'
import { WelcomeCard } from '@/components/dashboard/WelcomeCard'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DASHBOARD_WIDGET_META,
  normalizeDashboardLayout,
  sortDashboardWidgetsForDisplay,
  toReactGridLayout,
  type DashboardLayoutConfig,
  type DashboardWidgetId,
} from '@/lib/dashboard/layout'
import {
  buildDashboardAlerts,
  buildDashboardTasks,
  buildParcelDashboardStates,
  isWidgetEmpty,
  type DashboardAlert,
  type DashboardRawData,
} from '@/lib/dashboard/engine'
import { buildAttentionNowItems } from '@/lib/dashboard/attention'
import { detectFarmContext } from '@/lib/dashboard/context'
import { buildDashboardRecommendations } from '@/lib/dashboard/recommendations'
import type { DashboardTreatmentSuggestionsPayload } from '@/lib/dashboard/treatment-suggestions'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG } from '@/lib/calculations/stock-audit-thresholds'
import { useMeteo } from '@/hooks/useMeteo'
import { queryKeys } from '@/lib/query-keys'
import { getSupabase } from '@/lib/supabase/client'
import { resolveDashboardMicroclimate } from '@/lib/dashboard/microclimate'
import { getActivitatiAgricole } from '@/lib/supabase/queries/activitati-agricole'
import { getCheltuieli } from '@/lib/supabase/queries/cheltuieli'
import { getComenzi } from '@/lib/supabase/queries/comenzi'
import { getStocuriPeLocatii } from '@/lib/supabase/queries/miscari-stoc'
import { getParcele } from '@/lib/supabase/queries/parcele'
import { getSolarClimateLogsForUnitati } from '@/lib/supabase/queries/solar-tracking'
import {
  dismissDashboardOnboarding,
  getDashboardProfilePreferences,
  updateDashboardLayout,
} from '@/lib/supabase/queries/profile-dashboard'
import { getRecoltari, getRecoltareTotalKg } from '@/lib/supabase/queries/recoltari'
import { getVanzari } from '@/lib/supabase/queries/vanzari'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { isParcelaDashboardRelevant } from '@/lib/parcele/dashboard-relevance'
import { formatUnitateDisplayName } from '@/lib/parcele/unitate'
import { toast } from '@/lib/ui/toast'
import type { Tables } from '@/types/supabase'

const DAY_MS = 24 * 60 * 60 * 1000
const EMPTY_LIST: never[] = []
const DashboardGridLayout = WidthProvider(GridLayout)

const DASHBOARD_SCOPE_FOOTNOTE =
  'Pe parcelele tale comerciale din dashboard apar recolta și ce ține de teren. Comenzi, stoc și sumarul financiar arată întreaga fermă.'

type DashboardParcela = Awaited<ReturnType<typeof getParcele>>[number]
type DashboardCulturaTreatmentInterval = Pick<
  Tables<'culturi'>,
  'id' | 'solar_id' | 'activa' | 'interval_tratament_zile'
>
type SmartAction = { id: string; label: string; hint: string; href: string }

function toDateOnly(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10)
}

function parseDateOnly(value: string | null | undefined): Date | null {
  const dateOnly = toDateOnly(value)
  if (!dateOnly) return null
  const parsed = new Date(`${dateOnly}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function toIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function formatNumber(value: number, fractionDigits = 1): string {
  return new Intl.NumberFormat('ro-RO', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : Math.min(fractionDigits, 1),
  }).format(value)
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(Math.round(value))
}

function formatCompactKpiMoney(value: number): string {
  const absoluteValue = Math.abs(value)
  if (absoluteValue >= 10_000) {
    const compactValue = absoluteValue / 1_000
    const formatted = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: compactValue < 100 ? 1 : 0,
      minimumFractionDigits: compactValue < 100 ? 1 : 0,
    }).format(compactValue)

    return `${value < 0 ? '-' : ''}${formatted}k RON`
  }

  return `${formatMoney(value)} RON`
}

function formatShortDate(value: string): string {
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value || '-'
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short' }).format(parsed)
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function buildTrend(current: number, previous: number): { percent: number; positive: boolean } | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null
  const delta = current - previous
  if (delta === 0) return null
  return {
    percent: Math.abs((delta / Math.abs(previous)) * 100),
    positive: delta > 0,
  }
}

async function getDashboardNextTreatmentSuggestion(): Promise<DashboardTreatmentSuggestionsPayload> {
  const response = await fetch('/api/dashboard/next-treatment-suggestion', {
    method: 'GET',
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Nu am putut încărca sugestia de tratament.')
  }

  return (await response.json()) as DashboardTreatmentSuggestionsPayload
}

function getGreeting(value: Date): string {
  const h = value.getHours()
  if (h < 12) return 'Bună dimineața'
  if (h < 18) return 'Bună ziua'
  return 'Bună seara'
}

function parcelAttentionScore(flags: string[], status: string | null): number {
  let score = 0
  if (flags.includes('treatment_overdue')) score += 4
  if (flags.includes('pause_active')) score += 3
  if (flags.includes('treatment_due_soon')) score += 2
  if (flags.includes('no_recent_activity')) score += 1
  if (status && status !== 'activ') score += 1
  return score
}

function buildSmartActions(params: {
  dashboardAlerts: DashboardAlert[]
  parcelStates: Array<{ attentionFlags: string[] }>
  comenziActiveCount: number
}): SmartAction[] {
  const actions: SmartAction[] = []
  const hasOverdueOrders = params.dashboardAlerts.some(
    (alert) => alert.category === 'comenzi' && alert.severity !== 'info'
  )
  const hasTreatmentPressure = params.parcelStates.some(
    (parcel) =>
      parcel.attentionFlags.includes('treatment_overdue') ||
      parcel.attentionFlags.includes('treatment_due_soon') ||
      parcel.attentionFlags.includes('pause_active')
  )
  const hasLowStock = params.dashboardAlerts.some((alert) => alert.category === 'stoc')
  const hasInactiveParcels = params.parcelStates.some((parcel) =>
    parcel.attentionFlags.includes('no_recent_activity')
  )

  if (hasOverdueOrders || params.comenziActiveCount > 0) {
    actions.push({
      id: 'orders',
      label: 'Verifică livrările de azi',
      hint: hasOverdueOrders ? 'Ai comenzi restante sau întârziate.' : 'Ai comenzi active în lucru.',
      href: '/comenzi',
    })
  }
  if (hasTreatmentPressure) {
    actions.push({
      id: 'treatments',
      label: 'Vezi tratamentele pe teren',
      hint: 'Ai parcele cu tratamente sau pauze active.',
      href: '/activitati-agricole',
    })
  }
  if (hasLowStock) {
    actions.push({
      id: 'stock',
      label: 'Verifică stocul critic',
      hint: 'Sunt produse aproape de limită.',
      href: '/stocuri',
    })
  }
  if (hasInactiveParcels) {
    actions.push({
      id: 'parcels',
      label: 'Uită-te la parcelele active',
      hint: 'Unele parcele n-au activitate recentă.',
      href: '/parcele',
    })
  }

  return actions.slice(0, 4)
}

function LoadingState({ label }: { label?: string }) {
  if (label?.toLowerCase().includes('dashboard')) {
    return <DashboardSkeleton />
  }
  return <BaseLoadingState label={label} />
}

function getComparableLayoutJson(layout: DashboardLayoutConfig): string {
  return JSON.stringify({
    version: 1,
    widgets: layout.widgets.map((widget) => ({
      id: widget.id,
      x: widget.x,
      y: widget.y,
      w: widget.w,
      h: widget.h,
      active: widget.active,
      static: widget.static ?? false,
    })),
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { userId, tenantId, associationShopApproved } = useDashboardAuth()
  const meteo = useMeteo()
  const [editMode, setEditMode] = useState(false)
  const [addWidgetOpen, setAddWidgetOpen] = useState(false)
  const [draftLayout, setDraftLayout] = useState<DashboardLayoutConfig | null>(null)
  const [currentDateTime] = useState(() => new Date())
  const currentDay = useMemo(() => {
    const value = new Date(currentDateTime)
    value.setHours(0, 0, 0, 0)
    return value
  }, [currentDateTime])

  useEffect(() => {
    trackEvent('open_dashboard', 'dashboard')
  }, [])

  useEffect(() => {
    const routesToPrefetch = ['/parcele', '/activitati-agricole', '/recoltari', '/vanzari', '/comenzi', '/stocuri']
    const runPrefetch = () => {
      routesToPrefetch.forEach((href) => {
        router.prefetch(href)
      })
    }
    const requestIdle = (window as unknown as {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
      cancelIdleCallback?: (id: number) => void
    }).requestIdleCallback
    const cancelIdle = (window as unknown as {
      cancelIdleCallback?: (id: number) => void
    }).cancelIdleCallback

    // Avoid competing with initial dashboard queries on mobile;
    // defer navigation warming until the browser is idle.
    if (requestIdle && cancelIdle) {
      const idleId = requestIdle(() => runPrefetch(), { timeout: 2500 })
      return () => cancelIdle(idleId)
    }

    const timeoutId = window.setTimeout(runPrefetch, 1200)
    return () => window.clearTimeout(timeoutId)
  }, [router])

  const recoltariQuery = useQuery({
    queryKey: queryKeys.recoltari,
    queryFn: getRecoltari,
    placeholderData: (previousData) => previousData,
  })

  const parceleQuery = useQuery({
    queryKey: queryKeys.parcele,
    queryFn: getParcele,
    placeholderData: (previousData) => previousData,
  })

  const activitatiQuery = useQuery({
    queryKey: queryKeys.activitati,
    queryFn: getActivitatiAgricole,
    placeholderData: (previousData) => previousData,
  })

  const vanzariQuery = useQuery({
    queryKey: queryKeys.vanzari,
    queryFn: getVanzari,
    placeholderData: (previousData) => previousData,
  })

  const cheltuieliQuery = useQuery({
    queryKey: queryKeys.cheltuieli,
    queryFn: getCheltuieli,
    placeholderData: (previousData) => previousData,
  })

  const comenziQuery = useQuery({
    queryKey: queryKeys.comenzi,
    queryFn: getComenzi,
    placeholderData: (previousData) => previousData,
  })

  const stocuriQuery = useQuery({
    queryKey: queryKeys.stocuriLocatiiRoot,
    queryFn: () => getStocuriPeLocatii(),
    placeholderData: (previousData) => previousData,
  })

  const dashboardParcelaIds = useMemo(
    () =>
      (parceleQuery.data ?? EMPTY_LIST)
        .filter((parcela) => isParcelaDashboardRelevant(parcela))
        .map((parcela) => parcela.id),
    [parceleQuery.data]
  )

  const solarParcelaIds = useMemo(
    () =>
      (parceleQuery.data ?? EMPTY_LIST)
        .filter((parcela) => isParcelaDashboardRelevant(parcela) && parcela.tip_unitate === 'solar')
        .map((parcela) => parcela.id),
    [parceleQuery.data],
  )

  const microclimateQuery = useQuery({
    queryKey: queryKeys.solarClimate(solarParcelaIds.join(',')),
    enabled: solarParcelaIds.length > 0,
    queryFn: () => getSolarClimateLogsForUnitati(solarParcelaIds, 120),
    placeholderData: (previousData) => previousData,
  })

  const treatmentIntervalsQuery = useQuery({
    queryKey: queryKeys.culturiTreatmentIntervals(dashboardParcelaIds.join(',')),
    enabled: dashboardParcelaIds.length > 0,
    queryFn: async (): Promise<DashboardCulturaTreatmentInterval[]> => {
      const supabase = getSupabase()
      const tenantId = await getTenantId(supabase)
      const { data, error } = await supabase
        .from('culturi')
        .select('id,solar_id,activa,interval_tratament_zile')
        .eq('tenant_id', tenantId)
        .in('solar_id', dashboardParcelaIds)

      if (error) throw error

      return (data ?? []).map((row) => ({
        id: row.id,
        solar_id: row.solar_id,
        activa: row.activa,
        interval_tratament_zile: row.interval_tratament_zile,
      }))
    },
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  const profileQuery = useQuery({
    queryKey: queryKeys.currentUserProfile,
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        return { hideOnboarding: false, dashboardLayout: null }
      }
      return getDashboardProfilePreferences(userId)
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const nextTreatmentSuggestionQuery = useQuery({
    queryKey: queryKeys.dashboardNextTreatmentSuggestion,
    queryFn: getDashboardNextTreatmentSuggestion,
    placeholderData: (previousData) => previousData,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const savedLayout = useMemo(
    () => normalizeDashboardLayout(profileQuery.data?.dashboardLayout ?? null),
    [profileQuery.data?.dashboardLayout]
  )
  const currentLayout = editMode ? (draftLayout ?? savedLayout) : savedLayout

  const dismissOnboardingMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return
      await dismissDashboardOnboarding(userId)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentUserProfile })
    },
    onError: () => {
      toast.error('Nu am putut salva preferința.')
    },
  })

  const saveLayoutMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Utilizatorul nu este autentificat.')
      await updateDashboardLayout(userId, currentLayout)
    },
    onSuccess: async () => {
      toast.success('Dashboard-ul a fost salvat.')
      setEditMode(false)
      setAddWidgetOpen(false)
      setDraftLayout(null)
      await queryClient.invalidateQueries({ queryKey: queryKeys.currentUserProfile })
    },
    onError: () => {
      toast.error('Nu am putut salva layout-ul dashboard-ului.')
    },
  })

  const coreQueries = [
    recoltariQuery,
    parceleQuery,
    activitatiQuery,
    vanzariQuery,
    cheltuieliQuery,
    comenziQuery,
    stocuriQuery,
  ]

  const hasResolvedCoreData = coreQueries.some((query) => query.data !== undefined)
  const isLoading = !hasResolvedCoreData && coreQueries.some((query) => query.isLoading)
  const hasError = coreQueries.some((query) => query.isError)
  const errorMessage =
    (recoltariQuery.error as Error | null)?.message ||
    (parceleQuery.error as Error | null)?.message ||
    (activitatiQuery.error as Error | null)?.message ||
    (vanzariQuery.error as Error | null)?.message ||
    (cheltuieliQuery.error as Error | null)?.message ||
    (comenziQuery.error as Error | null)?.message ||
    (stocuriQuery.error as Error | null)?.message

  const recoltari = recoltariQuery.data ?? EMPTY_LIST
  const parcele = parceleQuery.data ?? EMPTY_LIST
  const activitati = activitatiQuery.data ?? EMPTY_LIST
  const vanzari = vanzariQuery.data ?? EMPTY_LIST
  const cheltuieli = cheltuieliQuery.data ?? EMPTY_LIST
  const comenzi = comenziQuery.data ?? EMPTY_LIST
  const stocuri = stocuriQuery.data ?? EMPTY_LIST
  const solarClimateLogs = microclimateQuery.data ?? EMPTY_LIST

  const dashboardMicroclimate = useMemo(
    () => resolveDashboardMicroclimate(solarClimateLogs, currentDateTime),
    [currentDateTime, solarClimateLogs],
  )

  const hideOnboarding = profileQuery.data?.hideOnboarding === true

  const todayIso = useMemo(() => toIsoDate(currentDay), [currentDay])
  const yesterdayIso = useMemo(() => toIsoDate(new Date(currentDay.getTime() - DAY_MS)), [currentDay])
  const tomorrowIso = useMemo(() => toIsoDate(new Date(currentDay.getTime() + DAY_MS)), [currentDay])
  const seasonStartIso = `${currentDay.getFullYear()}-03-01`
  const previousSeasonStartIso = `${currentDay.getFullYear() - 1}-03-01`
  const seasonElapsedDays = Math.max(
    0,
    Math.floor(((parseDateOnly(todayIso)?.getTime() ?? 0) - (parseDateOnly(seasonStartIso)?.getTime() ?? 0)) / DAY_MS)
  )
  const previousSeasonEndDate = parseDateOnly(previousSeasonStartIso) ?? new Date(`${previousSeasonStartIso}T12:00:00`)
  previousSeasonEndDate.setDate(previousSeasonEndDate.getDate() + seasonElapsedDays)
  const previousSeasonEndIso = toIsoDate(previousSeasonEndDate)

  const dashboardRelevantParcele = useMemo<DashboardParcela[]>(
    () => parcele.filter((parcela) => isParcelaDashboardRelevant(parcela)),
    [parcele]
  )
  const farmContext = useMemo(
    () => detectFarmContext(parcele, dashboardRelevantParcele),
    [dashboardRelevantParcele, parcele],
  )
  const dashboardParcelaIdSet = useMemo(
    () => new Set(dashboardRelevantParcele.map((p) => p.id)),
    [dashboardRelevantParcele]
  )
  const parcelaById = useMemo(
    () =>
      new Map(
        dashboardRelevantParcele.map((parcela) => [
          parcela.id,
          formatUnitateDisplayName(parcela.nume_parcela, parcela.tip_unitate),
        ])
      ),
    [dashboardRelevantParcele]
  )

  const recoltariDashboard = useMemo(
    () =>
      recoltari.filter(
        (row) => row.parcela_id != null && dashboardParcelaIdSet.has(String(row.parcela_id))
      ),
    [recoltari, dashboardParcelaIdSet]
  )
  const activitatiDashboard = useMemo(
    () =>
      activitati.filter(
        (row) => row.parcela_id != null && dashboardParcelaIdSet.has(String(row.parcela_id))
      ),
    [activitati, dashboardParcelaIdSet]
  )

  const recoltariAzi = useMemo(
    () => recoltariDashboard.filter((row) => toDateOnly(row.data) === todayIso),
    [recoltariDashboard, todayIso]
  )
  const recoltariIeri = useMemo(
    () => recoltariDashboard.filter((row) => toDateOnly(row.data) === yesterdayIso),
    [recoltariDashboard, yesterdayIso]
  )
  const totalKgAzi = recoltariAzi.reduce((sum, row) => sum + getRecoltareTotalKg(row), 0)
  const totalKgIeri = recoltariIeri.reduce((sum, row) => sum + getRecoltareTotalKg(row), 0)

  // Date tenant-level: nu au o legătură curată cu o parcelă relevantă de dashboard.
  const comenziActive = useMemo(
    () => comenzi.filter((row) => row.status !== 'livrata' && row.status !== 'anulata'),
    [comenzi]
  )
  const kgComenziActive = comenziActive.reduce((sum, row) => sum + asNumber(row.cantitate_kg), 0)
  const activitatiAziCount = activitatiDashboard.filter((row) => toDateOnly(row.data_aplicare) === todayIso)
    .length

  const venitSezon = vanzari
    .filter((row) => {
      const date = toDateOnly(row.data)
      return date >= seasonStartIso && date <= todayIso
    })
    .reduce((sum, row) => sum + asNumber(row.cantitate_kg) * asNumber(row.pret_lei_kg), 0)

  const venitSezonAnterior = vanzari
    .filter((row) => {
      const date = toDateOnly(row.data)
      return date >= previousSeasonStartIso && date <= previousSeasonEndIso
    })
    .reduce((sum, row) => sum + asNumber(row.cantitate_kg) * asNumber(row.pret_lei_kg), 0)

  const costSezon = cheltuieli
    .filter((row) => {
      const date = toDateOnly(row.data)
      return date >= seasonStartIso && date <= todayIso
    })
    .reduce((sum, row) => sum + asNumber(row.suma_lei), 0)

  const costSezonAnterior = cheltuieli
    .filter((row) => {
      const date = toDateOnly(row.data)
      return date >= previousSeasonStartIso && date <= previousSeasonEndIso
    })
    .reduce((sum, row) => sum + asNumber(row.suma_lei), 0)

  const profitSezon = venitSezon - costSezon
  const profitSezonAnterior = venitSezonAnterior - costSezonAnterior
  const venitTrend = buildTrend(venitSezon, venitSezonAnterior)
  const profitTrend = buildTrend(profitSezon, profitSezonAnterior)

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('ro-RO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(currentDateTime),
    [currentDateTime]
  )
  const greeting = useMemo(() => getGreeting(currentDateTime), [currentDateTime])

  const orderName = useCallback((row: (typeof comenzi)[number]) => {
    const joined = String(row.client_nume ?? '').trim()
    const manual = String(row.client_nume_manual ?? '').trim()
    return joined || manual || 'Client'
  }, [])

  const recentOrders = useMemo(
    () =>
      [...comenzi]
        .sort((left, right) => {
          const leftTime = new Date(left.updated_at || left.created_at || `${toDateOnly(left.data_livrare || left.data_comanda)}T00:00:00`).getTime()
          const rightTime = new Date(right.updated_at || right.created_at || `${toDateOnly(right.data_livrare || right.data_comanda)}T00:00:00`).getTime()
          return rightTime - leftTime
        })
        .slice(0, 5)
        .map((row) => ({
          id: row.id,
          client: orderName(row),
          status: row.status || 'nouă',
          quantity: `${formatNumber(asNumber(row.cantitate_kg))} kg`,
          deliveryDate: toDateOnly(row.data_livrare)
            ? `Livrare ${formatShortDate(toDateOnly(row.data_livrare))}`
            : 'Fără dată de livrare',
        })),
    [comenzi, orderName]
  )

  const plannedActivities = useMemo(
    () =>
      [...activitatiDashboard]
        .filter((row) => {
          const date = toDateOnly(row.data_aplicare)
          return !!date && date > todayIso
        })
        .sort((left, right) => {
          const leftTime = parseDateOnly(left.data_aplicare)?.getTime() ?? 0
          const rightTime = parseDateOnly(right.data_aplicare)?.getTime() ?? 0
          return leftTime - rightTime
        })
        .slice(0, 5)
        .map((row) => ({
          id: row.id,
          title: row.tip_activitate || 'Activitate agricolă',
          parcela: parcelaById.get(row.parcela_id ?? '') || 'Parcelă nedefinită',
          date: formatShortDate(toDateOnly(row.data_aplicare)),
          detail: row.tip_deprecat ? (
            <span
              className="text-xs text-amber-700"
              title="Acest tip se înregistrează acum în modulul Protecție & Nutriție"
            >
              {(row.tip_activitate || 'Activitate agricolă') + ' · Arhivat'}
            </span>
          ) : row.produs_utilizat ? `Produs: ${row.produs_utilizat}` : 'Fără produs specificat',
        })),
    [activitatiDashboard, parcelaById, todayIso]
  )

  const recentHarvests = useMemo(
    () =>
      [...recoltariDashboard]
        .sort((left, right) => {
          const leftTime = new Date(left.created_at || `${toDateOnly(left.data)}T00:00:00`).getTime()
          const rightTime = new Date(right.created_at || `${toDateOnly(right.data)}T00:00:00`).getTime()
          return rightTime - leftTime
        })
        .slice(0, 5)
        .map((row) => {
          const qty = getRecoltareTotalKg(row)
          return {
            id: row.id,
            parcela: parcelaById.get(row.parcela_id ?? '') || 'Parcelă',
            quantity: `${formatNumber(qty)} kg`,
            timestamp: formatTimestamp(row.created_at || `${toDateOnly(row.data)}T12:00:00`),
          }
        }),
    [parcelaById, recoltariDashboard]
  )

  const criticalStocks = useMemo(
    () =>
      [...stocuri]
        .filter((row) => row.total_kg <= STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG)
        .sort((left, right) => left.total_kg - right.total_kg)
        .slice(0, 5)
        .map((row) => ({
          id: `${row.locatie_id}:${row.produs}`,
          produs: row.produs,
          locatie: row.locatie_nume || 'Locație',
          quantity: `${formatNumber(row.total_kg)} kg`,
          severity: row.total_kg <= 5 ? ('critical' as const) : ('warning' as const),
        })),
    [stocuri]
  )

  const revenueSeries = useMemo(() => {
    const buckets: number[] = []
    for (let bucketIndex = 7; bucketIndex >= 0; bucketIndex -= 1) {
      const end = new Date()
      end.setHours(23, 59, 59, 999)
      end.setDate(end.getDate() - bucketIndex * 7)
      const start = new Date(end)
      start.setDate(end.getDate() - 6)
      start.setHours(0, 0, 0, 0)
      const startIso = toIsoDate(start)
      const endIso = toIsoDate(end)

      const bucketValue = vanzari.reduce((sum, row) => {
        const date = toDateOnly(row.data)
        if (!date || date < startIso || date > endIso) return sum
        return sum + asNumber(row.cantitate_kg) * asNumber(row.pret_lei_kg)
      }, 0)

      buckets.push(Math.round(bucketValue))
    }
    return buckets
  }, [vanzari])

  const kpiItems = useMemo(
    () =>
      [
        {
          id: 'recoltat-azi',
          label: 'Recoltat azi',
          value: `${formatNumber(totalKgAzi)} kg`,
          meta: totalKgIeri > 0 ? `Ieri: ${formatNumber(totalKgIeri)} kg` : 'Fără referință ieri',
          tone: 'positive' as const,
          metricValue: totalKgAzi,
        },
        {
          id: 'comenzi-active',
          label: 'Comenzi active',
          value: String(comenziActive.length),
          meta: `${formatNumber(kgComenziActive)} kg în curs`,
          metricValue: comenziActive.length,
        },
        {
          id: 'venit-sezon',
          label: 'Venit sezon',
          value: formatCompactKpiMoney(venitSezon),
          meta: 'Sezon curent',
          trendLabel: venitTrend ? `${venitTrend.positive ? '+' : '-'}${Math.round(venitTrend.percent)}% vs sezon anterior` : undefined,
          metricValue: venitSezon,
        },
        {
          id: 'profit-sezon',
          label: 'Profit sezon',
          value: formatCompactKpiMoney(profitSezon),
          meta: 'Venituri minus cheltuieli',
          tone: profitSezon >= 0 ? ('positive' as const) : ('negative' as const),
          trendLabel: profitTrend ? `${profitTrend.positive ? '+' : '-'}${Math.round(profitTrend.percent)}% vs sezon anterior` : undefined,
          metricValue: profitSezon,
        },
        {
          id: 'activitati-azi',
          label: 'Activități azi',
          value: String(activitatiAziCount),
          meta: `${activitatiDashboard.length} activități (teren comercial relevant)`,
          metricValue: activitatiAziCount,
        },
      ]
        .filter((item) => item.metricValue !== null && item.metricValue !== 0)
        .map((item) => ({
          id: item.id,
          label: item.label,
          value: item.value,
          meta: item.meta,
          tone: item.tone,
          trendLabel: item.trendLabel,
        })),
    [
      activitatiDashboard.length,
      activitatiAziCount,
      comenziActive.length,
      kgComenziActive,
      profitSezon,
      profitTrend,
      totalKgAzi,
      totalKgIeri,
      venitSezon,
      venitTrend,
    ]
  )

  const treatmentIntervalByParcela = useMemo(() => {
    const byParcela = new Map<string, number>()

    for (const cultura of treatmentIntervalsQuery.data ?? EMPTY_LIST) {
      if (!cultura?.solar_id || cultura.activa === false) continue
      const interval = Number(cultura.interval_tratament_zile)
      if (!Number.isFinite(interval) || interval <= 0) continue
      const previousInterval = byParcela.get(cultura.solar_id)
      if (!previousInterval || interval < previousInterval) {
        byParcela.set(cultura.solar_id, interval)
      }
    }

    return byParcela
  }, [treatmentIntervalsQuery.data])

  const dashboardRawData = useMemo<DashboardRawData>(() => {
    return {
      currentDay,
      todayIso,
      yesterdayIso,
      tomorrowIso,
      seasonStartIso,
      previousSeasonStartIso,
      previousSeasonEndIso,
      parceleDashboard: dashboardRelevantParcele,
      activitatiDashboard,
      recoltariDashboard,
      comenzi,
      stocuri,
      vanzari,
      cheltuieli,
      meteo: meteo.data,
      treatmentIntervalByParcela,
      nextTreatmentSuggestions: nextTreatmentSuggestionQuery.data ?? null,
    }
  }, [
    activitatiDashboard,
    cheltuieli,
    comenzi,
    currentDay,
    dashboardRelevantParcele,
    meteo.data,
    recoltariDashboard,
    seasonStartIso,
      stocuri,
      todayIso,
      tomorrowIso,
      nextTreatmentSuggestionQuery.data,
      vanzari,
      yesterdayIso,
      previousSeasonEndIso,
      previousSeasonStartIso,
    treatmentIntervalByParcela,
  ])

  const parcelStates = useMemo(
    () => buildParcelDashboardStates(dashboardRawData),
    [dashboardRawData],
  )

  const dashboardTasks = useMemo<DashboardTaskItem[]>(
    () => buildDashboardTasks(dashboardRawData, parcelStates),
    [dashboardRawData, parcelStates],
  )

  const dashboardAlerts = useMemo(
    () => buildDashboardAlerts(dashboardRawData, parcelStates),
    [dashboardRawData, parcelStates],
  )

  const parcelAttentionItems = useMemo(
    () => parcelStates
      .filter((parcel) => parcel.attentionFlags.length > 0 || parcel.status_operational !== 'activ')
      .sort((left, right) => {
        const rightScore = parcelAttentionScore(right.attentionFlags, right.status_operational)
        const leftScore = parcelAttentionScore(left.attentionFlags, left.status_operational)
        if (rightScore !== leftScore) return rightScore - leftScore
        const rightDays = right.daysSinceAnyActivity ?? -1
        const leftDays = left.daysSinceAnyActivity ?? -1
        return rightDays - leftDays
      })
      .slice(0, 4),
    [parcelStates],
  )

  const smartActions = useMemo<SmartAction[]>(() => {
    return buildSmartActions({
      dashboardAlerts,
      parcelStates,
      comenziActiveCount: comenziActive.length,
    })
  }, [comenziActive.length, dashboardAlerts, parcelStates])

  const ordersTodayCount = useMemo(
    () =>
      comenzi.filter((row) => {
        const deliveryDate = toDateOnly(row.data_livrare)
        return deliveryDate === todayIso && row.status !== 'livrata' && row.status !== 'anulata'
      }).length,
    [comenzi, todayIso],
  )

  const recommendationItems = useMemo<DashboardRecommendationItem[]>(
    () =>
      buildDashboardRecommendations({
        meteo: meteo.data,
        tasks: dashboardTasks,
        alerts: dashboardAlerts,
        primaryContext: farmContext.primaryContext,
        microclimate: dashboardMicroclimate,
        parcelAttentionItems: parcelAttentionItems.map((p) => ({
          displayName: p.displayName,
          attentionFlags: p.attentionFlags,
        })),
        plannedActivitiesCount: plannedActivities.length,
        criticalStockCount: criticalStocks.length,
        nextTreatmentSuggestion: nextTreatmentSuggestionQuery.data?.primary ?? null,
      }),
    [
      criticalStocks.length,
      dashboardAlerts,
      dashboardTasks,
      dashboardMicroclimate,
      farmContext.primaryContext,
      meteo.data,
      nextTreatmentSuggestionQuery.data?.primary,
      parcelAttentionItems,
      plannedActivities.length,
    ],
  )

  const recommendationIds = useMemo(
    () => new Set(recommendationItems.map((item) => item.id)),
    [recommendationItems],
  )

  const attentionNowItems = useMemo<DashboardAttentionItem[]>(
    () =>
      buildAttentionNowItems({
        alerts: dashboardAlerts,
        tasks: dashboardTasks,
        parcelAttentionItems: parcelAttentionItems.map((p) => ({
          parcelaId: p.parcelaId,
          displayName: p.displayName,
          attentionFlags: p.attentionFlags,
        })),
        recommendationIds,
        hasNextTreatmentSuggestionCard: Boolean(nextTreatmentSuggestionQuery.data?.primary),
      }),
    [
      dashboardAlerts,
      dashboardTasks,
      parcelAttentionItems,
      recommendationIds,
      nextTreatmentSuggestionQuery.data?.primary,
    ],
  )

  const recommendationsConfidenceHint = useMemo(() => {
    if (farmContext.primaryContext !== 'solar') return null
    if (dashboardMicroclimate.isRecent) return 'Date actualizate — recomandările sunt precise'
    return 'Recomandările sunt estimate — nu există date din solar'
  }, [dashboardMicroclimate.isRecent, farmContext.primaryContext])

  const recommendationsBoostHint = useMemo(() => {
    if (farmContext.primaryContext !== 'solar') return null
    if (dashboardMicroclimate.isRecent) return null
    return 'Pentru recomandări mai precise, introdu date din teren'
  }, [dashboardMicroclimate.isRecent, farmContext.primaryContext])

  const contextualQuickActions = useMemo<DashboardQuickActionItem[]>(() => {
    const primaryActionHrefs = new Set(DASHBOARD_PRIMARY_QUICK_ACTIONS.map((action) => action.href))

    return smartActions
      .filter((action) => !primaryActionHrefs.has(action.href))
      .map((action) => ({
        id: action.id,
        label: action.label,
        hint: action.hint,
        href: action.href,
      }))
      .slice(0, 2)
  }, [smartActions])

  const todayOverviewStats = useMemo<DashboardTodayStatItem[]>(
    () => [
      {
        id: 'today-orders',
        label: 'Livrări',
        value: String(ordersTodayCount),
        meta: ordersTodayCount === 1 ? '1 pentru azi' : 'Programate pentru azi',
      },
      {
        id: 'today-activities',
        label: 'Activități',
        value: String(activitatiAziCount),
        meta: 'Lucrări pe teren',
      },
      {
        id: 'today-harvest',
        label: 'Recoltat',
        value: `${formatNumber(totalKgAzi)} kg`,
        meta: recoltariAzi.length > 0 ? `${recoltariAzi.length} înregistrări azi` : 'Fără intrări azi',
      },
    ],
    [activitatiAziCount, ordersTodayCount, recoltariAzi.length, totalKgAzi],
  )

  const todayFocusItems = useMemo<DashboardAttentionItem[]>(
    () =>
      dashboardTasks.slice(0, 3).map((task) => ({
        id: task.id,
        label: task.text,
        detail: undefined,
        tone:
          task.tone === 'urgent' ? 'critical' : task.tone === 'warning' ? 'warning' : 'info',
        badge: task.tag,
      })),
    [dashboardTasks],
  )

  const farmPulseSections = useMemo(
    () => [
      {
        id: 'orders',
        title: 'Comenzi recente',
        href: '/comenzi',
        emptyLabel: 'Nu există comenzi recente în datele curente.',
        items: recentOrders.slice(0, 3).map((item) => ({
          id: item.id,
          title: item.client,
          meta: item.deliveryDate,
          value: item.quantity,
        })),
      },
      {
        id: 'harvests',
        title: 'Recoltări recente',
        href: '/recoltari',
        emptyLabel: 'Nu există recoltări recente în datele curente.',
        items: recentHarvests.slice(0, 3).map((item) => ({
          id: item.id,
          title: item.parcela,
          meta: item.timestamp,
          value: item.quantity,
          tone: 'success' as const,
        })),
      },
      {
        id: 'stocks',
        title: 'Stoc critic',
        href: '/stocuri',
        emptyLabel: 'Nu există produse sub pragul critic configurat.',
        items: criticalStocks.slice(0, 3).map((item) => ({
          id: item.id,
          title: item.produs,
          meta: item.locatie,
          value: item.quantity,
          tone: item.severity,
        })),
      },
    ],
    [criticalStocks, recentHarvests, recentOrders],
  )

  const widgetEmptyState = useMemo<Record<DashboardWidgetId, boolean>>(
    () => ({
      'kpi-summary': isWidgetEmpty('kpi-summary', {
        kpiItemsCount: kpiItems.length,
        recentOrdersCount: recentOrders.length,
        plannedActivitiesCount: plannedActivities.length,
        recentHarvestsCount: recentHarvests.length,
        criticalStocksCount: stocuri.filter(
          (row) => row.total_kg <= STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG,
        ).length,
        venitSezon,
        revenueSeries,
      }),
      'comenzi-recente': isWidgetEmpty('comenzi-recente', {
        kpiItemsCount: kpiItems.length,
        recentOrdersCount: recentOrders.length,
        plannedActivitiesCount: plannedActivities.length,
        recentHarvestsCount: recentHarvests.length,
        criticalStocksCount: stocuri.filter(
          (row) => row.total_kg <= STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG,
        ).length,
        venitSezon,
        revenueSeries,
      }),
      'activitati-planificate': isWidgetEmpty('activitati-planificate', {
        kpiItemsCount: kpiItems.length,
        recentOrdersCount: recentOrders.length,
        plannedActivitiesCount: plannedActivities.length,
        recentHarvestsCount: recentHarvests.length,
        criticalStocksCount: stocuri.filter(
          (row) => row.total_kg <= STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG,
        ).length,
        venitSezon,
        revenueSeries,
      }),
      'recoltari-recente': isWidgetEmpty('recoltari-recente', {
        kpiItemsCount: kpiItems.length,
        recentOrdersCount: recentOrders.length,
        plannedActivitiesCount: plannedActivities.length,
        recentHarvestsCount: recentHarvests.length,
        criticalStocksCount: stocuri.filter(
          (row) => row.total_kg <= STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG,
        ).length,
        venitSezon,
        revenueSeries,
      }),
      'stocuri-critice': isWidgetEmpty('stocuri-critice', {
        kpiItemsCount: kpiItems.length,
        recentOrdersCount: recentOrders.length,
        plannedActivitiesCount: plannedActivities.length,
        recentHarvestsCount: recentHarvests.length,
        criticalStocksCount: stocuri.filter(
          (row) => row.total_kg <= STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG,
        ).length,
        venitSezon,
        revenueSeries,
      }),
      'sumar-venituri': isWidgetEmpty('sumar-venituri', {
        kpiItemsCount: kpiItems.length,
        recentOrdersCount: recentOrders.length,
        plannedActivitiesCount: plannedActivities.length,
        recentHarvestsCount: recentHarvests.length,
        criticalStocksCount: stocuri.filter(
          (row) => row.total_kg <= STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG,
        ).length,
        venitSezon,
        revenueSeries,
      }),
    }),
    [kpiItems.length, plannedActivities.length, recentHarvests.length, recentOrders.length, revenueSeries, stocuri, venitSezon],
  )

  const taskListLoading =
    isLoading || (dashboardParcelaIds.length > 0 && treatmentIntervalsQuery.isLoading && !treatmentIntervalsQuery.data)

  const showWelcomeCard = dashboardRelevantParcele.length === 0 && !hideOnboarding

  const renderWidget = useCallback(
    (widgetId: DashboardWidgetId, inEditMode: boolean) => {
      const disableWidget = DASHBOARD_WIDGET_META[widgetId].removable
        ? () => {
            setDraftLayout((current) => {
              const base = current ?? savedLayout
              return {
                ...base,
                widgets: base.widgets.map((widget) =>
                  widget.id === widgetId ? { ...widget, active: false } : widget
                ),
              }
            })
          }
        : undefined

      switch (widgetId) {
        case 'kpi-summary':
          return <KpiSummaryWidget editMode={inEditMode} items={kpiItems} />
        case 'comenzi-recente':
          return (
            <ComenziRecenteWidget
              editMode={inEditMode}
              items={recentOrders}
              empty={widgetEmptyState[widgetId]}
              onDisable={disableWidget}
            />
          )
        case 'activitati-planificate':
          return (
            <ActivitatiPlanificateWidget
              editMode={inEditMode}
              items={plannedActivities}
              empty={widgetEmptyState[widgetId]}
              onDisable={disableWidget}
            />
          )
        case 'recoltari-recente':
          return (
            <RecoltariRecenteWidget
              editMode={inEditMode}
              items={recentHarvests}
              empty={widgetEmptyState[widgetId]}
              onDisable={disableWidget}
            />
          )
        case 'stocuri-critice':
          return (
            <StocuriCriticeWidget
              editMode={inEditMode}
              items={criticalStocks}
              empty={widgetEmptyState[widgetId]}
              onDisable={disableWidget}
            />
          )
        case 'sumar-venituri':
          return (
            <SumarVenituriWidget
              editMode={inEditMode}
              empty={widgetEmptyState[widgetId]}
              total={`${formatMoney(venitSezon)} RON`}
              previous={`${formatMoney(venitSezonAnterior)} RON`}
              periodLabel="Sezon curent"
              trendLabel={venitTrend ? `${venitTrend.positive ? '+' : '-'}${Math.round(venitTrend.percent)}%` : null}
              series={revenueSeries}
              onDisable={disableWidget}
            />
          )
        default:
          return null
      }
    },
    [
      criticalStocks,
      kpiItems,
      plannedActivities,
      recentHarvests,
      recentOrders,
      revenueSeries,
      savedLayout,
      venitSezon,
      venitSezonAnterior,
      venitTrend,
      widgetEmptyState,
    ]
  )

  const activeWidgets = useMemo(
    () => sortDashboardWidgetsForDisplay(currentLayout.widgets.filter((widget) => widget.active)),
    [currentLayout.widgets]
  )
  const desktopWidgets = useMemo(
    () => activeWidgets.filter((widget) => editMode || !widgetEmptyState[widget.id]),
    [activeWidgets, editMode, widgetEmptyState]
  )
  const desktopGridWidgets = useMemo(
    () =>
      editMode
        ? desktopWidgets
        : desktopWidgets.filter((widget) => widget.id !== 'kpi-summary' && widget.id !== 'sumar-venituri'),
    [desktopWidgets, editMode]
  )
  const inactiveWidgets = useMemo(
    () => currentLayout.widgets.filter((widget) => !widget.active && DASHBOARD_WIDGET_META[widget.id].removable),
    [currentLayout.widgets]
  )

  const handleLayoutChange = useCallback(
    (nextLayout: readonly { i: string; x: number; y: number; w: number; h: number }[]) => {
      if (!editMode) return

      const nextById = new Map(nextLayout.map((item) => [item.i as DashboardWidgetId, item]))
      setDraftLayout((current) => {
        const base = current ?? savedLayout
        return {
          ...base,
          widgets: base.widgets.map((widget) => {
            const nextItem = nextById.get(widget.id)
            if (!nextItem || widget.static) return widget
            return {
              ...widget,
              x: nextItem.x,
              y: nextItem.y,
              w: nextItem.w,
              h: nextItem.h,
            }
          }),
        }
      })
    },
    [editMode, savedLayout]
  )

  const addWidget = useCallback((widgetId: DashboardWidgetId) => {
    setDraftLayout((current) => {
      const base = current ?? savedLayout
      return {
        ...base,
        widgets: base.widgets.map((widget) =>
          widget.id === widgetId ? { ...widget, active: true } : widget
        ),
      }
    })
    setAddWidgetOpen(false)
  }, [savedLayout])

  const savedLayoutJson = useMemo(() => getComparableLayoutJson(savedLayout), [savedLayout])
  const currentLayoutJson = useMemo(() => getComparableLayoutJson(currentLayout), [currentLayout])
  const hasUnsavedChanges = savedLayoutJson !== currentLayoutJson

  return (
    <AppShell
      header={
        <PageHeader
          title={`${greeting} 👋`}
          subtitle={todayLabel}
          contentVariant="analytics"
          headerClassName="dashboard-premium-header"
          expandRightSlotOnMobile={editMode}
          stackMobileRightSlotBelowTitle={editMode}
          rightSlot={
            <div className="dashboard-header-actions hidden max-w-full flex-wrap items-center justify-end gap-x-1.5 gap-y-2 sm:gap-x-2 md:flex">
              {!editMode ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 rounded-xl border-[color:color-mix(in_srgb,var(--text-on-accent)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--text-on-accent)_12%,transparent)] px-2.5 text-xs font-semibold text-[var(--text-on-accent)] shadow-[var(--shadow-soft)] backdrop-blur-sm hover:bg-[color:color-mix(in_srgb,var(--text-on-accent)_20%,transparent)] sm:px-3 sm:text-sm"
                  onClick={() => {
                    setDraftLayout(savedLayout)
                    setEditMode(true)
                  }}
                >
                  ✏️ Editează
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="Adaugă widget"
                    className="h-8 shrink-0 gap-1 rounded-xl border-[color:color-mix(in_srgb,var(--text-on-accent)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--text-on-accent)_12%,transparent)] px-2.5 text-xs font-semibold text-[var(--text-on-accent)] backdrop-blur-sm hover:bg-[color:color-mix(in_srgb,var(--text-on-accent)_20%,transparent)] sm:px-3 sm:text-sm"
                    onClick={() => setAddWidgetOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Widget</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 shrink-0 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-2.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-card-muted)] sm:px-3 sm:text-sm"
                    onClick={() => saveLayoutMutation.mutate()}
                    disabled={!hasUnsavedChanges || saveLayoutMutation.isPending}
                  >
                    Salvează
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 rounded-xl border-[color:color-mix(in_srgb,var(--text-on-accent)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--text-on-accent)_12%,transparent)] px-2.5 text-xs font-semibold text-[var(--text-on-accent)] backdrop-blur-sm hover:bg-[color:color-mix(in_srgb,var(--text-on-accent)_20%,transparent)] sm:px-3 sm:text-sm"
                    onClick={() => {
                      setDraftLayout(null)
                      setEditMode(false)
                    }}
                  >
                    Anulează
                  </Button>
                </>
              )}
            </div>
          }
        />
      }
    >
      <DashboardContentShell variant="analytics" className="dashboard-premium-scope pb-32 pt-0 sm:pb-28 sm:pt-1 md:pb-24">
        {hasError ? <ErrorState title="Eroare dashboard" message={errorMessage ?? 'Nu am putut încărca datele.'} /> : null}
        {isLoading ? <LoadingState label="Se încarcă dashboard..." /> : null}

        {!isLoading ? (
          <>
            {showWelcomeCard ? (
              <div className="dashboard-stack-welcome">
                <WelcomeCard
                  onAddTerrain={() => router.push('/parcele')}
                  onDismiss={() => dismissOnboardingMutation.mutate()}
                />
              </div>
            ) : null}

            <div className="dashboard-stack-meteo md:hidden">
              <MeteoDashboardCard
                data={meteo.data}
                loading={meteo.loading}
                error={meteo.error}
                primaryContext={farmContext.primaryContext}
                microclimate={dashboardMicroclimate}
                className="dashboard-meteo-hero"
              />
            </div>

            <div className="mb-[var(--dashboard-stack-gap)] hidden md:block md:space-y-[var(--dashboard-stack-gap)]">
              <div className="grid gap-4 xl:grid-cols-12">
                <div className="xl:col-span-5">
                  <TaskList
                    tasks={dashboardTasks}
                    loading={taskListLoading}
                    title="Ce ai de făcut azi"
                    className="dashboard-task-list"
                  />
                </div>
                <div className="xl:col-span-3">
                  <MeteoDashboardCard
                    compact
                    data={meteo.data}
                    loading={meteo.loading}
                    error={meteo.error}
                    primaryContext={farmContext.primaryContext}
                    microclimate={dashboardMicroclimate}
                    className="dashboard-meteo-hero h-full"
                  />
                </div>
                <div className="xl:col-span-4">
                  {attentionNowItems.length > 0 ? (
                    <DashboardAttentionCard items={attentionNowItems} />
                  ) : (
                    <DashboardRecommendationsCard
                      items={recommendationItems}
                      helperText={recommendationsConfidenceHint ?? undefined}
                      boostText={recommendationsBoostHint ?? undefined}
                    />
                  )}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <DashboardNextTreatmentCard
                  primary={nextTreatmentSuggestionQuery.data?.primary ?? null}
                  secondary={nextTreatmentSuggestionQuery.data?.secondary ?? null}
                  loading={nextTreatmentSuggestionQuery.isLoading && !nextTreatmentSuggestionQuery.data}
                />
                <DashboardComenziSnapshotCard
                  activeCount={comenziActive.length}
                  kgInCursLabel={`${formatNumber(kgComenziActive)} kg în curs`}
                  previewClient={recentOrders[0]?.client}
                  previewMeta={recentOrders[0]?.deliveryDate}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <DashboardCommercialSnapshotCard
                  mode={associationShopApproved ? 'association' : 'farmer'}
                  href={
                    associationShopApproved
                      ? '/magazin/asociatie'
                      : tenantId
                        ? `/magazin/${tenantId}`
                        : '/magazin'
                  }
                />
                <DashboardFarmPulseCard sections={farmPulseSections} footnote={DASHBOARD_SCOPE_FOOTNOTE} />
              </div>

              <div>
                <DashboardQuickActionsCard
                  primaryActions={DASHBOARD_PRIMARY_QUICK_ACTIONS}
                  contextualActions={contextualQuickActions}
                />
              </div>

              {!editMode ? (
                <DashboardUnifiedFinancialCard
                  kpiItems={kpiItems}
                  empty={widgetEmptyState['kpi-summary'] && widgetEmptyState['sumar-venituri']}
                  total={`${formatMoney(venitSezon)} RON`}
                  previous={`${formatMoney(venitSezonAnterior)} RON`}
                  periodLabel="Sezon curent"
                  trendLabel={venitTrend ? `${venitTrend.positive ? '+' : '-'}${Math.round(venitTrend.percent)}%` : null}
                  series={revenueSeries}
                />
              ) : null}
            </div>

            <div className="mb-[var(--dashboard-stack-gap)] grid gap-4 md:hidden">
              <DashboardNextTreatmentCard
                primary={nextTreatmentSuggestionQuery.data?.primary ?? null}
                secondary={nextTreatmentSuggestionQuery.data?.secondary ?? null}
                loading={nextTreatmentSuggestionQuery.isLoading && !nextTreatmentSuggestionQuery.data}
              />
              {attentionNowItems.length > 0 ? (
                <DashboardAttentionCard items={attentionNowItems} />
              ) : null}
              <DashboardRecommendationsCard
                items={recommendationItems}
                helperText={recommendationsConfidenceHint ?? undefined}
                boostText={recommendationsBoostHint ?? undefined}
              />
              <DashboardTodayCard stats={todayOverviewStats} focusItems={todayFocusItems} />
              <DashboardFarmPulseCard sections={farmPulseSections} footnote={DASHBOARD_SCOPE_FOOTNOTE} />
              <DashboardQuickActionsCard
                primaryActions={DASHBOARD_PRIMARY_QUICK_ACTIONS}
                contextualActions={contextualQuickActions}
              />
              {!editMode ? (
                <DashboardUnifiedFinancialCard
                  kpiItems={kpiItems}
                  empty={widgetEmptyState['kpi-summary'] && widgetEmptyState['sumar-venituri']}
                  total={`${formatMoney(venitSezon)} RON`}
                  previous={`${formatMoney(venitSezonAnterior)} RON`}
                  periodLabel="Sezon curent"
                  trendLabel={venitTrend ? `${venitTrend.positive ? '+' : '-'}${Math.round(venitTrend.percent)}%` : null}
                  series={revenueSeries}
                />
              ) : null}
            </div>

            <div className="hidden md:block">
              <DashboardGridLayout
                className="dashboard-grid-layout"
                layout={toReactGridLayout(desktopGridWidgets)}
                cols={12}
                rowHeight={84}
                margin={[24, 24]}
                containerPadding={[0, 0]}
                isDraggable={editMode}
                isResizable={editMode}
                compactType="vertical"
                useCSSTransforms
                draggableHandle=".dashboard-widget-handle"
                onLayoutChange={handleLayoutChange}
              >
                {desktopGridWidgets.map((widget) => (
                  <div key={widget.id} className="h-full">
                    {renderWidget(widget.id, editMode)}
                  </div>
                ))}
              </DashboardGridLayout>
            </div>

          </>
        ) : null}
      </DashboardContentShell>

      <Dialog open={addWidgetOpen} onOpenChange={setAddWidgetOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Adaugă Widget</DialogTitle>
            <DialogDescription>Alege un widget inactiv pe care vrei să-l readuci în dashboard.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {inactiveWidgets.length > 0 ? (
              inactiveWidgets.map((widget) => (
                <button
                  key={widget.id}
                  type="button"
                  onClick={() => addWidget(widget.id)}
                  className="flex w-full items-start justify-between gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-4 text-left transition hover:border-[color:color-mix(in_srgb,var(--focus-ring)_35%,var(--border-default))] hover:bg-[var(--surface-card-muted)]"
                >
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{DASHBOARD_WIDGET_META[widget.id].title}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{DASHBOARD_WIDGET_META[widget.id].description}</div>
                  </div>
                  <span className="rounded-full border border-[var(--info-border)] bg-[var(--info-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--info-text)]">
                    Activează
                  </span>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--surface-card-muted)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                Toate widget-urile disponibile sunt deja active.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddWidgetOpen(false)}>
              Închide
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
