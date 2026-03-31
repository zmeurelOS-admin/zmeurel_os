import { createClient } from 'npm:@supabase/supabase-js@2'

/** Ultim resort (Suceava) — aliniat la seed demo, dacă tenantul nu are încă GPS în parcele/setări */
const DEFAULT_METEO_LAT = 47.6514
const DEFAULT_METEO_LON = 26.2553

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

/** Current Weather 2.5 — https://api.openweathermap.org/data/2.5/weather (plan gratuit) */
type OpenWeather25Response = {
  main?: {
    temp?: number
    feels_like?: number
    humidity?: number
  }
  weather?: Array<{
    icon?: string
    description?: string
  }>
  wind?: {
    /** m/s când `units=metric` */
    speed?: number
  }
  name?: string
}

/** 5 Day / 3 Hour — gratuit, pentru min/max și probabilitate ploaie „mâine” (agregat pe intervale). */
type OpenWeatherForecast5Response = {
  list?: Array<{
    dt?: number
    main?: {
      temp?: number
      temp_min?: number
      temp_max?: number
    }
    weather?: Array<{ icon?: string }>
    pop?: number
  }>
}

const BUCHAREST_TZ = 'Europe/Bucharest'

type TomorrowAgg = {
  tempMin: number | null
  tempMax: number | null
  icon: string | null
  pop: number | null
}

function ymdInBucharest(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUCHAREST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

/** Prima zi calendaristică după „azi” în București (pentru prognoza „mâine”). */
function nextCalendarYmdBucharestAfterToday(): string {
  const today = ymdInBucharest(Date.now())
  let t = Date.now() + 12 * 3600000
  for (let i = 0; i < 96; i++) {
    const y = ymdInBucharest(t)
    if (y !== today) return y
    t += 3600000
  }
  return today
}

function aggregateTomorrowFromForecast5(forecast: OpenWeatherForecast5Response): TomorrowAgg | null {
  const targetYmd = nextCalendarYmdBucharestAfterToday()
  const items = forecast.list ?? []
  const slots = items.filter((it) => {
    const sec = asFiniteNumber(it.dt)
    if (sec === null) return false
    return ymdInBucharest(sec * 1000) === targetYmd
  })
  if (slots.length === 0) return null

  let tMin = Infinity
  let tMax = -Infinity
  let maxPop = 0
  let iconForMaxPop: string | null = slots[0]?.weather?.[0]?.icon ?? null

  for (const s of slots) {
    const mn = asFiniteNumber(s.main?.temp_min)
    const mx = asFiniteNumber(s.main?.temp_max)
    const tmid = asFiniteNumber(s.main?.temp)
    const pop = asFiniteNumber(s.pop) ?? 0
    if (mn !== null) tMin = Math.min(tMin, mn)
    if (mx !== null) tMax = Math.max(tMax, mx)
    if ((mn === null || mx === null) && tmid !== null) {
      tMin = Math.min(tMin, tmid)
      tMax = Math.max(tMax, tmid)
    }
    if (pop > maxPop) {
      maxPop = pop
      iconForMaxPop = s.weather?.[0]?.icon ?? iconForMaxPop
    }
  }

  if (!Number.isFinite(tMin) || !Number.isFinite(tMax)) return null

  return {
    tempMin: asRoundedNumber(tMin, 1),
    tempMax: asRoundedNumber(tMax, 1),
    icon: iconForMaxPop,
    pop: asRoundedNumber(maxPop, 2),
  }
}

async function fetchOpenWeatherCurrentAndForecast(
  lat: number,
  lon: number,
  appid: string,
): Promise<
  | { ok: false; status: number; body: string }
  | { ok: true; current: OpenWeather25Response; tomorrow: TomorrowAgg }
> {
  const currentUrl = new URL('https://api.openweathermap.org/data/2.5/weather')
  currentUrl.searchParams.set('lat', String(lat))
  currentUrl.searchParams.set('lon', String(lon))
  currentUrl.searchParams.set('units', 'metric')
  currentUrl.searchParams.set('lang', 'ro')
  currentUrl.searchParams.set('appid', appid)

  const forecastUrl = new URL('https://api.openweathermap.org/data/2.5/forecast')
  forecastUrl.searchParams.set('lat', String(lat))
  forecastUrl.searchParams.set('lon', String(lon))
  forecastUrl.searchParams.set('units', 'metric')
  forecastUrl.searchParams.set('lang', 'ro')
  forecastUrl.searchParams.set('appid', appid)

  const [currentRes, forecastRes] = await Promise.all([fetch(currentUrl), fetch(forecastUrl)])

  if (!currentRes.ok) {
    const body = await currentRes.text().catch(() => '')
    return { ok: false, status: currentRes.status, body }
  }

  const current = await currentRes.json() as OpenWeather25Response

  const emptyTomorrow: TomorrowAgg = {
    tempMin: null,
    tempMax: null,
    icon: null,
    pop: null,
  }

  let tomorrow = emptyTomorrow
  if (forecastRes.ok) {
    try {
      const forecastJson = await forecastRes.json() as OpenWeatherForecast5Response
      const agg = aggregateTomorrowFromForecast5(forecastJson)
      if (agg) tomorrow = agg
    } catch (e) {
      console.warn('[meteo] forecast JSON parse failed', e)
    }
  } else {
    const preview = await forecastRes.text().catch(() => '')
    console.warn('[meteo] forecast 5d non-OK', { status: forecastRes.status, body: preview.slice(0, 200) })
  }

  return { ok: true, current, tomorrow }
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

export const meteoCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, x-supabase-authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...meteoCorsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

/** Cheia din secrets poate avea newline / spații la copy-paste — OpenWeather refuză cererea. */
function readOpenWeatherApiKey(): string {
  const raw = Deno.env.get('OPENWEATHER_API_KEY') ?? Deno.env.get('OPENWEATHERMAP_API_KEY') ?? ''
  return raw.trim()
}

function jsonOpenWeatherHttpFailure(status: number, bodyText: string) {
  const preview = bodyText.slice(0, 400)
  console.error('[meteo] OpenWeather 2.5 request failed', { status, body: preview })
  let error = `Weather service unavailable (HTTP ${status})`
  if (status === 401) {
    error =
      'OpenWeather 401: cheie API invalidă sau neactivată. Verifică OPENWEATHERMAP_API_KEY în Supabase Secrets (fără spații la final).'
  } else if (status === 403) {
    error = 'OpenWeather 403: acces refuzat (plan / restricții).'
  } else if (status === 429) {
    error = 'OpenWeather 429: limită apeluri depășită.'
  }
  return jsonResponse({ available: false, error }, 200)
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

function extractCurrentFromOpenWeather25(weatherJson: OpenWeather25Response) {
  const currentWeather = weatherJson.weather?.[0]
  const currentTemp = asRoundedNumber(asFiniteNumber(weatherJson.main?.temp), 1)
  const currentWindSpeed = asRoundedNumber(
    (() => {
      const windMs = asFiniteNumber(weatherJson.wind?.speed)
      return windMs === null ? null : windMs * 3.6
    })(),
    1,
  )
  const currentHumidity = (() => {
    const humidity = asFiniteNumber(weatherJson.main?.humidity)
    return humidity === null ? null : Math.round(humidity)
  })()
  return {
    currentTemp,
    currentIcon: currentWeather?.icon ?? null,
    currentDescription: currentWeather?.description ?? null,
    currentWindSpeed,
    currentHumidity,
  }
}

/** Răspuns proaspăt fără rând în meteo_cache (ex. curl cu lat/lon, fără tenant). */
function buildEphemeralMeteoPayload(
  weatherJson: OpenWeather25Response,
  lat: number,
  lon: number,
  tomorrow: TomorrowAgg,
): MeteoPayload {
  const cur = extractCurrentFromOpenWeather25(weatherJson)
  const now = new Date().toISOString()
  const expiryAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
  const spray = computeSprayAdvice({
    pop: tomorrow.pop,
    windSpeed: cur.currentWindSpeed,
    temperature: cur.currentTemp,
  })
  return {
    available: true,
    source: 'fresh',
    lat,
    lon,
    fetchedAt: now,
    expiryAt,
    current: {
      temp: cur.currentTemp,
      icon: cur.currentIcon,
      description: cur.currentDescription,
      windSpeed: cur.currentWindSpeed,
      humidity: cur.currentHumidity,
    },
    forecastTomorrow: {
      tempMin: tomorrow.tempMin,
      tempMax: tomorrow.tempMax,
      icon: tomorrow.icon,
      pop: tomorrow.pop,
    },
    spray,
  }
}

/**
 * Handler comun pentru `fetch-meteo` și `get-meteo`.
 * Răspunde la OPTIONS cu CORS ca browserul să nu rețină 401 fără headere de la gateway când lipsea funcția / JWT.
 */
export async function handleMeteoRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: meteoCorsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const openWeatherApiKey = readOpenWeatherApiKey()
  const authHeader = request.headers.get('Authorization') ?? request.headers.get('authorization') ?? ''
  const accessToken = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: 'Supabase environment is missing.' }, 500)
  }

  if (!openWeatherApiKey) {
    return jsonResponse({
      available: false,
      error: 'API key not configured',
    })
  }

  const body = await request.json().catch(() => ({})) as {
    tenant_id?: string | null
    lat?: unknown
    lon?: unknown
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  let resolvedUserId: string | null = null
  if (accessToken) {
    const { data: userData } = await supabase.auth.getUser(accessToken)
    resolvedUserId = userData?.user?.id ?? null
  }

  let resolvedTenantId: string | null = null
  let profileTenantId: string | null = null

  if (resolvedUserId) {
    const { data: profileRow, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', resolvedUserId)
      .maybeSingle()

    if (profileError) {
      return jsonResponse({ error: profileError.message }, 500)
    }

    profileTenantId = typeof profileRow?.tenant_id === 'string' ? profileRow.tenant_id : null
    resolvedTenantId = profileTenantId
  }

  const bodyTenantId =
    typeof body.tenant_id === 'string' && body.tenant_id.trim() ? body.tenant_id.trim() : null

  if (bodyTenantId) {
    if (resolvedUserId) {
      if (!profileTenantId) {
        // Utilizator autentificat fără tenant în profil — ignorăm tenant_id din body (anti-spoof).
      } else if (bodyTenantId !== profileTenantId) {
        return jsonResponse({ available: false, error: 'Tenant invalid pentru utilizatorul curent.' })
      }
    } else if (!resolvedTenantId) {
      resolvedTenantId = bodyTenantId
    }
  }

  if (resolvedUserId && !profileTenantId) {
    const bodyLatEarly = asFiniteNumber(body.lat)
    const bodyLonEarly = asFiniteNumber(body.lon)
    if (bodyLatEarly !== null && bodyLonEarly !== null) {
      const bundle = await fetchOpenWeatherCurrentAndForecast(bodyLatEarly, bodyLonEarly, openWeatherApiKey)
      if (!bundle.ok) {
        return jsonOpenWeatherHttpFailure(bundle.status, bundle.body)
      }
      return jsonResponse(
        buildEphemeralMeteoPayload(bundle.current, bodyLatEarly, bodyLonEarly, bundle.tomorrow),
      )
    }

    return jsonResponse({ available: false }, 200)
  }

  const bodyLat = asFiniteNumber(body.lat)
  const bodyLon = asFiniteNumber(body.lon)

  if (!resolvedTenantId) {
    if (bodyLat !== null && bodyLon !== null) {
      const bundle = await fetchOpenWeatherCurrentAndForecast(bodyLat, bodyLon, openWeatherApiKey)
      if (!bundle.ok) {
        return jsonOpenWeatherHttpFailure(bundle.status, bundle.body)
      }
      return jsonResponse(buildEphemeralMeteoPayload(bundle.current, bodyLat, bodyLon, bundle.tomorrow))
    }

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

  const readParcelCoords = (onlyComercial: boolean) => {
    let q = supabase
      .from('parcele')
      .select('latitudine,longitudine')
      .eq('tenant_id', resolvedTenantId)
      .not('latitudine', 'is', null)
      .not('longitudine', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
    if (onlyComercial) {
      q = q.eq('rol', 'comercial')
    }
    return q
  }

  const { data: parcelaComercial, error: parcelaComErr } = await readParcelCoords(true)
  if (parcelaComErr) {
    return jsonResponse({ error: parcelaComErr.message }, 500)
  }

  let lat = asFiniteNumber(parcelaComercial?.[0]?.latitudine)
  let lon = asFiniteNumber(parcelaComercial?.[0]?.longitudine)

  if (lat === null || lon === null) {
    const { data: parcelaOrice, error: parcelaAnyErr } = await readParcelCoords(false)
    if (parcelaAnyErr) {
      return jsonResponse({ error: parcelaAnyErr.message }, 500)
    }
    lat = asFiniteNumber(parcelaOrice?.[0]?.latitudine)
    lon = asFiniteNumber(parcelaOrice?.[0]?.longitudine)
  }

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
    lat = DEFAULT_METEO_LAT
    lon = DEFAULT_METEO_LON
  }

  const bundle = await fetchOpenWeatherCurrentAndForecast(lat, lon, openWeatherApiKey)
  if (!bundle.ok) {
    return jsonOpenWeatherHttpFailure(bundle.status, bundle.body)
  }

  const weatherJson = bundle.current
  const cur = extractCurrentFromOpenWeather25(weatherJson)
  const tomorrow = bundle.tomorrow

  const insertPayload = {
    tenant_id: resolvedTenantId,
    lat,
    lon,
    date_expiry: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    current_temp: cur.currentTemp,
    current_icon: cur.currentIcon,
    current_description: cur.currentDescription,
    current_wind_speed: cur.currentWindSpeed,
    current_humidity: cur.currentHumidity,
    forecast_tomorrow_temp_min: tomorrow.tempMin,
    forecast_tomorrow_temp_max: tomorrow.tempMax,
    forecast_tomorrow_icon: tomorrow.icon,
    forecast_tomorrow_pop: tomorrow.pop,
    raw_json: { current: weatherJson, forecast_tomorrow: tomorrow },
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
}
