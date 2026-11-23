/**
 * Partea de server a capcanelor (service role, doar citire): grupurile fermei, verificările, pragul și „în coacere”
 * pe parcelă. O folosesc alerta „Peste prag” (`/api/capcane/alerta`) și mementoul din verificarea de dimineață.
 * Coloanele noi lipsesc până la migrarea `20261123100000_capcane.sql`: atunci funcțiile întorc `null`.
 */
import { estimeazaCules } from '@/lib/analize/cules'
import type { getSupabaseAdmin } from '@/lib/supabase/admin'

import { inCoacere, type StadiuObservat } from './coacere'
import { normalizeStatus, normalizeTip, type GrupCapcane, type VerificareCapcana } from './model'
import { normalizeazaPraguri, type PraguriCapcane } from './prag'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = ReturnType<typeof getSupabaseAdmin> | any
type Err = { code?: string; message?: string } | null

const COLOANE_GRUP =
  'id,parcela_id,tip_capcana,nr_bucati,data_montare,data_urmatoarea_verificare,interval_verificare_zile,interval_atractant_zile,data_schimb_atractant,status,observatii,foto_url'

/** Tabelul sau o coloană nouă lipsesc (migrarea încă neaplicată). */
export function lipsaCapcane(error: Err): boolean {
  if (!error) return false
  if (['42P01', 'PGRST205', '42703', 'PGRST204'].includes(error.code ?? '')) return true
  return /does not exist|could not find the/i.test(error.message ?? '')
}

const zi = (value: unknown) => String(value ?? '').slice(0, 10)

function grup(row: Record<string, unknown>): GrupCapcane {
  return {
    id: String(row.id),
    parcela_id: String(row.parcela_id),
    tip: normalizeTip(row.tip_capcana as string | null),
    nr_bucati: Math.max(1, Number(row.nr_bucati) || 1),
    data_montare: zi(row.data_montare),
    data_urmatoarea_verificare: row.data_urmatoarea_verificare ? zi(row.data_urmatoarea_verificare) : null,
    interval_verificare_zile: Number(row.interval_verificare_zile) || 7,
    interval_atractant_zile: row.interval_atractant_zile == null ? null : Number(row.interval_atractant_zile) || null,
    data_schimb_atractant: row.data_schimb_atractant ? zi(row.data_schimb_atractant) : null,
    status: normalizeStatus(row.status as string | null),
    observatii: (row.observatii as string | null) ?? null,
    foto_url: (row.foto_url as string | null) ?? null,
  }
}

/** Grupurile active ale fermei (`null` = fără migrare). */
export async function grupuriActiveFerma(admin: Admin, tenantId: string): Promise<GrupCapcane[] | null> {
  const { data, error } = await admin.from('capcane_montate').select(COLOANE_GRUP).eq('tenant_id', tenantId).in('status', ['activa', 'activ'])
  if (error) {
    if (lipsaCapcane(error)) return null
    throw error
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map(grup)
}

/** Grupurile date (doar ale fermei) și verificările lor din `[de, pana]`. */
export async function grupuriCuVerificari(
  admin: Admin,
  tenantId: string,
  grupIds: readonly string[],
  de: string,
  pana: string,
): Promise<{ grupuri: GrupCapcane[]; verificari: VerificareCapcana[] } | null> {
  const grupuriRes = await admin.from('capcane_montate').select(COLOANE_GRUP).eq('tenant_id', tenantId).in('id', [...grupIds])
  if (grupuriRes.error) {
    if (lipsaCapcane(grupuriRes.error)) return null
    throw grupuriRes.error
  }
  const grupuri = ((grupuriRes.data ?? []) as Array<Record<string, unknown>>).map(grup)
  if (grupuri.length === 0) return { grupuri, verificari: [] }
  const verificariRes = await admin
    .from('capcane_verificari')
    .select('id,capcana_montata_id,data_verificare,capcana_nr,nr_capturati,atractant_schimbat,observatii,foto_url')
    .eq('tenant_id', tenantId)
    .in('capcana_montata_id', grupuri.map((g) => g.id))
    .gte('data_verificare', de)
    .lte('data_verificare', pana)
  if (verificariRes.error) {
    if (lipsaCapcane(verificariRes.error)) return null
    throw verificariRes.error
  }
  const verificari = ((verificariRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    grup_id: String(row.capcana_montata_id),
    data: zi(row.data_verificare),
    capcana_nr: row.capcana_nr == null ? null : Number(row.capcana_nr),
    capturi: Math.max(0, Number(row.nr_capturati) || 0),
    atractant_schimbat: row.atractant_schimbat === true,
    observatii: (row.observatii as string | null) ?? null,
    foto_url: (row.foto_url as string | null) ?? null,
  }))
  return { grupuri, verificari }
}

/** Pragurile fermei (implicitele, fără rând sau fără migrare). */
export async function praguriFerma(admin: Admin, tenantId: string): Promise<PraguriCapcane> {
  const { data, error } = await admin.from('tenant_settings').select('prag_capcane').eq('tenant_id', tenantId).maybeSingle()
  if (error) {
    if (lipsaCapcane(error)) return normalizeazaPraguri(null)
    throw error
  }
  return normalizeazaPraguri((data as { prag_capcane?: unknown } | null)?.prag_capcane)
}

/**
 * „În coacere” pentru parcelele date, în sezonul `an`: stadiile de pe fișa parcelei și data culesului (pusă de mână
 * sau din prima recoltare de anul trecut, `estimeazaCules`).
 */
export async function inCoacereParcele(admin: Admin, tenantId: string, parcelaIds: readonly string[], an: number): Promise<(parcelaId: string, ziua: string) => boolean> {
  const ids = [...new Set(parcelaIds)]
  if (ids.length === 0) return () => false

  const stadiiRes = await admin
    .from('stadii_fenologice_parcela')
    .select('parcela_id,stadiu,data_observata,cohort')
    .eq('tenant_id', tenantId)
    .eq('an', an)
    .in('parcela_id', ids)
  const stadii = new Map<string, StadiuObservat[]>()
  if (!stadiiRes.error) {
    for (const row of (stadiiRes.data ?? []) as Array<{ parcela_id: string; stadiu: string | null; data_observata: string | null; cohort: string | null }>) {
      const lista = stadii.get(row.parcela_id) ?? []
      lista.push({ stadiu: row.stadiu, data_observata: row.data_observata, cohort: row.cohort })
      stadii.set(row.parcela_id, lista)
    }
  }

  const manuale = new Map<string, string | null>()
  const culesRes = await admin.from('configurari_parcela_sezon').select('parcela_id,data_inceput_cules').eq('tenant_id', tenantId).eq('an', an).in('parcela_id', ids)
  if (!culesRes.error) {
    for (const row of (culesRes.data ?? []) as Array<{ parcela_id: string; data_inceput_cules: string | null }>) manuale.set(row.parcela_id, row.data_inceput_cules)
  }

  const recoltariRes = await admin
    .from('recoltari')
    .select('parcela_id,data')
    .eq('tenant_id', tenantId)
    .in('parcela_id', ids)
    .gte('data', `${an - 1}-01-01`)
    .lte('data', `${an - 1}-12-31`)
    .order('data', { ascending: true })
    .limit(2000)
  const recoltari = recoltariRes.error ? [] : ((recoltariRes.data ?? []) as Array<{ parcela_id: string | null; data: string }>)

  const cules = new Map(ids.map((id) => [id, estimeazaCules({ parcelaId: id, an, manual: manuale.get(id) ?? null, recoltari }).data]))
  return (parcelaId, ziua) => inCoacere({ stadii: stadii.get(parcelaId) ?? [], dataCules: cules.get(parcelaId) ?? null, zi: ziua })
}
