import type { DashboardRecommendationItem } from '@/components/dashboard/DashboardV2Sections'
import type { DashboardTaskItem } from '@/components/dashboard/TaskList'
import type { DashboardAlert, MeteoData, ParcelAttentionFlag } from '@/lib/dashboard/engine'

export type ParcelAttentionSlice = {
  displayName: string
  attentionFlags: ParcelAttentionFlag[]
}

export type BuildDashboardRecommendationsInput = {
  meteo: MeteoData | null
  tasks: DashboardTaskItem[]
  alerts: DashboardAlert[]
  primaryContext: 'solar' | 'camp' | 'mixed'
  microclimate?: {
    isRecent: boolean
    temperature: number | null
    humidity: number | null
  } | null
  /** Deja sortate/filtrate în pagină (ex. top parcele cu atenție). */
  parcelAttentionItems: ParcelAttentionSlice[]
  plannedActivitiesCount: number
  criticalStockCount: number
}

const MAX_RECOMMENDATIONS = 5
const MIN_WHEN_SIGNALS = 2

function trimSentence(text: string, max = 120): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}

function hasTask(tasks: DashboardTaskItem[], id: string): boolean {
  return tasks.some((t) => t.id === id)
}

function hasAlertCategory(alerts: DashboardAlert[], category: DashboardAlert['category']): boolean {
  return alerts.some((a) => a.category === category)
}

/**
 * Recomandări deterministe pentru cardul „Recomandări” (V2), doar din date deja agregate pe dashboard.
 * Fără fetch, fără AI — reguli simple, prioritate: operațional → stoc → teren → fallback.
 * Vremea / stropirea / procentul de ploaie rămân în cardul Meteo (fără repetare aici).
 */
export function buildDashboardRecommendations(
  input: BuildDashboardRecommendationsInput,
): DashboardRecommendationItem[] {
  const { meteo, tasks, alerts, parcelAttentionItems, plannedActivitiesCount, criticalStockCount } = input

  const out: DashboardRecommendationItem[] = []
  const seen = new Set<string>()

  const push = (item: DashboardRecommendationItem) => {
    if (seen.has(item.id)) return
    seen.add(item.id)
    out.push(item)
  }

  if (hasTask(tasks, 'comenzi:restante')) {
    push({
      id: 'rec-orders-overdue',
      text: 'Prioritizează comenzile restante și confirmă livrările întârziate.',
      tone: 'warning',
    })
  }

  if (hasTask(tasks, 'comenzi:azi')) {
    push({
      id: 'rec-orders-today',
      text: 'Ai livrări pentru azi — verifică cantități, ambalaje și rute.',
      tone: 'warning',
    })
  }

  if (hasTask(tasks, 'comenzi:maine')) {
    push({
      id: 'rec-orders-tomorrow',
      text: 'Pregătește marfa pentru comenzile de mâine (etichete, stoc, recepție).',
      tone: 'info',
    })
  }

  if (criticalStockCount > 0 || hasAlertCategory(alerts, 'stoc') || hasTask(tasks, 'stoc:critic')) {
    push({
      id: 'rec-stock-low',
      text: 'Stoc sub prag — verifică cantitățile înainte de livrări noi.',
      tone: 'info',
    })
  }

  const treatmentParcel = parcelAttentionItems.find(
    (p) =>
      p.attentionFlags.includes('treatment_overdue') || p.attentionFlags.includes('treatment_due_soon'),
  )

  if (
    !treatmentParcel &&
    (hasAlertCategory(alerts, 'tratamente') || tasks.some((t) => t.id.startsWith('tratament:')))
  ) {
    push({
      id: 'rec-treatment-alerts',
      text: 'Sunt tratamente de respectat pe teren — verifică calendarul de aplicare.',
      tone: 'warning',
    })
  }

  if (alerts.some((a) => a.id === 'alert:pauza-activa') || hasTask(tasks, 'pauza:activa')) {
    push({
      id: 'rec-pause',
      text: 'Există pauze de tratament active — nu aplica produs până nu expiră fereastra.',
      tone: 'warning',
    })
  }

  if (treatmentParcel) {
    push({
      id: 'rec-parcel-treatment',
      text: trimSentence(
        `Începe cu ${treatmentParcel.displayName}: tratament întârziat sau aproape scadent.`,
        110,
      ),
      tone: 'info',
    })
  } else {
    const idleParcel = parcelAttentionItems.find((p) => p.attentionFlags.includes('no_recent_activity'))
    if (idleParcel) {
      push({
        id: 'rec-parcel-idle',
        text: trimSentence(
          `Verifică ${idleParcel.displayName}: nu apare activitate recentă în date.`,
          110,
        ),
        tone: 'info',
      })
    }
  }

  if (plannedActivitiesCount > 0) {
    push({
      id: 'rec-planned-work',
      text:
        plannedActivitiesCount === 1
          ? 'Ai o lucrare planificată în viitorul apropiat — verifică materialele și echipamentul.'
          : 'Ai lucrări planificate în viitorul apropiat — aliniază materialele și echipamentul.',
      tone: 'info',
    })
  }

  const hadOperationalSignal =
    tasks.length > 0 ||
    alerts.length > 0 ||
    criticalStockCount > 0 ||
    plannedActivitiesCount > 0 ||
    parcelAttentionItems.length > 0 ||
    Boolean(
      meteo?.available &&
        (meteo.spray != null || meteo.forecastTomorrow != null || meteo.current?.windSpeed != null),
    )

  if (out.length > 0 && out.length < MIN_WHEN_SIGNALS && hadOperationalSignal) {
    push({
      id: 'rec-day-organize',
      text: 'Zi bună pentru verificări în teren, organizare comenzi și note rapide între lucrări.',
      tone: 'success',
    })
  }

  if (out.length === 0) {
    push({
      id: 'rec-steady',
      text: 'Nu apar blocaje majore în datele curente — poți continua cu planul zilei.',
      tone: 'success',
    })
  }

  return out.slice(0, MAX_RECOMMENDATIONS)
}
