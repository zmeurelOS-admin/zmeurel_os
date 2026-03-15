/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSupabase } from '../client'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { type Vanzare } from './vanzari'

export const COMENZI_STATUSES = [
  'noua',
  'confirmata',
  'programata',
  'in_livrare',
  'livrata',
  'anulata',
] as const

export type ComandaStatus = (typeof COMENZI_STATUSES)[number]
export type ComandaPlata = 'integral' | 'avans' | 'restanta'

export interface Comanda {
  id: string
  tenant_id: string
  client_id: string | null
  client_nume_manual: string | null
  telefon: string | null
  locatie_livrare: string | null
  data_comanda: string
  data_livrare: string | null
  cantitate_kg: number
  pret_per_kg: number
  total: number
  status: ComandaStatus
  observatii: string | null
  linked_vanzare_id: string | null
  parent_comanda_id: string | null
  created_at: string
  updated_at: string
  client_nume?: string | null
}

export interface CreateComandaInput {
  client_id?: string | null
  client_nume_manual?: string | null
  telefon?: string | null
  locatie_livrare?: string | null
  data_comanda?: string
  data_livrare?: string | null
  cantitate_kg: number
  pret_per_kg: number
  status?: ComandaStatus
  observatii?: string | null
}

export interface UpdateComandaInput {
  client_id?: string | null
  client_nume_manual?: string | null
  telefon?: string | null
  locatie_livrare?: string | null
  data_comanda?: string
  data_livrare?: string | null
  cantitate_kg?: number
  pret_per_kg?: number
  status?: ComandaStatus
  observatii?: string | null
}

export interface DeliverComandaInput {
  comandaId: string
  cantitateLivrataKg: number
  plata: ComandaPlata
  dataLivrareRamasa?: string | null
}

interface StockBucket {
  locatie_id: string
  produs: string
  calitate: 'cal1' | 'cal2'
  depozit: 'fresh' | 'congelat' | 'procesat'
  availableKg: number
}

type SupabaseLikeError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

type DeliverOrderAtomicPayload = {
  delivered_order: Record<string, unknown> | null
  vanzare: Vanzare | null
  remaining_order: Record<string, unknown> | null
  deducted_stock_kg: number | null
}

type ComenziRpcClient = ReturnType<typeof getSupabase> & {
  rpc: {
    (
      fn: 'deliver_order_atomic',
      args: {
        p_order_id: string
        p_delivered_qty: number
        p_payment_status: string
        p_remaining_delivery_date: string | null
      }
    ): Promise<{
      data: DeliverOrderAtomicPayload | null
      error: SupabaseLikeError | null
    }>
    (
      fn: 'delete_comanda_atomic',
      args: {
        p_comanda_id: string
        p_tenant_id: string
      }
    ): Promise<{
      data: null
      error: SupabaseLikeError | null
    }>
    (
      fn: 'reopen_comanda_atomic',
      args: {
        p_comanda_id: string
        p_tenant_id: string
      }
    ): Promise<{
      data: Record<string, unknown> | null
      error: SupabaseLikeError | null
    }>
  }
}

function toReadableError(error: unknown, fallbackMessage: string) {
  const e = (error ?? {}) as SupabaseLikeError
  const message = e.message || e.details || e.hint || fallbackMessage
  return Object.assign(new Error(message), {
    code: e.code,
    details: e.details,
    hint: e.hint,
  })
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

function ensureStatus(status: string): ComandaStatus {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'pregatita') {
    return 'programata'
  }
  if (!COMENZI_STATUSES.includes(normalized as ComandaStatus)) {
    return 'noua'
  }
  return normalized as ComandaStatus
}

function mapComanda(row: any): Comanda {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    client_id: row.client_id ?? null,
    client_nume_manual: row.client_nume_manual ?? null,
    telefon: row.telefon ?? null,
    locatie_livrare: row.locatie_livrare ?? null,
    data_comanda: row.data_comanda,
    data_livrare: row.data_livrare ?? null,
    cantitate_kg: Number(row.cantitate_kg ?? 0),
    pret_per_kg: Number(row.pret_per_kg ?? 0),
    total: Number(row.total ?? 0),
    status: ensureStatus(row.status),
    observatii: row.observatii ?? null,
    linked_vanzare_id: row.linked_vanzare_id ?? null,
    parent_comanda_id: row.parent_comanda_id ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    client_nume: row.clienti?.nume_client ?? null,
  }
}

function signedQuantity(tipMiscare: string, cantitateKg: number): number {
  const outflowTypes = new Set(['vanzare', 'consum', 'oferit_gratuit', 'pierdere'])
  return outflowTypes.has(tipMiscare) ? -cantitateKg : cantitateKg
}

async function getStockBuckets(): Promise<StockBucket[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data, error } = await (supabase as any)
    .from('miscari_stoc')
    .select('locatie_id,produs,calitate,depozit,tip_miscare,cantitate_kg')
    .eq('tenant_id', tenantId)

  if (error) throw toReadableError(error, 'Nu am putut incarca stocul disponibil.')

  const grouped = new Map<string, StockBucket>()
  for (const row of data ?? []) {
    const key = `${row.locatie_id}|${row.produs}|${row.calitate}|${row.depozit}`
    const existing = grouped.get(key) ?? {
      locatie_id: row.locatie_id,
      produs: row.produs,
      calitate: row.calitate,
      depozit: row.depozit,
      availableKg: 0,
    }
    const qty = signedQuantity(String(row.tip_miscare), Number(row.cantitate_kg ?? 0))
    existing.availableKg = round2(existing.availableKg + qty)
    grouped.set(key, existing)
  }

  return Array.from(grouped.values())
    .filter((bucket) => bucket.availableKg > 0)
    .sort((a, b) => b.availableKg - a.availableKg)
}

function mapPlataToStatus(plata: ComandaPlata): string {
  if (plata === 'integral') return 'platit'
  if (plata === 'avans') return 'avans'
  return 'restanta'
}

export async function getComenzi(): Promise<Comanda[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data, error } = await (supabase as any)
    .from('comenzi')
    .select(`
      id,
      tenant_id,
      client_id,
      client_nume_manual,
      telefon,
      locatie_livrare,
      data_comanda,
      data_livrare,
      cantitate_kg,
      pret_per_kg,
      total,
      status,
      observatii,
      linked_vanzare_id,
      parent_comanda_id,
      created_at,
      updated_at,
      clienti (
        nume_client
      )
    `)
    .eq('tenant_id', tenantId)
    .order('data_livrare', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw toReadableError(error, 'Nu am putut incarca comenzile.')
  return (data ?? []).map(mapComanda)
}

export async function createComanda(input: CreateComandaInput): Promise<Comanda> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const payload = {
    tenant_id: tenantId,
    client_id: input.client_id ?? null,
    client_nume_manual: input.client_nume_manual?.trim() || null,
    telefon: input.telefon?.trim() || null,
    locatie_livrare: input.locatie_livrare?.trim() || null,
    data_comanda: input.data_comanda ?? new Date().toISOString().split('T')[0],
    data_livrare: input.data_livrare ?? null,
    cantitate_kg: round2(input.cantitate_kg),
    pret_per_kg: round2(input.pret_per_kg),
    total: round2(input.cantitate_kg * input.pret_per_kg),
    status: input.status ?? 'noua',
    observatii: input.observatii?.trim() || null,
  }

  const { data, error } = await (supabase as any)
    .from('comenzi')
    .insert(payload)
    .select(`
      id,
      tenant_id,
      client_id,
      client_nume_manual,
      telefon,
      locatie_livrare,
      data_comanda,
      data_livrare,
      cantitate_kg,
      pret_per_kg,
      total,
      status,
      observatii,
      linked_vanzare_id,
      parent_comanda_id,
      created_at,
      updated_at,
      clienti (
        nume_client
      )
    `)
    .single()

  if (error) throw toReadableError(error, 'Nu am putut salva comanda.')
  return mapComanda(data)
}

export async function updateComanda(id: string, input: UpdateComandaInput): Promise<Comanda> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const payload = {
    ...(input.client_id !== undefined ? { client_id: input.client_id ?? null } : {}),
    ...(input.client_nume_manual !== undefined ? { client_nume_manual: input.client_nume_manual?.trim() || null } : {}),
    ...(input.telefon !== undefined ? { telefon: input.telefon?.trim() || null } : {}),
    ...(input.locatie_livrare !== undefined ? { locatie_livrare: input.locatie_livrare?.trim() || null } : {}),
    ...(input.data_comanda !== undefined ? { data_comanda: input.data_comanda } : {}),
    ...(input.data_livrare !== undefined ? { data_livrare: input.data_livrare ?? null } : {}),
    ...(input.cantitate_kg !== undefined ? { cantitate_kg: round2(input.cantitate_kg) } : {}),
    ...(input.pret_per_kg !== undefined ? { pret_per_kg: round2(input.pret_per_kg) } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.observatii !== undefined ? { observatii: input.observatii?.trim() || null } : {}),
    updated_at: new Date().toISOString(),
  }

  if (payload.cantitate_kg !== undefined || payload.pret_per_kg !== undefined) {
    const { data: current, error: currentError } = await (supabase as any)
      .from('comenzi')
      .select('cantitate_kg,pret_per_kg')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (currentError) throw toReadableError(currentError, 'Nu am putut incarca comanda pentru editare.')

    const cantitate = round2(payload.cantitate_kg ?? Number(current.cantitate_kg ?? 0))
    const pret = round2(payload.pret_per_kg ?? Number(current.pret_per_kg ?? 0))
    ;(payload as any).total = round2(cantitate * pret)
  }

  const { data, error } = await (supabase as any)
    .from('comenzi')
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(`
      id,
      tenant_id,
      client_id,
      client_nume_manual,
      telefon,
      locatie_livrare,
      data_comanda,
      data_livrare,
      cantitate_kg,
      pret_per_kg,
      total,
      status,
      observatii,
      linked_vanzare_id,
      parent_comanda_id,
      created_at,
      updated_at,
      clienti (
        nume_client
      )
    `)
    .single()

  if (error) throw toReadableError(error, 'Nu am putut actualiza comanda.')
  return mapComanda(data)
}

export async function deleteComanda(id: string): Promise<void> {
  /*
  SQL reference for the atomic delete path lives in:
  supabase/migrations/20260313_atomic_order_operations.sql

  create or replace function public.delete_comanda_atomic(
    p_comanda_id uuid,
    p_tenant_id uuid
  ) returns void;
  */
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const rpcClient = supabase as ComenziRpcClient
  const { error } = await rpcClient.rpc('delete_comanda_atomic', {
    p_comanda_id: id,
    p_tenant_id: tenantId,
  })

  if (error) throw toReadableError(error, 'Nu am putut sterge comanda.')
}

export async function deliverComanda(input: DeliverComandaInput): Promise<{
  deliveredOrder: Comanda
  vanzare: Vanzare
  remainingOrder: Comanda | null
  deductedStockKg: number
}> {
  const deliveredQty = round2(input.cantitateLivrataKg)

  if (!Number.isFinite(deliveredQty) || deliveredQty <= 0) {
    throw new Error('Cantitatea livrata trebuie sa fie mai mare decat 0.')
  }

  const rpcClient = getSupabase() as ComenziRpcClient
  const { data, error } = await rpcClient.rpc('deliver_order_atomic', {
    p_order_id: input.comandaId,
    p_delivered_qty: deliveredQty,
    p_payment_status: mapPlataToStatus(input.plata),
    p_remaining_delivery_date: input.dataLivrareRamasa ?? null,
  })

  if (error) {
    throw toReadableError(error, 'Nu am putut finaliza livrarea comenzii.')
  }

  if (!data?.delivered_order || !data.vanzare) {
    throw new Error('Livrarea nu a putut fi finalizata complet.')
  }

  return {
    deliveredOrder: mapComanda(data.delivered_order),
    vanzare: data.vanzare,
    remainingOrder: data.remaining_order ? mapComanda(data.remaining_order) : null,
    deductedStockKg: round2(Number(data.deducted_stock_kg ?? 0)),
  }
}

export async function reopenComanda(id: string): Promise<Comanda> {
  /*
  SQL reference for the atomic reopen path lives in:
  supabase/migrations/20260313_atomic_order_operations.sql

  create or replace function public.reopen_comanda_atomic(
    p_comanda_id uuid,
    p_tenant_id uuid
  ) returns public.comenzi;
  */
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const rpcClient = supabase as ComenziRpcClient
  const { data, error } = await rpcClient.rpc('reopen_comanda_atomic', {
    p_comanda_id: id,
    p_tenant_id: tenantId,
  })

  if (error) throw toReadableError(error, 'Nu am putut redeschide comanda.')
  if (!data) {
    throw new Error('Nu am primit comanda redeschisa de la baza de date.')
  }
  return mapComanda(data)
}

export async function getComenziStockSummaryAzi(): Promise<{
  totalStocDisponibilKg: number
}> {
  const buckets = await getStockBuckets()
  return {
    totalStocDisponibilKg: round2(buckets.reduce((sum, bucket) => sum + bucket.availableKg, 0)),
  }
}
