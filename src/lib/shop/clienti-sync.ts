import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { normalizePhoneNumber } from '@/lib/utils/normalize-phone'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

type ExistingClientRow = {
  id: string
  nume_client: string | null
  adresa: string | null
}

function buildShopClientId(): string {
  return `SHOP-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0
}

function isPlaceholderClientName(value: string | null | undefined): boolean {
  return (value ?? '').trimStart().startsWith('Client ')
}

export function buildClientAddressFromShopOrder(input: {
  deliveryAddress?: string | null
  deliveryCity?: string | null
}): string | null {
  const address = input.deliveryAddress?.trim() ?? ''
  const city = input.deliveryCity?.trim() ?? ''

  if (address && city) return `${address}, ${city}`
  if (address) return address
  if (city) return city
  return null
}

export async function upsertClientFromShopOrder(input: {
  tenantId: string
  phone: string
  name: string
  deliveryAddress?: string | null
  deliveryCity?: string | null
  explicitAddressOverride?: boolean
}): Promise<void> {
  const phone = normalizePhoneNumber(input.phone)
  const normalizedName = input.name.trim()
  const address = buildClientAddressFromShopOrder({
    deliveryAddress: input.deliveryAddress,
    deliveryCity: input.deliveryCity,
  })

  if (!input.tenantId || phone.replace(/\D/g, '').length < 9 || !normalizedName) return

  const admin = getSupabaseAdmin() as AnyAdmin
  const insertPayload = {
    tenant_id: input.tenantId,
    id_client: buildShopClientId(),
    nume_client: normalizedName,
    telefon: phone,
    adresa: address,
    data_origin: 'shop',
  }

  const { data: upsertData, error: upsertError } = await admin
    .from('clienti')
    .upsert(insertPayload, {
      onConflict: 'tenant_id,telefon',
      ignoreDuplicates: true,
    })
    .select('id')

  if (upsertError) throw upsertError
  if (Array.isArray(upsertData) && upsertData.length > 0) return

  const { data: existing, error: existingError } = await admin
    .from('clienti')
    .select('id, nume_client, adresa')
    .eq('tenant_id', input.tenantId)
    .eq('telefon', phone)
    .maybeSingle()

  if (existingError) throw existingError
  if (!existing) return

  const current = existing as ExistingClientRow
  const updates: Record<string, unknown> = {}

  if (isPlaceholderClientName(current.nume_client)) {
    updates.nume_client = normalizedName
  }

  if (input.explicitAddressOverride) {
    if (address !== current.adresa) {
      updates.adresa = address
    }
  } else if (isBlank(current.adresa) && address) {
    updates.adresa = address
  }

  if (Object.keys(updates).length === 0) return

  const { error: updateError } = await admin
    .from('clienti')
    .update(updates)
    .eq('id', current.id)
    .eq('tenant_id', input.tenantId)

  if (updateError) throw updateError
}
