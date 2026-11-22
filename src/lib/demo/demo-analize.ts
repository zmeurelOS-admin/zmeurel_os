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
      nota: 'Demo: 1 kg din fiecare parcelă.',
      status: 'conform',
      buletin_numar: '4415',
      buletin_data: `${an}-07-12`,
      ce_s_a_analizat: 'Multireziduu pesticide (exemplu)',
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
