// src/lib/supabase/queries/vanzari.ts
import { getSupabase } from '../client'
import { getTenantId } from '@/lib/tenant/get-tenant'
import type { CalitateStoc } from './miscari-stoc'

export const STATUS_PLATA = ['platit', 'restanta', 'avans'] as const
export const CALITATI_VANZARE: CalitateStoc[] = ['cal1', 'cal2']

export interface Vanzare {
  id: string
  id_vanzare: string
  client_sync_id: string
  data: string
  client_id: string | null
  comanda_id?: string | null
  cantitate_kg: number
  pret_lei_kg: number
  pret_unitar_lei: number
  status_plata: string
  observatii_ladite: string | null
  sync_status: string | null
  conflict_flag: boolean | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  tenant_id: string | null
}

export interface CreateVanzareInput {
  client_sync_id?: string
  sync_status?: string
  tenant_id?: string
  data: string
  client_id?: string
  comanda_id?: string | null
  cantitate_kg: number
  calitate?: CalitateStoc
  pret_lei_kg: number
  status_plata?: string
  observatii_ladite?: string
}

export interface UpdateVanzareInput {
  data?: string
  client_id?: string
  cantitate_kg?: number
  pret_lei_kg?: number
  status_plata?: string
  observatii_ladite?: string
}

export type UpdateVanzareResult =
  | { success: true; data: Vanzare }
  | { success: false; error: string }

type SupabaseLikeError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

type VanzareRpcClient = ReturnType<typeof getSupabase> & {
  rpc: {
    (
      fn: 'create_vanzare_with_stock',
      args: {
        p_data: string
        p_client_id?: string | null
        p_comanda_id?: string | null
        p_cantitate_kg: number
        p_pret_lei_kg: number
        p_status_plata?: string
        p_observatii_ladite?: string | null
        p_client_sync_id?: string
        p_sync_status?: string
        p_tenant_id?: string
        p_calitate?: CalitateStoc
      }
    ): Promise<{ data: Vanzare | null; error: SupabaseLikeError | null }>
    (
      fn: 'update_vanzare_with_stock',
      args: {
        p_vanzare_id: string
        p_data?: string | null
        p_client_id?: string | null
        p_cantitate_kg?: number | null
        p_pret_lei_kg?: number | null
        p_status_plata?: string | null
        p_observatii_ladite?: string | null
        p_tenant_id?: string | null
      }
    ): Promise<{ data: Vanzare | null; error: SupabaseLikeError | null }>
    (
      fn: 'delete_vanzare_with_stock',
      args: { p_vanzare_id: string }
    ): Promise<{ data: null; error: SupabaseLikeError | null }>
  }
}

const isMissingColumnError = (error: SupabaseLikeError, column: string) =>
  error?.code === 'PGRST204' ||
  error?.code === '42703' ||
  error?.message?.includes(`'${column}'`) ||
  error?.message?.includes(column)

const toReadableError = (error: unknown, fallbackMessage: string) => {
  const e = (error ?? {}) as SupabaseLikeError
  const message = e?.message || e?.details || e?.hint || fallbackMessage

  return Object.assign(new Error(message), {
    code: e?.code,
    details: e?.details,
    hint: e?.hint,
  })
}

export async function getVanzari(): Promise<Vanzare[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const selectWithComanda =
    'id,id_vanzare,data,client_id,comanda_id,cantitate_kg,pret_lei_kg,status_plata,observatii_ladite,created_at,updated_at,tenant_id'
  const selectLegacy =
    'id,id_vanzare,data,client_id,cantitate_kg,pret_lei_kg,status_plata,observatii_ladite,created_at,updated_at,tenant_id'

  const { data, error } = await supabase
    .from('vanzari')
    .select(selectWithComanda)
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false })

  if (error && isMissingColumnError(error, 'comanda_id')) {
    const { data: legacyData, error: legacyError } = await supabase
      .from('vanzari')
      .select(selectLegacy)
      .eq('tenant_id', tenantId)
      .order('data', { ascending: false })

    if (legacyError) {
      throw legacyError
    }

    return (legacyData ?? []) as unknown as Vanzare[]
  }

  if (error) {
    throw error
  }

  return (data ?? []) as unknown as Vanzare[]
}

export async function createVanzare(input: CreateVanzareInput): Promise<Vanzare> {
  const supabase = getSupabase()
  const tenantId = input.tenant_id ?? (await getTenantId(supabase))
  const rpcClient = supabase as VanzareRpcClient
  const { data, error } = await rpcClient.rpc('create_vanzare_with_stock', {
    p_data: input.data,
    p_client_id: input.client_id || null,
    p_comanda_id: input.comanda_id ?? null,
    p_cantitate_kg: Number(input.cantitate_kg || 0),
    p_calitate: input.calitate ?? 'cal1',
    p_pret_lei_kg: Number(input.pret_lei_kg || 0),
    p_status_plata: input.status_plata || 'platit',
    p_observatii_ladite: input.observatii_ladite || null,
    p_client_sync_id: input.client_sync_id ?? crypto.randomUUID(),
    p_sync_status: input.sync_status ?? 'synced',
    p_tenant_id: tenantId,
  })

  if (!error && data) {
    return data as unknown as Vanzare
  }

  throw toReadableError(error, 'Nu am putut salva vanzarea.')
}

/*
SQL reference for the stock-safe edit path lives in:
supabase/migrations/20260313_update_vanzare_with_stock.sql

create or replace function public.update_vanzare_with_stock(
  p_vanzare_id uuid,
  p_data date,
  p_client_id uuid,
  p_cantitate_kg numeric,
  p_pret_lei_kg numeric,
  p_status_plata text,
  p_observatii_ladite text,
  p_tenant_id uuid
) returns public.vanzari;
*/
export async function updateVanzare(id: string, input: UpdateVanzareInput): Promise<UpdateVanzareResult> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const rpcClient = supabase as VanzareRpcClient

  try {
    const { data, error } = await rpcClient.rpc('update_vanzare_with_stock', {
      p_vanzare_id: id,
      p_data: input.data ?? null,
      p_client_id: input.client_id ?? null,
      p_cantitate_kg: input.cantitate_kg ?? null,
      p_pret_lei_kg: input.pret_lei_kg ?? null,
      p_status_plata: input.status_plata ?? null,
      p_observatii_ladite: input.observatii_ladite ?? null,
      p_tenant_id: tenantId,
    })

    if (error) {
      return {
        success: false,
        error: toReadableError(error, 'Nu am putut actualiza vanzarea.').message,
      }
    }

    if (!data) {
      return {
        success: false,
        error: 'Nu am primit vanzarea actualizata de la baza de date.',
      }
    }

    return {
      success: true,
      data: data as unknown as Vanzare,
    }
  } catch (error) {
    return {
      success: false,
      error: toReadableError(error, 'Nu am putut actualiza vanzarea.').message,
    }
  }
}

export async function deleteVanzare(id: string): Promise<void> {
  const supabase = getSupabase()
  const rpcClient = supabase as VanzareRpcClient
  const { error } = await rpcClient.rpc('delete_vanzare_with_stock', {
    p_vanzare_id: id,
  })

  if (error) {
    throw error
  }
}
