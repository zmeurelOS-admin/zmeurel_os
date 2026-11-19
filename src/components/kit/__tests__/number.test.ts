import { describe, expect, it } from 'vitest'

import {
  clampNumber,
  formatDecimal,
  parseDecimal,
  roundTo,
  sanitizeDecimalInput,
  stepValue,
} from '@/components/kit/lib/number'

describe('numere cu virgulă', () => {
  it('parseDecimal acceptă virgulă și punct', () => {
    expect(parseDecimal('27,35')).toBe(27.35)
    expect(parseDecimal('27.35')).toBe(27.35)
    expect(parseDecimal('12,')).toBe(12)
    expect(parseDecimal(' 5 ')).toBe(5)
  })

  it('parseDecimal întoarce null pentru gol sau text nevalid', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal(',')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('1,2,3')).toBeNull()
  })

  it('formatDecimal scrie cu virgulă, fără zerouri de umplutură', () => {
    expect(formatDecimal(27.35)).toBe('27,35')
    expect(formatDecimal(5)).toBe('5')
    expect(formatDecimal(2.5, 0)).toBe('3')
    expect(formatDecimal(null)).toBe('')
  })

  it('roundTo nu lasă erori de virgulă mobilă', () => {
    expect(roundTo(0.1 + 0.2, 2)).toBe(0.3)
    expect(roundTo(1.005, 2)).toBe(1.01)
  })

  it('sanitizeDecimalInput păstrează cifrele, o virgulă și numărul permis de zecimale', () => {
    expect(sanitizeDecimalInput('12a,3b45', 2)).toBe('12,34')
    expect(sanitizeDecimalInput('1.5.7', 2)).toBe('1,57')
    expect(sanitizeDecimalInput(',5', 2)).toBe('0,5')
    expect(sanitizeDecimalInput('12,5', 0)).toBe('125')
  })
})

describe('pași și limite', () => {
  it('clampNumber ține valoarea între limite', () => {
    expect(clampNumber(5, 1, 10)).toBe(5)
    expect(clampNumber(-2, 1, 10)).toBe(1)
    expect(clampNumber(50, 1, 10)).toBe(10)
    expect(clampNumber(50)).toBe(50)
  })

  it('stepValue adună pasul și respectă limitele', () => {
    expect(stepValue(5, 1)).toBe(6)
    expect(stepValue(5, -10, { min: 1 })).toBe(1)
    expect(stepValue(95, 10, { max: 100 })).toBe(100)
  })

  it('stepValue pornește de la 0 când câmpul e gol', () => {
    expect(stepValue(null, 5)).toBe(5)
    expect(stepValue(null, -1, { min: 1 })).toBe(1)
  })

  it('stepValue merge cu zecimale (ex. kg, preț)', () => {
    expect(stepValue(2.5, 0.5, { decimals: 1 })).toBe(3)
    expect(stepValue(0.1, 0.2, { decimals: 2 })).toBe(0.3)
    expect(stepValue(30, -0.5, { decimals: 2, min: 0 })).toBe(29.5)
  })
})
