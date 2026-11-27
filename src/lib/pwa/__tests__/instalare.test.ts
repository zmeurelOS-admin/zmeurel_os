import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ZILE_ASCUNSA, aratBanda, citesteStare, esteIphone, inchideBanda, noteazaFolosirea, semnaleazaSalvare } from '@/lib/pwa/instalare'

const ZI = 86_400_000
const acum = Date.parse('2026-11-27T10:00:00Z')
const gol = { primaZi: null, aSalvat: false, inchisaLa: null }

describe('banda de instalare din Acasă (promptul 34, §4)', () => {
  it('demo → nu', () => {
    expect(aratBanda({ demo: true, instalata: false, stare: { ...gol, primaZi: '2026-11-01', aSalvat: true }, azi: '2026-11-27', acum })).toBe(false)
  })

  it('prima zi → nu; a doua zi → da', () => {
    expect(aratBanda({ demo: false, instalata: false, stare: { ...gol, primaZi: '2026-11-27' }, azi: '2026-11-27', acum })).toBe(false)
    expect(aratBanda({ demo: false, instalata: false, stare: { ...gol, primaZi: '2026-11-26' }, azi: '2026-11-27', acum })).toBe(true)
  })

  it('după prima salvare → da, chiar din prima zi', () => {
    expect(aratBanda({ demo: false, instalata: false, stare: { ...gol, primaZi: '2026-11-27', aSalvat: true }, azi: '2026-11-27', acum })).toBe(true)
  })

  it('închisă acum 10 zile → nu; acum 31 de zile → da', () => {
    const stare = { primaZi: '2026-10-01', aSalvat: true, inchisaLa: acum - 10 * ZI }
    expect(aratBanda({ demo: false, instalata: false, stare, azi: '2026-11-27', acum })).toBe(false)
    expect(aratBanda({ demo: false, instalata: false, stare: { ...stare, inchisaLa: acum - (ZILE_ASCUNSA + 1) * ZI }, azi: '2026-11-27', acum })).toBe(true)
  })

  it('instalată → nu', () => {
    expect(aratBanda({ demo: false, instalata: true, stare: { ...gol, primaZi: '2026-11-01', aSalvat: true }, azi: '2026-11-27', acum })).toBe(false)
  })

  it('iPhone / iPad recunoscut după browser', () => {
    expect(esteIphone('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true)
    expect(esteIphone('Mozilla/5.0 (Linux; Android 14; Pixel 7)')).toBe(false)
  })
})

describe('starea pe dispozitiv', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => window.localStorage.clear())

  it('prima zi se notează o singură dată; salvarea și închiderea se țin minte', () => {
    noteazaFolosirea('2026-11-20')
    noteazaFolosirea('2026-11-27')
    expect(citesteStare()).toEqual({ primaZi: '2026-11-20', aSalvat: false, inchisaLa: null })
    semnaleazaSalvare()
    expect(citesteStare().aSalvat).toBe(true)
    inchideBanda(acum)
    expect(citesteStare()).toEqual({ primaZi: '2026-11-20', aSalvat: true, inchisaLa: acum })
  })
})
