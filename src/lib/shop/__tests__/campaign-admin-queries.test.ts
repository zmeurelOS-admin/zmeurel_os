import { describe, expect, it } from 'vitest'

import {
  aggregateLeaderboard,
  assignFinalPrizes,
} from '@/lib/shop/campaign-admin-queries'
import type { ShopOrderRow } from '@/lib/shop/b2c-order-helpers'

function order(overrides: Partial<ShopOrderRow>): ShopOrderRow {
  return {
    id: crypto.randomUUID(),
    created_at: '2026-06-10T08:00:00.000Z',
    customer_name: 'Client',
    customer_phone: '0700000000',
    delivery_mode: 'livrare',
    delivery_address: null,
    delivery_city: null,
    delivery_date: null,
    delivery_position: null,
    items: [],
    total_lei: 0,
    notes: null,
    status: 'confirmata',
    notified_wa: false,
    ...overrides,
  }
}

describe('campaign admin leaderboard', () => {
  it('agregă comenzile după telefon și sortează după cantitate', () => {
    const leaderboard = aggregateLeaderboard([
      order({
        customer_name: 'Ana',
        customer_phone: '0711111111',
        delivery_city: null,
        items: [{ qty: 2 }, { qty: 1 }],
        total_lei: 54,
      }),
      order({
        created_at: '2026-06-11T08:00:00.000Z',
        customer_name: 'Ana Pop',
        customer_phone: '0711111111',
        delivery_city: 'Suceava',
        items: [{ qty: 4 }],
        total_lei: 70,
      }),
      order({
        customer_name: 'Maria',
        customer_phone: '0722222222',
        delivery_city: 'Rădăuți',
        items: [{ qty: 9 }],
        total_lei: 160,
      }),
    ])

    expect(leaderboard).toEqual([
      expect.objectContaining({
        rang: 1,
        customerName: 'Maria',
        customerPhone: '0722222222',
        totalQty: 9,
        orderCount: 1,
        totalLei: 160,
      }),
      expect.objectContaining({
        rang: 2,
        customerName: 'Ana',
        customerPhone: '0711111111',
        city: 'Suceava',
        totalQty: 7,
        orderCount: 2,
        totalLei: 124,
        lastOrderAt: '2026-06-11T08:00:00.000Z',
      }),
    ])
  })

  it('ignoră cantitățile invalide și atribuie premiile doar primelor zece locuri', () => {
    const aggregated = aggregateLeaderboard(
      Array.from({ length: 11 }, (_, index) =>
        order({
          customer_phone: `07000000${String(index).padStart(2, '0')}`,
          items: [{ qty: index + 1 }, { qty: 'invalid' }],
        }),
      ),
    )
    const leaderboard = assignFinalPrizes(aggregated)

    expect(leaderboard[0]).toMatchObject({
      rang: 1,
      finalPrize: '2 kg zmeură + miere + jeleu de zmeure',
    })
    expect(leaderboard[1].finalPrize).toBe('1 kg zmeură + miere')
    expect(leaderboard[2].finalPrize).toBe('1 kg zmeură')
    expect(leaderboard[9].finalPrize).toBe('Voucher sezon următor')
    expect(leaderboard[10].finalPrize).toBeNull()
  })
})
