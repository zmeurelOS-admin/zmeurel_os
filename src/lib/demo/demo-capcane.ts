/**
 * Capcanele în demo-urile noi „Fructe de pădure” (promptul 29):
 *   - 2 grupuri Drosophila (3 bucăți fiecare): Maravilla, cu capturi care cresc până trec de prag în ultimele
 *     săptămâni (0, 1, 3, 4, 9) și verificarea scadentă azi; Delniwa Nord, fără capturi;
 *   - 1 grup de lipicioase galbene (2 bucăți) pe Delniwa Sud;
 *   - verificări săptămânale pe 5 săptămâni, câte un rând pe capcană.
 *
 * Rulează doar la crearea unui demo nou (seed), cu service role. Fără migrarea `20261123100000_capcane.sql` nu scrie
 * nimic și nu oprește demo-ul. Datele existente nu se ating. Reîncărcarea demo-ului șterge capcanele de pe parcelele
 * demo (`deleteDemoCapcane`, înaintea parcelelor: cheia spre `parcele` e `ON DELETE RESTRICT`); verificările pleacă
 * în cascadă.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

type Admin = SupabaseClient<Database>
type Err = { code?: string; message?: string } | null
type LooseFilter = PromiseLike<{ data: unknown; error: Err }> & {
  eq: (column: string, value: unknown) => LooseFilter
  in: (column: string, values: readonly unknown[]) => LooseFilter
  select: (columns: string) => LooseFilter
}
type Loose = {
  from: (table: string) => {
    insert: (rows: unknown) => PromiseLike<{ error: Err }> & { select: (columns: string) => PromiseLike<{ data: unknown; error: Err }> }
    delete: () => LooseFilter
  }
}

export const DEMO_CAPCANE_NOTA = 'Demo: capcane de exemplu.'

const lipsa = (error: Err) =>
  Boolean(
    error &&
      (['42P01', 'PGRST205', '42703', 'PGRST204'].includes(error.code ?? '') ||
        /does not exist|could not find the/i.test(error.message ?? '')),
  )

export type DemoParcelaCapcane = { id: string; nume_parcela: string | null }

type GrupDemo = {
  parcela: (nume: string) => boolean
  tip: 'drosophila' | 'lipicioasa_galbena'
  bucati: number
  /** Zilele verificărilor, față de azi (ultima = cea mai recentă). */
  zile: number[]
  /** Capturile pe capcană, la fiecare verificare. */
  capturi: number[][]
}

/** Grupurile demo (exportate pentru test). */
export const GRUPURI_DEMO: GrupDemo[] = [
  {
    parcela: (n) => n.includes('maravilla'),
    tip: 'drosophila',
    bucati: 3,
    // Ultima verificare acum 7 zile → următoarea e azi.
    zile: [-35, -28, -21, -14, -7],
    capturi: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 1],
      [2, 1, 1],
      [3, 4, 2],
    ],
  },
  {
    parcela: (n) => n.includes('delniwa nord'),
    tip: 'drosophila',
    bucati: 3,
    zile: [-31, -24, -17, -10, -3],
    capturi: [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
  },
  {
    parcela: (n) => n.includes('delniwa sud'),
    tip: 'lipicioasa_galbena',
    bucati: 2,
    zile: [-30, -23, -16, -9, -2],
    capturi: [
      [4, 2],
      [6, 3],
      [5, 7],
      [9, 4],
      [6, 5],
    ],
  },
]

export interface DemoCapcaneResult {
  grupuri: number
  verificari: number
  error: string | null
}

export async function seedDemoCapcane(
  supabaseAdmin: Admin,
  tenantId: string,
  parcele: readonly DemoParcelaCapcane[],
  day: (offset: number) => string,
): Promise<DemoCapcaneResult> {
  const db = supabaseAdmin as unknown as Loose
  let grupuri = 0
  let verificari = 0
  for (const grup of GRUPURI_DEMO) {
    const parcela = parcele.find((p) => grup.parcela((p.nume_parcela ?? '').toLocaleLowerCase('ro-RO')))
    if (!parcela) continue
    const montare = day(grup.zile[0] - 5)
    const ultima = grup.zile[grup.zile.length - 1]
    const { data, error } = await db
      .from('capcane_montate')
      .insert({
        tenant_id: tenantId,
        parcela_id: parcela.id,
        tip_capcana: grup.tip,
        nr_bucati: grup.bucati,
        data_montare: montare,
        interval_verificare_zile: 7,
        data_urmatoarea_verificare: day(ultima + 7),
        data_schimb_atractant: grup.tip === 'drosophila' ? day(ultima) : null,
        status: 'activa',
        observatii: DEMO_CAPCANE_NOTA,
      })
      .select('id')
    if (error) {
      if (lipsa(error)) return { grupuri, verificari, error: null }
      return { grupuri, verificari, error: error.message ?? 'capcane_montate' }
    }
    const grupId = (Array.isArray(data) ? (data[0] as { id?: string } | undefined)?.id : undefined) ?? null
    if (!grupId) continue
    grupuri += 1

    const randuri = grup.zile.flatMap((offset, i) =>
      grup.capturi[i].map((n, nr) => ({
        tenant_id: tenantId,
        capcana_montata_id: grupId,
        capcana_nr: nr + 1,
        data_verificare: day(offset),
        nr_capturati: n,
        atractant_schimbat: grup.tip === 'drosophila',
        actiune: grup.tip === 'drosophila' ? 'inlocuit' : 'doar_observat',
      })),
    )
    const rezultat = await db.from('capcane_verificari').insert(randuri)
    if (rezultat.error) return { grupuri, verificari, error: rezultat.error.message ?? 'capcane_verificari' }
    verificari += randuri.length
  }
  return { grupuri, verificari, error: null }
}

/**
 * Capcanele de pe parcelele demo (reîncărcarea demo-ului), înaintea parcelelor. Verificările pleacă în cascadă.
 * Fără tabel (migrare veche): nimic.
 */
export async function deleteDemoCapcane(supabaseAdmin: Admin, tenantId: string, parcelaIds: readonly string[]): Promise<number> {
  if (parcelaIds.length === 0) return 0
  const db = supabaseAdmin as unknown as Loose
  let sterse = 0
  for (let i = 0; i < parcelaIds.length; i += 500) {
    const { data, error } = await db.from('capcane_montate').delete().eq('tenant_id', tenantId).in('parcela_id', parcelaIds.slice(i, i + 500)).select('id')
    if (error) {
      if (lipsa(error)) return sterse
      throw new Error(`Delete failed for capcane_montate: ${error.message ?? 'Unknown error'}`)
    }
    sterse += Array.isArray(data) ? data.length : 0
  }
  return sterse
}
