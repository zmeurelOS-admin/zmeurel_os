/** Rute publice magazin asociație (linkuri partajabile). */
export const ASSOCIATION_SHOP_BASE = '/magazin/asociatie' as const

export function associationShopProdusePath(query?: { categorie?: string; fermier?: string; produs?: string }) {
  if (!query || (!query.categorie && !query.fermier && !query.produs)) {
    return `${ASSOCIATION_SHOP_BASE}/produse`
  }
  const p = new URLSearchParams()
  if (query.categorie?.trim()) p.set('categorie', query.categorie.trim())
  if (query.fermier?.trim()) p.set('fermier', query.fermier.trim())
  if (query.produs?.trim()) p.set('produs', query.produs.trim())
  const qs = p.toString()
  return qs ? `${ASSOCIATION_SHOP_BASE}/produse?${qs}` : `${ASSOCIATION_SHOP_BASE}/produse`
}

export const ASSOCIATION_SHOP_PRODUCATORI_PATH = `${ASSOCIATION_SHOP_BASE}/producatori` as const

export function associationProducerProfilePath(tenantId: string) {
  return `${ASSOCIATION_SHOP_BASE}/producatori/${tenantId}`
}
