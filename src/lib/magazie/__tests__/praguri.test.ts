import { describe, expect, it } from 'vitest'

import { PRAG_SIGUR, cereConfirmare } from '@/lib/magazie/praguri'

describe('„Sigur?” la „Am cumpărat” (promptul 34, §9)', () => {
  it('pragurile: kg > 2.000, l > 500, buc > 500', () => {
    expect(PRAG_SIGUR).toEqual({ kg: 2000, l: 500, buc: 500 })
    expect(cereConfirmare(2000, 'kg')).toBe(false)
    expect(cereConfirmare(2000.5, 'kg')).toBe(true)
    expect(cereConfirmare(846488, 'kg')).toBe(true)
    expect(cereConfirmare(500, 'l')).toBe(false)
    expect(cereConfirmare(501, 'l')).toBe(true)
    expect(cereConfirmare(501, 'buc')).toBe(true)
    expect(cereConfirmare(null, 'kg')).toBe(false)
  })
})
