/**
 * Planul pe stadii în demo-urile noi „Fructe de pădure” (promptul 30): planul „Zmeură <an>” pe parcelele de zmeură de
 * vânzare (Delniwa Nord, Delniwa Sud, Maravilla), cu linii pe 5 stadii, din produsele demo (cele fără nume de produs
 * real sunt „(exemplu)”):
 *   - Pornire în vegetație: Zeamă bordeleză (exemplu), preventiv;
 *   - Înflorit: Borofol (bor la înflorire) și Switch 62.5 WG (botritis, repetă la 10 zile, de 2 ori);
 *   - Fructe verzi: Ferti 15-5-30 la fertirigare, 2 g/plantă, repetă la 10 zile, de 3 ori;
 *   - Recoltare: Kelpak, biostimulare — FĂCUTĂ pe Maravilla acum 2 zile (o aplicare cu `plan_linie_id`);
 *   - După recoltare: Cupru (exemplu), preventiv — Delniwa Nord și Maravilla (floricane) sunt în stadiul ăsta
 *     (`seedDemoStadii`), deci tab-ul Plan arată „E timpul pentru · După recoltare”.
 *
 * Rulează doar la crearea unui demo nou (seed), cu service role, după tratamente și stadii. Tabelele de plan există
 * deja, deci nu depinde de migrare. Datele existente nu se ating. Reîncărcarea demo-ului șterge planul demo
 * (`deleteDemoPlan`, după nota din `descriere`; liniile și produsele pleacă în cascadă).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

type Admin = SupabaseClient<Database>
type Err = { code?: string; message?: string } | null
type LooseFilter = PromiseLike<{ data: unknown; error: Err }> & {
  eq: (column: string, value: unknown) => LooseFilter
  in: (column: string, values: readonly unknown[]) => LooseFilter
  is: (column: string, value: null) => LooseFilter
  select: (columns: string) => LooseFilter
  limit: (n: number) => LooseFilter
}
type Loose = {
  from: (table: string) => {
    select: (columns: string) => LooseFilter
    insert: (rows: unknown) => PromiseLike<{ error: Err }> & { select: (columns: string) => PromiseLike<{ data: unknown; error: Err }> }
    delete: () => LooseFilter
  }
}

export const DEMO_PLAN_NOTA = 'Demo: plan de exemplu.'

export type DemoParcelaPlan = { id: string; nume_parcela: string | null }

type ProdusDemo = { nume: string; tip: string; phi: number | null; doza_ml_per_hl?: number; doza_l_per_ha?: number; cantitate_text?: string }
type LinieDemo = {
  stadiu: string
  scop: string
  metoda: 'foliar' | 'fertirigare'
  tip_interventie: string
  repetare?: { zile: number; ori: number }
  produs: ProdusDemo
  facutaPe?: string
}

/** Liniile demo (exportate pentru test). */
export const LINII_DEMO: LinieDemo[] = [
  { stadiu: 'umflare_muguri', scop: 'preventiv', metoda: 'foliar', tip_interventie: 'protectie', produs: { nume: 'Zeamă bordeleză (exemplu)', tip: 'fungicid', phi: 21, doza_ml_per_hl: 500 } },
  { stadiu: 'inflorit', scop: 'bor la înflorire', metoda: 'foliar', tip_interventie: 'nutritie', produs: { nume: 'Borofol', tip: 'foliar', phi: 0, doza_l_per_ha: 1.5 } },
  {
    stadiu: 'inflorit',
    scop: 'botritis',
    metoda: 'foliar',
    tip_interventie: 'protectie',
    repetare: { zile: 10, ori: 2 },
    produs: { nume: 'Switch 62.5 WG', tip: 'fungicid', phi: 3, doza_ml_per_hl: 100 },
  },
  {
    stadiu: 'fruct_verde',
    scop: 'fertirigare',
    metoda: 'fertirigare',
    tip_interventie: 'nutritie',
    repetare: { zile: 10, ori: 3 },
    produs: { nume: 'Ferti 15-5-30', tip: 'ingrasamant', phi: null, cantitate_text: '2 g/plantă · rezervor A' },
  },
  { stadiu: 'maturitate', scop: 'biostimulare', metoda: 'foliar', tip_interventie: 'biostimulare', produs: { nume: 'Kelpak', tip: 'bioregulator', phi: 0, doza_ml_per_hl: 250 }, facutaPe: 'maravilla' },
  { stadiu: 'post_recoltare', scop: 'după recoltare, preventiv', metoda: 'foliar', tip_interventie: 'protectie', produs: { nume: 'Cupru (exemplu)', tip: 'fungicid', phi: 14, doza_ml_per_hl: 300 } },
]

const lipsa = (error: Err) =>
  Boolean(error && (['42P01', 'PGRST205', '42703', 'PGRST204'].includes(error.code ?? '') || /does not exist|could not find the/i.test(error.message ?? '')))

export interface DemoPlanResult {
  plan: string | null
  linii: number
  error: string | null
}

export async function seedDemoPlan(
  supabaseAdmin: Admin,
  tenantId: string,
  parcele: readonly DemoParcelaPlan[],
  day: (offset: number) => string,
  /** Produsele fermei din Magazie (nume → id, din `seedDemoMagazie`). */
  produseFerma: ReadonlyMap<string, string> = new Map(),
): Promise<DemoPlanResult> {
  const db = supabaseAdmin as unknown as Loose
  const nume = (p: DemoParcelaPlan) => (p.nume_parcela ?? '').toLocaleLowerCase('ro-RO')
  const zmeura = parcele.filter((p) => nume(p).includes('delniwa') || nume(p).includes('maravilla'))
  if (zmeura.length === 0) return { plan: null, linii: 0, error: null }
  const an = Number(day(0).slice(0, 4))

  const catalogRes = await db.from('produse_fitosanitare').select('id,nume_comercial').is('tenant_id', null).in('nume_comercial', ['Switch 62.5 WG', 'Kelpak'])
  const ids = new Map(((catalogRes.data ?? []) as Array<{ id: string; nume_comercial: string }>).map((row) => [row.nume_comercial, row.id]))
  for (const [n, id] of produseFerma) if (!ids.has(n)) ids.set(n, id)

  const planId = crypto.randomUUID()
  const plan = await db.from('planuri_tratament').insert({ id: planId, tenant_id: tenantId, nume: `Zmeură ${an}`, cultura_tip: 'zmeur', descriere: DEMO_PLAN_NOTA, activ: true, arhivat: false })
  if (plan.error) return { plan: null, linii: 0, error: lipsa(plan.error) ? null : (plan.error.message ?? 'planuri_tratament') }

  const linii = LINII_DEMO.map((linie, index) => {
    const produsId = ids.get(linie.produs.nume) ?? null
    return {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      plan_id: planId,
      ordine: index + 1,
      stadiu_trigger: linie.stadiu,
      tip_interventie: linie.tip_interventie,
      scop: linie.scop,
      metoda_aplicare: linie.metoda,
      regula_repetare: linie.repetare ? 'interval' : 'fara_repetare',
      interval_repetare_zile: linie.repetare?.zile ?? null,
      numar_repetari_max: linie.repetare?.ori ?? null,
      produs_id: produsId,
      produs_nume_manual: produsId ? null : linie.produs.nume,
      doza_ml_per_hl: linie.produs.doza_ml_per_hl ?? null,
      doza_l_per_ha: linie.produs.doza_l_per_ha ?? null,
    }
  })
  const liniiRes = await db.from('planuri_tratament_linii').insert(linii)
  if (liniiRes.error) return { plan: planId, linii: 0, error: liniiRes.error.message ?? 'planuri_tratament_linii' }

  const produse = LINII_DEMO.map((linie, index) => {
    const produsId = ids.get(linie.produs.nume) ?? null
    return {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      plan_linie_id: linii[index].id,
      ordine: 1,
      produs_id: produsId,
      produs_nume_manual: produsId ? null : linie.produs.nume,
      produs_nume_snapshot: linie.produs.nume,
      tip_snapshot: linie.produs.tip,
      phi_zile_snapshot: linie.produs.phi,
      doza_ml_per_hl: linie.produs.doza_ml_per_hl ?? null,
      doza_l_per_ha: linie.produs.doza_l_per_ha ?? null,
      cantitate_text: linie.produs.cantitate_text ?? null,
    }
  })
  const produseRes = await db.from('planuri_tratament_linie_produse').insert(produse)
  if (produseRes.error) return { plan: planId, linii: linii.length, error: produseRes.error.message ?? 'planuri_tratament_linie_produse' }

  const asocRes = await db.from('parcele_planuri').insert(zmeura.map((p) => ({ tenant_id: tenantId, parcela_id: p.id, plan_id: planId, an, activ: true })))
  if (asocRes.error) return { plan: planId, linii: linii.length, error: asocRes.error.message ?? 'parcele_planuri' }

  // Linia făcută: Kelpak pe Maravilla, acum 2 zile (în stadiul „Recoltare” al primocanelor).
  for (const [index, linie] of LINII_DEMO.entries()) {
    if (!linie.facutaPe) continue
    const parcela = zmeura.find((p) => nume(p).includes(linie.facutaPe as string))
    if (!parcela) continue
    const produsId = produse[index].produs_id
    const aplicareId = crypto.randomUUID()
    const aplicare = await db.from('aplicari_tratament').insert({
      id: aplicareId,
      tenant_id: tenantId,
      parcela_id: parcela.id,
      status: 'aplicata',
      data_aplicata: `${day(-2)}T07:00:00.000Z`,
      metoda_aplicare: linie.metoda,
      tip_interventie: linie.tip_interventie,
      sursa: 'din_plan',
      plan_linie_id: linii[index].id,
      produs_id: produsId,
      produs_nume_manual: produsId ? null : linie.produs.nume,
      doza_ml_per_hl: linie.produs.doza_ml_per_hl ?? null,
      observatii: 'Demo',
    })
    if (aplicare.error) return { plan: planId, linii: linii.length, error: aplicare.error.message ?? 'aplicari_tratament' }
    const cantitate = linie.produs.doza_ml_per_hl ? Math.round(linie.produs.doza_ml_per_hl * 0.6) : null
    const randProdus = await db.from('aplicari_tratament_produse').insert({
      tenant_id: tenantId,
      aplicare_id: aplicareId,
      plan_linie_produs_id: produse[index].id,
      ordine: 1,
      produs_id: produsId,
      produs_nume_manual: produsId ? null : linie.produs.nume,
      produs_nume_snapshot: linie.produs.nume,
      tip_snapshot: linie.produs.tip,
      phi_zile_snapshot: linie.produs.phi,
      doza_ml_per_hl: linie.produs.doza_ml_per_hl ?? null,
      cantitate_totala: cantitate,
      unitate_cantitate: cantitate === null ? null : 'ml',
      cantitate_text: cantitate === null ? null : `${cantitate} ml`,
    })
    if (randProdus.error) return { plan: planId, linii: linii.length, error: randProdus.error.message ?? 'aplicari_tratament_produse' }
  }

  return { plan: planId, linii: linii.length, error: null }
}

/**
 * Planul demo (reîncărcarea demo-ului): întâi parcelele lui (cheia spre plan e `RESTRICT`), apoi planul; liniile și
 * produsele pleacă în cascadă. Doar planurile cu nota demo.
 */
export async function deleteDemoPlan(supabaseAdmin: Admin, tenantId: string): Promise<number> {
  const db = supabaseAdmin as unknown as Loose
  const { data, error } = await db.from('planuri_tratament').select('id').eq('tenant_id', tenantId).eq('descriere', DEMO_PLAN_NOTA)
  if (error) {
    if (lipsa(error)) return 0
    throw new Error(`Select failed for planuri_tratament: ${error.message ?? 'Unknown error'}`)
  }
  const ids = ((data ?? []) as Array<{ id: string }>).map((row) => row.id)
  if (ids.length === 0) return 0
  const asoc = await db.from('parcele_planuri').delete().eq('tenant_id', tenantId).in('plan_id', ids)
  if (asoc.error) throw new Error(`Delete failed for parcele_planuri: ${asoc.error.message ?? 'Unknown error'}`)
  const planuri = await db.from('planuri_tratament').delete().eq('tenant_id', tenantId).in('id', ids)
  if (planuri.error) throw new Error(`Delete failed for planuri_tratament: ${planuri.error.message ?? 'Unknown error'}`)
  return ids.length
}
