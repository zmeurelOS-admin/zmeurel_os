import { getSupabase } from '@/lib/supabase/client'
import { getTenantIdOrNull } from '@/lib/tenant/get-tenant'
import type { Tables } from '@/types/supabase'

export type CropVariety = Tables<'crop_varieties'>

async function getCurrentTenantId(): Promise<string | null> {
  const supabase = getSupabase()
  return getTenantIdOrNull(supabase)
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

function pickPreferredVariety(rows: CropVariety[], normalizedName: string): CropVariety | null {
  const exact = rows.filter((row) => normalizeName(row.name) === normalizedName)
  if (exact.length === 0) return null

  const tenantScoped = exact.find((row) => row.tenant_id !== null)
  return tenantScoped ?? exact[0]
}

export async function getCropVarietiesForCrop(cropId: string): Promise<CropVariety[]> {
  if (!cropId) return []

  const supabase = getSupabase()
  const tenantId = await getCurrentTenantId()

  let query = supabase
    .from('crop_varieties')
    .select('id,crop_id,name,tenant_id,created_at')
    .eq('crop_id', cropId)

  if (tenantId) {
    query = query.or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
  } else {
    query = query.is('tenant_id', null)
  }

  const { data, error } = await query.order('name', { ascending: true })
  if (error) throw error

  const dedupedByName = new Map<string, CropVariety>()
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

export async function ensureCropVarietyForCrop(cropId: string, name: string): Promise<CropVariety> {
  const varietyName = name.trim()
  if (!cropId) {
    throw new Error('Cultura selectata este obligatorie pentru soi.')
  }
  if (!varietyName) {
    throw new Error('Soiul este obligatoriu.')
  }

  const supabase = getSupabase()
  const tenantId = await getCurrentTenantId()
  if (!tenantId) {
    throw new Error('Tenant indisponibil pentru utilizatorul curent.')
  }

  const normalizedName = normalizeName(varietyName)
  const { data: existingRows, error: existingError } = await supabase
    .from('crop_varieties')
    .select('id,crop_id,name,tenant_id,created_at')
    .eq('crop_id', cropId)
    .ilike('name', varietyName)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)

  if (existingError) throw existingError

  const existing = pickPreferredVariety(existingRows ?? [], normalizedName)
  if (existing) return existing

  const { data: inserted, error: insertError } = await supabase
    .from('crop_varieties')
    .insert({
      crop_id: cropId,
      name: varietyName,
      tenant_id: tenantId,
    })
    .select('id,crop_id,name,tenant_id,created_at')
    .single()

  if (!insertError && inserted) return inserted

  const { data: refetched, error: refetchError } = await supabase
    .from('crop_varieties')
    .select('id,crop_id,name,tenant_id,created_at')
    .eq('crop_id', cropId)
    .ilike('name', varietyName)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)

  if (refetchError) throw refetchError

  const recovered = pickPreferredVariety(refetched ?? [], normalizedName)
  if (recovered) return recovered

  throw insertError ?? new Error('Nu am putut salva soiul personalizat.')
}
