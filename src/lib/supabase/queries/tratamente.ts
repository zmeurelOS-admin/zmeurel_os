/**
 * Modulul Tratamente: citirea aplicărilor și a catalogului, salvarea unui tratament (o aplicare pe parcelă,
 * cu produsele ei), „Marchează făcut” și produsul nou al fermei.
 *
 * Coloanele din migrarea `20261121160000` (lot, rezervor, g/plantă, volumul pe parcelă) se trimit doar
 * când există (`schema-features`, grupul `tratamenteLot`). Până atunci totul merge, mai puțin gruparea
 * pe lot, protecția la dublare și volumul ținut pe parcelă.
 */
import { getSupabase } from '@/lib/supabase/client'
import { loadSchemaFeaturesSafe } from '@/lib/schema-features'
import { getTenantId } from '@/lib/tenant/get-tenant'
import type { AplicareDeSalvat } from '@/lib/tratamente/formular'
import type { AplicareRow, ProdusCatalog } from '@/lib/tratamente/model'

type Db = ReturnType<typeof getSupabase>
// Tabelele modulului nu au toate coloanele noi în tipurile generate: lucrăm cu forme proprii.
type LooseTable = {
  select: (columns: string) => LooseQuery
  insert: (rows: unknown) => LooseQuery
  update: (values: unknown) => LooseQuery
  delete: () => LooseQuery
}
type LooseQuery = PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }> & {
  select: (columns: string) => LooseQuery
  eq: (column: string, value: unknown) => LooseQuery
  in: (column: string, values: readonly unknown[]) => LooseQuery
  is: (column: string, value: null) => LooseQuery
  order: (column: string, options?: { ascending?: boolean }) => LooseQuery
  range: (from: number, to: number) => LooseQuery
  limit: (count: number) => LooseQuery
}
const table = (db: Db, name: string) => (db as unknown as { from: (name: string) => LooseTable }).from(name)

const PRODUS_ROW_COLS =
  'id,ordine,produs_id,produs_nume_manual,produs_nume_snapshot,substanta_activa_snapshot,tip_snapshot,frac_irac_snapshot,phi_zile_snapshot,doza_ml_per_hl,doza_l_per_ha,cantitate_totala,unitate_cantitate,cantitate_text'
const APLICARE_COLS =
  'id,parcela_id,status,data_planificata,data_aplicata,metoda_aplicare,tip_interventie,sursa,observatii,created_at,produs_id,produs_nume_manual,doza_ml_per_hl,doza_l_per_ha,meteo_snapshot'
const HEADER_PRODUS = 'produs:produse_fitosanitare(id,nume_comercial,substanta_activa,tip,frac_irac,phi_zile)'

function selectAplicari(cuColoaneNoi: boolean): string {
  const produse = cuColoaneNoi ? `${PRODUS_ROW_COLS},rezervor,doza_g_per_planta` : PRODUS_ROW_COLS
  return `${APLICARE_COLS}${cuColoaneNoi ? ',lot_id' : ''},${HEADER_PRODUS},produse:aplicari_tratament_produse(${produse})`
}

const toError = (error: { code?: string; message?: string }) =>
  Object.assign(new Error(error.message || 'Eroare la tratamente.'), { code: error.code })

const PAGE = 1000

/** Aplicările fermei (toate statusurile), cu produsele lor. Cele mai noi întâi. */
export async function getAplicariTratament(): Promise<AplicareRow[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { tratamenteLot } = await loadSchemaFeaturesSafe()

  const rows: AplicareRow[] = []
  for (let from = 0; from < 10 * PAGE; from += PAGE) {
    const { data, error } = await table(supabase, 'aplicari_tratament')
      .select(selectAplicari(tratamenteLot))
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) throw toError(error)
    const page = (data ?? []) as AplicareRow[]
    rows.push(
      ...page.map((row) => ({
        ...row,
        produse: Array.isArray(row.produse) ? row.produse : [],
        produs: Array.isArray(row.produs) ? (row.produs[0] ?? null) : row.produs,
      })),
    )
    if (page.length < PAGE) break
  }
  return rows
}

/** Catalogul: produsele globale (`tenant_id is null`) și ale fermei (RLS le alege). */
export async function getProduseFitosanitare(): Promise<ProdusCatalog[]> {
  const supabase = getSupabase()
  const { data, error } = await table(supabase, 'produse_fitosanitare')
    .select(
      'id,tenant_id,nume_comercial,substanta_activa,tip,frac_irac,doza_min_ml_per_hl,doza_max_ml_per_hl,doza_min_l_per_ha,doza_max_l_per_ha,phi_zile,nr_max_aplicari_per_sezon,interval_min_aplicari_zile,omologat_culturi,activ',
    )
    .eq('activ', true)
    .order('nume_comercial', { ascending: true })
  if (error) throw toError(error)
  return (data ?? []) as ProdusCatalog[]
}

export type TipProdusNou = 'fungicid' | 'insecticid' | 'acaricid' | 'foliar' | 'ingrasamant' | 'bioregulator' | 'erbicid' | 'altul'

/** „Nu e în listă”: produs nou al fermei. Dacă numele există deja la fermă, întoarce produsul existent. */
export async function creeazaProdusFerma(input: { nume: string; tip: TipProdusNou; phiZile: number | null }): Promise<ProdusCatalog> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const nume = input.nume.trim()
  const { data: userData } = await supabase.auth.getUser()

  const { data, error } = await table(supabase, 'produse_fitosanitare')
    .insert({
      tenant_id: tenantId,
      nume_comercial: nume,
      substanta_activa: '',
      tip: input.tip,
      phi_zile: input.phiZile,
      created_by: userData.user?.id ?? null,
    })
    .select('*')
  if (!error) return ((data as ProdusCatalog[]) ?? [])[0]
  if (error.code !== '23505') throw toError(error)

  const existing = await table(supabase, 'produse_fitosanitare').select('*').eq('tenant_id', tenantId).eq('nume_comercial', nume).limit(1)
  if (existing.error) throw toError(existing.error)
  const row = ((existing.data as ProdusCatalog[]) ?? [])[0]
  if (!row) throw toError(error)
  return row
}

export interface SalvareTratamentRezultat {
  aplicareIds: string[]
  /** `false` = migrarea nu e aplicată: aplicările nu au lot (câte un rând în jurnal pe parcelă). */
  cuLot: boolean
}

/**
 * Salvează tratamentul: întâi aplicările (o parcelă = o aplicare), apoi produsele lor.
 *
 * Cu migrarea aplicată, `lotId` (cheia formularului) e și cheia de idempotență: la o reîncercare (de ex.
 * după o eroare de rețea), aplicările deja create se găsesc după lot și nu se dublează, iar produsele se
 * adaugă doar unde lipsesc. Fără migrare: dacă produsele nu se pot salva, aplicările tocmai create se
 * șterg (încercare; operatorii nu au drept de ștergere), ca să nu rămână tratamente goale.
 */
export async function salveazaTratament(input: { lotId: string; aplicari: readonly AplicareDeSalvat[] }): Promise<SalvareTratamentRezultat> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { tratamenteLot } = await loadSchemaFeaturesSafe()
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id ?? null

  // 1. Aplicările deja create în acest lot (reîncercare).
  const existente = new Map<string, string>() // parcela_id → aplicare id
  const cuProduse = new Set<string>()
  if (tratamenteLot) {
    const { data, error } = await table(supabase, 'aplicari_tratament')
      .select('id,parcela_id,produse:aplicari_tratament_produse(id)')
      .eq('tenant_id', tenantId)
      .eq('lot_id', input.lotId)
    if (error) throw toError(error)
    for (const row of (data ?? []) as Array<{ id: string; parcela_id: string; produse: Array<{ id: string }> | null }>) {
      existente.set(row.parcela_id, row.id)
      if ((row.produse ?? []).length > 0) cuProduse.add(row.id)
    }
  }

  // 2. Aplicările care lipsesc.
  const deCreat = input.aplicari.filter((aplicare) => !existente.has(aplicare.parcela_id))
  const create: string[] = []
  if (deCreat.length > 0) {
    const rows = deCreat.map((aplicare) => {
      const { produse: _produse, ...antet } = aplicare
      void _produse
      return {
        ...antet,
        tenant_id: tenantId,
        created_by: userId,
        updated_by: userId,
        ...(tratamenteLot ? { lot_id: input.lotId } : {}),
      }
    })
    const { data, error } = await table(supabase, 'aplicari_tratament').insert(rows).select('id,parcela_id')
    if (error) {
      // Altă trimitere a aceluiași lot a ajuns între timp: o reîncercare o va găsi.
      throw toError(error)
    }
    for (const row of (data ?? []) as Array<{ id: string; parcela_id: string }>) {
      existente.set(row.parcela_id, row.id)
      create.push(row.id)
    }
  }

  // 3. Produsele, doar pe aplicările care nu le au încă.
  const produseRows = input.aplicari.flatMap((aplicare) => {
    const aplicareId = existente.get(aplicare.parcela_id)
    if (!aplicareId || cuProduse.has(aplicareId)) return []
    return aplicare.produse.map((produs) => {
      const { rezervor, doza_g_per_planta, ...rest } = produs
      return {
        ...rest,
        ...(tratamenteLot ? { rezervor, doza_g_per_planta } : {}),
        tenant_id: tenantId,
        aplicare_id: aplicareId,
      }
    })
  })
  if (produseRows.length > 0) {
    const { error } = await table(supabase, 'aplicari_tratament_produse').insert(produseRows)
    if (error) {
      if (!tratamenteLot && create.length > 0) {
        await table(supabase, 'aplicari_tratament').delete().in('id', create)
      }
      throw toError(error)
    }
  }

  return {
    aplicareIds: input.aplicari.map((aplicare) => existente.get(aplicare.parcela_id)).filter((id): id is string => Boolean(id)),
    cuLot: tratamenteLot,
  }
}

/** „Marchează făcut”: `status = 'aplicata'`, `data_aplicata` = acum. Pauza pornește din acest moment. */
export async function marcheazaFacut(aplicareIds: readonly string[], now: Date = new Date()): Promise<void> {
  if (aplicareIds.length === 0) return
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await table(supabase, 'aplicari_tratament')
    .update({ status: 'aplicata', data_aplicata: now.toISOString(), updated_by: userData.user?.id ?? null })
    .eq('tenant_id', tenantId)
    .eq('status', 'planificata')
    .in('id', aplicareIds)
  if (error) throw toError(error)
}

/**
 * Volumul de soluție învățat la primul tratament pe parcelă. Doar parcelele fără volum (nu suprascrie).
 * Fără migrare nu face nimic. Erorile (ex. operator fără drept pe parcele) nu opresc tratamentul.
 */
export async function salveazaVolumeParcele(volume: ReadonlyArray<{ id: string; volum: number }>): Promise<void> {
  if (volume.length === 0) return
  const { tratamenteLot } = await loadSchemaFeaturesSafe()
  if (!tratamenteLot) return
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  for (const item of volume) {
    await table(supabase, 'parcele')
      .update({ volum_solutie_l: item.volum })
      .eq('tenant_id', tenantId)
      .eq('id', item.id)
      .is('volum_solutie_l', null)
  }
}

/** Volumul salvat pe parcele (după migrare). Fără migrare: gol. */
export async function getVolumeParcele(): Promise<Record<string, number>> {
  const { tratamenteLot } = await loadSchemaFeaturesSafe()
  if (!tratamenteLot) return {}
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data, error } = await table(supabase, 'parcele').select('id,volum_solutie_l').eq('tenant_id', tenantId)
  if (error) return {}
  const result: Record<string, number> = {}
  for (const row of (data ?? []) as Array<{ id: string; volum_solutie_l: number | null }>) {
    const volum = Number(row.volum_solutie_l)
    if (Number.isFinite(volum) && volum > 0) result[row.id] = volum
  }
  return result
}

/** Planificarea renunțată: `status = 'anulata'` (rândul rămâne, nu se șterge). */
export async function anuleazaPlanificare(aplicareIds: readonly string[]): Promise<void> {
  if (aplicareIds.length === 0) return
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await table(supabase, 'aplicari_tratament')
    .update({ status: 'anulata', updated_by: userData.user?.id ?? null })
    .eq('tenant_id', tenantId)
    .eq('status', 'planificata')
    .in('id', aplicareIds)
  if (error) throw toError(error)
}
