import { describe, expect, it } from 'vitest'

import { butasiRevenueBetween, butasiRevenueDate } from '@/lib/vanzari-butasi/revenue'

describe('venituri material săditor', () => {
  const orders = [
    { status: 'livrata', total_lei: 900, data_livrare_estimata: '2026-11-18', data_comanda: '2026-11-01' },
    { status: 'livrata', total_lei: '150.5', data_livrare_estimata: null, data_comanda: '2026-10-05' },
    { status: 'noua', total_lei: 500, data_livrare_estimata: '2026-11-18', data_comanda: '2026-11-10' },
    { status: 'anulata', total_lei: 300, data_livrare_estimata: '2026-11-18', data_comanda: '2026-11-10' },
  ]

  it('numără doar comenzile livrate, la data livrării', () => {
    expect(butasiRevenueDate(orders[0])).toBe('2026-11-18')
    expect(butasiRevenueDate(orders[1])).toBe('2026-10-05')
    expect(butasiRevenueDate(orders[2])).toBeNull()
    expect(butasiRevenueBetween(orders, '2026-11-01', '2026-11-30')).toBe(900)
    expect(butasiRevenueBetween(orders, '2026-10-01', '2026-11-30')).toBe(1050.5)
    expect(butasiRevenueBetween(orders, '2026-12-01', '2026-12-31')).toBe(0)
  })
})
