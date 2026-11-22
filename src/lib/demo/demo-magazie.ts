/**
 * Magazia în demo-urile noi „Fructe de pădure” (promptul 28):
 *   - produsele fermei folosite de tratamentele demo (Ferti 15-5-30, Calcinit, Borofol) și două din catalog
 *     (Switch 62.5 WG, Kelpak), toate urmărite în magazie;
 *   - intrări cu preț pe 5 produse (acum 30 de zile), o corecție („Am numărat”) la Borofol;
 *   - ieșirile vin singure din tratamentele demo făcute după prima intrare (triggerul din migrare), de aceea
 *     magazia se pune ÎNAINTEA tratamentelor;
 *   - Borofol și Kelpak ies „pe terminate” (prag 1 l).
 *
 * Rulează doar la crearea unui demo nou (seed), cu service role. Fără migrarea `20261122130000_magazia.sql` nu scrie
 * nimic în magazie și nu oprește demo-ul. Datele existente nu se ating. Mișcările puse de seed au nota „Demo · …”:
 * după ea le șterge reîncărcarea demo-ului (`deleteDemoMagazie`); ieșirile pleacă în cascadă cu tratamentele demo.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

type Admin = SupabaseClient<Database>
type Err = { code?: string; message?: string } | null
type LooseFilter = PromiseLike<{ data: unknown; error: Err }> & {
  eq: (column: string, value: unknown) => LooseFilter
  is: (column: string, value: null) => LooseFilter
  in: (column: string, values: readonly unknown[]) => LooseFilter
  like: (column: string, pattern: string) => LooseFilter
  limit: (n: number) => LooseFilter
  select: (columns: string) => LooseFilter
}
type Loose = {
  from: (table: string) => {
    select: (columns: string) => LooseFilter
    insert: (rows: unknown) => PromiseLike<{ error: Err }> & { select: (columns: string) => PromiseLike<{ data: unknown; error: Err }> }
    upsert: (rows: unknown, options: { onConflict: string }) => PromiseLike<{ error: Err }>
    delete: () => LooseFilter
  }
}

export const DEMO_MAGAZIE_NOTA = 'Demo · '

const lipsa = (error: Err) =>
  Boolean(
    error &&
      (['42P01', 'PGRST205', '42703', 'PGRST204'].includes(error.code ?? '') ||
        /does not exist|could not find the/i.test(error.message ?? '')),
  )

type ProdusDemo = {
  nume: string
  /** Din catalogul global; altfel produs al fermei. */
  catalog: boolean
  tip: string
  phi: number | null
  unitate: 'kg' | 'l'
  cantitate: number
  pret: number
  furnizor: string
  prag?: number
  /** „Am numărat”: diferența (−0,6 = au rămas cu 0,6 mai puțin decât s-a cumpărat). */
  corectie?: number
}

const PRODUSE: ProdusDemo[] = [
  { nume: 'Switch 62.5 WG', catalog: true, tip: 'fungicid', phi: 3, unitate: 'kg', cantitate: 1, pret: 420, furnizor: 'Agrosem Suceava' },
  { nume: 'Kelpak', catalog: true, tip: 'bioregulator', phi: 0, unitate: 'l', cantitate: 1, pret: 95, furnizor: 'Agrosem Suceava', prag: 1 },
  { nume: 'Ferti 15-5-30', catalog: false, tip: 'ingrasamant', phi: null, unitate: 'kg', cantitate: 25, pret: 210, furnizor: 'Agro Suceava' },
  { nume: 'Calcinit', catalog: false, tip: 'ingrasamant', phi: null, unitate: 'kg', cantitate: 25, pret: 120, furnizor: 'Agro Suceava' },
  { nume: 'Borofol', catalog: false, tip: 'foliar', phi: 0, unitate: 'l', cantitate: 1, pret: 60, furnizor: 'Agro Suceava', prag: 1, corectie: -0.6 },
]

export interface DemoMagazieResult {
  /** Numele produsului → id (și pentru tratamentele demo, ca fertirigarea să scadă din magazie). */
  produse: Map<string, string>
  miscari: number
  error: string | null
}

/** Produsele fermei folosite de demo: creează ce lipsește, refolosește ce există deja (același nume). */
async function produseFerma(db: Loose, tenantId: string): Promise<{ ids: Map<string, string>; error: string | null }> {
  const ids = new Map<string, string>()
  const ferma = PRODUSE.filter((produs) => !produs.catalog)
  const existente = await db.from('produse_fitosanitare').select('id,nume_comercial').eq('tenant_id', tenantId).in('nume_comercial', ferma.map((produs) => produs.nume))
  if (existente.error) return { ids, error: existente.error.message ?? 'produse_fitosanitare' }
  for (const row of (existente.data ?? []) as Array<{ id: string; nume_comercial: string }>) ids.set(row.nume_comercial, row.id)
  const deCreat = ferma.filter((produs) => !ids.has(produs.nume))
  if (deCreat.length > 0) {
    const inserted = await db
      .from('produse_fitosanitare')
      .insert(deCreat.map((produs) => ({ tenant_id: tenantId, nume_comercial: produs.nume, substanta_activa: '', tip: produs.tip, phi_zile: produs.phi })))
      .select('id,nume_comercial')
    if (inserted.error) return { ids, error: inserted.error.message ?? 'produse_fitosanitare' }
    for (const row of (inserted.data ?? []) as Array<{ id: string; nume_comercial: string }>) ids.set(row.nume_comercial, row.id)
  }
  const catalog = await db.from('produse_fitosanitare').select('id,nume_comercial').is('tenant_id', null).in('nume_comercial', PRODUSE.filter((produs) => produs.catalog).map((produs) => produs.nume))
  if (!catalog.error) {
    for (const row of (catalog.data ?? []) as Array<{ id: string; nume_comercial: string }>) ids.set(row.nume_comercial, row.id)
  }
  return { ids, error: null }
}

export async function seedDemoMagazie(supabaseAdmin: Admin, tenantId: string, day: (offset: number) => string): Promise<DemoMagazieResult> {
  const db = supabaseAdmin as unknown as Loose
  const { ids, error } = await produseFerma(db, tenantId)
  if (error) return { produse: ids, miscari: 0, error }

  // Fără migrare: tabelul lipsește, magazia nu se pune (produsele fermei rămân pentru tratamentele demo).
  const probe = await db.from('magazie_produse').select('produs_id').limit(1)
  if (probe.error) return { produse: ids, miscari: 0, error: lipsa(probe.error) ? null : (probe.error.message ?? 'magazie_produse') }

  const urmarite = PRODUSE.filter((produs) => ids.has(produs.nume))
  const setari = await db.from('magazie_produse').upsert(
    urmarite.map((produs) => ({ tenant_id: tenantId, produs_id: ids.get(produs.nume), unitate_stoc: produs.unitate, prag_pe_terminate: produs.prag ?? null })),
    { onConflict: 'tenant_id,produs_id' },
  )
  if (setari.error) return { produse: ids, miscari: 0, error: setari.error.message ?? 'magazie_produse' }

  const miscari = [
    ...urmarite.map((produs) => ({
      tenant_id: tenantId,
      produs_id: ids.get(produs.nume),
      tip: 'intrare',
      cantitate: produs.cantitate,
      data: day(-30),
      pret_total_lei: produs.pret,
      furnizor: produs.furnizor,
      nota: `${DEMO_MAGAZIE_NOTA}cumpărat`,
      client_sync_id: crypto.randomUUID(),
    })),
    ...urmarite
      .filter((produs) => produs.corectie)
      .map((produs) => ({
        tenant_id: tenantId,
        produs_id: ids.get(produs.nume),
        tip: 'corectie',
        cantitate: produs.corectie,
        data: day(-10),
        nota: `${DEMO_MAGAZIE_NOTA}Am numărat`,
        client_sync_id: crypto.randomUUID(),
      })),
  ]
  const inserted = await db.from('magazie_miscari').insert(miscari)
  if (inserted.error) return { produse: ids, miscari: 0, error: inserted.error.message ?? 'magazie_miscari' }
  return { produse: ids, miscari: miscari.length, error: null }
}

/**
 * Reîncărcarea demo-ului: șterge intrările și corecțiile puse de seed (nota „Demo · …”). Ieșirile pleacă singure,
 * în cascadă, cu tratamentele demo. Fără migrare: nimic. Întoarce câte rânduri a șters.
 */
export async function deleteDemoMagazie(supabaseAdmin: Admin, tenantId: string): Promise<number> {
  const db = supabaseAdmin as unknown as Loose
  const { data, error } = await db.from('magazie_miscari').delete().eq('tenant_id', tenantId).like('nota', `${DEMO_MAGAZIE_NOTA}%`).select('id')
  if (error) {
    if (lipsa(error)) return 0
    throw new Error(`Delete failed for magazie_miscari: ${error.message ?? 'Unknown error'}`)
  }
  return Array.isArray(data) ? data.length : 0
}
