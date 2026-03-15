'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from './trackEvent'

export function useTrackModuleView(moduleName: string): void {
  const trackedRef = useRef(false)

  useEffect(() => {
    if (trackedRef.current) return
    trackedRef.current = true
    trackEvent({ eventName: 'view_module', moduleName })
  }, [moduleName])
}
