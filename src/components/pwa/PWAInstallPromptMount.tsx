'use client'

import dynamic from 'next/dynamic'

const PWAInstallPrompt = dynamic(() => import('@/components/pwa/PWAInstallPrompt'), { ssr: false })

type PWAInstallPromptMountProps = {
  allowPublicPaths?: boolean
  title?: string
  subtitle?: string
  iconAlt?: string
}

export function PWAInstallPromptMount(props: PWAInstallPromptMountProps) {
  return <PWAInstallPrompt {...props} />
}
