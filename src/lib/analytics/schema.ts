import type { Json, Tables, TablesInsert } from '@/types/supabase'

type AnalyticsPayload = Record<string, unknown> | null

export type AnalyticsEventRow = Tables<'analytics_events'>
export type AnalyticsEventInsert = TablesInsert<'analytics_events'>

export function buildAnalyticsPayload(
  payload: Record<string, unknown> = {},
  extras: Record<string, unknown> = {}
): Json {
  return { ...payload, ...extras } as Json
}

export function getAnalyticsPayload(event: AnalyticsEventRow): AnalyticsPayload {
  const eventData = event.event_data
  if (eventData && typeof eventData === 'object' && !Array.isArray(eventData)) {
    return eventData as Record<string, unknown>
  }

  return null
}

export function getAnalyticsEventPageUrl(event: AnalyticsEventRow): string | null {
  const payload = getAnalyticsPayload(event)
  const payloadUrl = typeof payload?.page_url === 'string' ? payload.page_url : null
  return event.page_url ?? payloadUrl
}

export function getAnalyticsErrorMessage(event: AnalyticsEventRow): string | null {
  const payload = getAnalyticsPayload(event)
  return typeof payload?.error_message === 'string' ? payload.error_message : null
}
