/**
 * Analizele la fructe în demo-urile noi „Fructe de pădure” (promptul 26):
 *   - o analiză conformă pe 2 parcele (Maravilla + Delniwa Nord), prelevată în vara anului curent, cu 2 substanțe
 *     (exemple, nu date reale) și linkul public activ;
 *   - o dată de început al culesului pe fiecare parcelă de vânzare, pentru sezonul curent.
 *
 * Rulează doar la crearea unui demo nou (seed), cu service role. Tabelele vin din migrările 20261122110000 /
 * 20261122111000: fără ele nu scrie nimic și nu oprește demo-ul. Datele existente nu se ating.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

type Admin = SupabaseClient<Database>
type Err = { code?: string; message?: string } | null
type Loose = {
  from: (table: string) => {
    select: (columns: string) => { limit: (n: number) => PromiseLike<{ data: unknown; error: Err }> }
    insert: (rows: unknown) => { select: (columns: string) => PromiseLike<{ data: unknown; error: Err }> } & PromiseLike<{ error: Err }>
    upsert: (rows: unknown, options: { onConflict: string }) => PromiseLike<{ error: Err }>
  }
}

/** Textele puse doar de seed (după ele se recunoaște analiza demo; tabelul n-are `data_origin`). */
export const DEMO_ANALIZA_NOTA = 'Demo: 1 kg din fiecare parcelă.'
export const DEMO_ANALIZA_CE_S_A_ANALIZAT = 'Multireziduu pesticide (exemplu)'

export type DemoParcelaAnaliza = { id: string; nume_parcela: string | null; rol?: string | null }

export interface DemoAnalizeResult {
  analize: number
  dateCules: number
  error: string | null
}

const lipsa = (error: Err) =>
  Boolean(
    error &&
      (['42P01', 'PGRST205', '42703', 'PGRST204'].includes(error.code ?? '') ||
        /does not exist|could not find the/i.test(error.message ?? '')),
  )

/** Începutul culesului pe parcelă (exemplu): Maravilla 22 iunie, Delniwa 1 iulie, restul 10 iulie. */
export function dataCulesDemo(nume: string | null, an: number): string {
  const n = (nume ?? '').toLocaleLowerCase('ro-RO')
  if (n.includes('maravilla')) return `${an}-06-22`
  if (n.includes('delniwa')) return `${an}-07-01`
  return `${an}-07-10`
}

export async function seedDemoAnalize(supabaseAdmin: Admin, tenantId: string, parcele: readonly DemoParcelaAnaliza[], an: number): Promise<DemoAnalizeResult> {
  const db = supabaseAdmin as unknown as Loose
  const deVanzare = parcele.filter((parcela) => (parcela.rol ?? 'comercial') !== 'personal')
  let dateCules = 0
  let analize = 0

  // Data culesului pe fiecare parcelă de vânzare (sezonul curent).
  if (deVanzare.length > 0) {
    const { error } = await db.from('configurari_parcela_sezon').upsert(
      deVanzare.map((parcela) => ({ tenant_id: tenantId, parcela_id: parcela.id, an, data_inceput_cules: dataCulesDemo(parcela.nume_parcela, an) })),
      { onConflict: 'parcela_id,an' },
    )
    if (error && !lipsa(error)) return { analize, dateCules, error: error.message ?? 'configurari_parcela_sezon' }
    if (!error) dateCules = deVanzare.length
  }

  const byName = (fragment: string) => deVanzare.find((parcela) => (parcela.nume_parcela ?? '').includes(fragment))
  const alese = [byName('Maravilla'), byName('Delniwa Nord') ?? byName('Delniwa')].filter((p): p is DemoParcelaAnaliza => Boolean(p))
  if (alese.length === 0) return { analize, dateCules, error: null }

  const inserted = await db
    .from('analize_fructe')
    .insert({
      tenant_id: tenantId,
      client_sync_id: crypto.randomUUID(),
      data_prelevare: `${an}-07-03`,
      pv_numar: '1180',
      prelevat_de: 'dsvsa',
      laborator: 'LSVSA Suceava',
      data_predare: `${an}-07-03`,
      nota: DEMO_ANALIZA_NOTA,
      status: 'conform',
      buletin_numar: '4415',
      buletin_data: `${an}-07-12`,
      ce_s_a_analizat: DEMO_ANALIZA_CE_S_A_ANALIZAT,
      rest_nedetectate: true,
      public_activ: true,
    })
    .select('id')
  if (inserted.error) {
    if (lipsa(inserted.error)) return { analize, dateCules, error: null }
    return { analize, dateCules, error: inserted.error.message ?? 'analize_fructe' }
  }
  const analizaId = ((inserted.data ?? []) as Array<{ id: string }>)[0]?.id
  if (!analizaId) return { analize, dateCules, error: 'analize_fructe: fără id' }
  analize = 1

  const parceleRes = await db.from('analize_fructe_parcele').insert(alese.map((parcela) => ({ analiza_id: analizaId, parcela_id: parcela.id, tenant_id: tenantId })))
  if (parceleRes.error) return { analize, dateCules, error: parceleRes.error.message ?? 'analize_fructe_parcele' }

  const substanteRes = await db.from('analize_fructe_substante').insert([
    { analiza_id: analizaId, tenant_id: tenantId, substanta: 'Ciprodinil (exemplu)', valoare_mg_kg: 0.08, lmr_mg_kg: 10, ordine: 0 },
    { analiza_id: analizaId, tenant_id: tenantId, substanta: 'Fludioxonil (exemplu)', valoare_mg_kg: 0.05, lmr_mg_kg: 5, ordine: 1 },
  ])
  if (substanteRes.error) return { analize, dateCules, error: substanteRes.error.message ?? 'analize_fructe_substante' }

  return { analize, dateCules, error: null }
}

// ─── Ștergerea la reîncărcarea / golirea demo-ului ────────────────────────────────────────────────

export type AnalizaPentruStergereDemo = {
  id: string
  nota: string | null
  ce_s_a_analizat: string | null
  pv_poza_path: string | null
  buletin_path: string | null
}

/**
 * Analizele demo care pleacă odată cu parcelele demo. O analiză se șterge doar dacă:
 *   - are textele puse de seed (`DEMO_ANALIZA_NOTA` sau `DEMO_ANALIZA_CE_S_A_ANALIZAT`), adică e marcată ca demo;
 *   - și toate parcelele ei sunt parcele demo care se șterg acum (sau nu mai are nicio parcelă: rămasă de la o
 *     reîncărcare veche, când legăturile au plecat în cascadă cu parcelele).
 * O analiză a omului (alte texte) sau una legată și de o parcelă reală nu se atinge.
 */
export function analizeDemoDeSters(
  analize: readonly AnalizaPentruStergereDemo[],
  legaturi: ReadonlyArray<{ analiza_id: string; parcela_id: string }>,
  parceleDemo: ReadonlySet<string>,
): AnalizaPentruStergereDemo[] {
  const parcelePeAnaliza = new Map<string, string[]>()
  for (const legatura of legaturi) {
    const lista = parcelePeAnaliza.get(legatura.analiza_id) ?? []
    lista.push(legatura.parcela_id)
    parcelePeAnaliza.set(legatura.analiza_id, lista)
  }
  return analize.filter((analiza) => {
    const marcata = analiza.nota === DEMO_ANALIZA_NOTA || analiza.ce_s_a_analizat === DEMO_ANALIZA_CE_S_A_ANALIZAT
    if (!marcata) return false
    return (parcelePeAnaliza.get(analiza.id) ?? []).every((parcelaId) => parceleDemo.has(parcelaId))
  })
}

type LooseDelete = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => PromiseLike<{ data: unknown; error: Err }> & {
        in: (column: string, values: string[]) => PromiseLike<{ data: unknown; error: Err }>
      }
    }
    delete: () => { eq: (column: string, value: string) => { in: (column: string, values: string[]) => PromiseLike<{ error: Err }> } }
  }
  storage: { from: (bucket: string) => { remove: (paths: string[]) => PromiseLike<{ error: Err }> } }
}

/**
 * Șterge analizele demo ale fermei (cu parcelele și substanțele lor, în cascadă) înainte de parcelele demo.
 * Doar rândurile alese de `analizeDemoDeSters`. Fără tabelele analizelor nu face nimic. Întoarce câte a șters.
 */
export async function deleteDemoAnalize(supabaseAdmin: Admin, tenantId: string, parceleDemo: readonly string[]): Promise<number> {
  const db = supabaseAdmin as unknown as LooseDelete
  const analizeRes = await db.from('analize_fructe').select('id,nota,ce_s_a_analizat,pv_poza_path,buletin_path').eq('tenant_id', tenantId)
  if (analizeRes.error) {
    if (lipsa(analizeRes.error)) return 0
    throw new Error(`Read failed for analize_fructe: ${analizeRes.error.message ?? 'Unknown error'}`)
  }
  const analize = (analizeRes.data ?? []) as AnalizaPentruStergereDemo[]
  const candidate = analize.filter((a) => a.nota === DEMO_ANALIZA_NOTA || a.ce_s_a_analizat === DEMO_ANALIZA_CE_S_A_ANALIZAT)
  if (candidate.length === 0) return 0

  const legaturiRes = await db
    .from('analize_fructe_parcele')
    .select('analiza_id,parcela_id')
    .eq('tenant_id', tenantId)
    .in(
      'analiza_id',
      candidate.map((a) => a.id),
    )
  if (legaturiRes.error) throw new Error(`Read failed for analize_fructe_parcele: ${legaturiRes.error.message ?? 'Unknown error'}`)

  const deSters = analizeDemoDeSters(candidate, (legaturiRes.data ?? []) as Array<{ analiza_id: string; parcela_id: string }>, new Set(parceleDemo))
  if (deSters.length === 0) return 0

  const { error } = await db
    .from('analize_fructe')
    .delete()
    .eq('tenant_id', tenantId)
    .in(
      'id',
      deSters.map((a) => a.id),
    )
  if (error) throw new Error(`Delete failed for analize_fructe: ${error.message ?? 'Unknown error'}`)

  // Pozele PV-ului / buletinului (dacă omul a încărcat în demo). Doar sub prefixul fermei; o eroare nu oprește.
  const fisiere = deSters
    .flatMap((a) => [a.pv_poza_path, a.buletin_path])
    .filter((path): path is string => typeof path === 'string' && path.startsWith(`${tenantId}/`))
  if (fisiere.length > 0) {
    const { error: storageError } = await db.storage.from('analize').remove(fisiere)
    if (storageError) console.warn('[demo-seed] analize: fișierele nu s-au șters', storageError.message)
  }
  return deSters.length
}
