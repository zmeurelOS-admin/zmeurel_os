import { getSupabase } from "@/lib/supabase/client"
import { getTenantId } from "@/lib/tenant/get-tenant"
import type { Tables, TablesInsert, TablesUpdate } from "@/types/supabase"

export type Parcela = Tables<"parcele">
export type ParcelaInsert = TablesInsert<"parcele">
export type ParcelaUpdate = TablesUpdate<"parcele">
export interface ParcelaDeleteImpact {
  recoltariCount: number
  activitatiCount: number
}

export async function getParcelaDeleteImpact(id: string): Promise<ParcelaDeleteImpact> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { count: recoltariCount, error: recoltariError } = await supabase
    .from("recoltari")
    .select("*", { count: "exact", head: true })
    .eq("parcela_id", id)
    .eq("tenant_id", tenantId)

  if (recoltariError) throw recoltariError

  const { count: activitatiCount, error: activitatiError } = await supabase
    .from("activitati_agricole")
    .select("*", { count: "exact", head: true })
    .eq("parcela_id", id)
    .eq("tenant_id", tenantId)

  if (activitatiError) throw activitatiError

  return {
    recoltariCount: recoltariCount ?? 0,
    activitatiCount: activitatiCount ?? 0,
  }
}

// =====================
// GET
// =====================

export async function getParcele(): Promise<Parcela[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from("parcele")
    .select("id,id_parcela,nume_parcela,tip_fruct,soi_plantat,suprafata_m2,nr_plante,an_plantare,status,gps_lat,gps_lng,observatii,tip_unitate,cultura,soi,nr_randuri,distanta_intre_randuri,sistem_irigare,data_plantarii,created_at,created_by,updated_at,updated_by,tenant_id,data_origin,demo_seed_id,stadiu")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })

  if (error) throw error

  return data ?? []
}

export async function getParcelaById(id: string): Promise<Parcela | null> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('parcele')
    .select('id,id_parcela,nume_parcela,tip_fruct,soi_plantat,suprafata_m2,nr_plante,an_plantare,status,gps_lat,gps_lng,observatii,tip_unitate,cultura,soi,nr_randuri,distanta_intre_randuri,sistem_irigare,data_plantarii,created_at,created_by,updated_at,updated_by,tenant_id,data_origin,demo_seed_id,stadiu')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error

  return data ?? null
}

// =====================
// CREATE
// =====================

export async function createParcela(
  input: ParcelaInsert
): Promise<Parcela> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from("parcele")
    .insert({
      ...input,
      tenant_id: tenantId,
    })
    .select("id,id_parcela,nume_parcela,tip_fruct,soi_plantat,suprafata_m2,nr_plante,an_plantare,status,gps_lat,gps_lng,observatii,tip_unitate,cultura,soi,nr_randuri,distanta_intre_randuri,sistem_irigare,data_plantarii,created_at,created_by,updated_at,updated_by,tenant_id,data_origin,demo_seed_id,stadiu")
    .single()

  if (error) throw error

  return data
}

// =====================
// UPDATE
// =====================

export async function updateParcela(
  id: string,
  input: ParcelaUpdate
): Promise<Parcela> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from("parcele")
    .update(input)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select("id,id_parcela,nume_parcela,tip_fruct,soi_plantat,suprafata_m2,nr_plante,an_plantare,status,gps_lat,gps_lng,observatii,tip_unitate,cultura,soi,nr_randuri,distanta_intre_randuri,sistem_irigare,data_plantarii,created_at,created_by,updated_at,updated_by,tenant_id,data_origin,demo_seed_id,stadiu")
    .single()

  if (error) throw error

  return data
}

// =====================
// DELETE
// =====================

export async function deleteParcela(id: string): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { recoltariCount, activitatiCount } = await getParcelaDeleteImpact(id)

  // If any related records exist, throw a descriptive error
  if ((recoltariCount ?? 0) > 0 || (activitatiCount ?? 0) > 0) {
    const parts: string[] = []
    if ((recoltariCount ?? 0) > 0) parts.push(`${recoltariCount} recoltări`)
    if ((activitatiCount ?? 0) > 0) parts.push(`${activitatiCount} activități`)
    
    throw new Error(`Nu poți șterge parcela. Are ${parts.join(" și ")} asociate.`)
  }

  // Only proceed with delete if all counts are 0
  const { error } = await supabase
    .from("parcele")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId)

  if (error) throw error
}
