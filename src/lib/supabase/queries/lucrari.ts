/**
 * Lucrări (fostele Activități agricole): citire, creare pe mai multe parcele, „Marchează făcut”, editare,
 * ștergere. Tabelul rămâne `activitati_agricole`; rândurile vechi nu se modifică (nici tipul).
 *
 * Coloanele `status` / `lot_id` (migrarea `20261121180000`) se trimit doar dacă există (`schema-features`).
 */
import { generateBusinessId } from '@/lib/supabase/business-ids'
import { getSupabase } from '@/lib/supabase/client'
import { loadSchemaFeaturesSafe } from '@/lib/schema-features'
import { getTenantId } from '@/lib/tenant/get-tenant'
import type { LucrareRow } from '@/lib/lucrari/jurnal'
import type { RandLucrareDeSalvat } from '@/lib/lucrari/formular'

type ErrorLike = { code?: string; message?: string; details?: string; hint?: string } | null

/** Clientul fără tipurile generate (coloanele noi nu sunt încă în `types/supabase` ca obligatorii). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (supabase: ReturnType<typeof getSupabase>, name: string) => (supabase as any).from(name)

const toError = (error: ErrorLike): Error =>
  Object.assign(new Error(error?.message || error?.details || 'Lucrarea nu s-a salvat.'), {
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  })

const COLOANE = 'id,id_activitate,client_sync_id,data_aplicare,parcela_id,tip_activitate,operator,observatii,produs_utilizat,doza,timp_pauza_zile,created_at,updated_at'

export type LucrareDb = LucrareRow & {
  id_activitate: string
  client_sync_id: string
  produs_utilizat: string | null
  doza: string | null
  timp_pauza_zile: number | null
  updated_at: string
}

/** Toate rândurile fermei (și tratamentele vechi; jurnalul le filtrează). */
export async function getLucrari(): Promise<LucrareDb[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { lucrariPlanificate } = await loadSchemaFeaturesSafe()
  const { data, error } = await table(supabase, 'activitati_agricole')
    .select(lucrariPlanificate ? `${COLOANE},status,lot_id` : COLOANE)
    .eq('tenant_id', tenantId)
    .order('data_aplicare', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw toError(error)
  return (data ?? []) as LucrareDb[]
}

const esteConflictCheie = (error: ErrorLike) =>
  error?.code === '23505' && `${error.message ?? ''} ${error.details ?? ''}`.includes('client_sync_id')

/**
 * Creează rândurile (unul pe parcelă). Idempotent: o cheie (`client_sync_id`) deja salvată nu se dublează
 * (23505 pe indexul cheii = rândul există, se socotește salvat).
 */
export async function creeazaLucrari(randuri: readonly RandLucrareDeSalvat[]): Promise<void> {
  if (randuri.length === 0) return
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id ?? null

  // Cele salvate deja (reîncercare după o eroare de rețea) se sar.
  const { data: existente, error: lookupError } = await table(supabase, 'activitati_agricole')
    .select('client_sync_id')
    .eq('tenant_id', tenantId)
    .in('client_sync_id', randuri.map((rand) => rand.client_sync_id))
  if (lookupError) throw toError(lookupError)
  const salvate = new Set(((existente ?? []) as Array<{ client_sync_id: string }>).map((row) => row.client_sync_id))

  for (const rand of randuri) {
    if (salvate.has(rand.client_sync_id)) continue
    const idActivitate = await generateBusinessId(supabase, 'AA')
    const { error } = await table(supabase, 'activitati_agricole').insert({
      ...rand,
      id_activitate: idActivitate,
      tenant_id: tenantId,
      sync_status: 'synced',
      created_by: userId,
      updated_by: userId,
    })
    if (error && !esteConflictCheie(error)) throw toError(error)
  }
}

/**
 * „Marchează făcut”: `data_aplicare` = acum și, după migrare, `status = 'facuta'`. Merge și pe lucrările vechi
 * cu dată în viitor (planificate înainte de migrare, fără stare).
 */
export async function marcheazaLucrariFacute(ids: readonly string[], now: Date = new Date()): Promise<void> {
  if (ids.length === 0) return
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { lucrariPlanificate } = await loadSchemaFeaturesSafe()
  const { data: userData } = await supabase.auth.getUser()
  const patch: Record<string, unknown> = { data_aplicare: now.toISOString(), updated_by: userData.user?.id ?? null }
  if (lucrariPlanificate) patch.status = 'facuta'
  const { error } = await table(supabase, 'activitati_agricole').update(patch).eq('tenant_id', tenantId).in('id', ids)
  if (error) throw toError(error)
}

export interface ModificareLucrare {
  /** Rândurile lucrării (unul pe parcelă). */
  randuri: ReadonlyArray<Pick<LucrareDb, 'id' | 'parcela_id'>>
  patch: { tip_activitate: string; operator: string | null; observatii: string | null; data_aplicare: string; status?: 'planificata' | null; lot_id?: string }
  /** Parcelele alese acum. Cele scoase se șterg (doar proprietarul poate), cele noi primesc rânduri. */
  parcelaIds: readonly string[]
  /** Rândurile noi (pentru parcelele adăugate), gata de inserat. */
  randuriNoi: readonly RandLucrareDeSalvat[]
}

export async function modificaLucrare(input: ModificareLucrare): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { lucrariPlanificate } = await loadSchemaFeaturesSafe()
  const { data: userData } = await supabase.auth.getUser()
  const alese = new Set(input.parcelaIds)
  const raman = input.randuri.filter((rand) => rand.parcela_id && alese.has(rand.parcela_id))
  const scoase = input.randuri.filter((rand) => !rand.parcela_id || !alese.has(rand.parcela_id))

  const patch: Record<string, unknown> = {
    tip_activitate: input.patch.tip_activitate,
    operator: input.patch.operator,
    observatii: input.patch.observatii,
    data_aplicare: input.patch.data_aplicare,
    updated_by: userData.user?.id ?? null,
    updated_at: new Date().toISOString(),
  }
  if (lucrariPlanificate && input.patch.status !== undefined) patch.status = input.patch.status
  if (lucrariPlanificate && input.patch.lot_id) patch.lot_id = input.patch.lot_id

  if (raman.length > 0) {
    const { error } = await table(supabase, 'activitati_agricole')
      .update(patch)
      .eq('tenant_id', tenantId)
      .in('id', raman.map((rand) => rand.id))
    if (error) throw toError(error)
  }
  await creeazaLucrari(input.randuriNoi)
  if (scoase.length > 0) await stergeLucrare(scoase.map((rand) => rand.id))
}

/** Șterge rândurile lucrării (RLS: doar proprietarul fermei). */
export async function stergeLucrare(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { error, count } = await table(supabase, 'activitati_agricole')
    .delete({ count: 'exact' })
    .eq('tenant_id', tenantId)
    .in('id', ids)
  if (error) throw toError(error)
  // RLS nu dă eroare la ștergere: doar nu șterge nimic.
  if (count === 0) throw Object.assign(new Error('Doar proprietarul fermei poate șterge lucrări.'), { code: '42501' })
}
