import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

export type ShopCustomerLookup = {
  found: boolean
  name?: string | null
  delivery_address?: string | null
  delivery_city?: string | null
  delivery_mode?: string | null
}

export function normalizeShopCustomerPhone(value: string): string {
  const digits = value.replace(/\D+/g, '')
  if (digits.startsWith('0040') && digits.length >= 13) return digits.slice(4)
  if (digits.startsWith('40') && digits.length >= 11) return digits.slice(2)
  if (digits.startsWith('0') && digits.length >= 10) return digits.slice(1)
  return digits
}

export async function upsertShopCustomer(input: {
  tenantId: string
  phone: string
  name: string
  deliveryAddress?: string | null
  deliveryCity?: string | null
  deliveryMode?: string | null
}): Promise<void> {
  const phone = normalizeShopCustomerPhone(input.phone)
  if (!input.tenantId || phone.length < 9) return

  try {
    const admin = getSupabaseAdmin() as AnyAdmin
    const { error } = await admin.rpc('upsert_shop_customer', {
      p_tenant_id: input.tenantId,
      p_phone: phone,
      p_name: input.name,
      p_default_delivery_address: input.deliveryAddress ?? null,
      p_default_delivery_city: input.deliveryCity ?? null,
      p_default_delivery_mode: input.deliveryMode ?? null,
    })

    if (error) throw error
  } catch (error) {
    console.error(
      '[shop/b2c/customer] upsert failed',
      sanitizeForLog({
        tenantId: input.tenantId,
        error: toSafeErrorContext(error),
      }),
    )
  }
}

export async function lookupShopCustomer(input: {
  tenantId: string
  phone: string
}): Promise<ShopCustomerLookup> {
  const phone = normalizeShopCustomerPhone(input.phone)
  if (!input.tenantId || phone.length < 9) return { found: false }

  const admin = getSupabaseAdmin() as AnyAdmin
  const { data, error } = await admin
    .from('shop_customers')
    .select('name, default_delivery_address, default_delivery_city, default_delivery_mode')
    .eq('tenant_id', input.tenantId)
    .eq('phone', phone)
    .maybeSingle()

  if (error) throw error

  if (!data) return { found: false }

  return {
    found: true,
    name: data.name ?? null,
    delivery_address: data.default_delivery_address ?? null,
    delivery_city: data.default_delivery_city ?? null,
    delivery_mode: data.default_delivery_mode ?? null,
  }
}
