import { BETA_EFFECTIVE_PLAN, BETA_MODE } from '@/lib/config/beta'

export type SubscriptionPlan = 'freemium' | 'pro' | 'enterprise'

export type SubscriptionFeature =
  | 'advanced_reports'
  | 'smart_alerts'
  | 'full_season_export'
  | 'multi_user'

export const PLAN_STORAGE_KEY = 'agri.subscription.plan'

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  freemium: 'Freemium',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

export const PLAN_PRICING: Record<SubscriptionPlan, string> = {
  freemium: '0 lei / luna',
  pro: '70 lei / luna',
  enterprise: 'Personalizat',
}

const FEATURE_MATRIX: Record<SubscriptionPlan, SubscriptionFeature[]> = {
  freemium: [],
  pro: ['advanced_reports', 'smart_alerts', 'full_season_export'],
  enterprise: ['advanced_reports', 'smart_alerts', 'full_season_export', 'multi_user'],
}

export interface PlanLimits {
  maxParcels: number | null
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  freemium: { maxParcels: 1 },
  pro: { maxParcels: null },
  enterprise: { maxParcels: null },
}

export function getEffectivePlan(plan: SubscriptionPlan): SubscriptionPlan {
  if (BETA_MODE) return BETA_EFFECTIVE_PLAN
  return plan
}

export function hasFeature(plan: SubscriptionPlan, feature: SubscriptionFeature): boolean {
  const effectivePlan = getEffectivePlan(plan)
  return FEATURE_MATRIX[effectivePlan].includes(feature)
}

export function canCreateParcel(plan: SubscriptionPlan, currentParcelCount: number): boolean {
  const effectivePlan = getEffectivePlan(plan)
  const maxParcels = PLAN_LIMITS[effectivePlan].maxParcels
  if (maxParcels === null) return true
  return currentParcelCount < maxParcels
}

export function normalizeSubscriptionPlan(raw: string | null | undefined): SubscriptionPlan | null {
  if (raw === 'freemium' || raw === 'pro' || raw === 'enterprise') return raw
  // Backward-compat for old local value.
  if (raw === 'basic') return 'freemium'
  return null
}

export function readStoredPlan(): SubscriptionPlan {
  if (typeof window === 'undefined') return 'freemium'
  const raw = window.localStorage.getItem(PLAN_STORAGE_KEY)
  return normalizeSubscriptionPlan(raw) ?? 'freemium'
}

export function writeStoredPlan(plan: SubscriptionPlan) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PLAN_STORAGE_KEY, plan)
}
