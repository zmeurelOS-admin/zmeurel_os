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
    expect(result.motiv_blocaj?.toLowerCase()).toContain('vânt')
  })

  it('blochează la ploaie', () => {
    const result = evaluateFereastra({
      timestamp: '2026-04-20T08:00:00.000Z',
      temperatura_c: 18,
      vant_kmh: 5,
      precipitatii_mm: 1,
    })

    expect(result.safe).toBe(false)
    expect(result.motiv_blocaj?.toLowerCase()).toMatch(/precipitații|ploaie/)
  })

  it('blochează la temperatură mare', () => {
    const result = evaluateFereastra({
      timestamp: '2026-04-20T08:00:00.000Z',
      temperatura_c: 32,
      vant_kmh: 5,
      precipitatii_mm: 0,
    })

    expect(result.safe).toBe(false)
    expect(result.motiv_blocaj?.toLowerCase()).toContain('temperatur')
  })

  it('concatenează maximum două motive lizibile', () => {
    const result = evaluateFereastra({
      timestamp: '2026-04-20T08:00:00.000Z',
      temperatura_c: 32,
      vant_kmh: 20,
      precipitatii_mm: 1,
    })

    expect(result.safe).toBe(false)
    expect(result.motiv_blocaj).toContain('Vânt')
    expect(result.motiv_blocaj).toContain('Precipitații')
    expect(result.motiv_blocaj).not.toContain('Temperatură')
  })
})
