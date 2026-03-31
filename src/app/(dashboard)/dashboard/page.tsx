'use client'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

import { useCallback, useEffect, useMemo, useState } from 'react'
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { AppShell } from '@/components/app/AppShell'
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
import { trackEvent } from '@/lib/analytics/trackEvent'
import { STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG } from '@/lib/calculations/stock-audit-thresholds'
import { useMeteo } from '@/hooks/useMeteo'
import { queryKeys } from '@/lib/query-keys'
import { getSupabase } from '@/lib/supabase/client'
import { getActivitatiAgricole } from '@/lib/supabase/queries/activitati-agricole'
import { getCheltuieli } from '@/lib/supabase/queries/cheltuieli'
import { getComenzi } from '@/lib/supabase/queries/comenzi'
import { getStocuriPeLocatii } from '@/lib/supabase/queries/miscari-stoc'
import { getParcele } from '@/lib/supabase/queries/parcele'
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

/** Ordinea comercială pe mobil (desktop rămâne grid + persistență). */
const MOBILE_COMMERCIAL_WIDGET_ORDER: DashboardWidgetId[] = [
  'kpi-summary',
  'comenzi-recente',
  'recoltari-recente',
  'stocuri-critice',
  'sumar-venituri',
  'activitati-planificate',
]

const MOBILE_OPERATIONAL_WIDGET_IDS: DashboardWidgetId[] = [
  'comenzi-recente',
  'recoltari-recente',
  'stocuri-critice',
]

const DASHBOARD_SCOPE_FOOTNOTE =
  'Pe parcelele tale comerciale din dashboard apar recolta și ce ține de teren. Comenzi, stoc și sumarul financiar arată întreaga fermă.'

type DashboardParcela = Awaited<ReturnType<typeof getParcele>>[number]
type DashboardCulturaTreatmentInterval = Pick<
  Tables<'culturi'>,
  'id' | 'solar_id' | 'activa' | 'interval_tratament_zile'
>
type SmartAction = { id: string; label: string; hint: string; href: string }
type AlertConcern = DashboardAlert['category'] | 'tratamente' | 'parcele'

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

function getGreeting(value: Date): string {
  const h = value.getHours()
  if (h < 12) return 'Bună dimineața'
  if (h < 18) return 'Bună ziua'
  return 'Bună seara'
}

function severityTone(alert: DashboardAlert): string {
  if (alert.severity === 'critical') return 'border-[rgba(207,34,46,0.22)] bg-[rgba(207,34,46,0.08)] text-[#8f1d26]'
  if (alert.severity === 'warning') return 'border-[rgba(179,90,0,0.24)] bg-[rgba(179,90,0,0.08)] text-[#8a4500]'
  return 'border-[rgba(24,104,219,0.2)] bg-[rgba(24,104,219,0.08)] text-[#1852a8]'
}

function severityLabel(alert: DashboardAlert): string {
  if (alert.severity === 'critical') return 'Critică'
  if (alert.severity === 'warning') return 'Atenție'
  return 'De urmărit'
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

function primaryParcelAttentionReason(parcel: {
  attentionFlags: string[]
  status_operational: string | null
}): string {
  if (parcel.attentionFlags.includes('treatment_overdue')) return 'Tratament depășit'
  if (parcel.attentionFlags.includes('treatment_due_soon')) return 'Tratament scadent curând'
  if (parcel.attentionFlags.includes('pause_active')) return 'Pauză de tratament activă'
  if (parcel.attentionFlags.includes('no_recent_activity')) return 'Fără activitate recentă'
  return parcel.status_operational && parcel.status_operational !== 'activ'
    ? 'Status operațional de urmărit'
    : 'Necesită verificare'
}

function mapTaskToConcerns(taskId: string): AlertConcern[] {
  if (taskId.startsWith('comenzi:')) return ['comenzi']
  if (taskId.startsWith('stoc:')) return ['stoc']
  if (taskId.startsWith('tratament:')) return ['tratamente']
  if (taskId === 'pauza:activa') return ['parcele', 'tratamente']
  if (taskId === 'parcele:fara-activitate') return ['parcele']
  return []
}

function buildVisibleAlerts(
  alerts: DashboardAlert[],
  tasks: DashboardTaskItem[],
): DashboardAlert[] {
  const concernSet = new Set<AlertConcern>()
  for (const task of tasks) {
    for (const concern of mapTaskToConcerns(task.id)) {
      concernSet.add(concern)
    }
  }

  return alerts
    .filter((alert) => {
      // Keep meteo alerts visible: they are informational context, not operational tasks.
      if (alert.category === 'meteo') return true
      return !concernSet.has(alert.category)
    })
    .slice(0, 4)
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
  const { userId } = useDashboardAuth()
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
    ;['/parcele', '/activitati-agricole', '/recoltari', '/vanzari', '/comenzi', '/stocuri'].forEach((href) => {
      router.prefetch(href)
    })
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
          detail: row.produs_utilizat ? `Produs: ${row.produs_utilizat}` : 'Fără produs specificat',
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

  const visibleAlerts = useMemo(
    () => buildVisibleAlerts(dashboardAlerts, dashboardTasks),
    [dashboardAlerts, dashboardTasks],
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
  const mobileWidgets = useMemo(
    () => activeWidgets.filter((widget) => !widgetEmptyState[widget.id]),
    [activeWidgets, widgetEmptyState]
  )
  const mobileWidgetIdSet = useMemo(() => new Set(mobileWidgets.map((w) => w.id)), [mobileWidgets])
  const mobileWidgetsCommercialOrder = useMemo(
    () => MOBILE_COMMERCIAL_WIDGET_ORDER.filter((id) => mobileWidgetIdSet.has(id)),
    [mobileWidgetIdSet]
  )
  const mobileOperationalWidgets = useMemo(
    () => MOBILE_OPERATIONAL_WIDGET_IDS.filter((id) => mobileWidgetIdSet.has(id)),
    [mobileWidgetIdSet]
  )
  const mobilePulseWidgets = useMemo(
    () => mobileWidgetsCommercialOrder.filter((id) => id === 'sumar-venituri'),
    [mobileWidgetsCommercialOrder]
  )
  const mobileSecondaryWidgets = useMemo(
    () => mobileWidgetsCommercialOrder.filter((id) => id === 'activitati-planificate'),
    [mobileWidgetsCommercialOrder]
  )
  const showMobileKpi = mobileWidgetIdSet.has('kpi-summary')
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
                  className="h-8 shrink-0 rounded-xl border-white/40 bg-white/10 px-2.5 text-xs font-semibold text-white shadow-[0_2px_12px_rgba(0,0,0,0.12)] backdrop-blur-sm hover:bg-white/20 sm:px-3 sm:text-sm"
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
                    className="h-8 shrink-0 gap-1 rounded-xl border-white/40 bg-white/10 px-2.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/20 sm:px-3 sm:text-sm"
                    onClick={() => setAddWidgetOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Widget</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 shrink-0 rounded-xl border border-white/30 bg-white px-2.5 text-xs font-semibold text-emerald-900 hover:bg-emerald-50 sm:px-3 sm:text-sm"
                    onClick={() => saveLayoutMutation.mutate()}
                    disabled={!hasUnsavedChanges || saveLayoutMutation.isPending}
                  >
                    Salvează
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 rounded-xl border-white/40 bg-white/10 px-2.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/20 sm:px-3 sm:text-sm"
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
      <div className="dashboard-premium-scope mx-auto max-w-7xl px-1 pb-24 pt-0 sm:px-0 sm:pt-1">
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

            <div className="dashboard-stack-meteo">
              <MeteoDashboardCard
                data={meteo.data}
                loading={meteo.loading}
                error={meteo.error}
                className="dashboard-meteo-hero"
              />
            </div>

            {visibleAlerts.length > 0 ? (
              <div className="mb-3">
                <div className="rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 py-3 shadow-[var(--agri-shadow)]">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--agri-text-muted)]">
                    Ce cere atenție acum
                  </div>
                  <div className="space-y-2">
                    {visibleAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs ${severityTone(alert)}`}
                      >
                        <span className="font-medium">{alert.message}</span>
                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.06em]">
                          {severityLabel(alert)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {smartActions.length > 0 ? (
              <section className="mb-3 rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 py-3 shadow-[var(--agri-shadow)] md:hidden">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--agri-text-muted)]">
                  Poți face acum
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {smartActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => router.push(action.href)}
                      className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)]/35 px-3 py-2 text-left transition hover:border-[var(--agri-primary)]/40 hover:bg-[var(--agri-surface-muted)]"
                    >
                      <p className="text-xs font-semibold text-[var(--agri-text)]">{action.label}</p>
                      <p className="mt-1 text-[11px] text-[var(--agri-text-muted)]">{action.hint}</p>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="space-y-3 md:hidden">
              {showMobileKpi ? <div className="dashboard-stack-kpi">{renderWidget('kpi-summary', false)}</div> : null}

              <TaskList
                tasks={dashboardTasks}
                loading={taskListLoading}
                title="Ce ai de făcut azi"
                className="dashboard-task-list"
              />

              {parcelAttentionItems.length > 0 ? (
                <section className="rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 py-3 shadow-[var(--agri-shadow)]">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--agri-text-muted)]">
                    Terenuri de urmărit
                  </div>
                  <div className="space-y-2">
                    {parcelAttentionItems.map((parcel) => (
                      <div
                        key={parcel.parcelaId}
                        className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)]/35 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[var(--agri-text)]">{parcel.displayName}</p>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--agri-text-muted)]">
                            {parcel.status_operational}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--agri-text-muted)]">
                          {primaryParcelAttentionReason(parcel)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {mobileOperationalWidgets.length > 0 ? (
                <section className="dashboard-op-zone" aria-label="Zonă operațională">
                  <div className="dashboard-section-head">
                    <span className="dashboard-section-eyebrow">În fermă și pe teren</span>
                    <h2 className="dashboard-section-title">Comenzi, recoltă recentă, stoc</h2>
                    <p className="dashboard-op-zone-hint">
                      Recolta afișată urmărește parcelele comerciale din dashboard; comenzile și stocul cuprind întreaga
                      fermă.
                    </p>
                  </div>
                  <div className="dashboard-op-zone-inner space-y-3">
                    {mobileOperationalWidgets.map((widgetId) => (
                      <div key={widgetId}>{renderWidget(widgetId, false)}</div>
                    ))}
                  </div>
                </section>
              ) : null}

              {mobilePulseWidgets.map((widgetId) => (
                <div key={widgetId} className="dashboard-stack-pulse">
                  {renderWidget(widgetId, false)}
                </div>
              ))}

              {mobileSecondaryWidgets.map((widgetId) => (
                <div key={widgetId}>{renderWidget(widgetId, false)}</div>
              ))}

              <p className="dashboard-scope-footnote rounded-2xl border border-[var(--agri-border)]/60 bg-[var(--agri-surface-muted)]/25 px-3 py-2 text-[11px] leading-snug text-[var(--agri-text-muted)] md:hidden">
                {DASHBOARD_SCOPE_FOOTNOTE}
              </p>
            </div>

            <div className="dashboard-stack-tasks hidden md:block">
              <TaskList
                tasks={dashboardTasks}
                loading={taskListLoading}
                title="Ce ai de făcut azi"
                className="dashboard-task-list"
              />
            </div>

            {smartActions.length > 0 ? (
              <section className="mb-4 hidden rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 py-3 shadow-[var(--agri-shadow)] md:block">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--agri-text-muted)]">
                  Poți face acum
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {smartActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => router.push(action.href)}
                      className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)]/35 px-3 py-2 text-left transition hover:border-[var(--agri-primary)]/40 hover:bg-[var(--agri-surface-muted)]"
                    >
                      <p className="text-xs font-semibold text-[var(--agri-text)]">{action.label}</p>
                      <p className="mt-1 text-[11px] text-[var(--agri-text-muted)]">{action.hint}</p>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {parcelAttentionItems.length > 0 ? (
              <section className="mb-4 hidden rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 py-3 shadow-[var(--agri-shadow)] md:block">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--agri-text-muted)]">
                  Terenuri de urmărit
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {parcelAttentionItems.map((parcel) => (
                    <div
                      key={parcel.parcelaId}
                      className="rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)]/35 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--agri-text)]">{parcel.displayName}</p>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--agri-text-muted)]">
                          {parcel.status_operational}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--agri-text-muted)]">
                        {primaryParcelAttentionReason(parcel)}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <p className="dashboard-scope-footnote mb-4 hidden rounded-2xl border border-[var(--agri-border)]/60 bg-[var(--agri-surface-muted)]/25 px-4 py-3 text-xs leading-snug text-[var(--agri-text-muted)] md:block lg:mb-5">
              {DASHBOARD_SCOPE_FOOTNOTE}
            </p>

            <div className="hidden md:block">
              <DashboardGridLayout
                className="dashboard-grid-layout"
                layout={toReactGridLayout(desktopWidgets)}
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
                {desktopWidgets.map((widget) => (
                  <div key={widget.id} className="h-full">
                    {renderWidget(widget.id, editMode)}
                  </div>
                ))}
              </DashboardGridLayout>
            </div>

          </>
        ) : null}
      </div>

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
                  className="flex w-full items-start justify-between gap-4 rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 py-4 text-left transition hover:border-[var(--agri-primary)]/40 hover:bg-[var(--agri-surface-muted)]"
                >
                  <div>
                    <div className="text-sm font-semibold text-[var(--agri-text)]">{DASHBOARD_WIDGET_META[widget.id].title}</div>
                    <div className="mt-1 text-xs leading-5 text-[var(--agri-text-muted)]">{DASHBOARD_WIDGET_META[widget.id].description}</div>
                  </div>
                  <span className="rounded-full bg-[rgba(45,106,79,0.08)] px-2.5 py-1 text-xs font-semibold text-[var(--agri-primary)]">
                    Activează
                  </span>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--agri-border)] bg-[var(--agri-surface-muted)]/60 px-4 py-8 text-center text-sm text-[var(--agri-text-muted)]">
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
