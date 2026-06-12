export const ZMEURA_PRODUCT_ID = 'zmeura'
export const ZMEURA_CASEROLA_PRICE_LEI = 20
export const ZMEURA_KG_PRICE_LEI = 40
export const ZMEURA_CASEROLE_PER_KG = 2

export function computeZmeuraTotalLei(qty: number): number {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new RangeError('Cantitatea de caserole trebuie să fie un număr întreg pozitiv sau zero.')
  }

  return qty * ZMEURA_CASEROLA_PRICE_LEI
}
