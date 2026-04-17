import type { MeteoFereastra } from '@/lib/tratamente/meteo/types'

interface OraInput {
  timestamp: string
  temperatura_c: number | null
  vant_kmh: number | null
  precipitatii_mm: number | null
}

function round(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  return Math.round(value * 10) / 10
}

export function evaluateFereastra(ora: OraInput): MeteoFereastra {
  const motives: string[] = []

  if (typeof ora.vant_kmh === 'number' && ora.vant_kmh > 15) {
    motives.push(`Vânt > 15 km/h (${round(ora.vant_kmh)} km/h)`)
  }

  if (typeof ora.precipitatii_mm === 'number' && ora.precipitatii_mm > 0.5) {
    motives.push(`Precipitații > 0,5 mm (${round(ora.precipitatii_mm)} mm)`)
  }

  if (typeof ora.temperatura_c === 'number' && ora.temperatura_c < 5) {
    motives.push(`Temperatură < 5°C (${round(ora.temperatura_c)}°C)`)
  }

  if (typeof ora.temperatura_c === 'number' && ora.temperatura_c > 30) {
    motives.push(`Temperatură > 30°C (${round(ora.temperatura_c)}°C)`)
  }

  const startDate = new Date(ora.timestamp)
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)

  return {
    ora_start: startDate.toISOString(),
    ora_end: endDate.toISOString(),
    safe: motives.length === 0,
    motiv_blocaj: motives.length > 0 ? motives.slice(0, 2).join(' · ') : null,
    temperatura_c: round(ora.temperatura_c),
    vant_kmh: round(ora.vant_kmh),
    precipitatii_mm: round(ora.precipitatii_mm),
  }
}
