import { describe, expect, it } from 'vitest'

import { asteaptaDemoGata, demoGata, esteTipDemo, lipsaDemo, pasiVerificati, type NumaratoareDemo } from '@/lib/demo/demo-gata'

const plin: NumaratoareDemo = { parcele: 6, recoltari: 15, comenzi: 12 }

describe('pragurile', () => {
  it('Fructe de pădure: gata doar cu toate datele', () => {
    expect(demoGata(plin, 'berries')).toBe(true)
    expect(lipsaDemo({ parcele: 6, recoltari: 3, comenzi: 0 }, 'berries')).toEqual(['recoltari', 'comenzi'])
    expect(demoGata({ parcele: 0, recoltari: 0, comenzi: 0 }, 'berries')).toBe(false)
  })

  it('Solarii au pragurile lor', () => {
    expect(demoGata({ parcele: 5, recoltari: 12, comenzi: 12 }, 'solar')).toBe(true)
    expect(demoGata({ parcele: 5, recoltari: 12, comenzi: 12 }, 'berries')).toBe(false)
  })

  it('pașii se bifează pe rând', () => {
    expect([...pasiVerificati(null, 'berries')]).toEqual([])
    expect([...pasiVerificati({ parcele: 6, recoltari: 2, comenzi: 12 }, 'berries')]).toEqual(['parcele'])
    expect([...pasiVerificati(plin, 'berries')]).toEqual(['parcele', 'recoltari', 'comenzi'])
  })

  it('doar cele două tipuri complete', () => {
    expect(esteTipDemo('berries')).toBe(true)
    expect(esteTipDemo('solar')).toBe(true)
    expect(esteTipDemo('orchard')).toBe(false)
    expect(esteTipDemo('fieldcrop')).toBe(false)
  })
})

describe('asteaptaDemoGata', () => {
  function ceas() {
    let t = 0
    return { acum: () => t, asteapta: async (ms: number) => void (t += ms) }
  }

  it('reîncearcă până se văd datele', async () => {
    const raspunsuri: NumaratoareDemo[] = [
      { parcele: 0, recoltari: 0, comenzi: 0 },
      { parcele: 6, recoltari: 4, comenzi: 0 },
      plin,
    ]
    const vazute: NumaratoareDemo[] = []
    const rezultat = await asteaptaDemoGata({
      tip: 'berries',
      citeste: async () => raspunsuri.shift() ?? plin,
      laFiecare: (n) => vazute.push(n),
      ...ceas(),
    })
    expect(rezultat).toEqual({ ok: true, numaratoare: plin, incercari: 3 })
    expect(vazute).toHaveLength(3)
  })

  it('se oprește la limita de timp', async () => {
    const rezultat = await asteaptaDemoGata({
      tip: 'berries',
      citeste: async () => ({ parcele: 6, recoltari: 0, comenzi: 0 }),
      limitaMs: 3000,
      pauzaMs: 1000,
      ...ceas(),
    })
    expect(rezultat.ok).toBe(false)
    if (!rezultat.ok) {
      expect(rezultat.motiv).toBe('timp')
      expect(rezultat.numaratoare).toEqual({ parcele: 6, recoltari: 0, comenzi: 0 })
    }
  })

  it('o eroare de citire care nu trece spune „eroare”', async () => {
    const rezultat = await asteaptaDemoGata({
      tip: 'solar',
      citeste: async () => {
        throw new Error('rețea')
      },
      limitaMs: 2000,
      pauzaMs: 1000,
      ...ceas(),
    })
    expect(rezultat).toMatchObject({ ok: false, motiv: 'eroare', eroare: 'rețea' })
  })

  it('o eroare urmată de date bune trece', async () => {
    let prima = true
    const rezultat = await asteaptaDemoGata({
      tip: 'berries',
      citeste: async () => {
        if (prima) {
          prima = false
          throw new Error('rețea')
        }
        return plin
      },
      ...ceas(),
    })
    expect(rezultat.ok).toBe(true)
  })
})
