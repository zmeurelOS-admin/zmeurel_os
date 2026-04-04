import type { AssociationProduct } from '@/lib/shop/load-association-catalog'

/** Linie coș pentru UI Gustă — mapată la `POST /api/shop/order` (doar id + qty pe linie). */
export type GustCartItem = {
  id: string
  name: string
  price: number | null
  unit: string
  category: string
  qty: number
  tenantId: string
  farmName: string
  moneda: string
}

export function gustCartItemFromAssociation(p: AssociationProduct, qty: number): GustCartItem {
  return {
    id: p.id,
    name: p.nume,
    price: p.displayPrice,
    unit: p.unitate_vanzare,
    category: p.categorie,
    qty,
    tenantId: p.tenantId,
    farmName: p.farmName,
    moneda: p.moneda || 'RON',
  }
}

export function gustCartItemsFromAssociationLines(
  lines: { product: AssociationProduct; qty: number }[],
): GustCartItem[] {
  return lines.map((l) => gustCartItemFromAssociation(l.product, l.qty))
}

export function qtyStepForUnit(unit: string): number {
  return unit.trim().toLowerCase() === 'buc' ? 1 : 0.5
}

export type GustCheckoutSuccess = {
  orderIds: string[]
  /** Subtotal doar produse (toate fermele). */
  totalLei: number
  currency: string
  farmCount: number
  /** Taxă livrare coș (o singură dată). */
  deliveryFeeLei: number
  /** Produse + livrare. */
  grandTotalLei: number
  /** Ex.: „miercuri, 9 aprilie 2026” */
  deliveryDateLabel: string
  placedAtIso: string
  placedAtLabel: string
  clientName: string
  clientTelefon: string
  clientLocatie: string
  whatsappConsent: boolean
  summaryLines: Array<{
    productName: string
    farmName: string
    qty: number
    unit: string
    unitPrice: number
    lineTotal: number
    currency: string
  }>
}
