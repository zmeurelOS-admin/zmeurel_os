import { getSupabase } from '@/lib/supabase/client'
import { getTenantId } from '@/lib/tenant/get-tenant'
import type { Cohorta } from '@/lib/parcele/configurare-sezon'
import { normalizeStadiu } from '@/lib/parcele/stadii-canonic'
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

export function normalizeCohort(value: string | null | undefined): Cohorta | null {
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

export function mergeParcelaStadiuInList(
  list: ParcelaStadiuCanonic[],
  saved: ParcelaStadiuCanonic
): ParcelaStadiuCanonic[] {
  const savedCohort = normalizeCohort(saved.cohort)
  const index = list.findIndex(
    (row) =>
      row.parcela_id === saved.parcela_id &&
      row.an === saved.an &&
      row.stadiu === saved.stadiu &&
      row.sursa === saved.sursa &&
      normalizeCohort(row.cohort) === savedCohort
  )

  if (index >= 0) {
    const next = [...list]
    next[index] = saved
    return next
  }

  return [saved, ...list]
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

  const nowIso = new Date().toISOString()
  const payload: StadiuInsert = {
    tenant_id: tenantId,
    parcela_id: input.parcela_id,
    an: input.an ?? getCurrentSezon(),
    stadiu: stadiuCanonic,
    cohort: normalizeCohort(input.cohort),
    data_observata: input.data_observata,
    sursa: 'manual',
    observatii: input.observatii?.trim() || null,
    updated_at: nowIso,
  }

  const { data, error } = await supabase
    .from('stadii_fenologice_parcela')
    .upsert(payload, { onConflict: 'parcela_id,an,stadiu,sursa,cohort' })
    .select(STADIU_SELECT)
    .single()

  if (error) throw error
  return data
}

/** Stadiile din sezonul `an` pentru toate parcelele fermei (lista de parcele: stadiul curent pe card). */
export async function getStadiiCanoniceFerma(an = getCurrentSezon()): Promise<ParcelaStadiuCanonic[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('stadii_fenologice_parcela')
    .select(STADIU_SELECT)
    .eq('tenant_id', tenantId)
    .eq('an', an)
    .order('data_observata', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) throw error
  return data ?? []
}

/** Configurările de sezon (`sistem_conducere`: remontant sau nu) pentru toate parcelele fermei. */
export async function getConfigurariSezonFerma(an = getCurrentSezon()): Promise<ConfigurareParcelaSezon[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('configurari_parcela_sezon')
    .select(CONFIGURARE_SELECT)
    .eq('tenant_id', tenantId)
    .eq('an', an)

  if (error) throw error
  return data ?? []
}

/**
 * Stadiile din anul trecut și din anul `an`, pentru toate parcelele fermei (promptul 33): stadiul curent al unui lăstar
 * se citește peste ani (un „Păstrez” din noiembrie e stadiul și în martie). Lista de parcele, fișa și foaia Stadiul.
 * Capcanele („în coacere”) rămân pe `getStadiiCanoniceFerma(an)`, doar anul curent.
 */
export async function getStadiiCanoniceFermaDoiAni(an = getCurrentSezon()): Promise<ParcelaStadiuCanonic[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('stadii_fenologice_parcela')
    .select(STADIU_SELECT)
    .eq('tenant_id', tenantId)
    .in('an', [an - 1, an])
    .order('data_observata', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(4000)

  if (error) throw error
  return data ?? []
}

/** Coloana `parcele.mod_lastari` lipsește (migrarea 20261125110000 încă neaplicată). */
function lipsaColoanaModLastari(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42703' || error.code === 'PGRST204') return true
  return /mod_lastari/i.test(error.message ?? '') && /column|could not find/i.test(error.message ?? '')
}

/**
 * „Cum lucrezi lăstarii” pe parcele (id → valoarea salvată, `null` = nesetat). Întoarce `null` dacă migrarea nu e
 * aplicată: atunci rândul de pe fișă nu apare, iar modul se calculează mereu.
 */
export async function getModLastariFerma(): Promise<Map<string, string | null> | null> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data, error } = await (supabase
    .from('parcele')
    .select('id,mod_lastari' as 'id')
    .eq('tenant_id', tenantId) as unknown as PromiseLike<{ data: Array<{ id: string; mod_lastari?: string | null }> | null; error: { code?: string; message?: string } | null }>)
  if (error) {
    if (lipsaColoanaModLastari(error)) return null
    throw error
  }
  return new Map((data ?? []).map((row) => [row.id, row.mod_lastari ?? null]))
}

/** Salvează „Cum lucrezi lăstarii” pe parcelă (RLS: proprietarul sau operatorul cu „Scrie” pe Parcele). */
export async function setModLastari(parcelaId: string, mod: 'an1' | 'an1_an2' | 'an2'): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { error } = await supabase
    .from('parcele')
    .update({ mod_lastari: mod } as never)
    .eq('tenant_id', tenantId)
    .eq('id', parcelaId)
  if (error) throw error
}
