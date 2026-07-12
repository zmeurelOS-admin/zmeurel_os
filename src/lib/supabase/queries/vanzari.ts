// src/lib/supabase/queries/vanzari.ts
//
// Vânzările se creează EXCLUSIV prin livrarea unei comenzi (RPC set_comanda_delivered /
// set_shop_order_delivered). Calea manuală de creare/editare/ștergere de vânzări directe
// (create/update/delete_vanzare_with_stock) a fost retrasă din frontend în Faza 2 de
// unificare (2026-07-11): acele RPC-uri validau și scriau ledgerul vechi miscari_stoc,
// paralel cu disponibilul derivat. Pagina Vânzări rămâne registru read-only, cu excepția
// statusului de plată (update financiar direct, fără efect pe stoc).
import { getSupabase } from '../client'
import { getTenantId } from '@/lib/tenant/get-tenant'

export interface Vanzare {
  id: string
  id_vanzare: string
  client_sync_id: string
  data: string
  data_incasare: string | null
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

export type VanzareStatusPlataUpdate = 'platit' | 'restanta'

type SupabaseLikeError = {
  message?: string
  code?: string
  details?: string
  hint?: string
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

const selectWithComanda =
  'id,id_vanzare,data,data_incasare,client_id,comanda_id,cantitate_kg,pret_lei_kg,status_plata,observatii_ladite,created_at,updated_at,tenant_id'
const selectLegacy =
  'id,id_vanzare,data,data_incasare,client_id,cantitate_kg,pret_lei_kg,status_plata,observatii_ladite,created_at,updated_at,tenant_id'

export async function getVanzari(): Promise<Vanzare[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

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

/**
 * Schimbă doar statusul de plată al unei vânzări (operațiune pur financiară,
 * fără nicio atingere de stoc). Nu folosește update_vanzare_with_stock, care
 * scria în ledgerul vechi miscari_stoc și eșua pe vânzările create de
 * pipeline-ul derivat (fără mișcare de stoc asociată).
 */
export async function setVanzareStatusPlata(
  id: string,
  status: VanzareStatusPlataUpdate,
): Promise<Vanzare> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('vanzari')
    .update({
      status_plata: status,
      data_incasare: status === 'platit' ? today : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(selectWithComanda)
    .single()

  if (error) throw toReadableError(error, 'Nu am putut actualiza statusul plății.')
  return data as unknown as Vanzare
}
