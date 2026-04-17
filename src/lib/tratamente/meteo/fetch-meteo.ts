import { addHours, startOfHour } from 'date-fns'

import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { evaluateFereastra } from '@/lib/tratamente/meteo/evaluate-window'
import type { MeteoSnapshot, MeteoZi } from '@/lib/tratamente/meteo/types'

const DEFAULT_METEO_LAT = 47.6514
const DEFAULT_METEO_LON = 26.2553
const WEATHER_TIMEOUT_MS = 5000

interface MeteoFunctionResponse {
  available: boolean
  current?: {
    temp: number | null
    description: string | null
    windSpeed: number | null
    humidity: number | null
  }
}

interface OpenWeatherForecastResponse {
  list?: Array<{
    dt?: number
    main?: {
      temp?: number
    }
    wind?: {
      speed?: number
    }
    rain?: {
      '3h'?: number
    }
    weather?: Array<{
      description?: string
    }>
  }>
}

interface ResolvedCoords {
  lat: number
  lon: number
}

interface ForecastSlot {
  timestamp: string
  temperatura_c: number | null
  vant_kmh: number | null
  precipitatii_mm: number | null
  descriere: string | null
}

function readOpenWeatherApiKey(): string {
  return (
    process.env.OPENWEATHER_API_KEY?.trim() ||
    process.env.OPENWEATHERMAP_API_KEY?.trim() ||
    ''
  )
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function round(value: number | null, digits = 1): number | null {
  if (value === null || !Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function toKmh(speedMs: number | null): number | null {
  if (speedMs === null) return null
  return round(speedMs * 3.6, 1)
}

function capitalizeText(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

async function resolveParcelaCoords(parcelaId: string): Promise<ResolvedCoords> {
  const supabase = await createClient()

  const { data: parcela, error: parcelaError } = await supabase
    .from('parcele')
    .select('tenant_id,latitudine,longitudine')
    .eq('id', parcelaId)
    .maybeSingle()

  if (parcelaError) throw parcelaError
  if (!parcela) {
    throw new Error('Parcela nu a fost găsită pentru meteo.')
  }

  const parcelaLat = asFiniteNumber(parcela.latitudine)
  const parcelaLon = asFiniteNumber(parcela.longitudine)
  if (parcelaLat !== null && parcelaLon !== null) {
    return { lat: parcelaLat, lon: parcelaLon }
  }

  if (parcela.tenant_id) {
    const { data: settings, error: settingsError } = await supabase
      .from('tenant_settings')
      .select('latitudine_default,longitudine_default')
      .eq('tenant_id', parcela.tenant_id)
      .maybeSingle()

    if (settingsError) throw settingsError

    const tenantLat = asFiniteNumber(settings?.latitudine_default)
    const tenantLon = asFiniteNumber(settings?.longitudine_default)

    if (tenantLat !== null && tenantLon !== null) {
      return { lat: tenantLat, lon: tenantLon }
    }
  }

  return { lat: DEFAULT_METEO_LAT, lon: DEFAULT_METEO_LON }
}

async function invokeMeteoService(
  lat: number,
  lon: number,
): Promise<MeteoFunctionResponse | null> {
  const serviceRoleClient = createServiceRoleClient()

  const invoke = async (name: 'fetch-meteo' | 'get-meteo') => {
    const { data, error } = await serviceRoleClient.functions.invoke(name, {
      body: { lat, lon },
    })

    if (error) {
      throw error
    }

    return (data ?? null) as MeteoFunctionResponse | null
  }

  try {
    return await invoke('fetch-meteo')
  } catch {
    return await invoke('get-meteo')
  }
}

async function fetchForecastSlots(lat: number, lon: number): Promise<ForecastSlot[]> {
  const apiKey = readOpenWeatherApiKey()
  if (!apiKey) {
    throw new Error('Cheia OpenWeather nu este configurată.')
  }

  const url = new URL('https://api.openweathermap.org/data/2.5/forecast')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('units', 'metric')
  url.searchParams.set('lang', 'ro')
  url.searchParams.set('appid', apiKey)

  const response = await fetch(url, {
    signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    throw new Error(`Forecast OpenWeather indisponibil (${response.status}).`)
  }

  const json = (await response.json()) as OpenWeatherForecastResponse
  return (json.list ?? [])
    .map((entry) => {
      const timestamp = typeof entry.dt === 'number'
        ? new Date(entry.dt * 1000).toISOString()
        : null

      if (!timestamp) return null

      const rain3h = asFiniteNumber(entry.rain?.['3h'])

      return {
        timestamp,
        temperatura_c: round(asFiniteNumber(entry.main?.temp)),
        vant_kmh: toKmh(asFiniteNumber(entry.wind?.speed)),
        precipitatii_mm: rain3h === null ? null : round(rain3h / 3),
        descriere: capitalizeText(entry.weather?.[0]?.description),
      } satisfies ForecastSlot
    })
    .filter((entry): entry is ForecastSlot => Boolean(entry))
}

function findClosestSlot(targetMs: number, slots: ForecastSlot[]): ForecastSlot | null {
  if (slots.length === 0) return null

  return slots.reduce<ForecastSlot | null>((closest, slot) => {
    if (!closest) return slot

    const currentDiff = Math.abs(new Date(slot.timestamp).getTime() - targetMs)
    const closestDiff = Math.abs(new Date(closest.timestamp).getTime() - targetMs)
    return currentDiff < closestDiff ? slot : closest
  }, null)
}

function computePrecipitatii24h(slots: ForecastSlot[]): number | null {
  const total = slots.reduce((sum, slot) => sum + (slot.precipitatii_mm ?? 0), 0)
  return total > 0 ? round(total, 1) : 0
}

export async function getMeteoSnapshot(parcelaId: string): Promise<MeteoSnapshot> {
  const { lat, lon } = await resolveParcelaCoords(parcelaId)
  const payload = await invokeMeteoService(lat, lon)

  return {
    timestamp: new Date().toISOString(),
    temperatura_c: round(payload?.current?.temp ?? null),
    umiditate_pct: round(payload?.current?.humidity ?? null, 0),
    vant_kmh: round(payload?.current?.windSpeed ?? null),
    precipitatii_mm_24h: null,
    descriere: capitalizeText(payload?.current?.description),
  }
}

export async function getMeteoZi(parcelaId: string): Promise<MeteoZi> {
  const { lat, lon } = await resolveParcelaCoords(parcelaId)
  const [payload, forecastSlots] = await Promise.all([
    invokeMeteoService(lat, lon),
    fetchForecastSlots(lat, lon),
  ])

  const start = startOfHour(new Date())
  const ferestre_24h = Array.from({ length: 24 }, (_, index) => {
    const ora = addHours(start, index)
    const targetMs = ora.getTime()
    const nearest = findClosestSlot(targetMs, forecastSlots)

    return evaluateFereastra({
      timestamp: ora.toISOString(),
      temperatura_c:
        index === 0
          ? round(payload?.current?.temp ?? nearest?.temperatura_c ?? null)
          : nearest?.temperatura_c ?? null,
      vant_kmh:
        index === 0
          ? round(payload?.current?.windSpeed ?? nearest?.vant_kmh ?? null)
          : nearest?.vant_kmh ?? null,
      precipitatii_mm: nearest?.precipitatii_mm ?? null,
    })
  })

  return {
    parcelaId,
    snapshot_curent: {
      timestamp: new Date().toISOString(),
      temperatura_c: round(payload?.current?.temp ?? null),
      umiditate_pct: round(payload?.current?.humidity ?? null, 0),
      vant_kmh: round(payload?.current?.windSpeed ?? null),
      precipitatii_mm_24h: computePrecipitatii24h(forecastSlots.slice(0, 8)),
      descriere: capitalizeText(payload?.current?.description),
    },
    ferestre_24h,
  }
}

export function logMeteoWarning(message: string, error: unknown, context?: Record<string, unknown>) {
  console.warn(
    '[tratamente/meteo]',
    sanitizeForLog({
      message,
      context,
      error: toSafeErrorContext(error),
    }),
  )
}
