/**
 * Shape aliniat la `public.produse` (Supabase) + câmp opțional `poze` (JSON / migrare viitoare).
 * Vezi și `src/lib/shop/load-public-shop.ts` — `PublicShopProduct`.
 */
export type GustCatalogProduct = {
  id: string
  nume: string
  descriere: string | null
  categorie: string
  farmName?: string
  unitate_vanzare: string
  gramaj_per_unitate: number | null
  approximate_weight?: string | null
  association_category?: string | null
  pret_unitar: number | null
  /** Magazin asociație: preț efectiv (override). */
  displayPrice?: number
  moneda: string
  producerLogoUrl?: string | null
  /** Array URL-uri când există în DB / payload. */
  poze?: string[] | null
  poza_1_url?: string | null
  poza_2_url?: string | null
  tenantId?: string
  createdAt?: string
  orderCount?: number
  ingrediente?: string | null
  alergeni?: string | null
  conditii_pastrare?: string | null
  termen_valabilitate?: string | null
  tip_produs?: string | null
}

export function collectProductImageUrls(p: GustCatalogProduct): string[] {
  const fromPoze = Array.isArray(p.poze)
    ? p.poze.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
    : []
  if (fromPoze.length > 0) return fromPoze

  const legacy = [p.poza_1_url, p.poza_2_url].filter(
    (u): u is string => typeof u === 'string' && u.trim().length > 0,
  )
  return legacy
}

export function formatGustPrice(p: GustCatalogProduct): string {
  const val = p.displayPrice ?? p.pret_unitar
  if (val == null) return '—'
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(val))
}

export function formatGustProductUnitLabel(p: GustCatalogProduct): string {
  const unit = p.unitate_vanzare?.trim() || 'unitate'
  const approx = p.approximate_weight?.trim()
  if (approx) return `${unit} (${approx})`
  return unit
}
