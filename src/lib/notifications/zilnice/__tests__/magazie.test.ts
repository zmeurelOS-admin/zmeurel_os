import { describe, expect, it } from 'vitest'

import { esteLuni, produsePeTerminate } from '../magazie'

const produse = [
  { produs_id: 'k', nume: 'Kristalon', tip: 'ingrasamant', unitate: 'kg' as const, prag: 2 },
  { produs_id: 'b', nume: 'Borofol', tip: 'foliar', unitate: 'l' as const, prag: null },
  { produs_id: 'a', nume: 'Azotat', tip: 'ingrasamant', unitate: 'kg' as const, prag: null },
]
const miscari = [
  { produs_id: 'k', tip: 'intrare' as const, cantitate: 5, data: '2026-05-20' },
  { produs_id: 'k', tip: 'iesire_tratament' as const, cantitate: -4.2, data: '2026-06-12', grup: 'l1' },
  { produs_id: 'b', tip: 'intrare' as const, cantitate: 1, data: '2026-05-20' },
  { produs_id: 'b', tip: 'iesire_tratament' as const, cantitate: -0.6, data: '2026-06-05', grup: 'l2' },
  { produs_id: 'a', tip: 'intrare' as const, cantitate: 20, data: '2026-05-20' },
  { produs_id: 'a', tip: 'iesire_tratament' as const, cantitate: -2, data: '2026-07-02', grup: 'l3' },
]

describe('notificarea „pe terminate” (lunea)', () => {
  it('luni, după ziua din București', () => {
    expect(esteLuni('2026-11-23')).toBe(true)
    expect(esteLuni('2026-11-22')).toBe(false)
  })

  it('doar lunea, cu produsele pe terminate, cheia pe fermă și zi', () => {
    expect(produsePeTerminate({ tenantId: 't', azi: '2026-11-22', produse, miscari })).toBeNull()
    const notificare = produsePeTerminate({ tenantId: 't', azi: '2026-11-23', produse, miscari })
    expect(notificare).toMatchObject({
      type: 'magazie_pe_terminate',
      title: '2 produse pe terminate în magazie',
      reminderKey: 'magazie:t:2026-11-23',
      entityType: 'magazie',
    })
    expect(notificare?.body).toContain('Borofol, Kristalon')
  })

  it('nimic pe terminate: fără notificare', () => {
    expect(produsePeTerminate({ tenantId: 't', azi: '2026-11-23', produse: [produse[2]], miscari })).toBeNull()
  })
})
