'use client'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

import { useCallback, useEffect, useMemo, useState } from 'react'
import GridLayout, { WidthProvider } from 'react-grid-layout/legacy'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { ErrorState } from '@/components/app/ErrorState'
import { LoadingState as BaseLoadingState } from '@/components/app/LoadingState'
import { DashboardSkeleton } from '@/components/app/ModuleSkeletons'
import { PageHeader } from '@/components/app/PageHeader'
import { WelcomeCard } from '@/components/dashboard/WelcomeCard'
import {
  ActivitatiPlanificateWidget,
  ComenziRecenteWidget,
  KpiSummaryWidget,
  RecoltariRecenteWidget,
  StocuriCriticeWidget,
  SumarVenituriWidget,
} from '@/components/dashboard/DashboardWidgets'
import { AppShell } from '@/components/app/AppShell'
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
import { STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG } from '@/lib/calculations/stock-audit-thresholds'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { formatUnitateDisplayName } from '@/lib/parcele/unitate'
import { queryKeys } from '@/lib/query-keys'
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
import { getRecoltari } from '@/lib/supabase/queries/recoltari'
import { getVanzari } from '@/lib/supabase/queries/vanzari'
import { toast } from '@/lib/ui/toast'

const DAY_MS = 24 * 60 * 60 * 1000
const EMPTY_LIST: never[] = []
const DashboardGridLayout = WidthProvider(GridLayout)

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

function getIsoDay(offset = 0): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  if (offset !== 0) date.setTime(date.getTime() + offset * DAY_MS)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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

function isActiveParcela(status: string | null): boolean {
  const normalized = String(status ?? '').trim().toLowerCase()
  return !['anulat', 'inactiv', 'inactiva'].includes(normalized)
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bună dimineața'
  if (h < 18) return 'Bună ziua'
  return 'Bună seara'
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
  const [editMode, setEditMode] = useState(false)
  const [addWidgetOpen, setAddWidgetOpen] = useState(false)
  const [draftLayout, setDraftLayout] = useState<DashboardLayoutConfig | null>(null)

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

  const now = new Date()
  const todayIso = getIsoDay(0)
  const yesterdayIso = getIsoDay(-1)
  const tomorrowIso = getIsoDay(1)
  const seasonStartIso = `${now.getFullYear()}-03-01`
  const previousSeasonStartIso = `${now.getFullYear() - 1}-03-01`
  const seasonElapsedDays = Math.max(
    0,
    Math.floor(((parseDateOnly(todayIso)?.getTime() ?? 0) - (parseDateOnly(seasonStartIso)?.getTime() ?? 0)) / DAY_MS)
  )
  const previousSeasonEndDate = parseDateOnly(previousSeasonStartIso) ?? new Date(`${previousSeasonStartIso}T12:00:00`)
  previousSeasonEndDate.setDate(previousSeasonEndDate.getDate() + seasonElapsedDays)
  const previousSeasonEndIso = toIsoDate(previousSeasonEndDate)

  const activeParcele = useMemo(() => parcele.filter((parcela) => isActiveParcela(parcela.status ?? null)), [parcele])
  const parcelaById = useMemo(
    () =>
      new Map(
        activeParcele.map((parcela) => [
          parcela.id,
          formatUnitateDisplayName(parcela.nume_parcela, parcela.tip_unitate),
        ])
      ),
    [activeParcele]
  )

  const recoltariAzi = useMemo(() => recoltari.filter((row) => toDateOnly(row.data) === todayIso), [recoltari, todayIso])
  const recoltariIeri = useMemo(() => recoltari.filter((row) => toDateOnly(row.data) === yesterdayIso), [recoltari, yesterdayIso])
  const totalKgAzi = recoltariAzi.reduce((sum, row) => sum + asNumber(row.kg_cal1) + asNumber(row.kg_cal2), 0)
  const totalKgIeri = recoltariIeri.reduce((sum, row) => sum + asNumber(row.kg_cal1) + asNumber(row.kg_cal2), 0)

  const comenziActive = useMemo(
    () => comenzi.filter((row) => row.status !== 'livrata' && row.status !== 'anulata'),
    [comenzi]
  )
  const kgComenziActive = comenziActive.reduce((sum, row) => sum + asNumber(row.cantitate_kg), 0)
  const activitatiAziCount = activitati.filter((row) => toDateOnly(row.data_aplicare) === todayIso).length

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

  const greetingSummary = useMemo(() => {
    const tomorrowActivity = activitati.find((activity) => toDateOnly(activity.data_aplicare) === tomorrowIso)
    if (tomorrowActivity) {
      const parcelaName = parcelaById.get(tomorrowActivity.parcela_id ?? '') || 'Parcela'
      return `Mâine: ${tomorrowActivity.tip_activitate || 'Activitate'} pe ${parcelaName}`
    }

    const overdueOrders = comenziActive.filter((row) => {
      const deliveryDate = toDateOnly(row.data_livrare)
      return Boolean(deliveryDate) && deliveryDate < todayIso
    })
    if (overdueOrders.length > 0) {
      return `Ai ${overdueOrders.length} ${overdueOrders.length === 1 ? 'comandă restantă' : 'comenzi restante'}`
    }

    return null
  }, [activitati, comenziActive, parcelaById, todayIso, tomorrowIso])

  const todayLabel = new Intl.DateTimeFormat('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

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
      [...activitati]
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
    [activitati, parcelaById, todayIso]
  )

  const recentHarvests = useMemo(
    () =>
      [...recoltari]
        .sort((left, right) => {
          const leftTime = new Date(left.created_at || `${toDateOnly(left.data)}T00:00:00`).getTime()
          const rightTime = new Date(right.created_at || `${toDateOnly(right.data)}T00:00:00`).getTime()
          return rightTime - leftTime
        })
        .slice(0, 5)
        .map((row) => ({
          id: row.id,
          parcela: parcelaById.get(row.parcela_id ?? '') || 'Parcelă',
          quantity: `${formatNumber(asNumber(row.kg_cal1) + asNumber(row.kg_cal2))} kg`,
          timestamp: formatTimestamp(row.created_at || `${toDateOnly(row.data)}T12:00:00`),
        })),
    [parcelaById, recoltari]
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
          meta: `${activitati.length} activități totale`,
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
      activitati.length,
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

  const widgetEmptyState = useMemo<Record<DashboardWidgetId, boolean>>(
    () => ({
      'kpi-summary': kpiItems.length === 0,
      'comenzi-recente': recentOrders.length === 0,
      'activitati-planificate': plannedActivities.length === 0,
      'recoltari-recente': recentHarvests.length === 0,
      'stocuri-critice': criticalStocks.length === 0,
      'sumar-venituri': venitSezon <= 0 && revenueSeries.every((value) => value <= 0),
    }),
    [criticalStocks.length, kpiItems.length, plannedActivities.length, recentHarvests.length, recentOrders.length, revenueSeries, venitSezon]
  )

  const showWelcomeCard = parcele.length === 0 && !hideOnboarding

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
          title={`${getGreeting()} 👋`}
          subtitle={todayLabel}
          summary={
            greetingSummary ? (
              <div className="inline-block max-w-full overflow-hidden rounded-full bg-[rgba(45,106,79,0.08)] px-3 py-1.5 text-xs font-semibold text-[var(--agri-primary)] text-ellipsis whitespace-nowrap">
                {greetingSummary}
              </div>
            ) : null
          }
          rightSlot={
            <div className="flex items-center gap-2">
              {!editMode ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDraftLayout(savedLayout)
                    setEditMode(true)
                  }}
                >
                  ✏️ Editează Dashboard
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => setAddWidgetOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Adaugă Widget
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => saveLayoutMutation.mutate()}
                    disabled={!hasUnsavedChanges || saveLayoutMutation.isPending}
                  >
                    ✅ Salvează
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
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
      <div className="mx-auto max-w-7xl pb-24 pt-1">
        {hasError ? <ErrorState title="Eroare dashboard" message={errorMessage ?? 'Nu am putut încărca datele.'} /> : null}
        {isLoading ? <LoadingState label="Se încarcă dashboard..." /> : null}

        {!isLoading ? (
          <>
            {showWelcomeCard ? (
              <div className="mb-5">
                <WelcomeCard
                  onAddTerrain={() => router.push('/parcele')}
                  onDismiss={() => dismissOnboardingMutation.mutate()}
                />
              </div>
            ) : null}

            <div className="space-y-4 md:hidden">
              {mobileWidgets.map((widget) => (
                <div key={widget.id}>{renderWidget(widget.id, false)}</div>
              ))}
            </div>

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
