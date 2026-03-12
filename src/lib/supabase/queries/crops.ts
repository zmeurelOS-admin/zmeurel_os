import { getSupabase } from '@/lib/supabase/client'
import { getTenantIdOrNull } from '@/lib/tenant/get-tenant'
import type { UnitateTip } from '@/lib/parcele/unitate'
import type { Tables } from '@/types/supabase'

export type Crop = Tables<'crops'>

async function getCurrentTenantId(): Promise<string | null> {
  const supabase = getSupabase()
  return getTenantIdOrNull(supabase)
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

function pickPreferredCrop(rows: Crop[], normalizedName: string): Crop | null {
  const exact = rows.filter((row) => normalizeName(row.name) === normalizedName)
  if (exact.length === 0) return null

  const tenantScoped = exact.find((row) => row.tenant_id !== null)
  return tenantScoped ?? exact[0]
}

export async function getCropsForUnitType(unitType: UnitateTip): Promise<Crop[]> {
  const supabase = getSupabase()
  const tenantId = await getCurrentTenantId()

  let query = supabase
    .from('crops')
    .select('id,name,unit_type,tenant_id,created_at')
    .eq('unit_type', unitType)

  if (tenantId) {
    query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
  } else {
    query = query.is('tenant_id', null)
  }

  const { data, error } = await query.order('name', { ascending: true })

  if (error) throw error

  const dedupedByName = new Map<string, Crop>()
  for (const row of data ?? []) {
    const key = normalizeName(row.name)
    const existing = dedupedByName.get(key)
    if (!existing) {
      dedupedByName.set(key, row)
      continue
    }
    if (existing.tenant_id === null && row.tenant_id !== null) {
      dedupedByName.set(key, row)
    }
  }

  return Array.from(dedupedByName.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'ro', { sensitivity: 'base' })
  )
}

export async function ensureCropForUnitType(name: string, unitType: UnitateTip): Promise<Crop> {
  const cropName = name.trim()
  if (!cropName) {
    throw new Error('Cultura este obligatorie.')
  }

  const supabase = getSupabase()
  const tenantId = await getCurrentTenantId()
  if (!tenantId) {
    throw new Error('Tenant indisponibil pentru utilizatorul curent.')
  }

  const normalizedName = normalizeName(cropName)
  const { data: existingRows, error: existingError } = await supabase
    .from('crops')
    .select('id,name,unit_type,tenant_id,created_at')
    .eq('unit_type', unitType)
    .ilike('name', cropName)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)

  if (existingError) throw existingError

  const existing = pickPreferredCrop(existingRows ?? [], normalizedName)
  if (existing) return existing

  const { data: inserted, error: insertError } = await supabase
    .from('crops')
    .insert({
      name: cropName,
      unit_type: unitType,
      tenant_id: tenantId,
    })
    .select('id,name,unit_type,tenant_id,created_at')
    .single()

  if (!insertError && inserted) return inserted

  const { data: refetched, error: refetchError } = await supabase
    .from('crops')
    .select('id,name,unit_type,tenant_id,created_at')
    .eq('unit_type', unitType)
    .ilike('name', cropName)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)

  if (refetchError) throw refetchError

  const recovered = pickPreferredCrop(refetched ?? [], normalizedName)
  if (recovered) return recovered

  throw insertError ?? new Error('Nu am putut salva cultura personalizata.')
}
