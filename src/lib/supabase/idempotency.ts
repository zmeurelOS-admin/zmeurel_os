/**
 * Cheia de idempotență (`client_sync_id`) la creare, pentru tabelele cu index unic parțial
 * `(tenant_id, client_sync_id)`: comenzi, clienti, culegatori, investitii (migrarea 20261121140000).
 *
 * Regula: formularul trimite aceeași cheie cât e deschis (și la reîncercare). Înainte de inserare se caută
 * rândul după cheie; dacă există, el e rezultatul. Un 23505 pe acest index (două cereri simultane) se
 * tratează ca reușită: se recitește rândul.
 */
import { loadSchemaFeaturesSafe } from '@/lib/schema-features'

type ErrorLike = { code?: string; message?: string; details?: string; constraint?: string } | null | undefined

/** 23505 pe indexul cheii de idempotență (nu pe alt index unic: id de business, telefon etc.). */
export function isClientSyncConflict(error: ErrorLike): boolean {
  if (!error || error.code !== '23505') return false
  const text = `${error.constraint ?? ''} ${error.message ?? ''} ${error.details ?? ''}`
  return text.includes('client_sync_id')
}

export type ClientSyncTable = 'comenzi' | 'clienti' | 'culegatori' | 'investitii'

type LookupClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => PromiseLike<{ data: unknown; error: ErrorLike }>
        }
      }
    }
  }
}

/** Cheia se trimite doar dacă există și dacă baza de date are coloana (altfel PostgREST respinge inserarea). */
export async function cheieDeTrimis(key: string | null | undefined): Promise<string | null> {
  if (!key) return null
  const { cheiIdempotenta } = await loadSchemaFeaturesSafe()
  return cheiIdempotenta ? key : null
}

/** Rândul deja salvat cu această cheie, în ferma curentă (`null` dacă nu există). */
export async function findByClientSyncId<T>(
  supabase: unknown,
  table: ClientSyncTable,
  tenantId: string,
  key: string,
  columns = '*',
): Promise<T | null> {
  const { data, error } = await (supabase as LookupClient)
    .from(table)
    .select(columns)
    .eq('tenant_id', tenantId)
    .eq('client_sync_id', key)
    .maybeSingle()
  if (error) throw Object.assign(new Error(error.message || 'Nu am putut verifica salvarea.'), error)
  return (data as T | null) ?? null
}
