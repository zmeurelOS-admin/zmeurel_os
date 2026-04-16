export const DESTRUCTIVE_STEP_UP_HEADER = 'x-zmeurel-step-up-token'

export const destructiveActionScopes = {
  gdprAccountDelete: 'gdpr_account_delete',
  gdprFarmDelete: 'gdpr_farm_delete',
  farmReset: 'farm_reset',
} as const

export type DestructiveActionScope =
  (typeof destructiveActionScopes)[keyof typeof destructiveActionScopes]

export function isDestructiveActionScope(value: unknown): value is DestructiveActionScope {
  if (typeof value !== 'string') return false
  return Object.values(destructiveActionScopes).includes(value as DestructiveActionScope)
}
