import { describe, expect, it } from 'vitest'

import { avertizariPrognoza, numeZiScurt, textTemperaturi, zilePrognoza, type ZiPrognoza } from '@/lib/dashboard/prognoza'

const AZI = '2026-11-24' // marți
const zi = (z: string, over: Partial<ZiPrognoza> = {}): ZiPrognoza => ({ zi: z, tempMin: 3, tempMax: 9, ploaieMm: 0, vantMaxKmh: 10, icon: null, ...over })

describe('vremea pe 3 zile (promptul 33)', () => {
  it('doar zilele după azi, în ordine, cel mult 3; un răspuns stricat nu arată nimic', () => {
    const raw = [zi('2026-11-27'), zi('2026-11-24'), zi('2026-11-25'), zi('2026-11-26'), zi('2026-11-28'), { zi: 'x' }, null]
    expect(zilePrognoza(raw, AZI).map((z) => z.zi)).toEqual(['2026-11-25', '2026-11-26', '2026-11-27'])
    expect(zilePrognoza(undefined, AZI)).toEqual([])
    expect(zilePrognoza({}, AZI)).toEqual([])
  })

  it('îngheț la minimă ≤ 0 °C și ploaie mare la ≥ 20 mm', () => {
    expect(avertizariPrognoza([zi('2026-11-25', { tempMin: 0.4 }), zi('2026-11-26', { ploaieMm: 19.9 })], AZI)).toEqual([])
    expect(avertizariPrognoza([zi('2026-11-25', { tempMin: 0 }), zi('2026-11-26', { tempMin: -3, ploaieMm: 20 })], AZI)).toEqual([
      { tip: 'inghet', zi: '2026-11-25', text: 'Îngheț mâine: 0 °C' },
      { tip: 'ploaie_mare', zi: '2026-11-26', text: 'Ploaie mare joi: 20 mm' },
    ])
  })

  it('numele zilei și temperaturile', () => {
    expect(numeZiScurt('2026-11-25', AZI)).toBe('Mâine')
    expect(numeZiScurt('2026-11-27', AZI)).toBe('Vineri')
    expect(textTemperaturi({ tempMax: 8.6, tempMin: -1.2 })).toBe('9° / -1°')
    expect(textTemperaturi({ tempMax: null, tempMin: null })).toBe('— / —')
  })
})
