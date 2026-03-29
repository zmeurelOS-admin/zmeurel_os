import { getSupabase } from '@/lib/supabase/client'
import { getTenantId } from '@/lib/tenant/get-tenant'
import type { Tables } from '@/types/supabase'

export type SolarClimateLog = Tables<'solar_climate_logs'>
export type CultureStageLog = Tables<'culture_stage_logs'>

interface CreateSolarClimateLogInput {
  unitate_id: string
  temperatura: number
  umiditate: number
  observatii?: string
}

interface CreateCultureStageLogInput {
  unitate_id: string
  etapa: string
  data: string
  observatii?: string
}

export async function getSolarClimateLogs(unitateId: string, limit = 20): Promise<SolarClimateLog[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('solar_climate_logs')
    .select('id,tenant_id,unitate_id,temperatura,umiditate,observatii,created_at,data_origin,demo_seed_id')
    .eq('unitate_id', unitateId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function getSolarClimateLogsForUnitati(unitateIds: string[], limit = 120): Promise<SolarClimateLog[]> {
  if (unitateIds.length === 0) return []

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('solar_climate_logs')
    .select('id,tenant_id,unitate_id,temperatura,umiditate,observatii,created_at,data_origin,demo_seed_id')
    .in('unitate_id', unitateIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function createSolarClimateLog(input: CreateSolarClimateLogInput): Promise<SolarClimateLog> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('solar_climate_logs')
    .insert({
      tenant_id: tenantId,
      unitate_id: input.unitate_id,
      temperatura: input.temperatura,
      umiditate: input.umiditate,
      observatii: input.observatii?.trim() || null,
    })
    .select('id,tenant_id,unitate_id,temperatura,umiditate,observatii,created_at,data_origin,demo_seed_id')
    .single()

  if (error) throw error
  return data
}

export async function getCultureStageLogs(unitateId: string, limit = 30): Promise<CultureStageLog[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('culture_stage_logs')
    .select('id,tenant_id,unitate_id,cultura_id,etapa,data,observatii,created_at,data_origin,demo_seed_id')
    .eq('unitate_id', unitateId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function getCultureStageLogsForUnitati(unitateIds: string[], limit = 120): Promise<CultureStageLog[]> {
  if (unitateIds.length === 0) return []

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('culture_stage_logs')
    .select('id,tenant_id,unitate_id,cultura_id,etapa,data,observatii,created_at,data_origin,demo_seed_id')
    .in('unitate_id', unitateIds)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function createCultureStageLog(input: CreateCultureStageLogInput): Promise<CultureStageLog> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('culture_stage_logs')
    .insert({
      tenant_id: tenantId,
      unitate_id: input.unitate_id,
      etapa: input.etapa.trim(),
      data: input.data,
      observatii: input.observatii?.trim() || null,
    })
    .select('id,tenant_id,unitate_id,cultura_id,etapa,data,observatii,created_at,data_origin,demo_seed_id')
    .single()

  if (error) throw error
  return data
}
