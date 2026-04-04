import { getSupabase } from '@/lib/supabase/client'
import { getTenantId } from '@/lib/tenant/get-tenant'

import type { Database } from '@/types/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any

export type AssociationOfferStatus = 'trimisa' | 'aprobata' | 'respinsa' | 'retrasa'

export type AssociationProductOfferRow = Pick<
  Database['public']['Tables']['association_product_offers']['Row'],
  | 'id'
  | 'product_id'
  | 'tenant_id'
  | 'status'
  | 'suggested_price'
  | 'message'
  | 'created_at'
  | 'review_note'
>

/** Toate ofertele tenantului curent (istoric inclus). */
export async function fetchTenantProductOffers(): Promise<AssociationProductOfferRow[]> {
  const supabase = getSupabase() as AnySupabase
  const tenantId = await getTenantId(supabase)
  const { data, error } = await supabase
    .from('association_product_offers')
    .select('id, product_id, tenant_id, status, suggested_price, message, created_at, review_note')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as AssociationProductOfferRow[]
}

/** Alias: toate ofertele tenantului curent (detalii minime). */
export async function getMyOffers(): Promise<AssociationProductOfferRow[]> {
  return fetchTenantProductOffers()
}

export type ProductOfferUiKind =
  | 'none'
  | 'trimisa'
  | 'aprobata'
  | 'respinsa'
  | 'retrasa'
  | 'blocked_inactiv'

export type ProductOfferUiState = {
  kind: ProductOfferUiKind
  offerId: string | null
  /** Pentru badge-uri / mesaje */
  lastOfferStatus: AssociationOfferStatus | null
}

function sortByCreatedDesc(a: AssociationProductOfferRow, b: AssociationProductOfferRow) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

/** Stare ofertă pentru un produs (sau none). */
export function getProductOfferStatus(
  productId: string,
  offers: AssociationProductOfferRow[],
  productStatus: 'activ' | 'inactiv',
): ProductOfferUiState {
  return deriveProductOfferUiState(productId, offers, productStatus)
}

/** Stare UI per produs din lista de oferte tenant. */
export function deriveProductOfferUiState(
  productId: string,
  offers: AssociationProductOfferRow[],
  productStatus: 'activ' | 'inactiv',
): ProductOfferUiState {
  const forProduct = offers.filter((o) => o.product_id === productId)

  const pending = forProduct.find((o) => o.status === 'trimisa')
  if (pending) {
    return { kind: 'trimisa', offerId: pending.id, lastOfferStatus: 'trimisa' }
  }

  if (productStatus !== 'activ') {
    return { kind: 'blocked_inactiv', offerId: null, lastOfferStatus: null }
  }

  if (forProduct.length === 0) {
    return { kind: 'none', offerId: null, lastOfferStatus: null }
  }

  const sorted = [...forProduct].sort(sortByCreatedDesc)
  const latest = sorted[0]!
  const st = latest.status as AssociationOfferStatus

  if (st === 'aprobata') {
    return { kind: 'aprobata', offerId: latest.id, lastOfferStatus: 'aprobata' }
  }
  if (st === 'respinsa') {
    return { kind: 'respinsa', offerId: latest.id, lastOfferStatus: 'respinsa' }
  }
  if (st === 'retrasa') {
    return { kind: 'retrasa', offerId: latest.id, lastOfferStatus: 'retrasa' }
  }

  return { kind: 'none', offerId: null, lastOfferStatus: null }
}

export function buildOfferStateMap(
  productIds: string[],
  offers: AssociationProductOfferRow[],
  productStatusById: Record<string, 'activ' | 'inactiv'>,
): Record<string, ProductOfferUiState> {
  const out: Record<string, ProductOfferUiState> = {}
  for (const id of productIds) {
    out[id] = deriveProductOfferUiState(id, offers, productStatusById[id] ?? 'inactiv')
  }
  return out
}

export type FarmerAssociationOfferSummary = {
  isApproved: boolean
  offersCount: number
  listedViaOfferCount: number
}

export async function getFarmerAssociationStatus(tenantId: string): Promise<FarmerAssociationOfferSummary> {
  const supabase = getSupabase() as AnySupabase
  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .select('is_association_approved')
    .eq('id', tenantId)
    .maybeSingle()

  if (tErr) throw tErr

  const { data: offers, error: oErr } = await supabase
    .from('association_product_offers')
    .select('id, status')
    .eq('tenant_id', tenantId)

  if (oErr) throw oErr

  const rows = (offers ?? []) as { id: string; status: string }[]
  const listedViaOfferCount = rows.filter((r) => r.status === 'aprobata').length

  return {
    isApproved: tenant?.is_association_approved === true,
    offersCount: rows.length,
    listedViaOfferCount,
  }
}
