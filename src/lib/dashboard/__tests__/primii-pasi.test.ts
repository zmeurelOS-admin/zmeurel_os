import { describe, expect, it } from 'vitest'

import { aratamPrimiiPasi, cheieAscundePrimiiPasi, pasiGata, pasiPrimii } from '@/lib/dashboard/primii-pasi'

describe('Primii pași', () => {
  it('fermă nouă, fără nimic: doar numele (dacă e ales); prețul e inactiv, fără cultură scrisă', () => {
    const pasi = pasiPrimii({ numeFerma: 'Ferma mea', parcele: [], culegatori: 0, pretPus: false })
    expect(pasi.map((pas) => pas.gata)).toEqual([false, false, false, false])
    const pret = pasi[3]
    expect(pret.titlu).toBe('Pune prețul')
    expect(pret.inactiv).toBe(true)
    expect(pret.motivInactiv).toBe('Întâi adaugă prima parcelă')
    expect(pasi.some((pas) => /zmeur/i.test(`${pas.titlu} ${pas.detaliu}`))).toBe(false)
  })

  it('după prima parcelă, prețul ia cultura ei, cu literă mică', () => {
    const pasi = pasiPrimii({ numeFerma: 'Livada Bunicii', parcele: [{ cultura: 'Afine' }], culegatori: 0, pretPus: false })
    expect(pasi[0]).toMatchObject({ gata: true, titlu: 'Numele fermei: Livada Bunicii' })
    expect(pasi[1].gata).toBe(true)
    expect(pasi[3]).toMatchObject({ titlu: 'Pune prețul la afine', inactiv: false, gata: false })
    expect(pasiGata(pasi)).toBe(2)
  })

  it('prețul pus fără parcelă nu bifează pasul 4', () => {
    const pasi = pasiPrimii({ numeFerma: 'X Y', parcele: [], culegatori: 2, pretPus: true })
    expect(pasi[2].gata).toBe(true)
    expect(pasi[3].gata).toBe(false)
  })

  it('cardul dispare când toți pașii sunt gata sau la „Ascunde”', () => {
    const toti = pasiPrimii({ numeFerma: 'Ferma Deal', parcele: [{ cultura: 'Zmeură' }], culegatori: 3, pretPus: true })
    expect(pasiGata(toti)).toBe(4)
    expect(aratamPrimiiPasi(toti, false)).toBe(false)
    const unii = pasiPrimii({ numeFerma: 'Ferma Deal', parcele: [], culegatori: 0, pretPus: false })
    expect(aratamPrimiiPasi(unii, false)).toBe(true)
    expect(aratamPrimiiPasi(unii, true)).toBe(false)
    expect(cheieAscundePrimiiPasi('u1')).toBe('zmeurel:primii-pasi-ascuns:u1')
  })
})
