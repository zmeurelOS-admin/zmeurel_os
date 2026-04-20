import { createClient } from '@/lib/supabase/server'
import type { CropCod } from '@/lib/crops/crop-codes'
import { normalizeCropCod } from '@/lib/crops/crop-codes'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import type { Cohorta } from '@/lib/tratamente/configurare-sezon'
import { buildConformitateMetrici } from '@/lib/tratamente/conformitate/build-metrici'
import type { ConformitateMetrici } from '@/lib/tratamente/conformitate/types'
import { getMeteoSnapshot } from '@/lib/tratamente/meteo'
import {
  normalizeStadiu,
  type GrupBiologic,
  type StadiuCod,
} from '@/lib/tratamente/stadii-canonic'
import { getStadiuOrdine } from '@/lib/tratamente/stadiu-ordering'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'
import type { Database, Json, Tables, TablesInsert, TablesUpdate } from '@/types/supabase'

export type ProdusFitosanitar = Tables<'produse_fitosanitare'>
export type ProdusFitosanitarInsert = TablesInsert<'produse_fitosanitare'>
export type ProdusFitosanitarUpdate = TablesUpdate<'produse_fitosanitare'>
export type CropCatalog = Tables<'crops'>

export type PlanTratament = Tables<'planuri_tratament'>
export type PlanTratamentInsert = TablesInsert<'planuri_tratament'>
export type PlanTratamentUpdate = TablesUpdate<'planuri_tratament'>

export type PlanTratamentLinie = Tables<'planuri_tratament_linii'>
export type PlanTratamentLinieInsert = TablesInsert<'planuri_tratament_linii'>
export type PlanTratamentLinieUpdate = TablesUpdate<'planuri_tratament_linii'>

export type ParcelaPlan = Tables<'parcele_planuri'>
export type ParcelaPlanInsert = TablesInsert<'parcele_planuri'>
export type ParcelaPlanUpdate = TablesUpdate<'parcele_planuri'>

export type StadiuFenologicParcela = Tables<'stadii_fenologice_parcela'>
export type StadiuFenologicParcelaInsert = TablesInsert<'stadii_fenologice_parcela'>
export type StadiuFenologicParcelaUpdate = TablesUpdate<'stadii_fenologice_parcela'>

export type AplicareTratament = Tables<'aplicari_tratament'>
export type AplicareTratamentInsert = TablesInsert<'aplicari_tratament'>
export type AplicareTratamentUpdate = TablesUpdate<'aplicari_tratament'>

export type AplicareTratamentMeteoSnapshot = Json

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

const PRODUS_SELECT =
  'id,tenant_id,nume_comercial,substanta_activa,tip,frac_irac,doza_min_ml_per_hl,doza_max_ml_per_hl,doza_min_l_per_ha,doza_max_l_per_ha,phi_zile,nr_max_aplicari_per_sezon,interval_min_aplicari_zile,omologat_culturi,activ,created_at,updated_at,created_by'

const PRODUS_LOOKUP_SELECT =
  'id,tenant_id,nume_comercial,substanta_activa,tip,frac_irac,phi_zile,nr_max_aplicari_per_sezon,activ'

const PLAN_SELECT =
  'id,tenant_id,nume,cultura_tip,descriere,activ,arhivat,created_at,updated_at,created_by,updated_by'

const LINIE_SELECT =
  'id,tenant_id,plan_id,ordine,stadiu_trigger,cohort_trigger,produs_id,produs_nume_manual,doza_ml_per_hl,doza_l_per_ha,observatii,created_at,updated_at'

const PARCELA_PLAN_SELECT =
  'id,tenant_id,parcela_id,plan_id,an,activ,created_at,updated_at'

const STADIU_SELECT =
  'id,tenant_id,parcela_id,an,stadiu,cohort,data_observata,sursa,observatii,created_at,updated_at,created_by'

const APLICARE_SELECT =
  'id,tenant_id,parcela_id,cultura_id,plan_linie_id,produs_id,produs_nume_manual,data_planificata,data_aplicata,doza_ml_per_hl,doza_l_per_ha,cantitate_totala_ml,stoc_mutatie_id,status,meteo_snapshot,stadiu_la_aplicare,cohort_la_aplicare,observatii,operator,created_at,updated_at,created_by,updated_by'

const CROP_SELECT = 'id,cod,name,unit_type,tenant_id,grup_biologic,created_at'

export interface InsertTenantProdus {
  nume_comercial: string
  substanta_activa: string
  tip: ProdusFitosanitar['tip']
  frac_irac?: string | null
  doza_min_ml_per_hl?: number | null
  doza_max_ml_per_hl?: number | null
  doza_min_l_per_ha?: number | null
  doza_max_l_per_ha?: number | null
  phi_zile?: number | null
  nr_max_aplicari_per_sezon?: number | null
  interval_min_aplicari_zile?: number | null
  omologat_culturi?: string[] | null
  activ?: boolean
}

export interface PlanTratamentLinieCuProdus extends PlanTratamentLinie {
  produs: ProdusFitosanitar | null
}

export interface PlanTratamentCuLinii extends PlanTratament {
  linii: PlanTratamentLinieCuProdus[]
}

export interface CreatePlanTratamentInput {
  nume: string
  cultura_tip: string
  descriere?: string | null
  activ?: boolean
  arhivat?: boolean
}

export interface CreatePlanTratamentLinieInput {
  ordine?: number
  stadiu_trigger: string
  cohort_trigger?: Cohorta | null
  produs_id?: string | null
  produs_nume_manual?: string | null
  doza_ml_per_hl?: number | null
  doza_l_per_ha?: number | null
  observatii?: string | null
}

export interface ParcelaCuPlanActiv extends ParcelaPlan {
  parcela: Pick<Database['public']['Tables']['parcele']['Row'], 'id' | 'id_parcela' | 'nume_parcela' | 'suprafata_m2'> | null
  plan: Pick<PlanTratament, 'id' | 'nume' | 'cultura_tip' | 'activ'> | null
}

export interface PlanActivParcela extends ParcelaPlan {
  plan: PlanTratament | null
}

export interface PlanTratamentParcelaAsociata {
  id: string
  tenant_id: string
  parcela_id: string
  plan_id: string
  an: number
  activ: boolean
  created_at: string
  updated_at: string
  parcela_nume: string | null
  parcela_cod: string | null
  suprafata_m2: number | null
}

export interface PlanTratamentComplet extends PlanTratament {
  linii: PlanTratamentLinieCuProdus[]
  parcele_asociate: PlanTratamentParcelaAsociata[]
}

export interface PlanTratamentListItem extends PlanTratament {
  linii_count: number
  parcele_asociate: PlanTratamentParcelaAsociata[]
}

export interface PlanTratamentRpcPayload {
  plan: PlanTratament
  linii: PlanTratamentLinie[]
  parcele_asociate: PlanTratamentParcelaAsociata[]
}

export interface UpsertPlanTratamentPayload {
  id?: string | null
  nume: string
  cultura_tip: string
  descriere?: string | null
  activ?: boolean
  arhivat?: boolean
}

export interface PlanTratamentLiniePayload {
  ordine: number
  stadiu_trigger: string
  cohort_trigger?: Cohorta | null
  produs_id?: string | null
  produs_nume_manual?: string | null
  doza_ml_per_hl?: number | null
  doza_l_per_ha?: number | null
  observatii?: string | null
}

export interface LiniePlanContext {
  id: string
  plan_id: string
  stadiu_trigger: string
  cohort_trigger: Cohorta | null
}

export interface PlanWizardParcelaOption {
  id: string
  id_parcela: string | null
  nume_parcela: string | null
  suprafata_m2: number | null
  cultura_tip: string | null
  tip_fruct: string | null
  active_planuri: Array<{ plan_id: string; plan_nume: string | null; an: number }>
}

export interface ParcelaTratamenteContext {
  id: string
  id_parcela: string | null
  nume_parcela: string | null
  cultura: string | null
  tip_fruct: string | null
  soi: string | null
  tip_unitate: string | null
  suprafata_m2: number | null
}

export interface AplicareTratamentDetaliu extends AplicareTratament {
  produs: Pick<ProdusFitosanitar, 'id' | 'tenant_id' | 'nume_comercial' | 'substanta_activa' | 'tip' | 'frac_irac' | 'phi_zile' | 'nr_max_aplicari_per_sezon' | 'activ'> | null
  linie: PlanTratamentLinie | null
  parcela: Pick<Database['public']['Tables']['parcele']['Row'], 'id' | 'id_parcela' | 'nume_parcela' | 'suprafata_m2'> | null
}

export interface AplicareCrossParcelItem {
  id: string
  tenant_id: string
  parcela_id: string
  cultura_id: string | null
  plan_linie_id: string | null
  produs_id: string | null
  produs_nume_manual: string | null
  data_programata: string | null
  data_planificata: string | null
  data_aplicata: string | null
  status: AplicareTratament['status']
  parcela_nume: string | null
  parcela_cod: string | null
  parcela_suprafata_m2: number | null
  parcela_lat: number | null
  parcela_lng: number | null
  plan_id: string | null
  plan_nume: string | null
  plan_arhivat: boolean | null
  linie_id: string | null
  stadiu_trigger: string | null
  cohort_trigger?: Cohorta | null
  cohort_la_aplicare?: Cohorta | null
  produs_nume: string
  produs_tip: ProdusFitosanitar['tip'] | null
  produs_frac: string | null
  produs_phi_zile: number | null
  doza_ml_per_hl: number | null
  doza_l_per_ha: number | null
  observatii: string | null
  operator: string | null
  meteo_snapshot: Json | null
  phi_warning: boolean
  urmatoarea_recoltare: string | null
}

export interface AplicareAgregata {
  id: string
  tenant_id: string
  parcela_id: string
  parcela_nume: string | null
  parcela_cod: string | null
  parcela_suprafata_m2: number | null
  suprafata_ha: number | null
  produs_id: string | null
  produs_nume: string
  produs_tip: ProdusFitosanitar['tip'] | null
  produs_frac: string | null
  produs_phi_zile: number | null
  substanta_activa: string | null
  plan_id: string | null
  plan_nume: string | null
  linie_id: string | null
  stadiu_trigger: string | null
  cohort_trigger?: Cohorta | null
  stadiu_la_aplicare: string | null
  cohort_la_aplicare?: Cohorta | null
  data_planificata: string | null
  data_aplicata: string | null
  status: AplicareTratament['status']
  doza_ml_per_hl: number | null
  doza_l_per_ha: number | null
  cantitate_totala_ml: number | null
  observatii: string | null
  operator: string | null
}

export interface AplicariAnualeParcelaGroup {
  parcela: Pick<
    Database['public']['Tables']['parcele']['Row'],
    'id' | 'id_parcela' | 'nume_parcela' | 'suprafata_m2' | 'cultura' | 'tip_fruct' | 'soi' | 'tip_unitate'
  >
  aplicari: AplicareAgregata[]
}

export interface InsertStadiu {
  parcela_id: string
  an: number
  stadiu: string
  cohort?: Cohorta | null
  data_observata: string
  sursa: 'manual' | 'gdd' | 'poza' | 'auto'
  observatii?: string | null
}

export interface InsertAplicarePlanificata {
  parcela_id: string
  cultura_id?: string | null
  plan_linie_id?: string | null
  produs_id?: string | null
  produs_nume_manual?: string | null
  data_planificata: string
  doza_ml_per_hl?: number | null
  doza_l_per_ha?: number | null
  cantitate_totala_ml?: number | null
  stoc_mutatie_id?: string | null
  meteo_snapshot?: Json | null
  stadiu_la_aplicare?: string | null
  cohort_la_aplicare?: Cohorta | null
  observatii?: string | null
  operator?: string | null
  status?: 'planificata' | 'reprogramata'
}

export interface ListAplicariOpts {
  status?: AplicareTratament['status']
  from?: Date
  to?: Date
}

export interface ListAplicariDashboardOpts {
  limit?: number
  fromDate?: Date
}

export interface ListAplicariCrossParcelOpts {
  dataStart: Date
  dataEnd: Date
  status?: AplicareTratament['status'][]
}

export interface StatisticiAplicariCrossParcel {
  total: number
  programate: number
  aplicate: number
  anulate: number
  in_phi_warning: number
  cu_meteo_favorabila: number
}

export interface TratamenteGlobalStats {
  aplicariAzi: number
  aplicariMaine: number
  aplicariAplicateSezon: number
  parceleCuPlan: number
  alerteFracTotal: number
  alerteCupruTotal: number
}

export interface MarkAplicareAsAplicataPayload {
  dataAplicata: Date
  cantitateTotala?: number | null
  meteoSnapshot?: Json | null
  operator?: string | null
  observatii?: string | null
  stadiuLaAplicare?: string | null
  cohortLaAplicare?: Cohorta | null
}

interface QueryContext {
  supabase: ServerSupabase
  tenantId: string
  userId: string
}

type SupabaseLikeError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

function asError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) return error
  const maybeError = (error ?? {}) as SupabaseLikeError
  return new Error(maybeError.message || maybeError.details || fallbackMessage)
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function requireStadiuCod(value: string, fieldName: string): StadiuCod {
  const cod = normalizeStadiu(value)
  if (!cod) {
    throw new Error(`Valoarea pentru ${fieldName} nu este un stadiu fenologic valid.`)
  }

  return cod
}

function normalizeOptionalStadiu(value: string | null | undefined): StadiuCod | null {
  if (typeof value !== 'string') return null
  return normalizeStadiu(value)
}

function normalizeOptionalCohorta(value: string | null | undefined): Cohorta | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'floricane' || normalized === 'primocane') {
    return normalized
  }

  return null
}

function normalizeCulturi(value: string[] | null | undefined): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const normalized = value
    .map((item) => normalizeText(item)?.toLowerCase())
    .filter((item): item is string => Boolean(item))

  return normalized.length > 0 ? normalized : null
}

function normalizeCulturaKey(value: string | null | undefined): string | null {
  return normalizeCropCod(value) ?? normalizeText(value)?.toLowerCase() ?? null
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function combineObservatii(current: string | null | undefined, extra: string | null | undefined): string | null {
  const currentText = normalizeText(current)
  const extraText = normalizeText(extra)
  if (!currentText && !extraText) return null
  if (!currentText) return extraText
  if (!extraText) return currentText
  return `${currentText}\n${extraText}`
}

function effectiveAplicareDate(aplicare: AplicareTratament): Date | null {
  const value = aplicare.data_aplicata ?? aplicare.data_planificata
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

type CrossParcelParcelaRelation = Pick<
  Database['public']['Tables']['parcele']['Row'],
  'id' | 'id_parcela' | 'nume_parcela' | 'suprafata_m2' | 'latitudine' | 'longitudine' | 'gps_lat' | 'gps_lng'
>

type CrossParcelPlanRelation = Pick<PlanTratament, 'id' | 'nume' | 'cultura_tip' | 'activ' | 'arhivat'>

type CrossParcelLinieRelation = PlanTratamentLinie & {
  plan: CrossParcelPlanRelation | CrossParcelPlanRelation[] | null
}

type CrossParcelAplicareRow = AplicareTratament & {
  produs:
    | AplicareTratamentDetaliu['produs']
    | AplicareTratamentDetaliu['produs'][]
    | null
  linie: CrossParcelLinieRelation | CrossParcelLinieRelation[] | null
  parcela: CrossParcelParcelaRelation | CrossParcelParcelaRelation[] | null
}

type AplicareAgregataParcelaRelation = Pick<
  Database['public']['Tables']['parcele']['Row'],
  'id' | 'id_parcela' | 'nume_parcela' | 'suprafata_m2' | 'cultura' | 'tip_fruct' | 'soi' | 'tip_unitate'
>

type AplicareAgregataRow = AplicareTratament & {
  produs:
    | AplicareTratamentDetaliu['produs']
    | AplicareTratamentDetaliu['produs'][]
    | null
  linie: CrossParcelLinieRelation | CrossParcelLinieRelation[] | null
  parcela: AplicareAgregataParcelaRelation | AplicareAgregataParcelaRelation[] | null
}

type TratamenteGlobalStatsAplicareRow = AplicareTratament & {
  produs:
    | AplicareTratamentDetaliu['produs']
    | AplicareTratamentDetaliu['produs'][]
    | null
  linie: CrossParcelLinieRelation | CrossParcelLinieRelation[] | null
  parcela: AplicareAgregataParcelaRelation | AplicareAgregataParcelaRelation[] | null
}

function resolveParcelaCoord(
  primary: number | null | undefined,
  fallback: number | null | undefined
): number | null {
  if (typeof primary === 'number' && Number.isFinite(primary)) return primary
  if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback
  return null
}

function isPhiWarning(
  dataPlanificata: string | null,
  phiZile: number | null,
  dataRecoltare: string | null
): boolean {
  if (!dataPlanificata || typeof phiZile !== 'number' || phiZile <= 0 || !dataRecoltare) {
    return false
  }

  const planificata = new Date(`${dataPlanificata}T00:00:00.000Z`)
  const recoltare = new Date(`${dataRecoltare}T00:00:00.000Z`)
  if (Number.isNaN(planificata.getTime()) || Number.isNaN(recoltare.getTime())) {
    return false
  }

  const phiDeadline = new Date(planificata)
  phiDeadline.setUTCDate(phiDeadline.getUTCDate() + phiZile)
  return phiDeadline.getTime() >= recoltare.getTime()
}

function toProdusCatalogItem(
  produs: NonNullable<AplicareTratamentDetaliu['produs']>
): ProdusFitosanitar {
  return {
    id: produs.id,
    tenant_id: produs.tenant_id,
    nume_comercial: produs.nume_comercial,
    substanta_activa: produs.substanta_activa,
    tip: produs.tip,
    frac_irac: produs.frac_irac ?? null,
    doza_min_ml_per_hl: null,
    doza_max_ml_per_hl: null,
    doza_min_l_per_ha: null,
    doza_max_l_per_ha: null,
    phi_zile: produs.phi_zile ?? null,
    nr_max_aplicari_per_sezon: produs.nr_max_aplicari_per_sezon ?? null,
    interval_min_aplicari_zile: null,
    omologat_culturi: null,
    activ: produs.activ,
    created_at: '',
    updated_at: '',
    created_by: null,
  }
}

async function getNextHarvestMap(
  ctx: QueryContext,
  parcelaIds: string[],
  fromDate: Date
): Promise<Map<string, string>> {
  if (parcelaIds.length === 0) return new Map()

  const { data, error } = await ctx.supabase
    .from('recoltari')
    .select('parcela_id,data')
    .eq('tenant_id', ctx.tenantId)
    .in('parcela_id', parcelaIds)
    .gte('data', toIsoDate(fromDate))
    .order('data', { ascending: true })

  if (error) throw error

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    const parcelaId = typeof row.parcela_id === 'string' ? row.parcela_id : null
    const dataRecoltare = typeof row.data === 'string' ? row.data : null
    if (!parcelaId || !dataRecoltare || map.has(parcelaId)) continue
    map.set(parcelaId, dataRecoltare)
  }

  return map
}

function mapAplicariCrossParcel(
  rows: CrossParcelAplicareRow[],
  nextHarvestMap: Map<string, string>
): AplicareCrossParcelItem[] {
  return rows.map((row) => {
    const produs = firstRelation(row.produs)
    const linie = firstRelation(row.linie)
    const plan = firstRelation(linie?.plan)
    const parcela = firstRelation(row.parcela)
    const urmatoareaRecoltare = nextHarvestMap.get(row.parcela_id) ?? null

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      parcela_id: row.parcela_id,
      cultura_id: row.cultura_id,
      plan_linie_id: row.plan_linie_id,
      produs_id: row.produs_id,
      produs_nume_manual: row.produs_nume_manual,
      data_programata: row.data_planificata,
      data_planificata: row.data_planificata,
      data_aplicata: row.data_aplicata,
      status: row.status,
      parcela_nume: parcela?.nume_parcela ?? null,
      parcela_cod: parcela?.id_parcela ?? null,
      parcela_suprafata_m2: parcela?.suprafata_m2 ?? null,
      parcela_lat: resolveParcelaCoord(parcela?.latitudine, parcela?.gps_lat),
      parcela_lng: resolveParcelaCoord(parcela?.longitudine, parcela?.gps_lng),
      plan_id: plan?.id ?? linie?.plan_id ?? null,
      plan_nume: plan?.nume ?? null,
      plan_arhivat: plan?.arhivat ?? null,
      linie_id: linie?.id ?? row.plan_linie_id,
      stadiu_trigger: linie?.stadiu_trigger ?? row.stadiu_la_aplicare ?? null,
      cohort_trigger: normalizeOptionalCohorta(linie?.cohort_trigger ?? null),
      cohort_la_aplicare: normalizeOptionalCohorta(row.cohort_la_aplicare ?? null),
      produs_nume: produs?.nume_comercial ?? row.produs_nume_manual ?? 'Produs nespecificat',
      produs_tip: produs?.tip ?? null,
      produs_frac: produs?.frac_irac ?? null,
      produs_phi_zile: produs?.phi_zile ?? null,
      doza_ml_per_hl: row.doza_ml_per_hl,
      doza_l_per_ha: row.doza_l_per_ha,
      observatii: row.observatii ?? linie?.observatii ?? null,
      operator: row.operator,
      meteo_snapshot: row.meteo_snapshot,
      phi_warning: isPhiWarning(row.data_planificata, produs?.phi_zile ?? null, urmatoareaRecoltare),
      urmatoarea_recoltare: urmatoareaRecoltare,
    }
  })
}

function mapAplicariAgregate(rows: AplicareAgregataRow[]): AplicareAgregata[] {
  return rows.map((row) => {
    const produs = firstRelation(row.produs)
    const linie = firstRelation(row.linie)
    const plan = firstRelation(linie?.plan)
    const parcela = firstRelation(row.parcela)
    const suprafataHa =
      typeof parcela?.suprafata_m2 === 'number' && parcela.suprafata_m2 > 0
        ? Math.round((parcela.suprafata_m2 / 10000) * 10000) / 10000
        : null

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      parcela_id: row.parcela_id,
      parcela_nume: parcela?.nume_parcela ?? null,
      parcela_cod: parcela?.id_parcela ?? null,
      parcela_suprafata_m2: parcela?.suprafata_m2 ?? null,
      suprafata_ha: suprafataHa,
      produs_id: row.produs_id,
      produs_nume: produs?.nume_comercial ?? row.produs_nume_manual ?? 'Produs nespecificat',
      produs_tip: produs?.tip ?? null,
      produs_frac: produs?.frac_irac ?? null,
      produs_phi_zile: produs?.phi_zile ?? null,
      substanta_activa: produs?.substanta_activa ?? null,
      plan_id: plan?.id ?? linie?.plan_id ?? null,
      plan_nume: plan?.nume ?? null,
      linie_id: linie?.id ?? row.plan_linie_id,
      stadiu_trigger: linie?.stadiu_trigger ?? null,
      cohort_trigger: normalizeOptionalCohorta(linie?.cohort_trigger ?? null),
      stadiu_la_aplicare: row.stadiu_la_aplicare ?? null,
      cohort_la_aplicare: normalizeOptionalCohorta(row.cohort_la_aplicare ?? null),
      data_planificata: row.data_planificata,
      data_aplicata: row.data_aplicata,
      status: row.status,
      doza_ml_per_hl: row.doza_ml_per_hl,
      doza_l_per_ha: row.doza_l_per_ha,
      cantitate_totala_ml: row.cantitate_totala_ml,
      observatii: row.observatii ?? linie?.observatii ?? null,
      operator: row.operator,
    }
  })
}

function mapPlanParceleAsociate(
  rows: Array<
    ParcelaPlan & {
      parcela: Pick<Database['public']['Tables']['parcele']['Row'], 'id' | 'id_parcela' | 'nume_parcela' | 'suprafata_m2'> | Array<Pick<Database['public']['Tables']['parcele']['Row'], 'id' | 'id_parcela' | 'nume_parcela' | 'suprafata_m2'>> | null
    }
  >
): PlanTratamentParcelaAsociata[] {
  return rows.map((row) => {
    const parcela = firstRelation(row.parcela)

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      parcela_id: row.parcela_id,
      plan_id: row.plan_id,
      an: row.an,
      activ: row.activ,
      created_at: row.created_at,
      updated_at: row.updated_at,
      parcela_nume: parcela?.nume_parcela ?? null,
      parcela_cod: parcela?.id_parcela ?? null,
      suprafata_m2: parcela?.suprafata_m2 ?? null,
    }
  })
}

function asPlanRpcPayload(data: Json): PlanTratamentRpcPayload {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('RPC-ul planului a returnat un payload invalid.')
  }

  const payload = data as Partial<PlanTratamentRpcPayload>
  if (!payload.plan || typeof payload.plan !== 'object' || Array.isArray(payload.plan)) {
    throw new Error('RPC-ul planului nu a returnat planul salvat.')
  }

  return {
    plan: payload.plan as PlanTratament,
    linii: Array.isArray(payload.linii) ? (payload.linii as PlanTratamentLinie[]) : [],
    parcele_asociate: Array.isArray(payload.parcele_asociate)
      ? (payload.parcele_asociate as PlanTratamentParcelaAsociata[])
      : [],
  }
}

async function getQueryContext(): Promise<QueryContext> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user?.id) {
    throw new Error('Neautorizat')
  }

  const tenantId = await getTenantIdByUserId(supabase, user.id)
  return { supabase, tenantId, userId: user.id }
}

async function ensurePlanExists(ctx: QueryContext, planId: string): Promise<void> {
  const { data, error } = await ctx.supabase
    .from('planuri_tratament')
    .select('id')
    .eq('id', planId)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error(`Planul de tratament ${planId} nu există în tenantul curent.`)
  }
}

async function getNextLinieOrdine(ctx: QueryContext, planId: string): Promise<number> {
  const { data, error } = await ctx.supabase
    .from('planuri_tratament_linii')
    .select('ordine')
    .eq('plan_id', planId)
    .eq('tenant_id', ctx.tenantId)
    .order('ordine', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data?.ordine ?? 0) + 1
}

async function getAplicareOwnedByTenant(ctx: QueryContext, id: string): Promise<AplicareTratament> {
  const { data, error } = await ctx.supabase
    .from('aplicari_tratament')
    .select(APLICARE_SELECT)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new Error(`Aplicarea ${id} nu există în tenantul curent.`)
  }

  return data
}

/**
 * Listează produsele fitosanitare vizibile pentru tenantul curent și biblioteca shared.
 * Exemplu: `listProduseFitosanitare({ tip: 'fungicid', omologatPentru: 'zmeur' })`
 */
export async function listProduseFitosanitare(opts?: {
  tip?: string
  activ?: boolean
  omologatPentru?: string
}): Promise<ProdusFitosanitar[]> {
  const { supabase, tenantId } = await getQueryContext()

  let query = supabase
    .from('produse_fitosanitare')
    .select(PRODUS_SELECT)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .order('tenant_id', { ascending: true, nullsFirst: true })
    .order('nume_comercial', { ascending: true })

  if (opts?.tip) {
    query = query.eq('tip', opts.tip)
  }

  if (typeof opts?.activ === 'boolean') {
    query = query.eq('activ', opts.activ)
  }

  if (opts?.omologatPentru) {
    query = query.contains('omologat_culturi', [opts.omologatPentru.trim().toLowerCase()])
  }

  const { data, error } = await query

  if (error) throw error
  return data ?? []
}

/**
 * Caută o cultură din catalog după codul canonic și preferă override-ul tenant-scoped când există.
 * Exemplu: `getCropByCod('zmeur')`
 */
export async function getCropByCod(cod: CropCod): Promise<CropCatalog | null> {
  const { supabase, tenantId } = await getQueryContext()

  const { data, error } = await supabase
    .from('crops')
    .select(CROP_SELECT)
    .eq('cod', cod)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)

  if (error) throw error

  const rows = (data ?? []) as CropCatalog[]
  const tenantScoped = rows.find((row) => row.tenant_id === tenantId)
  return tenantScoped ?? rows.find((row) => row.tenant_id === null) ?? null
}

/**
 * Rezolvă grupul biologic al parcelei pornind din `parcele.cultura` / `parcele.tip_fruct`
 * și catalogul `crops.cod`. Valorile libere din parcelă sunt normalizate la citire.
 * Exemplu: `getGrupBiologicParcela('uuid-parcela')`
 */
export async function getGrupBiologicParcela(parcelaId: string): Promise<GrupBiologic | null> {
  const { supabase, tenantId } = await getQueryContext()

  const { data, error } = await supabase
    .from('parcele')
    .select('cultura,tip_fruct')
    .eq('id', parcelaId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const cropCod = normalizeCropCod(data.cultura) ?? normalizeCropCod(data.tip_fruct)
  if (!cropCod) return null

  const crop = await getCropByCod(cropCod)
  return (crop?.grup_biologic as GrupBiologic | null) ?? null
}

/**
 * Citește un produs fitosanitar după ID dacă este shared sau aparține tenantului curent.
 * Exemplu: `getProdusFitosanitarById('uuid-produs')`
 */
export async function getProdusFitosanitarById(id: string): Promise<ProdusFitosanitar | null> {
  const { supabase, tenantId } = await getQueryContext()

  const { data, error } = await supabase
    .from('produse_fitosanitare')
    .select(PRODUS_SELECT)
    .eq('id', id)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

/**
 * Creează sau actualizează un produs custom al tenantului curent fără să atingă biblioteca shared.
 * Exemplu: `upsertProdusTenantCustom({ nume_comercial: 'Cupru X', substanta_activa: 'cupru', tip: 'fungicid' })`
 */
export async function upsertProdusTenantCustom(data: InsertTenantProdus): Promise<ProdusFitosanitar> {
  const { supabase, tenantId, userId } = await getQueryContext()

  const payload: ProdusFitosanitarInsert = {
    tenant_id: tenantId,
    nume_comercial: data.nume_comercial.trim(),
    substanta_activa: data.substanta_activa.trim(),
    tip: data.tip,
    frac_irac: normalizeText(data.frac_irac),
    doza_min_ml_per_hl: data.doza_min_ml_per_hl ?? null,
    doza_max_ml_per_hl: data.doza_max_ml_per_hl ?? null,
    doza_min_l_per_ha: data.doza_min_l_per_ha ?? null,
    doza_max_l_per_ha: data.doza_max_l_per_ha ?? null,
    phi_zile: data.phi_zile ?? null,
    nr_max_aplicari_per_sezon: data.nr_max_aplicari_per_sezon ?? null,
    interval_min_aplicari_zile: data.interval_min_aplicari_zile ?? null,
    omologat_culturi: normalizeCulturi(data.omologat_culturi),
    activ: data.activ ?? true,
    created_by: userId,
  }

  const { data: inserted, error } = await supabase
    .from('produse_fitosanitare')
    .upsert(payload, { onConflict: 'tenant_id,nume_comercial' })
    .select(PRODUS_SELECT)
    .single()

  if (error) throw error
  return inserted
}

/**
 * Listează planurile de tratament din tenantul curent.
 * Exemplu: `listPlanuriTratament({ culturaTip: 'zmeur', activ: true })`
 */
export async function listPlanuriTratament(opts?: {
  culturaTip?: string
  activ?: boolean
}): Promise<PlanTratament[]> {
  const { supabase, tenantId } = await getQueryContext()

  let query = supabase
    .from('planuri_tratament')
    .select(PLAN_SELECT)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (opts?.culturaTip) {
    query = query.eq('cultura_tip', opts.culturaTip)
  }

  if (typeof opts?.activ === 'boolean') {
    query = query.eq('activ', opts.activ)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

/**
 * Încarcă un plan și liniile lui, ordonate după `ordine`, plus lookup-ul produsului asociat.
 * Exemplu: `getPlanTratamentCuLinii('uuid-plan')`
 */
export async function getPlanTratamentCuLinii(planId: string): Promise<PlanTratamentCuLinii | null> {
  const { supabase, tenantId } = await getQueryContext()

  const { data: plan, error: planError } = await supabase
    .from('planuri_tratament')
    .select(PLAN_SELECT)
    .eq('id', planId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (planError) throw planError
  if (!plan) return null

  const { data: linii, error: liniiError } = await supabase
    .from('planuri_tratament_linii')
    .select(`${LINIE_SELECT}, produs:produse_fitosanitare(${PRODUS_SELECT})`)
    .eq('plan_id', planId)
    .eq('tenant_id', tenantId)
    .order('ordine', { ascending: true })

  if (liniiError) throw liniiError

  return {
    ...plan,
    linii: ((linii ?? []) as Array<PlanTratamentLinie & { produs: ProdusFitosanitar | ProdusFitosanitar[] | null }>).map((linie) => ({
      ...linie,
      produs: firstRelation(linie.produs),
    })),
  }
}

/**
 * Listează planurile cu număr de linii și parcelele active asociate.
 * Exemplu: `listPlanuriTratamentComplet({ arhivat: false })`
 */
export async function listPlanuriTratamentComplet(opts?: {
  culturaTip?: string
  activ?: boolean
  arhivat?: boolean
}): Promise<PlanTratamentListItem[]> {
  const { supabase, tenantId } = await getQueryContext()

  let query = supabase
    .from('planuri_tratament')
    .select(PLAN_SELECT)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (opts?.culturaTip) {
    query = query.eq('cultura_tip', opts.culturaTip)
  }

  if (typeof opts?.activ === 'boolean') {
    query = query.eq('activ', opts.activ)
  }

  if (typeof opts?.arhivat === 'boolean') {
    query = query.eq('arhivat', opts.arhivat)
  }

  const { data: planuri, error } = await query
  if (error) throw error

  const rows = planuri ?? []
  if (rows.length === 0) return []

  const planIds = rows.map((plan) => plan.id)

  const [liniiResult, parceleResult] = await Promise.all([
    supabase
      .from('planuri_tratament_linii')
      .select('plan_id')
      .eq('tenant_id', tenantId)
      .in('plan_id', planIds),
    supabase
      .from('parcele_planuri')
      .select(`${PARCELA_PLAN_SELECT}, parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2)`)
      .eq('tenant_id', tenantId)
      .eq('activ', true)
      .in('plan_id', planIds),
  ])

  if (liniiResult.error) throw liniiResult.error
  if (parceleResult.error) throw parceleResult.error

  const liniiCountByPlan = new Map<string, number>()
  for (const linie of liniiResult.data ?? []) {
    liniiCountByPlan.set(linie.plan_id, (liniiCountByPlan.get(linie.plan_id) ?? 0) + 1)
  }

  const parceleByPlan = new Map<string, PlanTratamentParcelaAsociata[]>()
  for (const parcela of mapPlanParceleAsociate((parceleResult.data ?? []) as Array<
    ParcelaPlan & {
      parcela: Pick<Database['public']['Tables']['parcele']['Row'], 'id' | 'id_parcela' | 'nume_parcela' | 'suprafata_m2'> | Array<Pick<Database['public']['Tables']['parcele']['Row'], 'id' | 'id_parcela' | 'nume_parcela' | 'suprafata_m2'>> | null
    }
  >)) {
    const current = parceleByPlan.get(parcela.plan_id) ?? []
    current.push(parcela)
    current.sort((a, b) => (a.parcela_nume ?? '').localeCompare(b.parcela_nume ?? '', 'ro'))
    parceleByPlan.set(parcela.plan_id, current)
  }

  return rows.map((plan) => ({
    ...plan,
    linii_count: liniiCountByPlan.get(plan.id) ?? 0,
    parcele_asociate: parceleByPlan.get(plan.id) ?? [],
  }))
}

/**
 * Returnează planul complet pentru editare: metadate, linii cu produs și parcelele active asociate.
 * Exemplu: `getPlanTratamentComplet('uuid-plan')`
 */
export async function getPlanTratamentComplet(planId: string): Promise<PlanTratamentComplet | null> {
  const planCuLinii = await getPlanTratamentCuLinii(planId)
  if (!planCuLinii) return null

  const { supabase, tenantId } = await getQueryContext()
  const { data: parcele, error } = await supabase
    .from('parcele_planuri')
    .select(`${PARCELA_PLAN_SELECT}, parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2)`)
    .eq('tenant_id', tenantId)
    .eq('plan_id', planId)
    .eq('activ', true)
    .order('an', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  return {
    ...planCuLinii,
    parcele_asociate: mapPlanParceleAsociate((parcele ?? []) as Array<
      ParcelaPlan & {
        parcela: Pick<Database['public']['Tables']['parcele']['Row'], 'id' | 'id_parcela' | 'nume_parcela' | 'suprafata_m2'> | Array<Pick<Database['public']['Tables']['parcele']['Row'], 'id' | 'id_parcela' | 'nume_parcela' | 'suprafata_m2'>> | null
      }
    >),
  }
}

/**
 * Salvează atomic planul, liniile și asocierile prin RPC-ul dedicat.
 * Exemplu: `upsertPlanTratamentCuLinii({ nume: 'Plan zmeur', cultura_tip: 'zmeur' }, linii, ['uuid-parcela'], 2026)`
 */
export async function upsertPlanTratamentCuLinii(
  planData: UpsertPlanTratamentPayload,
  liniiData: PlanTratamentLiniePayload[],
  parceleIds: string[] | null | undefined,
  an: number
): Promise<PlanTratamentComplet> {
  const ctx = await getQueryContext()

  const rpcPlanData = {
    nume: planData.nume.trim(),
    cultura_tip: planData.cultura_tip.trim(),
    descriere: normalizeText(planData.descriere),
    activ: planData.activ ?? true,
    arhivat: planData.arhivat ?? false,
  }

  const rpcLinii = liniiData.map((linie, index) => ({
    ordine: linie.ordine ?? index + 1,
    stadiu_trigger: requireStadiuCod(linie.stadiu_trigger, 'stadiu_trigger'),
    cohort_trigger: normalizeOptionalCohorta(linie.cohort_trigger),
    produs_id: linie.produs_id ?? null,
    produs_nume_manual: normalizeText(linie.produs_nume_manual),
    doza_ml_per_hl: linie.doza_ml_per_hl ?? null,
    doza_l_per_ha: linie.doza_l_per_ha ?? null,
    observatii: normalizeText(linie.observatii),
  }))

  const { data, error } = await ctx.supabase.rpc('upsert_plan_tratament_cu_linii', {
    p_plan_id: planData.id ?? null,
    p_plan_data: rpcPlanData as unknown as Json,
    p_linii: rpcLinii as unknown as Json,
    p_parcele_ids: Array.isArray(parceleIds) ? parceleIds : [],
    p_an: an,
  })

  if (error) throw error

  const payload = asPlanRpcPayload(data)

  const reloaded = await getPlanTratamentComplet(payload.plan.id)

  if (!reloaded) {
    throw new Error('Planul a fost salvat, dar nu a putut fi reîncărcat.')
  }

  return reloaded
}

/**
 * Arhivează un plan și dezactivează toate asocierile active ale acestuia.
 * Exemplu: `arhiveazaPlanTratament('uuid-plan')`
 */
export async function arhiveazaPlanTratament(planId: string): Promise<PlanTratament> {
  const ctx = await getQueryContext()

  const { data: updated, error } = await ctx.supabase
    .from('planuri_tratament')
    .update({
      arhivat: true,
      activ: false,
      updated_by: ctx.userId,
    })
    .eq('id', planId)
    .eq('tenant_id', ctx.tenantId)
    .select(PLAN_SELECT)
    .single()

  if (error) throw error

  const { error: deactivateError } = await ctx.supabase
    .from('parcele_planuri')
    .update({ activ: false })
    .eq('tenant_id', ctx.tenantId)
    .eq('plan_id', planId)
    .eq('activ', true)

  if (deactivateError) throw deactivateError

  return updated
}

/**
 * Scoate planul din arhivă și îl reactivează pentru selecții ulterioare.
 * Asocierile cu parcele rămân inactive.
 * Exemplu: `dezarhiveazaPlanTratament('uuid-plan')`
 */
export async function dezarhiveazaPlanTratament(planId: string): Promise<PlanTratament> {
  const ctx = await getQueryContext()

  const { data: updated, error } = await ctx.supabase
    .from('planuri_tratament')
    .update({
      arhivat: false,
      activ: true,
      updated_by: ctx.userId,
    })
    .eq('id', planId)
    .eq('tenant_id', ctx.tenantId)
    .select(PLAN_SELECT)
    .single()

  if (error) throw error
  return updated
}

/**
 * Construiește opțiunile de cultură pentru wizard din `culturi.tip_planta`, cu fallback pe `parcele`.
 * Exemplu: `listCulturiPentruPlanWizard()`
 */
export async function listCulturiPentruPlanWizard(): Promise<string[]> {
  const { supabase, tenantId } = await getQueryContext()

  const [culturiResult, parceleResult] = await Promise.all([
    supabase
      .from('culturi')
      .select('tip_planta,activa')
      .eq('tenant_id', tenantId),
    supabase
      .from('parcele')
      .select('cultura,tip_fruct')
      .eq('tenant_id', tenantId),
  ])

  if (culturiResult.error) throw culturiResult.error
  if (parceleResult.error) throw parceleResult.error

  const values = new Set<string>()

  for (const cultura of culturiResult.data ?? []) {
    if (cultura.activa === false) continue
    const normalized = normalizeCropCod(cultura.tip_planta) ?? normalizeText(cultura.tip_planta)
    if (normalized) values.add(normalized)
  }

  for (const parcela of parceleResult.data ?? []) {
    const cultura = normalizeCropCod(parcela.cultura) ?? normalizeText(parcela.cultura)
    const tipFruct = normalizeCropCod(parcela.tip_fruct) ?? normalizeText(parcela.tip_fruct)
    if (cultura) values.add(cultura)
    if (tipFruct) values.add(tipFruct)
  }

  return [...values].sort((a, b) => a.localeCompare(b, 'ro'))
}

/**
 * Returnează parcelele eligibile pentru asocierea planurilor și planurile active deja prezente pe ele.
 * Exemplu: `listParcelePentruPlanWizard('zmeur')`
 */
export async function listParcelePentruPlanWizard(culturaTip?: string | null): Promise<PlanWizardParcelaOption[]> {
  const { supabase, tenantId } = await getQueryContext()

  const [parceleResult, asocieriResult] = await Promise.all([
    supabase
      .from('parcele')
      .select('id,id_parcela,nume_parcela,suprafata_m2,cultura,tip_fruct')
      .eq('tenant_id', tenantId)
      .order('nume_parcela', { ascending: true }),
    supabase
      .from('parcele_planuri')
      .select('parcela_id,an,plan_id,plan:planuri_tratament(id,nume)')
      .eq('tenant_id', tenantId)
      .eq('activ', true),
  ])

  if (parceleResult.error) throw parceleResult.error
  if (asocieriResult.error) throw asocieriResult.error

  const culturaFilter = normalizeCulturaKey(culturaTip)
  const activeByParcela = new Map<string, PlanWizardParcelaOption['active_planuri']>()

  for (const asociere of (asocieriResult.data ?? []) as Array<{
    parcela_id: string
    an: number
    plan_id: string
    plan: { id: string; nume: string | null } | Array<{ id: string; nume: string | null }> | null
  }>) {
    const current = activeByParcela.get(asociere.parcela_id) ?? []
    const plan = firstRelation(asociere.plan)

    current.push({
      plan_id: asociere.plan_id,
      plan_nume: plan?.nume ?? null,
      an: asociere.an,
    })

    current.sort((a, b) => b.an - a.an)
    activeByParcela.set(asociere.parcela_id, current)
  }

  return (parceleResult.data ?? [])
    .filter((parcela) => {
      if (!culturaFilter) return true

      const parcelaKeys = [normalizeCulturaKey(parcela.cultura), normalizeCulturaKey(parcela.tip_fruct)].filter(
        (value): value is string => Boolean(value)
      )

      return parcelaKeys.includes(culturaFilter)
    })
    .map((parcela) => ({
      id: parcela.id,
      id_parcela: parcela.id_parcela,
      nume_parcela: parcela.nume_parcela,
      suprafata_m2: parcela.suprafata_m2,
      cultura_tip: parcela.cultura,
      tip_fruct: parcela.tip_fruct,
      active_planuri: activeByParcela.get(parcela.id) ?? [],
    }))
}

/**
 * Creează un plan nou și liniile inițiale furnizate.
 * Exemplu: `createPlanTratament({ nume: 'Primăvară', cultura_tip: 'zmeur' }, [{ stadiu_trigger: 'buton_verde', produs_nume_manual: 'Cupru' }])`
 * @remarks Rollback manual: dacă inserarea liniilor eșuează, planul este șters. Nu este atomic real; pentru atomicitate strictă se va folosi RPC în faza 2.
 */
export async function createPlanTratament(
  data: CreatePlanTratamentInput,
  linii: CreatePlanTratamentLinieInput[]
): Promise<PlanTratamentCuLinii> {
  const ctx = await getQueryContext()

  const { data: plan, error: planError } = await ctx.supabase
    .from('planuri_tratament')
    .insert({
      tenant_id: ctx.tenantId,
      nume: data.nume.trim(),
      cultura_tip: data.cultura_tip.trim(),
      descriere: normalizeText(data.descriere),
      activ: data.activ ?? true,
      arhivat: data.arhivat ?? false,
      created_by: ctx.userId,
      updated_by: ctx.userId,
    })
    .select(PLAN_SELECT)
    .single()

  if (planError) throw planError

  if (linii.length > 0) {
    const payload: PlanTratamentLinieInsert[] = linii.map((linie, index) => ({
      tenant_id: ctx.tenantId,
      plan_id: plan.id,
      ordine: linie.ordine ?? index + 1,
      stadiu_trigger: requireStadiuCod(linie.stadiu_trigger, 'stadiu_trigger'),
      cohort_trigger: normalizeOptionalCohorta(linie.cohort_trigger),
      produs_id: linie.produs_id ?? null,
      produs_nume_manual: normalizeText(linie.produs_nume_manual),
      doza_ml_per_hl: linie.doza_ml_per_hl ?? null,
      doza_l_per_ha: linie.doza_l_per_ha ?? null,
      observatii: normalizeText(linie.observatii),
    }))

    const { error: liniiError } = await ctx.supabase
      .from('planuri_tratament_linii')
      .insert(payload)

    if (liniiError) {
      await ctx.supabase
        .from('planuri_tratament')
        .delete()
        .eq('id', plan.id)
        .eq('tenant_id', ctx.tenantId)

      throw new Error(`Eroare la inserarea liniilor planului: ${liniiError.message}`)
    }
  }

  const planComplet = await getPlanTratamentCuLinii(plan.id)
  if (!planComplet) {
    throw new Error('Planul de tratament a fost creat, dar nu a putut fi reîncărcat.')
  }

  return planComplet
}

/**
 * Actualizează metadatele unui plan de tratament.
 * Exemplu: `updatePlanTratament('uuid-plan', { activ: false })`
 */
export async function updatePlanTratament(
  planId: string,
  data: Partial<CreatePlanTratamentInput>
): Promise<PlanTratament> {
  const ctx = await getQueryContext()

  const payload: PlanTratamentUpdate = {
    updated_by: ctx.userId,
  }

  if (data.nume !== undefined) payload.nume = data.nume.trim()
  if (data.cultura_tip !== undefined) payload.cultura_tip = data.cultura_tip.trim()
  if (data.descriere !== undefined) payload.descriere = normalizeText(data.descriere)
  if (data.activ !== undefined) payload.activ = data.activ
  if (data.arhivat !== undefined) payload.arhivat = data.arhivat

  const { data: updated, error } = await ctx.supabase
    .from('planuri_tratament')
    .update(payload)
    .eq('id', planId)
    .eq('tenant_id', ctx.tenantId)
    .select(PLAN_SELECT)
    .single()

  if (error) throw error
  return updated
}

/**
 * Dezactivează logic un plan de tratament fără să șteargă liniile lui.
 * Exemplu: `deactivatePlanTratament('uuid-plan')`
 */
export async function deactivatePlanTratament(planId: string): Promise<PlanTratament> {
  return updatePlanTratament(planId, { activ: false })
}

/**
 * Adaugă o linie nouă într-un plan și calculează automat următoarea ordine.
 * Exemplu: `addLinieToPlan('uuid-plan', { stadiu_trigger: 'inflorit', produs_id: 'uuid-produs' })`
 */
export async function addLinieToPlan(
  planId: string,
  linie: Omit<CreatePlanTratamentLinieInput, 'ordine'>
): Promise<PlanTratamentLinie> {
  const ctx = await getQueryContext()
  await ensurePlanExists(ctx, planId)

  const ordine = await getNextLinieOrdine(ctx, planId)
  const payload: PlanTratamentLinieInsert = {
    tenant_id: ctx.tenantId,
    plan_id: planId,
    ordine,
    stadiu_trigger: requireStadiuCod(linie.stadiu_trigger, 'stadiu_trigger'),
    cohort_trigger: normalizeOptionalCohorta(linie.cohort_trigger),
    produs_id: linie.produs_id ?? null,
    produs_nume_manual: normalizeText(linie.produs_nume_manual),
    doza_ml_per_hl: linie.doza_ml_per_hl ?? null,
    doza_l_per_ha: linie.doza_l_per_ha ?? null,
    observatii: normalizeText(linie.observatii),
  }

  const { data, error } = await ctx.supabase
    .from('planuri_tratament_linii')
    .insert(payload)
    .select(LINIE_SELECT)
    .single()

  if (error) throw error
  return data
}

/**
 * Actualizează o linie existentă din plan.
 * Exemplu: `updateLiniePlan('uuid-linie', { doza_l_per_ha: 1.5 })`
 */
export async function updateLiniePlan(
  linieId: string,
  data: Partial<CreatePlanTratamentLinieInput>
): Promise<PlanTratamentLinie> {
  const ctx = await getQueryContext()

  const payload: PlanTratamentLinieUpdate = {}
  if (data.ordine !== undefined) payload.ordine = data.ordine
  if (data.stadiu_trigger !== undefined) payload.stadiu_trigger = requireStadiuCod(data.stadiu_trigger, 'stadiu_trigger')
  if (data.cohort_trigger !== undefined) payload.cohort_trigger = normalizeOptionalCohorta(data.cohort_trigger)
  if (data.produs_id !== undefined) payload.produs_id = data.produs_id
  if (data.produs_nume_manual !== undefined) payload.produs_nume_manual = normalizeText(data.produs_nume_manual)
  if (data.doza_ml_per_hl !== undefined) payload.doza_ml_per_hl = data.doza_ml_per_hl
  if (data.doza_l_per_ha !== undefined) payload.doza_l_per_ha = data.doza_l_per_ha
  if (data.observatii !== undefined) payload.observatii = normalizeText(data.observatii)

  const { data: updated, error } = await ctx.supabase
    .from('planuri_tratament_linii')
    .update(payload)
    .eq('id', linieId)
    .eq('tenant_id', ctx.tenantId)
    .select(LINIE_SELECT)
    .single()

  if (error) throw error
  return updated
}

/**
 * Șterge o linie din planul curent.
 * Exemplu: `deleteLiniePlan('uuid-linie')`
 */
export async function deleteLiniePlan(linieId: string): Promise<void> {
  const ctx = await getQueryContext()

  const { error } = await ctx.supabase
    .from('planuri_tratament_linii')
    .delete()
    .eq('id', linieId)
    .eq('tenant_id', ctx.tenantId)

  if (error) throw error
}

/** Returnează context minim pentru o linie din plan. */
export async function getLiniePlanContext(linieId: string): Promise<LiniePlanContext | null> {
  const ctx = await getQueryContext()

  const { data, error } = await ctx.supabase
    .from('planuri_tratament_linii')
    .select('id,plan_id,stadiu_trigger,cohort_trigger')
    .eq('tenant_id', ctx.tenantId)
    .eq('id', linieId)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Reordonează liniile unui plan după lista nouă de ID-uri.
 * @remarks Nu atomic; pentru atomicitate strictă se va folosi RPC într-o fază următoare.
 */
export async function reorderLiniiPlan(
  planId: string,
  orderedLinieIds: string[]
): Promise<void> {
  const ctx = await getQueryContext()
  await ensurePlanExists(ctx, planId)

  const { data: existingLinii, error } = await ctx.supabase
    .from('planuri_tratament_linii')
    .select('id,plan_id')
    .eq('tenant_id', ctx.tenantId)
    .eq('plan_id', planId)
    .order('ordine', { ascending: true })

  if (error) throw error

  const rows = existingLinii ?? []
  if (rows.length !== orderedLinieIds.length) {
    throw new Error('Ordinea liniilor invalidă: nu toate liniile au fost furnizate')
  }

  const existingIds = new Set(rows.map((row) => row.id))

  for (const linieId of orderedLinieIds) {
    if (!existingIds.has(linieId)) {
      throw new Error(`Linia ${linieId} nu aparține planului`)
    }
  }

  await Promise.all(
    orderedLinieIds.map((linieId, index) =>
      ctx.supabase
        .from('planuri_tratament_linii')
        .update({ ordine: index + 1 })
        .eq('id', linieId)
        .eq('tenant_id', ctx.tenantId)
        .eq('plan_id', planId)
    )
  )
}

/** Duplică un plan existent cu liniile sale sub un nume nou. */
export async function duplicatePlanTratament(
  planId: string,
  numeNou: string
): Promise<PlanTratamentCuLinii> {
  const plan = await getPlanTratamentCuLinii(planId)

  if (!plan) {
    throw new Error('Planul selectat nu a fost găsit.')
  }

  return createPlanTratament(
    {
      nume: numeNou.trim(),
      cultura_tip: plan.cultura_tip,
      descriere: plan.descriere?.trim()
        ? `Copie - ${plan.descriere.trim()}`
        : 'Copie - ',
      activ: true,
      arhivat: false,
    },
    plan.linii.map((linie) => ({
      ordine: linie.ordine,
      stadiu_trigger: linie.stadiu_trigger,
      cohort_trigger: normalizeOptionalCohorta(linie.cohort_trigger),
      produs_id: linie.produs_id,
      produs_nume_manual: linie.produs_nume_manual,
      doza_ml_per_hl: linie.doza_ml_per_hl,
      doza_l_per_ha: linie.doza_l_per_ha,
      observatii: linie.observatii,
    }))
  )
}

/** Count aplicări asociate unui plan (prin linii → aplicări). */
export async function countAplicariPlan(planId: string): Promise<number> {
  const ctx = await getQueryContext()
  await ensurePlanExists(ctx, planId)

  const { data: linii, error: liniiError } = await ctx.supabase
    .from('planuri_tratament_linii')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .eq('plan_id', planId)

  if (liniiError) throw liniiError

  const linieIds = (linii ?? []).map((linie) => linie.id)
  if (linieIds.length === 0) return 0

  const { count, error } = await ctx.supabase
    .from('aplicari_tratament')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', ctx.tenantId)
    .in('plan_linie_id', linieIds)

  if (error) throw error
  return count ?? 0
}

/**
 * Șterge hard un plan. Permis doar dacă nu are aplicări asociate.
 * Aruncă eroare descriptivă dacă există dependențe.
 */
export async function hardDeletePlanTratament(planId: string): Promise<void> {
  const ctx = await getQueryContext()
  await ensurePlanExists(ctx, planId)

  const aplicariCount = await countAplicariPlan(planId)
  if (aplicariCount > 0) {
    throw new Error('Plan cu aplicări istorice nu poate fi șters. Dezactivează-l în schimb.')
  }

  const { error: asocieriError } = await ctx.supabase
    .from('parcele_planuri')
    .delete()
    .eq('tenant_id', ctx.tenantId)
    .eq('plan_id', planId)

  if (asocieriError) throw asocieriError

  const { error: liniiError } = await ctx.supabase
    .from('planuri_tratament_linii')
    .delete()
    .eq('tenant_id', ctx.tenantId)
    .eq('plan_id', planId)

  if (liniiError) throw liniiError

  const { error: planError } = await ctx.supabase
    .from('planuri_tratament')
    .delete()
    .eq('tenant_id', ctx.tenantId)
    .eq('id', planId)

  if (planError) throw planError
}

/** Decuplează aplicările istorice de o linie din plan înainte de ștergere. */
export async function detachAplicariDeLinie(linieId: string): Promise<void> {
  const ctx = await getQueryContext()

  const { error } = await ctx.supabase
    .from('aplicari_tratament')
    .update({ plan_linie_id: null })
    .eq('tenant_id', ctx.tenantId)
    .eq('plan_linie_id', linieId)

  if (error) throw error
}

/** Dezactivează o asociere plan-parcelă existentă. */
export async function deactivateParcelaPlan(parcelaPlanId: string): Promise<ParcelaPlan> {
  const ctx = await getQueryContext()

  const { data, error } = await ctx.supabase
    .from('parcele_planuri')
    .update({ activ: false })
    .eq('tenant_id', ctx.tenantId)
    .eq('id', parcelaPlanId)
    .select(PARCELA_PLAN_SELECT)
    .single()

  if (error) throw error
  return data
}

/**
 * Listează parcelele care au un plan activ în anul cerut.
 * Exemplu: `listParceleCuPlanActiv(2026)`
 */
export async function listParceleCuPlanActiv(an: number): Promise<ParcelaCuPlanActiv[]> {
  const { supabase, tenantId } = await getQueryContext()

  const { data, error } = await supabase
    .from('parcele_planuri')
    .select(
      `${PARCELA_PLAN_SELECT}, parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2), plan:planuri_tratament(id,nume,cultura_tip,activ)`
    )
    .eq('tenant_id', tenantId)
    .eq('an', an)
    .eq('activ', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as Array<
    ParcelaPlan & {
      parcela: ParcelaCuPlanActiv['parcela'] | ParcelaCuPlanActiv['parcela'][]
      plan: ParcelaCuPlanActiv['plan'] | ParcelaCuPlanActiv['plan'][]
    }
  >).map((row) => ({
    ...row,
    parcela: firstRelation(row.parcela),
    plan: firstRelation(row.plan),
  }))
}

/**
 * Numără stadiile fenologice pentru un set de parcele într-un an.
 * Exemplu: `countStadiiPentruParcelele(['uuid-1', 'uuid-2'], 2026)`
 */
export async function countStadiiPentruParcelele(parcelaIds: string[], an: number): Promise<number> {
  if (parcelaIds.length === 0) return 0

  const { supabase, tenantId } = await getQueryContext()

  const { count, error } = await supabase
    .from('stadii_fenologice_parcela')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('an', an)
    .in('parcela_id', parcelaIds)

  if (error) throw error
  return count ?? 0
}

/**
 * Returnează sumarul unei parcele pentru dashboard-ul de tratamente.
 * Exemplu: `getParcelaTratamenteContext('uuid-parcela')`
 */
export async function getParcelaTratamenteContext(parcelaId: string): Promise<ParcelaTratamenteContext | null> {
  const { supabase, tenantId } = await getQueryContext()

  const { data, error } = await supabase
    .from('parcele')
    .select('id,id_parcela,nume_parcela,cultura,tip_fruct,soi,tip_unitate,suprafata_m2')
    .eq('id', parcelaId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error
  return data ?? null
}

/**
 * Atribuie un plan unei parcele și dezactivează celelalte planuri active pentru aceeași pereche parcelă+an.
 * Exemplu: `assignPlanToParcela('uuid-parcela', 'uuid-plan', 2026)`
 * @remarks Rollback manual: dacă insertul noului plan eșuează, planul anterior este reactivat.
 */
export async function assignPlanToParcela(parcelaId: string, planId: string, an: number): Promise<ParcelaPlan> {
  const ctx = await getQueryContext()
  await ensurePlanExists(ctx, planId)

  const { data: planActivVechi, error: planActivVechiError } = await ctx.supabase
    .from('parcele_planuri')
    .select('id')
    .eq('tenant_id', ctx.tenantId)
    .eq('parcela_id', parcelaId)
    .eq('an', an)
    .eq('activ', true)
    .maybeSingle()

  if (planActivVechiError) throw planActivVechiError

  const { data: existing, error: existingError } = await ctx.supabase
    .from('parcele_planuri')
    .select(PARCELA_PLAN_SELECT)
    .eq('tenant_id', ctx.tenantId)
    .eq('parcela_id', parcelaId)
    .eq('plan_id', planId)
    .eq('an', an)
    .maybeSingle()

  if (existingError) throw existingError

  const { error: deactivateError } = await ctx.supabase
    .from('parcele_planuri')
    .update({ activ: false })
    .eq('tenant_id', ctx.tenantId)
    .eq('parcela_id', parcelaId)
    .eq('an', an)
    .eq('activ', true)

  if (deactivateError) throw deactivateError

  if (existing) {
    const { data: reactivated, error: reactivateError } = await ctx.supabase
      .from('parcele_planuri')
      .update({ activ: true })
      .eq('id', existing.id)
      .eq('tenant_id', ctx.tenantId)
      .select(PARCELA_PLAN_SELECT)
      .single()

    if (reactivateError) throw reactivateError
    return reactivated
  }

  const { data: inserted, error: insertError } = await ctx.supabase
    .from('parcele_planuri')
    .insert({
      tenant_id: ctx.tenantId,
      parcela_id: parcelaId,
      plan_id: planId,
      an,
      activ: true,
    })
    .select(PARCELA_PLAN_SELECT)
    .single()

  if (insertError) {
    if (planActivVechi?.id) {
      await ctx.supabase
        .from('parcele_planuri')
        .update({ activ: true })
        .eq('tenant_id', ctx.tenantId)
        .eq('id', planActivVechi.id)
    }

    throw new Error(`Eroare la asignarea planului: ${insertError.message}`)
  }
  return inserted
}

/**
 * Returnează planul activ pentru o parcelă într-un an dat.
 * Exemplu: `getPlanActivPentruParcela('uuid-parcela', 2026)`
 */
export async function getPlanActivPentruParcela(
  parcelaId: string,
  an: number
): Promise<PlanActivParcela | null> {
  const { supabase, tenantId } = await getQueryContext()

  const { data, error } = await supabase
    .from('parcele_planuri')
    .select(`${PARCELA_PLAN_SELECT}, plan:planuri_tratament(${PLAN_SELECT})`)
    .eq('tenant_id', tenantId)
    .eq('parcela_id', parcelaId)
    .eq('an', an)
    .eq('activ', true)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return {
    ...(data as ParcelaPlan & { plan: PlanTratament | PlanTratament[] | null }),
    plan: firstRelation((data as ParcelaPlan & { plan: PlanTratament | PlanTratament[] | null }).plan),
  } satisfies PlanActivParcela
}

/**
 * Listează stadiile fenologice înregistrate pentru o parcelă și un an.
 * Exemplu: `listStadiiPentruParcela('uuid-parcela', 2026)`
 */
export async function listStadiiPentruParcela(
  parcelaId: string,
  an: number,
  cohort?: Cohorta
): Promise<StadiuFenologicParcela[]> {
  const { supabase, tenantId } = await getQueryContext()

  let query = supabase
    .from('stadii_fenologice_parcela')
    .select(STADIU_SELECT)
    .eq('tenant_id', tenantId)
    .eq('parcela_id', parcelaId)
    .eq('an', an)
    .order('data_observata', { ascending: true })
    .order('created_at', { ascending: true })

  const cohortNormalizat = normalizeOptionalCohorta(cohort)
  if (cohortNormalizat) {
    query = query.eq('cohort', cohortNormalizat)
  }

  const { data, error } = await query

  if (error) throw error
  return data ?? []
}

/**
 * Returnează stadiul curent pe baza ordinii logice de stadii și a ultimei observații.
 * Exemplu: `getStadiuCurentParcela('uuid-parcela', 2026)`
 */
export async function getStadiuCurentParcela(
  parcelaId: string,
  an: number,
  cohort?: Cohorta
): Promise<StadiuFenologicParcela | null> {
  const stadii = await listStadiiPentruParcela(parcelaId, an, cohort)
  if (stadii.length === 0) return null

  return [...stadii].sort((a, b) => {
    const ordineDiff = getStadiuOrdine(b.stadiu) - getStadiuOrdine(a.stadiu)
    if (ordineDiff !== 0) return ordineDiff

    const dataDiff = new Date(b.data_observata).getTime() - new Date(a.data_observata).getTime()
    if (dataDiff !== 0) return dataDiff

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })[0] ?? null
}

/**
 * Înregistrează un stadiu fenologic prin upsert pe cheia unică `(parcela_id, an, stadiu, sursa)`.
 * Exemplu: `recordStadiu({ parcela_id: 'uuid', an: 2026, stadiu: 'inflorit', cohort: 'floricane', data_observata: '2026-05-10', sursa: 'manual' })`
 */
export async function recordStadiu(data: InsertStadiu): Promise<StadiuFenologicParcela> {
  const ctx = await getQueryContext()

  const payload: StadiuFenologicParcelaInsert = {
    tenant_id: ctx.tenantId,
    parcela_id: data.parcela_id,
    an: data.an,
    stadiu: requireStadiuCod(data.stadiu, 'stadiu'),
    cohort: normalizeOptionalCohorta(data.cohort),
    data_observata: data.data_observata,
    sursa: data.sursa,
    observatii: normalizeText(data.observatii),
    created_by: ctx.userId,
  }

  const { data: upserted, error } = await ctx.supabase
    .from('stadii_fenologice_parcela')
    .upsert(payload, { onConflict: 'parcela_id,an,stadiu,sursa,cohort' })
    .select(STADIU_SELECT)
    .single()

  if (error) throw error
  return upserted
}

/**
 * Listează aplicările unei parcele cu filtre opționale după status și interval calendaristic.
 * Exemplu: `listAplicariParcela('uuid-parcela', { status: 'aplicata', from: new Date('2026-05-01') })`
 */
export async function listAplicariParcela(
  parcelaId: string,
  opts?: ListAplicariOpts
): Promise<AplicareTratamentDetaliu[]> {
  const { supabase, tenantId } = await getQueryContext()

  let query = supabase
    .from('aplicari_tratament')
    .select(
      `${APLICARE_SELECT}, produs:produse_fitosanitare(${PRODUS_LOOKUP_SELECT}), linie:planuri_tratament_linii(${LINIE_SELECT}), parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2)`
    )
    .eq('tenant_id', tenantId)
    .eq('parcela_id', parcelaId)
    .order('data_planificata', { ascending: false })
    .order('created_at', { ascending: false })

  if (opts?.status) {
    query = query.eq('status', opts.status)
  }

  const { data, error } = await query
  if (error) throw error

  const aplicari = ((data ?? []) as Array<
    AplicareTratament & {
      produs: AplicareTratamentDetaliu['produs'] | AplicareTratamentDetaliu['produs'][]
      linie: PlanTratamentLinie | PlanTratamentLinie[] | null
      parcela: AplicareTratamentDetaliu['parcela'] | AplicareTratamentDetaliu['parcela'][]
    }
  >).map((row) => ({
    ...row,
    produs: firstRelation(row.produs),
    linie: firstRelation(row.linie),
    parcela: firstRelation(row.parcela),
  }))
  if (!opts?.from && !opts?.to) return aplicari

  return aplicari.filter((aplicare) => {
    const date = effectiveAplicareDate(aplicare)
    if (!date) return false
    if (opts.from && date < opts.from) return false
    if (opts.to && date > opts.to) return false
    return true
  })
}

/**
 * Listează aplicările planificate pentru dashboard, pe toate parcelele tenantului.
 * Exemplu: `listAplicariPlanificateDashboard({ limit: 10, fromDate: new Date() })`
 */
export async function listAplicariPlanificateDashboard(
  opts?: ListAplicariDashboardOpts
): Promise<AplicareTratamentDetaliu[]> {
  const { supabase, tenantId } = await getQueryContext()
  const fromDate = opts?.fromDate ? toIsoDate(opts.fromDate) : toIsoDate(new Date())
  const limit = opts?.limit ?? 20

  const { data, error } = await supabase
    .from('aplicari_tratament')
    .select(
      `${APLICARE_SELECT}, produs:produse_fitosanitare(${PRODUS_LOOKUP_SELECT}), linie:planuri_tratament_linii(${LINIE_SELECT}), parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2)`
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'planificata')
    .gte('data_planificata', fromDate)
    .order('data_planificata', { ascending: true })
    .limit(limit)

  if (error) throw error
  return ((data ?? []) as Array<
    AplicareTratament & {
      produs: AplicareTratamentDetaliu['produs'] | AplicareTratamentDetaliu['produs'][]
      linie: PlanTratamentLinie | PlanTratamentLinie[] | null
      parcela: AplicareTratamentDetaliu['parcela'] | AplicareTratamentDetaliu['parcela'][]
    }
  >).map((row) => ({
    ...row,
    produs: firstRelation(row.produs),
    linie: firstRelation(row.linie),
    parcela: firstRelation(row.parcela),
  }))
}

/**
 * Listează aplicările cross-parcel pentru un interval calendaristic, cu lookup de plan/produs/parcelă.
 * Intervalul este aplicat pe data efectivă (`data_aplicata` sau `data_planificata`), similar fluxului pe parcelă.
 */
export async function listAplicariCrossParcelPentruInterval(
  options: ListAplicariCrossParcelOpts
): Promise<AplicareCrossParcelItem[]> {
  const ctx = await getQueryContext()

  let query = ctx.supabase
    .from('aplicari_tratament')
    .select(
      `${APLICARE_SELECT}, produs:produse_fitosanitare(${PRODUS_LOOKUP_SELECT}), linie:planuri_tratament_linii(${LINIE_SELECT}, plan:planuri_tratament(id,nume,cultura_tip,activ,arhivat)), parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2,latitudine,longitudine,gps_lat,gps_lng)`
    )
    .eq('tenant_id', ctx.tenantId)
    .order('data_planificata', { ascending: true })
    .order('created_at', { ascending: true })

  if (options.status && options.status.length > 0) {
    query = query.in('status', options.status)
  }

  const { data, error } = await query
  if (error) throw error

  const rows = ((data ?? []) as CrossParcelAplicareRow[]).filter((row) => {
    const date = effectiveAplicareDate(row)
    if (!date) return false
    if (date < options.dataStart) return false
    if (date > options.dataEnd) return false
    return true
  })

  const parcelIds = Array.from(new Set(rows.map((row) => row.parcela_id).filter(Boolean)))
  const nextHarvestMap = await getNextHarvestMap(ctx, parcelIds, options.dataStart)

  return mapAplicariCrossParcel(rows, nextHarvestMap).sort((a, b) => {
    const dateA = a.data_programata ?? a.data_aplicata ?? ''
    const dateB = b.data_programata ?? b.data_aplicata ?? ''
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    return (a.parcela_nume ?? '').localeCompare(b.parcela_nume ?? '', 'ro')
  })
}

/**
 * Returnează statistici sintetice pentru hub-ul global de tratamente.
 * `cu_meteo_favorabila` rămâne 0 aici și se completează client-side după hidratarea forecast-ului.
 */
export async function getStatisticiAplicariCrossParcel(
  options: ListAplicariCrossParcelOpts
): Promise<StatisticiAplicariCrossParcel> {
  const aplicari = await listAplicariCrossParcelPentruInterval(options)

  return {
    total: aplicari.length,
    programate: aplicari.filter((aplicare) => aplicare.status === 'planificata' || aplicare.status === 'reprogramata').length,
    aplicate: aplicari.filter((aplicare) => aplicare.status === 'aplicata').length,
    anulate: aplicari.filter((aplicare) => aplicare.status === 'anulata').length,
    in_phi_warning: aplicari.filter((aplicare) => aplicare.phi_warning).length,
    cu_meteo_favorabila: 0,
  }
}

/**
 * Returnează o aplicare cu lookup-ul produsului, al liniei de plan și al parcelei.
 * Exemplu: `getAplicareById('uuid-aplicare')`
 */
export async function getAplicareById(id: string): Promise<AplicareTratamentDetaliu | null> {
  const { supabase, tenantId } = await getQueryContext()

  const { data, error } = await supabase
    .from('aplicari_tratament')
    .select(
      `${APLICARE_SELECT}, produs:produse_fitosanitare(${PRODUS_LOOKUP_SELECT}), linie:planuri_tratament_linii(${LINIE_SELECT}), parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2)`
    )
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as AplicareTratament & {
    produs: AplicareTratamentDetaliu['produs'] | AplicareTratamentDetaliu['produs'][]
    linie: PlanTratamentLinie | PlanTratamentLinie[] | null
    parcela: AplicareTratamentDetaliu['parcela'] | AplicareTratamentDetaliu['parcela'][]
  }

  return {
    ...row,
    produs: firstRelation(row.produs),
    linie: firstRelation(row.linie),
    parcela: firstRelation(row.parcela),
  }
}

/**
 * Numără aplicările efectiv aplicate pentru același produs într-un an calendaristic, pe o parcelă.
 * Exemplu: `getAplicariProdusInAn('uuid-parcela', 'uuid-produs', 2026)`
 */
export async function getAplicariProdusInAn(
  parcelaId: string,
  produsId: string,
  an: number
): Promise<number> {
  const { supabase, tenantId } = await getQueryContext()

  const from = `${an}-01-01`
  const to = `${an}-12-31`

  const { count, error } = await supabase
    .from('aplicari_tratament')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('parcela_id', parcelaId)
    .eq('produs_id', produsId)
    .eq('status', 'aplicata')
    .gte('data_aplicata', from)
    .lte('data_aplicata', to)

  if (error) throw error
  return count ?? 0
}

/**
 * Toate aplicările pentru o parcelă într-un an, cu join pe produs pentru FRAC/PHI/substanță activă.
 * Exemplu: `getAplicariAnualAgregate('uuid-parcela', 2026)`
 */
export async function getAplicariAnualAgregate(
  parcelaId: string,
  an: number
): Promise<AplicareAgregata[]> {
  const { supabase, tenantId } = await getQueryContext()
  const start = `${an}-01-01`
  const end = `${an}-12-31`

  const { data, error } = await supabase
    .from('aplicari_tratament')
    .select(
      `${APLICARE_SELECT}, produs:produse_fitosanitare(${PRODUS_LOOKUP_SELECT}), linie:planuri_tratament_linii(${LINIE_SELECT}, plan:planuri_tratament(id,nume,cultura_tip,activ,arhivat)), parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2,cultura,tip_fruct,soi,tip_unitate)`
    )
    .eq('tenant_id', tenantId)
    .eq('parcela_id', parcelaId)
    .order('data_planificata', { ascending: true })
    .order('data_aplicata', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error

  return mapAplicariAgregate((data ?? []) as AplicareAgregataRow[]).filter((aplicare) => {
    const effectiveDate = aplicare.data_aplicata ?? aplicare.data_planificata
    if (!effectiveDate) return false
    return effectiveDate >= start && effectiveDate <= end
  })
}

/**
 * Agregare cross-parcelă pentru tenantul curent: fiecare parcelă cu aplicările sale.
 * Exemplu: `getAplicariAnualToateParcelele(2026)`
 */
export async function getAplicariAnualToateParcelele(an: number): Promise<AplicariAnualeParcelaGroup[]> {
  const { supabase, tenantId } = await getQueryContext()
  const start = `${an}-01-01`
  const end = `${an}-12-31`

  const [parceleResult, aplicariResult] = await Promise.all([
    supabase
      .from('parcele')
      .select('id,id_parcela,nume_parcela,suprafata_m2,cultura,tip_fruct,soi,tip_unitate')
      .eq('tenant_id', tenantId)
      .order('nume_parcela', { ascending: true }),
    supabase
      .from('aplicari_tratament')
      .select(
        `${APLICARE_SELECT}, produs:produse_fitosanitare(${PRODUS_LOOKUP_SELECT}), linie:planuri_tratament_linii(${LINIE_SELECT}, plan:planuri_tratament(id,nume,cultura_tip,activ,arhivat)), parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2,cultura,tip_fruct,soi,tip_unitate)`
      )
      .eq('tenant_id', tenantId)
      .order('data_planificata', { ascending: true })
      .order('data_aplicata', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  if (parceleResult.error) throw parceleResult.error
  if (aplicariResult.error) throw aplicariResult.error

  const aplicariByParcela = new Map<string, AplicareAgregata[]>()
  for (const aplicare of mapAplicariAgregate((aplicariResult.data ?? []) as AplicareAgregataRow[])) {
    const effectiveDate = aplicare.data_aplicata ?? aplicare.data_planificata
    if (!effectiveDate || effectiveDate < start || effectiveDate > end) continue

    const current = aplicariByParcela.get(aplicare.parcela_id) ?? []
    current.push(aplicare)
    aplicariByParcela.set(aplicare.parcela_id, current)
  }

  return (parceleResult.data ?? []).map((parcela) => ({
    parcela,
    aplicari: aplicariByParcela.get(parcela.id) ?? [],
  }))
}

/**
 * Metrici rapide conformitate per parcelă: cupru kg/ha, violări FRAC, PHI conflicts.
 * Exemplu: `getConformitateMetrici('uuid-parcela', 2026)`
 */
export async function getConformitateMetrici(
  parcelaId: string,
  an: number
): Promise<ConformitateMetrici> {
  const [aplicari, produse] = await Promise.all([
    getAplicariAnualAgregate(parcelaId, an),
    listProduseFitosanitare(),
  ])

  return {
    parcelaId,
    ...buildConformitateMetrici(aplicari, produse, an),
  }
}

/**
 * Returnează statistici rapide pentru landing-ul global al modulului de tratamente.
 * Exemplu: `getTratamenteGlobalStats(2026)`
 */
export async function getTratamenteGlobalStats(an = new Date().getUTCFullYear()): Promise<TratamenteGlobalStats> {
  const ctx = await getQueryContext()
  const start = `${an}-01-01`
  const end = `${an}-12-31`
  const today = toIsoDate(new Date())
  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = toIsoDate(tomorrowDate)
  const currentYear = new Date().getUTCFullYear()

  const [aplicariResult, parcelePlanResult] = await Promise.all([
    ctx.supabase
      .from('aplicari_tratament')
      .select(
        `${APLICARE_SELECT}, produs:produse_fitosanitare(${PRODUS_LOOKUP_SELECT}), linie:planuri_tratament_linii(${LINIE_SELECT}, plan:planuri_tratament(id,nume,cultura_tip,activ,arhivat)), parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2,cultura,tip_fruct,soi,tip_unitate)`
      )
      .eq('tenant_id', ctx.tenantId)
      .order('data_planificata', { ascending: true })
      .order('data_aplicata', { ascending: true })
      .order('created_at', { ascending: true }),
    ctx.supabase
      .from('parcele_planuri')
      .select('parcela_id')
      .eq('tenant_id', ctx.tenantId)
      .eq('an', an)
      .eq('activ', true),
  ])

  if (aplicariResult.error) throw aplicariResult.error
  if (parcelePlanResult.error) throw parcelePlanResult.error

  const aplicariRows = (aplicariResult.data ?? []) as TratamenteGlobalStatsAplicareRow[]
  const aplicariMapate = mapAplicariAgregate(aplicariRows as AplicareAgregataRow[])
  const aplicariInAn = aplicariMapate.filter((aplicare) => {
    const effectiveDate = aplicare.data_aplicata ?? aplicare.data_planificata
    if (!effectiveDate) return false
    return effectiveDate >= start && effectiveDate <= end
  })

  const produseById = new Map<string, ProdusFitosanitar>()
  for (const row of aplicariRows) {
    const produs = firstRelation(row.produs)
    if (!produs || produseById.has(produs.id)) continue
    produseById.set(produs.id, toProdusCatalogItem(produs))
  }

  let alerteFracTotal = 0
  let alerteCupruTotal = 0
  const aplicariByParcela = new Map<string, AplicareAgregata[]>()
  for (const aplicare of aplicariInAn) {
    const current = aplicariByParcela.get(aplicare.parcela_id) ?? []
    current.push(aplicare)
    aplicariByParcela.set(aplicare.parcela_id, current)
  }

  for (const aplicariParcela of aplicariByParcela.values()) {
    const metrici = buildConformitateMetrici(aplicariParcela, [...produseById.values()], an)
    alerteFracTotal += metrici.fracViolatii
    if (metrici.cupruAlertLevel === 'exceeded') {
      alerteCupruTotal += 1
    }
  }

  return {
    aplicariAzi:
      an === currentYear
        ? aplicariMapate.filter(
            (aplicare) =>
              (aplicare.status === 'planificata' || aplicare.status === 'reprogramata') &&
              aplicare.data_planificata === today
          ).length
        : 0,
    aplicariMaine:
      an === currentYear
        ? aplicariMapate.filter(
            (aplicare) =>
              (aplicare.status === 'planificata' || aplicare.status === 'reprogramata') &&
              aplicare.data_planificata === tomorrow
          ).length
        : 0,
    aplicariAplicateSezon: aplicariInAn.filter(
      (aplicare) => aplicare.status === 'aplicata' && Boolean(aplicare.data_aplicata)
    ).length,
    parceleCuPlan: new Set((parcelePlanResult.data ?? []).map((row) => row.parcela_id).filter(Boolean)).size,
    alerteFracTotal,
    alerteCupruTotal,
  }
}

/**
 * Creează o aplicare planificată pentru tenantul curent.
 * Exemplu: `createAplicarePlanificata({ parcela_id: 'uuid', data_planificata: '2026-05-12', produs_id: 'uuid-produs' })`
 */
export async function createAplicarePlanificata(
  data: InsertAplicarePlanificata
): Promise<AplicareTratament> {
  const ctx = await getQueryContext()

  const payload: AplicareTratamentInsert = {
    tenant_id: ctx.tenantId,
    parcela_id: data.parcela_id,
    cultura_id: data.cultura_id ?? null,
    plan_linie_id: data.plan_linie_id ?? null,
    produs_id: data.produs_id ?? null,
    produs_nume_manual: normalizeText(data.produs_nume_manual),
    data_planificata: data.data_planificata,
    data_aplicata: null,
    doza_ml_per_hl: data.doza_ml_per_hl ?? null,
    doza_l_per_ha: data.doza_l_per_ha ?? null,
    cantitate_totala_ml: data.cantitate_totala_ml ?? null,
    stoc_mutatie_id: data.stoc_mutatie_id ?? null,
    status: data.status ?? 'planificata',
    meteo_snapshot: data.meteo_snapshot ?? null,
    stadiu_la_aplicare: normalizeOptionalStadiu(data.stadiu_la_aplicare),
    cohort_la_aplicare: normalizeOptionalCohorta(data.cohort_la_aplicare),
    observatii: normalizeText(data.observatii),
    operator: normalizeText(data.operator),
    created_by: ctx.userId,
    updated_by: ctx.userId,
  }

  const { data: inserted, error } = await ctx.supabase
    .from('aplicari_tratament')
    .insert(payload)
    .select(APLICARE_SELECT)
    .single()

  if (error) throw error
  return inserted
}

/**
 * Marchează o aplicare ca efectuată și salvează snapshot-ul operațional relevant.
 * Dacă `meteoSnapshot` lipsește, se încearcă fetch automat OpenWeatherMap.
 * Eșecul meteo nu blochează aplicarea.
 * Exemplu: `markAplicareAsAplicata('uuid', { dataAplicata: new Date(), operator: 'Ion' })`
 */
export async function markAplicareAsAplicata(
  id: string,
  payload: MarkAplicareAsAplicataPayload
): Promise<AplicareTratament> {
  const ctx = await getQueryContext()
  const current = await getAplicareOwnedByTenant(ctx, id)

  let meteoSnapshot: Json | null | undefined = payload.meteoSnapshot
  if ((meteoSnapshot === undefined || meteoSnapshot === null) && current.parcela_id) {
    try {
      const autoSnapshot = await getMeteoSnapshot(current.parcela_id)
      meteoSnapshot = autoSnapshot ? (autoSnapshot as unknown as Json) : null
    } catch (error) {
      console.warn(
        '[tratamente] snapshot meteo automat indisponibil',
        sanitizeForLog({
          aplicareId: id,
          parcelaId: current.parcela_id,
          error: toSafeErrorContext(error),
        }),
      )
      meteoSnapshot = null
    }
  }

  const updatePayload: AplicareTratamentUpdate = {
    status: 'aplicata',
    data_aplicata: payload.dataAplicata.toISOString(),
    cantitate_totala_ml: payload.cantitateTotala ?? null,
    meteo_snapshot: meteoSnapshot ?? null,
    operator: normalizeText(payload.operator),
    observatii: normalizeText(payload.observatii),
    stadiu_la_aplicare: normalizeOptionalStadiu(payload.stadiuLaAplicare),
    updated_by: ctx.userId,
  }

  if (payload.cohortLaAplicare !== undefined) {
    updatePayload.cohort_la_aplicare = normalizeOptionalCohorta(payload.cohortLaAplicare)
  }

  const { data, error } = await ctx.supabase
    .from('aplicari_tratament')
    .update(updatePayload)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select(APLICARE_SELECT)
    .single()

  if (error) throw error
  return data
}

/**
 * Reprogramează o aplicare și atașează motivul în observații, dacă există.
 * Exemplu: `reprogrameazaAplicare('uuid', new Date('2026-05-18'), 'Ploaie')`
 */
export async function reprogrameazaAplicare(
  id: string,
  dataNoua: Date,
  motiv?: string
): Promise<AplicareTratament> {
  const ctx = await getQueryContext()
  const current = await getAplicareOwnedByTenant(ctx, id)

  const observatii = combineObservatii(
    current.observatii,
    motiv ? `Reprogramată: ${motiv.trim()}` : null
  )

  const { data, error } = await ctx.supabase
    .from('aplicari_tratament')
    .update({
      status: 'reprogramata',
      data_planificata: toIsoDate(dataNoua),
      observatii,
      updated_by: ctx.userId,
    })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select(APLICARE_SELECT)
    .single()

  if (error) throw error
  return data
}

/**
 * Anulează o aplicare și salvează motivul în observații.
 * Exemplu: `anuleazaAplicare('uuid', 'Fereastră meteo nefavorabilă')`
 */
export async function anuleazaAplicare(id: string, motiv: string): Promise<AplicareTratament> {
  const ctx = await getQueryContext()
  const current = await getAplicareOwnedByTenant(ctx, id)

  const observatii = combineObservatii(current.observatii, `Anulată: ${motiv.trim()}`)

  const { data, error } = await ctx.supabase
    .from('aplicari_tratament')
    .update({
      status: 'anulata',
      observatii,
      updated_by: ctx.userId,
    })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select(APLICARE_SELECT)
    .single()

  if (error) throw error
  return data
}

/**
 * Șterge definitiv o aplicare doar dacă este încă în starea `planificata`.
 * Exemplu: `deleteAplicare('uuid-aplicare')`
 */
export async function deleteAplicare(id: string): Promise<void> {
  const ctx = await getQueryContext()
  const aplicare = await getAplicareOwnedByTenant(ctx, id)

  if (aplicare.status !== 'planificata') {
    throw new Error('Doar aplicările cu status planificată pot fi șterse definitiv.')
  }

  const { error } = await ctx.supabase
    .from('aplicari_tratament')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (error) throw error
}

/**
 * Actualizează mesajul de eroare într-o formă prietenoasă pentru layer-ele superioare.
 * Exemplu: `throw mapTratamenteError(error, 'Nu s-au putut încărca tratamentele.')`
 */
export function mapTratamenteError(error: unknown, fallbackMessage: string): Error {
  return asError(error, fallbackMessage)
}

/**
 * Creează un produs fitosanitar custom pentru tenantul curent (INSERT strict, fără upsert).
 * Exemplu: `createProdusFitosanitar({ nume_comercial: 'Cupru X', substanta_activa: 'cupru', tip: 'fungicid' })`
 */
export async function createProdusFitosanitar(data: InsertTenantProdus): Promise<ProdusFitosanitar> {
  const { supabase, tenantId, userId } = await getQueryContext()

  const payload: ProdusFitosanitarInsert = {
    tenant_id: tenantId,
    nume_comercial: data.nume_comercial.trim(),
    substanta_activa: data.substanta_activa.trim(),
    tip: data.tip,
    frac_irac: normalizeText(data.frac_irac),
    doza_min_ml_per_hl: data.doza_min_ml_per_hl ?? null,
    doza_max_ml_per_hl: data.doza_max_ml_per_hl ?? null,
    doza_min_l_per_ha: data.doza_min_l_per_ha ?? null,
    doza_max_l_per_ha: data.doza_max_l_per_ha ?? null,
    phi_zile: data.phi_zile ?? null,
    nr_max_aplicari_per_sezon: data.nr_max_aplicari_per_sezon ?? null,
    interval_min_aplicari_zile: data.interval_min_aplicari_zile ?? null,
    omologat_culturi: normalizeCulturi(data.omologat_culturi),
    activ: data.activ ?? true,
    created_by: userId,
  }

  const { data: inserted, error } = await supabase
    .from('produse_fitosanitare')
    .insert(payload)
    .select(PRODUS_SELECT)
    .single()

  if (error) throw error
  return inserted
}

/**
 * Actualizează un produs fitosanitar aparținând tenantului curent.
 * Guard pe `tenant_id` previne modificarea produselor shared.
 * Exemplu: `updateProdusFitosanitar('uuid', { phi_zile: 14 })`
 */
export async function updateProdusFitosanitar(
  produsId: string,
  data: Partial<InsertTenantProdus>
): Promise<ProdusFitosanitar> {
  const { supabase, tenantId } = await getQueryContext()

  const payload: ProdusFitosanitarUpdate = {}
  if (data.nume_comercial !== undefined) payload.nume_comercial = data.nume_comercial.trim()
  if (data.substanta_activa !== undefined) payload.substanta_activa = data.substanta_activa.trim()
  if (data.tip !== undefined) payload.tip = data.tip
  if (data.frac_irac !== undefined) payload.frac_irac = normalizeText(data.frac_irac)
  if (data.doza_min_ml_per_hl !== undefined) payload.doza_min_ml_per_hl = data.doza_min_ml_per_hl ?? null
  if (data.doza_max_ml_per_hl !== undefined) payload.doza_max_ml_per_hl = data.doza_max_ml_per_hl ?? null
  if (data.doza_min_l_per_ha !== undefined) payload.doza_min_l_per_ha = data.doza_min_l_per_ha ?? null
  if (data.doza_max_l_per_ha !== undefined) payload.doza_max_l_per_ha = data.doza_max_l_per_ha ?? null
  if (data.phi_zile !== undefined) payload.phi_zile = data.phi_zile ?? null
  if (data.nr_max_aplicari_per_sezon !== undefined) payload.nr_max_aplicari_per_sezon = data.nr_max_aplicari_per_sezon ?? null
  if (data.interval_min_aplicari_zile !== undefined) payload.interval_min_aplicari_zile = data.interval_min_aplicari_zile ?? null
  if (data.omologat_culturi !== undefined) payload.omologat_culturi = normalizeCulturi(data.omologat_culturi)
  if (data.activ !== undefined) payload.activ = data.activ

  const { data: updated, error } = await supabase
    .from('produse_fitosanitare')
    .update(payload)
    .eq('id', produsId)
    .eq('tenant_id', tenantId)
    .select(PRODUS_SELECT)
    .single()

  if (error) throw error
  return updated
}

/**
 * Șterge definitiv un produs fitosanitar al tenantului curent.
 * Guard pe `tenant_id` previne ștergerea produselor shared (RLS blochează oricum).
 * Exemplu: `deleteProdusFitosanitar('uuid')`
 */
export async function deleteProdusFitosanitar(produsId: string): Promise<void> {
  const { supabase, tenantId } = await getQueryContext()

  const { error } = await supabase
    .from('produse_fitosanitare')
    .delete()
    .eq('id', produsId)
    .eq('tenant_id', tenantId)

  if (error) throw error
}

/**
 * Verifică dacă un produs apare în linii de plan din tenantul curent.
 * Returnează lista planurilor care referențiază produsul — util pentru mesaj prietenos la ștergere.
 * Exemplu: `isProdusFolositInPlanActiv('uuid-produs')`
 */
export async function isProdusFolositInPlanActiv(
  produsId: string
): Promise<{ folosit: boolean; planuri: Array<{ id: string; denumire: string }> }> {
  const { supabase, tenantId } = await getQueryContext()

  const { data, error } = await supabase
    .from('planuri_tratament_linii')
    .select('plan_id, plan:planuri_tratament!inner(id,nume,activ)')
    .eq('produs_id', produsId)
    .eq('tenant_id', tenantId)

  if (error) throw error

  const linii = (data ?? []) as Array<{
    plan_id: string
    plan: { id: string; nume: string; activ: boolean } | Array<{ id: string; nume: string; activ: boolean }>
  }>

  const planuri: Array<{ id: string; denumire: string }> = []
  const seenIds = new Set<string>()

  for (const linie of linii) {
    const plan = Array.isArray(linie.plan) ? linie.plan[0] : linie.plan
    if (plan && !seenIds.has(plan.id)) {
      seenIds.add(plan.id)
      planuri.push({ id: plan.id, denumire: plan.nume })
    }
  }

  return { folosit: planuri.length > 0, planuri }
}
