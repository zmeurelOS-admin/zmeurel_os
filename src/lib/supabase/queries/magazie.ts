/**
 * Magazia (promptul 28): stocul produselor de tratament, „+ Am cumpărat”, „Am numărat”, pragul „pe terminate”.
 *
 * Tabelele și RPC-urile vin din migrarea `20261122130000_magazia.sql`. Până la aplicare, citirea stocului aruncă
 * `MagazieIndisponibilaError` (ecranul arată „după actualizarea bazei de date”), iar restul aplicației merge ca azi:
 * formularul de tratament nu arată stocul, lista de aplicări nu arată ieșirile, Rapoartele nu arată linia.
 *
 * Operatorul nu citește `magazie_miscari` direct (RLS): stocul și mișcările vin prin RPC-uri, fără prețuri.
 * Inserarea lui se face fără `select()` (fără drept de citire, PostgREST ar refuza răspunsul).
 */
import { uploadBon } from '@/lib/bonuri'
import { createCheltuiala } from '@/lib/supabase/queries/cheltuieli'
import { getSupabase } from '@/lib/supabase/client'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { isMissingTableError } from '@/lib/notifications/preferinte'
import { isMissingColumnError } from '@/lib/schema-features'
import { categorieCheltuiala, descriereCheltuiala } from '@/lib/magazie/bani'
import type { MiscareStoc, StocProdus, TipMiscare } from '@/lib/magazie/stoc'
import { esteUnitateStoc, type UnitateStoc } from '@/lib/magazie/unitati'

export const MAGAZIE_INDISPONIBILA = 'Magazia va merge după actualizarea bazei de date.'

export class MagazieIndisponibilaError extends Error {
  constructor() {
    super(MAGAZIE_INDISPONIBILA)
    this.name = 'MagazieIndisponibilaError'
  }
}

type DbError = { code?: string; message?: string; details?: string } | null
type Result = { data: unknown; error: DbError }
type LooseQuery = PromiseLike<Result> & {
  select: (columns: string) => LooseQuery
  eq: (column: string, value: unknown) => LooseQuery
  order: (column: string, options?: { ascending?: boolean }) => LooseQuery
  range: (from: number, to: number) => LooseQuery
  limit: (count: number) => LooseQuery
  maybeSingle: () => PromiseLike<Result>
}
type LooseTable = {
  select: (columns: string) => LooseQuery
  insert: (rows: unknown) => LooseQuery
  update: (values: unknown) => LooseQuery
  upsert: (rows: unknown, options?: { onConflict?: string; ignoreDuplicates?: boolean }) => LooseQuery
}
type Db = ReturnType<typeof getSupabase>
const table = (db: Db, name: string) => (db as unknown as { from: (name: string) => LooseTable }).from(name)
const rpc = (db: Db, name: string, args?: Record<string, unknown>) =>
  (db as unknown as { rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<Result> }).rpc(name, args)

/** Tabelul, coloana sau funcția lipsesc: migrarea încă neaplicată. */
export function magazieLipsa(error: DbError): boolean {
  if (!error) return false
  if (error.code === 'PGRST202' || error.code === '42883') return true
  if (isMissingTableError(error) || isMissingColumnError(error)) return true
  return /could not find the function/i.test(error.message ?? '')
}

const eroare = (error: NonNullable<DbError>, implicit: string): Error => {
  if (magazieLipsa(error)) return new MagazieIndisponibilaError()
  const message = error.message ?? ''
  if (error.code === '42501' || /row-level security/i.test(message)) return Object.assign(new Error('Nu ai drept de scriere pe tratamente.'), { code: error.code })
  return Object.assign(new Error(message || implicit), { code: error.code })
}

const numar = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
const zi = (value: unknown) => (value ? String(value).slice(0, 10) : null)

export type StocMagazie = StocProdus & { inceput: string | null }

type StocRpcRow = {
  produs_id: string
  nume: string | null
  tip: string | null
  unitate: string | null
  stoc: unknown
  prag: unknown
  doza_ultima: unknown
  aplicari_ramase: unknown
  pe_terminate: boolean | null
  pret_mediu: unknown
  valoare: unknown
  ultima_miscare: unknown
  inceput?: unknown
}

/** Stocul pe produs (RPC `magazie_stoc`). Prețurile sunt `null` pentru operator. */
export async function getMagazieStoc(): Promise<StocMagazie[]> {
  const { data, error } = await rpc(getSupabase(), 'magazie_stoc')
  if (error) throw eroare(error, 'Magazia nu s-a încărcat.')
  return ((data ?? []) as StocRpcRow[]).map((row) => ({
    produs_id: row.produs_id,
    nume: row.nume?.trim() || 'Produs',
    tip: row.tip,
    unitate: esteUnitateStoc(row.unitate) ? row.unitate : 'buc',
    stoc: numar(row.stoc) ?? 0,
    prag: numar(row.prag),
    doza_ultima: numar(row.doza_ultima),
    aplicari_ramase: numar(row.aplicari_ramase),
    pe_terminate: Boolean(row.pe_terminate),
    pret_mediu: numar(row.pret_mediu),
    valoare: numar(row.valoare),
    ultima_miscare: zi(row.ultima_miscare),
    inceput: zi(row.inceput),
  }))
}

/** Stocul, sau `null` dacă migrarea nu e aplicată (formularul de tratament și Mai mult merg fără el). */
export async function getMagazieStocSauNimic(): Promise<StocMagazie[] | null> {
  try {
    return await getMagazieStoc()
  } catch (error) {
    if (error instanceof MagazieIndisponibilaError) return null
    throw error
  }
}

export interface MiscareProdus {
  id: string
  tip: TipMiscare | 'nescazut'
  cantitate: number | null
  data: string | null
  pret_total_lei: number | null
  furnizor: string | null
  bon_path: string | null
  cheltuiala_id: string | null
  aplicare_id: string | null
  metoda_aplicare: string | null
  parcela_nume: string | null
  nota: string | null
  created_at: string
  /** Doar la `nescazut`: cantitatea aplicării, cum a fost salvată („5 ml_10l”). */
  cantitate_aplicare: string | null
}

/** Mișcările unui produs (fișa produsului). Prețul, bonul și cheltuiala sunt `null` pentru operator. */
export async function getMiscariProdus(produsId: string): Promise<MiscareProdus[]> {
  const { data, error } = await rpc(getSupabase(), 'magazie_miscari_produs', { p_produs_id: produsId })
  if (error) throw eroare(error, 'Mișcările nu s-au încărcat.')
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    tip: row.tip as MiscareProdus['tip'],
    cantitate: numar(row.cantitate),
    data: zi(row.data),
    pret_total_lei: numar(row.pret_total_lei),
    furnizor: (row.furnizor as string | null) ?? null,
    bon_path: (row.bon_path as string | null) ?? null,
    cheltuiala_id: (row.cheltuiala_id as string | null) ?? null,
    aplicare_id: (row.aplicare_id as string | null) ?? null,
    metoda_aplicare: (row.metoda_aplicare as string | null) ?? null,
    parcela_nume: (row.parcela_nume as string | null) ?? null,
    nota: (row.nota as string | null) ?? null,
    created_at: String(row.created_at ?? ''),
    cantitate_aplicare: (row.cantitate_aplicare as string | null) ?? null,
  }))
}

export interface IesireAplicare {
  aplicare_id: string
  aplicare_produs_id: string
  produs_id: string
  cantitate: number
  unitate: string | null
}

/** Cât a scos fiecare aplicare (lista din Tratamente). Fără migrare: listă goală, fără eroare. */
export async function getIesiriAplicari(): Promise<IesireAplicare[]> {
  const { data, error } = await rpc(getSupabase(), 'magazie_iesiri_aplicari')
  if (error) {
    if (magazieLipsa(error)) return []
    throw eroare(error, 'Ieșirile din magazie nu s-au încărcat.')
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    aplicare_id: String(row.aplicare_id),
    aplicare_produs_id: String(row.aplicare_produs_id),
    produs_id: String(row.produs_id),
    cantitate: numar(row.cantitate) ?? 0,
    unitate: (row.unitate as string | null) ?? null,
  }))
}

export interface MiscareCuProdus extends MiscareStoc {
  id: string
  nume: string
  unitate: UnitateStoc | null
  furnizor: string | null
  nota: string | null
}

/**
 * Toate mișcările, cu numele produsului (doar proprietarul: RLS). Pentru Rapoarte și exportul „Magazia”.
 * Fără migrare: listă goală.
 */
export async function getMiscariMagazie(): Promise<MiscareCuProdus[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const unitati = new Map<string, UnitateStoc>()
  const produse = await table(supabase, 'magazie_produse').select('produs_id,unitate_stoc').eq('tenant_id', tenantId)
  if (produse.error) {
    if (magazieLipsa(produse.error)) return []
    throw eroare(produse.error, 'Magazia nu s-a încărcat.')
  }
  for (const row of (produse.data ?? []) as Array<{ produs_id: string; unitate_stoc: string }>) {
    if (esteUnitateStoc(row.unitate_stoc)) unitati.set(row.produs_id, row.unitate_stoc)
  }

  const rows: MiscareCuProdus[] = []
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await table(supabase, 'magazie_miscari')
      .select('id,produs_id,tip,cantitate,data,created_at,pret_total_lei,furnizor,nota,produs:produse_fitosanitare(nume_comercial)')
      .eq('tenant_id', tenantId)
      .order('data', { ascending: false })
      .range(from, from + 999)
    if (error) {
      if (magazieLipsa(error)) return []
      throw eroare(error, 'Mișcările nu s-au încărcat.')
    }
    const page = (data ?? []) as Array<Record<string, unknown> & { produs: { nume_comercial: string | null } | Array<{ nume_comercial: string | null }> | null }>
    for (const row of page) {
      const produs = Array.isArray(row.produs) ? row.produs[0] : row.produs
      rows.push({
        id: String(row.id),
        produs_id: String(row.produs_id),
        tip: row.tip as TipMiscare,
        cantitate: numar(row.cantitate) ?? 0,
        data: zi(row.data) ?? '',
        created_at: (row.created_at as string | null) ?? null,
        pret_total_lei: numar(row.pret_total_lei),
        furnizor: (row.furnizor as string | null) ?? null,
        nota: (row.nota as string | null) ?? null,
        nume: produs?.nume_comercial?.trim() || 'Produs',
        unitate: unitati.get(String(row.produs_id)) ?? null,
      })
    }
    if (page.length < 1000) break
  }
  return rows
}

// ─── Scrierea ────────────────────────────────────────────────────────────────────────────────────

/** Produsul intră în magazie (prima dată): unitatea lui. Un rând existent nu se schimbă. */
async function asiguraProdus(db: Db, tenantId: string, produsId: string, unitate: UnitateStoc): Promise<void> {
  const { error } = await table(db, 'magazie_produse').upsert(
    { tenant_id: tenantId, produs_id: produsId, unitate_stoc: unitate },
    { onConflict: 'tenant_id,produs_id', ignoreDuplicates: true },
  )
  if (error) throw eroare(error, 'Produsul nu a intrat în magazie.')
}

/** Inserarea unei mișcări cu cheie de idempotență: `23505` pe cheie = rândul există deja (reîncercare). */
async function insereazaMiscare(db: Db, row: Record<string, unknown>): Promise<void> {
  // Fără `select()`: operatorul nu are drept de citire pe tabel.
  const { error } = await table(db, 'magazie_miscari').insert(row)
  if (!error) return
  if (error.code === '23505') return
  throw eroare(error, 'Nu s-a salvat în magazie.')
}

export interface IntrareMagazie {
  /** Cheia formularului: `client_sync_id` al mișcării (și calea bonului). */
  clientSyncId: string
  /** Cheia cheltuielii (alta decât a mișcării, aceeași la reîncercare). */
  cheltuialaClientSyncId: string
  produs: { id: string; nume: string; tip: string | null }
  cantitate: number
  unitate: UnitateStoc
  data: string
  pretTotal: number | null
  furnizor: string | null
  bon: Blob | null
  treceLaCheltuieli: boolean
  esteProprietar: boolean
}

export interface IntrareRezultat {
  cheltuialaCreata: boolean
  bonSalvat: boolean
}

/**
 * „+ Am cumpărat”: produsul intră în magazie (cu unitatea), bonul se urcă în `bonuri`, cheltuiala se creează
 * (doar proprietarul, cu comutatorul pornit și cu preț), apoi mișcarea, legată de cheltuială.
 * O reîncercare cu aceleași chei nu dublează nici cheltuiala, nici mișcarea.
 */
export async function inregistreazaIntrare(input: IntrareMagazie): Promise<IntrareRezultat> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  await asiguraProdus(supabase, tenantId, input.produs.id, input.unitate)

  // Operatorul nu trimite prețul, bonul sau cheltuiala (politica RLS le refuză oricum).
  const pret = input.esteProprietar ? input.pretTotal : null
  let bonPath: string | null = null
  if (input.bon && input.esteProprietar) {
    bonPath = await uploadBon({ table: 'magazie', key: input.clientSyncId, blob: input.bon })
  }

  let cheltuialaId: string | null = null
  if (input.esteProprietar && input.treceLaCheltuieli && pret !== null && pret > 0) {
    const cheltuiala = await createCheltuiala({
      client_sync_id: input.cheltuialaClientSyncId,
      data: input.data,
      categorie: categorieCheltuiala(input.produs.tip),
      suma_lei: pret,
      furnizor: input.furnizor ?? undefined,
      descriere: descriereCheltuiala(input.produs.nume, input.cantitate, input.unitate),
      document_url: bonPath ?? undefined,
    })
    cheltuialaId = cheltuiala.id
  }

  const { data: userData } = await supabase.auth.getUser()
  await insereazaMiscare(supabase, {
    tenant_id: tenantId,
    produs_id: input.produs.id,
    tip: 'intrare',
    cantitate: input.cantitate,
    data: input.data,
    pret_total_lei: pret,
    furnizor: input.furnizor,
    bon_path: bonPath,
    cheltuiala_id: cheltuialaId,
    client_sync_id: input.clientSyncId,
    created_by: userData.user?.id ?? null,
  })
  return { cheltuialaCreata: cheltuialaId !== null, bonSalvat: bonPath !== null }
}

export interface NumarareMagazie {
  clientSyncId: string
  produsId: string
  /** Unitatea, doar pentru un produs care intră acum în magazie. */
  unitate: UnitateStoc
  cantitateReala: number
  /** Stocul de acum, din magazie (0 pentru un produs nou). */
  stocCurent: number
  data: string
}

/** Corecția „Am numărat” = cât ai de fapt − cât arată magazia. `0` = nimic de salvat. */
export function corectieDinNumarare(cantitateReala: number, stocCurent: number): number {
  return Math.round((cantitateReala - stocCurent) * 1000) / 1000
}

/** „Am numărat”: se salvează o corecție egală cu diferența. Întoarce corecția (0 = era deja corect). */
export async function inregistreazaNumarare(input: NumarareMagazie): Promise<number> {
  const corectie = corectieDinNumarare(input.cantitateReala, input.stocCurent)
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  await asiguraProdus(supabase, tenantId, input.produsId, input.unitate)
  if (corectie === 0) return 0
  const { data: userData } = await supabase.auth.getUser()
  await insereazaMiscare(supabase, {
    tenant_id: tenantId,
    produs_id: input.produsId,
    tip: 'corectie',
    cantitate: corectie,
    data: input.data,
    nota: 'Am numărat',
    client_sync_id: input.clientSyncId,
    created_by: userData.user?.id ?? null,
  })
  return corectie
}

/** Pragul „pe terminate” (`null` = implicit, cât pentru încă o aplicare). */
export async function schimbaPrag(produsId: string, prag: number | null): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { error } = await table(supabase, 'magazie_produse')
    .update({ prag_pe_terminate: prag })
    .eq('tenant_id', tenantId)
    .eq('produs_id', produsId)
  if (error) throw eroare(error, 'Pragul nu s-a salvat.')
}
