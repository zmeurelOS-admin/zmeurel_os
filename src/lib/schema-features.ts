/**
 * Ce coloane din migrările redesign-ului (`20261120090000_redesign_noapte.sql`,
 * `20261121140000_client_sync_id_…`, `20261121160000_tratamente_modul.sql`, `20261121180000_lucrari_planificate.sql`)
 * există deja în baza de date.
 *
 * Migrarea o rulează Andrei, manual, după ce o aprobă. Până atunci codul trebuie să meargă fără ea:
 * - funcțiile care au nevoie de coloanele noi sunt ascunse sau doar pentru citire, cu o valoare de rezervă;
 * - coloanele noi NU se trimit niciodată în `select` / `insert` / `update` cât lipsesc (PostgREST respinge toată cererea).
 *
 * Verificarea se face o singură dată pe sesiune: câte un `select('<coloană>').limit(1)` pe grup.
 * Eroarea `42703` (Postgres) sau `PGRST204` (PostgREST) înseamnă „coloana lipsește”.
 *
 * Un grup găsit o dată rămâne ținut minte în browser (`localStorage`): o coloană adăugată nu mai dispare, deci
 * nu are rost să fie căutată la fiecare deschidere a aplicației (erau 8 cereri pe Acasă). Se mai verifică doar
 * grupurile care încă lipsesc. Structura e a bazei de date, nu a fermei: nu depinde de cont.
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
  | 'lucrariPlanificate'

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
  lucrariPlanificate: false,
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
  // Lucrări (20261121180000): `activitati_agricole.status` și `lot_id` vin împreună.
  lucrariPlanificate: { table: 'activitati_agricole', column: 'status' },
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

const ALL_FEATURES = Object.keys(PROBES) as SchemaFeature[]

type CombinedProbeClient = {
  from: (table: string) => {
    select: (columns: string) => CombinedProbeQuery
  }
}
type CombinedProbeQuery = PromiseLike<{ error: ProbeError }> & {
  limit: (count: number, options?: { referencedTable?: string }) => CombinedProbeQuery
}

/**
 * Toate grupurile cerute, într-o singură cerere: tabelele probate au fiecare o singură legătură spre `tenants`,
 * deci coloanele lor se pot cere „îmbrăcate” în `tenants` (cel mult un rând din fiecare). Dacă cererea trece,
 * toate coloanele există. `false` = nu știm (o coloană lipsește sau cererea n-a mers): se verifică pe rând.
 */
async function probeTogether(client: ProbeClient, features: readonly SchemaFeature[]): Promise<boolean> {
  const columnsByTable = new Map<string, string[]>()
  for (const feature of features) {
    const { table, column } = PROBES[feature]
    columnsByTable.set(table, [...(columnsByTable.get(table) ?? []), column])
  }
  try {
    const select = ['id', ...[...columnsByTable].map(([table, columns]) => `${table}(${columns.join(',')})`)].join(',')
    let query = (client as unknown as CombinedProbeClient).from('tenants').select(select).limit(1)
    for (const table of columnsByTable.keys()) query = query.limit(1, { referencedTable: table })
    const { error } = await query
    return !error
  } catch {
    return false
  }
}

/**
 * Verifică grupurile (toate, sau doar cele din `only`; restul sunt socotite existente, fără cerere).
 * Exportată separat pentru teste.
 */
export async function probeSchemaFeatures(client: ProbeClient, only?: readonly SchemaFeature[]): Promise<SchemaFeatures> {
  const features = only ?? ALL_FEATURES
  const results = await Promise.all(features.map((feature) => probe(client, feature)))
  const found = Object.fromEntries(ALL_FEATURES.map((feature) => [feature, true])) as SchemaFeatures
  features.forEach((feature, index) => {
    found[feature] = results[index]
  })
  return found
}

// ─── Ce s-a găsit deja, ținut minte în browser ───

const STORAGE_KEY = `zmeurel:schema-features:${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}`

/** Grupurile găsite la o verificare anterioară (doar cele existente; `[]` fără `localStorage` sau la orice eroare). */
function readKnownFeatures(): SchemaFeature[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return ALL_FEATURES.filter((feature) => parsed.includes(feature))
  } catch {
    return []
  }
}

function rememberFeatures(features: SchemaFeatures): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ALL_FEATURES.filter((feature) => features[feature])))
  } catch {
    // Fără loc sau fără acces la `localStorage`: se verifică din nou data viitoare.
  }
}

/** Pentru verificarea fără niciun grup de căutat: nu se ajunge niciodată la el. */
const NO_PROBE_CLIENT: ProbeClient = {
  from: () => {
    throw new Error('Nicio verificare de făcut.')
  },
}

let cached: Promise<SchemaFeatures> | null = null

/**
 * Rezultatul verificării, ținut pe sesiune. Folosit de funcțiile de query (care nu pot apela hook-uri).
 * O verificare eșuată nu rămâne în memorie: următorul apel o reia.
 */
export function loadSchemaFeatures(): Promise<SchemaFeatures> {
  if (!cached) {
    const known = readKnownFeatures()
    const missing = ALL_FEATURES.filter((feature) => !known.includes(feature))
    // Totul e deja știut ca existent: nicio cerere. Altfel, întâi o singură cerere pentru tot ce lipsește;
    // doar dacă ea nu trece se verifică grupurile pe rând (ca să aflăm care anume lipsește).
    const attempt =
      missing.length === 0
        ? probeSchemaFeatures(NO_PROBE_CLIENT, missing)
        : (async () => {
            const client = getSupabase() as unknown as ProbeClient
            const allThere = missing.length > 1 && (await probeTogether(client, missing))
            return allThere ? probeSchemaFeatures(NO_PROBE_CLIENT, []) : probeSchemaFeatures(client, missing)
          })()
    cached = attempt
    attempt.then(rememberFeatures, () => {
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

/** Doar pentru teste: uită și ce e ținut minte în browser. */
export function resetSchemaFeaturesCache(): void {
  cached = null
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Fără acces la `localStorage`: nu e nimic de uitat.
  }
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
