import { describe, expect, it, vi } from 'vitest'

import { PRAGURI_IMPLICITE, pestePrag } from '@/lib/capcane'
import { GRUPURI_DEMO, deleteDemoCapcane, seedDemoCapcane } from '@/lib/demo/demo-capcane'

describe('capcanele din demo', () => {
  it('Maravilla trece de prag în ultimele săptămâni; verificarea ei e scadentă azi', () => {
    const maravilla = GRUPURI_DEMO[0]
    const totaluri = maravilla.capturi.map((rand) => rand.reduce((s, n) => s + n, 0))
    expect(totaluri).toEqual([0, 1, 3, 4, 9])
    const peste = totaluri.map((capturi) => pestePrag({ capturi, nrBucati: maravilla.bucati, prag: PRAGURI_IMPLICITE.drosophila, inCoacere: true }))
    expect(peste).toEqual([false, false, true, true, true])
    expect(maravilla.zile.at(-1)! + 7).toBe(0)
  })

  it('2 grupuri Drosophila de câte 3 și unul de lipicioase galbene, pe 5 săptămâni', () => {
    expect(GRUPURI_DEMO.map((g) => [g.tip, g.bucati])).toEqual([
      ['drosophila', 3],
      ['drosophila', 3],
      ['lipicioasa_galbena', 2],
    ])
    for (const grup of GRUPURI_DEMO) {
      expect(grup.zile).toHaveLength(5)
      expect(grup.capturi.every((rand) => rand.length === grup.bucati)).toBe(true)
    }
  })

  it('fără migrare nu scrie nimic și nu oprește demo-ul', async () => {
    const insert = vi.fn(() => ({ select: () => Promise.resolve({ data: null, error: { code: 'PGRST204', message: "Could not find the 'interval_verificare_zile' column" } }) }))
    const admin = { from: () => ({ insert }) }
    const rezultat = await seedDemoCapcane(admin as never, 't', [{ id: 'p1', nume_parcela: 'Maravilla' }], () => '2026-06-01')
    expect(rezultat).toEqual({ grupuri: 0, verificari: 0, error: null })
  })

  it('reîncărcarea șterge doar capcanele de pe parcelele demo date', async () => {
    const pasi: string[] = []
    const lant = {
      eq: (c: string, v: string) => (pasi.push(`eq:${c}=${v}`), lant),
      in: (c: string, v: string[]) => (pasi.push(`in:${c}=${v.join(',')}`), lant),
      select: () => Promise.resolve({ data: [{ id: 'g1' }, { id: 'g2' }], error: null }),
    }
    const admin = { from: (t: string) => (pasi.push(`from:${t}`), { delete: () => lant }) }
    expect(await deleteDemoCapcane(admin as never, 't', ['p1', 'p2'])).toBe(2)
    expect(pasi).toEqual(['from:capcane_montate', 'eq:tenant_id=t', 'in:parcela_id=p1,p2'])
    expect(await deleteDemoCapcane(admin as never, 't', [])).toBe(0)
  })
})
