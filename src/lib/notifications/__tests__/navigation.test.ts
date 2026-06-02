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
      { type: 'tratament_reminder', data: {}, expected: '/tratamente' },
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
})
