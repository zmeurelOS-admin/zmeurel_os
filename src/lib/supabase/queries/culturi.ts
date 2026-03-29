import { getSupabase } from '@/lib/supabase/client'
import { getTenantId } from '@/lib/tenant/get-tenant'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase'

export type EtapaCultura = Tables<'etape_cultura'>

export async function getEtapeCulturaById(culturaId: string): Promise<EtapaCultura[]> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('etape_cultura')
    .select('id,tenant_id,cultura_id,etapa,observatii,data_etapa,created_at')
    .eq('cultura_id', culturaId)
    .order('data_etapa', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export interface CreateEtapaCulturaInput {
  cultura_id: string
  etapa: string
  observatii?: string
  data_etapa?: string
}

export async function createEtapaCultura(input: CreateEtapaCulturaInput): Promise<EtapaCultura> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('etape_cultura')
    .insert({
      tenant_id: tenantId,
      cultura_id: input.cultura_id,
      etapa: input.etapa.trim(),
      observatii: input.observatii?.trim() || null,
      data_etapa: input.data_etapa || new Date().toISOString().slice(0, 10),
    })
    .select('id,tenant_id,cultura_id,etapa,observatii,data_etapa,created_at')
    .single()

  if (error) throw error
  return data
}

export async function deleteEtapaCultura(id: string): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { error } = await supabase
    .from('etape_cultura')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) throw error
}

export type Cultura = Tables<'culturi'>
export type CulturaInsert = TablesInsert<'culturi'>
export type CulturaUpdate = TablesUpdate<'culturi'>

const CULTURA_COLUMNS =
  'id,tenant_id,solar_id,tip_planta,soi,suprafata_ocupata,nr_plante,nr_randuri,distanta_intre_randuri,sistem_irigare,data_plantarii,stadiu,activa,data_desfiintare,motiv_desfiintare,observatii,created_at,updated_at,data_origin,demo_seed_id'

export async function getCulturiForSolar(solarId: string): Promise<Cultura[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('culturi')
    .select(CULTURA_COLUMNS)
    .eq('solar_id', solarId)
    .eq('tenant_id', tenantId)
    .order('activa', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function getActiveCulturiCountsByParcela(
  parcelaIds: string[]
): Promise<Record<string, number>> {
  if (parcelaIds.length === 0) return {}

  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('culturi')
    .select('solar_id,activa')
    .eq('tenant_id', tenantId)
    .in('solar_id', parcelaIds)

  if (error) throw error

  const counts: Record<string, number> = {}
  for (const parcelaId of parcelaIds) {
    counts[parcelaId] = 0
  }

  for (const cultura of data ?? []) {
    const parcelaId = cultura.solar_id
    if (!parcelaId || cultura.activa === false) continue
    counts[parcelaId] = (counts[parcelaId] ?? 0) + 1
  }

  return counts
}

export async function getCulturaById(id: string): Promise<Cultura | null> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('culturi')
    .select(CULTURA_COLUMNS)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

export interface CreateCulturaInput {
  solar_id: string
  tip_planta: string
  soi?: string
  suprafata_ocupata?: number
  nr_plante?: number
  nr_randuri?: number
  distanta_intre_randuri?: number
  sistem_irigare?: string
  data_plantarii?: string
  stadiu?: string
  observatii?: string
}

export async function createCultura(input: CreateCulturaInput): Promise<Cultura> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const tipPlanta = input.tip_planta?.trim()

  if (!tipPlanta) {
    throw new Error('Tipul plantei este obligatoriu')
  }

  const { data, error } = await supabase
    .from('culturi')
    .insert({
      tenant_id: tenantId,
      solar_id: input.solar_id,
      tip_planta: tipPlanta,
      soi: input.soi?.trim() || null,
      suprafata_ocupata: input.suprafata_ocupata ?? null,
      nr_plante: input.nr_plante ?? null,
      nr_randuri: input.nr_randuri ?? null,
      distanta_intre_randuri: input.distanta_intre_randuri ?? null,
      sistem_irigare: input.sistem_irigare?.trim() || null,
      data_plantarii: input.data_plantarii || null,
      stadiu: input.stadiu || 'crestere',
      activa: true,
      observatii: input.observatii?.trim() || null,
    })
    .select(CULTURA_COLUMNS)
    .single()

  if (error) throw error
  return data
}

export interface UpdateCulturaInput {
  tip_planta?: string
  soi?: string | null
  suprafata_ocupata?: number | null
  nr_plante?: number | null
  nr_randuri?: number | null
  distanta_intre_randuri?: number | null
  sistem_irigare?: string | null
  data_plantarii?: string | null
  stadiu?: string
  observatii?: string | null
}

export async function updateCultura(id: string, input: UpdateCulturaInput): Promise<Cultura> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const payload: CulturaUpdate = {}
  if (input.tip_planta !== undefined) payload.tip_planta = input.tip_planta.trim()
  if (input.soi !== undefined) payload.soi = input.soi?.trim() || null
  if (input.suprafata_ocupata !== undefined) payload.suprafata_ocupata = input.suprafata_ocupata
  if (input.nr_plante !== undefined) payload.nr_plante = input.nr_plante
  if (input.nr_randuri !== undefined) payload.nr_randuri = input.nr_randuri
  if (input.distanta_intre_randuri !== undefined) payload.distanta_intre_randuri = input.distanta_intre_randuri
  if (input.sistem_irigare !== undefined) payload.sistem_irigare = input.sistem_irigare?.trim() || null
  if (input.data_plantarii !== undefined) payload.data_plantarii = input.data_plantarii || null
  if (input.stadiu !== undefined) payload.stadiu = input.stadiu
  if (input.observatii !== undefined) payload.observatii = input.observatii?.trim() || null

  const { data, error } = await supabase
    .from('culturi')
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(CULTURA_COLUMNS)
    .single()

  if (error) throw error
  return data
}

export interface DesfiinteazaCulturaInput {
  data_desfiintare: string
  motiv_desfiintare?: string
}

export async function desfiinteazaCultura(
  id: string,
  input: DesfiinteazaCulturaInput
): Promise<Cultura> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('culturi')
    .update({
      activa: false,
      data_desfiintare: input.data_desfiintare,
      motiv_desfiintare: input.motiv_desfiintare?.trim() || null,
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(CULTURA_COLUMNS)
    .single()

  if (error) throw error
  return data
}
