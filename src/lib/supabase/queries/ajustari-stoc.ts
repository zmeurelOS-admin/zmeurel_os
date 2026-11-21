import { getSupabase } from '../client'
import { isClientSyncConflict } from '@/lib/supabase/idempotency'
import { getTenantId } from '@/lib/tenant/get-tenant'
import type { Tables } from '@/types/supabase'

export type AjustareStoc = Tables<'ajustari_stoc'>

export const AJUSTARE_STOC_TIPURI = [
  'congelat',
  'procesat',
  'pierdere',
  'consum_propriu',
  'corectie_plus',
  'corectie_minus',
  'altul',
] as const

export type AjustareStocTip = (typeof AJUSTARE_STOC_TIPURI)[number]

export const AJUSTARE_STOC_TIP_LABELS: Record<AjustareStocTip, string> = {
  congelat: 'Congelat',
  procesat: 'Procesat',
  pierdere: 'Pierdere',
  consum_propriu: 'Consum propriu',
  corectie_plus: 'Corecție (+)',
  corectie_minus: 'Corecție (−)',
  altul: 'Altul',
}

export interface CreateAjustareStocInput {
  tip: AjustareStocTip
  /** Cantitate pozitivă introdusă de utilizator; semnul se derivă din tip. */
  cantitateKg: number
  motiv?: string | null
  data?: string | null
  /** Cheia de idempotență a formularului (aceeași la reîncercare): o cheie deja salvată nu mai face altă ajustare. */
  clientSyncId?: string | null
}

type SupabaseLikeError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

type AjustariRpcClient = ReturnType<typeof getSupabase> & {
  rpc: (
    fn: 'create_ajustare_stoc',
    args: {
      p_tip: AjustareStocTip
      p_delta_kg: number
      p_motiv: string | null
      p_data: string | null
      p_client_sync_id?: string
    },
  ) => Promise<{ data: AjustareStoc | null; error: SupabaseLikeError | null }>
}

const AJUSTARE_COLUMNS = 'id,tenant_id,data,delta_kg,tip,motiv,created_by,created_at'

/**
 * Are RPC-ul parametrul `p_client_sync_id` (migrarea `20261121190000_ajustari_stoc_client_sync_id.sql`)?
 * `null` = încă nu știm. Aflăm din primul apel: PostgREST răspunde `PGRST202` când funcția nu are parametrul,
 * iar atunci cererea se reia fără cheie (ca înainte de migrare). Fără o cerere de probă în plus.
 */
let rpcAreCheie: boolean | null = null

/** Doar pentru teste. */
export function resetAjustariStocCheieCache(): void {
  rpcAreCheie = null
}

/** Funcția nu există cu acești parametri (migrarea cu cheia nu e aplicată). */
function isMissingRpcParam(error: SupabaseLikeError | null): boolean {
  if (!error) return false
  return error.code === 'PGRST202' || /could not find the function/i.test(error.message ?? '')
}

async function findAjustareByKey(key: string): Promise<AjustareStoc | null> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data, error } = await supabase
    .from('ajustari_stoc')
    .select(AJUSTARE_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('client_sync_id', key)
    .maybeSingle()
  if (error) throw toReadableError(error, 'Nu am putut verifica ajustarea salvată.')
  return (data as AjustareStoc | null) ?? null
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

function toReadableError(error: unknown, fallbackMessage: string): Error {
  const e = (error ?? {}) as SupabaseLikeError
  let message = e.message || e.details || e.hint || fallbackMessage

  if (e.message === 'STOC_INSUFICIENT') {
    const match = /necesar=([\d.]+);disponibil=([\d.]+)/.exec(e.details ?? '')
    message = match
      ? `Stoc insuficient: ai doar ${match[2]} kg disponibili, ajustarea cere ${match[1]} kg.`
      : 'Stoc insuficient pentru această ajustare.'
  }

  return Object.assign(new Error(message), {
    code: e.code,
    details: e.details,
    hint: e.hint,
  })
}

/**
 * Creează o ajustare de stoc prin RPC-ul `create_ajustare_stoc` (singura cale de
 * scriere în `ajustari_stoc` — INSERT-ul direct este revocat prin RLS).
 * Tipurile de scădere primesc automat delta negativ; `corectie_plus` rămâne pozitiv.
 */
export async function createAjustareStoc(input: CreateAjustareStocInput): Promise<AjustareStoc> {
  const supabase = getSupabase()
  const cantitate = round2(Math.abs(Number(input.cantitateKg) || 0))

  if (cantitate <= 0) {
    throw new Error('Cantitatea trebuie să fie mai mare decât 0.')
  }

  const delta = input.tip === 'corectie_plus' ? cantitate : -cantitate
  const rpcClient = supabase as AjustariRpcClient
  const args = {
    p_tip: input.tip,
    p_delta_kg: delta,
    p_motiv: input.motiv?.trim() || null,
    p_data: input.data || null,
  }
  const key = input.clientSyncId || null

  let result: { data: AjustareStoc | null; error: SupabaseLikeError | null }
  if (key && rpcAreCheie !== false) {
    result = await rpcClient.rpc('create_ajustare_stoc', { ...args, p_client_sync_id: key })
    if (isMissingRpcParam(result.error)) {
      // Migrarea cu cheia nu e aplicată: aceeași salvare, fără cheie.
      rpcAreCheie = false
      result = await rpcClient.rpc('create_ajustare_stoc', args)
    } else if (!result.error) {
      rpcAreCheie = true
    }
  } else {
    result = await rpcClient.rpc('create_ajustare_stoc', args)
  }

  // Două cereri simultane cu aceeași cheie: rândul există deja, îl recitim (reușită, nu eroare).
  if (result.error && key && isClientSyncConflict(result.error)) {
    const existing = await findAjustareByKey(key)
    if (existing) return existing
  }

  if (result.error) throw toReadableError(result.error, 'Nu am putut salva ajustarea de stoc.')
  if (!result.data) throw new Error('Nu am primit ajustarea salvată de la baza de date.')
  return result.data
}

export async function getAjustariStoc(): Promise<AjustareStoc[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('ajustari_stoc')
    .select(AJUSTARE_COLUMNS)
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw toReadableError(error, 'Nu am putut încărca istoricul ajustărilor.')
  return (data ?? []) as AjustareStoc[]
}
