/**
 * Prelucrarea prognozei OpenWeather 5 Day / 3 Hour pentru „mâine” (ziua calendaristică din București).
 * Funcții pure, fără Deno și fără rețea: le folosește `meteo-handler.ts` și le testează vitest.
 */

const BUCHAREST_TZ = 'Europe/Bucharest'

/** 5 Day / 3 Hour — gratuit, pentru min/max, probabilitatea de ploaie și furtunile de „mâine”. */
export type OpenWeatherForecast5Response = {
  list?: Array<{
    dt?: number
    main?: {
      temp?: number
      temp_min?: number
      temp_max?: number
    }
    /** `id` = codul vremii (2xx = furtună), `icon` = iconița („11d”/„11n” = furtună). */
    weather?: Array<{ id?: number; icon?: string }>
    pop?: number
    /** Vântul, m/s (`units=metric`). */
    wind?: { speed?: number; gust?: number }
    /** Ploaia în ultimele 3 ore, mm. */
    rain?: { '3h'?: number }
    /** Ninsoarea în ultimele 3 ore, mm (echivalent apă). */
    snow?: { '3h'?: number }
  }>
}

/** Un interval de 3 ore cu furtună (cod 2xx). */
export type IntervalFurtuna = {
  /** Începutul intervalului, ISO (UTC). */
  ora: string
  /** Probabilitatea de precipitații, 0–1. */
  pop: number | null
  /** Codul OpenWeather (200–299), dacă a venit. */
  cod: number | null
  icon: string | null
}

export type TomorrowAgg = {
  tempMin: number | null
  tempMax: number | null
  /** Iconița intervalului cu cea mai mare probabilitate de ploaie. */
  icon: string | null
  /** Cea mai mare probabilitate de ploaie din zi. */
  pop: number | null
  /**
   * Toate intervalele de 3 ore de mâine cu furtună, în ordinea orelor. Separat de `icon` / `pop`:
   * o furtună poate fi în alt interval decât ploaia maximă. Gol = nicio furtună în prognoză.
   */
  furtuni: IntervalFurtuna[]
}

export const EMPTY_TOMORROW: TomorrowAgg = {
  tempMin: null,
  tempMax: null,
  icon: null,
  pop: null,
  furtuni: [],
}

export function asFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function asRoundedNumber(value: number | null, fractionDigits = 1): number | null {
  if (value === null || !Number.isFinite(value)) return null
  return Number(value.toFixed(fractionDigits))
}

export function ymdInBucharest(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUCHAREST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms))
}

/** Prima zi calendaristică după „azi” în București (pentru prognoza „mâine”). */
export function nextCalendarYmdBucharestAfterToday(nowMs: number = Date.now()): string {
  const today = ymdInBucharest(nowMs)
  let t = nowMs + 12 * 3600000
  for (let i = 0; i < 96; i++) {
    const y = ymdInBucharest(t)
    if (y !== today) return y
    t += 3600000
  }
  return today
}

/** Intervalul are furtună: cod 2xx sau, fără cod, iconița „11”. */
export function isStormSlot(weather: { id?: number; icon?: string } | undefined): boolean {
  if (!weather) return false
  const id = asFiniteNumber(weather.id)
  if (id !== null) return id >= 200 && id < 300
  return typeof weather.icon === 'string' && weather.icon.startsWith('11')
}

export function aggregateTomorrowFromForecast5(
  forecast: OpenWeatherForecast5Response,
  nowMs: number = Date.now(),
): TomorrowAgg | null {
  const targetYmd = nextCalendarYmdBucharestAfterToday(nowMs)
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
  const furtuni: IntervalFurtuna[] = []

  for (const s of slots) {
    const mn = asFiniteNumber(s.main?.temp_min)
    const mx = asFiniteNumber(s.main?.temp_max)
    const tmid = asFiniteNumber(s.main?.temp)
    const popRaw = asFiniteNumber(s.pop)
    const pop = popRaw ?? 0
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
    const weather = s.weather?.[0]
    if (isStormSlot(weather)) {
      furtuni.push({
        ora: new Date((asFiniteNumber(s.dt) ?? 0) * 1000).toISOString(),
        pop: asRoundedNumber(popRaw, 2),
        cod: asFiniteNumber(weather?.id),
        icon: weather?.icon ?? null,
      })
    }
  }

  if (!Number.isFinite(tMin) || !Number.isFinite(tMax)) return null

  return {
    tempMin: asRoundedNumber(tMin, 1),
    tempMax: asRoundedNumber(tMax, 1),
    icon: iconForMaxPop,
    pop: asRoundedNumber(maxPop, 2),
    furtuni,
  }
}

/**
 * Furtunile salvate în `meteo_cache.raw_json.forecast_tomorrow.furtuni`.
 * `null` = rândul e scris de o versiune veche a funcției (nu știm intervalele), nu „fără furtuni”.
 */
export function readFurtuniFromRawJson(raw: unknown): IntervalFurtuna[] | null {
  if (!raw || typeof raw !== 'object') return null
  const tomorrow = (raw as { forecast_tomorrow?: unknown }).forecast_tomorrow
  if (!tomorrow || typeof tomorrow !== 'object') return null
  const list = (tomorrow as { furtuni?: unknown }).furtuni
  if (!Array.isArray(list)) return null
  return list
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      ora: typeof item.ora === 'string' ? item.ora : '',
      pop: asFiniteNumber(item.pop),
      cod: asFiniteNumber(item.cod),
      icon: typeof item.icon === 'string' ? item.icon : null,
    }))
}

// ─── Următoarele zile (promptul 33) ──────────────────────────────────────────────────────────────────────────────

/** O zi din prognoză, pentru cardul de vreme din Acasă. */
export type ZiPrognoza = {
  /** `YYYY-MM-DD`, ziua din București. */
  zi: string
  tempMin: number | null
  tempMax: number | null
  /** Ploaie + ninsoare din zi, mm (suma intervalelor de 3 ore). */
  ploaieMm: number | null
  /** Vântul cel mai puternic din zi, km/h. */
  vantMaxKmh: number | null
  /** Iconița intervalului cu cea mai mare probabilitate de ploaie. */
  icon: string | null
}

/** Ziua `ymd` + `n` zile (`YYYY-MM-DD`, calcul pe zile calendaristice). */
function adaugaZileYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + n)
  return date.toISOString().slice(0, 10)
}

/**
 * Următoarele `zile` zile după azi (București), din prognoza 5 Day / 3 Hour: min / max, ploaia în mm, vântul maxim în
 * km/h. O zi fără niciun interval în prognoză nu apare (de obicei a patra-a cincea zi, spre capătul prognozei).
 */
export function aggregateNextDaysFromForecast5(
  forecast: OpenWeatherForecast5Response,
  nowMs: number = Date.now(),
  zile = 3,
): ZiPrognoza[] {
  const azi = ymdInBucharest(nowMs)
  const tinte = Array.from({ length: zile }, (_, i) => adaugaZileYmd(azi, i + 1))
  const rezultat: ZiPrognoza[] = []
  for (const zi of tinte) {
    const slots = (forecast.list ?? []).filter((it) => {
      const sec = asFiniteNumber(it.dt)
      return sec !== null && ymdInBucharest(sec * 1000) === zi
    })
    if (slots.length === 0) continue
    let tMin = Infinity
    let tMax = -Infinity
    let ploaie = 0
    let areDatePloaie = false
    let vant = -Infinity
    let maxPop = -1
    let icon: string | null = slots[0]?.weather?.[0]?.icon ?? null
    for (const s of slots) {
      const mn = asFiniteNumber(s.main?.temp_min) ?? asFiniteNumber(s.main?.temp)
      const mx = asFiniteNumber(s.main?.temp_max) ?? asFiniteNumber(s.main?.temp)
      if (mn !== null) tMin = Math.min(tMin, mn)
      if (mx !== null) tMax = Math.max(tMax, mx)
      const mm = (asFiniteNumber(s.rain?.['3h']) ?? 0) + (asFiniteNumber(s.snow?.['3h']) ?? 0)
      ploaie += mm
      areDatePloaie = true
      const v = asFiniteNumber(s.wind?.speed)
      if (v !== null) vant = Math.max(vant, v)
      const pop = asFiniteNumber(s.pop) ?? 0
      if (pop > maxPop) {
        maxPop = pop
        icon = s.weather?.[0]?.icon ?? icon
      }
    }
    rezultat.push({
      zi,
      tempMin: Number.isFinite(tMin) ? asRoundedNumber(tMin, 1) : null,
      tempMax: Number.isFinite(tMax) ? asRoundedNumber(tMax, 1) : null,
      ploaieMm: areDatePloaie ? asRoundedNumber(ploaie, 1) : null,
      vantMaxKmh: Number.isFinite(vant) ? asRoundedNumber(vant * 3.6, 0) : null,
      icon,
    })
  }
  return rezultat
}

/**
 * Zilele salvate în `meteo_cache.raw_json.forecast_zile`. `null` = rând scris de o versiune veche a funcției (fără
 * zilele următoare): cardul arată doar ziua de azi.
 */
export function readForecastZileFromRawJson(raw: unknown): ZiPrognoza[] | null {
  if (!raw || typeof raw !== 'object') return null
  const list = (raw as { forecast_zile?: unknown }).forecast_zile
  if (!Array.isArray(list)) return null
  return list
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && typeof (item as { zi?: unknown }).zi === 'string')
    .map((item) => ({
      zi: String(item.zi),
      tempMin: asFiniteNumber(item.tempMin),
      tempMax: asFiniteNumber(item.tempMax),
      ploaieMm: asFiniteNumber(item.ploaieMm),
      vantMaxKmh: asFiniteNumber(item.vantMaxKmh),
      icon: typeof item.icon === 'string' ? item.icon : null,
    }))
}
