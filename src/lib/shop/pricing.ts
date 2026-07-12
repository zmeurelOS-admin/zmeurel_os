// Grilă de preț pe cantitate pentru shop-ul public (comanda.zmeurel.ro).
//
// Regula de business (2026-07-12): prețul per caserolă depinde de cantitatea
// TOTALĂ de zmeură din coș, cu prag RETROACTIV (nu marginal):
//   * sub prag (10 kg):   35 lei/kg -> 17,50 lei/caserolă 500 g
//   * la/peste prag (>=): 30 lei/kg -> 15,00 lei/caserolă, pe TOT coșul
// Discontinuitatea la prag (20 caserole = 300 lei < 19 caserole = 332,50 lei)
// este intenționată și asumată de owner.
//
// Sursa de adevăr pentru valori este rândul global `shop_products` ('zmeura'):
// `price_lei` (preț de bază / caserolă), `bulk_threshold_kg`, `bulk_price_lei`
// (preț / caserolă la prag) — modificabile fără deploy. Valorile de mai jos
// sunt DOAR fallback dacă rândul nu poate fi citit; ține-le sincronizate.
// Aceeași regulă este validată independent server-side: în /api/shop/b2c/order
// (recalcul din config, ignoră prețurile trimise de client) și în SQL, în
// place_preorder_atomic (citește shop_products).

export const ZMEURA_PRODUCT_ID = 'zmeura'
export const ZMEURA_CASEROLE_PER_KG = 2
export const ZMEURA_CASEROLA_WEIGHT_KG = 0.5

export type ZmeuraPricingConfig = {
  /** Preț per caserolă (500 g) sub pragul de volum. */
  basePriceLei: number
  /** Prag în kg totale de coș de la care se aplică prețul de volum pe tot coșul. Null = fără grilă. */
  bulkThresholdKg: number | null
  /** Preț per caserolă la/peste prag. Null = fără grilă. */
  bulkPriceLei: number | null
}

/** Fallback pentru cazul în care rândul `shop_products` nu poate fi citit. */
export const DEFAULT_ZMEURA_PRICING: ZmeuraPricingConfig = {
  basePriceLei: 17.5,
  bulkThresholdKg: 10,
  bulkPriceLei: 15,
}

export type ZmeuraPricingRow = {
  price_lei?: number | null
  bulk_threshold_kg?: number | null
  bulk_price_lei?: number | null
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function isPositive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/** Construiește configul de preț din rândul `shop_products`, cu fallback pe valori implicite. */
export function resolveZmeuraPricing(row?: ZmeuraPricingRow | null): ZmeuraPricingConfig {
  if (!row) return DEFAULT_ZMEURA_PRICING

  const hasBulk = isPositive(row.bulk_threshold_kg) && isPositive(row.bulk_price_lei)

  return {
    basePriceLei: isPositive(row.price_lei) ? row.price_lei : DEFAULT_ZMEURA_PRICING.basePriceLei,
    bulkThresholdKg: hasBulk ? row.bulk_threshold_kg! : null,
    bulkPriceLei: hasBulk ? row.bulk_price_lei! : null,
  }
}

function assertValidQty(qty: number): void {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new RangeError('Cantitatea de caserole trebuie să fie un număr întreg pozitiv sau zero.')
  }
}

/** Pragul se aplică de la `bulkThresholdKg` INCLUSIV (>=), pe cantitatea totală din coș. */
export function isBulkPricingActive(qty: number, pricing: ZmeuraPricingConfig): boolean {
  if (!isPositive(pricing.bulkThresholdKg) || !isPositive(pricing.bulkPriceLei)) return false
  return qty * ZMEURA_CASEROLA_WEIGHT_KG >= pricing.bulkThresholdKg
}

/** Prețul per caserolă aplicat ÎNTREGULUI coș, în funcție de cantitatea totală (prag retroactiv). */
export function resolveZmeuraUnitPriceLei(
  qty: number,
  pricing: ZmeuraPricingConfig = DEFAULT_ZMEURA_PRICING,
): number {
  assertValidQty(qty)
  return isBulkPricingActive(qty, pricing) ? pricing.bulkPriceLei! : pricing.basePriceLei
}

export function computeZmeuraTotalLei(
  qty: number,
  pricing: ZmeuraPricingConfig = DEFAULT_ZMEURA_PRICING,
): number {
  assertValidQty(qty)
  return round2(qty * resolveZmeuraUnitPriceLei(qty, pricing))
}

/** Preț pe kg pentru afișare (caserola are 500 g). */
export function toPricePerKgLei(pricePerCaserolaLei: number): number {
  return round2(pricePerCaserolaLei * ZMEURA_CASEROLE_PER_KG)
}
