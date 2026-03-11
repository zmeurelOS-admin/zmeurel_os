import { getSupabase } from '../client'
import { getTenantId } from '@/lib/tenant/get-tenant'
import type { Tables } from '@/types/supabase'

export type MiscareStoc = Tables<'miscari_stoc'>

export type CalitateStoc = 'cal1' | 'cal2'
export type DepozitStoc = 'fresh' | 'congelat' | 'procesat'
export type TipMiscareStoc =
  | 'recoltare'
  | 'vanzare'
  | 'consum'
  | 'oferit_gratuit'
  | 'procesare'
  | 'congelare'
  | 'pierdere'
  | 'ajustare'

export type TipMiscareStocGlobal = 'recoltare' | 'ajustare' | 'vanzare' | 'transformare' | 'corectie'

export interface InsertMiscareStocInput {
  tenant_id?: string
  locatie_id?: string
  produs?: string
  calitate?: CalitateStoc
  depozit?: DepozitStoc
  tip_miscare?: TipMiscareStoc
  cantitate_kg?: number
  tip?: TipMiscareStocGlobal
  cantitate_cal1?: number
  cantitate_cal2?: number
  referinta_id?: string | null
  data?: string
  observatii?: string | null
  descriere?: string | null
}

export interface StocFilters {
  locatieId?: string
  produs?: string
  depozit?: DepozitStoc | 'all'
  calitate?: CalitateStoc | 'all'
}

export interface StocLocationRow {
  locatie_id: string
  locatie_nume: string
  produs: string
  stoc_fresh_cal1: number
  stoc_fresh_cal2: number
  stoc_congelat: number
  stoc_procesat: number
  total_kg: number
}

interface MiscareStocWithParcela {
  locatie_id: string
  produs: string
  calitate: CalitateStoc
  depozit: DepozitStoc
  tip_miscare: TipMiscareStoc
  cantitate_kg: number
  parcele: {
    nume_parcela: string | null
  } | null
}

type SupabaseLikeError = {
  code?: string
  message?: string
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function isMissingInventoryTableError(error: unknown): boolean {
  const err = (error ?? {}) as SupabaseLikeError
  const message = (err.message ?? '').toLowerCase()
  return (
    err.code === 'PGRST205' ||
    message.includes('could not find the table') ||
    message.includes('relation "public.miscari_stoc" does not exist')
  )
}

function signedQuantity(tipMiscare: TipMiscareStoc, cantitateKg: number): number {
  const outflowTypes: TipMiscareStoc[] = ['vanzare', 'consum', 'oferit_gratuit', 'pierdere']
  const qty = Math.max(0, Number(cantitateKg) || 0)
  return outflowTypes.includes(tipMiscare) ? -qty : qty
}

function mapLegacyToGlobalTip(tipMiscare?: TipMiscareStoc): TipMiscareStocGlobal {
  if (tipMiscare === 'recoltare') return 'recoltare'
  if (tipMiscare === 'vanzare') return 'vanzare'
  if (tipMiscare === 'ajustare') return 'ajustare'
  return 'corectie'
}

export async function insertMiscareStoc(input: InsertMiscareStocInput): Promise<MiscareStoc> {
  const supabase = getSupabase()
  const tenantId = input.tenant_id ?? (await getTenantId(supabase))

  const qty = round2(Math.max(0, Number(input.cantitate_kg) || 0))
  const signedQty =
    input.tip_miscare && qty > 0 ? signedQuantity(input.tip_miscare, qty) : 0
  const derivedCal1 =
    input.cantitate_cal1 !== undefined
      ? round2(Number(input.cantitate_cal1) || 0)
      : input.calitate === 'cal1'
        ? round2(signedQty)
        : 0
  const derivedCal2 =
    input.cantitate_cal2 !== undefined
      ? round2(Number(input.cantitate_cal2) || 0)
      : input.calitate === 'cal2'
        ? round2(signedQty)
        : 0

  const payload = {
    tenant_id: tenantId,
    locatie_id: input.locatie_id ?? null,
    produs: input.produs ?? null,
    calitate: input.calitate ?? null,
    depozit: input.depozit ?? null,
    tip_miscare: input.tip_miscare ?? null,
    cantitate_kg: input.cantitate_kg !== undefined ? qty : null,
    tip: input.tip ?? mapLegacyToGlobalTip(input.tip_miscare),
    cantitate_cal1: derivedCal1,
    cantitate_cal2: derivedCal2,
    referinta_id: input.referinta_id ?? null,
    data: input.data ?? new Date().toISOString().split('T')[0],
    observatii: input.observatii ?? null,
    descriere: input.descriere ?? null,
  }

  const { data, error } = await supabase.from('miscari_stoc').insert(payload).select().single()

  if (error) {
    if (isMissingInventoryTableError(error)) {
      throw new Error('Schema stocuri neinitializata')
    }
    throw error
  }
  return data
}

export async function deleteMiscariStocByReference(
  referintaId: string,
  tipMiscare?: TipMiscareStoc
): Promise<void> {
  const supabase = getSupabase()

  let query = supabase
    .from('miscari_stoc')
    .delete()
    .eq('referinta_id', referintaId)

  if (tipMiscare) {
    query = query.eq('tip_miscare', tipMiscare)
  }

  const { error } = await query

  if (error && !isMissingInventoryTableError(error)) throw error
}

export async function getStocCantitateKg(params: {
  locatieId: string
  produs: string
  calitate: CalitateStoc
  depozit: DepozitStoc
}): Promise<number> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('miscari_stoc')
    .select('tip_miscare,cantitate_kg')
    .eq('locatie_id', params.locatieId)
    .eq('produs', params.produs)
    .eq('calitate', params.calitate)
    .eq('depozit', params.depozit)

  if (error) {
    if (isMissingInventoryTableError(error)) return 0
    throw error
  }

  const total = (data ?? []).reduce((sum, row) => {
    return sum + signedQuantity(row.tip_miscare as TipMiscareStoc, Number(row.cantitate_kg ?? 0))
  }, 0)

  return round2(total)
}

export async function getStocuriPeLocatii(filters: StocFilters = {}): Promise<StocLocationRow[]> {
  const supabase = getSupabase()

  let query = supabase
    .from('miscari_stoc')
    .select('locatie_id,produs,calitate,depozit,tip_miscare,cantitate_kg,parcele(nume_parcela)')
    .not('locatie_id', 'is', null)
    .not('produs', 'is', null)
    .not('calitate', 'is', null)
    .not('depozit', 'is', null)
    .not('tip_miscare', 'is', null)
    .not('cantitate_kg', 'is', null)
    .order('data', { ascending: false })

  if (filters.locatieId) query = query.eq('locatie_id', filters.locatieId)
  if (filters.produs) query = query.eq('produs', filters.produs)
  if (filters.depozit && filters.depozit !== 'all') query = query.eq('depozit', filters.depozit)
  if (filters.calitate && filters.calitate !== 'all') query = query.eq('calitate', filters.calitate)

  const { data, error } = await query
  if (error) {
    if (isMissingInventoryTableError(error)) return []
    throw error
  }

  const rows = (data ?? []) as unknown as MiscareStocWithParcela[]
  const grouped = new Map<string, StocLocationRow>()

  rows.forEach((row) => {
    const key = `${row.locatie_id}:${row.produs}`
    const existing = grouped.get(key) ?? {
      locatie_id: row.locatie_id,
      locatie_nume: row.parcele?.nume_parcela ?? 'Locatie',
      produs: row.produs,
      stoc_fresh_cal1: 0,
      stoc_fresh_cal2: 0,
      stoc_congelat: 0,
      stoc_procesat: 0,
      total_kg: 0,
    }

    const qty = signedQuantity(row.tip_miscare, Number(row.cantitate_kg ?? 0))

    if (row.depozit === 'fresh' && row.calitate === 'cal1') {
      existing.stoc_fresh_cal1 = round2(existing.stoc_fresh_cal1 + qty)
    }
    if (row.depozit === 'fresh' && row.calitate === 'cal2') {
      existing.stoc_fresh_cal2 = round2(existing.stoc_fresh_cal2 + qty)
    }
    if (row.depozit === 'congelat') {
      existing.stoc_congelat = round2(existing.stoc_congelat + qty)
    }
    if (row.depozit === 'procesat') {
      existing.stoc_procesat = round2(existing.stoc_procesat + qty)
    }

    existing.total_kg = round2(
      existing.stoc_fresh_cal1 + existing.stoc_fresh_cal2 + existing.stoc_congelat + existing.stoc_procesat
    )

    grouped.set(key, existing)
  })

  return Array.from(grouped.values()).sort((a, b) => a.locatie_nume.localeCompare(b.locatie_nume, 'ro'))
}
