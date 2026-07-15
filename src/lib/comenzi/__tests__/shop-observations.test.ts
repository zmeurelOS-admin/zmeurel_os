import { describe, expect, it } from 'vitest'

import { getDisplayOrderObservatii } from '@/lib/comenzi/shop-observations'

describe('getDisplayOrderObservatii', () => {
  const shopPrefix = 'Comandă shop 123e4567-e89b-12d3-a456-426614174000'

  it('ascunde observația când conține doar identificatorul tehnic Shop', () => {
    expect(getDisplayOrderObservatii(shopPrefix, true)).toBe('')
    expect(getDisplayOrderObservatii(`${shopPrefix} | `, true)).toBe('')
  })

  it('păstrează numai nota relevantă după identificatorul tehnic Shop', () => {
    expect(getDisplayOrderObservatii(`${shopPrefix} | Sună înainte de livrare`, true)).toBe(
      'Sună înainte de livrare',
    )
  })

  it('nu modifică observațiile comenzilor manuale', () => {
    expect(getDisplayOrderObservatii('Sună înainte de livrare', false)).toBe(
      'Sună înainte de livrare',
    )
  })
})
