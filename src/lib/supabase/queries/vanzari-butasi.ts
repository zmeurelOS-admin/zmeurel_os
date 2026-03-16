// src/lib/supabase/queries/vanzari-butasi.ts

import { getSupabase } from '../client'
import { getTenantId } from '@/lib/tenant/get-tenant'

export const VANZARE_BUTASI_STATUSES = ['noua', 'confirmata', 'pregatita', 'livrata', 'anulata'] as const

export type VanzareButasiStatus = (typeof VANZARE_BUTASI_STATUSES)[number]

export interface VanzareButasiItem {
  id: string
  tenant_id: string
  comanda_id: string
  soi: string
  cantitate: number
  pret_unitar: number
  subtotal: number
  created_at: string
}

export interface VanzareButasi {
  id: string
  id_vanzare_butasi: string
  data: string
  data_comanda: string
  data_livrare_estimata: string | null
  status: VanzareButasiStatus
  client_id: string | null
  client_nume_manual: string | null
  parcela_sursa_id: string | null
  adresa_livrare: string | null
  avans_suma: number
  avans_data: string | null
  total_lei: number
  observatii: string | null
  soi_butasi: string | null
  cantitate_butasi: number
  pret_unitar_lei: number
  created_at: string
  updated_at: string
  tenant_id: string | null
  items: VanzareButasiItem[]
}

export interface VanzareButasiItemInput {
  soi: string
  cantitate: number
  pret_unitar: number
}

export interface CreateVanzareButasiInput {
  data_comanda: string
  data_livrare_estimata?: string | null
  status?: VanzareButasiStatus
  client_id?: string | null
  parcela_sursa_id?: string | null
  adresa_livrare?: string | null
  observatii?: string | null
  avans_suma?: number
  avans_data?: string | null
  items: VanzareButasiItemInput[]
}

export interface UpdateVanzareButasiInput {
  data_comanda?: string
  data_livrare_estimata?: string | null
  status?: VanzareButasiStatus
  client_id?: string | null
  parcela_sursa_id?: string | null
  adresa_livrare?: string | null
  observatii?: string | null
  avans_suma?: number
  avans_data?: string | null
  items?: VanzareButasiItemInput[]
}

interface NormalizedItemsResult {
  items: Array<Pick<VanzareButasiItem, 'soi' | 'cantitate' | 'pret_unitar' | 'subtotal'>>
  totalLei: number
  totalCantitate: number
}

interface RawVanzareButasiRow {
  id: string
  id_vanzare_butasi: string
  data: string
  data_comanda: string
  data_livrare_estimata: string | null
  status: string
  client_id: string | null
  client_nume_manual: string | null
  parcela_sursa_id: string | null
  adresa_livrare: string | null
  avans_suma: number
  avans_data: string | null
  total_lei: number
  observatii: string | null
  soi_butasi: string | null
  cantitate_butasi: number
  pret_unitar_lei: number
  created_at: string
  updated_at: string
  tenant_id: string | null
  vanzari_butasi_items?: VanzareButasiItem[] | null
}

type SupabaseLikeError = {
  message?: string
  code?: string
  details?: string
  hint?: string
  error?: unknown
  cause?: unknown
  statusText?: string
}

function extractErrorParts(error: unknown): SupabaseLikeError {
  if (error instanceof Error) {
    const withCause = error as Error & { cause?: unknown }
    const causeParts = withCause.cause ? extractErrorParts(withCause.cause) : {}

    return {
      message: error.message || causeParts.message,
      code: causeParts.code,
      details: causeParts.details,
      hint: causeParts.hint,
      statusText: causeParts.statusText,
      error: causeParts.error,
      cause: withCause.cause,
    }
  }

  const e = (error ?? {}) as SupabaseLikeError
  if (e.error) {
    const nested = extractErrorParts(e.error)
    return {
      ...nested,
      message: e.message || nested.message,
      code: e.code || nested.code,
      details: e.details || nested.details,
      hint: e.hint || nested.hint,
      statusText: e.statusText || nested.statusText,
      error: e.error,
      cause: e.cause,
    }
  }

  if (e.cause) {
    const nested = extractErrorParts(e.cause)
    return {
      ...nested,
      message: e.message || nested.message,
      code: e.code || nested.code,
      details: e.details || nested.details,
      hint: e.hint || nested.hint,
      statusText: e.statusText || nested.statusText,
      error: e.error,
      cause: e.cause,
    }
  }

  return e
}

function isSchemaCacheMismatch(error: unknown): boolean {
  const e = extractErrorParts(error)
  const message = (e.message ?? '').toLowerCase()
  return (
    e?.code === 'PGRST204' ||
    e?.code === '42703' ||
    message.includes('schema cache') ||
    message.includes('could not find the')
  )
}

function toReadableError(error: unknown, fallbackMessage: string): Error & {
  code?: string
  details?: string
  hint?: string
  isSchemaCacheError?: boolean
} {
  const e = extractErrorParts(error)

  let serialized = ''
  if (!e.message && !e.details && !e.hint && error && typeof error === 'object') {
    try {
      serialized = JSON.stringify(error)
    } catch {
      serialized = ''
    }
  }

  const message =
    e?.message ||
    e?.details ||
    e?.hint ||
    e?.statusText ||
    serialized ||
    (error instanceof Error && error.message) ||
    fallbackMessage

  return Object.assign(new Error(message), {
    code: e?.code,
    details: e?.details,
    hint: e?.hint,
    isSchemaCacheError: isSchemaCacheMismatch(error),
  })
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100
}

function assertStatus(status: string): VanzareButasiStatus {
  if (!VANZARE_BUTASI_STATUSES.includes(status as VanzareButasiStatus)) {
    throw new Error('Status invalid pentru comanda de butași')
  }

  return status as VanzareButasiStatus
}

function normalizeItems(items: VanzareButasiItemInput[]): NormalizedItemsResult {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Comanda trebuie sa contina cel puțin un produs')
  }

  const normalized = items.map((item, index) => {
    const soi = item.soi?.trim()
    const cantitate = Number(item.cantitate)
    const pretUnitar = Number(item.pret_unitar)

    if (!soi) {
      throw new Error(`Soi invalid la linia ${index + 1}`)
    }

    if (!Number.isInteger(cantitate) || cantitate <= 0) {
      throw new Error(`Cantitate invalida la linia ${index + 1}`)
    }

    if (!Number.isFinite(pretUnitar) || pretUnitar <= 0) {
      throw new Error(`Pret invalid la linia ${index + 1}`)
    }

    return {
      soi,
      cantitate,
      pret_unitar: roundTo2(pretUnitar),
      subtotal: roundTo2(cantitate * pretUnitar),
    }
  })

  const totalLei = roundTo2(normalized.reduce((sum, item) => sum + item.subtotal, 0))
  const totalCantitate = normalized.reduce((sum, item) => sum + item.cantitate, 0)

  return { items: normalized, totalLei, totalCantitate }
}

function mapVanzareRow(row: RawVanzareButasiRow): VanzareButasi {
  return {
    ...row,
    status: assertStatus(row.status || 'noua'),
    items: row.vanzari_butasi_items ?? [],
  }
}

async function getVanzareButasiById(id: string): Promise<VanzareButasi> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('vanzari_butasi')
    .select(`
      id,
      id_vanzare_butasi,
      data,
      data_comanda,
      data_livrare_estimata,
      status,
      client_id,
      client_nume_manual,
      parcela_sursa_id,
      adresa_livrare,
      avans_suma,
      avans_data,
      total_lei,
      observatii,
      soi_butasi,
      cantitate_butasi,
      pret_unitar_lei,
      created_at,
      updated_at,
      tenant_id,
      vanzari_butasi_items (
        id,
        tenant_id,
        comanda_id,
        soi,
        cantitate,
        pret_unitar,
        subtotal,
        created_at
      )
    `)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error) throw toReadableError(error, 'Nu am putut încărca comanda de butasi.')

  return mapVanzareRow(data as unknown as RawVanzareButasiRow)
}

export async function getVanzariButasi(): Promise<VanzareButasi[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('vanzari_butasi')
    .select(`
      id,
      id_vanzare_butasi,
      data,
      data_comanda,
      data_livrare_estimata,
      status,
      client_id,
      client_nume_manual,
      parcela_sursa_id,
      adresa_livrare,
      avans_suma,
      avans_data,
      total_lei,
      observatii,
      soi_butasi,
      cantitate_butasi,
      pret_unitar_lei,
      created_at,
      updated_at,
      tenant_id,
      vanzari_butasi_items (
        id,
        tenant_id,
        comanda_id,
        soi,
        cantitate,
        pret_unitar,
        subtotal,
        created_at
      )
    `)
    .eq('tenant_id', tenantId)
    .order('data_comanda', { ascending: false })

  if (error) throw toReadableError(error, 'Nu am putut încărca comenzile de butasi.')

  return (data ?? []).map((row) => mapVanzareRow(row as unknown as RawVanzareButasiRow))
}

export async function createVanzareButasi(input: CreateVanzareButasiInput): Promise<VanzareButasi> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const normalized = normalizeItems(input.items)
  const avansSuma = roundTo2(Number(input.avans_suma ?? 0))

  if (!Number.isFinite(avansSuma) || avansSuma < 0) {
    throw new Error('Avansul trebuie sa fie un numar pozitiv')
  }

  const status = assertStatus(input.status ?? 'noua')
  const firstItem = normalized.items[0]

  const insertPayload = {
    tenant_id: tenantId,
    data: input.data_comanda,
    data_comanda: input.data_comanda,
    data_livrare_estimata: input.data_livrare_estimata || null,
    status,
    client_id: input.client_id || null,
    parcela_sursa_id: input.parcela_sursa_id || null,
    adresa_livrare: input.adresa_livrare?.trim() || null,
    observatii: input.observatii?.trim() || null,
    avans_suma: avansSuma,
    avans_data: input.avans_data || null,
    total_lei: normalized.totalLei,
    soi_butasi: firstItem?.soi ?? null,
    cantitate_butasi: normalized.totalCantitate,
    pret_unitar_lei: roundTo2(normalized.totalLei / normalized.totalCantitate),
  }
  console.log('[DEBUG] createVanzareButasi payload:', insertPayload)

  const { data, error } = await supabase
    .from('vanzari_butasi')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error) {
    console.error('[DEBUG] createVanzareButasi main insert error:', error)
    throw toReadableError(error, 'Nu am putut salva comanda de butasi.')
  }

  const comandaId = data.id
  const itemsPayload = normalized.items.map((item) => ({
    tenant_id: tenantId,
    comanda_id: comandaId,
    soi: item.soi,
    cantitate: item.cantitate,
    pret_unitar: item.pret_unitar,
    subtotal: item.subtotal,
  }))

  const { error: itemsError } = await supabase.from('vanzari_butasi_items').insert(itemsPayload)

  if (itemsError) {
    console.error('[DEBUG] createVanzareButasi items insert error:', itemsError)
    await supabase.from('vanzari_butasi').delete().eq('id', comandaId).eq('tenant_id', tenantId)
    throw toReadableError(itemsError, 'Nu am putut salva produsele comenzii de butasi.')
  }

  return getVanzareButasiById(comandaId)
}

export async function updateVanzareButasi(id: string, input: UpdateVanzareButasiInput): Promise<VanzareButasi> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data: existing, error: existingError } = await supabase
    .from('vanzari_butasi')
    .select('id,status,total_lei,avans_suma,cantitate_butasi,tenant_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (existingError) throw toReadableError(existingError, 'Nu am putut încărca comanda pentru editare.')

  const currentStatus = assertStatus(existing.status)

  if (currentStatus === 'anulata' && Array.isArray(input.items)) {
    throw new Error('Produsele nu pot fi editate pentru comenzile anulate')
  }

  const status = input.status ? assertStatus(input.status) : currentStatus
  const hasItemsUpdate = Array.isArray(input.items)

  let computedTotal = Number(existing.total_lei)
  let computedCantitate = Number(existing.cantitate_butasi)
  let firstItemSoi: string | null = null
  let computedPretUnitar = computedCantitate > 0 ? roundTo2(computedTotal / computedCantitate) : 0
  let normalizedItems: NormalizedItemsResult | null = null

  if (hasItemsUpdate) {
    normalizedItems = normalizeItems(input.items as VanzareButasiItemInput[])
    computedTotal = normalizedItems.totalLei
    computedCantitate = normalizedItems.totalCantitate
    firstItemSoi = normalizedItems.items[0]?.soi ?? null
    computedPretUnitar = roundTo2(computedTotal / computedCantitate)
  }

  const avansSuma = input.avans_suma !== undefined ? roundTo2(Number(input.avans_suma)) : Number(existing.avans_suma)

  if (!Number.isFinite(avansSuma) || avansSuma < 0) {
    throw new Error('Avansul trebuie sa fie un numar pozitiv')
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    status,
    total_lei: computedTotal,
    avans_suma: avansSuma,
  }

  if (input.data_comanda !== undefined) {
    payload.data = input.data_comanda
    payload.data_comanda = input.data_comanda
  }
  if (input.data_livrare_estimata !== undefined) payload.data_livrare_estimata = input.data_livrare_estimata || null
  if (input.client_id !== undefined) payload.client_id = input.client_id || null
  if (input.parcela_sursa_id !== undefined) payload.parcela_sursa_id = input.parcela_sursa_id || null
  if (input.adresa_livrare !== undefined) payload.adresa_livrare = input.adresa_livrare?.trim() || null
  if (input.observatii !== undefined) payload.observatii = input.observatii?.trim() || null
  if (input.avans_data !== undefined) payload.avans_data = input.avans_data || null

  if (hasItemsUpdate) {
    payload.soi_butasi = firstItemSoi
    payload.cantitate_butasi = computedCantitate
    payload.pret_unitar_lei = computedPretUnitar
  }

  const { error: updateError } = await supabase
    .from('vanzari_butasi')
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (updateError) throw toReadableError(updateError, 'Nu am putut actualiza comanda de butasi.')

  if (hasItemsUpdate && normalizedItems) {
    const { error: deleteError } = await supabase
      .from('vanzari_butasi_items')
      .delete()
      .eq('comanda_id', id)
      .eq('tenant_id', tenantId)

    if (deleteError) throw toReadableError(deleteError, 'Nu am putut actualiza liniile comenzii de butasi.')

    const itemRows = normalizedItems.items.map((item) => ({
      tenant_id: tenantId,
      comanda_id: id,
      soi: item.soi,
      cantitate: item.cantitate,
      pret_unitar: item.pret_unitar,
      subtotal: item.subtotal,
    }))

    const { error: insertError } = await supabase
      .from('vanzari_butasi_items')
      .insert(itemRows)

    if (insertError) throw toReadableError(insertError, 'Nu am putut salva liniile comenzii de butasi.')
  }

  return getVanzareButasiById(id)
}

export async function deleteVanzareButasi(id: string): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { error } = await supabase
    .from('vanzari_butasi')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) throw toReadableError(error, 'Nu am putut sterge comanda de butasi.')
}
