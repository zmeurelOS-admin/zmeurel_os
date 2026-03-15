import { getSupabase } from '../client'
import { upsertManoperaCheltuiala } from './manopera-auto'
import { getTenantId } from '@/lib/tenant/get-tenant'

const RECOLTARI_SELECT =
  'id,id_recoltare,data,parcela_id,culegator_id,kg_cal1,kg_cal2,pret_lei_pe_kg_snapshot,valoare_munca_lei,observatii,created_at,updated_at,tenant_id'

export interface Recoltare {
  id: string
  id_recoltare: string
  data: string
  parcela_id: string | null
  culegator_id: string | null
  kg_cal1: number
  kg_cal2: number
  pret_lei_pe_kg_snapshot: number
  valoare_munca_lei: number
  observatii: string | null
  created_at: string
  updated_at: string
  tenant_id: string | null
}

export interface CreateRecoltareInput {
  data: string
  parcela_id: string
  culegator_id: string
  kg_cal1: number
  kg_cal2: number
  observatii?: string
}

export interface UpdateRecoltareInput {
  data?: string
  parcela_id?: string
  culegator_id?: string
  kg_cal1?: number
  kg_cal2?: number
  observatii?: string
}

export type RecoltareMutationResult =
  | { success: true; data: Recoltare; warning?: string }
  | { success: false; error: string }

export type DeleteRecoltareResult =
  | { success: true; warning?: string }
  | { success: false; error: string }

type RecoltareRow = Parameters<typeof mapRecoltare>[0]

type RecoltareRpcError = {
  message?: string
}

type RecoltareRpcClient = ReturnType<typeof getSupabase> & {
  rpc: {
    (
      fn: 'create_recoltare_with_stock',
      args: {
        p_data: string
        p_parcela_id: string
        p_culegator_id: string
        p_kg_cal1: number
        p_kg_cal2: number
        p_observatii?: string | null
        p_tenant_id?: string | null
      }
    ): Promise<{
      data: RecoltareRow | null
      error: RecoltareRpcError | null
    }>
    (
      fn: 'update_recoltare_with_stock',
      args: {
        p_recoltare_id: string
        p_data: string
        p_parcela_id: string
        p_culegator_id: string
        p_kg_cal1: number
        p_kg_cal2: number
        p_observatii?: string | null
      }
    ): Promise<{
      data: RecoltareRow | null
      error: RecoltareRpcError | null
    }>
    (
      fn: 'delete_recoltare_with_stock',
      args: { p_recoltare_id: string }
    ): Promise<{
      data: null
      error: RecoltareRpcError | null
    }>
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeKg(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0
  return Math.max(0, Number(value))
}

function computeKg(input: { kg_cal1?: number; kg_cal2?: number }) {
  const kgCal1 = normalizeKg(input.kg_cal1)
  const kgCal2 = normalizeKg(input.kg_cal2)

  return {
    kgCal1: round2(kgCal1),
    kgCal2: round2(kgCal2),
    totalKg: round2(kgCal1 + kgCal2),
  }
}

function mapRecoltare(row: {
  id: string
  id_recoltare: string
  data: string
  parcela_id: string | null
  culegator_id: string | null
  kg_cal1: number | null
  kg_cal2: number | null
  pret_lei_pe_kg_snapshot: number | null
  valoare_munca_lei: number | null
  observatii: string | null
  created_at: string
  updated_at: string
  tenant_id: string | null
}): Recoltare {
  return {
    id: row.id,
    id_recoltare: row.id_recoltare,
    data: row.data,
    parcela_id: row.parcela_id,
    culegator_id: row.culegator_id,
    kg_cal1: Number(row.kg_cal1 ?? 0),
    kg_cal2: Number(row.kg_cal2 ?? 0),
    pret_lei_pe_kg_snapshot: Number(row.pret_lei_pe_kg_snapshot ?? 0),
    valoare_munca_lei: Number(row.valoare_munca_lei ?? 0),
    observatii: row.observatii,
    created_at: row.created_at,
    updated_at: row.updated_at,
    tenant_id: row.tenant_id,
  }
}

const AUTO_MANOPERA_WARNING =
  'Recoltarea a fost salvată, dar sincronizarea cheltuielilor de manoperă a eșuat. Verificați modulul Cheltuieli.'

async function scheduleAutoManoperaSync(params: {
  supabase: ReturnType<typeof getSupabase>
  tenantId?: string | null
  dates: Array<string | null | undefined>
}): Promise<void> {
  const tenantId = params.tenantId ?? null
  if (!tenantId) return

  const uniqueDates = Array.from(new Set(params.dates.map((d) => String(d || '').slice(0, 10)).filter(Boolean)))
  if (!uniqueDates.length) return

  await Promise.all(uniqueDates.map((date) => upsertManoperaCheltuiala(params.supabase, tenantId, date)))
}

function toSchemaAwareError(error: RecoltareRpcError | null): Error {
  const message = (error?.message || '').toLowerCase()
  if (message.includes('kg_cal1') || message.includes('schema cache') || message.includes('could not find')) {
    return new Error('Coloana kg_cal1 lipseste din baza de date. Va rugam actualizati schema.')
  }
  if (error instanceof Error) {
    return error
  }
  return new Error(error?.message || 'Operatiunea pe recoltari a esuat.')
}

export async function getRecoltari(): Promise<Recoltare[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('recoltari')
    .select(RECOLTARI_SELECT)
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false })

  if (error) {
    const message = (error.message || '').toLowerCase()
    if (message.includes('kg_cal1') || message.includes('schema cache') || message.includes('could not find')) {
      throw new Error('Coloana kg_cal1 lipseste din baza de date. Va rugam actualizati schema.')
    }
    throw error
  }

  return (data ?? []).map((row) => mapRecoltare(row as RecoltareRow))
}

export async function createRecoltare(input: CreateRecoltareInput): Promise<RecoltareMutationResult> {
  const supabase = getSupabase()

  try {
    const tenantId = await getTenantId(supabase)
    const kg = computeKg(input)
    const rpcClient = supabase as RecoltareRpcClient
    const { data, error } = await rpcClient.rpc('create_recoltare_with_stock', {
      p_data: input.data,
      p_parcela_id: input.parcela_id,
      p_culegator_id: input.culegator_id,
      p_kg_cal1: kg.kgCal1,
      p_kg_cal2: kg.kgCal2,
      p_observatii: input.observatii ?? null,
      p_tenant_id: tenantId,
    })

    if (error) {
      return { success: false, error: toSchemaAwareError(error).message }
    }

    if (!data) {
      return { success: false, error: 'Nu am primit recoltarea creata de la baza de date.' }
    }

    const recoltare = mapRecoltare(data)

    try {
      await scheduleAutoManoperaSync({
        supabase,
        tenantId: recoltare.tenant_id,
        dates: [recoltare.data],
      })
      return { success: true, data: recoltare }
    } catch (syncError) {
      console.error('Labor expense sync failed:', syncError)
      return {
        success: true,
        data: recoltare,
        warning: AUTO_MANOPERA_WARNING,
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Operatiunea pe recoltari a esuat.',
    }
  }
}

export async function updateRecoltare(id: string, input: UpdateRecoltareInput): Promise<RecoltareMutationResult> {
  const supabase = getSupabase()

  try {
    const tenantId = await getTenantId(supabase)
    const rpcClient = supabase as RecoltareRpcClient
    const { data: existing, error: existingError } = await supabase
      .from('recoltari')
      .select('id,culegator_id,parcela_id,kg_cal1,kg_cal2,data,observatii,tenant_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (existingError) {
      return { success: false, error: existingError.message }
    }

    const nextCulegatorId = input.culegator_id ?? existing.culegator_id
    if (!nextCulegatorId) {
      return { success: false, error: 'Culegatorul este obligatoriu' }
    }

    const nextParcelaId = input.parcela_id ?? existing.parcela_id
    if (!nextParcelaId) {
      return { success: false, error: 'Parcela este obligatorie' }
    }

    const kg = computeKg({
      kg_cal1: input.kg_cal1 ?? existing.kg_cal1 ?? 0,
      kg_cal2: input.kg_cal2 ?? existing.kg_cal2 ?? 0,
    })

    const { data, error } = await rpcClient.rpc('update_recoltare_with_stock', {
      p_recoltare_id: id,
      p_data: input.data ?? existing.data,
      p_parcela_id: nextParcelaId,
      p_culegator_id: nextCulegatorId,
      p_kg_cal1: kg.kgCal1,
      p_kg_cal2: kg.kgCal2,
      p_observatii: input.observatii ?? existing.observatii ?? null,
    })

    if (error) {
      return { success: false, error: toSchemaAwareError(error).message }
    }

    if (!data) {
      return { success: false, error: 'Nu am primit recoltarea actualizata de la baza de date.' }
    }

    const recoltare = mapRecoltare(data)

    try {
      await scheduleAutoManoperaSync({
        supabase,
        tenantId: recoltare.tenant_id ?? existing.tenant_id,
        dates: [existing.data, recoltare.data],
      })
      return { success: true, data: recoltare }
    } catch (syncError) {
      console.error('Labor expense sync failed:', syncError)
      return {
        success: true,
        data: recoltare,
        warning: AUTO_MANOPERA_WARNING,
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Operatiunea pe recoltari a esuat.',
    }
  }
}

export async function deleteRecoltare(id: string): Promise<DeleteRecoltareResult> {
  const supabase = getSupabase()

  try {
    const tenantId = await getTenantId(supabase)
    const rpcClient = supabase as RecoltareRpcClient
    const { data: existing, error: existingError } = await supabase
      .from('recoltari')
      .select('tenant_id,data')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (existingError) {
      return { success: false, error: existingError.message }
    }

    const { error } = await rpcClient.rpc('delete_recoltare_with_stock', {
      p_recoltare_id: id,
    })

    if (error) {
      return { success: false, error: toSchemaAwareError(error).message }
    }

    try {
      await scheduleAutoManoperaSync({
        supabase,
        tenantId: existing?.tenant_id ?? null,
        dates: [existing?.data ?? null],
      })
      return { success: true }
    } catch (syncError) {
      console.error('Labor expense sync failed:', syncError)
      return {
        success: true,
        warning: AUTO_MANOPERA_WARNING,
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Operatiunea pe recoltari a esuat.',
    }
  }
}
