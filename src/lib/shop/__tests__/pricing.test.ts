import { describe, expect, it } from 'vitest'

import { computeZmeuraTotalLei } from '@/lib/shop/pricing'

describe('computeZmeuraTotalLei', () => {
  it.each([
    [1, 18],
    [2, 35],
    [3, 53],
    [4, 70],
    [5, 88],
    [11, 193],
  ])('calculează %i caserole la %i lei', (qty, expectedTotal) => {
    expect(computeZmeuraTotalLei(qty)).toBe(expectedTotal)
  })

  it('acceptă coșul gol și respinge cantitățile invalide', () => {
    expect(computeZmeuraTotalLei(0)).toBe(0)
    expect(() => computeZmeuraTotalLei(1.5)).toThrow(RangeError)
    expect(() => computeZmeuraTotalLei(-1)).toThrow(RangeError)
  })
})
