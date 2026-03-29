/**
 * pause-helpers.ts
 * Helpers for active pesticide pause detection and visual urgency.
 * Uses `timp_pauza_zile` column from `activitati_agricole`.
 */

import { computeActivityRemainingDays } from '@/lib/parcele/pauza'

export type PauzeUrgency = 'urgent' | 'active' | 'none'

interface ActivityPauseInput {
  data_aplicare?: string | null
  timp_pauza_zile?: number | null
}

/**
 * Returns true if the activity's pesticide pause is still active today.
 * data_aplicare + timp_pauza_zile >= today
 */
export function isPauseActive(activity: ActivityPauseInput, today?: Date): boolean {
  return computeActivityRemainingDays(activity, today) > 0
}

/**
 * Returns the number of remaining days in the pesticide pause.
 * Returns 0 if the pause has expired.
 */
export function getPauseRemainingDays(activity: ActivityPauseInput, today?: Date): number {
  return computeActivityRemainingDays(activity, today)
}

/**
 * Returns the visual urgency of the pause:
 * - 'urgent': 1–2 days remaining (orange)
 * - 'active': more than 2 days remaining (red)
 * - 'none': no active pause
 */
export function getPauseUrgency(activity: ActivityPauseInput, today?: Date): PauzeUrgency {
  const remaining = computeActivityRemainingDays(activity, today)
  if (remaining <= 0) return 'none'
  if (remaining <= 2) return 'urgent'
  return 'active'
}
