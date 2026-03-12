/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSupabase } from '../client'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { createVanzare, deleteVanzare, type Vanzare } from './vanzari'

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
  const { data, error } = await (supabase as any)
    .from('miscari_stoc')
    .select('locatie_id,produs,calitate,depozit,tip_miscare,cantitate_kg')

  if (error) throw toReadableError(error, 'Nu am putut încărca stocul disponibil.')

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

async function applyStockOutflowForVanzare(vanzareId: string, cantitateKg: number, tenantId: string): Promise<number> {
  const supabase = getSupabase()
  let remaining = round2(cantitateKg)
  if (remaining <= 0) return 0

  const buckets = await getStockBuckets()
  let deducted = 0

  for (const bucket of buckets) {
    if (remaining <= 0) break
    const take = round2(Math.min(bucket.availableKg, remaining))
    if (take <= 0) continue

    const payload = {
      tenant_id: tenantId,
      locatie_id: bucket.locatie_id,
      produs: bucket.produs,
      calitate: bucket.calitate,
      depozit: bucket.depozit,
      tip_miscare: 'vanzare',
      cantitate_kg: take,
      referinta_id: vanzareId,
      data: new Date().toISOString().split('T')[0],
      observatii: 'Consum stoc prin livrare comanda',
    }

    const { error } = await (supabase as any).from('miscari_stoc').insert(payload)
    if (error) {
      throw toReadableError(error, 'Nu am putut actualiza stocul pentru livrare.')
    }

    deducted = round2(deducted + take)
    remaining = round2(remaining - take)
  }

  return deducted
}

function mapPlataToStatus(plata: ComandaPlata): string {
  if (plata === 'integral') return 'Platit'
  if (plata === 'avans') return 'Avans'
  return 'Restanta'
}

export async function getComenzi(): Promise<Comanda[]> {
  const supabase = getSupabase()
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
    .order('data_livrare', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw toReadableError(error, 'Nu am putut încărca comenzile.')
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
      .single()
    if (currentError) throw toReadableError(currentError, 'Nu am putut încărca comanda pentru editare.')

    const cantitate = round2(payload.cantitate_kg ?? Number(current.cantitate_kg ?? 0))
    const pret = round2(payload.pret_per_kg ?? Number(current.pret_per_kg ?? 0))
    ;(payload as any).total = round2(cantitate * pret)
  }

  const { data, error } = await (supabase as any)
    .from('comenzi')
    .update(payload)
    .eq('id', id)
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
  const supabase = getSupabase()
  
  // First, fetch the comanda to check if it has a linked vanzare
  const { data: comanda, error: fetchError } = await (supabase as any)
    .from('comenzi')
    .select('linked_vanzare_id, status')
    .eq('id', id)
    .single()
  
  if (fetchError) throw toReadableError(fetchError, 'Nu am putut încărca comanda pentru ștergere.')
  
  // If comanda has linked_vanzare_id or status='livrata', delete the linked vanzare first
  // This creates a cascade: comanda delete → vanzare delete → stock movements delete
  if (comanda.linked_vanzare_id || comanda.status === 'livrata') {
    if (comanda.linked_vanzare_id) {
      // deleteVanzare already handles deleting stock movements (miscari_stoc)
      await deleteVanzare(comanda.linked_vanzare_id)
    }
  }
  
  // Finally, delete the comanda
  const { error } = await (supabase as any).from('comenzi').delete().eq('id', id)
  if (error) throw toReadableError(error, 'Nu am putut sterge comanda.')
}

export async function deliverComanda(input: DeliverComandaInput): Promise<{
  deliveredOrder: Comanda
  vanzare: Vanzare
  remainingOrder: Comanda | null
  deductedStockKg: number
}> {
  const supabase = getSupabase()
  const { data: current, error: currentError } = await (supabase as any)
    .from('comenzi')
    .select('*')
    .eq('id', input.comandaId)
    .single()

  if (currentError) throw toReadableError(currentError, 'Nu am putut încărca comanda.')
  const currentQty = round2(Number(current.cantitate_kg ?? 0))
  const deliveredQty = round2(input.cantitateLivrataKg)

  if (!Number.isFinite(deliveredQty) || deliveredQty <= 0) {
    throw new Error('Cantitatea livrată trebuie sa fie mai mare decat 0.')
  }
  if (deliveredQty > currentQty) {
    throw new Error('Cantitatea livrată nu poate depasi cantitatea comandata.')
  }
  if (current.status === 'anulata') {
    throw new Error('Comanda anulata nu poate fi livrată.')
  }
  if (!current.tenant_id) {
    throw new Error('Comanda nu are tenant asociat. Nu putem finaliza livrarea.')
  }

  const today = new Date().toISOString().split('T')[0]
  const saleObservatii = [current.observatii, `Livrare comanda ${current.id}`].filter(Boolean).join(' | ')
  const vanzare = await createVanzare({
    tenant_id: current.tenant_id,
    data: today,
    client_id: current.client_id ?? undefined,
    comanda_id: current.id,
    cantitate_kg: deliveredQty,
    pret_lei_kg: Number(current.pret_per_kg ?? 0),
    status_plata: mapPlataToStatus(input.plata),
    observatii_ladite: saleObservatii,
  })

  const deductedStockKg = await applyStockOutflowForVanzare(vanzare.id, deliveredQty, current.tenant_id)

  const { data: deliveredData, error: deliveredError } = await (supabase as any)
    .from('comenzi')
    .update({
      status: 'livrata',
      linked_vanzare_id: vanzare.id,
      updated_at: new Date().toISOString(),
      observatii: [current.observatii, `Livrata: ${deliveredQty.toFixed(2)} kg`].filter(Boolean).join(' | '),
    })
    .eq('id', input.comandaId)
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

  if (deliveredError) throw toReadableError(deliveredError, 'Nu am putut actualiza comanda ca livrata.')

  let remainingOrder: Comanda | null = null
  const remainingQty = round2(currentQty - deliveredQty)
  if (remainingQty > 0) {
    const fallbackDate = new Date()
    fallbackDate.setDate(fallbackDate.getDate() + 1)
    const remainingDate = input.dataLivrareRamasa || fallbackDate.toISOString().split('T')[0]
    const today = new Date().toISOString().split('T')[0]

    const { data: remainingData, error: remainingError } = await (supabase as any)
      .from('comenzi')
      .insert({
        tenant_id: current.tenant_id,
        client_id: current.client_id,
        client_nume_manual: current.client_nume_manual,
        telefon: current.telefon,
        locatie_livrare: current.locatie_livrare,
        data_comanda: today,
        data_livrare: remainingDate,
        cantitate_kg: remainingQty,
        pret_per_kg: Number(current.pret_per_kg ?? 0),
        total: round2(remainingQty * Number(current.pret_per_kg ?? 0)),
        status: remainingDate > today ? 'programata' : 'confirmata',
        observatii: [current.observatii, `Rest din comanda ${current.id}`].filter(Boolean).join(' | '),
        parent_comanda_id: current.id,
      })
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

    if (remainingError) throw toReadableError(remainingError, 'Nu am putut crea comanda restanta.')
    remainingOrder = mapComanda(remainingData)
  }

  return {
    deliveredOrder: mapComanda(deliveredData),
    vanzare,
    remainingOrder,
    deductedStockKg,
  }
}

export async function reopenComanda(id: string): Promise<Comanda> {
  const supabase = getSupabase()
  const { data: current, error: currentError } = await (supabase as any)
    .from('comenzi')
    .select('*')
    .eq('id', id)
    .single()

  if (currentError) throw toReadableError(currentError, 'Nu am putut încărca comanda pentru redeschidere.')
  if (current.status !== 'livrata') throw new Error('Doar comenzile livrate pot fi redeschise.')

  if (current.linked_vanzare_id) {
    await deleteVanzare(current.linked_vanzare_id)
    await (supabase as any)
      .from('miscari_stoc')
      .delete()
      .eq('referinta_id', current.linked_vanzare_id)
      .eq('tip_miscare', 'vanzare')
  }

  const { data, error } = await (supabase as any)
    .from('comenzi')
    .update({
      status: 'confirmata',
      linked_vanzare_id: null,
      updated_at: new Date().toISOString(),
      observatii: [current.observatii, 'Comanda redeschisa'].filter(Boolean).join(' | '),
    })
    .eq('id', id)
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

  if (error) throw toReadableError(error, 'Nu am putut redeschide comanda.')
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
