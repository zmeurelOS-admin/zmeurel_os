'use client'

import { getSupabase } from '@/lib/supabase/client'
import { getTenantIdOrNull } from '@/lib/tenant/get-tenant'
import { getSessionId } from './session'

type EventMetadata = Record<string, unknown>
type StatusType = 'success' | 'failed' | 'abandoned' | 'started'

interface TrackEventParams {
  eventName: string
  moduleName?: string
  status?: StatusType
  metadata?: EventMetadata
}

interface AnalyticsContext {
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
      const supabase = getSupabase()
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

function fireInsert(eventName: string, moduleName: string, metadata: EventMetadata, status?: StatusType): void {
  if (typeof window === 'undefined') return

  queueMicrotask(() => {
    void (async () => {
      try {
        const context = await getAnalyticsContext()
        if (!context) return

        const supabase = getSupabase()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('analytics_events').insert({
          tenant_id: context.tenantId,
          user_id: context.userId,
          event_name: eventName,
          event_type: eventName,
          module: moduleName,
          metadata: metadata ?? {},
          session_id: getSessionId(),
          ...(status !== undefined ? { status } : {}),
        })
      } catch {
        // swallow errors: analytics must never block UX
      }
    })()
  })
}

export function trackEvent(params: TrackEventParams): void
export function trackEvent(eventType: string, module: string, metadata?: EventMetadata): void
export function trackEvent(eventType: string, metadata?: EventMetadata): void
export function trackEvent(
  eventTypeOrParams: string | TrackEventParams,
  moduleOrMetadata?: string | EventMetadata,
  metadata: EventMetadata = {}
): void {
  if (typeof eventTypeOrParams === 'object') {
    const { eventName, moduleName = 'general', status, metadata: meta = {} } = eventTypeOrParams
    fireInsert(eventName, moduleName, meta, status)
    return
  }

  const moduleName = typeof moduleOrMetadata === 'string' ? moduleOrMetadata : 'general'
  const payloadMetadata = typeof moduleOrMetadata === 'string' ? metadata : (moduleOrMetadata ?? {})
  fireInsert(eventTypeOrParams, moduleName, payloadMetadata)
}



