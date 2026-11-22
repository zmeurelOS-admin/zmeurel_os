import { describe, expect, it } from 'vitest'

import {
  NOTIFICARI_CHEI,
  NOTIFICARI_PREFERINTE_IMPLICITE,
  cateSuntPornite,
  cheiePentruTip,
  eLinisteNoaptea,
  isMissingTableError,
  normalizeazaPreferinte,
  oraInBucuresti,
  permitePush,
  type NotificariPreferinte,
} from '@/lib/notifications/preferinte'

// 20 noiembrie: România e pe ora de iarnă (UTC+2).
const ziua = new Date('2026-11-20T10:00:00Z') // 12:00 în București
const seara2159 = new Date('2026-11-20T19:59:00Z') // 21:59
const seara2200 = new Date('2026-11-20T20:00:00Z') // 22:00
const noaptea = new Date('2026-11-21T01:30:00Z') // 03:30
const dimineata559 = new Date('2026-11-21T03:59:00Z') // 05:59
const dimineata600 = new Date('2026-11-21T04:00:00Z') // 06:00
// Vara (UTC+3): 22:00 în București = 19:00 UTC.
const varaLa22 = new Date('2026-07-10T19:00:00Z')

const toateOprite: NotificariPreferinte = {
  tipuri: Object.fromEntries(NOTIFICARI_CHEI.map((cheie) => [cheie, false])),
  linisteNoaptea: false,
}

describe('cheiePentruTip (tip de notificare → comutator)', () => {
  it('tipurile din tabelul promptului', () => {
    expect(cheiePentruTip('order_new')).toBe('noi')
    expect(cheiePentruTip('butasi_delivery_reminder')).toBe('maine')
    expect(cheiePentruTip('tratament_reminder')).toBe('pauza')
    expect(cheiePentruTip('weekly_sales_summary')).toBe('sapt')
    expect(cheiePentruTip('system')).toBe('acte')
    expect(cheiePentruTip('producer_approved')).toBe('acte')
    expect(cheiePentruTip('product_listed')).toBe('acte')
  })

  it('order_status_changed merge cu comenzile noi din magazin', () => {
    expect(cheiePentruTip('order_status_changed')).toBe('noi')
  })

  it('perechile și actele care expiră intră la „acte”; alertele meteo_* la „meteo”', () => {
    expect(cheiePentruTip('product_unlisted')).toBe('acte')
    expect(cheiePentruTip('producer_suspended')).toBe('acte')
    expect(cheiePentruTip('legal_docs_expiring')).toBe('acte')
    expect(cheiePentruTip('meteo_inghet')).toBe('meteo')
  })

  it('verificarea zilnică: comenzi de mâine, bani de încasat, îngheț și grindină', () => {
    expect(cheiePentruTip('comenzi_maine')).toBe('maine')
    expect(cheiePentruTip('incasari_restante')).toBe('rest')
    expect(cheiePentruTip('meteo_inghet')).toBe('meteo')
    expect(cheiePentruTip('meteo_grindina')).toBe('meteo')
  })

  it('comutatorul oprit oprește push-ul tipurilor zilnice; gerul trece și noaptea', () => {
    expect(permitePush({ tipuri: { maine: false }, linisteNoaptea: false }, 'comenzi_maine', ziua)).toBe(false)
    expect(permitePush({ tipuri: { rest: false }, linisteNoaptea: false }, 'incasari_restante', ziua)).toBe(false)
    expect(permitePush({ tipuri: { meteo: false }, linisteNoaptea: false }, 'meteo_grindina', ziua)).toBe(false)
    expect(permitePush(NOTIFICARI_PREFERINTE_IMPLICITE, 'comenzi_maine', ziua)).toBe(true)
    expect(permitePush(NOTIFICARI_PREFERINTE_IMPLICITE, 'incasari_restante', noaptea)).toBe(false)
    expect(permitePush(NOTIFICARI_PREFERINTE_IMPLICITE, 'meteo_inghet', noaptea)).toBe(true)
  })

  it('tipurile fără comutator întorc null', () => {
    expect(cheiePentruTip('offer_new')).toBeNull()
    expect(cheiePentruTip('ceva_nou')).toBeNull()
  })
})

describe('liniște noaptea (22:00–6:00, Europe/Bucharest)', () => {
  it('ora din București, iarna și vara', () => {
    expect(oraInBucuresti(ziua)).toBe(12)
    expect(oraInBucuresti(seara2200)).toBe(22)
    expect(oraInBucuresti(varaLa22)).toBe(22)
  })

  it('marginile intervalului', () => {
    expect(eLinisteNoaptea(ziua)).toBe(false)
    expect(eLinisteNoaptea(seara2159)).toBe(false)
    expect(eLinisteNoaptea(seara2200)).toBe(true)
    expect(eLinisteNoaptea(noaptea)).toBe(true)
    expect(eLinisteNoaptea(dimineata559)).toBe(true)
    expect(eLinisteNoaptea(dimineata600)).toBe(false)
    expect(eLinisteNoaptea(varaLa22)).toBe(true)
  })
})

describe('permitePush', () => {
  it('fără preferințe salvate: ziua pleacă tot', () => {
    for (const type of ['order_new', 'butasi_delivery_reminder', 'weekly_sales_summary', 'offer_new']) {
      expect(permitePush(NOTIFICARI_PREFERINTE_IMPLICITE, type, ziua)).toBe(true)
    }
  })

  it('comutatorul oprit oprește push-ul doar pentru tipurile lui', () => {
    const prefs: NotificariPreferinte = { tipuri: { noi: false }, linisteNoaptea: true }
    expect(permitePush(prefs, 'order_new', ziua)).toBe(false)
    expect(permitePush(prefs, 'order_status_changed', ziua)).toBe(false)
    expect(permitePush(prefs, 'butasi_delivery_reminder', ziua)).toBe(true)
  })

  it('cheie lipsă = pornit; cheie true = pornit', () => {
    expect(permitePush({ tipuri: { maine: true }, linisteNoaptea: false }, 'butasi_delivery_reminder', ziua)).toBe(true)
    expect(permitePush({ tipuri: {}, linisteNoaptea: false }, 'butasi_delivery_reminder', ziua)).toBe(true)
  })

  it('noaptea, cu liniște: nimic, în afară de ger', () => {
    const prefs = NOTIFICARI_PREFERINTE_IMPLICITE
    expect(permitePush(prefs, 'order_new', noaptea)).toBe(false)
    expect(permitePush(prefs, 'offer_new', noaptea)).toBe(false)
    expect(permitePush(prefs, 'meteo_inghet', noaptea)).toBe(true)
  })

  it('noaptea, fără liniște: pleacă', () => {
    expect(permitePush({ tipuri: {}, linisteNoaptea: false }, 'order_new', noaptea)).toBe(true)
  })

  it('gerul oprit din comutator nu sună nici noaptea', () => {
    expect(permitePush({ tipuri: { meteo: false }, linisteNoaptea: true }, 'meteo_inghet', noaptea)).toBe(false)
  })

  it('tip fără comutator: oprit doar de liniștea de noapte', () => {
    expect(permitePush(toateOprite, 'offer_new', ziua)).toBe(true)
    expect(permitePush({ ...toateOprite, linisteNoaptea: true }, 'offer_new', noaptea)).toBe(false)
  })
})

describe('normalizeazaPreferinte', () => {
  it('fără rând: implicite', () => {
    expect(normalizeazaPreferinte(null)).toEqual({ tipuri: {}, linisteNoaptea: true })
  })

  it('păstrează doar cheile cunoscute, cu valori boolean', () => {
    expect(
      normalizeazaPreferinte({ tipuri: { noi: false, meteo: true, altceva: false, rest: 'nu' }, liniste_noaptea: false }),
    ).toEqual({ tipuri: { noi: false, meteo: true }, linisteNoaptea: false })
  })

  it('valori ciudate devin implicite', () => {
    expect(normalizeazaPreferinte({ tipuri: [1, 2], liniste_noaptea: 'da' })).toEqual({ tipuri: {}, linisteNoaptea: true })
  })

  it('cateSuntPornite numără cele 9', () => {
    expect(cateSuntPornite(NOTIFICARI_PREFERINTE_IMPLICITE)).toBe(9)
    expect(cateSuntPornite({ tipuri: { noi: false, sapt: false }, linisteNoaptea: true })).toBe(7)
  })

  it('tratamentele planificate au comutatorul lor, `tratamente`', () => {
    expect(cheiePentruTip('tratament_planificat')).toBe('tratamente')
    expect(permitePush({ tipuri: { tratamente: false }, linisteNoaptea: false }, 'tratament_planificat')).toBe(false)
    expect(permitePush({ tipuri: { pauza: false }, linisteNoaptea: false }, 'tratament_planificat')).toBe(true)
  })
})

describe('isMissingTableError', () => {
  it('recunoaște tabelul lipsă', () => {
    expect(isMissingTableError({ code: '42P01' })).toBe(true)
    expect(isMissingTableError({ code: 'PGRST205', message: "Could not find the table 'public.notificari_preferinte'" })).toBe(true)
    expect(isMissingTableError({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(isMissingTableError(null)).toBe(false)
  })
})
