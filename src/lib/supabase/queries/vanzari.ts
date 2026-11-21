// src/lib/supabase/queries/vanzari.ts
//
// Vânzările se creează EXCLUSIV prin livrarea unei comenzi (RPC set_comanda_delivered /
// set_shop_order_delivered). Calea manuală de creare/editare/ștergere de vânzări directe
// (create/update/delete_vanzare_with_stock) a fost retrasă din frontend în Faza 2 de
// unificare (2026-07-11): acele RPC-uri validau și scriau ledgerul vechi miscari_stoc,
// paralel cu disponibilul derivat. Pagina Vânzări rămâne registru read-only, cu excepția
// statusului de plată (update financiar direct, fără efect pe stoc).
import { getSupabase } from '../client'
import { loadSchemaFeaturesSafe } from '@/lib/schema-features'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { ziuaInRomania } from '@/lib/utils/bucharest-date'

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
  /**
   * Cât a dat clientul dintr-o vânzare încă neîncasată și când. Lipsesc cât coloanele nu există
   * în baza de date (migrarea `20261120090000_redesign_noapte.sql`; vezi `lib/schema-features`).
   */
  suma_incasata_partial_lei?: number | null
  data_incasare_partiala?: string | null
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
const selectPlataPartiala = 'suma_incasata_partial_lei,data_incasare_partiala'
const selectLegacy =
  'id,id_vanzare,data,data_incasare,client_id,cantitate_kg,pret_lei_kg,status_plata,observatii_ladite,created_at,updated_at,tenant_id'

export async function getVanzari(): Promise<Vanzare[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  // Coloanele de plată parțială se cer doar dacă există: altfel PostgREST respinge tot `select`-ul.
  const { vanzariPlataPartiala } = await loadSchemaFeaturesSafe()

  const { data, error } = await supabase
    .from('vanzari')
    .select(vanzariPlataPartiala ? `${selectWithComanda},${selectPlataPartiala}` : selectWithComanda)
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

/** RPC-ul plăților adunate lipsește: migrarea `20261121120000_vanzari_plati_adunate.sql` nu e aplicată. */
function isMissingRpcError(error: SupabaseLikeError | null | undefined): boolean {
  return error?.code === 'PGRST202' || error?.code === '42883'
}

export interface AdaugaPlataInput {
  vanzareId: string
  /** Cât a dat acum (lei), > 0 și cel mult restul. */
  sumaLei: number
  /** Ziua plății, pe calendarul telefonului. */
  dataIso: string
  /**
   * Cheia plății: aceeași la reîncercare și la dublu-click, alta pentru plata următoare.
   * Baza de date nu adună de două ori o plată cu aceeași cheie.
   */
  plataId: string
}

/**
 * Adună o plată la ce a dat clientul până acum („A dat până acum: X lei · rest Y lei”). Adunarea e atomică,
 * în baza de date (RPC `adauga_plata_vanzare`). Când suma ajunge la total, vânzarea devine încasată la ziua
 * plății, iar venitul intră atunci, integral.
 */
export async function adaugaPlataVanzare(input: AdaugaPlataInput): Promise<Vanzare> {
  const suma = Math.round((Number(input.sumaLei) || 0) * 100) / 100
  if (!(suma > 0)) throw new Error('Suma primită trebuie să fie mai mare decât 0.')

  const supabase = getSupabase()
  const rpcClient = supabase as unknown as {
    rpc: (
      fn: 'adauga_plata_vanzare',
      args: { p_vanzare_id: string; p_suma_lei: number; p_data: string; p_plata_id: string },
    ) => Promise<{ data: Vanzare | null; error: SupabaseLikeError | null }>
  }
  const { data, error } = await rpcClient.rpc('adauga_plata_vanzare', {
    p_vanzare_id: input.vanzareId,
    p_suma_lei: suma,
    p_data: input.dataIso,
    p_plata_id: input.plataId,
  })

  if (isMissingRpcError(error)) {
    throw new Error('Plățile pe bucăți se activează după actualizarea bazei de date.')
  }
  if (error) throw toReadableError(error, 'Nu am putut nota suma primită.')
  if (!data) throw new Error('Nu am primit vânzarea actualizată de la baza de date.')
  return data
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
  /** Ziua încasării, pe calendarul telefonului. Fără ea: ziua de azi în România. */
  dataIncasareIso?: string,
): Promise<Vanzare> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const today = dataIncasareIso || ziuaInRomania()

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
