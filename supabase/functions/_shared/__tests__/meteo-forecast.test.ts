import { describe, expect, it } from 'vitest'

import { prognozaDinFetchMeteo, alertaMeteo } from '@/lib/notifications/zilnice'

import { aggregateNextDaysFromForecast5, aggregateTomorrowFromForecast5, readForecastZileFromRawJson, readFurtuniFromRawJson } from '../meteo-forecast'

/** 2026-07-10 08:00 în București (05:00 UTC); „mâine” = 2026-07-11. */
const ACUM = Date.parse('2026-07-10T05:00:00Z')
/** Începutul unui interval de 3 ore pe 2026-07-11, ora României (UTC+3 vara). */
const slot = (oraRo: number) => Date.parse(`2026-07-11T${String(oraRo).padStart(2, '0')}:00:00+03:00`) / 1000

const forecast = {
  list: [
    // azi: nu intră
    { dt: Date.parse('2026-07-10T15:00:00Z') / 1000, main: { temp_min: 20, temp_max: 28 }, weather: [{ id: 211, icon: '11d' }], pop: 0.9 },
    { dt: slot(3), main: { temp_min: 14, temp_max: 15 }, weather: [{ id: 800, icon: '01n' }], pop: 0 },
    // ploaia maximă: ploaie obișnuită, nu furtună
    { dt: slot(9), main: { temp_min: 17, temp_max: 19 }, weather: [{ id: 501, icon: '10d' }], pop: 0.95 },
    // furtunile, în alte intervale
    { dt: slot(15), main: { temp_min: 24, temp_max: 27 }, weather: [{ id: 211, icon: '11d' }], pop: 0.7 },
    { dt: slot(18), main: { temp_min: 22, temp_max: 25 }, weather: [{ id: 201, icon: '11d' }], pop: 0.6 },
    // fără cod, doar iconița „11”
    { dt: slot(21), main: { temp_min: 19, temp_max: 21 }, weather: [{ icon: '11n' }], pop: 0.3 },
  ],
}

describe('aggregateTomorrowFromForecast5', () => {
  it('păstrează toate intervalele cu furtună, separat de ploaia maximă', () => {
    const agg = aggregateTomorrowFromForecast5(forecast, ACUM)
    expect(agg).not.toBeNull()
    expect(agg).toMatchObject({ tempMin: 14, tempMax: 27, icon: '10d', pop: 0.95 })
    expect(agg?.furtuni.map((f) => f.cod)).toEqual([211, 201, null])
    expect(agg?.furtuni.map((f) => f.pop)).toEqual([0.7, 0.6, 0.3])
    expect(agg?.furtuni[0]?.ora).toBe('2026-07-11T12:00:00.000Z')
  })

  it('fără furtuni: listă goală', () => {
    const agg = aggregateTomorrowFromForecast5({ list: forecast.list.slice(1, 3) }, ACUM)
    expect(agg?.furtuni).toEqual([])
  })

  it('fără intervale pentru mâine: null', () => {
    expect(aggregateTomorrowFromForecast5({ list: [forecast.list[0]!] }, ACUM)).toBeNull()
  })
})

describe('readFurtuniFromRawJson', () => {
  it('citește furtunile din cache; rândurile vechi dau null', () => {
    expect(readFurtuniFromRawJson({ forecast_tomorrow: { furtuni: [{ ora: 'x', pop: 0.6, cod: 211, icon: '11d' }] } })).toEqual([
      { ora: 'x', pop: 0.6, cod: 211, icon: '11d' },
    ])
    expect(readFurtuniFromRawJson({ forecast_tomorrow: { pop: 0.2 } })).toBeNull()
    expect(readFurtuniFromRawJson(null)).toBeNull()
  })
})

describe('alerta de furtună cu prognoza nouă', () => {
  it('furtuna din alt interval decât ploaia maximă dă alertă', () => {
    const agg = aggregateTomorrowFromForecast5(forecast, ACUM)!
    const prognoza = prognozaDinFetchMeteo('t1', {
      available: true,
      fetchedAt: new Date(ACUM).toISOString(),
      forecastTomorrow: agg,
    })
    const alerte = alertaMeteo(prognoza, new Date(ACUM))
    const furtuna = alerte.find((a) => a.title.includes('furtună'))
    expect(furtuna?.body).toBe('Probabilitate 70%.')
  })

  it('cu prognoza veche (doar ploaia maximă, fără furtună) nu se vede furtuna', () => {
    const prognoza = prognozaDinFetchMeteo('t1', {
      available: true,
      fetchedAt: new Date(ACUM).toISOString(),
      forecastTomorrow: { tempMin: 14, icon: '10d', pop: 0.95 },
    })
    expect(alertaMeteo(prognoza, new Date(ACUM)).some((a) => a.title.includes('furtună'))).toBe(false)
  })
})

// Promptul 33: următoarele 3 zile, pe ziua din București.
describe('aggregateNextDaysFromForecast5', () => {
  const ACUM_IARNA = Date.parse('2026-11-24T06:00:00Z') // 8:00 în București
  const la = (zi: string, ora: number) => Date.parse(`${zi}T${String(ora).padStart(2, '0')}:00:00+02:00`) / 1000
  const prognoza = {
    list: [
      { dt: la('2026-11-24', 15), main: { temp_min: 5, temp_max: 8 }, rain: { '3h': 4 }, wind: { speed: 9 } }, // azi: nu intră
      { dt: la('2026-11-25', 3), main: { temp_min: -2, temp_max: 0 }, wind: { speed: 2 }, pop: 0 },
      { dt: la('2026-11-25', 12), main: { temp_min: 3, temp_max: 6 }, rain: { '3h': 1.5 }, wind: { speed: 5 }, pop: 0.6, weather: [{ icon: '10d' }] },
      { dt: la('2026-11-26', 9), main: { temp: 7 }, rain: { '3h': 12 }, wind: { speed: 4 } },
      { dt: la('2026-11-26', 15), main: { temp: 9 }, rain: { '3h': 10 }, snow: { '3h': 0.4 }, wind: { speed: 6.2 } },
      { dt: la('2026-11-27', 12), main: { temp_min: 1, temp_max: 4 } },
      { dt: la('2026-11-28', 12), main: { temp_min: 0, temp_max: 2 } }, // a patra zi: nu intră
    ],
  }

  it('min / max, ploaia în mm, vântul maxim în km/h, doar următoarele 3 zile', () => {
    const zile = aggregateNextDaysFromForecast5(prognoza, ACUM_IARNA)
    expect(zile.map((z) => z.zi)).toEqual(['2026-11-25', '2026-11-26', '2026-11-27'])
    expect(zile[0]).toMatchObject({ tempMin: -2, tempMax: 6, ploaieMm: 1.5, vantMaxKmh: 18, icon: '10d' })
    expect(zile[1]).toMatchObject({ tempMin: 7, tempMax: 9, ploaieMm: 22.4, vantMaxKmh: 22 })
    expect(zile[2]).toMatchObject({ tempMin: 1, tempMax: 4, ploaieMm: 0, vantMaxKmh: null })
  })

  it('zilele se citesc înapoi din cache; un rând vechi, fără zile, dă null', () => {
    const zile = aggregateNextDaysFromForecast5(prognoza, ACUM_IARNA)
    expect(readForecastZileFromRawJson({ forecast_zile: zile })).toEqual(zile)
    expect(readForecastZileFromRawJson({ current: {}, forecast_tomorrow: {} })).toBeNull()
    expect(readForecastZileFromRawJson(null)).toBeNull()
  })
})
