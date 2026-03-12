import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { generateBusinessId } from '@/lib/supabase/business-ids'

export const AUTO_MANOPERA_CATEGORY = 'Manoper\u0103 cules'
export const AUTO_MANOPERA_DESCRIPTION_MARKER = '[AUTO_MANOPERA]'
export const AUTO_MANOPERA_SYNC_PREFIX = 'auto_manopera'

type SupabaseDbClient = SupabaseClient<Database>

type RecoltareForManopera = {
  culegator_id: string | null
  kg_cal1: number | null
  kg_cal2: number | null
  valoare_munca_lei: number | null
  pret_lei_pe_kg_snapshot: number | null
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

function normalizeDate(date: string): string {
  return String(date || '').slice(0, 10)
}

function formatDateRo(date: string): string {
  const normalized = normalizeDate(date)
  const parsed = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return normalized
  return parsed.toLocaleDateString('ro-RO')
}

export function buildAutoManoperaSyncId(tenantId: string, date: string): string {
  return `${AUTO_MANOPERA_SYNC_PREFIX}:${tenantId}:${normalizeDate(date)}`
}

export function isAutoManoperaCheltuiala(input: {
  client_sync_id?: string | null
  descriere?: string | null
}): boolean {
  const syncId = input.client_sync_id ?? ''
  const descriere = input.descriere ?? ''
  return syncId.startsWith(`${AUTO_MANOPERA_SYNC_PREFIX}:`) || descriere.startsWith(AUTO_MANOPERA_DESCRIPTION_MARKER)
}

export async function upsertManoperaCheltuiala(
  supabase: SupabaseDbClient,
  tenantId: string,
  date: string
): Promise<void> {
  const normalizedDate = normalizeDate(date)
  if (!tenantId || !normalizedDate) return

  const { data: recoltariRows, error: recoltariError } = await supabase
    .from('recoltari')
    .select('culegator_id,kg_cal1,kg_cal2,valoare_munca_lei,pret_lei_pe_kg_snapshot')
    .eq('tenant_id', tenantId)
    .eq('data', normalizedDate)

  if (recoltariError) throw recoltariError

  const recoltari = (recoltariRows ?? []) as RecoltareForManopera[]

  let totalKg = 0
  let totalPlata = 0
  const uniqueCulegatori = new Set<string>()

  for (const row of recoltari) {
    const kgCal1 = Number(row.kg_cal1 ?? 0)
    const kgCal2 = Number(row.kg_cal2 ?? 0)
    const totalKgRow = round2(kgCal1 + kgCal2)
    totalKg = round2(totalKg + totalKgRow)

    const plataRowStored = Number(row.valoare_munca_lei ?? 0)
    const tarifSnapshot = Number(row.pret_lei_pe_kg_snapshot ?? 0)
    const plataRow = plataRowStored > 0 ? plataRowStored : round2(totalKgRow * tarifSnapshot)
    totalPlata = round2(totalPlata + plataRow)

    if (row.culegator_id) uniqueCulegatori.add(row.culegator_id)
  }

  const { data: existing, error: existingError } = await supabase
    .from('cheltuieli_diverse')
    .select('id,client_sync_id')
    .eq('tenant_id', tenantId)
    .eq('data', normalizedDate)
    .eq('categorie', AUTO_MANOPERA_CATEGORY)
    .like('descriere', `${AUTO_MANOPERA_DESCRIPTION_MARKER}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) throw existingError

  if (totalPlata <= 0) {
    if (existing?.id) {
      const { error: deleteError } = await supabase
        .from('cheltuieli_diverse')
        .delete()
        .eq('id', existing.id)
      if (deleteError) throw deleteError
    }
    return
  }

  const descriere = `${AUTO_MANOPERA_DESCRIPTION_MARKER} Manoper\u0103 cules ${formatDateRo(normalizedDate)} - ${uniqueCulegatori.size} culeg\u0103tori, ${totalKg.toFixed(2)} kg total`
  const payload = {
    data: normalizedDate,
    categorie: AUTO_MANOPERA_CATEGORY,
    descriere,
    suma_lei: round2(totalPlata),
    client_sync_id: existing?.client_sync_id ?? crypto.randomUUID(),
    sync_status: 'synced',
    updated_at: new Date().toISOString(),
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('cheltuieli_diverse')
      .update(payload)
      .eq('id', existing.id)

    if (updateError) throw updateError
    return
  }

  const nextId = await generateBusinessId(supabase, 'CH')
  const { error: insertError } = await supabase
    .from('cheltuieli_diverse')
    .insert({
      tenant_id: tenantId,
      id_cheltuiala: nextId,
      ...payload,
    })

  if (insertError) throw insertError
}
