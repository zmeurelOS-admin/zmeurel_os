import { createClient } from '@/lib/supabase/server'
import type { CropCod } from '@/lib/crops/crop-codes'
import { normalizeCropCod } from '@/lib/crops/crop-codes'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import type { Cohorta } from '@/lib/tratamente/configurare-sezon'
import { buildConformitateMetrici } from '@/lib/tratamente/conformitate/build-metrici'
import type { ConformitateMetrici } from '@/lib/tratamente/conformitate/types'
import { getMeteoSnapshot } from '@/lib/tratamente/meteo'
import { resolveRecurrence } from '@/lib/tratamente/recurrence'
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
export type PlanTratamentLinieProdus = Tables<'planuri_tratament_linie_produse'>
export type PlanTratamentLinieProdusInsert = TablesInsert<'planuri_tratament_linie_produse'>
export type PlanTratamentLinieProdusUpdate = TablesUpdate<'planuri_tratament_linie_produse'>

export type ParcelaPlan = Tables<'parcele_planuri'>
export type ParcelaPlanInsert = TablesInsert<'parcele_planuri'>
export type ParcelaPlanUpdate = TablesUpdate<'parcele_planuri'>

export type StadiuFenologicParcela = Tables<'stadii_fenologice_parcela'>
export type StadiuFenologicParcelaInsert = TablesInsert<'stadii_fenologice_parcela'>
export type StadiuFenologicParcelaUpdate = TablesUpdate<'stadii_fenologice_parcela'>

export type AplicareTratament = Tables<'aplicari_tratament'>
export type AplicareTratamentInsert = TablesInsert<'aplicari_tratament'>
export type AplicareTratamentUpdate = TablesUpdate<'aplicari_tratament'>
export type AplicareTratamentProdus = Tables<'aplicari_tratament_produse'>
export type AplicareTratamentProdusInsert = TablesInsert<'aplicari_tratament_produse'>
export type AplicareTratamentProdusUpdate = TablesUpdate<'aplicari_tratament_produse'>

export type AplicareTratamentMeteoSnapshot = Json

type ServerSupabase = Awaited<ReturnType<typeof createClient>>

const PRODUS_SELECT =
  'id,tenant_id,nume_comercial,substanta_activa,tip,frac_irac,doza_min_ml_per_hl,doza_max_ml_per_hl,doza_min_l_per_ha,doza_max_l_per_ha,phi_zile,nr_max_aplicari_per_sezon,interval_min_aplicari_zile,omologat_culturi,activ,created_at,updated_at,created_by'

const PRODUS_LOOKUP_SELECT =
  'id,tenant_id,nume_comercial,substanta_activa,tip,frac_irac,phi_zile,nr_max_aplicari_per_sezon,activ'

const PLAN_SELECT =
  'id,tenant_id,nume,cultura_tip,descriere,activ,arhivat,created_at,updated_at,created_by,updated_by'

const LINIE_SELECT =
  'id,tenant_id,plan_id,ordine,stadiu_trigger,cohort_trigger,tip_interventie,scop,regula_repetare,interval_repetare_zile,numar_repetari_max,fereastra_start_offset_zile,fereastra_end_offset_zile,produs_id,produs_nume_manual,doza_ml_per_hl,doza_l_per_ha,observatii,sursa_linie,motiv_adaugare,created_at,updated_at'

const PLAN_LINIE_PRODUS_SELECT =
  'id,tenant_id,plan_linie_id,ordine,produs_id,produs_nume_manual,produs_nume_snapshot,substanta_activa_snapshot,tip_snapshot,frac_irac_snapshot,phi_zile_snapshot,doza_ml_per_hl,doza_l_per_ha,observatii,created_at,updated_at'

const PARCELA_PLAN_SELECT =
  'id,tenant_id,parcela_id,plan_id,an,activ,created_at,updated_at'

const STADIU_SELECT =
  'id,tenant_id,parcela_id,an,stadiu,cohort,data_observata,sursa,observatii,created_at,updated_at,created_by'

const APLICARE_SELECT =
  'id,tenant_id,parcela_id,cultura_id,plan_linie_id,produs_id,produs_nume_manual,data_planificata,data_aplicata,doza_ml_per_hl,doza_l_per_ha,cantitate_totala_ml,stoc_mutatie_id,status,sursa,tip_interventie,scop,stadiu_fenologic_id,diferente_fata_de_plan,meteo_snapshot,stadiu_la_aplicare,cohort_la_aplicare,observatii,operator,created_at,updated_at,created_by,updated_by'

const APLICARE_PRODUS_SELECT =
  'id,tenant_id,aplicare_id,plan_linie_produs_id,ordine,produs_id,produs_nume_manual,produs_nume_snapshot,substanta_activa_snapshot,tip_snapshot,frac_irac_snapshot,phi_zile_snapshot,doza_ml_per_hl,doza_l_per_ha,cantitate_totala,unitate_cantitate,stoc_mutatie_id,observatii,created_at,updated_at'

const APLICARE_PRODUSE_RELATION_SELECT =
  `produse_aplicare:aplicari_tratament_produse(${APLICARE_PRODUS_SELECT}, produs:produse_fitosanitare(${PRODUS_LOOKUP_SELECT}), plan_linie_produs:planuri_tratament_linie_produse(${PLAN_LINIE_PRODUS_SELECT}))`

const LINIE_WITH_PRODUCTS_SELECT =
  `${LINIE_SELECT}, produs:produse_fitosanitare(${PRODUS_SELECT}), produse:planuri_tratament_linie_produse(${PLAN_LINIE_PRODUS_SELECT}, produs:produse_fitosanitare(${PRODUS_SELECT}))`

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

type PlanTratamentLinieV2Fields =
  | 'tip_interventie'
  | 'scop'
  | 'regula_repetare'
  | 'interval_repetare_zile'
  | 'numar_repetari_max'
  | 'fereastra_start_offset_zile'
  | 'fereastra_end_offset_zile'

type PlanTratamentLinieCompat =
  Omit<PlanTratamentLinie, PlanTratamentLinieV2Fields> &
  Partial<Pick<PlanTratamentLinie, PlanTratamentLinieV2Fields>>

export interface PlanTratamentLinieCuProdus extends PlanTratamentLinieCompat {
  produs?: ProdusFitosanitar | null
  produse?: InterventieProdusV2[]
}

type ProdusFitosanitarLookup = Pick<
  ProdusFitosanitar,
  'id' | 'tenant_id' | 'nume_comercial' | 'substanta_activa' | 'tip' | 'frac_irac' | 'phi_zile' | 'nr_max_aplicari_per_sezon' | 'activ'
>

export interface InterventieProdusV2 extends PlanTratamentLinieProdus {
  produs: ProdusFitosanitar | null
}

export interface InterventiePlanV2 extends PlanTratamentLinieCompat {
  produs: ProdusFitosanitar | null
  produse: InterventieProdusV2[]
}

export interface PlanTratamentV2 extends PlanTratament {
  interventii: InterventiePlanV2[]
}

export interface PlanTratamentCuLinii extends PlanTratamentV2 {
  linii: InterventiePlanV2[]
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
  sursa_linie?: 'din_plan' | 'adaugata_manual'
  motiv_adaugare?: string | null
  tip_interventie?: string | null
  scop?: string | null
  regula_repetare?: 'fara_repetare' | 'interval'
  interval_repetare_zile?: number | null
  numar_repetari_max?: number | null
  fereastra_start_offset_zile?: number | null
  fereastra_end_offset_zile?: number | null
  produs_id?: string | null
  produs_nume_manual?: string | null
  doza_ml_per_hl?: number | null
  doza_l_per_ha?: number | null
  observatii?: string | null
  produse?: InterventieProdusPayload[]
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
  linii: InterventiePlanV2[]
  interventii?: InterventiePlanV2[]
  parcele_asociate: PlanTratamentParcelaAsociata[]
}

export interface PlanTratamentListItem extends PlanTratament {
  linii_count: number
  nr_produse: number
  tipuri_interventie: string[]
  nr_aplicate: number
  parcele_asociate: PlanTratamentParcelaAsociata[]
}

export interface PlanTratamentRpcPayload {
  plan: PlanTratament
  linii: PlanTratamentLinie[]
  parcele_asociate: PlanTratamentParcelaAsociata[]
}

export interface InterventieProdusPayload {
  ordine?: number
  produs_id?: string | null
  produs_nume_manual?: string | null
  produs_nume_snapshot?: string | null
  substanta_activa_snapshot?: string | null
  tip_snapshot?: ProdusFitosanitar['tip'] | null
  frac_irac_snapshot?: string | null
  phi_zile_snapshot?: number | null
  doza_ml_per_hl?: number | null
  doza_l_per_ha?: number | null
  observatii?: string | null
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
  id?: string | null
  ordine: number
  stadiu_trigger: string
  cohort_trigger?: Cohorta | null
  sursa_linie?: 'din_plan' | 'adaugata_manual'
  motiv_adaugare?: string | null
  tip_interventie?: string | null
  scop?: string | null
  regula_repetare?: 'fara_repetare' | 'interval'
  interval_repetare_zile?: number | null
  numar_repetari_max?: number | null
  fereastra_start_offset_zile?: number | null
  fereastra_end_offset_zile?: number | null
  produs_id?: string | null
  produs_nume_manual?: string | null
  doza_ml_per_hl?: number | null
  doza_l_per_ha?: number | null
  observatii?: string | null
  produse?: InterventieProdusPayload[]
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

export interface ParcelaTratamenteSelectOption {
  id: string
  id_parcela: string | null
  nume_parcela: string | null
}

export interface AplicareProdusV2 extends AplicareTratamentProdus {
  produs: ProdusFitosanitarLookup | null
  plan_linie_produs: PlanTratamentLinieProdus | null
}

type AplicareTratamentV2Fields =
  | 'sursa'
  | 'tip_interventie'
  | 'scop'
  | 'stadiu_fenologic_id'
  | 'diferente_fata_de_plan'

type AplicareTratamentCompat =
  Omit<AplicareTratament, AplicareTratamentV2Fields> &
  Partial<Pick<AplicareTratament, AplicareTratamentV2Fields>>

export interface AplicareTratamentV2 extends AplicareTratamentCompat {
  produs: ProdusFitosanitarLookup | null
  produse_aplicare?: AplicareProdusV2[]
  linie: PlanTratamentLinieCuProdus | null
  parcela: Pick<Database['public']['Tables']['parcele']['Row'], 'id' | 'id_parcela' | 'nume_parcela' | 'suprafata_m2'> | null
}

export type AplicareTratamentDetaliu = AplicareTratamentV2

export interface AplicareCrossParcelItem {
  id: string
  tenant_id: string
  parcela_id: string
  cultura_id: string | null
  plan_linie_id: string | null
  sursa: AplicareTratament['sursa'] | null
  produs_id: string | null
  produs_nume_manual: string | null
  data_programata: string | null
  data_planificata: string | null
  data_aplicata: string | null
  status: AplicareTratament['status']
  tip_interventie: string | null
  scop: string | null
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
  produse_aplicare: AplicareProdusV2[]
  produse_planificate: InterventieProdusV2[]
  phi_warning: boolean
  urmatoarea_recoltare: string | null
}

export type InterventieStatusOperational =
  | 'de_facut_azi'
  | 'urmeaza'
  | 'intarziata'
  | 'completata_pentru_moment'
  | 'neaplicabila_fara_stadiu'

export interface FenofazaCurentaParcela {
  parcela_id: string
  an: number
  cohort: Cohorta | null
  stadiu_id: string | null
  stadiu: StadiuCod | null
  data_observata: string | null
  sursa: StadiuFenologicParcela['sursa'] | null
  observatii: string | null
}

export interface InterventieRelevantaV2 {
  parcela_id: string
  parcela_nume: string | null
  parcela_cod: string | null
  plan: Pick<PlanTratament, 'id' | 'nume' | 'cultura_tip' | 'activ' | 'arhivat'>
  interventie: InterventiePlanV2
  produse_planificate: InterventieProdusV2[]
  fenofaza_curenta: FenofazaCurentaParcela | null
  ultima_aplicare: Pick<AplicareTratamentDetaliu, 'id' | 'status' | 'data_planificata' | 'data_aplicata' | 'cohort_la_aplicare'> | null
  aplicare_planificata: Pick<AplicareTratamentDetaliu, 'id' | 'status' | 'data_planificata' | 'data_aplicata' | 'cohort_la_aplicare'> | null
  aplicari_efectuate_count: number
  regula_repetare: InterventiePlanV2['regula_repetare']
  interval_repetare_zile: number | null
  numar_repetari_max: number | null
  urmatoarea_data_estimata: string | null
  zile_ramase: number | null
  status_operational: InterventieStatusOperational
  motiv: string
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
  sursa?: 'din_plan' | 'manuala'
  tip_interventie?: string | null
  scop?: string | null
  stadiu_fenologic_id?: string | null
  diferente_fata_de_plan?: Json | null
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
  produse?: Array<InterventieProdusPayload & {
    plan_linie_produs_id?: string | null
    cantitate_totala?: number | null
    unitate_cantitate?: AplicareTratamentProdus['unitate_cantitate']
    stoc_mutatie_id?: string | null
  }>
}

export interface CreateAplicareManualaInput {
  parcela_id: string
  cultura_id?: string | null
  status?: 'planificata' | 'aplicata'
  data_planificata?: string | null
  data_aplicata?: string | null
  tip_interventie?: string | null
  scop?: string | null
  stadiu_fenologic_id?: string | null
  diferente_fata_de_plan?: Json | null
  produs_id?: string | null
  produs_nume_manual?: string | null
  doza_ml_per_hl?: number | null
  doza_l_per_ha?: number | null
  cantitate_totala_ml?: number | null
  stoc_mutatie_id?: string | null
  meteo_snapshot?: Json | null
  stadiu_la_aplicare?: string | null
  cohort_la_aplicare?: Cohorta | null
  observatii?: string | null
  operator?: string | null
  produse?: InsertAplicarePlanificata['produse']
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
  produse?: InsertAplicarePlanificata['produse']
  diferenteFataDePlan?: Json | null
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

function effectiveAplicareDate(aplicare: Pick<AplicareTratament, 'data_aplicata' | 'data_planificata'>): Date | null {
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

function relationArray<T>(value: T | Array<T | null> | null | undefined): T[] {
  if (Array.isArray(value)) return value.filter((item): item is T => Boolean(item))
  return value ? [value] : []
}

function normalizeOptionalPositiveNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

type PlanLinieProdusRelationRow = PlanTratamentLinieProdus & {
  produs: ProdusFitosanitar | ProdusFitosanitar[] | null
}

type PlanLinieWithV2ProductsRow = PlanTratamentLinie & {
  produs: ProdusFitosanitar | ProdusFitosanitar[] | null
  produse: PlanLinieProdusRelationRow | PlanLinieProdusRelationRow[] | null
}

type AplicareProdusRelationRow = AplicareTratamentProdus & {
  produs: ProdusFitosanitarLookup | ProdusFitosanitarLookup[] | null
  plan_linie_produs: PlanTratamentLinieProdus | PlanTratamentLinieProdus[] | null
}

type AplicareWithV2ProductsRow = AplicareTratament & {
  produs: ProdusFitosanitarLookup | Array<ProdusFitosanitarLookup | null> | null
  produse_aplicare: AplicareProdusRelationRow | Array<AplicareProdusRelationRow | null> | null
}

function toInterventieProdusV2(row: PlanLinieProdusRelationRow): InterventieProdusV2 {
  return {
    ...row,
    produs: firstRelation(row.produs),
  }
}

function buildLegacyInterventieProdus(
  linie: PlanTratamentLinie,
  produs: ProdusFitosanitar | null
): InterventieProdusV2 | null {
  const produsManual = normalizeText(linie.produs_nume_manual)
  if (!linie.produs_id && !produsManual) return null

  const produsNumeSnapshot = produs?.nume_comercial ?? produsManual
  if (!produsNumeSnapshot) return null

  return {
    id: `legacy:${linie.id}:1`,
    tenant_id: linie.tenant_id,
    plan_linie_id: linie.id,
    ordine: 1,
    produs_id: linie.produs_id,
    produs_nume_manual: produs ? null : produsManual,
    produs_nume_snapshot: produsNumeSnapshot,
    substanta_activa_snapshot: produs?.substanta_activa ?? null,
    tip_snapshot: produs?.tip ?? null,
    frac_irac_snapshot: produs?.frac_irac ?? null,
    phi_zile_snapshot: produs?.phi_zile ?? null,
    doza_ml_per_hl: linie.doza_ml_per_hl,
    doza_l_per_ha: linie.doza_l_per_ha,
    observatii: linie.observatii,
    created_at: linie.created_at,
    updated_at: linie.updated_at,
    produs,
  }
}

function hydrateLinieFromPrimaryProdus(
  linie: PlanTratamentLinie,
  produse: InterventieProdusV2[],
  legacyProdus: ProdusFitosanitar | null
): InterventiePlanV2 {
  const firstProdus = produse[0] ?? null

  return {
    ...linie,
    produs_id: firstProdus ? firstProdus.produs_id : linie.produs_id,
    produs_nume_manual: firstProdus
      ? firstProdus.produs_nume_manual
      : linie.produs_nume_manual,
    doza_ml_per_hl: firstProdus ? firstProdus.doza_ml_per_hl : linie.doza_ml_per_hl,
    doza_l_per_ha: firstProdus ? firstProdus.doza_l_per_ha : linie.doza_l_per_ha,
    produs: firstProdus?.produs ?? legacyProdus,
    produse,
  }
}

function normalizeInterventiePlan(row: PlanLinieWithV2ProductsRow): InterventiePlanV2 {
  const legacyProdus = firstRelation(row.produs)
  const produseV2 = relationArray(row.produse)
    .map(toInterventieProdusV2)
    .sort((first, second) => first.ordine - second.ordine)
  const produse = produseV2.length > 0
    ? produseV2
    : relationArray(buildLegacyInterventieProdus(row, legacyProdus))

  return hydrateLinieFromPrimaryProdus(row, produse, legacyProdus)
}

function toAplicareProdusV2(row: AplicareProdusRelationRow): AplicareProdusV2 {
  return {
    ...row,
    produs: firstRelation(row.produs),
    plan_linie_produs: firstRelation(row.plan_linie_produs),
  }
}

function buildLegacyAplicareProdus(
  aplicare: AplicareTratament,
  produs: ProdusFitosanitarLookup | null
): AplicareProdusV2 | null {
  const produsManual = normalizeText(aplicare.produs_nume_manual)
  if (!aplicare.produs_id && !produsManual) return null

  const produsNumeSnapshot = produs?.nume_comercial ?? produsManual
  if (!produsNumeSnapshot) return null

  return {
    id: `legacy:${aplicare.id}:1`,
    tenant_id: aplicare.tenant_id,
    aplicare_id: aplicare.id,
    plan_linie_produs_id: null,
    ordine: 1,
    produs_id: aplicare.produs_id,
    produs_nume_manual: produs ? null : produsManual,
    produs_nume_snapshot: produsNumeSnapshot,
    substanta_activa_snapshot: produs?.substanta_activa ?? null,
    tip_snapshot: produs?.tip ?? null,
    frac_irac_snapshot: produs?.frac_irac ?? null,
    phi_zile_snapshot: produs?.phi_zile ?? null,
    doza_ml_per_hl: aplicare.doza_ml_per_hl,
    doza_l_per_ha: aplicare.doza_l_per_ha,
    cantitate_totala: aplicare.cantitate_totala_ml,
    unitate_cantitate: aplicare.cantitate_totala_ml == null ? null : 'ml',
    stoc_mutatie_id: aplicare.stoc_mutatie_id,
    observatii: aplicare.observatii,
    created_at: aplicare.created_at,
    updated_at: aplicare.updated_at,
    produs,
    plan_linie_produs: null,
  }
}

function normalizeAplicareProduse(row: AplicareWithV2ProductsRow): AplicareProdusV2[] {
  const legacyProdus = firstRelation(row.produs)
  const produseV2 = relationArray(row.produse_aplicare)
    .map(toAplicareProdusV2)
    .sort((first, second) => first.ordine - second.ordine)

  if (produseV2.length > 0) return produseV2
  return relationArray(buildLegacyAplicareProdus(row, legacyProdus))
}

function hydrateAplicareFromPrimaryProdus<T extends AplicareWithV2ProductsRow>(
  row: T,
  produse: AplicareProdusV2[]
): Omit<T, 'produs' | 'produse_aplicare'> & {
  produs: ProdusFitosanitarLookup | null
  produse_aplicare: AplicareProdusV2[]
} {
  const legacyProdus = firstRelation(row.produs)
  const firstProdus = produse[0] ?? null

  return {
    ...row,
    produs_id: firstProdus ? firstProdus.produs_id : row.produs_id,
    produs_nume_manual: firstProdus
      ? firstProdus.produs_nume_manual
      : row.produs_nume_manual,
    doza_ml_per_hl: firstProdus ? firstProdus.doza_ml_per_hl : row.doza_ml_per_hl,
    doza_l_per_ha: firstProdus ? firstProdus.doza_l_per_ha : row.doza_l_per_ha,
    cantitate_totala_ml:
      typeof firstProdus?.cantitate_totala === 'number' && firstProdus.unitate_cantitate === 'ml'
        ? firstProdus.cantitate_totala
        : row.cantitate_totala_ml,
    stoc_mutatie_id: firstProdus ? firstProdus.stoc_mutatie_id : row.stoc_mutatie_id,
    produs: firstProdus?.produs ?? legacyProdus,
    produse_aplicare: produse,
  }
}

function produsePrimary(produse: AplicareProdusV2[]): ProdusFitosanitarLookup | null {
  return produseFirst(produse)?.produs ?? null
}

function produseFirst(produse: AplicareProdusV2[]): AplicareProdusV2 | null {
  return produse.length > 0 ? produse[0] : null
}

function produseLabel(produse: AplicareProdusV2[]): string {
  if (produse.length === 0) return 'Produs nespecificat'
  const first = produseFirst(produse)
  const firstName = first?.produs?.nume_comercial ?? first?.produs_nume_snapshot ?? first?.produs_nume_manual ?? 'Produs nespecificat'
  return produse.length > 1 ? `${firstName} +${produse.length - 1}` : firstName
}

function normalizeAplicareDetaliuRow(
  row: AplicareWithV2ProductsRow & {
    linie: PlanLinieWithV2ProductsRow | PlanLinieWithV2ProductsRow[] | null
    parcela: AplicareTratamentDetaliu['parcela'] | AplicareTratamentDetaliu['parcela'][]
  }
): AplicareTratamentDetaliu {
  const produse = normalizeAplicareProduse(row)
  const aplicare = hydrateAplicareFromPrimaryProdus(row, produse)
  const linie = firstRelation(row.linie)

  return {
    ...aplicare,
    sursa: row.sursa ?? (row.plan_linie_id ? 'din_plan' : 'manuala'),
    linie: linie ? normalizeInterventiePlan(linie) : null,
    parcela: firstRelation(row.parcela),
  }
}

type CrossParcelParcelaRelation = Pick<
  Database['public']['Tables']['parcele']['Row'],
  'id' | 'id_parcela' | 'nume_parcela' | 'suprafata_m2' | 'latitudine' | 'longitudine' | 'gps_lat' | 'gps_lng'
>

type CrossParcelPlanRelation = Pick<PlanTratament, 'id' | 'nume' | 'cultura_tip' | 'activ' | 'arhivat'>

type CrossParcelLinieRelation = PlanLinieWithV2ProductsRow & {
  plan: CrossParcelPlanRelation | CrossParcelPlanRelation[] | null
}

type CrossParcelAplicareRow = AplicareTratament & {
  produs:
    | AplicareTratamentDetaliu['produs']
    | AplicareTratamentDetaliu['produs'][]
    | null
  produse_aplicare: AplicareProdusRelationRow | AplicareProdusRelationRow[] | null
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
  produse_aplicare: AplicareProdusRelationRow | AplicareProdusRelationRow[] | null
  linie: CrossParcelLinieRelation | CrossParcelLinieRelation[] | null
  parcela: AplicareAgregataParcelaRelation | AplicareAgregataParcelaRelation[] | null
}

type TratamenteGlobalStatsAplicareRow = AplicareTratament & {
  produs:
    | AplicareTratamentDetaliu['produs']
    | AplicareTratamentDetaliu['produs'][]
    | null
  produse_aplicare: AplicareProdusRelationRow | AplicareProdusRelationRow[] | null
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
    const produseAplicare = normalizeAplicareProduse(row)
    const produsPrincipal = produseLabel(produseAplicare)
    const produs = produsePrimary(produseAplicare) ?? firstRelation(row.produs)
    const linie = firstRelation(row.linie)
    const produsePlanificate = linie ? normalizeInterventiePlan(linie).produse : []
    const plan = firstRelation(linie?.plan)
    const parcela = firstRelation(row.parcela)
    const urmatoareaRecoltare = nextHarvestMap.get(row.parcela_id) ?? null

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      parcela_id: row.parcela_id,
      cultura_id: row.cultura_id,
      plan_linie_id: row.plan_linie_id,
      sursa: row.sursa ?? (row.plan_linie_id ? 'din_plan' : 'manuala'),
      produs_id: row.produs_id,
      produs_nume_manual: row.produs_nume_manual,
      data_programata: row.data_planificata,
      data_planificata: row.data_planificata,
      data_aplicata: row.data_aplicata,
      status: row.status,
      tip_interventie: row.tip_interventie ?? linie?.tip_interventie ?? null,
      scop: row.scop ?? linie?.scop ?? null,
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
      produs_nume: produsPrincipal,
      produs_tip: produs?.tip ?? produseAplicare[0]?.tip_snapshot ?? null,
      produs_frac: produs?.frac_irac ?? produseAplicare[0]?.frac_irac_snapshot ?? null,
      produs_phi_zile: produs?.phi_zile ?? produseAplicare[0]?.phi_zile_snapshot ?? null,
      doza_ml_per_hl: row.doza_ml_per_hl,
      doza_l_per_ha: row.doza_l_per_ha,
      observatii: row.observatii ?? linie?.observatii ?? null,
      operator: row.operator,
      meteo_snapshot: row.meteo_snapshot,
      produse_aplicare: produseAplicare,
      produse_planificate: produsePlanificate,
      phi_warning: produseAplicare.some((item) =>
        isPhiWarning(row.data_planificata, item.produs?.phi_zile ?? item.phi_zile_snapshot, urmatoareaRecoltare)
      ),
      urmatoarea_recoltare: urmatoareaRecoltare,
    }
  })
}

function mapAplicariAgregate(rows: AplicareAgregataRow[]): AplicareAgregata[] {
  return rows.flatMap((row) => {
    const produseAplicare = normalizeAplicareProduse(row)
    const produse = produseAplicare.length > 0
      ? produseAplicare
      : relationArray(buildLegacyAplicareProdus(row, firstRelation(row.produs)))
    const linie = firstRelation(row.linie)
    const plan = firstRelation(linie?.plan)
    const parcela = firstRelation(row.parcela)
    const suprafataHa =
      typeof parcela?.suprafata_m2 === 'number' && parcela.suprafata_m2 > 0
        ? Math.round((parcela.suprafata_m2 / 10000) * 10000) / 10000
        : null

    return produse.map((produsAplicare) => {
      const produs = produsAplicare.produs
      return {
      id: row.id,
      tenant_id: row.tenant_id,
      parcela_id: row.parcela_id,
      parcela_nume: parcela?.nume_parcela ?? null,
      parcela_cod: parcela?.id_parcela ?? null,
      parcela_suprafata_m2: parcela?.suprafata_m2 ?? null,
      suprafata_ha: suprafataHa,
      produs_id: produsAplicare.produs_id,
      produs_nume: produs?.nume_comercial ?? produsAplicare.produs_nume_snapshot ?? 'Produs nespecificat',
      produs_tip: produs?.tip ?? produsAplicare.tip_snapshot ?? null,
      produs_frac: produs?.frac_irac ?? produsAplicare.frac_irac_snapshot ?? null,
      produs_phi_zile: produs?.phi_zile ?? produsAplicare.phi_zile_snapshot ?? null,
      substanta_activa: produs?.substanta_activa ?? produsAplicare.substanta_activa_snapshot ?? null,
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
      doza_ml_per_hl: produsAplicare.doza_ml_per_hl,
      doza_l_per_ha: produsAplicare.doza_l_per_ha,
      cantitate_totala_ml:
        produsAplicare.unitate_cantitate === 'ml' ? produsAplicare.cantitate_totala : row.cantitate_totala_ml,
      observatii: row.observatii ?? produsAplicare.observatii ?? linie?.observatii ?? null,
      operator: row.operator,
      }
    })
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

async function getManualLinieInsertionOrder(
  ctx: QueryContext,
  planId: string,
  stadiuTrigger: string
): Promise<number> {
  const { data, error } = await ctx.supabase
    .from('planuri_tratament_linii')
    .select('ordine,stadiu_trigger')
    .eq('plan_id', planId)
    .eq('tenant_id', ctx.tenantId)
    .order('ordine', { ascending: true })

  if (error) throw error

  const linii = data ?? []
  const ordineMaxPlan = linii.reduce((maxOrdine, linie) => Math.max(maxOrdine, linie.ordine ?? 0), 0)
  const ordineMaxStadiu = linii
    .filter((linie) => linie.stadiu_trigger === stadiuTrigger)
    .reduce((maxOrdine, linie) => Math.max(maxOrdine, linie.ordine ?? 0), 0)

  if (ordineMaxStadiu > 0) {
    return ordineMaxStadiu + 1
  }

  return ordineMaxPlan + 1
}

async function shiftPlanLiniiOrderFrom(
  ctx: QueryContext,
  planId: string,
  insertionOrder: number
): Promise<void> {
  const { data, error } = await ctx.supabase
    .from('planuri_tratament_linii')
    .select('id,ordine')
    .eq('plan_id', planId)
    .eq('tenant_id', ctx.tenantId)
    .gte('ordine', insertionOrder)
    .order('ordine', { ascending: false })

  if (error) throw error

  for (const linie of data ?? []) {
    const { error: updateError } = await ctx.supabase
      .from('planuri_tratament_linii')
      .update({ ordine: (linie.ordine ?? 0) + 1 })
      .eq('id', linie.id)
      .eq('tenant_id', ctx.tenantId)

    if (updateError) throw updateError
  }
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
  includeInactive?: boolean
}): Promise<ProdusFitosanitar[]> {
  const { supabase, tenantId } = await getQueryContext()

  let query = supabase
    .from('produse_fitosanitare')
    .select(PRODUS_SELECT)
    .or(`tenant_id.is.null,tenant_id.eq.${tenantId}`)
    .order('activ', { ascending: false })
    .order('tenant_id', { ascending: false, nullsFirst: false })
    .order('nume_comercial', { ascending: true })

  if (opts?.tip) {
    query = query.eq('tip', opts.tip)
  }

  if (typeof opts?.activ === 'boolean') {
    query = query.eq('activ', opts.activ)
  } else if (opts?.includeInactive === false) {
    query = query.eq('activ', true)
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
 * Creează sau actualizează un produs tenant-first după numele comercial normalizat.
 * Folosit de quick-create în editori/import pentru a evita duplicatele evidente.
 */
export async function saveProdusFitosanitarInLibrary(
  data: InsertTenantProdus
): Promise<ProdusFitosanitar> {
  return upsertProdusTenantCustom(data)
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
    .select(LINIE_WITH_PRODUCTS_SELECT)
    .eq('plan_id', planId)
    .eq('tenant_id', tenantId)
    .order('ordine', { ascending: true })

  if (liniiError) throw liniiError

  return {
    ...plan,
    interventii: ((linii ?? []) as PlanLinieWithV2ProductsRow[]).map(normalizeInterventiePlan),
    linii: ((linii ?? []) as PlanLinieWithV2ProductsRow[]).map(normalizeInterventiePlan),
  }
}

function normalizeInterventieProdusPayloads(
  linie: PlanTratamentLiniePayload | CreatePlanTratamentLinieInput
): InterventieProdusPayload[] {
  const produse = Array.isArray(linie.produse) && linie.produse.length > 0
    ? linie.produse
    : [{
        ordine: 1,
        produs_id: linie.produs_id ?? null,
        produs_nume_manual: linie.produs_nume_manual ?? null,
        doza_ml_per_hl: linie.doza_ml_per_hl ?? null,
        doza_l_per_ha: linie.doza_l_per_ha ?? null,
        observatii: linie.observatii ?? null,
      }]

  return produse
    .map((produs, index) => ({
      ordine: produs.ordine ?? index + 1,
      produs_id: produs.produs_id ?? null,
      produs_nume_manual: normalizeText(produs.produs_nume_manual),
      produs_nume_snapshot: normalizeText(produs.produs_nume_snapshot),
      substanta_activa_snapshot: normalizeText(produs.substanta_activa_snapshot),
      tip_snapshot: produs.tip_snapshot ?? null,
      frac_irac_snapshot: normalizeText(produs.frac_irac_snapshot),
      phi_zile_snapshot: produs.phi_zile_snapshot ?? null,
      doza_ml_per_hl: produs.doza_ml_per_hl ?? null,
      doza_l_per_ha: produs.doza_l_per_ha ?? null,
      observatii: normalizeText(produs.observatii),
    }))
    .filter((produs) => Boolean(produs.produs_id || produs.produs_nume_manual || produs.produs_nume_snapshot))
}

function firstProdusPayload(produse: InterventieProdusPayload[]): InterventieProdusPayload | null {
  return [...produse].sort((first, second) => (first.ordine ?? 0) - (second.ordine ?? 0))[0] ?? null
}

type AplicareProdusInput = NonNullable<InsertAplicarePlanificata['produse']>[number]

async function getProduseById(ctx: QueryContext, produsIds: string[]): Promise<Map<string, ProdusFitosanitarLookup>> {
  const uniqueIds = [...new Set(produsIds.filter(Boolean))]
  if (uniqueIds.length === 0) return new Map()

  const { data, error } = await ctx.supabase
    .from('produse_fitosanitare')
    .select(PRODUS_LOOKUP_SELECT)
    .in('id', uniqueIds)

  if (error) throw error

  return new Map((data ?? []).map((produs) => [produs.id, produs]))
}

async function loadPlanLinieProduseForAplicare(
  ctx: QueryContext,
  planLinieId: string
): Promise<AplicareProdusInput[]> {
  const { data, error } = await ctx.supabase
    .from('planuri_tratament_linie_produse')
    .select(PLAN_LINIE_PRODUS_SELECT)
    .eq('tenant_id', ctx.tenantId)
    .eq('plan_linie_id', planLinieId)
    .order('ordine', { ascending: true })

  if (error) throw error

  return (data ?? []).map((produs) => ({
    plan_linie_produs_id: produs.id,
    ordine: produs.ordine,
    produs_id: produs.produs_id,
    produs_nume_manual: produs.produs_nume_manual,
    produs_nume_snapshot: produs.produs_nume_snapshot,
    substanta_activa_snapshot: produs.substanta_activa_snapshot,
    tip_snapshot: produs.tip_snapshot as ProdusFitosanitar['tip'] | null,
    frac_irac_snapshot: produs.frac_irac_snapshot,
    phi_zile_snapshot: produs.phi_zile_snapshot,
    doza_ml_per_hl: produs.doza_ml_per_hl,
    doza_l_per_ha: produs.doza_l_per_ha,
    observatii: produs.observatii,
  }))
}

async function normalizeAplicareProdusInputs(
  ctx: QueryContext,
  data: InsertAplicarePlanificata
): Promise<AplicareProdusInput[]> {
  if (Array.isArray(data.produse) && data.produse.length > 0) {
    return data.produse
  }

  if (data.plan_linie_id) {
    const produsePlan = await loadPlanLinieProduseForAplicare(ctx, data.plan_linie_id)
    if (produsePlan.length > 0) return produsePlan
  }

  if (data.produs_id || normalizeText(data.produs_nume_manual)) {
    return [{
      ordine: 1,
      produs_id: data.produs_id ?? null,
      produs_nume_manual: normalizeText(data.produs_nume_manual),
      doza_ml_per_hl: data.doza_ml_per_hl ?? null,
      doza_l_per_ha: data.doza_l_per_ha ?? null,
      cantitate_totala: data.cantitate_totala_ml ?? null,
      unitate_cantitate: data.cantitate_totala_ml == null ? null : 'ml',
      stoc_mutatie_id: data.stoc_mutatie_id ?? null,
      observatii: data.observatii ?? null,
    }]
  }

  return []
}

async function buildAplicareProdusInserts(
  ctx: QueryContext,
  aplicareId: string,
  produse: AplicareProdusInput[]
): Promise<AplicareTratamentProdusInsert[]> {
  const produseById = await getProduseById(
    ctx,
    produse.map((produs) => produs.produs_id).filter((produsId): produsId is string => Boolean(produsId))
  )

  return produse
    .map<AplicareTratamentProdusInsert | null>((produs, index) => {
      const produsCatalog = produs.produs_id ? produseById.get(produs.produs_id) ?? null : null
      const produsNumeManual = normalizeText(produs.produs_nume_manual)
      const produsNumeSnapshot =
        produsCatalog?.nume_comercial ??
        normalizeText(produs.produs_nume_snapshot) ??
        produsNumeManual

      if (!produsNumeSnapshot) return null

      const row: AplicareTratamentProdusInsert = {
        tenant_id: ctx.tenantId,
        aplicare_id: aplicareId,
        plan_linie_produs_id: produs.plan_linie_produs_id ?? null,
        ordine: produs.ordine ?? index + 1,
        produs_id: produs.produs_id ?? null,
        produs_nume_manual: produs.produs_id ? null : produsNumeManual,
        produs_nume_snapshot: produsNumeSnapshot,
        substanta_activa_snapshot:
          produsCatalog?.substanta_activa ?? normalizeText(produs.substanta_activa_snapshot),
        tip_snapshot: produsCatalog?.tip ?? produs.tip_snapshot ?? null,
        frac_irac_snapshot: produsCatalog?.frac_irac ?? normalizeText(produs.frac_irac_snapshot),
        phi_zile_snapshot: produsCatalog?.phi_zile ?? produs.phi_zile_snapshot ?? null,
        doza_ml_per_hl: normalizeOptionalPositiveNumber(produs.doza_ml_per_hl),
        doza_l_per_ha: normalizeOptionalPositiveNumber(produs.doza_l_per_ha),
        cantitate_totala: normalizeOptionalPositiveNumber(produs.cantitate_totala),
        unitate_cantitate: produs.unitate_cantitate ?? null,
        stoc_mutatie_id: produs.stoc_mutatie_id ?? null,
        observatii: normalizeText(produs.observatii),
      }

      return row
    })
    .filter((produs): produs is AplicareTratamentProdusInsert => Boolean(produs))
}

async function replaceAplicareProduse(
  ctx: QueryContext,
  aplicareId: string,
  produse: AplicareProdusInput[]
): Promise<void> {
  const inserts = await buildAplicareProdusInserts(ctx, aplicareId, produse)

  const { error: deleteError } = await ctx.supabase
    .from('aplicari_tratament_produse')
    .delete()
    .eq('tenant_id', ctx.tenantId)
    .eq('aplicare_id', aplicareId)

  if (deleteError) throw deleteError
  if (inserts.length === 0) return

  const { error } = await ctx.supabase
    .from('aplicari_tratament_produse')
    .insert(inserts)

  if (error) throw error
}

async function buildPlanLinieProdusInserts(
  ctx: QueryContext,
  linieId: string,
  produse: InterventieProdusPayload[]
): Promise<PlanTratamentLinieProdusInsert[]> {
  const produseById = await getProduseById(
    ctx,
    produse.map((produs) => produs.produs_id).filter((produsId): produsId is string => Boolean(produsId))
  )

  return produse
    .map<PlanTratamentLinieProdusInsert | null>((produs, index) => {
      const produsCatalog = produs.produs_id ? produseById.get(produs.produs_id) ?? null : null
      const produsNumeManual = normalizeText(produs.produs_nume_manual)
      const produsNumeSnapshot =
        produsCatalog?.nume_comercial ??
        normalizeText(produs.produs_nume_snapshot) ??
        produsNumeManual

      if (!produsNumeSnapshot) return null

      const row: PlanTratamentLinieProdusInsert = {
        tenant_id: ctx.tenantId,
        plan_linie_id: linieId,
        ordine: produs.ordine ?? index + 1,
        produs_id: produs.produs_id ?? null,
        produs_nume_manual: produs.produs_id ? null : produsNumeManual,
        produs_nume_snapshot: produsNumeSnapshot,
        substanta_activa_snapshot:
          produsCatalog?.substanta_activa ?? normalizeText(produs.substanta_activa_snapshot),
        tip_snapshot: produsCatalog?.tip ?? produs.tip_snapshot ?? null,
        frac_irac_snapshot: produsCatalog?.frac_irac ?? normalizeText(produs.frac_irac_snapshot),
        phi_zile_snapshot: produsCatalog?.phi_zile ?? produs.phi_zile_snapshot ?? null,
        doza_ml_per_hl: normalizeOptionalPositiveNumber(produs.doza_ml_per_hl),
        doza_l_per_ha: normalizeOptionalPositiveNumber(produs.doza_l_per_ha),
        observatii: normalizeText(produs.observatii),
      }

      return row
    })
    .filter((produs): produs is PlanTratamentLinieProdusInsert => Boolean(produs))
}

async function replacePlanLinieProduse(
  ctx: QueryContext,
  linieId: string,
  produse: InterventieProdusPayload[]
): Promise<void> {
  const inserts = await buildPlanLinieProdusInserts(ctx, linieId, produse)

  const { error: deleteError } = await ctx.supabase
    .from('planuri_tratament_linie_produse')
    .delete()
    .eq('tenant_id', ctx.tenantId)
    .eq('plan_linie_id', linieId)

  if (deleteError) throw deleteError
  if (inserts.length === 0) return

  const { error } = await ctx.supabase
    .from('planuri_tratament_linie_produse')
    .insert(inserts)

  if (error) throw error
}

/**
 * Listează planurile cu număr de linii, produse distincte, aplicări efectuate și parcelele active asociate.
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
      .select('id,plan_id,tip_interventie')
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

  const liniiRows = liniiResult.data ?? []
  const liniiCountByPlan = new Map<string, number>()
  const tipuriInterventieByPlan = new Map<string, Set<string>>()
  const lineIdToPlanId = new Map<string, string>()

  for (const linie of liniiRows) {
    liniiCountByPlan.set(linie.plan_id, (liniiCountByPlan.get(linie.plan_id) ?? 0) + 1)
    lineIdToPlanId.set(linie.id, linie.plan_id)

    const tipInterventie = normalizeText(linie.tip_interventie)
    if (tipInterventie) {
      const current = tipuriInterventieByPlan.get(linie.plan_id) ?? new Set<string>()
      current.add(tipInterventie)
      tipuriInterventieByPlan.set(linie.plan_id, current)
    }
  }

  const lineIds = liniiRows.map((linie) => linie.id)
  const nrProduseByPlan = new Map<string, number>()
  const nrAplicateByPlan = new Map<string, number>()

  if (lineIds.length > 0) {
    const [produseResult, aplicariResult] = await Promise.all([
      supabase
        .from('planuri_tratament_linie_produse')
        .select('plan_linie_id,produs_id')
        .eq('tenant_id', tenantId)
        .in('plan_linie_id', lineIds),
      supabase
        .from('aplicari_tratament')
        .select('plan_linie_id')
        .eq('tenant_id', tenantId)
        .eq('status', 'aplicata')
        .in('plan_linie_id', lineIds),
    ])

    if (produseResult.error) throw produseResult.error
    if (aplicariResult.error) throw aplicariResult.error

    const produseDistincteByPlan = new Map<string, Set<string>>()
    for (const produs of produseResult.data ?? []) {
      if (!produs.produs_id) continue
      const planId = lineIdToPlanId.get(produs.plan_linie_id)
      if (!planId) continue

      const current = produseDistincteByPlan.get(planId) ?? new Set<string>()
      current.add(produs.produs_id)
      produseDistincteByPlan.set(planId, current)
    }

    for (const [planId, produseDistincte] of produseDistincteByPlan.entries()) {
      nrProduseByPlan.set(planId, produseDistincte.size)
    }

    for (const aplicare of aplicariResult.data ?? []) {
      const planId = lineIdToPlanId.get(aplicare.plan_linie_id)
      if (!planId) continue
      nrAplicateByPlan.set(planId, (nrAplicateByPlan.get(planId) ?? 0) + 1)
    }
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
    nr_produse: nrProduseByPlan.get(plan.id) ?? 0,
    tipuri_interventie: [...(tipuriInterventieByPlan.get(plan.id) ?? new Set<string>())].sort((a, b) =>
      a.localeCompare(b, 'ro')
    ),
    nr_aplicate: nrAplicateByPlan.get(plan.id) ?? 0,
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
    interventii: planCuLinii.interventii,
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

  const rpcLinii = liniiData.map((linie, index) => {
    const produse = normalizeInterventieProdusPayloads(linie)
    const firstProdus = firstProdusPayload(produse)

    return {
      id: linie.id ?? null,
      ordine: linie.ordine ?? index + 1,
      stadiu_trigger: requireStadiuCod(linie.stadiu_trigger, 'stadiu_trigger'),
      cohort_trigger: normalizeOptionalCohorta(linie.cohort_trigger),
      tip_interventie: normalizeText(linie.tip_interventie),
      scop: normalizeText(linie.scop),
      regula_repetare: linie.regula_repetare ?? 'fara_repetare',
      interval_repetare_zile: linie.interval_repetare_zile ?? null,
      numar_repetari_max: linie.numar_repetari_max ?? null,
      fereastra_start_offset_zile: linie.fereastra_start_offset_zile ?? null,
      fereastra_end_offset_zile: linie.fereastra_end_offset_zile ?? null,
      produse,
      produs_id: firstProdus?.produs_id ?? null,
      produs_nume_manual: normalizeText(firstProdus?.produs_nume_manual),
      doza_ml_per_hl: firstProdus?.doza_ml_per_hl ?? null,
      doza_l_per_ha: firstProdus?.doza_l_per_ha ?? null,
      observatii: normalizeText(linie.observatii),
    }
  })

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
    const normalizedLinii = linii.map((linie, index) => {
      const produse = normalizeInterventieProdusPayloads(linie)
      const firstProdus = firstProdusPayload(produse)

      return {
        linie,
        produse,
        payload: {
          tenant_id: ctx.tenantId,
          plan_id: plan.id,
          ordine: linie.ordine ?? index + 1,
          stadiu_trigger: requireStadiuCod(linie.stadiu_trigger, 'stadiu_trigger'),
          cohort_trigger: normalizeOptionalCohorta(linie.cohort_trigger),
          tip_interventie: normalizeText(linie.tip_interventie),
          scop: normalizeText(linie.scop),
          regula_repetare: linie.regula_repetare ?? 'fara_repetare',
          interval_repetare_zile: linie.interval_repetare_zile ?? null,
          numar_repetari_max: linie.numar_repetari_max ?? null,
          fereastra_start_offset_zile: linie.fereastra_start_offset_zile ?? null,
          fereastra_end_offset_zile: linie.fereastra_end_offset_zile ?? null,
          produs_id: firstProdus?.produs_id ?? null,
          produs_nume_manual: firstProdus?.produs_id ? null : normalizeText(firstProdus?.produs_nume_manual),
          doza_ml_per_hl: firstProdus?.doza_ml_per_hl ?? null,
          doza_l_per_ha: firstProdus?.doza_l_per_ha ?? null,
          observatii: normalizeText(linie.observatii),
        } satisfies PlanTratamentLinieInsert,
      }
    })

    const { error: liniiError } = await ctx.supabase
      .from('planuri_tratament_linii')
      .insert(normalizedLinii.map((linie) => linie.payload))

    if (liniiError) {
      await ctx.supabase
        .from('planuri_tratament')
        .delete()
        .eq('id', plan.id)
        .eq('tenant_id', ctx.tenantId)

      throw new Error(`Eroare la inserarea liniilor planului: ${liniiError.message}`)
    }

    const { data: insertedLinii, error: reloadLiniiError } = await ctx.supabase
      .from('planuri_tratament_linii')
      .select('id,ordine')
      .eq('tenant_id', ctx.tenantId)
      .eq('plan_id', plan.id)
      .order('ordine', { ascending: true })

    if (reloadLiniiError) throw reloadLiniiError

    await Promise.all((insertedLinii ?? []).map((linie, index) =>
      replacePlanLinieProduse(ctx, linie.id, normalizedLinii[index]?.produse ?? [])
    ))
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

  const stadiuTrigger = requireStadiuCod(linie.stadiu_trigger, 'stadiu_trigger')
  const sursaLinie = linie.sursa_linie === 'adaugata_manual' ? 'adaugata_manual' : 'din_plan'
  const ordine = sursaLinie === 'adaugata_manual'
    ? await getManualLinieInsertionOrder(ctx, planId, stadiuTrigger)
    : await getNextLinieOrdine(ctx, planId)

  if (sursaLinie === 'adaugata_manual') {
    await shiftPlanLiniiOrderFrom(ctx, planId, ordine)
  }

  const produse = normalizeInterventieProdusPayloads({ ...linie, ordine })
  const firstProdus = firstProdusPayload(produse)
  const payload: PlanTratamentLinieInsert = {
    tenant_id: ctx.tenantId,
    plan_id: planId,
    ordine,
    stadiu_trigger: stadiuTrigger,
    cohort_trigger: normalizeOptionalCohorta(linie.cohort_trigger),
    sursa_linie: sursaLinie,
    motiv_adaugare: sursaLinie === 'adaugata_manual' ? normalizeText(linie.motiv_adaugare) : null,
    tip_interventie: normalizeText(linie.tip_interventie),
    scop: normalizeText(linie.scop),
    regula_repetare: linie.regula_repetare ?? 'fara_repetare',
    interval_repetare_zile: linie.interval_repetare_zile ?? null,
    numar_repetari_max: linie.numar_repetari_max ?? null,
    fereastra_start_offset_zile: linie.fereastra_start_offset_zile ?? null,
    fereastra_end_offset_zile: linie.fereastra_end_offset_zile ?? null,
    produs_id: firstProdus?.produs_id ?? null,
    produs_nume_manual: firstProdus?.produs_id ? null : normalizeText(firstProdus?.produs_nume_manual),
    doza_ml_per_hl: firstProdus?.doza_ml_per_hl ?? null,
    doza_l_per_ha: firstProdus?.doza_l_per_ha ?? null,
    observatii: normalizeText(linie.observatii),
  }

  const { data, error } = await ctx.supabase
    .from('planuri_tratament_linii')
    .insert(payload)
    .select(LINIE_SELECT)
    .single()

  if (error) throw error
  await replacePlanLinieProduse(ctx, data.id, produse)
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
  let produsePentruUpdate: InterventieProdusPayload[] | null = null
  if (data.ordine !== undefined) payload.ordine = data.ordine
  if (data.stadiu_trigger !== undefined) payload.stadiu_trigger = requireStadiuCod(data.stadiu_trigger, 'stadiu_trigger')
  if (data.cohort_trigger !== undefined) payload.cohort_trigger = normalizeOptionalCohorta(data.cohort_trigger)
  if (data.tip_interventie !== undefined) payload.tip_interventie = normalizeText(data.tip_interventie)
  if (data.scop !== undefined) payload.scop = normalizeText(data.scop)
  if (data.regula_repetare !== undefined) payload.regula_repetare = data.regula_repetare
  if (data.interval_repetare_zile !== undefined) payload.interval_repetare_zile = data.interval_repetare_zile
  if (data.numar_repetari_max !== undefined) payload.numar_repetari_max = data.numar_repetari_max
  if (data.fereastra_start_offset_zile !== undefined) payload.fereastra_start_offset_zile = data.fereastra_start_offset_zile
  if (data.fereastra_end_offset_zile !== undefined) payload.fereastra_end_offset_zile = data.fereastra_end_offset_zile
  if (
    data.produse !== undefined ||
    data.produs_id !== undefined ||
    data.produs_nume_manual !== undefined ||
    data.doza_ml_per_hl !== undefined ||
    data.doza_l_per_ha !== undefined
  ) {
    const produse = normalizeInterventieProdusPayloads({
      ordine: data.ordine ?? 1,
      stadiu_trigger: data.stadiu_trigger ?? 'repaus',
      produs_id: data.produs_id ?? null,
      produs_nume_manual: data.produs_nume_manual ?? null,
      doza_ml_per_hl: data.doza_ml_per_hl ?? null,
      doza_l_per_ha: data.doza_l_per_ha ?? null,
      observatii: data.observatii ?? null,
      produse: data.produse,
    })
    const firstProdus = firstProdusPayload(produse)
    produsePentruUpdate = produse
    payload.produs_id = firstProdus?.produs_id ?? null
    payload.produs_nume_manual = firstProdus?.produs_id ? null : normalizeText(firstProdus?.produs_nume_manual)
    payload.doza_ml_per_hl = firstProdus?.doza_ml_per_hl ?? null
    payload.doza_l_per_ha = firstProdus?.doza_l_per_ha ?? null
  }
  if (data.observatii !== undefined) payload.observatii = normalizeText(data.observatii)

  const { data: updated, error } = await ctx.supabase
    .from('planuri_tratament_linii')
    .update(payload)
    .eq('id', linieId)
    .eq('tenant_id', ctx.tenantId)
    .select(LINIE_SELECT)
    .single()

  if (error) throw error
  if (produsePentruUpdate) {
    await replacePlanLinieProduse(ctx, linieId, produsePentruUpdate)
  }
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
      tip_interventie: linie.tip_interventie,
      scop: linie.scop,
      regula_repetare: linie.regula_repetare === 'interval' ? 'interval' : 'fara_repetare',
      interval_repetare_zile: linie.interval_repetare_zile,
      numar_repetari_max: linie.numar_repetari_max,
      fereastra_start_offset_zile: linie.fereastra_start_offset_zile,
      fereastra_end_offset_zile: linie.fereastra_end_offset_zile,
      produs_id: linie.produs_id,
      produs_nume_manual: linie.produs_nume_manual,
      doza_ml_per_hl: linie.doza_ml_per_hl,
      doza_l_per_ha: linie.doza_l_per_ha,
      observatii: linie.observatii,
      produse: linie.produse.map((produs) => ({
        ordine: produs.ordine,
        produs_id: produs.produs_id,
        produs_nume_manual: produs.produs_nume_manual,
        produs_nume_snapshot: produs.produs_nume_snapshot,
        substanta_activa_snapshot: produs.substanta_activa_snapshot,
        tip_snapshot: produs.tip_snapshot as ProdusFitosanitar['tip'] | null,
        frac_irac_snapshot: produs.frac_irac_snapshot,
        phi_zile_snapshot: produs.phi_zile_snapshot,
        doza_ml_per_hl: produs.doza_ml_per_hl,
        doza_l_per_ha: produs.doza_l_per_ha,
        observatii: produs.observatii,
      })),
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
 * Returnează parcelele disponibile pentru selectorul de intervenție manuală.
 * Exemplu: `listParceleTratamenteSelector()`
 */
export async function listParceleTratamenteSelector(): Promise<ParcelaTratamenteSelectOption[]> {
  const { supabase, tenantId } = await getQueryContext()

  const { data, error } = await supabase
    .from('parcele')
    .select('id,id_parcela,nume_parcela')
    .eq('tenant_id', tenantId)
    .order('nume_parcela', { ascending: true })
    .order('id_parcela', { ascending: true })

  if (error) throw error
  return (data ?? []) as ParcelaTratamenteSelectOption[]
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

function parseDateOnlyUtc(value: string | null | undefined): Date | null {
  if (!value) return null
  const dateOnly = value.slice(0, 10)
  const parsed = new Date(`${dateOnly}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function addDaysIsoDate(value: string, days: number): string | null {
  const date = parseDateOnlyUtc(value)
  if (!date) return null
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function diffDaysIsoDate(from: string, to: string): number | null {
  const fromDate = parseDateOnlyUtc(from)
  const toDate = parseDateOnlyUtc(to)
  if (!fromDate || !toDate) return null
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000)
}

function latestStadiuByDate(stadii: StadiuFenologicParcela[]): StadiuFenologicParcela | null {
  if (stadii.length === 0) return null

  return [...stadii].sort((first, second) => {
    const observedDiff = new Date(second.data_observata).getTime() - new Date(first.data_observata).getTime()
    if (observedDiff !== 0) return observedDiff
    return new Date(second.created_at).getTime() - new Date(first.created_at).getTime()
  })[0] ?? null
}

function toFenofazaCurenta(
  stadiu: StadiuFenologicParcela | null,
  parcelaId: string,
  an: number,
  cohort: Cohorta | null
): FenofazaCurentaParcela {
  const stadiuCod = stadiu ? normalizeStadiu(stadiu.stadiu) : null

  return {
    parcela_id: parcelaId,
    an,
    cohort,
    stadiu_id: stadiu?.id ?? null,
    stadiu: stadiuCod,
    data_observata: stadiu?.data_observata ?? null,
    sursa: stadiu?.sursa ?? null,
    observatii: stadiu?.observatii ?? null,
  }
}

function buildFenofazeCurente(
  stadii: StadiuFenologicParcela[],
  parcelaId: string,
  an: number
): FenofazaCurentaParcela[] {
  const fenofaze: FenofazaCurentaParcela[] = []
  const single = latestStadiuByDate(stadii.filter((stadiu) => stadiu.cohort == null))
  if (single) {
    fenofaze.push(toFenofazaCurenta(single, parcelaId, an, null))
  }

  for (const cohort of ['floricane', 'primocane'] satisfies Cohorta[]) {
    const current = latestStadiuByDate(stadii.filter((stadiu) => stadiu.cohort === cohort))
    if (current) {
      fenofaze.push(toFenofazaCurenta(current, parcelaId, an, cohort))
    }
  }

  if (fenofaze.length === 0) {
    fenofaze.push(toFenofazaCurenta(null, parcelaId, an, null))
  }

  return fenofaze
}

function matchesInterventieFenofaza(
  interventie: InterventiePlanV2,
  fenofaza: FenofazaCurentaParcela
): boolean {
  const trigger = normalizeStadiu(interventie.stadiu_trigger)
  if (!trigger || !fenofaza.stadiu || trigger !== fenofaza.stadiu) return false

  const cohortTrigger = normalizeOptionalCohorta(interventie.cohort_trigger)
  if (cohortTrigger && cohortTrigger !== fenofaza.cohort) return false
  return true
}

function aplicareRelevantDate(aplicare: AplicareTratamentDetaliu): string | null {
  return (aplicare.data_aplicata ?? aplicare.data_planificata)?.slice(0, 10) ?? null
}

function sortAplicariRelevantDesc(aplicari: AplicareTratamentDetaliu[]): AplicareTratamentDetaliu[] {
  return [...aplicari].sort((first, second) => {
    const firstDate = aplicareRelevantDate(first) ?? ''
    const secondDate = aplicareRelevantDate(second) ?? ''
    if (firstDate !== secondDate) return secondDate.localeCompare(firstDate)
    return second.created_at.localeCompare(first.created_at)
  })
}

function sameCohortScope(aplicare: AplicareTratamentDetaliu, fenofaza: FenofazaCurentaParcela): boolean {
  const aplicareCohort = normalizeOptionalCohorta(aplicare.cohort_la_aplicare)
  if (!fenofaza.cohort) return !aplicareCohort
  return aplicareCohort === fenofaza.cohort
}

function getInterventieProdusLabel(interventie: InterventiePlanV2): string {
  const first = interventie.produse[0]
  const name = first?.produs?.nume_comercial ?? first?.produs_nume_snapshot ?? first?.produs_nume_manual
  if (!name) return 'Intervenție fără produs'
  return interventie.produse.length > 1 ? `${name} +${interventie.produse.length - 1}` : name
}

function buildInterventieOperationalState(params: {
  interventie: InterventiePlanV2
  fenofaza: FenofazaCurentaParcela
  aplicari: AplicareTratamentDetaliu[]
  todayIso: string
}): Pick<
  InterventieRelevantaV2,
  | 'ultima_aplicare'
  | 'aplicare_planificata'
  | 'aplicari_efectuate_count'
  | 'urmatoarea_data_estimata'
  | 'zile_ramase'
  | 'status_operational'
  | 'motiv'
> {
  const scopedAplicari = params.aplicari.filter((aplicare) => sameCohortScope(aplicare, params.fenofaza))
  const aplicariAplicate = sortAplicariRelevantDesc(scopedAplicari.filter((aplicare) => aplicare.status === 'aplicata'))
  const aplicariPlanificate = sortAplicariRelevantDesc(
    scopedAplicari.filter((aplicare) => aplicare.status === 'planificata' || aplicare.status === 'reprogramata')
  )
  const ultimaAplicare = aplicariAplicate[0] ?? null
  const aplicarePlanificata = aplicariPlanificate[0] ?? null
  const aplicariEfectuateCount = aplicariAplicate.length

  if (!params.fenofaza.stadiu) {
    return {
      ultima_aplicare: null,
      aplicare_planificata: null,
      aplicari_efectuate_count: 0,
      urmatoarea_data_estimata: null,
      zile_ramase: null,
      status_operational: 'neaplicabila_fara_stadiu',
      motiv: 'Lipsește fenofaza curentă pentru parcelă.',
    }
  }

  const plannedDate = aplicarePlanificata ? aplicareRelevantDate(aplicarePlanificata) : null
  const lastAppliedDate = ultimaAplicare ? aplicareRelevantDate(ultimaAplicare) : null
  const recurrence = resolveRecurrence({
    todayIso: params.todayIso,
    plannedDate,
    lastAppliedDate,
    appliedCount: aplicariEfectuateCount,
    regulaRepetare: params.interventie.regula_repetare === 'interval' ? 'interval' : 'fara_repetare',
    intervalRepetareZile: params.interventie.interval_repetare_zile,
    numarRepetariMax: params.interventie.numar_repetari_max,
    productIntervalMinDays: params.interventie.produse.map((produs) => produs.produs?.interval_min_aplicari_zile),
  })
  const dueDate = recurrence.dueDate

  if (!dueDate) {
    return {
      ultima_aplicare: ultimaAplicare,
      aplicare_planificata: aplicarePlanificata,
      aplicari_efectuate_count: aplicariEfectuateCount,
      urmatoarea_data_estimata: null,
      zile_ramase: null,
      status_operational: 'completata_pentru_moment',
      motiv: recurrence.reason,
    }
  }

  const zileRamase = recurrence.zileRamase
  const statusOperational: InterventieStatusOperational =
    typeof zileRamase === 'number' && zileRamase < 0
      ? 'intarziata'
      : typeof zileRamase === 'number' && zileRamase > 0
        ? 'urmeaza'
        : 'de_facut_azi'

  return {
    ultima_aplicare: ultimaAplicare,
    aplicare_planificata: aplicarePlanificata,
    aplicari_efectuate_count: aplicariEfectuateCount,
    urmatoarea_data_estimata: dueDate,
    zile_ramase: zileRamase,
    status_operational: statusOperational,
    motiv: recurrence.reason,
  }
}

function toAplicareSummary(
  aplicare: AplicareTratamentDetaliu | null
): InterventieRelevantaV2['ultima_aplicare'] {
  if (!aplicare) return null
  return {
    id: aplicare.id,
    status: aplicare.status,
    data_planificata: aplicare.data_planificata,
    data_aplicata: aplicare.data_aplicata,
    cohort_la_aplicare: aplicare.cohort_la_aplicare,
  }
}

/**
 * Calculează intervențiile din plan care sunt relevante operațional pentru fenofaza curentă a parcelei.
 * Doar aplicările `din_plan` legate prin `plan_linie_id` influențează acoperirea și repetarea.
 */
export async function listInterventiiRelevanteParcela(
  parcelaId: string,
  an: number
): Promise<InterventieRelevantaV2[]> {
  const [parcela, planActiv, stadii, aplicari] = await Promise.all([
    getParcelaTratamenteContext(parcelaId),
    getPlanActivPentruParcela(parcelaId, an),
    listStadiiPentruParcela(parcelaId, an),
    listAplicariParcela(parcelaId, {
      from: new Date(Date.UTC(an, 0, 1)),
      to: new Date(Date.UTC(an, 11, 31, 23, 59, 59, 999)),
    }),
  ])

  if (!planActiv?.plan?.id || !planActiv.plan.activ || planActiv.plan.arhivat) {
    return []
  }

  const planComplet = await getPlanTratamentCuLinii(planActiv.plan.id)
  if (!planComplet) return []

  const fenofaze = buildFenofazeCurente(stadii, parcelaId, an)
  const todayIso = toIsoDate(new Date())
  const aplicariDinPlan = aplicari.filter((aplicare) => aplicare.sursa !== 'manuala' && aplicare.plan_linie_id)

  return planComplet.interventii
    .flatMap((interventie) => {
      const matchingFenofaze = fenofaze.filter((fenofaza) => matchesInterventieFenofaza(interventie, fenofaza))
      if (matchingFenofaze.length === 0) return []

      return matchingFenofaze.map((fenofaza) => {
        const aplicariInterventie = aplicariDinPlan.filter((aplicare) => aplicare.plan_linie_id === interventie.id)
        const state = buildInterventieOperationalState({
          interventie,
          fenofaza,
          aplicari: aplicariInterventie,
          todayIso,
        })

        return {
          parcela_id: parcelaId,
          parcela_nume: parcela?.nume_parcela ?? null,
          parcela_cod: parcela?.id_parcela ?? null,
          plan: {
            id: planComplet.id,
            nume: planComplet.nume,
            cultura_tip: planComplet.cultura_tip,
            activ: planComplet.activ,
            arhivat: planComplet.arhivat,
          },
          interventie,
          produse_planificate: interventie.produse,
          fenofaza_curenta: fenofaza,
          ultima_aplicare: state.ultima_aplicare,
          aplicare_planificata: state.aplicare_planificata,
          aplicari_efectuate_count: state.aplicari_efectuate_count,
          regula_repetare: interventie.regula_repetare,
          interval_repetare_zile: normalizeOptionalPositiveNumber(interventie.interval_repetare_zile),
          numar_repetari_max: normalizeOptionalPositiveNumber(interventie.numar_repetari_max),
          urmatoarea_data_estimata: state.urmatoarea_data_estimata,
          zile_ramase: state.zile_ramase,
          status_operational: state.status_operational,
          motiv: state.motiv,
        } satisfies InterventieRelevantaV2
      })
    })
    .sort((first, second) => {
      const statusOrder: Record<InterventieStatusOperational, number> = {
        intarziata: 0,
        de_facut_azi: 1,
        urmeaza: 2,
        completata_pentru_moment: 3,
        neaplicabila_fara_stadiu: 4,
      }
      const statusDiff = statusOrder[first.status_operational] - statusOrder[second.status_operational]
      if (statusDiff !== 0) return statusDiff
      const dateA = first.urmatoarea_data_estimata ?? '9999-12-31'
      const dateB = second.urmatoarea_data_estimata ?? '9999-12-31'
      if (dateA !== dateB) return dateA.localeCompare(dateB)
      return first.interventie.ordine - second.interventie.ordine
    })
}

export async function listInterventiiRelevanteHub(an: number): Promise<InterventieRelevantaV2[]> {
  const parcele = await listParceleTratamenteSelector()
  const results = await Promise.all(
    parcele.map((parcela) =>
      listInterventiiRelevanteParcela(parcela.id, an).catch((error) => {
        console.warn(
          '[tratamente] relevanță operațională indisponibilă pentru parcelă',
          sanitizeForLog({
            parcelaId: parcela.id,
            error: toSafeErrorContext(error),
          }),
        )
        return []
      })
    )
  )

  return results.flat()
}

export interface CreateAplicareDinInterventieInput {
  parcela_id: string
  plan_linie_id: string
  data_planificata?: string | null
  cohort_la_aplicare?: Cohorta | null
}

/**
 * Creează aplicarea planificată pentru o intervenție relevantă sau returnează aplicarea deja planificată.
 */
export async function createAplicarePlanificataDinInterventie(
  input: CreateAplicareDinInterventieInput
): Promise<AplicareTratament> {
  const ctx = await getQueryContext()

  const { data: row, error } = await ctx.supabase
    .from('planuri_tratament_linii')
    .select(`${LINIE_WITH_PRODUCTS_SELECT}, plan:planuri_tratament(id,nume,cultura_tip,activ,arhivat)`)
    .eq('tenant_id', ctx.tenantId)
    .eq('id', input.plan_linie_id)
    .maybeSingle()

  if (error) throw error
  if (!row) throw new Error('Intervenția din plan nu a fost găsită.')

  const linie = normalizeInterventiePlan(row as PlanLinieWithV2ProductsRow)
  const plan = firstRelation((row as PlanLinieWithV2ProductsRow & {
    plan: Pick<PlanTratament, 'id' | 'nume' | 'cultura_tip' | 'activ' | 'arhivat'> | Array<Pick<PlanTratament, 'id' | 'nume' | 'cultura_tip' | 'activ' | 'arhivat'>> | null
  }).plan)

  if (!plan?.activ || plan.arhivat) {
    throw new Error('Planul intervenției nu este activ.')
  }

  const effectiveCohort = input.cohort_la_aplicare ?? normalizeOptionalCohorta(linie.cohort_trigger)
  let existingQuery = ctx.supabase
    .from('aplicari_tratament')
    .select(APLICARE_SELECT)
    .eq('tenant_id', ctx.tenantId)
    .eq('parcela_id', input.parcela_id)
    .eq('plan_linie_id', input.plan_linie_id)
    .in('status', ['planificata', 'reprogramata'])

  existingQuery = effectiveCohort
    ? existingQuery.eq('cohort_la_aplicare', effectiveCohort)
    : existingQuery.is('cohort_la_aplicare', null)

  const { data: existing, error: existingError } = await existingQuery
    .order('data_planificata', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) return existing

  if (linie.produse.length === 0) {
    throw new Error('Intervenția din plan nu are produse planificate.')
  }

  let appliedQuery = ctx.supabase
    .from('aplicari_tratament')
    .select(APLICARE_SELECT)
    .eq('tenant_id', ctx.tenantId)
    .eq('parcela_id', input.parcela_id)
    .eq('plan_linie_id', input.plan_linie_id)
    .eq('status', 'aplicata')

  appliedQuery = effectiveCohort
    ? appliedQuery.eq('cohort_la_aplicare', effectiveCohort)
    : appliedQuery.is('cohort_la_aplicare', null)

  const { data: appliedRows, error: appliedError } = await appliedQuery.order('data_aplicata', { ascending: false })
  if (appliedError) throw appliedError

  const appliedAplicari = (appliedRows ?? []) as AplicareTratamentDetaliu[]
  const recurrence = resolveRecurrence({
    todayIso: toIsoDate(new Date()),
    plannedDate: null,
    lastAppliedDate: appliedAplicari[0] ? aplicareRelevantDate(appliedAplicari[0]) : null,
    appliedCount: appliedAplicari.length,
    regulaRepetare: linie.regula_repetare === 'interval' ? 'interval' : 'fara_repetare',
    intervalRepetareZile: linie.interval_repetare_zile,
    numarRepetariMax: linie.numar_repetari_max,
    productIntervalMinDays: linie.produse.map((produs) => produs.produs?.interval_min_aplicari_zile),
  })

  if (!recurrence.dueDate) {
    throw new Error(recurrence.reason)
  }

  const requestedDate = input.data_planificata?.slice(0, 10) ?? null
  if (requestedDate && requestedDate < recurrence.dueDate) {
    throw new Error(
      `Data planificată este înainte de următoarea repetare recomandată (${recurrence.dueDate}). ${recurrence.reason}`,
    )
  }

  return createAplicarePlanificata({
    parcela_id: input.parcela_id,
    plan_linie_id: linie.id,
    sursa: 'din_plan',
    tip_interventie: linie.tip_interventie ?? null,
    scop: linie.scop ?? null,
    data_planificata: requestedDate ?? recurrence.dueDate,
    stadiu_la_aplicare: linie.stadiu_trigger,
    cohort_la_aplicare: effectiveCohort,
    observatii: linie.observatii,
    produse: linie.produse.map((produs) => ({
      plan_linie_produs_id: produs.id.startsWith('legacy:') ? null : produs.id,
      ordine: produs.ordine,
      produs_id: produs.produs_id,
      produs_nume_manual: produs.produs_nume_manual,
      produs_nume_snapshot: produs.produs_nume_snapshot,
      substanta_activa_snapshot: produs.substanta_activa_snapshot,
      tip_snapshot: produs.tip_snapshot,
      frac_irac_snapshot: produs.frac_irac_snapshot,
      phi_zile_snapshot: produs.phi_zile_snapshot,
      doza_ml_per_hl: produs.doza_ml_per_hl,
      doza_l_per_ha: produs.doza_l_per_ha,
      observatii: produs.observatii,
    })),
  })
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
      `${APLICARE_SELECT}, produs:produse_fitosanitare(${PRODUS_LOOKUP_SELECT}), ${APLICARE_PRODUSE_RELATION_SELECT}, linie:planuri_tratament_linii(${LINIE_WITH_PRODUCTS_SELECT}), parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2)`
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
    AplicareWithV2ProductsRow & {
      linie: PlanLinieWithV2ProductsRow | PlanLinieWithV2ProductsRow[] | null
      parcela: AplicareTratamentDetaliu['parcela'] | AplicareTratamentDetaliu['parcela'][]
    }
  >).map(normalizeAplicareDetaliuRow)
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
      `${APLICARE_SELECT}, produs:produse_fitosanitare(${PRODUS_LOOKUP_SELECT}), ${APLICARE_PRODUSE_RELATION_SELECT}, linie:planuri_tratament_linii(${LINIE_WITH_PRODUCTS_SELECT}), parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2)`
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'planificata')
    .gte('data_planificata', fromDate)
    .order('data_planificata', { ascending: true })
    .limit(limit)

  if (error) throw error
  return ((data ?? []) as Array<
    AplicareWithV2ProductsRow & {
      linie: PlanLinieWithV2ProductsRow | PlanLinieWithV2ProductsRow[] | null
      parcela: AplicareTratamentDetaliu['parcela'] | AplicareTratamentDetaliu['parcela'][]
    }
  >).map(normalizeAplicareDetaliuRow)
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
      `${APLICARE_SELECT}, produs:produse_fitosanitare(${PRODUS_LOOKUP_SELECT}), ${APLICARE_PRODUSE_RELATION_SELECT}, linie:planuri_tratament_linii(${LINIE_WITH_PRODUCTS_SELECT}, plan:planuri_tratament(id,nume,cultura_tip,activ,arhivat)), parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2,latitudine,longitudine,gps_lat,gps_lng)`
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
      `${APLICARE_SELECT}, produs:produse_fitosanitare(${PRODUS_LOOKUP_SELECT}), ${APLICARE_PRODUSE_RELATION_SELECT}, linie:planuri_tratament_linii(${LINIE_WITH_PRODUCTS_SELECT}), parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2)`
    )
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as AplicareWithV2ProductsRow & {
    linie: PlanLinieWithV2ProductsRow | PlanLinieWithV2ProductsRow[] | null
    parcela: AplicareTratamentDetaliu['parcela'] | AplicareTratamentDetaliu['parcela'][]
  }

  return normalizeAplicareDetaliuRow(row)
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

  const { count: v2Count, error: v2Error } = await supabase
    .from('aplicari_tratament_produse')
    .select('id, aplicare:aplicari_tratament!inner(id)', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('produs_id', produsId)
    .eq('aplicare.parcela_id', parcelaId)
    .eq('aplicare.status', 'aplicata')
    .gte('aplicare.data_aplicata', from)
    .lte('aplicare.data_aplicata', to)

  if (v2Error) throw v2Error
  if ((v2Count ?? 0) > 0) return v2Count ?? 0

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
      `${APLICARE_SELECT}, produs:produse_fitosanitare(${PRODUS_LOOKUP_SELECT}), ${APLICARE_PRODUSE_RELATION_SELECT}, linie:planuri_tratament_linii(${LINIE_WITH_PRODUCTS_SELECT}, plan:planuri_tratament(id,nume,cultura_tip,activ,arhivat)), parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2,cultura,tip_fruct,soi,tip_unitate)`
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
        `${APLICARE_SELECT}, produs:produse_fitosanitare(${PRODUS_LOOKUP_SELECT}), ${APLICARE_PRODUSE_RELATION_SELECT}, linie:planuri_tratament_linii(${LINIE_WITH_PRODUCTS_SELECT}, plan:planuri_tratament(id,nume,cultura_tip,activ,arhivat)), parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2,cultura,tip_fruct,soi,tip_unitate)`
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
        `${APLICARE_SELECT}, produs:produse_fitosanitare(${PRODUS_LOOKUP_SELECT}), ${APLICARE_PRODUSE_RELATION_SELECT}, linie:planuri_tratament_linii(${LINIE_WITH_PRODUCTS_SELECT}, plan:planuri_tratament(id,nume,cultura_tip,activ,arhivat)), parcela:parcele(id,id_parcela,nume_parcela,suprafata_m2,cultura,tip_fruct,soi,tip_unitate)`
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
    if (produs && !produseById.has(produs.id)) {
      produseById.set(produs.id, toProdusCatalogItem(produs))
    }
    for (const produsAplicare of normalizeAplicareProduse(row)) {
      if (!produsAplicare.produs || produseById.has(produsAplicare.produs.id)) continue
      produseById.set(produsAplicare.produs.id, toProdusCatalogItem(produsAplicare.produs))
    }
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
  const produse = await normalizeAplicareProdusInputs(ctx, data)
  const firstProdus = produse[0] ?? null

  const payload: AplicareTratamentInsert = {
    tenant_id: ctx.tenantId,
    parcela_id: data.parcela_id,
    cultura_id: data.cultura_id ?? null,
    plan_linie_id: data.plan_linie_id ?? null,
    sursa: data.sursa ?? (data.plan_linie_id ? 'din_plan' : 'manuala'),
    tip_interventie: normalizeText(data.tip_interventie),
    scop: normalizeText(data.scop),
    stadiu_fenologic_id: data.stadiu_fenologic_id ?? null,
    diferente_fata_de_plan: data.diferente_fata_de_plan ?? null,
    produs_id: firstProdus?.produs_id ?? data.produs_id ?? null,
    produs_nume_manual: firstProdus?.produs_id
      ? null
      : normalizeText(firstProdus?.produs_nume_manual ?? data.produs_nume_manual),
    data_planificata: data.data_planificata,
    data_aplicata: null,
    doza_ml_per_hl: firstProdus?.doza_ml_per_hl ?? data.doza_ml_per_hl ?? null,
    doza_l_per_ha: firstProdus?.doza_l_per_ha ?? data.doza_l_per_ha ?? null,
    cantitate_totala_ml:
      firstProdus?.unitate_cantitate === 'ml'
        ? firstProdus.cantitate_totala ?? null
        : data.cantitate_totala_ml ?? null,
    stoc_mutatie_id: firstProdus?.stoc_mutatie_id ?? data.stoc_mutatie_id ?? null,
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
  await replaceAplicareProduse(ctx, inserted.id, produse)
  return inserted
}

/**
 * Creează o intervenție manuală în afara planului.
 * Exemplu: `createAplicareManuala({ parcela_id: 'uuid', status: 'aplicata', data_aplicata: '2026-05-12T10:00:00Z', produse: [...] })`
 */
export async function createAplicareManuala(
  data: CreateAplicareManualaInput
): Promise<AplicareTratament> {
  const ctx = await getQueryContext()
  const produse = Array.isArray(data.produse) && data.produse.length > 0
    ? data.produse
    : data.produs_id || normalizeText(data.produs_nume_manual)
      ? [{
          ordine: 1,
          produs_id: data.produs_id ?? null,
          produs_nume_manual: normalizeText(data.produs_nume_manual),
          doza_ml_per_hl: data.doza_ml_per_hl ?? null,
          doza_l_per_ha: data.doza_l_per_ha ?? null,
          cantitate_totala: data.cantitate_totala_ml ?? null,
          unitate_cantitate: data.cantitate_totala_ml == null ? null : 'ml',
          stoc_mutatie_id: data.stoc_mutatie_id ?? null,
          observatii: data.observatii ?? null,
        }]
      : []

  if (produse.length === 0) {
    throw new Error('O intervenție manuală trebuie să aibă cel puțin un produs.')
  }

  const firstProdus = produse[0] ?? null
  const status = data.status ?? 'planificata'
  const payload: AplicareTratamentInsert = {
    tenant_id: ctx.tenantId,
    parcela_id: data.parcela_id,
    cultura_id: data.cultura_id ?? null,
    plan_linie_id: null,
    sursa: 'manuala',
    tip_interventie: normalizeText(data.tip_interventie),
    scop: normalizeText(data.scop),
    stadiu_fenologic_id: data.stadiu_fenologic_id ?? null,
    diferente_fata_de_plan: data.diferente_fata_de_plan ?? null,
    produs_id: firstProdus?.produs_id ?? null,
    produs_nume_manual: firstProdus?.produs_id ? null : normalizeText(firstProdus?.produs_nume_manual),
    data_planificata: status === 'planificata' ? (data.data_planificata ?? null) : null,
    data_aplicata: status === 'aplicata' ? (data.data_aplicata ?? data.data_planificata ?? null) : null,
    doza_ml_per_hl: firstProdus?.doza_ml_per_hl ?? data.doza_ml_per_hl ?? null,
    doza_l_per_ha: firstProdus?.doza_l_per_ha ?? data.doza_l_per_ha ?? null,
    cantitate_totala_ml:
      firstProdus?.unitate_cantitate === 'ml'
        ? firstProdus.cantitate_totala ?? null
        : data.cantitate_totala_ml ?? null,
    stoc_mutatie_id: firstProdus?.stoc_mutatie_id ?? data.stoc_mutatie_id ?? null,
    status,
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
  await replaceAplicareProduse(ctx, inserted.id, produse)
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
    diferente_fata_de_plan: payload.diferenteFataDePlan ?? undefined,
    meteo_snapshot: meteoSnapshot ?? null,
    operator: normalizeText(payload.operator),
    observatii: normalizeText(payload.observatii),
    stadiu_la_aplicare: normalizeOptionalStadiu(payload.stadiuLaAplicare),
    updated_by: ctx.userId,
  }

  if (payload.cohortLaAplicare !== undefined) {
    updatePayload.cohort_la_aplicare = normalizeOptionalCohorta(payload.cohortLaAplicare)
  }

  if (payload.produse) {
    const firstProdus = payload.produse[0] ?? null
    updatePayload.produs_id = firstProdus?.produs_id ?? null
    updatePayload.produs_nume_manual = firstProdus?.produs_id
      ? null
      : normalizeText(firstProdus?.produs_nume_manual)
    updatePayload.doza_ml_per_hl = firstProdus?.doza_ml_per_hl ?? null
    updatePayload.doza_l_per_ha = firstProdus?.doza_l_per_ha ?? null
    updatePayload.stoc_mutatie_id = firstProdus?.stoc_mutatie_id ?? null
  }

  const { data, error } = await ctx.supabase
    .from('aplicari_tratament')
    .update(updatePayload)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select(APLICARE_SELECT)
    .single()

  if (error) throw error
  if (payload.produse) {
    await replaceAplicareProduse(ctx, id, payload.produse)
  }
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

  const [legacyResult, v2Result] = await Promise.all([
    supabase
      .from('planuri_tratament_linii')
      .select('plan_id, plan:planuri_tratament!inner(id,nume,activ)')
      .eq('produs_id', produsId)
      .eq('tenant_id', tenantId),
    supabase
      .from('planuri_tratament_linie_produse')
      .select('linie:planuri_tratament_linii!inner(plan_id, plan:planuri_tratament!inner(id,nume,activ))')
      .eq('produs_id', produsId)
      .eq('tenant_id', tenantId),
  ])

  if (legacyResult.error) throw legacyResult.error
  if (v2Result.error) throw v2Result.error

  const legacyLinii = (legacyResult.data ?? []) as Array<{
    plan_id: string
    plan: { id: string; nume: string; activ: boolean } | Array<{ id: string; nume: string; activ: boolean }>
  }>
  const v2Linii = (v2Result.data ?? []) as Array<{
    linie: {
      plan_id: string
      plan: { id: string; nume: string; activ: boolean } | Array<{ id: string; nume: string; activ: boolean }>
    } | Array<{
      plan_id: string
      plan: { id: string; nume: string; activ: boolean } | Array<{ id: string; nume: string; activ: boolean }>
    }> | null
  }>

  const planuri: Array<{ id: string; denumire: string }> = []
  const seenIds = new Set<string>()

  for (const linie of legacyLinii) {
    const plan = Array.isArray(linie.plan) ? linie.plan[0] : linie.plan
    if (plan && !seenIds.has(plan.id)) {
      seenIds.add(plan.id)
      planuri.push({ id: plan.id, denumire: plan.nume })
    }
  }

  for (const produsLinie of v2Linii) {
    const linie = firstRelation(produsLinie.linie)
    const plan = firstRelation(linie?.plan)
    if (plan && !seenIds.has(plan.id)) {
      seenIds.add(plan.id)
      planuri.push({ id: plan.id, denumire: plan.nume })
    }
  }

  return { folosit: planuri.length > 0, planuri }
}
