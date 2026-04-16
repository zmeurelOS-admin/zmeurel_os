import { describe, expect, it } from 'vitest'

import {
  formatQuantityForDisplay,
  getInitialQuantityForUnit,
  getQuantityStep,
} from '@/lib/shop/utils'

describe('shop utils — cantități', () => {
  it('unitățile discrete folosesc step 1 și min 1', () => {
    expect(getQuantityStep('casoletă')).toEqual({ step: 1, min: 1 })
    expect(getQuantityStep('buc')).toEqual({ step: 1, min: 1 })
    expect(getQuantityStep('pachet de sezon')).toEqual({ step: 1, min: 1 })
  })

  it('toate unitățile folosesc step 1 și min 1', () => {
    expect(getQuantityStep('kg')).toEqual({ step: 1, min: 1 })
    expect(getQuantityStep('litru')).toEqual({ step: 1, min: 1 })
  })

  it('cantitatea inițială recomandată este minimum 1', () => {
    expect(getInitialQuantityForUnit('kg')).toBe(1)
    expect(getInitialQuantityForUnit('casoletă')).toBe(1)
  })

  it('afișează fără zecimale pentru unități discrete', () => {
    expect(formatQuantityForDisplay(1, 'buc')).toBe('1')
    expect(formatQuantityForDisplay(3, 'casoletă')).toBe('3')
    expect(formatQuantityForDisplay(1.5, 'kg')).toBe('2')
  })
})
