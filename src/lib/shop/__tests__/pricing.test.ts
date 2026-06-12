import { describe, expect, it } from 'vitest'

import { computeZmeuraTotalLei } from '@/lib/shop/pricing'

describe('computeZmeuraTotalLei', () => {
  it.each([
    [1, 20],
    [2, 40],
    [3, 60],
    [4, 80],
    [5, 100],
    [11, 220],
  ])('calculează %i caserole la %i lei', (qty, expectedTotal) => {
    expect(computeZmeuraTotalLei(qty)).toBe(expectedTotal)
  })

  it('acceptă coșul gol și respinge cantitățile invalide', () => {
    expect(computeZmeuraTotalLei(0)).toBe(0)
    expect(() => computeZmeuraTotalLei(1.5)).toThrow(RangeError)
    expect(() => computeZmeuraTotalLei(-1)).toThrow(RangeError)
  })
})
