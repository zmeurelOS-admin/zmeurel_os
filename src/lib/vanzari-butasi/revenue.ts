// Venituri din material săditor: o comandă intră la venituri când e livrată,
// cu totalul ei, la data livrării (data_livrare_estimata, pusă pe „azi” la marcarea ca livrată).

export interface ButasiRevenueSource {
  status: string | null
  total_lei: number | string | null
  data_livrare_estimata: string | null
  data_comanda: string | null
}

export function butasiRevenueDate(order: ButasiRevenueSource): string | null {
  if (order.status !== 'livrata') return null
  return (order.data_livrare_estimata ?? order.data_comanda ?? '').slice(0, 10) || null
}

/** Suma veniturilor din comenzile livrate între `startIso` și `endIso` (inclusiv, YYYY-MM-DD). */
export function butasiRevenueBetween(orders: ButasiRevenueSource[], startIso: string, endIso: string): number {
  return orders.reduce((sum, order) => {
    const date = butasiRevenueDate(order)
    if (!date || date < startIso || date > endIso) return sum
    const total = Number(order.total_lei || 0)
    return Number.isFinite(total) ? sum + total : sum
  }, 0)
}
