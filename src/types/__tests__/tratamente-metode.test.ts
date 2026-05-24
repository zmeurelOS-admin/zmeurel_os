import { describe, expect, it } from 'vitest'

import { normalizeMetodaAplicare } from '@/types/tratamente-metode'

describe('normalizeMetodaAplicare', () => {
  it('accepts canonical union values', () => {
    expect(normalizeMetodaAplicare('foliar')).toBe('foliar')
    expect(normalizeMetodaAplicare('capcana_verificat')).toBe('capcana_verificat')
  })

  it('returns null for empty or unknown strings', () => {
    expect(normalizeMetodaAplicare(null)).toBeNull()
    expect(normalizeMetodaAplicare(undefined)).toBeNull()
    expect(normalizeMetodaAplicare('')).toBeNull()
    expect(normalizeMetodaAplicare('stropit_legacy')).toBeNull()
  })
})
