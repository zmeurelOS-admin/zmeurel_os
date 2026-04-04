import type { SolarClimateLog } from '@/lib/supabase/queries/solar-tracking'

const MICROCLIMATE_FRESH_WINDOW_MS = 24 * 60 * 60 * 1000

export type DashboardMicroclimate = {
  hasData: boolean
  isRecent: boolean
  temperature: number | null
  humidity: number | null
  timestamp: string | null
}

export function resolveDashboardMicroclimate(
  logs: SolarClimateLog[],
  now: Date = new Date(),
): DashboardMicroclimate {
  if (!logs.length) {
    return {
      hasData: false,
      isRecent: false,
      temperature: null,
      humidity: null,
      timestamp: null,
    }
  }

  const latest = logs
    .filter((row) => row.created_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

  if (!latest) {
    return {
      hasData: false,
      isRecent: false,
      temperature: null,
      humidity: null,
      timestamp: null,
    }
  }

  const createdAtMs = new Date(latest.created_at).getTime()
  const isRecent = Number.isFinite(createdAtMs) && now.getTime() - createdAtMs <= MICROCLIMATE_FRESH_WINDOW_MS

  return {
    hasData: true,
    isRecent,
    temperature: latest.temperatura ?? null,
    humidity: latest.umiditate ?? null,
    timestamp: latest.created_at,
  }
}
