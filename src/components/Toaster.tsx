'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Toaster as SonnerToaster } from 'sonner'

import { DEFAULT_TOAST_DURATION_MS } from '@/lib/ui/toast'

const MOBILE_MEDIA_QUERY = '(max-width: 1023px)'

export function Toaster() {
  const { resolvedTheme = 'light' } = useTheme()
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MEDIA_QUERY).matches
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY)
    const onChange = () => setIsMobile(mediaQuery.matches)

    onChange()
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  return (
    <SonnerToaster
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position={isMobile ? 'top-center' : 'top-right'}
      toastOptions={{
        duration: DEFAULT_TOAST_DURATION_MS,
        style: {
          background: 'var(--popover)',
          color: 'var(--popover-foreground)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
        },
        className: 'sonner-toast',
        descriptionClassName: 'sonner-toast-description',
        actionButtonStyle: {
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
        },
        cancelButtonStyle: {
          background: 'var(--muted)',
          color: 'var(--foreground)',
        },
      }}
      expand={false}
      visibleToasts={4}
    />
  )
}
