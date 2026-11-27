import { compareActivityRecency } from '@/lib/activitati/timeline'
import { getPauseRemainingDays, getPauseUrgency, isPauseActive } from '@/lib/pause-helpers'
import { formatUnitateDisplayName } from '@/lib/parcele/unitate'
import type { ActivitateAgricola } from '@/lib/supabase/queries/activitati-agricole'
import type { Parcela } from '@/lib/supabase/queries/parcele'
import type { Recoltare } from '@/lib/supabase/queries/recoltari'
import type { PauzaParcela } from '@/lib/tratamente/pauza'

/**
 * Starea parcelelor pentru Acasă (promptul 34, §10: din vechiul „motor” al dashboard-ului de desktop a rămas doar
 * asta; sarcinile, alertele și widgeturile au ieșit odată cu cardurile vechi).
 */
export interface IntrareStariParcele {
  /** Data de referință pentru calcule (azi în zona utilizatorului). */
  currentDay: Date
  parceleDashboard: Parcela[]
  activitatiDashboard: ActivitateAgricola[]
  recoltariDashboard: Recoltare[]
  /** Interval minim de tratament per parcelă comercială (zile). */
  treatmentIntervalByParcela: Map<string, number>
  /**
   * Pauzele active azi, din sursa unică (`lib/tratamente/pauza`: aplicările noi + activitățile vechi).
   * Lipsă = calculul vechi, doar din `activitati_agricole`.
   */
  pauzePeParcela?: ReadonlyMap<string, PauzaParcela>
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

export function buildParcelDashboardStates(raw: IntrareStariParcele): ParcelDashboardState[] {
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
    if (raw.pauzePeParcela) {
      const pauza = raw.pauzePeParcela.get(parcelaId)
      if (pauza && pauza.zileRamase > 0) {
        pauseStatus = pauza.zileRamase <= 2 ? 'urgent' : 'active'
        pauseDaysRemaining = pauza.zileRamase
      }
    } else if (latestPauseActivity) {
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
    if (treatmentAttention === 'overdue') attentionFlags.push('treatment_overdue')
    if (treatmentAttention === 'due-soon') attentionFlags.push('treatment_due_soon')
    if (pauseStatus === 'active' || pauseStatus === 'urgent') attentionFlags.push('pause_active')
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
