'use client'

import dynamic from 'next/dynamic'

const PWAInstallPrompt = dynamic(() => import('@/components/pwa/PWAInstallPrompt'), { ssr: false })

export function PWAInstallPromptMount() {
  return <PWAInstallPrompt />
}
