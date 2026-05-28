import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { ShopOrderRow } from '@/lib/shop/b2c-order-helpers'

export const LIVRATOR_TOKEN_COOKIE = 'livrator_token'
export const LIVRATOR_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export type LivratorMember = {
  id: string
  tenant_id: string
  name: string
  phone: string | null
  invite_token: string
}

type FarmMemberRow = {
  id: string
  tenant_id: string
  name: string
  phone: string | null
  invite_token: string | null
}

function normalizeToken(token: string | null | undefined): string | null {
  const trimmed = token?.trim()
  return trimmed ? trimmed : null
}

export async function getActiveLivratorByToken(
  tokenInput: string | null | undefined,
): Promise<LivratorMember | null> {
  const token = normalizeToken(tokenInput)
  if (!token) return null

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('farm_members' as any)
    .select('id, tenant_id, name, phone, invite_token')
    .eq('invite_token', token)
    .eq('is_active', true)
    .eq('role', 'livrator')
    .maybeSingle()

  if (error || !data) return null

  const row = data as unknown as FarmMemberRow
  if (!row.invite_token) return null

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    phone: row.phone,
    invite_token: row.invite_token,
  }
}

export async function listLivratorOrdersInLivrare(): Promise<ShopOrderRow[]> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('shop_orders')
    .select('*')
    .eq('status', 'in_livrare')
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as ShopOrderRow[]
}

export async function markShopOrderLivrata(orderId: string): Promise<void> {
  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('shop_orders')
    .update({ status: 'livrata' })
    .eq('id', orderId)

  if (error) {
    throw error
  }
}
