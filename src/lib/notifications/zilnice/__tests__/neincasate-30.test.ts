import { describe, expect, it } from 'vitest'

import {
  LINK_NEINCASATE_30,
  esteNeincasataPeste30,
  neincasatePeste30,
  notificareNeincasatePeste30,
  textNeincasatePeste30,
  trebuieTrimisNeincasate,
  ziuaLivrarii,
  type ComandaPentruNeincasate,
} from '../neincasate-30'

const AZI = '2026-11-24'

function comanda(over: Partial<ComandaPentruNeincasate> & { vanzareData?: string | null; plata?: string; partial?: number | null } = {}): ComandaPentruNeincasate {
  const { vanzareData = '2026-10-25', plata = 'neplatit', partial = null, ...rest } = over
  return {
    id: 'c1',
    tenant_id: 't1',
    status: 'livrata',
    total: 150,
    data_livrare: '2026-10-25',
    linked_vanzare: { data: vanzareData, status_plata: plata, data_incasare: null, cantitate_kg: 5, pret_lei_kg: 30, suma_incasata_partial_lei: partial },
    ...rest,
  }
}

describe('neîncasate de peste 30 de zile', () => {
  it('exact 30 de zile intră; 29 nu', () => {
    expect(esteNeincasataPeste30(comanda({ vanzareData: '2026-10-25' }), AZI)).toBe(true) // 30 de zile
    expect(esteNeincasataPeste30(comanda({ vanzareData: '2026-10-26' }), AZI)).toBe(false) // 29
    expect(esteNeincasataPeste30(comanda({ vanzareData: '2026-08-01' }), AZI)).toBe(true)
  })

  it('plata parțială: intră cu restul; plătită integral sau încasată: nu', () => {
    const rezultat = neincasatePeste30([comanda({ partial: 100 })], AZI)
    expect(rezultat).toEqual({ numar: 1, lei: 50, comandaIds: ['c1'] })
    expect(esteNeincasataPeste30(comanda({ partial: 150 }), AZI)).toBe(false)
    expect(esteNeincasataPeste30(comanda({ plata: 'platit' }), AZI)).toBe(false)
    expect(esteNeincasataPeste30(comanda({ plata: 'Incasat' }), AZI)).toBe(false)
  })

  it('anulată, nelivrată, fără vânzare: nu', () => {
    expect(esteNeincasataPeste30(comanda({ status: 'anulata' }), AZI)).toBe(false)
    expect(esteNeincasataPeste30(comanda({ status: 'confirmata' }), AZI)).toBe(false)
    expect(esteNeincasataPeste30(comanda({ status: 'in_livrare' }), AZI)).toBe(false)
    expect(esteNeincasataPeste30(comanda({ linked_vanzare: null }), AZI)).toBe(false)
  })

  it('altă fermă nu intră în socoteala fermei', () => {
    const comenzi = [comanda({ id: 'a' }), comanda({ id: 'b', tenant_id: 't2' })]
    expect(neincasatePeste30(comenzi, AZI, 't1').comandaIds).toEqual(['a'])
    expect(notificareNeincasatePeste30({ tenantId: 't3', azi: AZI, comenzi, ultimaTrimitere: null })).toBeNull()
  })

  it('ziua livrării: a vânzării, altfel data_livrare', () => {
    expect(ziuaLivrarii(comanda({ vanzareData: '2026-10-01', data_livrare: '2026-09-30' }))).toBe('2026-10-01')
    expect(ziuaLivrarii(comanda({ vanzareData: null, data_livrare: '2026-09-30' }))).toBe('2026-09-30')
    expect(ziuaLivrarii(comanda({ vanzareData: null, data_livrare: null }))).toBeNull()
  })

  it('un singur mesaj cumulat, cu link spre lista filtrată și cheia zilei', () => {
    const comenzi = [comanda({ id: 'a' }), comanda({ id: 'b', partial: 120 }), comanda({ id: 'c', vanzareData: '2026-11-20' })]
    const notificare = notificareNeincasatePeste30({ tenantId: 't1', azi: AZI, comenzi, ultimaTrimitere: null })
    expect(notificare).toMatchObject({
      type: 'incasari_peste_30',
      title: '2 comenzi neîncasate de peste 30 de zile · total 180 lei',
      reminderKey: 'neincasate30:t1:2026-11-24',
      data: { comanda_ids: ['a', 'b'], total_lei: 180, link: LINK_NEINCASATE_30, tenant_id: 't1' },
    })
    expect(textNeincasatePeste30({ numar: 1, lei: 150 })).toBe('1 comandă neîncasată de peste 30 de zile · total 150 lei')
  })

  it('a doua oară abia după 7 zile', () => {
    expect(trebuieTrimisNeincasate(null, AZI)).toBe(true)
    expect(trebuieTrimisNeincasate('2026-11-24', AZI)).toBe(false) // azi deja
    expect(trebuieTrimisNeincasate('2026-11-18', AZI)).toBe(false) // 6 zile
    expect(trebuieTrimisNeincasate('2026-11-17', AZI)).toBe(true) // 7 zile
    expect(notificareNeincasatePeste30({ tenantId: 't1', azi: AZI, comenzi: [comanda()], ultimaTrimitere: '2026-11-20' })).toBeNull()
  })

  it('nimic neîncasat de peste 30 de zile: nicio notificare', () => {
    expect(notificareNeincasatePeste30({ tenantId: 't1', azi: AZI, comenzi: [comanda({ plata: 'platit' })], ultimaTrimitere: null })).toBeNull()
  })
})
