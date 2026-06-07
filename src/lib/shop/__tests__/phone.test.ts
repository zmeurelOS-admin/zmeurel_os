import { describe, expect, it } from 'vitest'

import {
  isValidRomanianPhone,
  normalizePhone,
  normalizeRomanianMobilePhone,
} from '@/lib/shop/phone'

describe('isValidRomanianPhone', () => {
  it.each(['0722 123 456', '+40 722 123 456', '40722123456'])('acceptă %s', (input) => {
    expect(isValidRomanianPhone(input)).toBe(true)
  })

  it.each(['', '722123456', '0622123456', '+44722123456', '072212345'])(
    'respinge %s',
    (input) => {
      expect(isValidRomanianPhone(input)).toBe(false)
    },
  )
})

describe('normalizePhone', () => {
  it.each([
    ['0722 123 456', '0722123456'],
    ['+40 722 123 456', '0722123456'],
    ['722123456', '0722123456'],
  ])('normalizează %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })
})

describe('normalizeRomanianMobilePhone', () => {
  it.each([
    ['0722 123 456', '0722123456'],
    ['+40 722 123 456', '0722123456'],
    ['40722123456', '0722123456'],
  ])('normalizează %s', (input, expected) => {
    expect(normalizeRomanianMobilePhone(input)).toBe(expected)
  })

  it.each(['', '722123456', '0622123456', '+44722123456', '072212345'])(
    'respinge %s',
    (input) => {
      expect(normalizeRomanianMobilePhone(input)).toBeNull()
    },
  )
})
