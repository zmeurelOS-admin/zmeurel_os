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
  const motiveBlocaj = [
    typeof ora.precipitatii_mm === 'number' && ora.precipitatii_mm > 0.5
      ? 'Precipitații prognozate'
      : null,
    typeof ora.vant_kmh === 'number' && ora.vant_kmh > 15
      ? 'Vânt peste 15 km/h'
      : null,
    typeof ora.temperatura_c === 'number' && ora.temperatura_c < 5
      ? 'Temperatură sub 5°C'
      : null,
    typeof ora.temperatura_c === 'number' && ora.temperatura_c > 30
      ? 'Temperatură peste 30°C'
      : null,
  ].filter((motiv): motiv is string => Boolean(motiv))

  const startDate = new Date(ora.timestamp)
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)

  return {
    ora_start: startDate.toISOString(),
    ora_end: endDate.toISOString(),
    safe: motiveBlocaj.length === 0,
    motiv_blocaj: motiveBlocaj.length > 0 ? motiveBlocaj.slice(0, 2).join(' · ') : null,
    temperatura_c: round(ora.temperatura_c),
    vant_kmh: round(ora.vant_kmh),
    precipitatii_mm: round(ora.precipitatii_mm),
  }
}
