'use client'

import dynamic from 'next/dynamic'

import { useAiPanel } from '@/contexts/AiPanelContext'

const PushPermissionBanner = dynamic(
  () =>
    import('@/components/notifications/PushPermissionBanner').then(
      (mod) => mod.PushPermissionBanner
    ),
  { ssr: false, loading: () => null }
)

const BetaWidget = dynamic(() => import('@/components/beta-widget'), {
  ssr: false,
  loading: () => null,
})

const AiPanel = dynamic(() => import('@/components/ai/AiPanel').then((mod) => mod.AiPanel), {
  ssr: false,
  loading: () => null,
})

export function DashboardShellTopSlot() {
  return <PushPermissionBanner />
}

export function DashboardShellFloatingOverlays() {
  const { isAiPanelOpen } = useAiPanel()

  return (
    <>
      <BetaWidget />
      {isAiPanelOpen ? <AiPanel /> : null}
    </>
  )
}
