'use client'

import { createClient } from '@/lib/supabase/client'
import { getTenantIdOrNull } from '@/lib/tenant/get-tenant'
import { getSessionId } from './session'

type EventData = Record<string, unknown>

type AnalyticsContext = {
  userId: string
  tenantId: string
}

let cachedContext: AnalyticsContext | null = null
let contextPromise: Promise<AnalyticsContext | null> | null = null

async function getAnalyticsContext(): Promise<AnalyticsContext | null> {
  if (cachedContext) return cachedContext
  if (contextPromise) return contextPromise

  contextPromise = (async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return null

      const tenantId = await getTenantIdOrNull(supabase)
      if (!tenantId) return null

      cachedContext = { userId: user.id, tenantId }
      return cachedContext
    } catch {
      return null
    } finally {
      contextPromise = null
    }
  })()

  return contextPromise
}

export function track(eventName: string, eventData?: Record<string, unknown>) {
  try {
    if (typeof window === 'undefined') return

    queueMicrotask(() => {
      void (async () => {
        try {
          const context = await getAnalyticsContext()
          if (!context) return

          const supabase = createClient()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('analytics_events').insert({
            tenant_id: context.tenantId,
            user_id: context.userId,
            event_name: eventName,
            event_data: (eventData ?? {}) as EventData,
            page_url: window.location.pathname,
            session_id: getSessionId(),
          })
        } catch {
          // analytics must never break UX
        }
      })()
    })
  } catch {
    // silently fail
  }
}
