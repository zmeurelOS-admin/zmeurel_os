/**
 * Ce coloane din migrările redesign-ului (`20261120090000_redesign_noapte.sql`,
 * `20261121140000_client_sync_id_…`, `20261121160000_tratamente_modul.sql`) există deja în baza de date.
 *
 * Migrarea o rulează Andrei, manual, după ce o aprobă. Până atunci codul trebuie să meargă fără ea:
 * - funcțiile care au nevoie de coloanele noi sunt ascunse sau doar pentru citire, cu o valoare de rezervă;
 * - coloanele noi NU se trimit niciodată în `select` / `insert` / `update` cât lipsesc (PostgREST respinge toată cererea).
 *
 * Verificarea se face o singură dată pe sesiune: câte un `select('<coloană>').limit(1)` pe grup.
 * Eroarea `42703` (Postgres) sau `PGRST204` (PostgREST) înseamnă „coloana lipsește”.
 */
import { useQuery } from '@tanstack/react-query'

import { getSupabase } from '@/lib/supabase/client'

export type SchemaFeature =
  | 'comenziPrioritara'
  | 'clientiLocatie'
  | 'vanzariPlataPartiala'
  | 'pretStandard'
  | 'acasaPerioada'
  | 'cheiIdempotenta'
  | 'tratamenteLot'

export type SchemaFeatures = Record<SchemaFeature, boolean>

/** Nimic din migrare nu există (starea dinaintea rulării și rezerva la orice eroare). */
export const NO_SCHEMA_FEATURES: SchemaFeatures = {
  comenziPrioritara: false,
  clientiLocatie: false,
  vanzariPlataPartiala: false,
  pretStandard: false,
  acasaPerioada: false,
  cheiIdempotenta: false,
  tratamenteLot: false,
}

/** O coloană reprezentativă pe grup: coloanele unui grup se adaugă împreună, în aceeași migrare. */
const PROBES: Record<SchemaFeature, { table: string; column: string }> = {
  comenziPrioritara: { table: 'comenzi', column: 'prioritara' },
  clientiLocatie: { table: 'clienti', column: 'locatie_salvata_la' },
  vanzariPlataPartiala: { table: 'vanzari', column: 'suma_incasata_partial_lei' },
  pretStandard: { table: 'tenant_settings', column: 'pret_standard_perioada' },
  acasaPerioada: { table: 'tenant_settings', column: 'acasa_perioada_mod' },
  // `client_sync_id` pe comenzi, clienti, culegatori, investitii vin împreună (20261121140000).
  cheiIdempotenta: { table: 'comenzi', column: 'client_sync_id' },
  // Modulul Tratamente (20261121160000): `aplicari_tratament.lot_id`, `aplicari_tratament_produse.rezervor` și
  // `doza_g_per_planta`, `parcele.volum_solutie_l` vin împreună.
  tratamenteLot: { table: 'aplicari_tratament', column: 'lot_id' },
}

const MISSING_COLUMN_CODES = new Set(['42703', 'PGRST204'])

type ProbeError = { code?: string; message?: string } | null

/** Coloana lipsește (și nu e o altă eroare: rețea, drepturi). */
export function isMissingColumnError(error: ProbeError): boolean {
  if (!error) return false
  if (error.code && MISSING_COLUMN_CODES.has(error.code)) return true
  return /column .* does not exist|could not find the .* column/i.test(error.message ?? '')
}

type ProbeClient = {
  from: (table: string) => {
    select: (columns: string) => { limit: (count: number) => PromiseLike<{ error: ProbeError }> }
  }
}

async function probe(client: ProbeClient, feature: SchemaFeature): Promise<boolean> {
  const { table, column } = PROBES[feature]
  const { error } = await client.from(table).select(column).limit(1)
  if (!error) return true
  if (isMissingColumnError(error)) return false
  // Altă eroare (rețea, sesiune): nu știm. Aruncăm, ca verificarea să se reia, nu să rămână „lipsește”.
  throw Object.assign(new Error(error.message || 'Nu am putut verifica structura bazei de date.'), { code: error.code })
}

/** Verifică toate grupurile. Exportată separat pentru teste. */
export async function probeSchemaFeatures(client: ProbeClient): Promise<SchemaFeatures> {
  const features = Object.keys(PROBES) as SchemaFeature[]
  const results = await Promise.all(features.map((feature) => probe(client, feature)))
  return Object.fromEntries(features.map((feature, index) => [feature, results[index]])) as SchemaFeatures
}

let cached: Promise<SchemaFeatures> | null = null

/**
 * Rezultatul verificării, ținut pe sesiune. Folosit de funcțiile de query (care nu pot apela hook-uri).
 * O verificare eșuată nu rămâne în memorie: următorul apel o reia.
 */
export function loadSchemaFeatures(): Promise<SchemaFeatures> {
  if (!cached) {
    const attempt = probeSchemaFeatures(getSupabase() as unknown as ProbeClient)
    cached = attempt
    attempt.catch(() => {
      if (cached === attempt) cached = null
    })
  }
  return cached
}

/** La fel, dar fără să arunce: la eroare, „nimic nu există” (nu trimitem coloane noi dacă nu suntem siguri). */
export async function loadSchemaFeaturesSafe(): Promise<SchemaFeatures> {
  try {
    return await loadSchemaFeatures()
  } catch {
    return NO_SCHEMA_FEATURES
  }
}

/** Doar pentru teste. */
export function resetSchemaFeaturesCache(): void {
  cached = null
}

export const schemaFeaturesQueryKey = ['schema-features'] as const

/**
 * Ce există din migrare, pentru componente. Cât nu se știe încă (sau la eroare), totul e `false`:
 * funcțiile noi apar abia după ce e sigur că baza de date le poate ține.
 */
export function useSchemaFeatures(): SchemaFeatures & { ready: boolean } {
  const { data, isSuccess } = useQuery({
    queryKey: schemaFeaturesQueryKey,
    queryFn: loadSchemaFeatures,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  })
  return { ...(data ?? NO_SCHEMA_FEATURES), ready: isSuccess }
}
