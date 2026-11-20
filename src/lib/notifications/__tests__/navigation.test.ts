import { describe, expect, it } from 'vitest'

import { getNotificationHref } from '@/lib/notifications/navigation'

describe('getNotificationHref', () => {
  it('order_new farm_shop merge la /comenzi', () => {
    expect(
      getNotificationHref(
        {
          type: 'order_new',
          data: { channel: 'farm_shop' },
        },
        null,
      ),
    ).toBe('/comenzi')
  })

  it('order_new association_shop merge la /asociatie/comenzi', () => {
    expect(
      getNotificationHref(
        {
          type: 'order_new',
          data: { channel: 'association_shop' },
        },
        null,
      ),
    ).toBe('/asociatie/comenzi')
  })

  it('tipurile push-enabled au destinație validă', () => {
    const cases = [
      { type: 'order_new', data: { channel: 'farm_shop' }, expected: '/comenzi' },
      { type: 'offer_new', data: {}, expected: '/asociatie/oferte' },
      { type: 'offer_approved', data: {}, expected: '/produse' },
      { type: 'offer_rejected', data: {}, expected: '/produse' },
    ] as const

    for (const testCase of cases) {
      expect(
        getNotificationHref(
          {
            type: testCase.type,
            data: testCase.data,
          },
          null,
        ),
      ).toBe(testCase.expected)
    }
  })

  it('verificarea zilnică: comenzi, fișa clientului (sau lista), Acasă', () => {
    expect(getNotificationHref({ type: 'comenzi_maine', data: {} }, null)).toBe('/comenzi')
    expect(getNotificationHref({ type: 'incasari_restante', data: { client_id: 'cl-1' } }, null)).toBe('/clienti?client=cl-1')
    expect(getNotificationHref({ type: 'incasari_restante', data: { grup: true, client_ids: ['a', 'b'] } }, null)).toBe('/clienti')
    expect(getNotificationHref({ type: 'meteo_inghet', data: {} }, null)).toBe('/dashboard')
    expect(getNotificationHref({ type: 'meteo_grindina', data: {} }, null)).toBe('/dashboard')
  })
})
