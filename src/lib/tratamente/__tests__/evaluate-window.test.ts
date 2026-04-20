import { describe, expect, it } from 'vitest'

import { evaluateFereastra } from '@/lib/tratamente/meteo'

describe('evaluate-window', () => {
  it('marchează fereastra ca safe pentru condiții bune', () => {
    const result = evaluateFereastra({
      timestamp: '2026-04-20T08:00:00.000Z',
      temperatura_c: 18,
      vant_kmh: 5,
      precipitatii_mm: 0,
    })

    expect(result.safe).toBe(true)
    expect(result.motiv_blocaj).toBeNull()
  })

  it('blochează la vânt mare', () => {
    const result = evaluateFereastra({
      timestamp: '2026-04-20T08:00:00.000Z',
      temperatura_c: 18,
      vant_kmh: 20,
      precipitatii_mm: 0,
    })

    expect(result.safe).toBe(false)
    expect(result.motiv_blocaj).toBe('Vânt peste 15 km/h')
  })

  it('blochează la ploaie', () => {
    const result = evaluateFereastra({
      timestamp: '2026-04-20T08:00:00.000Z',
      temperatura_c: 18,
      vant_kmh: 5,
      precipitatii_mm: 1,
    })

    expect(result.safe).toBe(false)
    expect(result.motiv_blocaj).toBe('Precipitații prognozate')
  })

  it('blochează la temperatură prea mică', () => {
    const result = evaluateFereastra({
      timestamp: '2026-04-20T08:00:00.000Z',
      temperatura_c: 4,
      vant_kmh: 5,
      precipitatii_mm: 0,
    })

    expect(result.safe).toBe(false)
    expect(result.motiv_blocaj).toBe('Temperatură sub 5°C')
  })

  it('blochează la temperatură mare', () => {
    const result = evaluateFereastra({
      timestamp: '2026-04-20T08:00:00.000Z',
      temperatura_c: 32,
      vant_kmh: 5,
      precipitatii_mm: 0,
    })

    expect(result.safe).toBe(false)
    expect(result.motiv_blocaj).toBe('Temperatură peste 30°C')
  })

  it('concatenează maximum două motive în ordinea priorității', () => {
    const result = evaluateFereastra({
      timestamp: '2026-04-20T08:00:00.000Z',
      temperatura_c: 32,
      vant_kmh: 20,
      precipitatii_mm: 1,
    })

    expect(result.safe).toBe(false)
    expect(result.motiv_blocaj).toBe('Precipitații prognozate · Vânt peste 15 km/h')
  })

  it('tratează valorile null ca informație lipsă, nu ca blocaj', () => {
    const result = evaluateFereastra({
      timestamp: '2026-04-20T08:00:00.000Z',
      temperatura_c: null,
      vant_kmh: null,
      precipitatii_mm: null,
    })

    expect(result.safe).toBe(true)
    expect(result.motiv_blocaj).toBeNull()
  })
})
