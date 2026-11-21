import { describe, expect, it } from 'vitest'

import { buildClientMetrics } from '@/lib/clienti/view'
import type { Vanzare } from '@/lib/supabase/queries/vanzari'
import { restDeIncasat, venitIncasat, ziuaVenitului } from '@/lib/vanzari/incasari'
import { incasatInLuna } from '@/lib/vanzari/view'

function vanzare(over: Partial<Vanzare>): Vanzare {
  return {
    id: 'v',
    client_id: 'c1',
    data: '2026-10-28',
    cantitate_kg: 10,
    pret_lei_kg: 30,
    status_plata: 'neplatit',
    data_incasare: null,
    suma_incasata_partial_lei: null,
    ...over,
  } as Vanzare
}

/**
 * Regula lui Andrei: venitul dintr-o vânzare parțial încasată intră integral la încasarea restului.
 * Vânzare de 300 lei din 28.10, 100 lei primiți pe loc, restul încasat pe 05.11.
 */
describe('o singură regulă de venit pentru Acasă, Vânzări, Clienți și Rapoarte', () => {
  const partiala = vanzare({ id: 'p', status_plata: 'avans', suma_incasata_partial_lei: 100 })
  const incasata = vanzare({ id: 'p', status_plata: 'platit', suma_incasata_partial_lei: 100, data_incasare: '2026-11-05' })

  it('parțial încasată: nu e venit; restul de încasat e 200 lei', () => {
    expect(ziuaVenitului(partiala)).toBeNull()
    expect(venitIncasat([partiala], '2026-10-01', '2026-11-30')).toBe(0)
    expect(incasatInLuna([partiala], { year: 2026, month: 10 }).lei).toBe(0)
    expect(restDeIncasat([partiala])).toEqual({ lei: 200, count: 1 })
    const client = buildClientMetrics([{ id: 'c1' }], [], [partiala], 2026).get('c1')
    expect(client).toMatchObject({ incasatAn: 0, neincasatLei: 200 })
  })

  it('după încasarea restului: toți 300 de lei intră în luna încasării, nu în luna vânzării', () => {
    expect(ziuaVenitului(incasata)).toBe('2026-11-05')
    expect(venitIncasat([incasata], '2026-10-01', '2026-10-31')).toBe(0)
    expect(venitIncasat([incasata], '2026-11-01', '2026-11-30')).toBe(300)
    expect(incasatInLuna([incasata], { year: 2026, month: 10 }).lei).toBe(0)
    expect(incasatInLuna([incasata], { year: 2026, month: 11 }).lei).toBe(300)
    expect(restDeIncasat([incasata]).lei).toBe(0)
    expect(buildClientMetrics([{ id: 'c1' }], [], [incasata], 2026).get('c1')).toMatchObject({ incasatAn: 300, neincasatLei: 0 })
  })

  it('restanța și „neîncasat” nu sunt venit, deși conțin „incasat”', () => {
    for (const status_plata of ['restanta', 'neincasat', 'neplatit']) {
      expect(ziuaVenitului(vanzare({ status_plata }))).toBeNull()
    }
  })
})
