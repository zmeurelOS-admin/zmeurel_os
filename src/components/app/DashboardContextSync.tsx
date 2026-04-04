'use client'

import { useLastDashboardContext } from '@/hooks/useLastDashboardContext'

/** Client-only: persistă context fermă/asociație + restore la /dashboard după revenire în app. */
export function DashboardContextSync() {
  useLastDashboardContext()
  return null
}
