export const ZMEURA_PRODUCT_ID = 'zmeura'
export const ZMEURA_CASEROLA_PRICE_LEI = 18
export const ZMEURA_KG_PRICE_LEI = 35
export const ZMEURA_CASEROLE_PER_KG = 2

export function computeZmeuraTotalLei(qty: number): number {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new RangeError('Cantitatea de caserole trebuie să fie un număr întreg pozitiv sau zero.')
  }

  const wholeKg = Math.floor(qty / ZMEURA_CASEROLE_PER_KG)
  const remainingCaserole = qty % ZMEURA_CASEROLE_PER_KG

  return wholeKg * ZMEURA_KG_PRICE_LEI + remainingCaserole * ZMEURA_CASEROLA_PRICE_LEI
}

export function computeZmeuraSavingsLei(qty: number): number {
  return qty * ZMEURA_CASEROLA_PRICE_LEI - computeZmeuraTotalLei(qty)
}
