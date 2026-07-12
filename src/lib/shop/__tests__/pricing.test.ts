import { describe, expect, it } from 'vitest'

import {
  computeZmeuraTotalLei,
  DEFAULT_ZMEURA_PRICING,
  isBulkPricingActive,
  resolveZmeuraPricing,
  resolveZmeuraUnitPriceLei,
  toPricePerKgLei,
} from '@/lib/shop/pricing'

describe('computeZmeuraTotalLei — grilă pe cantitate (prag retroactiv la 11 kg)', () => {
  it.each([
    [1, 17.5],
    [2, 35],
    [5, 87.5],
    [20, 350], // 10 kg: sub prag (mutat de la 10 la 11 kg) — preț de bază
    [21, 367.5], // ultima cantitate sub prag (10,5 kg)
    [22, 330], // exact la prag (11 kg): TOT coșul la 15 lei — discontinuitate asumată
    [24, 360], // exemplul owner-ului: 12 kg × 30 lei/kg
    [40, 600],
  ])('calculează %i caserole la %s lei', (qty, expectedTotal) => {
    expect(computeZmeuraTotalLei(qty)).toBe(expectedTotal)
  })

  it('pragul e retroactiv: la 22 de caserole totalul scade sub cel de la 21', () => {
    expect(computeZmeuraTotalLei(22)).toBeLessThan(computeZmeuraTotalLei(21))
  })

  it('acceptă coșul gol și respinge cantitățile invalide', () => {
    expect(computeZmeuraTotalLei(0)).toBe(0)
    expect(() => computeZmeuraTotalLei(1.5)).toThrow(RangeError)
    expect(() => computeZmeuraTotalLei(-1)).toThrow(RangeError)
  })
})

describe('resolveZmeuraUnitPriceLei / isBulkPricingActive', () => {
  it('aplică prețul de bază sub prag și cel de volum de la prag inclusiv', () => {
    expect(resolveZmeuraUnitPriceLei(21)).toBe(17.5)
    expect(isBulkPricingActive(21, DEFAULT_ZMEURA_PRICING)).toBe(false)
    expect(resolveZmeuraUnitPriceLei(22)).toBe(15)
    expect(isBulkPricingActive(22, DEFAULT_ZMEURA_PRICING)).toBe(true)
  })

  it('fără grilă configurată (bulk NULL), prețul rămâne cel de bază la orice cantitate', () => {
    const flat = resolveZmeuraPricing({ price_lei: 17.5, bulk_threshold_kg: null, bulk_price_lei: null })
    expect(resolveZmeuraUnitPriceLei(100, flat)).toBe(17.5)
    expect(computeZmeuraTotalLei(100, flat)).toBe(1750)
  })
})

describe('resolveZmeuraPricing', () => {
  it('citește configul din rândul shop_products', () => {
    expect(
      resolveZmeuraPricing({ price_lei: 17.5, bulk_threshold_kg: 10, bulk_price_lei: 15 }),
    ).toEqual({ basePriceLei: 17.5, bulkThresholdKg: 10, bulkPriceLei: 15 })
  })

  it('cade pe DEFAULT_ZMEURA_PRICING când rândul lipsește', () => {
    expect(resolveZmeuraPricing(null)).toEqual(DEFAULT_ZMEURA_PRICING)
    expect(resolveZmeuraPricing(undefined)).toEqual(DEFAULT_ZMEURA_PRICING)
  })

  it('ignoră grila incompletă sau invalidă (prag fără preț, valori nepozitive)', () => {
    expect(
      resolveZmeuraPricing({ price_lei: 17.5, bulk_threshold_kg: 10, bulk_price_lei: null }),
    ).toEqual({ basePriceLei: 17.5, bulkThresholdKg: null, bulkPriceLei: null })
    expect(
      resolveZmeuraPricing({ price_lei: 17.5, bulk_threshold_kg: 0, bulk_price_lei: 15 }),
    ).toEqual({ basePriceLei: 17.5, bulkThresholdKg: null, bulkPriceLei: null })
  })
})

describe('toPricePerKgLei', () => {
  it('convertește prețul pe caserolă (500 g) în preț pe kg', () => {
    expect(toPricePerKgLei(17.5)).toBe(35)
    expect(toPricePerKgLei(15)).toBe(30)
  })
})
