/**
 * Planul pe stadii (promptul 30): citirea planurilor (și a celor vechi), a parcelelor lor, a liniilor sărite și a
 * excepțiilor; salvarea unui plan nou, a unei linii, a parcelelor; „Sar peste”.
 *
 * Tabelele de plan există deja în producție (`planuri_tratament`, `planuri_tratament_linii`,
 * `planuri_tratament_linie_produse`, `parcele_planuri`): planul merge fără migrare. Doar `planuri_linii_sarite` și
 * `planuri_linii_exceptii` vin din migrarea `20261123120000_plan_stadii.sql`; până atunci „Sar peste” și excepțiile
 * nu apar (`disponibil: false`).
 *
 * Nu folosim RPC-ul vechi `upsert_plan_tratament_cu_linii` la editare: el șterge și recreează toate liniile planului,
 * iar aplicările deja făcute din plan și-ar pierde legătura (`plan_linie_id` devine null). Aici liniile se modifică
 * pe loc. Drepturile: citește cine are „Tratamente”; scrie proprietarul sau cine are „Scrie”; șterge liniile,
 * produsele scoase din linie și planul doar proprietarul (RLS).
 */
import { getSupabase } from '@/lib/supabase/client'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { isMissingTableError } from '@/lib/notifications/preferinte'
import { isMissingColumnError } from '@/lib/schema-features'
import {
  campuriLinie,
  linieDinRand,
  planDinRand,
  randProdusLinie,
  type ExceptieLinie,
  type LinieNoua,
  type ParcelaPlan,
  type PlanTratament,
  type RandLinie,
  type RanduriPlanNou,
  type SarireLinie,
} from '@/lib/plan'
import type { StadiuCod } from '@/lib/parcele/stadii-canonic'

type DbError = { code?: string; message?: string } | null
type Result = { data: unknown; error: DbError }
type LooseQuery = PromiseLike<Result> & {
  select: (columns: string) => LooseQuery
  eq: (column: string, value: unknown) => LooseQuery
  neq: (column: string, value: unknown) => LooseQuery
  in: (column: string, values: readonly unknown[]) => LooseQuery
  gt: (column: string, value: unknown) => LooseQuery
  order: (column: string, options?: { ascending?: boolean }) => LooseQuery
  limit: (count: number) => LooseQuery
}
type LooseTable = {
  select: (columns: string) => LooseQuery
  insert: (rows: unknown) => LooseQuery
  update: (values: unknown) => LooseQuery
  upsert: (rows: unknown, options?: { onConflict?: string; ignoreDuplicates?: boolean }) => LooseQuery
  delete: () => LooseQuery
}
type Db = ReturnType<typeof getSupabase>
const table = (db: Db, name: string) => (db as unknown as { from: (name: string) => LooseTable }).from(name)

const eroare = (error: NonNullable<DbError>, implicit: string): Error => {
  const message = error.message ?? ''
  if (error.code === '42501' || /row-level security/i.test(message)) {
    return Object.assign(new Error('Nu ai drept pentru asta. Ștergerea o poate face doar proprietarul fermei.'), { code: error.code })
  }
  return Object.assign(new Error(message || implicit), { code: error.code })
}

const LINIE_SELECT =
  'id,plan_id,ordine,stadiu_trigger,cohort_trigger,tip_interventie,scop,regula_repetare,interval_repetare_zile,numar_repetari_max,metoda_aplicare,produs_id,produs_nume_manual,doza_ml_per_hl,doza_l_per_ha,observatii,produs:produse_fitosanitare(nume_comercial,tip,phi_zile),produse:planuri_tratament_linie_produse(id,ordine,produs_id,produs_nume_manual,produs_nume_snapshot,tip_snapshot,phi_zile_snapshot,doza_ml_per_hl,doza_l_per_ha,cantitate_text)'

/** Toate planurile fermei (și cele vechi), cu liniile lor. */
export async function getPlanuri(): Promise<PlanTratament[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const [planuri, linii] = await Promise.all([
    table(supabase, 'planuri_tratament').select('id,nume,cultura_tip,descriere,activ,arhivat,created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    table(supabase, 'planuri_tratament_linii').select(LINIE_SELECT).eq('tenant_id', tenantId).order('ordine', { ascending: true }),
  ])
  if (planuri.error) throw eroare(planuri.error, 'Planurile nu s-au încărcat.')
  if (linii.error) throw eroare(linii.error, 'Liniile planului nu s-au încărcat.')
  const toateLiniile = ((linii.data ?? []) as RandLinie[]).map(linieDinRand)
  return ((planuri.data ?? []) as Array<Record<string, unknown>>).map((row) => planDinRand(row, toateLiniile))
}

/** Parcelele planurilor (toți anii). */
export async function getParcelePlanuri(): Promise<ParcelaPlan[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data, error } = await table(supabase, 'parcele_planuri').select('plan_id,parcela_id,an,activ').eq('tenant_id', tenantId)
  if (error) throw eroare(error, 'Parcelele planului nu s-au încărcat.')
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    plan_id: String(row.plan_id),
    parcela_id: String(row.parcela_id),
    an: Number(row.an),
    activ: row.activ !== false,
  }))
}

export interface SariteSiExceptii {
  /** Migrarea e aplicată: „Sar peste” și excepțiile se pot folosi. */
  disponibil: boolean
  sarite: SarireLinie[]
  exceptii: ExceptieLinie[]
}

const lipsa = (error: DbError) => Boolean(error && (isMissingTableError(error) || isMissingColumnError(error)))

export async function getSariteSiExceptii(): Promise<SariteSiExceptii> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const [sarite, exceptii] = await Promise.all([
    table(supabase, 'planuri_linii_sarite').select('plan_linie_id,parcela_id,an,motiv').eq('tenant_id', tenantId),
    table(supabase, 'planuri_linii_exceptii').select('plan_linie_id,parcela_id').eq('tenant_id', tenantId),
  ])
  if (lipsa(sarite.error) || lipsa(exceptii.error)) return { disponibil: false, sarite: [], exceptii: [] }
  if (sarite.error) throw eroare(sarite.error, 'Liniile sărite nu s-au încărcat.')
  if (exceptii.error) throw eroare(exceptii.error, 'Excepțiile nu s-au încărcat.')
  return {
    disponibil: true,
    sarite: ((sarite.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      plan_linie_id: String(row.plan_linie_id),
      parcela_id: String(row.parcela_id),
      an: Number(row.an),
      motiv: typeof row.motiv === 'string' && row.motiv.trim() ? row.motiv.trim() : null,
    })),
    exceptii: ((exceptii.data ?? []) as Array<Record<string, unknown>>).map((row) => ({ plan_linie_id: String(row.plan_linie_id), parcela_id: String(row.parcela_id) })),
  }
}

// ─── Scrierea ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Inserează rândurile; cele cu același `id` (o reîncercare) rămân cum sunt. */
async function insereazaIdempotent(supabase: Db, nume: string, rows: ReadonlyArray<Record<string, unknown>>) {
  if (rows.length === 0) return
  const { error } = await table(supabase, nume).upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
  if (error) throw eroare(error, 'Planul nu s-a salvat.')
}

/**
 * Pune planul pe parcele în anul `an`: o parcelă are un singur plan activ pe an (ca RPC-ul vechi), deci asocierea
 * activă cu alt plan se oprește (`activ = false`, nu se șterge).
 */
async function activeazaParcele(supabase: Db, tenantId: string, planId: string, parcele: ReadonlyArray<Record<string, unknown>>, an: number) {
  const parcelaIds = parcele.map((row) => String(row.parcela_id))
  if (parcelaIds.length === 0) return
  const oprite = await table(supabase, 'parcele_planuri')
    .update({ activ: false })
    .eq('tenant_id', tenantId)
    .eq('an', an)
    .eq('activ', true)
    .neq('plan_id', planId)
    .in('parcela_id', parcelaIds)
  if (oprite.error) throw eroare(oprite.error, 'Parcelele nu s-au salvat.')
  const existente = await table(supabase, 'parcele_planuri').select('id,parcela_id,activ').eq('tenant_id', tenantId).eq('plan_id', planId).eq('an', an)
  if (existente.error) throw eroare(existente.error, 'Parcelele nu s-au salvat.')
  const randuri = (existente.data ?? []) as Array<{ id: string; parcela_id: string; activ: boolean }>
  const deActivat = randuri.filter((row) => parcelaIds.includes(row.parcela_id) && !row.activ).map((row) => row.id)
  if (deActivat.length > 0) {
    const { error } = await table(supabase, 'parcele_planuri').update({ activ: true }).eq('tenant_id', tenantId).in('id', deActivat)
    if (error) throw eroare(error, 'Parcelele nu s-au salvat.')
  }
  const lipsesc = parcele.filter((row) => !randuri.some((r) => r.parcela_id === row.parcela_id))
  await insereazaIdempotent(supabase, 'parcele_planuri', lipsesc)
}

/** Plan nou: planul, liniile, produsele și parcelele (id-urile derivate din cheia formularului: fără dublare). */
export async function creeazaPlan(randuri: RanduriPlanNou, an: number): Promise<string> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  await insereazaIdempotent(supabase, 'planuri_tratament', [randuri.plan])
  await insereazaIdempotent(supabase, 'planuri_tratament_linii', randuri.linii)
  await insereazaIdempotent(supabase, 'planuri_tratament_linie_produse', randuri.produse)
  await activeazaParcele(supabase, tenantId, String(randuri.plan.id), randuri.parcele, an)
  return String(randuri.plan.id)
}

/** Parcelele planului în anul `an`: cele noi se pun, cele scoase se opresc (`activ = false`). */
export async function seteazaParcelePlan(planId: string, parcelaIds: readonly string[], an: number): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data, error } = await table(supabase, 'parcele_planuri').select('id,parcela_id,activ').eq('tenant_id', tenantId).eq('plan_id', planId).eq('an', an)
  if (error) throw eroare(error, 'Parcelele nu s-au salvat.')
  const deOprit = ((data ?? []) as Array<{ id: string; parcela_id: string; activ: boolean }>).filter((row) => row.activ && !parcelaIds.includes(row.parcela_id)).map((row) => row.id)
  if (deOprit.length > 0) {
    const oprite = await table(supabase, 'parcele_planuri').update({ activ: false }).eq('tenant_id', tenantId).in('id', deOprit)
    if (oprite.error) throw eroare(oprite.error, 'Parcelele nu s-au salvat.')
  }
  await activeazaParcele(
    supabase,
    tenantId,
    planId,
    parcelaIds.map((parcelaId) => ({ id: crypto.randomUUID(), tenant_id: tenantId, parcela_id: parcelaId, plan_id: planId, an, activ: true })),
    an,
  )
}

/**
 * Salvează o linie: nouă (cu `id` dat de formular, idempotent) sau modificată pe loc. Produsele se potrivesc după
 * ordine: cele existente se modifică, cele noi se adaugă, cele scoase se șterg (ștergerea: doar proprietarul).
 */
export async function salveazaLinie(input: { planId: string; linieId: string; nou: boolean; ordine: number; linie: LinieNoua }): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const campuri = campuriLinie(input.linie)
  if (input.nou) {
    await insereazaIdempotent(supabase, 'planuri_tratament_linii', [{ id: input.linieId, tenant_id: tenantId, plan_id: input.planId, ordine: input.ordine, ...campuri }])
  } else {
    const { error } = await table(supabase, 'planuri_tratament_linii').update(campuri).eq('tenant_id', tenantId).eq('id', input.linieId)
    if (error) throw eroare(error, 'Linia nu s-a salvat.')
  }
  const existente = await table(supabase, 'planuri_tratament_linie_produse').select('id,ordine').eq('tenant_id', tenantId).eq('plan_linie_id', input.linieId)
  if (existente.error) throw eroare(existente.error, 'Produsele liniei nu s-au salvat.')
  const randuri = (existente.data ?? []) as Array<{ id: string; ordine: number }>
  for (const [index, produs] of input.linie.produse.entries()) {
    const ordine = index + 1
    const rand = randProdusLinie(produs, ordine)
    const exista = randuri.find((r) => r.ordine === ordine)
    const { error } = exista
      ? await table(supabase, 'planuri_tratament_linie_produse').update(rand).eq('tenant_id', tenantId).eq('id', exista.id)
      : await table(supabase, 'planuri_tratament_linie_produse').insert({ ...rand, tenant_id: tenantId, plan_linie_id: input.linieId })
    if (error) throw eroare(error, 'Produsele liniei nu s-au salvat.')
  }
  const inPlus = randuri.filter((r) => r.ordine > input.linie.produse.length).map((r) => r.id)
  if (inPlus.length > 0) {
    const { error } = await table(supabase, 'planuri_tratament_linie_produse').delete().eq('tenant_id', tenantId).in('id', inPlus)
    if (error) throw eroare(error, 'Produsele liniei nu s-au salvat.')
  }
}

/** Mută linia în alt stadiu (ținut apăsat pe telefon, tras pe desktop). */
export async function mutaLinie(linieId: string, stadiu: StadiuCod): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { error } = await table(supabase, 'planuri_tratament_linii').update({ stadiu_trigger: stadiu }).eq('tenant_id', tenantId).eq('id', linieId)
  if (error) throw eroare(error, 'Linia nu s-a mutat.')
}

/** Șterge linia (doar proprietarul). Aplicările făcute din ea rămân, fără legătura cu planul. */
export async function stergeLinie(linieId: string): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { error } = await table(supabase, 'planuri_tratament_linii').delete().eq('tenant_id', tenantId).eq('id', linieId)
  if (error) throw eroare(error, 'Linia nu s-a șters.')
}

export async function redenumestePlan(planId: string, nume: string): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { error } = await table(supabase, 'planuri_tratament').update({ nume: nume.trim() || 'Plan' }).eq('tenant_id', tenantId).eq('id', planId)
  if (error) throw eroare(error, 'Numele nu s-a salvat.')
}

/** Șterge planul (doar proprietarul): întâi parcelele lui (cheia e `RESTRICT`), apoi planul cu liniile. */
export async function stergePlan(planId: string): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const parcele = await table(supabase, 'parcele_planuri').delete().eq('tenant_id', tenantId).eq('plan_id', planId)
  if (parcele.error) throw eroare(parcele.error, 'Planul nu s-a șters.')
  const { error } = await table(supabase, 'planuri_tratament').delete().eq('tenant_id', tenantId).eq('id', planId)
  if (error) throw eroare(error, 'Planul nu s-a șters.')
}

/** „Sar peste” pe o linie, pe parcelele date, în anul `an` (de două ori = tot o dată). */
export async function sarLinie(input: { linieId: string; parcelaIds: readonly string[]; an: number; motiv: string | null }): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const rows = input.parcelaIds.map((parcelaId) => ({ tenant_id: tenantId, plan_linie_id: input.linieId, parcela_id: parcelaId, an: input.an, motiv: input.motiv?.trim() || null }))
  if (rows.length === 0) return
  const { error } = await table(supabase, 'planuri_linii_sarite').upsert(rows, { onConflict: 'plan_linie_id,parcela_id,an', ignoreDuplicates: true })
  if (error) throw eroare(error, 'Nu s-a salvat.')
}

/** „Nu mai sar”: linia revine pe parcelele date. */
export async function anuleazaSarire(input: { linieId: string; parcelaIds: readonly string[]; an: number }): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { error } = await table(supabase, 'planuri_linii_sarite').delete().eq('tenant_id', tenantId).eq('plan_linie_id', input.linieId).eq('an', input.an).in('parcela_id', input.parcelaIds)
  if (error) throw eroare(error, 'Nu s-a salvat.')
}

/** Excepția pe parcelă: linia nu se aplică pe parcela aceea (`true`) sau se aplică din nou (`false`). */
export async function seteazaExceptie(input: { linieId: string; parcelaId: string; exceptie: boolean }): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { error } = input.exceptie
    ? await table(supabase, 'planuri_linii_exceptii').upsert(
        { tenant_id: tenantId, plan_linie_id: input.linieId, parcela_id: input.parcelaId },
        { onConflict: 'plan_linie_id,parcela_id', ignoreDuplicates: true },
      )
    : await table(supabase, 'planuri_linii_exceptii').delete().eq('tenant_id', tenantId).eq('plan_linie_id', input.linieId).eq('parcela_id', input.parcelaId)
  if (error) throw eroare(error, 'Nu s-a salvat.')
}
