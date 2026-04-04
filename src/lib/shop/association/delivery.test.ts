import { describe, expect, it, vi } from 'vitest'

import {
  FREE_DELIVERY_THRESHOLD_LEI,
  getAmountUntilFreeDelivery,
  getDeliveryFee,
  getNextDeliveryDateIso,
} from '@/lib/shop/association/delivery'

describe('getDeliveryFee / getAmountUntilFreeDelivery', () => {
  it('taxă 15 sub prag', () => {
    expect(getDeliveryFee(90)).toBe(15)
    expect(getAmountUntilFreeDelivery(90)).toBe(FREE_DELIVERY_THRESHOLD_LEI - 90)
  })

  it('gratuit la sau peste prag', () => {
    expect(getDeliveryFee(150)).toBe(0)
    expect(getDeliveryFee(200)).toBe(0)
    expect(getAmountUntilFreeDelivery(150)).toBe(0)
  })
})

describe('getNextDeliveryDateIso', () => {
  it('luni înainte de marți 12:00 → miercurea aceeași săptămână', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T10:00:00+03:00'))
    expect(getNextDeliveryDateIso()).toBe('2026-04-08')
    vi.useRealTimers()
  })

  it('marți după 12:00 → miercurea din săptămâna următoare', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-07T14:00:00+03:00'))
    expect(getNextDeliveryDateIso()).toBe('2026-04-15')
    vi.useRealTimers()
  })
})
