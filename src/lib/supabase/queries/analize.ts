/**
 * Analizele la fructe (Tratamente → Analize): citire, creare (cu `client_sync_id`), prelevarea, rezultatul,
 * opțiunile raportului, fișierele (bucket privat `analize`), data culesului pusă de mână și mementoul.
 *
 * Tabelele vin din migrarea `20261122110000_analize_fructe.sql` (mementoul și data culesului din
 * `20261122111000_cules_memento_analize.sql`). Până la aplicare, citirea aruncă `AnalizeIndisponibileError`
 * (ecranul arată „după actualizarea bazei de date”), iar restul aplicației merge.
 */
import { prepareBonImage } from '@/lib/bonuri'
import { normalizeazaOptiuni, type AnalizaRow, type OptiuniPublice, type SubstantaAnaliza } from '@/lib/analize/model'
import { isMissingTableError } from '@/lib/notifications/preferinte'
import { isMissingColumnError } from '@/lib/schema-features'
import { getSupabase } from '@/lib/supabase/client'
import { getTenantId } from '@/lib/tenant/get-tenant'

export const ANALIZE_BUCKET = 'analize'
export const ANALIZE_INDISPONIBILE = 'Analizele vor merge după actualizarea bazei de date.'

export class AnalizeIndisponibileError extends Error {
  constructor() {
    super(ANALIZE_INDISPONIBILE)
    this.name = 'AnalizeIndisponibileError'
  }
}

type DbError = { code?: string; message?: string; details?: string } | null
type LooseQuery = PromiseLike<{ data: unknown; error: DbError }> & {
  select: (columns: string) => LooseQuery
  eq: (column: string, value: unknown) => LooseQuery
  in: (column: string, values: readonly unknown[]) => LooseQuery
  gte: (column: string, value: unknown) => LooseQuery
  lte: (column: string, value: unknown) => LooseQuery
  order: (column: string, options?: { ascending?: boolean }) => LooseQuery
  limit: (count: number) => LooseQuery
  maybeSingle: () => PromiseLike<{ data: unknown; error: DbError }>
  single: () => PromiseLike<{ data: unknown; error: DbError }>
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

const lipsa = (error: DbError) => isMissingTableError(error) || isMissingColumnError(error)
const eroare = (error: NonNullable<DbError>, implicit: string) =>
  Object.assign(new Error(/row-level security|42501/i.test(error.message ?? '') ? 'Nu ai drept de scriere pe tratamente.' : error.message || implicit), {
    code: error.code,
  })

const COLOANE =
  'id,tenant_id,client_sync_id,created_at,updated_at,data_prelevare,pv_numar,pv_poza_path,prelevat_de,laborator,data_predare,nota,status,buletin_numar,buletin_data,buletin_path,ce_s_a_analizat,rest_nedetectate,public_token,public_activ,public_optiuni'
const SELECT_ANALIZA = `${COLOANE},parcele:analize_fructe_parcele(parcela_id),substante:analize_fructe_substante(id,substanta,valoare_mg_kg,lmr_mg_kg,ordine)`

type RandBrut = Omit<AnalizaRow, 'parcele' | 'substante'> & {
  parcele?: Array<{ parcela_id: string }> | null
  substante?: SubstantaAnaliza[] | null
}

function dinRand(rand: RandBrut): AnalizaRow {
  return {
    ...rand,
    parcele: (rand.parcele ?? []).map((item) => item.parcela_id),
    substante: [...(rand.substante ?? [])]
      .map((s) => ({ ...s, valoare_mg_kg: s.valoare_mg_kg === null ? null : Number(s.valoare_mg_kg), lmr_mg_kg: s.lmr_mg_kg === null ? null : Number(s.lmr_mg_kg) }))
      .sort((a, b) => a.ordine - b.ordine),
  }
}

/** Analizele fermei, cele mai noi întâi. Operatorul le vede doar cu „Tratamente” (RLS). */
export async function getAnalize(): Promise<AnalizaRow[]> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data, error } = await table(supabase, 'analize_fructe')
    .select(SELECT_ANALIZA)
    .eq('tenant_id', tenantId)
    .order('data_prelevare', { ascending: false })
    .limit(500)
  if (error) {
    if (lipsa(error)) throw new AnalizeIndisponibileError()
    throw eroare(error, 'Analizele nu s-au încărcat.')
  }
  return ((data ?? []) as RandBrut[]).map(dinRand)
}

async function analizaDupaId(id: string): Promise<AnalizaRow> {
  const supabase = getSupabase()
  const { data, error } = await table(supabase, 'analize_fructe').select(SELECT_ANALIZA).eq('id', id).single()
  if (error) throw eroare(error, 'Analiza nu s-a încărcat.')
  return dinRand(data as RandBrut)
}

export interface PrelevareInput {
  parcelaIds: string[]
  data_prelevare: string
  pv_numar: string | null
  pv_poza_path: string | null
  prelevat_de: 'dsvsa' | 'laborator' | 'eu' | null
  laborator: string | null
  data_predare: string | null
  nota: string | null
}

const curat = (valoare: string | null | undefined) => valoare?.trim() || null

function campuriPrelevare(input: PrelevareInput) {
  return {
    data_prelevare: input.data_prelevare,
    pv_numar: curat(input.pv_numar),
    pv_poza_path: curat(input.pv_poza_path),
    prelevat_de: input.prelevat_de,
    laborator: curat(input.laborator)?.replace(/\s+/g, ' ') ?? null,
    data_predare: input.data_predare || null,
    nota: curat(input.nota),
  }
}

async function scrieParcele(analizaId: string, tenantId: string, parcelaIds: readonly string[]) {
  const supabase = getSupabase()
  if (parcelaIds.length === 0) return
  const { error } = await table(supabase, 'analize_fructe_parcele').upsert(
    parcelaIds.map((parcela_id) => ({ analiza_id: analizaId, parcela_id, tenant_id: tenantId })),
    { onConflict: 'analiza_id,parcela_id', ignoreDuplicates: true },
  )
  if (error) throw eroare(error, 'Parcelele analizei nu s-au salvat.')
}

/**
 * „Analiză nouă”: o analiză „la laborator”, cu parcelele ei. `clientSyncId` = cheia formularului: o reîncercare
 * (sau un 23505 pe cheie) găsește analiza deja creată și doar completează parcelele.
 */
export async function creeazaAnaliza(input: PrelevareInput & { clientSyncId: string }): Promise<AnalizaRow> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data: userData } = await supabase.auth.getUser()

  const existent = async (): Promise<string | null> => {
    const { data, error } = await table(supabase, 'analize_fructe')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('client_sync_id', input.clientSyncId)
      .maybeSingle()
    if (error) throw eroare(error, 'Nu am putut verifica salvarea.')
    return (data as { id: string } | null)?.id ?? null
  }

  let id = await existent()
  if (!id) {
    const { data, error } = await table(supabase, 'analize_fructe')
      .insert({
        tenant_id: tenantId,
        client_sync_id: input.clientSyncId,
        created_by: userData.user?.id ?? null,
        status: 'la_laborator',
        ...campuriPrelevare(input),
      })
      .select('id')
      .single()
    if (error) {
      if (lipsa(error)) throw new AnalizeIndisponibileError()
      if (error.code !== '23505') throw eroare(error, 'Analiza nu s-a salvat.')
      id = await existent()
      if (!id) throw eroare(error, 'Analiza nu s-a salvat.')
    } else {
      id = (data as { id: string }).id
    }
  }
  await scrieParcele(id, tenantId, input.parcelaIds)
  return analizaDupaId(id)
}

/** „Editează prelevarea”: câmpurile și parcelele (cele scoase se șterg, cele noi se adaugă). */
export async function actualizeazaPrelevarea(id: string, input: PrelevareInput): Promise<AnalizaRow> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { error } = await table(supabase, 'analize_fructe')
    .update({ ...campuriPrelevare(input), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
  if (error) throw eroare(error, 'Prelevarea nu s-a salvat.')

  const actuale = await analizaDupaId(id)
  const scoase = actuale.parcele.filter((parcelaId) => !input.parcelaIds.includes(parcelaId))
  if (scoase.length > 0) {
    const { error: delError } = await table(supabase, 'analize_fructe_parcele').delete().eq('analiza_id', id).in('parcela_id', scoase)
    if (delError) throw eroare(delError, 'Parcelele analizei nu s-au salvat.')
  }
  await scrieParcele(id, tenantId, input.parcelaIds.filter((parcelaId) => !actuale.parcele.includes(parcelaId)))
  return analizaDupaId(id)
}

export interface RezultatInput {
  status: 'conform' | 'neconform'
  buletin_numar: string | null
  buletin_data: string | null
  buletin_path: string | null
  ce_s_a_analizat: string | null
  rest_nedetectate: boolean
  substante: Array<{ substanta: string; valoare_mg_kg: number | null; lmr_mg_kg: number | null }>
}

/** „Rezultatul”: verdictul, buletinul și substanțele (înlocuite cu lista din formular). Neconform oprește linkul public. */
export async function salveazaRezultat(id: string, input: RezultatInput): Promise<AnalizaRow> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { error } = await table(supabase, 'analize_fructe')
    .update({
      status: input.status,
      buletin_numar: curat(input.buletin_numar),
      buletin_data: input.buletin_data || null,
      buletin_path: curat(input.buletin_path),
      ce_s_a_analizat: curat(input.ce_s_a_analizat),
      rest_nedetectate: input.rest_nedetectate,
      ...(input.status === 'neconform' ? { public_activ: false } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
  if (error) throw eroare(error, 'Rezultatul nu s-a salvat.')

  const { error: delError } = await table(supabase, 'analize_fructe_substante').delete().eq('analiza_id', id)
  if (delError) throw eroare(delError, 'Substanțele nu s-au salvat.')
  const substante = input.substante.filter((s) => s.substanta.trim())
  if (substante.length > 0) {
    const { error: insError } = await table(supabase, 'analize_fructe_substante').insert(
      substante.map((s, ordine) => ({
        analiza_id: id,
        tenant_id: tenantId,
        substanta: s.substanta.trim(),
        valoare_mg_kg: s.valoare_mg_kg,
        lmr_mg_kg: s.lmr_mg_kg,
        ordine,
      })),
    )
    if (insError) throw eroare(insError, 'Substanțele nu s-au salvat.')
  }
  return analizaDupaId(id)
}

/** „Ce apare în raport” pe o analiză și „Linkul public e activ”. */
export async function salveazaOptiuniAnaliza(id: string, input: { public_activ?: boolean; public_optiuni?: Partial<OptiuniPublice> | null }): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const valori: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.public_activ !== undefined) valori.public_activ = input.public_activ
  if (input.public_optiuni !== undefined) valori.public_optiuni = input.public_optiuni
  const { error } = await table(supabase, 'analize_fructe').update(valori).eq('id', id).eq('tenant_id', tenantId)
  if (error) throw eroare(error, 'Nu s-a salvat.')
}

/** Implicitele raportului, pe fermă (`tenant_settings.analize_public_implicit`). `null` = ale aplicației. */
export async function getOptiuniFerma(): Promise<{ optiuni: Partial<OptiuniPublice>; disponibil: boolean }> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data, error } = await table(supabase, 'tenant_settings').select('analize_public_implicit').eq('tenant_id', tenantId).maybeSingle()
  if (error) {
    if (lipsa(error)) return { optiuni: {}, disponibil: false }
    throw eroare(error, 'Nu am putut citi setările.')
  }
  return { optiuni: normalizeazaOptiuni((data as { analize_public_implicit?: unknown } | null)?.analize_public_implicit), disponibil: true }
}

/** Salvează implicitele fermei (doar proprietarul poate scrie în `tenant_settings`). */
export async function salveazaOptiuniFerma(optiuni: Partial<OptiuniPublice>): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { error } = await table(supabase, 'tenant_settings').upsert({ tenant_id: tenantId, analize_public_implicit: optiuni }, { onConflict: 'tenant_id' })
  if (error) throw eroare(error, 'Nu s-a salvat.')
}

// ─── Fișierele (poza PV, buletinul) ─────────────────────────────────────────────────────────────────

/** Urcă poza (micșorată, JPEG) sau PDF-ul în `analize/<tenant>/<tip>-<cheie>.<ext>`. Întoarce calea. */
export async function incarcaFisierAnaliza(file: File, tip: 'pv' | 'buletin'): Promise<string> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const pdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (pdf && file.size > 10 * 1024 * 1024) throw new Error('PDF-ul are peste 10 MB.')
  const blob = pdf ? file : await prepareBonImage(file)
  const path = `${tenantId}/${tip}-${crypto.randomUUID()}.${pdf ? 'pdf' : 'jpg'}`
  const { error } = await supabase.storage.from(ANALIZE_BUCKET).upload(path, blob, {
    contentType: pdf ? 'application/pdf' : 'image/jpeg',
    upsert: false,
    cacheControl: '60',
  })
  if (error) {
    if (/bucket not found/i.test(error.message ?? '')) throw new Error(ANALIZE_INDISPONIBILE)
    throw error
  }
  return path
}

/** Link semnat pe o oră (sau `null`). */
export async function linkFisierAnaliza(path: string | null | undefined): Promise<string | null> {
  if (!path?.trim()) return null
  const { data, error } = await getSupabase().storage.from(ANALIZE_BUCKET).createSignedUrl(path.trim(), 60 * 60)
  if (error) return null
  return data?.signedUrl ?? null
}

// ─── Data culesului (pe fișa parcelei) ─────────────────────────────────────────────────────────────

/** Datele puse de mână pentru sezonul `an` (`parcela_id → data`). `disponibil: false` fără migrare. */
export async function getDateCules(an: number): Promise<{ date: Record<string, string>; disponibil: boolean }> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data, error } = await table(supabase, 'configurari_parcela_sezon')
    .select('parcela_id,data_inceput_cules')
    .eq('tenant_id', tenantId)
    .eq('an', an)
  if (error) {
    if (lipsa(error)) return { date: {}, disponibil: false }
    throw eroare(error, 'Nu am putut citi data culesului.')
  }
  const date: Record<string, string> = {}
  for (const row of (data ?? []) as Array<{ parcela_id: string; data_inceput_cules: string | null }>) {
    if (row.data_inceput_cules) date[row.parcela_id] = row.data_inceput_cules
  }
  return { date, disponibil: true }
}

/** „Culesul începe pe ~… · Schimbă”: salvează (sau golește) data pentru sezonul `an`. */
export async function salveazaDataCules(parcelaId: string, an: number, data: string | null): Promise<void> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { error } = await table(supabase, 'configurari_parcela_sezon').upsert(
    { tenant_id: tenantId, parcela_id: parcelaId, an, data_inceput_cules: data, updated_at: new Date().toISOString() },
    { onConflict: 'parcela_id,an' },
  )
  if (error) {
    if (lipsa(error)) throw new Error('Data culesului se poate salva după actualizarea bazei de date.')
    throw eroare(error, 'Data culesului nu s-a salvat.')
  }
}

// ─── Mementoul (starea pe sezon) ───────────────────────────────────────────────────────────────────

export interface StareMementoSezon {
  disponibil: boolean
  dezactivat: boolean
  amanatPana: string | null
}

/** Doar proprietarul (RLS). Operatorul primește „nimic” (fără card). */
export async function getStareMemento(an: number): Promise<StareMementoSezon> {
  const supabase = getSupabase()
  const tenantId = await getTenantId(supabase)
  const { data, error } = await table(supabase, 'memento_analize_sezon')
    .select('dezactivat,amanat_pana')
    .eq('tenant_id', tenantId)
    .eq('an', an)
    .maybeSingle()
  if (error) {
    if (lipsa(error)) return { disponibil: false, dezactivat: false, amanatPana: null }
    throw eroare(error, 'Nu am putut citi mementoul.')
  }
  const row = data as { dezactivat?: boolean; amanat_pana?: string | null } | null
  return { disponibil: true, dezactivat: row?.dezactivat === true, amanatPana: row?.amanat_pana ?? null }
}

async function postMemento(cale: string, body: Record<string, unknown>): Promise<{ amanatPana?: string | null; dezactivat?: boolean }> {
  const response = await fetch(cale, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await response.json().catch(() => null)) as { ok?: boolean; data?: { amanatPana?: string | null; dezactivat?: boolean }; error?: { message?: string } } | null
  if (!response.ok || !json?.ok) throw new Error(json?.error?.message ?? 'Nu s-a salvat. Încearcă din nou.')
  return json.data ?? {}
}

/** „Amână N zile” (aceeași rută ca butonul din notificare). */
export function amanaMemento(zile: number) {
  return postMemento('/api/analize/memento/amana', { zile })
}

/** „Nu fac analize anul acesta” (sau repornirea lui). */
export function setNuFacAnalizeAnulAcesta(dezactivat: boolean) {
  return postMemento('/api/analize/memento/sezon', { dezactivat })
}
