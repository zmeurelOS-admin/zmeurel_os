import { describe, expect, it } from 'vitest'

import { pauzaAplicarii, pauzeActive, pauzePeParcela, surseDinActivitati, surseDinAplicari } from '../pauza'
import { adaugaZile, zileText, ziCuDataRo, ziuaRo } from '../zile'

const P1 = 'parcela-1'
const P2 = 'parcela-2'

const aplicare = (over: Record<string, unknown> = {}) => ({
  parcela_id: P1,
  status: 'aplicata',
  data_aplicata: '2026-07-15T08:00:00+00:00',
  produse: [
    { produs_nume_snapshot: 'Scala', phi_zile_snapshot: 3 },
    { produs_nume_snapshot: 'Calciu foliar', phi_zile_snapshot: 0 },
  ],
  ...over,
})

describe('pauza: o singură sursă', () => {
  it('aplicare nouă: pauza = cea mai lungă dintre produse, de la ziua aplicării', () => {
    const pauze = pauzeActive({
      aplicari: [
        aplicare({
          produse: [
            { produs_nume_snapshot: 'Switch', phi_zile_snapshot: 7 },
            { produs_nume_snapshot: 'Scala', phi_zile_snapshot: 3 },
            { produs_nume_snapshot: 'Jump', phi_zile_snapshot: null },
          ],
        }),
      ],
      activitati: [],
      ziua: '2026-07-17',
    })
    const p = pauze.get(P1)!
    expect(p.panaLa).toBe('2026-07-22')
    expect(p.zileRamase).toBe(5)
    expect(p.produs).toBe('Switch')
  })

  it('stropit 15.07 cu pauză 3 zile → nu recolta până sâmbătă 18.07; pe 17 mai e 1 zi', () => {
    const pauze = pauzeActive({ aplicari: [aplicare()], activitati: [], ziua: '2026-07-17' })
    expect(pauze.get(P1)?.panaLa).toBe('2026-07-18')
    expect(pauze.get(P1)?.zileRamase).toBe(1)
    expect(ziCuDataRo('2026-07-18')).toBe('sâmbătă 18.07')
  })

  it('activitate veche cu timp_pauza_zile', () => {
    const pauze = pauzeActive({
      aplicari: [],
      activitati: [{ parcela_id: P2, data_aplicare: '2026-07-16T10:00:00+00:00', timp_pauza_zile: 5, produs_utilizat: 'Ortiva' }],
      ziua: '2026-07-17',
    })
    expect(pauze.get(P2)).toMatchObject({ panaLa: '2026-07-21', zileRamase: 4, produs: 'Ortiva' })
    expect(pauze.has(P1)).toBe(false)
  })

  it('ambele pe aceeași parcelă: câștigă cea care ține mai mult, produsele se strâng', () => {
    const pauze = pauzeActive({
      aplicari: [aplicare()],
      activitati: [{ parcela_id: P1, data_aplicare: '2026-07-14', timp_pauza_zile: 7, produs_utilizat: 'Ortiva' }],
      ziua: '2026-07-17',
    })
    const p = pauze.get(P1)!
    expect(p.panaLa).toBe('2026-07-21')
    expect(p.produs).toBe('Ortiva')
    expect(p.produse.sort()).toEqual(['Ortiva', 'Scala'])
  })

  it('expirată: în ziua permisă nu mai e pauză', () => {
    expect(pauzeActive({ aplicari: [aplicare()], activitati: [], ziua: '2026-07-18' }).size).toBe(0)
    expect(pauzeActive({ aplicari: [aplicare()], activitati: [], ziua: '2026-08-01' }).size).toBe(0)
  })

  it('ora României: o stropire seara târziu (UTC încă ziua dinainte) contează pe ziua românească', () => {
    // 15.07 22:30 UTC = 16.07 01:30 la București.
    expect(ziuaRo('2026-07-15T22:30:00+00:00')).toBe('2026-07-16')
    expect(ziuaRo('2026-07-15 22:30:00+00')).toBe('2026-07-16')
    const pauze = pauzeActive({
      aplicari: [aplicare({ data_aplicata: '2026-07-15T22:30:00+00:00' })],
      activitati: [],
      ziua: '2026-07-18',
    })
    expect(pauze.get(P1)?.panaLa).toBe('2026-07-19')
  })

  it('doar aplicările făcute: cele planificate nu dau pauză', () => {
    expect(surseDinAplicari([aplicare({ status: 'planificata', data_aplicata: null })])).toEqual([])
    expect(surseDinAplicari([aplicare({ status: 'planificata' })])).toEqual([])
  })

  it('o recoltare din trecut nu e în pauză din cauza unui tratament de după ea', () => {
    const pauze = pauzeActive({ aplicari: [aplicare()], activitati: [], ziua: '2026-07-14' })
    expect(pauze.size).toBe(0)
  })

  it('aplicare veche din plan, fără rânduri de produse: pauza produsului din antet', () => {
    expect(pauzaAplicarii({ produse: [], produs: { nume_comercial: 'Topas', phi_zile: 14 } })).toEqual({ zile: 14, produs: 'Topas' })
    expect(pauzaAplicarii({ produse: null, produs: null })).toEqual({ zile: 0, produs: null })
  })

  it('activitățile fără pauză sau fără parcelă se ignoră', () => {
    expect(
      surseDinActivitati([
        { parcela_id: P1, data_aplicare: '2026-07-14', timp_pauza_zile: 0 },
        { parcela_id: null, data_aplicare: '2026-07-14', timp_pauza_zile: 3 },
        { parcela_id: P1, data_aplicare: null, timp_pauza_zile: 3 },
      ]),
    ).toEqual([])
  })

  it('pauzePeParcela păstrează pauza cea mai lungă indiferent de ordine', () => {
    const surse = [
      { parcelaId: P1, ziAplicare: '2026-07-16', zilePauza: 3, produs: 'B', tip: 'aplicare' as const },
      { parcelaId: P1, ziAplicare: '2026-07-10', zilePauza: 14, produs: 'A', tip: 'activitate' as const },
    ]
    expect(pauzePeParcela(surse, '2026-07-17').get(P1)?.panaLa).toBe(adaugaZile('2026-07-10', 14))
  })

  it('zileText', () => {
    expect(zileText(1)).toBe('1 zi')
    expect(zileText(3)).toBe('3 zile')
    expect(zileText(21)).toBe('21 de zile')
  })
})
