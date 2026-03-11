'use client'

import { useEffect, useState } from 'react'
import { Toaster as SonnerToaster } from 'sonner'

import { DEFAULT_TOAST_DURATION_MS } from '@/lib/ui/toast'

const MOBILE_MEDIA_QUERY = '(max-width: 1023px)'

export function Toaster() {
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
      position={isMobile ? 'top-center' : 'top-right'}
      toastOptions={{
        duration: DEFAULT_TOAST_DURATION_MS,
        style: {
          background: 'white',
          color: '#312E3F',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
        },
        className: 'sonner-toast',
        descriptionClassName: 'sonner-toast-description',
        actionButtonStyle: {
          background: '#F16B6B',
          color: 'white',
        },
        cancelButtonStyle: {
          background: '#f3f4f6',
          color: '#312E3F',
        },
      }}
      expand={false}
      visibleToasts={4}
    />
  )
}
