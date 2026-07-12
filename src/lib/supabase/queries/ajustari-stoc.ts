import { getSupabase } from '../client'
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
    },
  ) => Promise<{ data: AjustareStoc | null; error: SupabaseLikeError | null }>
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

  const { data, error } = await rpcClient.rpc('create_ajustare_stoc', {
    p_tip: input.tip,
    p_delta_kg: delta,
    p_motiv: input.motiv?.trim() || null,
    p_data: input.data || null,
  })

  if (error) throw toReadableError(error, 'Nu am putut salva ajustarea de stoc.')
  if (!data) throw new Error('Nu am primit ajustarea salvată de la baza de date.')
  return data
}

export async function getAjustariStoc(): Promise<AjustareStoc[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)

  const { data, error } = await supabase
    .from('ajustari_stoc')
    .select('id,tenant_id,data,delta_kg,tip,motiv,created_by,created_at')
    .eq('tenant_id', tenantId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw toReadableError(error, 'Nu am putut încărca istoricul ajustărilor.')
  return (data ?? []) as AjustareStoc[]
}
