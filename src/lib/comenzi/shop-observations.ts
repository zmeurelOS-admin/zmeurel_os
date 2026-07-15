const SHOP_ORDER_PREFIX = /^Comandă shop\s+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\s*\|\s*)?/i

/** Elimină metadatele tehnice ale bridge-ului Shop, păstrând doar nota utilă fermierului. */
export function getDisplayOrderObservatii(
  observatii: string | null | undefined,
  isShopOrder: boolean,
): string {
  const raw = observatii?.trim() ?? ''
  if (!raw || !isShopOrder) return raw

  return raw.replace(SHOP_ORDER_PREFIX, '').trim()
}
