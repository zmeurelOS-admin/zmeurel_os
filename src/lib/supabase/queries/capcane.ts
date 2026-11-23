/**
 * Capcanele (promptul 29): grupurile montate pe parcele, verificările pe fiecare capcană, pragul pe fermă, pozele.
 *
 * Coloanele noi vin din migrarea `20261123100000_capcane.sql`. Până la aplicare, citirea aruncă
 * `CapcaneIndisponibileError` (tab-ul arată „după actualizarea bazei de date”); restul aplicației merge ca azi.
 *
 * Drepturile: citește proprietarul și operatorul cu „Tratamente”; montează / verifică / scoate cine are „Scrie”
 * pe Tratamente; șterge doar proprietarul (RLS).
 */
import { prepareBonImage } from '@/lib/bonuri'
import { getSupabase } from '@/lib/supabase/client'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { isMissingTableError } from '@/lib/notifications/preferinte'
import { isMissingColumnError } from '@/lib/schema-features'
import {
  grupuriDinMontare,
  normalizeStatus,
  normalizeTip,
  normalizeazaPraguri,
  praguriDeSalvat,
  randuriVerificare,
  type CapturaPas,
  type GrupCapcane,
  type PasVerificare,
  type PraguriCapcane,
  type TipCapcana,
  type VerificareCapcana,
} from '@/lib/capcane'

export const CAPCANE_BUCKET = 'capcane'
export const CAPCANE_INDISPONIBILE = 'Capcanele vor merge după actualizarea bazei de date.'

export class CapcaneIndisponibileError extends Error {
  constructor() {
    super(CAPCANE_INDISPONIBILE)
    this.name = 'CapcaneIndisponibileError'
  }
}

type DbError = { code?: string; message?: string; details?: string } | null
type Result = { data: unknown; error: DbError }
type LooseQuery = PromiseLike<Result> & {
  select: (columns: string) => LooseQuery
  eq: (column: string, value: unknown) => LooseQuery
  in: (column: string, values: unknown[]) => LooseQuery
  order: (column: string, options?: { ascending?: boolean }) => LooseQuery
  range: (from: number, to: number) => LooseQuery
  maybeSingle: () => PromiseLike<Result>
}
type LooseTable = {
  select: (columns: string) => LooseQuery
  insert: (rows: unknown) => LooseQuery
  update: (values: unknown) => LooseQuery
  upsert: (rows: unknown, options?: { onConflict?: string }) => LooseQuery
}
type Db = ReturnType<typeof getSupabase>
const table = (db: Db, name: string) => (db as unknown as { from: (name: string) => LooseTable }).from(name)

/** Tabelul sau o coloană nouă lipsesc: migrarea încă neaplicată. */
export function capcaneLipsa(error: DbError): boolean {
  if (!error) return false
  return isMissingTableError(error) || isMissingColumnError(error)
}

const eroare = (error: NonNullable<DbError>, implicit: string): Error => {
  if (capcaneLipsa(error)) return new CapcaneIndisponibileError()
  const message = error.message ?? ''
  if (error.code === '42501' || /row-level security/i.test(message)) return Object.assign(new Error('Nu ai drept de scriere pe tratamente.'), { code: error.code })
  return Object.assign(new Error(message || implicit), { code: error.code })
}

const zi = (value: unknown) => String(value ?? '').slice(0, 10)

const COLOANE_GRUP =
  'id,parcela_id,tip_capcana,nr_bucati,data_montare,data_urmatoarea_verificare,interval_verificare_zile,interval_atractant_zile,data_schimb_atractant,status,observatii,foto_url'

export function grupDinRand(row: Record<string, unknown>): GrupCapcane {
  return {
    id: String(row.id),
    parcela_id: String(row.parcela_id),
    tip: normalizeTip(row.tip_capcana as string | null),
    nr_bucati: Math.max(1, Number(row.nr_bucati) || 1),
    data_montare: zi(row.data_montare),
    data_urmatoarea_verificare: row.data_urmatoarea_verificare ? zi(row.data_urmatoarea_verificare) : null,
    interval_verificare_zile: Number(row.interval_verificare_zile) || 7,
    interval_atractant_zile: row.interval_atractant_zile === null || row.interval_atractant_zile === undefined ? null : Number(row.interval_atractant_zile) || null,
    data_schimb_atractant: row.data_schimb_atractant ? zi(row.data_schimb_atractant) : null,
    status: normalizeStatus(row.status as string | null),
    observatii: (row.observatii as string | null) ?? null,
    foto_url: (row.foto_url as string | null) ?? null,
  }
}

export function verificareDinRand(row: Record<string, unknown>): VerificareCapcana {
  return {
    id: String(row.id),
    grup_id: String(row.capcana_montata_id),
    data: zi(row.data_verificare),
    capcana_nr: row.capcana_nr === null || row.capcana_nr === undefined ? null : Number(row.capcana_nr),
    capturi: Math.max(0, Number(row.nr_capturati) || 0),
    atractant_schimbat: row.atractant_schimbat === true,
    observatii: (row.observatii as string | null) ?? null,
    foto_url: (row.foto_url as string | null) ?? null,
  }
}

export interface DateCapcane {
  grupuri: GrupCapcane[]
  verificari: VerificareCapcana[]
}

/** Toate grupurile fermei și verificările lor. Fără migrare: `CapcaneIndisponibileError`. */
export async function getCapcane(): Promise<DateCapcane> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const grupuriRes = await table(supabase, 'capcane_montate').select(COLOANE_GRUP).eq('tenant_id', tenantId).order('data_montare', { ascending: false })
  if (grupuriRes.error) throw eroare(grupuriRes.error, 'Capcanele nu s-au încărcat.')
  const grupuri = ((grupuriRes.data ?? []) as Array<Record<string, unknown>>).map(grupDinRand)

  const verificari: VerificareCapcana[] = []
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await table(supabase, 'capcane_verificari')
      .select('id,capcana_montata_id,data_verificare,capcana_nr,nr_capturati,atractant_schimbat,observatii,foto_url')
      .eq('tenant_id', tenantId)
      .order('data_verificare', { ascending: true })
      .range(from, from + 999)
    if (error) throw eroare(error, 'Verificările nu s-au încărcat.')
    const page = (data ?? []) as Array<Record<string, unknown>>
    verificari.push(...page.map(verificareDinRand))
    if (page.length < 1000) break
  }
  return { grupuri, verificari }
}

/** Datele, sau `null` dacă migrarea nu e aplicată (registrul, Acasă). */
export async function getCapcaneSauNimic(): Promise<DateCapcane | null> {
  try {
    return await getCapcane()
  } catch (error) {
    if (error instanceof CapcaneIndisponibileError) return null
    throw error
  }
}

// ─── Pragul ──────────────────────────────────────────────────────────────────────────────────────

/** Pragurile fermei (`tenant_settings.prag_capcane`); `disponibil: false` fără migrare (atunci implicitele). */
export async function getPraguriCapcane(): Promise<{ praguri: PraguriCapcane; disponibil: boolean }> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data, error } = await table(supabase, 'tenant_settings').select('prag_capcane').eq('tenant_id', tenantId).maybeSingle()
  if (error) {
    if (capcaneLipsa(error)) return { praguri: normalizeazaPraguri(null), disponibil: false }
    throw eroare(error, 'Pragul nu s-a încărcat.')
  }
  return { praguri: normalizeazaPraguri((data as { prag_capcane?: unknown } | null)?.prag_capcane), disponibil: true }
}

/** Salvează pragurile (doar proprietarul poate scrie în `tenant_settings`). */
export async function salveazaPraguriCapcane(praguri: PraguriCapcane): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { error } = await table(supabase, 'tenant_settings').upsert({ tenant_id: tenantId, prag_capcane: praguriDeSalvat(praguri) }, { onConflict: 'tenant_id' })
  if (error) throw eroare(error, 'Pragul nu s-a salvat.')
}

// ─── Pozele ──────────────────────────────────────────────────────────────────────────────────────

/** Urcă poza (micșorată, JPEG) în `capcane/<tenant>/<tip>-<cheie>.jpg`. Întoarce calea. */
export async function incarcaPozaCapcana(file: Blob, tip: 'montare' | 'verificare', cheie: string): Promise<string> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const blob = await prepareBonImage(file)
  const path = `${tenantId}/${tip}-${cheie}.jpg`
  const { error } = await supabase.storage.from(CAPCANE_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '60' })
  if (error) {
    if (/bucket not found|row-level security|unauthorized/i.test(error.message ?? '')) throw new Error('Poza nu s-a putut salva. Capcanele se salvează fără ea.')
    throw error
  }
  return path
}

/** Link semnat pe o oră (sau `null`). */
export async function linkPozaCapcana(path: string | null | undefined): Promise<string | null> {
  if (!path?.trim()) return null
  const { data, error } = await getSupabase().storage.from(CAPCANE_BUCKET).createSignedUrl(path.trim(), 60 * 60)
  if (error) return null
  return data?.signedUrl ?? null
}

// ─── Scrierea ────────────────────────────────────────────────────────────────────────────────────

export interface MontareCapcane {
  clientSyncId: string
  parcelaIds: string[]
  tip: TipCapcana
  nrBucati: number
  intervalVerificareZile: number
  dataMontare: string
  observatii: string | null
  poza: Blob | null
}

/**
 * „+ Montează”: câte un grup pe fiecare parcelă aleasă, cu cheia lui (derivată din cheia formularului). O reîncercare
 * cu aceeași cheie nu dublează: `23505` pe cheie = grupurile există deja. Poza (opțională) se urcă o dată și se pune
 * pe toate grupurile; dacă nu se poate urca, grupurile se salvează fără ea (`pozaSalvata: false`).
 */
export async function monteazaCapcane(input: MontareCapcane): Promise<{ grupuri: number; pozaSalvata: boolean }> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  let fotoPath: string | null = null
  let pozaSalvata = input.poza === null
  if (input.poza) {
    try {
      fotoPath = await incarcaPozaCapcana(input.poza, 'montare', input.clientSyncId)
      pozaSalvata = true
    } catch {
      pozaSalvata = false
    }
  }
  const { data: userData } = await supabase.auth.getUser()
  const randuri = grupuriDinMontare({
    tenantId,
    parcelaIds: input.parcelaIds,
    tip: input.tip,
    nrBucati: input.nrBucati,
    intervalVerificareZile: input.intervalVerificareZile,
    dataMontare: input.dataMontare,
    observatii: input.observatii,
    fotoPath,
    clientSyncId: input.clientSyncId,
    createdBy: userData.user?.id ?? null,
  })
  // Câte un rând pe rând: un grup salvat la o încercare anterioară (23505) nu le oprește pe celelalte.
  for (const rand of randuri) {
    const { error } = await table(supabase, 'capcane_montate').insert(rand)
    if (error && error.code !== '23505') throw eroare(error, 'Capcanele nu s-au salvat.')
  }
  return { grupuri: randuri.length, pozaSalvata }
}

export interface VerificareSalvata {
  clientSyncId: string
  data: string
  pasi: readonly PasVerificare[]
  raspunsuri: ReadonlyMap<string, CapturaPas>
  pestePragPeGrup: ReadonlyMap<string, boolean>
}

/**
 * „Verifică acum”: câte un rând pe capcană, aceeași dată și aceeași cheie. Rândurile unui grup pleacă împreună
 * (o inserare = toate sau nimic), deci `23505` pe cheie = grupul era deja salvat (reîncercare). Triggerul din baza
 * de date mută apoi `data_urmatoarea_verificare` și ziua schimbării atractantului.
 */
export async function salveazaVerificare(input: VerificareSalvata): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data: userData } = await supabase.auth.getUser()
  const randuri = randuriVerificare({
    tenantId,
    data: input.data,
    clientSyncId: input.clientSyncId,
    createdBy: userData.user?.id ?? null,
    pasi: input.pasi,
    raspunsuri: input.raspunsuri,
    pestePragPeGrup: input.pestePragPeGrup,
  })
  const peGrup = new Map<string, typeof randuri>()
  for (const rand of randuri) {
    const lista = peGrup.get(rand.capcana_montata_id) ?? []
    lista.push(rand)
    peGrup.set(rand.capcana_montata_id, lista)
  }
  for (const lista of peGrup.values()) {
    const { error } = await table(supabase, 'capcane_verificari').insert(lista)
    if (error && error.code !== '23505') throw eroare(error, 'Verificarea nu s-a salvat.')
  }
}

/**
 * Alerta „Peste prag” (doar proprietarului, push + în aplicație): serverul recitește verificările, recalculează
 * pragul și trimite. Nu oprește salvarea dacă nu răspunde.
 */
export async function anuntaPestePrag(grupIds: readonly string[], data: string): Promise<void> {
  if (grupIds.length === 0) return
  try {
    await fetch('/api/capcane/alerta', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ grup_ids: grupIds, data }),
    })
  } catch {
    // Alerta e un plus: verificarea e deja salvată.
  }
}

/** „Scoate capcanele”: grupul devine `scoasa` (rămâne în istoric și în registru). */
export async function scoateCapcanele(grupId: string): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { error } = await table(supabase, 'capcane_montate')
    .update({ status: 'scoasa', updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', grupId)
  if (error) throw eroare(error, 'Nu s-a salvat.')
}
