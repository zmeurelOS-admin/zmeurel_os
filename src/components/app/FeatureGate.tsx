'use client'

import { hasFeature, type SubscriptionFeature } from '@/lib/subscription/plans'
import { useMockPlan } from '@/lib/subscription/useMockPlan'

interface FeatureGateProps {
  feature: SubscriptionFeature
  title?: string
  message?: string
  children: React.ReactNode
}

export function FeatureGate({
  feature,
  title = '',
  message = '',
  children,
}: FeatureGateProps) {
  const { plan } = useMockPlan()
  const enabled = hasFeature(plan, feature)

  if (enabled) {
    return <>{children}</>
  }

  void title
  void message
  return null
}
