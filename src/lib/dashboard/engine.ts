import { compareActivityRecency } from '@/lib/activitati/timeline'
import { getPauseRemainingDays, getPauseUrgency, isPauseActive } from '@/lib/pause-helpers'
import { STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG } from '@/lib/calculations/stock-audit-thresholds'
import type { DashboardWidgetId } from '@/lib/dashboard/layout'
import type { DashboardTreatmentSuggestion } from '@/lib/dashboard/treatment-suggestions'
import { formatUnitateDisplayName } from '@/lib/parcele/unitate'
import type { ActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import type { Cheltuiala } from '@/lib/supabase/queries/cheltuieli'
import type { Comanda } from '@/lib/supabase/queries/comenzi'
import type { Parcela } from '@/lib/supabase/queries/parcele'
import type { Recoltare } from '@/lib/supabase/queries/recoltari'
import type { StocLocationRow } from '@/lib/supabase/queries/miscari-stoc'
import type { Vanzare } from '@/lib/supabase/queries/vanzari'
import type { DashboardTaskItem } from '@/components/dashboard/TaskList'

export interface MeteoData {
  available: boolean
  source?: 'cache' | 'fresh'
  current?: {
    temp: number | null
    icon: string | null
    description: string | null
    windSpeed: number | null
    humidity: number | null
  }
  forecastTomorrow?: {
    tempMin: number | null
    tempMax: number | null
    icon: string | null
    pop: number | null
  }
  spray?: {
    canSpray: boolean
    reason?: string
  }
}

export interface DashboardRawData {
  /** Data de referință pentru calcule (azi în zona utilizatorului). */
  currentDay: Date
  todayIso: string
  yesterdayIso: string
  tomorrowIso: string
  seasonStartIso: string
  previousSeasonStartIso: string
  previousSeasonEndIso: string
  parceleDashboard: Parcela[]
  activitatiDashboard: ActivitateAgricola[]
  recoltariDashboard: Recoltare[]
  comenzi: Comanda[]
  stocuri: StocLocationRow[]
  vanzari: Vanzare[]
  cheltuieli: Cheltuiala[]
  meteo: MeteoData | null
  /** Interval minim de tratament per parcelă comercială (zile). */
  treatmentIntervalByParcela: Map<string, number>
  /**
   * Semnalul V2 are prioritate față de calculul legacy din activități/culturi.
   * Dacă lipsește complet, dashboard-ul păstrează fallback-ul istoric.
   */
  nextTreatmentSuggestions?: {
    primary: DashboardTreatmentSuggestion | null
    secondary: DashboardTreatmentSuggestion | null
  } | null
}

export type TreatmentAttention =
  | 'none'
  | 'due-soon'
  | 'overdue'

export type PauseStatus =
  | 'none'
  | 'active'
  | 'urgent'

export type ParcelAttentionFlag =
  | 'treatment_overdue'
  | 'treatment_due_soon'
  | 'pause_active'
  | 'no_recent_activity'

export interface ParcelDashboardState {
  parcelaId: string
  displayName: string
  tip_unitate: Parcela['tip_unitate']
  status_operational: Parcela['status_operational']
  lastActivity: ActivitateAgricola | null
  lastHarvest: Recoltare | null
  lastTreatment: ActivitateAgricola | null
  daysSinceAnyActivity: number | null
  treatmentIntervalDays: number | null
  treatmentAttention: TreatmentAttention
  pauseStatus: PauseStatus
  pauseDaysRemaining: number
  attentionFlags: ParcelAttentionFlag[]
}

export type DashboardAlertSeverity = 'info' | 'warning' | 'critical'

export type DashboardAlertCategory =
  | 'comenzi'
  | 'stoc'
  | 'parcele'
  | 'tratamente'
  | 'meteo'

export interface DashboardAlert {
  id: string
  category: DashboardAlertCategory
  severity: DashboardAlertSeverity
  message: string
}

function hasV2TreatmentSignal(raw: DashboardRawData): boolean {
  return Boolean(raw.nextTreatmentSuggestions?.primary || raw.nextTreatmentSuggestions?.secondary)
}

function getPrimaryV2TreatmentSuggestion(raw: DashboardRawData): DashboardTreatmentSuggestion | null {
  return raw.nextTreatmentSuggestions?.primary ?? raw.nextTreatmentSuggestions?.secondary ?? null
}

export interface DailySummary {
  greeting: string
  todayLabel: string
  /** Mesaj scurt de tip „headline” pentru ziua curentă. */
  headline: string | null
  /** Motiv meteo / spray, când e relevant. */
  meteoReason: string | null
}

export interface WeatherWindowDay {
  canSpray: boolean | null
  reason: string | null
}

export interface WeatherWindow {
  today: WeatherWindowDay
  tomorrow: {
    tempMin: number | null
    tempMax: number | null
    pop: number | null
  } | null
}

function toDateOnly(value: string | null | undefined): string {
  return (value ?? '').slice(0, 10)
}

function parseDateOnly(value: string | null | undefined): Date | null {
  const dateOnly = toDateOnly(value)
  if (!dateOnly) return null
  const parsed = new Date(`${dateOnly}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getDaysBetween(nowMs: number, isoDate: string | null | undefined): number | null {
  const parsed = parseDateOnly(isoDate)
  if (!parsed) return null
  return Math.max(0, Math.floor((nowMs - parsed.getTime()) / (24 * 60 * 60 * 1000)))
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function buildParcelDashboardStates(raw: DashboardRawData): ParcelDashboardState[] {
  const byParcelaActivities = new Map<string, ActivitateAgricola[]>()
  const byParcelaHarvests = new Map<string, Recoltare[]>()

  for (const activity of raw.activitatiDashboard) {
    const parcelaId = activity.parcela_id ?? ''
    if (!parcelaId) continue
    const bucket = byParcelaActivities.get(parcelaId) ?? []
    bucket.push(activity)
    byParcelaActivities.set(parcelaId, bucket)
  }

  for (const harvest of raw.recoltariDashboard) {
    const parcelaId = harvest.parcela_id ?? ''
    if (!parcelaId) continue
    const bucket = byParcelaHarvests.get(parcelaId) ?? []
    bucket.push(harvest)
    byParcelaHarvests.set(parcelaId, bucket)
  }

  const useV2TreatmentSignal = hasV2TreatmentSignal(raw)

  return raw.parceleDashboard.map((parcela) => {
    const parcelaId = parcela.id
    const activities = byParcelaActivities.get(parcelaId) ?? []
    const harvests = byParcelaHarvests.get(parcelaId) ?? []

    const lastActivity =
      activities.length > 0
        ? [...activities].sort((a, b) => compareActivityRecency(a, b))[0]
        : null

    const lastHarvest =
      harvests.length > 0
        ? [...harvests].sort((a, b) => {
            const leftTime = parseDateOnly(a.data)?.getTime() ?? 0
            const rightTime = parseDateOnly(b.data)?.getTime() ?? 0
            return rightTime - leftTime
          })[0]
        : null

    const treatmentActivities = activities.filter((activity) =>
      normalizeText(activity.tip_activitate).includes('tratament'),
    )
    const lastTreatment =
      treatmentActivities.length > 0
        ? [...treatmentActivities].sort((a, b) => compareActivityRecency(a, b))[0]
        : null

    const daysSinceLastActivity = lastActivity
      ? getDaysBetween(raw.currentDay.getTime(), lastActivity.data_aplicare)
      : null
    const daysSinceLastHarvest = lastHarvest
      ? getDaysBetween(raw.currentDay.getTime(), lastHarvest.data)
      : null

    let daysSinceAnyActivity: number | null = null
    if (daysSinceLastActivity !== null && daysSinceLastHarvest !== null) {
      daysSinceAnyActivity = Math.min(daysSinceLastActivity, daysSinceLastHarvest)
    } else if (daysSinceLastActivity !== null) {
      daysSinceAnyActivity = daysSinceLastActivity
    } else if (daysSinceLastHarvest !== null) {
      daysSinceAnyActivity = daysSinceLastHarvest
    }

    const treatmentIntervalDays = raw.treatmentIntervalByParcela.get(parcelaId) ?? null

    let treatmentAttention: TreatmentAttention = 'none'
    if (lastTreatment && treatmentIntervalDays && treatmentIntervalDays > 0) {
      const daysSinceTreatment = getDaysBetween(raw.currentDay.getTime(), lastTreatment.data_aplicare)
      if (daysSinceTreatment !== null) {
        if (daysSinceTreatment > treatmentIntervalDays) {
          treatmentAttention = 'overdue'
        } else if (daysSinceTreatment >= treatmentIntervalDays - 2) {
          treatmentAttention = 'due-soon'
        }
      }
    }

    const latestPauseActivity =
      activities
        .filter((activity) => (activity.timp_pauza_zile ?? 0) > 0)
        .sort((a, b) => compareActivityRecency(a, b))[0] ?? null

    let pauseStatus: PauseStatus = 'none'
    let pauseDaysRemaining = 0
    if (latestPauseActivity) {
      const active = isPauseActive(
        {
          data_aplicare: latestPauseActivity.data_aplicare,
          timp_pauza_zile: latestPauseActivity.timp_pauza_zile,
        },
        raw.currentDay,
      )
      if (active) {
        const urgency = getPauseUrgency(
          {
            data_aplicare: latestPauseActivity.data_aplicare,
            timp_pauza_zile: latestPauseActivity.timp_pauza_zile,
          },
          raw.currentDay,
        )
        pauseStatus = urgency
        pauseDaysRemaining = getPauseRemainingDays(
          {
            data_aplicare: latestPauseActivity.data_aplicare,
            timp_pauza_zile: latestPauseActivity.timp_pauza_zile,
          },
          raw.currentDay,
        )
      }
    }

    const attentionFlags: ParcelAttentionFlag[] = []
    if (!useV2TreatmentSignal) {
      if (treatmentAttention === 'overdue') attentionFlags.push('treatment_overdue')
      if (treatmentAttention === 'due-soon') attentionFlags.push('treatment_due_soon')
      if (pauseStatus === 'active' || pauseStatus === 'urgent') attentionFlags.push('pause_active')
    }
    if (daysSinceAnyActivity !== null && daysSinceAnyActivity > 21) {
      attentionFlags.push('no_recent_activity')
    }

    return {
      parcelaId,
      displayName: formatUnitateDisplayName(parcela.nume_parcela, parcela.tip_unitate),
      tip_unitate: parcela.tip_unitate,
      status_operational: parcela.status_operational,
      lastActivity,
      lastHarvest,
      lastTreatment,
      daysSinceAnyActivity,
      treatmentIntervalDays,
      treatmentAttention,
      pauseStatus,
      pauseDaysRemaining,
      attentionFlags,
    }
  })
}

export function buildDashboardTasks(
  raw: DashboardRawData,
  parcelStates: ParcelDashboardState[],
): DashboardTaskItem[] {
  const tasks: DashboardTaskItem[] = []
  const v2TreatmentSuggestion = getPrimaryV2TreatmentSuggestion(raw)

  if (v2TreatmentSuggestion?.status === 'overdue' || v2TreatmentSuggestion?.status === 'blocked') {
    tasks.push({
      id: 'tratamente:recomandat-v2',
      icon: '🧪',
      text: 'Verifică tratamentul recomandat',
      tag: v2TreatmentSuggestion.status === 'blocked' ? 'BLOCAT' : 'URGENT',
      tone: 'urgent',
    })
  }

  if (!hasV2TreatmentSignal(raw)) {
    // Legacy fallback pentru ferme fără Tratamente V2 configurat.
    for (const parcel of parcelStates) {
      if (parcel.treatmentAttention === 'overdue') {
        tasks.push({
          id: `tratament:${parcel.parcelaId}`,
          icon: '🧪',
          text: `Tratament necesar ${parcel.displayName}`,
          tag: 'URGENT',
          tone: 'urgent',
        })
      }
    }

    const parcelsWithActivePause = parcelStates.filter(
      (p) => p.pauseStatus === 'active' || p.pauseStatus === 'urgent',
    )
    if (parcelsWithActivePause.length > 0) {
      tasks.push({
        id: 'pauza:activa',
        icon: '⏸️',
        text: `${parcelsWithActivePause.length} parcele în pauză de tratament`,
        tag: 'PAUZĂ',
        tone: 'warning',
      })
    }
  }

  const overdueOrders = raw.comenzi.filter((row) => {
    const deliveryDate = toDateOnly(row.data_livrare)
    if (!deliveryDate) return false
    return deliveryDate < raw.todayIso && row.status !== 'livrata' && row.status !== 'anulata'
  })
  if (overdueOrders.length > 0) {
    tasks.push({
      id: 'comenzi:restante',
      icon: '📦',
      text: `${overdueOrders.length} ${overdueOrders.length === 1 ? 'comandă restantă' : 'comenzi restante'}`,
      tag: 'AZI',
      tone: 'urgent',
    })
  }

  const ordersToday = raw.comenzi.filter((row) => {
    const deliveryDate = toDateOnly(row.data_livrare)
    return deliveryDate === raw.todayIso && row.status !== 'livrata' && row.status !== 'anulata'
  })
  if (ordersToday.length > 0) {
    tasks.push({
      id: 'comenzi:azi',
      icon: '🚚',
      text: `${ordersToday.length} de livrat azi`,
      tag: 'AZI',
      tone: 'warning',
    })
  }

  const ordersTomorrow = raw.comenzi.filter((row) => {
    const deliveryDate = toDateOnly(row.data_livrare)
    return deliveryDate === raw.tomorrowIso && row.status !== 'livrata' && row.status !== 'anulata'
  })
  if (ordersTomorrow.length > 0) {
    tasks.push({
      id: 'comenzi:maine',
      icon: '📅',
      text: `${ordersTomorrow.length} pregătite pentru mâine`,
      tag: 'MÂINE',
      tone: 'info',
    })
  }

  const criticalStocks = raw.stocuri.filter((row) => row.total_kg <= STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG)
  if (criticalStocks.length > 0) {
    tasks.push({
      id: 'stoc:critic',
      icon: '📉',
      text: `${criticalStocks.length} ${criticalStocks.length === 1 ? 'produs cu stoc scăzut' : 'produse cu stoc scăzut'}`,
      tag: 'STOC',
      tone: 'info',
    })
  }

  const inactiveParcels = parcelStates.filter((parcel) => {
    if (parcel.daysSinceAnyActivity == null) return false
    return parcel.daysSinceAnyActivity > 30
  })
  if (inactiveParcels.length > 0) {
    tasks.push({
      id: 'parcele:fara-activitate',
      icon: '🪴',
      text: `${inactiveParcels.length} parcele fără activitate în ultima lună`,
      tag: 'ATENȚIE',
      tone: 'info',
    })
  }

  const seen = new Set<string>()
  return tasks.filter((task) => {
    if (seen.has(task.id)) return false
    seen.add(task.id)
    return true
  })
}

export function buildDashboardAlerts(
  raw: DashboardRawData,
  parcelStates: ParcelDashboardState[],
): DashboardAlert[] {
  const alerts: DashboardAlert[] = []
  const v2TreatmentSuggestion = getPrimaryV2TreatmentSuggestion(raw)

  const overdueOrders = raw.comenzi.filter((row) => {
    const deliveryDate = toDateOnly(row.data_livrare)
    if (!deliveryDate) return false
    return deliveryDate < raw.todayIso && row.status !== 'livrata' && row.status !== 'anulata'
  })
  if (overdueOrders.length > 0) {
    alerts.push({
      id: 'alert:comenzi-restante',
      category: 'comenzi',
      severity: 'warning',
      message: `${overdueOrders.length} ${overdueOrders.length === 1 ? 'comandă restantă' : 'comenzi restante'}`,
    })
  }

  const criticalStocks = raw.stocuri.filter((row) => row.total_kg <= STOCK_AUDIT_LOW_STOCK_THRESHOLD_KG)
  if (criticalStocks.length > 0) {
    alerts.push({
      id: 'alert:stoc-critic',
      category: 'stoc',
      severity: criticalStocks.some((row) => row.total_kg <= 5) ? 'critical' : 'warning',
      message: `${criticalStocks.length} produse cu stoc la limită`,
    })
  }

  if (v2TreatmentSuggestion?.status === 'overdue') {
    alerts.push({
      id: 'alert:tratamente-v2-overdue',
      category: 'tratamente',
      severity: 'warning',
      message: `Tratament recomandat depășit: ${v2TreatmentSuggestion.parcelaLabel}`,
    })
  } else if (v2TreatmentSuggestion?.status === 'blocked') {
    alerts.push({
      id: 'alert:tratamente-v2-blocked',
      category: 'tratamente',
      severity: 'critical',
      message: `Tratament blocat: ${v2TreatmentSuggestion.reason}`,
    })
  } else if (!hasV2TreatmentSignal(raw)) {
    // Legacy fallback pentru ferme fără Tratamente V2 configurat.
    const parcelsWithOverdueTreatment = parcelStates.filter(
      (p) => p.treatmentAttention === 'overdue',
    )
    if (parcelsWithOverdueTreatment.length > 0) {
      alerts.push({
        id: 'alert:tratamente-depasite',
        category: 'tratamente',
        severity: 'warning',
        message: `Tratamente depășite pe ${parcelsWithOverdueTreatment.length} parcele`,
      })
    }

    const parcelsWithActivePause = parcelStates.filter(
      (p) => p.pauseStatus === 'active' || p.pauseStatus === 'urgent',
    )
    if (parcelsWithActivePause.length > 0) {
      alerts.push({
        id: 'alert:pauza-activa',
        category: 'parcele',
        severity: 'info',
        message: `${parcelsWithActivePause.length} parcele în pauză de tratament`,
      })
    }
  }

  if (raw.meteo?.spray && raw.meteo.spray.canSpray === false) {
    alerts.push({
      id: 'alert:meteo-tratament-prost',
      category: 'meteo',
      severity: 'info',
      message: raw.meteo.spray.reason || 'Condiții mai puțin bune pentru tratamente azi',
    })
  }

  return alerts
}

export function buildDailySummary(params: {
  greeting: string
  todayLabel: string
  greetingSummary: string | null
  meteo: MeteoData | null
}): DailySummary {
  const meteoReason = params.meteo?.spray?.reason ?? null

  return {
    greeting: params.greeting,
    todayLabel: params.todayLabel,
    headline: params.greetingSummary,
    meteoReason,
  }
}

export function buildWeatherWindow(meteo: MeteoData | null): WeatherWindow {
  return {
    today: {
      canSpray: meteo?.spray?.canSpray ?? null,
      reason: meteo?.spray?.reason ?? null,
    },
    tomorrow: meteo?.forecastTomorrow
      ? {
          tempMin: meteo.forecastTomorrow.tempMin,
          tempMax: meteo.forecastTomorrow.tempMax,
          pop: meteo.forecastTomorrow.pop,
        }
      : null,
  }
}

export function isWidgetEmpty(
  widgetId: DashboardWidgetId,
  params: {
    kpiItemsCount: number
    recentOrdersCount: number
    plannedActivitiesCount: number
    recentHarvestsCount: number
    criticalStocksCount: number
    venitSezon: number
    revenueSeries: number[]
  },
): boolean {
  switch (widgetId) {
    case 'kpi-summary':
      return params.kpiItemsCount === 0
    case 'comenzi-recente':
      return params.recentOrdersCount === 0
    case 'activitati-planificate':
      return params.plannedActivitiesCount === 0
    case 'recoltari-recente':
      return params.recentHarvestsCount === 0
    case 'stocuri-critice':
      return params.criticalStocksCount === 0
    case 'sumar-venituri':
      return params.venitSezon <= 0 && params.revenueSeries.every((value) => value <= 0)
    default:
      return false
  }
}

