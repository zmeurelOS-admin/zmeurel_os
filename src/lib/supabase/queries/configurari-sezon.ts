import { createClient } from '@/lib/supabase/server'
import { normalizeCropCod } from '@/lib/crops/crop-codes'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'
import { normalizeForSearch } from '@/lib/utils/string'
import type { Parcela } from '@/lib/supabase/queries/parcele'
import { getGrupBiologicForCropCod, type GrupBiologic } from '@/lib/tratamente/stadii-canonic'
import type {
  ConfigurareSezon,
  SistemConducere,
  TipCicluSoi,
  UpsertConfigurareSezon,
} from '@/lib/tratamente/configurare-sezon'

type ServerSupabase = Awaited<ReturnType<typeof createClient>>
type ParcelaConfigurareSezon = Pick<Parcela, 'id' | 'tenant_id' | 'cultura' | 'tip_fruct' | 'soi_plantat' | 'soi'>

interface QueryContext {
  supabase: ServerSupabase
  tenantId: string
  userId: string
}

type SupabaseLikeError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

const SEASON_SELECT =
  'id,tenant_id,parcela_id,an,sistem_conducere,tip_ciclu_soi,created_at,updated_at'

function asError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) return error
  const maybeError = (error ?? {}) as SupabaseLikeError
  return new Error(maybeError.message || maybeError.details || fallbackMessage)
}

function normalizeSoiCandidate(value: string | null | undefined): string | null {
  const normalized = normalizeForSearch(value)
  return normalized.length > 0 ? normalized : null
}

function detectSistemConducere(parcela: ParcelaConfigurareSezon): SistemConducere | null {
  const soiValues = [parcela.soi_plantat, parcela.soi]
    .map((value) => normalizeSoiCandidate(value))
    .filter((value): value is string => Boolean(value))

  if (soiValues.some((value) => value.includes('maravilla'))) {
    return 'mixt_floricane_primocane'
  }

  if (soiValues.some((value) => value.includes('delniwa'))) {
    return 'primocane_only'
  }

  return null
}

function resolveGrupBiologic(parcela: ParcelaConfigurareSezon): GrupBiologic | null {
  const cropCod = normalizeCropCod(parcela.cultura) ?? normalizeCropCod(parcela.tip_fruct)
  return getGrupBiologicForCropCod(cropCod)
}

function buildInsertPayload(
  parcela: ParcelaConfigurareSezon,
  an: number,
  tenantId: string
): UpsertConfigurareSezon & { tenant_id: string } {
  const grupBiologic = resolveGrupBiologic(parcela)
  const sistemConducere = grupBiologic === 'rubus' ? detectSistemConducere(parcela) : null

  return {
    tenant_id: tenantId,
    parcela_id: parcela.id,
    an,
    sistem_conducere: sistemConducere,
    tip_ciclu_soi: null,
  }
}

async function getQueryContext(): Promise<QueryContext> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.id) {
    throw new Error('Neautorizat')
  }

  const tenantId = await getTenantIdByUserId(supabase, user.id)
  return { supabase, tenantId, userId: user.id }
}

function toConfigurareSezon(row: Record<string, unknown>): ConfigurareSezon {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    parcela_id: String(row.parcela_id),
    an: Number(row.an),
    sistem_conducere: (row.sistem_conducere as SistemConducere | null) ?? null,
    tip_ciclu_soi: (row.tip_ciclu_soi as TipCicluSoi | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function getConfigurareSezon(
  parcelaId: string,
  an: number
): Promise<ConfigurareSezon | null> {
  const { supabase, tenantId } = await getQueryContext()

  const { data, error } = await supabase
    .from('configurari_parcela_sezon')
    .select(SEASON_SELECT)
    .eq('tenant_id', tenantId)
    .eq('parcela_id', parcelaId)
    .eq('an', an)
    .maybeSingle()

  if (error) throw error
  return data ? toConfigurareSezon(data as Record<string, unknown>) : null
}

export async function getParcelaPentruConfigurareSezon(parcelaId: string): Promise<ParcelaConfigurareSezon | null> {
  const { supabase, tenantId } = await getQueryContext()

  const { data, error } = await supabase
    .from('parcele')
    .select('id,tenant_id,cultura,tip_fruct,soi_plantat,soi')
    .eq('id', parcelaId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

export async function upsertConfigurareSezon(
  data: UpsertConfigurareSezon
): Promise<ConfigurareSezon> {
  const { supabase, tenantId } = await getQueryContext()

  const payload = {
    tenant_id: tenantId,
    parcela_id: data.parcela_id,
    an: data.an,
    sistem_conducere: data.sistem_conducere ?? null,
    tip_ciclu_soi: data.tip_ciclu_soi ?? null,
  }

  const { data: upserted, error } = await supabase
    .from('configurari_parcela_sezon')
    .upsert(payload, { onConflict: 'parcela_id,an' })
    .select(SEASON_SELECT)
    .single()

  if (error) throw error
  return toConfigurareSezon(upserted as Record<string, unknown>)
}

export async function getOrCreateConfigurareSezon(
  parcela: ParcelaConfigurareSezon,
  an: number
): Promise<ConfigurareSezon> {
  const ctx = await getQueryContext()

  const { data: existing, error: existingError } = await ctx.supabase
    .from('configurari_parcela_sezon')
    .select(SEASON_SELECT)
    .eq('tenant_id', ctx.tenantId)
    .eq('parcela_id', parcela.id)
    .eq('an', an)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) return toConfigurareSezon(existing as Record<string, unknown>)

  const payload = buildInsertPayload(parcela, an, ctx.tenantId)

  const { data, error } = await ctx.supabase
    .from('configurari_parcela_sezon')
    .insert({
      tenant_id: payload.tenant_id,
      parcela_id: payload.parcela_id,
      an: payload.an,
      sistem_conducere: payload.sistem_conducere,
      tip_ciclu_soi: payload.tip_ciclu_soi,
    })
    .select(SEASON_SELECT)
    .single()

  if (!error && data) {
    return toConfigurareSezon(data as Record<string, unknown>)
  }

  const maybeError = (error ?? {}) as SupabaseLikeError
  if (maybeError.code === '23505' || maybeError.message?.toLowerCase().includes('duplicate key')) {
    const retry = await ctx.supabase
      .from('configurari_parcela_sezon')
      .select(SEASON_SELECT)
      .eq('tenant_id', ctx.tenantId)
      .eq('parcela_id', parcela.id)
      .eq('an', an)
      .maybeSingle()

    if (!retry.error && retry.data) {
      return toConfigurareSezon(retry.data as Record<string, unknown>)
    }
  }

  throw asError(error, 'Nu am putut crea configurarea sezonieră.')
}
