import { createClient } from 'npm:@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

type MeteoCacheRow = {
  id: string
  tenant_id: string
  lat: number
  lon: number
  data_fetch: string
  date_expiry: string
  current_temp: number | null
  current_icon: string | null
  current_description: string | null
  current_wind_speed: number | null
  current_humidity: number | null
  forecast_tomorrow_temp_min: number | null
  forecast_tomorrow_temp_max: number | null
  forecast_tomorrow_icon: string | null
  forecast_tomorrow_pop: number | null
  raw_json: unknown
}

type OpenWeatherResponse = {
  current?: {
    temp?: number
    wind_speed?: number
    humidity?: number
    weather?: Array<{
      icon?: string
      description?: string
    }>
  }
  daily?: Array<{
    temp?: {
      min?: number
      max?: number
    }
    pop?: number
    weather?: Array<{
      icon?: string
    }>
  }>
}

type SprayAdvice = {
  canSpray: boolean
  reason?: string
}

type MeteoPayload = {
  available: boolean
  source?: 'cache' | 'fresh'
  tenantId?: string
  lat?: number
  lon?: number
  fetchedAt?: string
  expiryAt?: string
  current?: {
    temp: number | null
    icon: string | null
    description: string | null
    windSpeed: number | null
    humidity: number | null
  }
  forecastTomorrow?: {
    tempMin: number | null
    tempMax: number | null
    icon: string | null
    pop: number | null
  }
  spray?: SprayAdvice
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const decoded = atob(padded)
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    return null
  }
}

function asFiniteNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asRoundedNumber(value: number | null, fractionDigits = 1): number | null {
  if (value === null || !Number.isFinite(value)) return null
  return Number(value.toFixed(fractionDigits))
}

function computeSprayAdvice(input: {
  pop: number | null
  windSpeed: number | null
  temperature: number | null
}): SprayAdvice {
  if ((input.pop ?? 0) >= 0.3) {
    return { canSpray: false, reason: 'Ploaie probabilă' }
  }

  if ((input.windSpeed ?? 0) >= 15) {
    return { canSpray: false, reason: 'Vânt prea mare' }
  }

  if ((input.temperature ?? 0) <= 5) {
    return { canSpray: false, reason: 'Temperatură prea scăzută' }
  }

  return { canSpray: true }
}

function formatCacheRow(row: MeteoCacheRow, source: 'cache' | 'fresh'): MeteoPayload {
  const spray = computeSprayAdvice({
    pop: row.forecast_tomorrow_pop,
    windSpeed: row.current_wind_speed,
    temperature: row.current_temp,
  })

  return {
    available: true,
    source,
    tenantId: row.tenant_id,
    lat: row.lat,
    lon: row.lon,
    fetchedAt: row.data_fetch,
    expiryAt: row.date_expiry,
    current: {
      temp: row.current_temp,
      icon: row.current_icon,
      description: row.current_description,
      windSpeed: row.current_wind_speed,
      humidity: row.current_humidity,
    },
    forecastTomorrow: {
      tempMin: row.forecast_tomorrow_temp_min,
      tempMax: row.forecast_tomorrow_temp_max,
      icon: row.forecast_tomorrow_icon,
      pop: row.forecast_tomorrow_pop,
    },
    spray,
  }
}

serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const openWeatherApiKey = Deno.env.get('OPENWEATHERMAP_API_KEY')
  const authHeader = request.headers.get('Authorization')
  const accessToken = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? ''

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Supabase environment is missing.' }, 500)
  }

  if (!openWeatherApiKey) {
    return jsonResponse({ error: 'OPENWEATHERMAP_API_KEY is not configured.' }, 500)
  }

  if (!accessToken) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken)
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const body = await request.json().catch(() => ({})) as { tenant_id?: string | null }
  const jwtPayload = parseJwtPayload(accessToken)
  const claimedTenantId = typeof jwtPayload?.tenant_id === 'string' ? jwtPayload.tenant_id : null

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500)
  }

  const profileTenantId = typeof profileRow?.tenant_id === 'string' ? profileRow.tenant_id : null
  const requestedTenantId = typeof body.tenant_id === 'string' && body.tenant_id.trim() ? body.tenant_id.trim() : null
  const trustedTenantId = profileTenantId ?? claimedTenantId

  if (requestedTenantId && trustedTenantId && requestedTenantId !== trustedTenantId) {
    return jsonResponse({ error: 'Tenant invalid pentru utilizatorul curent.' }, 403)
  }

  const resolvedTenantId = requestedTenantId ?? trustedTenantId

  if (!resolvedTenantId) {
    return jsonResponse({ available: false }, 200)
  }

  const { data: cacheRows, error: cacheError } = await supabase
    .from('meteo_cache')
    .select('*')
    .eq('tenant_id', resolvedTenantId)
    .gt('date_expiry', new Date().toISOString())
    .order('date_expiry', { ascending: false })
    .limit(1)

  if (cacheError) {
    return jsonResponse({ error: cacheError.message }, 500)
  }

  const validCache = (cacheRows?.[0] as MeteoCacheRow | undefined) ?? null
  if (validCache) {
    return jsonResponse(formatCacheRow(validCache, 'cache'))
  }

  const { data: parcelaRows, error: parcelaError } = await supabase
    .from('parcele')
    .select('latitudine,longitudine')
    .eq('tenant_id', resolvedTenantId)
    .eq('rol', 'comercial')
    .not('latitudine', 'is', null)
    .not('longitudine', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)

  if (parcelaError) {
    return jsonResponse({ error: parcelaError.message }, 500)
  }

  const parcelaLat = asFiniteNumber(parcelaRows?.[0]?.latitudine)
  const parcelaLon = asFiniteNumber(parcelaRows?.[0]?.longitudine)

  let lat = parcelaLat
  let lon = parcelaLon

  if (lat === null || lon === null) {
    const { data: settingsRow, error: settingsError } = await supabase
      .from('tenant_settings')
      .select('latitudine_default,longitudine_default')
      .eq('tenant_id', resolvedTenantId)
      .maybeSingle()

    if (settingsError) {
      return jsonResponse({ error: settingsError.message }, 500)
    }

    lat = asFiniteNumber(settingsRow?.latitudine_default)
    lon = asFiniteNumber(settingsRow?.longitudine_default)
  }

  if (lat === null || lon === null) {
    return jsonResponse({ available: false }, 200)
  }

  const weatherUrl = new URL('https://api.openweathermap.org/data/3.0/onecall')
  weatherUrl.searchParams.set('lat', String(lat))
  weatherUrl.searchParams.set('lon', String(lon))
  weatherUrl.searchParams.set('units', 'metric')
  weatherUrl.searchParams.set('lang', 'ro')
  weatherUrl.searchParams.set('appid', openWeatherApiKey)

  const weatherResponse = await fetch(weatherUrl)
  if (!weatherResponse.ok) {
    const errorText = await weatherResponse.text().catch(() => '')
    return jsonResponse({ error: `OpenWeatherMap request failed: ${weatherResponse.status}${errorText ? ` ${errorText}` : ''}` }, 502)
  }

  const weatherJson = await weatherResponse.json() as OpenWeatherResponse
  const currentWeather = weatherJson.current?.weather?.[0]
  const tomorrow = weatherJson.daily?.[1]
  const tomorrowWeather = tomorrow?.weather?.[0]

  const currentTemp = asRoundedNumber(asFiniteNumber(weatherJson.current?.temp), 1)
  const currentWindSpeed = asRoundedNumber(
    (() => {
      const windMs = asFiniteNumber(weatherJson.current?.wind_speed)
      return windMs === null ? null : windMs * 3.6
    })(),
    1,
  )
  const currentHumidity = (() => {
    const humidity = asFiniteNumber(weatherJson.current?.humidity)
    return humidity === null ? null : Math.round(humidity)
  })()
  const tomorrowTempMin = asRoundedNumber(asFiniteNumber(tomorrow?.temp?.min), 1)
  const tomorrowTempMax = asRoundedNumber(asFiniteNumber(tomorrow?.temp?.max), 1)
  const tomorrowPop = asRoundedNumber(asFiniteNumber(tomorrow?.pop), 2)

  const insertPayload = {
    tenant_id: resolvedTenantId,
    lat,
    lon,
    date_expiry: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    current_temp: currentTemp,
    current_icon: currentWeather?.icon ?? null,
    current_description: currentWeather?.description ?? null,
    current_wind_speed: currentWindSpeed,
    current_humidity: currentHumidity,
    forecast_tomorrow_temp_min: tomorrowTempMin,
    forecast_tomorrow_temp_max: tomorrowTempMax,
    forecast_tomorrow_icon: tomorrowWeather?.icon ?? null,
    forecast_tomorrow_pop: tomorrowPop,
    raw_json: weatherJson,
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from('meteo_cache')
    .insert(insertPayload)
    .select('*')
    .limit(1)

  if (insertError) {
    return jsonResponse({ error: insertError.message }, 500)
  }

  const insertedRow = (insertedRows?.[0] as MeteoCacheRow | undefined) ?? null
  if (!insertedRow) {
    return jsonResponse({ error: 'Nu am putut salva meteo_cache.' }, 500)
  }

  return jsonResponse(formatCacheRow(insertedRow, 'fresh'))
})
