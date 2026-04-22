import { getSupabase } from '@/lib/supabase/client'
import { getTenantId } from '@/lib/tenant/get-tenant'
import type { Cohorta } from '@/lib/tratamente/configurare-sezon'
import { normalizeStadiu } from '@/lib/tratamente/stadii-canonic'
import { getCurrentSezon } from '@/lib/utils/sezon'
import type { Tables, TablesInsert } from '@/types/supabase'

export type ParcelaStadiuCanonic = Tables<'stadii_fenologice_parcela'>
export type ConfigurareParcelaSezon = Tables<'configurari_parcela_sezon'>

type StadiuInsert = TablesInsert<'stadii_fenologice_parcela'>

interface CreateParcelaStadiuCanonicInput {
  parcela_id: string
  an?: number
  stadiu: string
  cohort?: Cohorta | null
  data_observata: string
  observatii?: string
}

const STADIU_SELECT =
  'id,tenant_id,parcela_id,an,stadiu,cohort,data_observata,sursa,observatii,created_at,updated_at,created_by'

const CONFIGURARE_SELECT = 'id,tenant_id,parcela_id,an,sistem_conducere,tip_ciclu_soi,created_at,updated_at'

function normalizeCohort(value: string | null | undefined): Cohorta | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'floricane' || normalized === 'primocane') {
    return normalized
  }
  return null
}

export async function getStadiiCanoniceParcela(
  parcelaId: string,
  an = getCurrentSezon(),
  limit = 50
): Promise<ParcelaStadiuCanonic[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('stadii_fenologice_parcela')
    .select(STADIU_SELECT)
    .eq('tenant_id', tenantId)
    .eq('parcela_id', parcelaId)
    .eq('an', an)
    .order('data_observata', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function getConfigurareSezonParcela(
  parcelaId: string,
  an = getCurrentSezon()
): Promise<ConfigurareParcelaSezon | null> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('configurari_parcela_sezon')
    .select(CONFIGURARE_SELECT)
    .eq('tenant_id', tenantId)
    .eq('parcela_id', parcelaId)
    .eq('an', an)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

export async function createParcelaStadiuCanonic(
  input: CreateParcelaStadiuCanonicInput
): Promise<ParcelaStadiuCanonic> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const stadiuCanonic = normalizeStadiu(input.stadiu)
  if (!stadiuCanonic) {
    throw new Error('Selecteaza un stadiu valid.')
  }

  const payload: StadiuInsert = {
    tenant_id: tenantId,
    parcela_id: input.parcela_id,
    an: input.an ?? getCurrentSezon(),
    stadiu: stadiuCanonic,
    cohort: normalizeCohort(input.cohort),
    data_observata: input.data_observata,
    sursa: 'manual',
    observatii: input.observatii?.trim() || null,
  }

  const { data, error } = await supabase
    .from('stadii_fenologice_parcela')
    .upsert(payload, { onConflict: 'parcela_id,an,stadiu,sursa,cohort' })
    .select(STADIU_SELECT)
    .single()

  if (error) throw error
  return data
}
