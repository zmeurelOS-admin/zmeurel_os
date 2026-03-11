import { getSupabase } from '../client'
import type { TablesUpdate } from '@/types/supabase'
import { deleteMiscariStocByReference, insertMiscareStoc } from './miscari-stoc'
import { upsertManoperaCheltuiala } from './manopera-auto'

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

type RecoltareUpdate = TablesUpdate<'recoltari'>

type CulegatorTarifRow = {
  tarif_lei_kg: number | null
}

type RecoltareRpcClient = ReturnType<typeof getSupabase> & {
  rpc: (
    fn: 'create_recoltare_with_stock',
    args: {
      p_data: string
      p_parcela_id: string
      p_culegator_id: string
      p_kg_cal1: number
      p_kg_cal2: number
      p_observatii?: string | null
    }
  ) => Promise<{
    data: Parameters<typeof mapRecoltare>[0] | null
    error: { message?: string } | null
  }>
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

async function getCulegatorTarif(culegatorId: string): Promise<number> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('culegatori')
    .select('tarif_lei_kg')
    .eq('id', culegatorId)
    .single()

  if (error) throw error

  const tarif = Number((data as CulegatorTarifRow).tarif_lei_kg ?? 0)
  if (!Number.isFinite(tarif) || tarif <= 0) {
    throw new Error('Culegatorul nu are tarif setat in profil')
  }

  return round2(tarif)
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

export async function getRecoltari(): Promise<Recoltare[]> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('recoltari')
    .select(RECOLTARI_SELECT)
    .order('data', { ascending: false })

  if (error) {
    const message = (error.message || '').toLowerCase()
    if (message.includes('kg_cal1') || message.includes('schema cache') || message.includes('could not find')) {
      throw new Error('Coloana kg_cal1 lipseste din baza de date. Va rugam actualizati schema.')
    }
    throw error
  }

  return (data ?? []).map((row) => mapRecoltare(row as Parameters<typeof mapRecoltare>[0]))
}

async function replaceRecoltareMovements(params: {
  recoltareId: string
  tenantId?: string | null
  parcelaId?: string | null
  data: string
  kgCal1: number
  kgCal2: number
}) {
  const tenantId = params.tenantId ?? undefined
  const parcelaId = params.parcelaId

  if (!parcelaId) return

  await deleteMiscariStocByReference(params.recoltareId, 'recoltare')

  if (params.kgCal1 > 0) {
    await insertMiscareStoc({
      tenant_id: tenantId,
      locatie_id: parcelaId,
      produs: 'zmeura',
      calitate: 'cal1',
      depozit: 'fresh',
      tip_miscare: 'recoltare',
      cantitate_kg: params.kgCal1,
      referinta_id: params.recoltareId,
      data: params.data,
    })
  }

  if (params.kgCal2 > 0) {
    await insertMiscareStoc({
      tenant_id: tenantId,
      locatie_id: parcelaId,
      produs: 'zmeura',
      calitate: 'cal2',
      depozit: 'fresh',
      tip_miscare: 'recoltare',
      cantitate_kg: params.kgCal2,
      referinta_id: params.recoltareId,
      data: params.data,
    })
  }
}

function scheduleAutoManoperaSync(params: {
  supabase: ReturnType<typeof getSupabase>
  tenantId?: string | null
  dates: Array<string | null | undefined>
}) {
  const tenantId = params.tenantId ?? null
  if (!tenantId) return

  const uniqueDates = Array.from(new Set(params.dates.map((d) => String(d || '').slice(0, 10)).filter(Boolean)))
  if (!uniqueDates.length) return

  void Promise.all(uniqueDates.map((date) => upsertManoperaCheltuiala(params.supabase, tenantId, date))).catch((error) => {
    console.error('Auto manopera sync failed:', error)
  })
}

export async function createRecoltare(input: CreateRecoltareInput): Promise<Recoltare> {
  const supabase = getSupabase()
  const kg = computeKg(input)
  const rpcClient = supabase as RecoltareRpcClient
  const { data, error } = await rpcClient.rpc('create_recoltare_with_stock', {
    p_data: input.data,
    p_parcela_id: input.parcela_id,
    p_culegator_id: input.culegator_id,
    p_kg_cal1: kg.kgCal1,
    p_kg_cal2: kg.kgCal2,
    p_observatii: input.observatii ?? null,
  })

  if (error) {
    const message = (error.message || '').toLowerCase()
    if (message.includes('kg_cal1') || message.includes('schema cache') || message.includes('could not find')) {
      throw new Error('Coloana kg_cal1 lipseste din baza de date. Va rugam actualizati schema.')
    }
    throw error
  }

  if (!data) {
    throw new Error('Nu am primit recoltarea creata de la baza de date.')
  }

  const recoltare = mapRecoltare(data)

  scheduleAutoManoperaSync({
    supabase,
    tenantId: recoltare.tenant_id,
    dates: [recoltare.data],
  })

  return recoltare
}

export async function updateRecoltare(id: string, input: UpdateRecoltareInput): Promise<Recoltare> {
  const supabase = getSupabase()

  const { data: existing, error: existingError } = await supabase
    .from('recoltari')
    .select('id,culegator_id,kg_cal1,kg_cal2,data,tenant_id')
    .eq('id', id)
    .single()

  if (existingError) throw existingError

  const nextCulegatorId = input.culegator_id ?? existing.culegator_id
  if (!nextCulegatorId) {
    throw new Error('Culegatorul este obligatoriu')
  }

  const kg = computeKg({
    kg_cal1: input.kg_cal1 ?? existing.kg_cal1 ?? 0,
    kg_cal2: input.kg_cal2 ?? existing.kg_cal2 ?? 0,
  })

  const tarifSnapshot = await getCulegatorTarif(nextCulegatorId)
  const valoareMunca = round2(kg.totalKg * tarifSnapshot)

  const payload: RecoltareUpdate = {
    ...input,
    culegator_id: nextCulegatorId,
    kg_cal1: kg.kgCal1,
    kg_cal2: kg.kgCal2,
    pret_lei_pe_kg_snapshot: tarifSnapshot,
    valoare_munca_lei: valoareMunca,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('recoltari')
    .update(payload)
    .eq('id', id)
    .select(RECOLTARI_SELECT)
    .single()

  if (error) throw error

  const recoltare = mapRecoltare(data as Parameters<typeof mapRecoltare>[0])

  await replaceRecoltareMovements({
    recoltareId: recoltare.id,
    tenantId: recoltare.tenant_id,
    parcelaId: recoltare.parcela_id,
    data: recoltare.data,
    kgCal1: recoltare.kg_cal1,
    kgCal2: recoltare.kg_cal2,
  })

  scheduleAutoManoperaSync({
    supabase,
    tenantId: recoltare.tenant_id ?? existing.tenant_id,
    dates: [existing.data, recoltare.data],
  })

  return recoltare
}

export async function deleteRecoltare(id: string): Promise<void> {
  const supabase = getSupabase()
  const { data: existing } = await supabase
    .from('recoltari')
    .select('tenant_id,data')
    .eq('id', id)
    .maybeSingle()

  await deleteMiscariStocByReference(id, 'recoltare')

  const { error } = await supabase.from('recoltari').delete().eq('id', id)

  if (error) throw error

  scheduleAutoManoperaSync({
    supabase,
    tenantId: existing?.tenant_id ?? null,
    dates: [existing?.data ?? null],
  })
}
