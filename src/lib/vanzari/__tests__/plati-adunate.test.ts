import { describe, expect, it } from 'vitest'

import { aplicaPlata, vanzarePrimit, vanzareRest, venitIncasat, ziuaVenitului } from '@/lib/vanzari/incasari'

type V = Parameters<typeof aplicaPlata>[0]

const vanzare350: V = {
  cantitate_kg: 10,
  pret_lei_kg: 35,
  status_plata: 'neplatit',
  suma_incasata_partial_lei: null,
  data_incasare: null,
  data_incasare_partiala: null,
  data: '2026-11-10',
}

describe('vânzări — plățile parțiale se adună', () => {
  it('100 + 150 dintr-o vânzare de 350: a dat 250, rest 100, încă neîncasată', () => {
    const prima = aplicaPlata(vanzare350, 100, '2026-11-12')
    expect(prima.ok).toBe(true)
    if (!prima.ok) return
    const aDoua = aplicaPlata(prima.vanzare, 150, '2026-11-14')
    expect(aDoua.ok).toBe(true)
    if (!aDoua.ok) return
    expect(vanzarePrimit(aDoua.vanzare)).toBe(250)
    expect(vanzareRest(aDoua.vanzare)).toBe(100)
    expect(aDoua.completeaza).toBe(false)
    expect(ziuaVenitului(aDoua.vanzare)).toBeNull()
  })

  it('restul completează vânzarea: încasată, venitul integral la ziua restului', () => {
    let state = vanzare350
    for (const [suma, zi] of [[100, '2026-11-12'], [150, '2026-11-14'], [100, '2026-11-20']] as const) {
      const r = aplicaPlata(state, suma, zi)
      if (!r.ok) throw new Error(r.motiv)
      state = r.vanzare
    }
    expect(state.status_plata).toBe('platit')
    expect(ziuaVenitului(state)).toBe('2026-11-20')
    expect(venitIncasat([state], '2026-11-01', '2026-11-30')).toBe(350)
    expect(venitIncasat([state], '2026-11-15', '2026-11-19')).toBe(0)
  })

  it('plata nu poate depăși restul de plată', () => {
    const prima = aplicaPlata(vanzare350, 300, '2026-11-12')
    if (!prima.ok) throw new Error(prima.motiv)
    const prea = aplicaPlata(prima.vanzare, 60, '2026-11-13')
    expect(prea.ok).toBe(false)
    if (prea.ok) return
    expect(prea.motiv).toBe('Plata depășește restul de plată (rest 50 lei).')
  })

  it('suma 0 sau negativă e refuzată; o vânzare încasată nu mai primește plăți', () => {
    expect(aplicaPlata(vanzare350, 0, '2026-11-12').ok).toBe(false)
    expect(aplicaPlata(vanzare350, -5, '2026-11-12').ok).toBe(false)
    expect(aplicaPlata({ ...vanzare350, status_plata: 'platit' }, 10, '2026-11-12').ok).toBe(false)
  })
})
