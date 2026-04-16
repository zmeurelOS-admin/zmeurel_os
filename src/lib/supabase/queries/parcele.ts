import { getSupabase } from "@/lib/supabase/client"
import { getTenantId } from "@/lib/tenant/get-tenant"
import type { Tables, TablesInsert, TablesUpdate } from "@/types/supabase"

/** Coloane încărcate în listă / după insert / update (aliniat la dashboard și module). */
const PARCELA_LIST_SELECT =
  "id,id_parcela,nume_parcela,tip_fruct,soi_plantat,suprafata_m2,nr_plante,an_plantare,status,gps_lat,gps_lng,latitudine,longitudine,observatii,tip_unitate,cultura,soi,nr_randuri,distanta_intre_randuri,sistem_irigare,data_plantarii,created_at,created_by,updated_at,updated_by,tenant_id,data_origin,demo_seed_id,stadiu,rol,apare_in_dashboard,contribuie_la_productie,status_operational"
const PARCELA_LEGACY_SELECT =
  "id,id_parcela,nume_parcela,tip_fruct,soi_plantat,suprafata_m2,nr_plante,an_plantare,status,gps_lat,gps_lng,latitudine,longitudine,observatii,tip_unitate,cultura,soi,nr_randuri,distanta_intre_randuri,sistem_irigare,data_plantarii,created_at,created_by,updated_at,updated_by,tenant_id,data_origin,demo_seed_id,stadiu"

type SupabaseLikeError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

const isSchemaSelectMismatch = (error: unknown) => {
  const e = (error ?? {}) as SupabaseLikeError
  const message = (e.message ?? "").toLowerCase()
  return (
    e.code === "PGRST204" ||
    e.code === "42703" ||
    message.includes("schema cache") ||
    message.includes("could not find the") ||
    message.includes("status_operational") ||
    message.includes("apare_in_dashboard") ||
    message.includes("contribuie_la_productie") ||
    message.includes("rol")
  )
}

function withParcelaDashboardDefaults(row: Record<string, unknown>): Parcela {
  return {
    ...(row as Parcela),
    rol: (row.rol as string | null) ?? "comercial",
    apare_in_dashboard: (row.apare_in_dashboard as boolean | null) ?? true,
    contribuie_la_productie: (row.contribuie_la_productie as boolean | null) ?? true,
    status_operational: (row.status_operational as string | null) ?? "activ",
  }
}

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
    .select(PARCELA_LIST_SELECT)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })

  if (!error) return (data ?? []) as Parcela[]

  if (!isSchemaSelectMismatch(error)) throw error

  // Compat mode for linked environments where dashboard relevance columns are not yet applied.
  const { data: legacyData, error: legacyError } = await supabase
    .from("parcele")
    .select(PARCELA_LEGACY_SELECT)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })

  if (legacyError) throw legacyError

  return ((legacyData ?? []) as Record<string, unknown>[]).map(withParcelaDashboardDefaults)
}

export async function getParcelaById(id: string): Promise<Parcela | null> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('parcele')
    .select(PARCELA_LIST_SELECT)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!error) return data ?? null

  if (!isSchemaSelectMismatch(error)) throw error

  const { data: legacyData, error: legacyError } = await supabase
    .from("parcele")
    .select(PARCELA_LEGACY_SELECT)
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle()

  if (legacyError) throw legacyError

  return legacyData ? withParcelaDashboardDefaults(legacyData as Record<string, unknown>) : null
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
    .select(PARCELA_LIST_SELECT)
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
    .select(PARCELA_LIST_SELECT)
    .single()

  if (error) {
    throw error
  }

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
