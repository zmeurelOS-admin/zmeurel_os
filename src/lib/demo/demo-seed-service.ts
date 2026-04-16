import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, TablesInsert } from '@/types/supabase'
import { DEMO_DATA_ORIGIN } from '@/lib/demo/demo-constants'
import { LEGAL_DOCS_BUCKET } from '@/lib/legal-docs/shared'
import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'

import { generateBusinessId } from '@/lib/supabase/business-ids'

import {
  DEMO_FIXTURE_TAG,
  DEMO_FIXED_IDS,
} from './demo-fixtures'

const DEMO_CULEGATOR_TARIF_LEI_KG = 2.5
const DEMO_LEGAL_DOC_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/xZ0AAAAASUVORK5CYII='

/** Coordonate în jurul Suceava (meteo / hărți) — ușor variate per parcelă */
const SUCEAVA_COORDS = [
  { latitudine: 47.6514, longitudine: 26.2553 },
  { latitudine: 47.658, longitudine: 26.261 },
  { latitudine: 47.645, longitudine: 26.248 },
  { latitudine: 47.652, longitudine: 26.27 },
  { latitudine: 47.649, longitudine: 26.24 },
  { latitudine: 47.655, longitudine: 26.255 },
] as const

function resolveRecoltareProdusFromParcelRow(row: Record<string, unknown>): string {
  const cultura = String(row.cultura ?? '').trim()
  const tipFruct = String(row.tip_fruct ?? '').trim()
  if (cultura) return cultura
  if (tipFruct) return tipFruct
  return 'produs-necunoscut'
}

/** Inserează mișcări de stoc la recoltare (echivalent `sync_recoltare_stock_movements`), fără RPC — compatibil service_role. */
async function insertRecoltareStockMovementsForSeed(
  supabaseAdmin: SupabaseClient<Database>,
  params: {
    tenantId: string
    recoltareId: string
    parcelaId: string
    produs: string
    dataStr: string
    kgCal1: number
    kgCal2: number
    dataOrigin: string
    seedId: string
  }
): Promise<{ error: { message?: string; code?: string; details?: string; hint?: string } | null }> {
  const { tenantId, recoltareId, parcelaId, produs, dataStr, kgCal1, kgCal2, dataOrigin, seedId } = params

  const { error: delErr } = await supabaseAdmin
    .from('miscari_stoc')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('referinta_id', recoltareId)

  if (delErr) return { error: delErr }

  const rows: TablesInsert<'miscari_stoc'>[] = []
  if (kgCal1 > 0) {
    rows.push({
      tenant_id: tenantId,
      locatie_id: parcelaId,
      produs,
      calitate: 'cal1',
      depozit: DEMO_STOC_DEPOZIT,
      tip_miscare: 'recoltare',
      cantitate_kg: kgCal1,
      tip: 'recoltare',
      cantitate_cal1: kgCal1,
      cantitate_cal2: 0,
      referinta_id: recoltareId,
      data: dataStr,
      data_origin: dataOrigin,
      demo_seed_id: seedId,
    })
  }
  if (kgCal2 > 0) {
    rows.push({
      tenant_id: tenantId,
      locatie_id: parcelaId,
      produs,
      calitate: 'cal2',
      depozit: DEMO_STOC_DEPOZIT,
      tip_miscare: 'recoltare',
      cantitate_kg: kgCal2,
      tip: 'recoltare',
      cantitate_cal1: 0,
      cantitate_cal2: kgCal2,
      referinta_id: recoltareId,
      data: dataStr,
      data_origin: dataOrigin,
      demo_seed_id: seedId,
    })
  }

  if (rows.length === 0) return { error: null }

  const { error: insErr } = await supabaseAdmin.from('miscari_stoc').insert(rows)
  return { error: insErr }
}

async function seedDemoLegalDocs(
  supabaseAdmin: SupabaseClient<Database>,
  params: {
    tenantId: string
    seedId: string
  }
): Promise<void> {
  const { tenantId, seedId } = params
  const nowIso = new Date().toISOString()
  const storagePath = `${tenantId}/demo-legal-docs/${seedId}-certificat-producator.png`

  const legalDocRow: TablesInsert<'farmer_legal_docs'> = {
    tenant_id: tenantId,
    full_name: 'Andrei Popa',
    legal_type: 'certificat_producator',
    certificate_series: 'SV',
    certificate_number: 'DEMO-2026-001',
    certificate_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    locality: 'Suceava',
    phone: '0745123456',
    certificate_photo_url: storagePath,
    legal_accepted_at: nowIso,
    cui: null,
  }

  const { error } = await supabaseAdmin.from('farmer_legal_docs').upsert(legalDocRow).select('tenant_id').single()
  if (error) {
    throw new Error(`Demo legal docs seed failed: ${error.message ?? 'Unknown error'}`)
  }

  const fileBuffer = Buffer.from(DEMO_LEGAL_DOC_PNG_BASE64, 'base64')
  const { error: uploadError } = await supabaseAdmin.storage.from(LEGAL_DOCS_BUCKET).upload(storagePath, fileBuffer, {
    contentType: 'image/png',
    upsert: true,
  })

  if (uploadError) {
    
  }
}

/** Trebuie să coincidă cu mișcările de recoltare — `check_stock_not_negative` grupează după (tenant, produs, locatie_id, depozit). */
const DEMO_STOC_DEPOZIT = 'fresh'

function harvestBucketKey(parcelaId: string, produs: string): string {
  return `${parcelaId}|${produs}|${DEMO_STOC_DEPOZIT}`
}

function addHarvestCal1ToBuckets(buckets: Map<string, number>, parcelaId: string, produs: string, kgCal1: number) {
  if (kgCal1 <= 0) return
  const k = harvestBucketKey(parcelaId, produs)
  buckets.set(k, (buckets.get(k) ?? 0) + kgCal1)
}

type SaleCal1Allocation = {
  parcelaId: string
  produs: string
  depozit: string
  cantitateKg: number
}

function allocateCal1SaleFromHarvestBuckets(params: {
  buckets: Map<string, number>
  comercialParcele: Array<{ id: string }>
  parcelaRowByParcelaId: Map<string, Record<string, unknown>>
  wantedKg: number
}): SaleCal1Allocation | null {
  const { buckets, comercialParcele, parcelaRowByParcelaId, wantedKg } = params
  if (wantedKg <= 0) return null

  for (const p of comercialParcele) {
    if (!p?.id) continue
    const produs = resolveRecoltareProdusFromParcelRow(parcelaRowByParcelaId.get(p.id) ?? {})
    const k = harvestBucketKey(p.id, produs)
    const bal = buckets.get(k) ?? 0
    if (bal >= wantedKg - 1e-6) {
      buckets.set(k, bal - wantedKg)
      return { parcelaId: p.id, produs, depozit: DEMO_STOC_DEPOZIT, cantitateKg: wantedKg }
    }
  }

  let best: { k: string; parcelaId: string; produs: string; bal: number } | null = null
  for (const p of comercialParcele) {
    if (!p?.id) continue
    const produs = resolveRecoltareProdusFromParcelRow(parcelaRowByParcelaId.get(p.id) ?? {})
    const k = harvestBucketKey(p.id, produs)
    const bal = buckets.get(k) ?? 0
    if (bal > (best?.bal ?? 0)) best = { k, parcelaId: p.id, produs, bal }
  }
  if (best && best.bal > 0) {
    const take = Math.round(Math.min(wantedKg, best.bal) * 100) / 100
    buckets.set(best.k, best.bal - take)
    return { parcelaId: best.parcelaId, produs: best.produs, depozit: DEMO_STOC_DEPOZIT, cantitateKg: take }
  }

  return null
}

type DemoTable =
  | 'parcele'
  | 'culturi'
  | 'culegatori'
  | 'clienti'
  | 'produse'
  | 'recoltari'
  | 'comenzi'
  | 'vanzari'
  | 'cheltuieli_diverse'
  | 'investitii'
  | 'miscari_stoc'
  | 'activitati_agricole'
  | 'solar_climate_logs'
  | 'culture_stage_logs'

type DemoColumnsSupport = Record<DemoTable, boolean>
type DemoType = 'berries' | 'solar' | 'orchard' | 'fieldcrop'
type DemoSeedRpcStatus = 'seeded' | 'already_seeded' | 'skipped_existing_data' | 'failed'

export type DemoSeedSummary = {
  parcele: number
  culegatori: number
  clienti: number
  produse: number
  recoltari: number
  comenzi: number
  vanzari: number
  cheltuieli: number
  investitii: number
  activitati: number
  stocuri: number
  culturi: number
}

export type DemoSeedError = {
  table: string
  error: string
  message: string
  code?: string
  details?: string
  hint?: string
  sample?: unknown
}

export type TenantDemoContext = {
  id: string
  demo_seeded: boolean
  demo_seed_id: string | null
}

const DEMO_TABLES: DemoTable[] = [
  'miscari_stoc',
  'investitii',
  'produse',
  'culturi',
  'parcele',
  'culegatori',
  'clienti',
  'recoltari',
  'comenzi',
  'vanzari',
  'cheltuieli_diverse',
  'activitati_agricole',
  'solar_climate_logs',
  'culture_stage_logs',
]

const DELETE_ORDER: DemoTable[] = [
  'miscari_stoc',
  'vanzari',
  'recoltari',
  'comenzi',
  'cheltuieli_diverse',
  'investitii',
  'produse',
  'activitati_agricole',
  'culturi',
  'solar_climate_logs',
  'culture_stage_logs',
  'clienti',
  'culegatori',
  'parcele',
]

const EMPTY_SUMMARY: DemoSeedSummary = {
  parcele: 0,
  culegatori: 0,
  clienti: 0,
  produse: 0,
  recoltari: 0,
  comenzi: 0,
  vanzari: 0,
  cheltuieli: 0,
  investitii: 0,
  activitati: 0,
  stocuri: 0,
  culturi: 0,
}
const LEGACY_DEMO_DATA_ORIGIN = 'demo'

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === 'PGRST204' || error.code === '42703') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('could not find the') || msg.includes('column')
}

function hasFixtureTag(value: unknown): boolean {
  return typeof value === 'string' && value.includes(DEMO_FIXTURE_TAG)
}

function chunkArray<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) return []
  const chunks: T[][] = []
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size))
  }
  return chunks
}

async function tableSupportsDemoColumns(
  supabaseAdmin: SupabaseClient<Database>,
  table: DemoTable
): Promise<boolean> {
  const { error } = await ((((supabaseAdmin as unknown) as { from: (name: string) => unknown }).from(table)) as {
    select: (columns: string) => {
      limit: (
        value: number
      ) => Promise<{
        error: { code?: string; message?: string } | null
      }>
    }
  })
    .select('id,data_origin,demo_seed_id')
    .limit(1)

  if (!error) return true
  if (error.code === 'PGRST205') return false
  if (isMissingColumnError(error)) return false
  throw new Error(`Table check failed for ${table}: ${error.message ?? 'Unknown error'}`)
}

async function resolveDemoColumnSupport(
  supabaseAdmin: SupabaseClient<Database>
): Promise<DemoColumnsSupport> {
  const support = {} as DemoColumnsSupport

  for (const table of DEMO_TABLES) {
    support[table] = await tableSupportsDemoColumns(supabaseAdmin, table)
  }

  return support
}

async function collectFallbackRows(
  supabaseAdmin: SupabaseClient<Database>,
  table: DemoTable,
  tenantId: string
): Promise<Array<Record<string, unknown>>> {
  const selectByTable: Record<DemoTable, string> = {
    miscari_stoc: 'id,descriere,observatii,produs',
    investitii: 'id,id_investitie,descriere',
    produse: 'id,nume,descriere',
    culturi: 'id,tip_planta,soi,observatii',
    parcele: 'id,id_parcela,observatii',
    culegatori: 'id,id_culegator,observatii',
    clienti: 'id,id_client,observatii',
    recoltari: 'id,id_recoltare,observatii',
    comenzi: 'id,observatii',
    vanzari: 'id,id_vanzare,observatii_ladite',
    cheltuieli_diverse: 'id,id_cheltuiala,descriere',
    activitati_agricole: 'id,id_activitate,observatii',
    solar_climate_logs: 'id,observatii',
    culture_stage_logs: 'id,etapa,observatii',
  }

  const { data, error } = await ((((supabaseAdmin as unknown) as { from: (name: string) => unknown }).from(table)) as {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => Promise<{
        data: Array<Record<string, unknown>> | null
        error: { code?: string; message?: string } | null
      }>
    }
  })
    .select(selectByTable[table])
    .eq('tenant_id', tenantId)

  if (error) {
    if (error.code === 'PGRST205') {
      return []
    }
    throw new Error(`Fallback select failed for ${table}: ${error.message ?? 'Unknown error'}`)
  }

  return data ?? []
}

function hasStoredDemoMarker(row: Record<string, unknown>, seedId: string | null) {
  const rowSeedId = typeof row.demo_seed_id === 'string' ? row.demo_seed_id : null
  const dataOrigin = String(row.data_origin ?? '').trim().toLowerCase()

  if (seedId && rowSeedId === seedId) {
    return true
  }

  return dataOrigin.startsWith(DEMO_DATA_ORIGIN) || dataOrigin === LEGACY_DEMO_DATA_ORIGIN || rowSeedId !== null
}

function isFallbackDemoRow(table: DemoTable, row: Record<string, unknown>): boolean {
  switch (table) {
    case 'miscari_stoc':
      return hasFixtureTag(row.descriere) || hasFixtureTag(row.observatii) || hasFixtureTag(row.produs)
    case 'investitii':
      return String(row.id_investitie ?? '').startsWith('DEMO-INV-') || hasFixtureTag(row.descriere)
    case 'produse':
      return String(row.nume ?? '').startsWith('DEMO ') || hasFixtureTag(row.descriere)
    case 'culturi':
      return String(row.tip_planta ?? '').toLowerCase().startsWith('demo ') || hasFixtureTag(row.observatii)
    case 'parcele':
      return DEMO_FIXED_IDS.parcele.includes(String(row.id_parcela ?? '')) || hasFixtureTag(row.observatii)
    case 'culegatori':
      return String(row.id_culegator ?? '').startsWith('DEMO-CUL-') || hasFixtureTag(row.observatii)
    case 'clienti':
      return DEMO_FIXED_IDS.clienti.includes(String(row.id_client ?? '')) || hasFixtureTag(row.observatii)
    case 'recoltari':
      return DEMO_FIXED_IDS.recoltari.includes(String(row.id_recoltare ?? '')) || hasFixtureTag(row.observatii)
    case 'comenzi':
      return hasFixtureTag(row.observatii)
    case 'vanzari':
      return DEMO_FIXED_IDS.vanzari.includes(String(row.id_vanzare ?? '')) || hasFixtureTag(row.observatii_ladite)
    case 'cheltuieli_diverse':
      return DEMO_FIXED_IDS.cheltuieli.includes(String(row.id_cheltuiala ?? '')) || hasFixtureTag(row.descriere)
    case 'activitati_agricole':
      return DEMO_FIXED_IDS.activitati.includes(String(row.id_activitate ?? '')) || hasFixtureTag(row.observatii)
    case 'solar_climate_logs':
      return hasFixtureTag(row.observatii)
    case 'culture_stage_logs':
      return hasFixtureTag(row.observatii) || String(row.etapa ?? '').toLowerCase().startsWith('demo_')
    default:
      return false
  }
}

async function collectDemoRowIds(params: {
  supabaseAdmin: SupabaseClient<Database>
  tenantId: string
  table: DemoTable
  seedId: string | null
  demoColumnsSupport: DemoColumnsSupport
}): Promise<string[]> {
  const { supabaseAdmin, tenantId, table, seedId, demoColumnsSupport } = params

  if (demoColumnsSupport[table]) {
    const selectByTable: Record<DemoTable, string> = {
      miscari_stoc: 'id,descriere,observatii,produs,data_origin,demo_seed_id',
      investitii: 'id,id_investitie,descriere,data_origin,demo_seed_id',
      produse: 'id,nume,descriere,data_origin,demo_seed_id',
      culturi: 'id,tip_planta,soi,observatii,data_origin,demo_seed_id',
      parcele: 'id,id_parcela,observatii,data_origin,demo_seed_id',
      culegatori: 'id,id_culegator,observatii,data_origin,demo_seed_id',
      clienti: 'id,id_client,observatii,data_origin,demo_seed_id',
      recoltari: 'id,id_recoltare,observatii,data_origin,demo_seed_id',
      comenzi: 'id,observatii,data_origin,demo_seed_id',
      vanzari: 'id,id_vanzare,observatii_ladite,data_origin,demo_seed_id',
      cheltuieli_diverse: 'id,id_cheltuiala,descriere,data_origin,demo_seed_id',
      activitati_agricole: 'id,id_activitate,observatii,data_origin,demo_seed_id',
      solar_climate_logs: 'id,observatii,data_origin,demo_seed_id',
      culture_stage_logs: 'id,etapa,observatii,data_origin,demo_seed_id',
    }

    const { data, error } = await ((((supabaseAdmin as unknown) as { from: (name: string) => unknown }).from(table)) as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string
        ) => Promise<{
          data: Array<Record<string, unknown>> | null
          error: { message?: string } | null
        }>
      }
    })
      .select(selectByTable[table])
      .eq('tenant_id', tenantId)

    if (error) {
      throw new Error(`Demo select failed for ${table}: ${error.message ?? 'Unknown error'}`)
    }

    return (data ?? [])
      .filter((row) => hasStoredDemoMarker(row, seedId) || isFallbackDemoRow(table, row))
      .map((row) => String(row.id ?? ''))
      .filter(Boolean)
  }

  const fallbackRows = await collectFallbackRows(supabaseAdmin, table, tenantId)
  return fallbackRows
    .filter((row) => isFallbackDemoRow(table, row))
    .map((row) => String(row.id ?? ''))
    .filter(Boolean)
}

async function deleteRowsByIds(params: {
  supabaseAdmin: SupabaseClient<Database>
  tenantId: string
  table: DemoTable
  ids: string[]
}): Promise<void> {
  const { supabaseAdmin, tenantId, table, ids } = params
  if (ids.length === 0) return

  const idChunks = chunkArray(ids, 500)
  for (const chunk of idChunks) {
    const { error } = await ((((supabaseAdmin as unknown) as { from: (name: string) => unknown }).from(table)) as {
      delete: () => {
        eq: (
          column: string,
          value: string
        ) => {
          in: (
            column: string,
            values: string[]
          ) => Promise<{ error: { message?: string } | null }>
        }
      }
    })
      .delete()
      .eq('tenant_id', tenantId)
      .in('id', chunk)

    if (error) {
      throw new Error(`Delete failed for ${table}: ${error.message ?? 'Unknown error'}`)
    }
  }
}

async function deleteDemoRows(params: {
  supabaseAdmin: SupabaseClient<Database>
  tenantId: string
  seedId: string | null
  demoColumnsSupport: DemoColumnsSupport
}): Promise<number> {
  const { supabaseAdmin, tenantId, seedId, demoColumnsSupport } = params
  let deletedRows = 0

  for (const table of DELETE_ORDER) {
    const ids = await collectDemoRowIds({
      supabaseAdmin,
      tenantId,
      table,
      seedId,
      demoColumnsSupport,
    })

    await deleteRowsByIds({
      supabaseAdmin,
      tenantId,
      table,
      ids,
    })

    deletedRows += ids.length
  }

  return deletedRows
}

async function updateTenantDemoFlags(
  supabaseAdmin: SupabaseClient<Database>,
  tenantId: string,
  payload: { demo_seeded: boolean; demo_seed_id: string | null; demo_seeded_at: string | null }
) {
  const nowIso = new Date().toISOString()
  const { error } = await ((supabaseAdmin.from('tenants') as unknown) as {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>
    }
  })
    .update({
      demo_seeded: payload.demo_seeded,
      demo_seed_id: payload.demo_seed_id,
      demo_seeded_at: payload.demo_seeded_at,
      updated_at: nowIso,
    })
    .eq('id', tenantId)

  if (error) {
    throw new Error(`Tenant demo flag update failed: ${error.message ?? 'Unknown error'}`)
  }
}

function normalizeDemoType(value: string | null | undefined): DemoType {
  if (value === 'solar' || value === 'orchard' || value === 'fieldcrop' || value === 'berries') return value
  return 'berries'
}

function normalizeSeedError(
  table: string,
  error: unknown,
  sample?: unknown
): DemoSeedError {
  const dbError = error as { message?: string; code?: string; details?: string; hint?: string }
  const base = dbError?.message?.trim() || 'Unknown error'
  const hint = dbError?.hint?.trim()
  const message = hint && !base.includes(hint) ? `${base} — ${hint}` : base
  return {
    table,
    error: base,
    message,
    code: dbError?.code,
    details: dbError?.details,
    hint: dbError?.hint,
    sample,
  }
}

function logSeedInsertError(
  errors: DemoSeedError[],
  table: string,
  error: unknown,
  sentData?: unknown
) {
  const normalizedError = normalizeSeedError(table, error, sentData)
  errors.push(normalizedError)
}

function logSeedInsertSuccess(_table: string, _rows: Array<Record<string, unknown>> | null | undefined) {
  void _table
  void _rows
}

async function inferDemoTypeForTenant(
  supabaseAdmin: SupabaseClient<Database>,
  tenantId: string
): Promise<DemoType> {
  const { data, error } = await ((supabaseAdmin.from('parcele') as unknown) as {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => Promise<{
        data: Array<Record<string, unknown>> | null
        error: { message?: string } | null
      }>
    }
  })
    .select('id,data_origin,nume_parcela,tip_unitate,cultura,tip_fruct')
    .eq('tenant_id', tenantId)

  if (error) {
    throw new Error(`Demo type detection failed for parcele: ${error.message ?? 'Unknown error'}`)
  }

  const firstDemoOrigin = (data ?? [])
    .map((row) => String(row.data_origin ?? '').trim().toLowerCase())
    .find((origin) => origin.startsWith('demo_seed:'))
  if (firstDemoOrigin) {
    return normalizeDemoType(firstDemoOrigin.replace('demo_seed:', ''))
  }

  const names = (data ?? []).map((row) => `${String(row.nume_parcela ?? '')} ${String(row.cultura ?? '')} ${String(row.tip_fruct ?? '')}`.toLowerCase())
  if (names.some((name) => name.includes('solar'))) return 'solar'
  if (names.some((name) => name.includes('livada') || name.includes('meri') || name.includes('pruni'))) return 'orchard'
  if (names.some((name) => name.includes('grâu') || name.includes('porumb') || name.includes('floarea'))) return 'fieldcrop'
  return 'berries'
}

export async function getTenantDemoContext(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<TenantDemoContext | null> {
  const tenantId = await getTenantIdByUserIdOrNull(supabase, userId)
  if (!tenantId) return null

  const tenantQuery = (supabase.from('tenants') as unknown as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }>
      }
    }
  })
    .select('id,demo_seeded,demo_seed_id')
    .eq('id', tenantId)

  const { data, error } = await tenantQuery.maybeSingle()

  if (error && isMissingColumnError(error)) {
    const fallbackQuery = (supabase.from('tenants') as unknown as {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message?: string } | null }>
        }
      }
    })
      .select('id')
      .eq('id', tenantId)

    const { data: fallbackData, error: fallbackError } = await fallbackQuery.maybeSingle()
    if (fallbackError) {
      throw new Error(fallbackError.message ?? 'Tenant fetch failed')
    }
    if (!fallbackData?.id) return null

    return {
      id: String(fallbackData.id),
      demo_seeded: false,
      demo_seed_id: null,
    }
  }

  if (error) {
    throw new Error(error.message ?? 'Tenant fetch failed')
  }

  if (!data?.id) return null

  return {
    id: String(data.id),
    demo_seeded: data.demo_seeded === true,
    demo_seed_id: typeof data.demo_seed_id === 'string' ? data.demo_seed_id : null,
  }
}

export async function seedDemoDataForTenant(
  supabaseAdmin: SupabaseClient<Database>,
  tenantId: string,
  demoType: DemoType = 'berries'
): Promise<{
  status: DemoSeedRpcStatus
  seedId: string | null
  summary: DemoSeedSummary
  errors: DemoSeedError[]
}> {
  const summary: DemoSeedSummary = { ...EMPTY_SUMMARY }
  const errors: DemoSeedError[] = []
  const demoColumnsSupport = await resolveDemoColumnSupport(supabaseAdmin)
  const existingRows = await collectFallbackRows(supabaseAdmin, 'parcele', tenantId)
  const hasRealRows = existingRows.some((row) => !hasStoredDemoMarker(row, null) && !isFallbackDemoRow('parcele', row))
  if (hasRealRows) {
    return { status: 'skipped_existing_data', seedId: null, summary, errors }
  }

  await deleteDemoRows({
    supabaseAdmin,
    tenantId,
    seedId: null,
    demoColumnsSupport,
  })

  const seedId = randomUUID()
  const dataOrigin = `${DEMO_DATA_ORIGIN}:${demoType}`
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const day = (offset: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() + offset)
    return d.toISOString().slice(0, 10)
  }

  const parcelaRows = (
    demoType === 'solar'
      ? [
          ['Solar 1 — Roșii', 'solar', 'Rosii', 2000, 'comercial', 'productie'],
          ['Solar 2 — Castraveți', 'solar', 'Castraveti', 1500, 'comercial', 'productie'],
          ['Solar 3 — Ardei', 'solar', 'Ardei', 1800, 'comercial', 'productie'],
          ['Răsadniță', 'solar', 'Rasaduri', 500, 'personal', 'pepiniera'],
          ['Grădina', 'camp', 'Mix legume', 1000, 'personal', 'consum'],
        ]
      : demoType === 'orchard'
        ? [
            ['Livada meri Jonagold', 'camp', 'Meri', 10000, 'comercial', 'productie'],
            ['Livada pruni', 'camp', 'Pruni', 8000, 'comercial', 'productie'],
            ['Livada cireși', 'camp', 'Ciresi', 5000, 'comercial', 'productie'],
            ['Nuci', 'camp', 'Nuci', 3000, 'personal', 'consum'],
            ['Pepiniera', 'camp', 'Puieți', 2000, 'personal', 'pepiniera'],
          ]
        : demoType === 'fieldcrop'
          ? [
              ['Lan grâu', 'camp', 'Grau', 50000, 'comercial', 'productie'],
              ['Lan porumb', 'camp', 'Porumb', 30000, 'comercial', 'productie'],
              ['Floarea soarelui', 'camp', 'Floarea soarelui', 20000, 'comercial', 'productie'],
              ['Grădină', 'camp', 'Mix', 2000, 'personal', 'consum'],
            ]
          : [
              ['Delniwa Nord', 'camp', 'Zmeure Delniwa', 5000, 'comercial', 'productie'],
              ['Delniwa Sud', 'camp', 'Zmeure Delniwa', 3000, 'comercial', 'productie'],
              ['Maravilla', 'camp', 'Zmeure Maravilla', 4000, 'comercial', 'productie'],
              ['Mure Thornfree', 'camp', 'Mure', 2000, 'comercial', 'productie'],
              ['Afine', 'camp', 'Afine', 1500, 'personal', 'consum'],
              ['Grădina casei', 'camp', 'Mix fructe', 1000, 'personal', 'consum'],
            ]
  ).map((row, idx) => {
    const coords = SUCEAVA_COORDS[idx % SUCEAVA_COORDS.length]
    const obsByRol: Record<string, string> = {
      productie: 'Teren plan, sol argilos; irigație disponibilă.',
      pepiniera: 'Răsaduri sub folie, substrat de turbă.',
      consum: 'Lot mic pentru consum propriu.',
    }
    return {
      tenant_id: tenantId,
      id_parcela: `DEMO-PAR-${String(idx + 1).padStart(3, '0')}`,
      nume_parcela: String(row[0]),
      tip_unitate: String(row[1]),
      cultura: String(row[2]),
      tip_fruct: String(row[2]),
      soi_plantat: String(row[2]),
      suprafata_m2: Number(row[3]),
      an_plantare: today.getFullYear() - 2,
      status: 'Activ',
      rol: String(row[4]),
      status_operational: 'activ',
      stadiu: 'plantare',
      apare_in_dashboard: true,
      contribuie_la_productie: row[4] === 'comercial',
      latitudine: coords.latitudine,
      longitudine: coords.longitudine,
      observatii: obsByRol[String(row[5])] ?? 'Teren plan, sol argilos.',
      data_origin: dataOrigin,
      demo_seed_id: seedId,
    }
  })

  let insertedParcele: Array<{ id: string; nume_parcela: string | null; rol: string | null }> = []
  {
    const { data, error } = await supabaseAdmin.from('parcele').insert(parcelaRows).select('id,nume_parcela,rol')
    if (error) {
      logSeedInsertError(errors, 'parcele', error, parcelaRows[0] ?? null)
    } else {
      insertedParcele = (data ?? []) as Array<{ id: string; nume_parcela: string | null; rol: string | null }>
      summary.parcele = insertedParcele.length
      logSeedInsertSuccess('parcele', (data ?? []) as Array<Record<string, unknown>>)
    }
  }
  const comercialParcele = insertedParcele.filter((p) => p.rol === 'comercial')

  const parcelaRowByParcelaId = new Map<string, Record<string, unknown>>()
  insertedParcele.forEach((p, i) => {
    const raw = parcelaRows[i] as Record<string, unknown> | undefined
    if (p?.id && raw) parcelaRowByParcelaId.set(p.id, raw)
  })

  const clientiBase = demoType === 'solar'
    ? ['Piața Obor', 'Restaurant Verona', 'Mega Image', 'Selgros', 'Magazin Bio', "Vecinu' Ion"]
    : ['Mega Image', 'Selgros', 'Piața Centrală', 'Restaurant Bucovina', "Vecinu' Ion", 'Magazin Bio Suceava']
  const clientiRows = clientiBase.map((name, idx) => ({
    tenant_id: tenantId,
    id_client: `DEMO-CLI-${String(idx + 1).padStart(3, '0')}`,
    nume_client: name,
    telefon: `07400000${String(idx + 10).padStart(2, '0')}`,
    adresa: 'Suceava',
    observatii: 'Livrare în Suceava și împrejurimi.',
    data_origin: dataOrigin,
    demo_seed_id: seedId,
  }))
  let insertedClienti: Array<{ id: string; nume_client: string | null }> = []
  {
    const { data, error } = await supabaseAdmin.from('clienti').insert(clientiRows).select('id,nume_client')
    if (error) {
      logSeedInsertError(errors, 'clienti', error, clientiRows[0] ?? null)
    } else {
      insertedClienti = (data ?? []) as Array<{ id: string; nume_client: string | null }>
      summary.clienti = insertedClienti.length
      logSeedInsertSuccess('clienti', (data ?? []) as Array<Record<string, unknown>>)
    }
  }

  const culegatoriRows = Array.from({ length: 8 }).map((_, idx) => ({
    tenant_id: tenantId,
    id_culegator: `DEMO-CUL-${String(idx + 1).padStart(3, '0')}`,
    nume_prenume: ['Vasile Popescu', 'Ion Ilie', 'Marian Pavel', 'Ioana Stoica', 'Elena Rusu', 'Nicu Dascălu', 'Paula Munteanu', 'Mihai Crețu'][idx],
    telefon: `07330000${String(idx + 10).padStart(2, '0')}`,
    status_activ: true,
    tarif_lei_kg: DEMO_CULEGATOR_TARIF_LEI_KG,
    observatii: 'Angajat în câmp, disponibil în sezon.',
    data_origin: dataOrigin,
    demo_seed_id: seedId,
  }))
  let insertedCulegatori: Array<{ id: string }> = []
  {
    const { data, error } = await supabaseAdmin.from('culegatori').insert(culegatoriRows).select('id')
    if (error) {
      logSeedInsertError(errors, 'culegatori', error, culegatoriRows[0] ?? null)
    } else {
      insertedCulegatori = (data ?? []) as Array<{ id: string }>
      summary.culegatori = insertedCulegatori.length
      logSeedInsertSuccess('culegatori', (data ?? []) as Array<Record<string, unknown>>)
    }
  }

  try {
    await seedDemoLegalDocs(supabaseAdmin, {
      tenantId,
      seedId,
    })
    
  } catch (error) {
    logSeedInsertError(
      errors,
      'farmer_legal_docs',
      error instanceof Error ? { message: error.message } : { message: 'Demo legal docs seed failed' },
      {
        tenant_id: tenantId,
        legal_type: 'certificat_producator',
        certificate_photo_url: `${tenantId}/demo-legal-docs/${seedId}-certificat-producator.png`,
      }
    )
  }

  const produseBase = demoType === 'solar'
    ? ['Roșii', 'Castraveți', 'Ardei', 'Răsaduri', 'Mix legume']
    : demoType === 'orchard'
      ? ['Mere Jonagold', 'Prune', 'Cireșe', 'Nuci', 'Puieți']
      : demoType === 'fieldcrop'
        ? ['Grâu', 'Porumb', 'Floarea soarelui', 'Paie', 'Mix cereale']
        : ['Zmeură Delniwa', 'Zmeură Maravilla', 'Mure Thornfree', 'Afine', 'Mix fructe pădure']
  const produseRows = produseBase.map((name) => ({
    tenant_id: tenantId,
    nume: name,
    descriere: 'Produs din catalog',
    categorie: 'fruct',
    unitate_vanzare: 'kg',
    pret_unitar: demoType === 'fieldcrop' ? 4 : 18,
    data_origin: dataOrigin,
    demo_seed_id: seedId,
  }))
  {
    const { data, error } = await ((supabaseAdmin as unknown) as {
      from: (name: string) => {
        insert: (values: unknown[]) => {
          select: (columns: string) => Promise<{
            data: Array<Record<string, unknown>> | null
            error: { message?: string; code?: string; details?: string; hint?: string } | null
          }>
        }
      }
    })
      .from('produse')
      .insert(produseRows)
      .select('id,nume')
    if (error) {
      logSeedInsertError(errors, 'produse', error, produseRows[0] ?? null)
    } else {
      summary.produse = (data ?? []).length
      logSeedInsertSuccess('produse', data ?? [])
    }
  }

  const harvestCal1ByBucket = new Map<string, number>()
  const recoltariCount = demoType === 'berries' ? 15 : 12
  for (let i = 0; i < recoltariCount; i += 1) {
    const parcela = comercialParcele[i % Math.max(1, comercialParcele.length)]
    const culegator = insertedCulegatori[i % Math.max(1, insertedCulegatori.length)]
    if (!parcela?.id || !culegator?.id) continue
    const kg = demoType === 'fieldcrop' ? 120 + i * 14 : 8 + i * 4
    const kgCal1 = Math.round(kg * 0.75)
    const kgCal2 = Math.round(kg * 0.25)
    const dataStr = day(-58 + i * 4)
    const obs = 'Recoltare dimineață, calitate bună.'
    const tarif = DEMO_CULEGATOR_TARIF_LEI_KG
    const totalKg = kgCal1 + kgCal2
    const valoareMunca = Math.round(totalKg * tarif * 100) / 100

    let idRecoltare: string
    try {
      idRecoltare = await generateBusinessId(supabaseAdmin, 'REC')
    } catch (e) {
      logSeedInsertError(errors, 'recoltari', { message: e instanceof Error ? e.message : 'generate_business_id failed' }, {
        parcela_id: parcela.id,
        i,
      })
      continue
    }

    const recRow = {
      tenant_id: tenantId,
      id_recoltare: idRecoltare,
      data: dataStr,
      parcela_id: parcela.id,
      culegator_id: culegator.id,
      kg_cal1: kgCal1,
      kg_cal2: kgCal2,
      pret_lei_pe_kg_snapshot: Math.round(tarif * 100) / 100,
      valoare_munca_lei: valoareMunca,
      observatii: obs,
      data_origin: dataOrigin,
      demo_seed_id: seedId,
    }

    const { data: recInserted, error: recErr } = await supabaseAdmin
      .from('recoltari')
      .insert(recRow)
      .select('id')
      .maybeSingle()

    if (recErr || !recInserted?.id) {
      logSeedInsertError(errors, 'recoltari', recErr ?? { message: 'Insert returned no row' }, recRow)
      continue
    }

    const produs = resolveRecoltareProdusFromParcelRow(parcelaRowByParcelaId.get(parcela.id) ?? {})
    const { error: stockErr } = await insertRecoltareStockMovementsForSeed(supabaseAdmin, {
      tenantId,
      recoltareId: recInserted.id,
      parcelaId: parcela.id,
      produs,
      dataStr,
      kgCal1,
      kgCal2,
      dataOrigin,
      seedId,
    })

    if (stockErr) {
      await supabaseAdmin.from('recoltari').delete().eq('id', recInserted.id)
      logSeedInsertError(errors, 'recoltari', stockErr, { recoltare_id: recInserted.id, parcela_id: parcela.id })
    } else {
      addHarvestCal1ToBuckets(harvestCal1ByBucket, parcela.id, produs, kgCal1)
      summary.recoltari += 1
      summary.stocuri += 1
    }
  }
  

  const comandaStatuses = ['livrata', 'livrata', 'livrata', 'livrata', 'confirmata', 'confirmata', 'confirmata', 'confirmata', 'noua', 'noua', 'anulata', 'anulata']
  const comenziRows = comandaStatuses.map((status, idx) => {
    const client = (insertedClienti ?? [])[idx % Math.max(1, (insertedClienti ?? []).length)]
    const cantitate = demoType === 'fieldcrop' ? 400 + idx * 30 : 12 + idx * 3
    const pret = demoType === 'fieldcrop' ? 5 : 15 + (idx % 6)
    return {
      tenant_id: tenantId,
      client_id: client?.id ?? null,
      data_comanda: day(-20 + idx),
      data_livrare: day(-18 + idx),
      cantitate_kg: cantitate,
      pret_per_kg: pret,
      total: cantitate * pret,
      status,
      observatii: 'Livrare cu mașina fermei.',
      data_origin: dataOrigin,
      demo_seed_id: seedId,
    }
  })
  let insertedComenzi: Array<{
    id: string
    status: string
    client_id: string | null
    data_livrare: string
    cantitate_kg: number
    pret_per_kg: number
  }> = []
  {
    const { data, error } = await supabaseAdmin
      .from('comenzi')
      .insert(comenziRows)
      .select('id,status,client_id,data_livrare,cantitate_kg,pret_per_kg')
    if (error) {
      logSeedInsertError(errors, 'comenzi', error, comenziRows[0] ?? null)
    } else {
      insertedComenzi = (data ?? []) as Array<{
        id: string
        status: string
        client_id: string | null
        data_livrare: string
        cantitate_kg: number
        pret_per_kg: number
      }>
      summary.comenzi = insertedComenzi.length
      logSeedInsertSuccess('comenzi', (data ?? []) as Array<Record<string, unknown>>)
    }
  }

  const delivered = insertedComenzi.filter((c) => c.status === 'livrata').slice(0, 6)
  for (let i = 0; i < 10; i += 1) {
    const row = delivered[i % Math.max(1, delivered.length)]
    if (!row) continue
    const wantedKg = Math.round(Number(row.cantitate_kg) * 0.75 * 100) / 100
    const alloc = allocateCal1SaleFromHarvestBuckets({
      buckets: harvestCal1ByBucket,
      comercialParcele,
      parcelaRowByParcelaId,
      wantedKg,
    })
    if (!alloc) {
      logSeedInsertError(errors, 'vanzari', { message: `Stoc demo insuficient pentru vânzare (${wantedKg} kg cal1).` }, {
        wantedKg,
        row_id: row.id,
      })
      continue
    }
    const cantitateKg = alloc.cantitateKg
    const pretLeiKg = Math.round(Number(row.pret_per_kg) * 100) / 100

    let idVanzare: string
    try {
      idVanzare = await generateBusinessId(supabaseAdmin, 'V')
    } catch (e) {
      logSeedInsertError(errors, 'vanzari', { message: e instanceof Error ? e.message : 'generate_business_id failed' }, {
        comanda_id: row.id,
        i,
      })
      continue
    }

    const vanzarePayload = {
      tenant_id: tenantId,
      client_sync_id: randomUUID(),
      id_vanzare: idVanzare,
      data: row.data_livrare,
      client_id: row.client_id,
      comanda_id: row.id,
      cantitate_kg: cantitateKg,
      pret_lei_kg: pretLeiKg,
      status_plata: 'Platit',
      observatii_ladite: 'Lădițe standard, paletizat.',
      sync_status: 'synced' as const,
      data_origin: dataOrigin,
      demo_seed_id: seedId,
    }

    const { data: vanzInserted, error: vanzErr } = await supabaseAdmin
      .from('vanzari')
      .insert(vanzarePayload)
      .select('id')
      .maybeSingle()

    if (vanzErr || !vanzInserted?.id) {
      logSeedInsertError(errors, 'vanzari', vanzErr ?? { message: 'Insert returned no row' }, vanzarePayload)
      continue
    }

    const moveRow = {
      tenant_id: tenantId,
      tip: 'vanzare' as const,
      tip_miscare: 'vanzare',
      locatie_id: alloc.parcelaId,
      produs: alloc.produs,
      depozit: alloc.depozit,
      cantitate_kg: cantitateKg,
      cantitate_cal1: -cantitateKg,
      cantitate_cal2: 0,
      referinta_id: vanzInserted.id,
      data: row.data_livrare,
      descriere: 'Scadere stoc la vanzare',
      calitate: 'cal1',
      data_origin: dataOrigin,
      demo_seed_id: seedId,
    }

    const { error: moveErr } = await supabaseAdmin.from('miscari_stoc').insert(moveRow)
    if (moveErr) {
      await supabaseAdmin.from('vanzari').delete().eq('id', vanzInserted.id)
      logSeedInsertError(errors, 'vanzari', moveErr, vanzarePayload)
    } else {
      summary.vanzari += 1
      summary.stocuri += 1
    }
  }
  

  const cheltuialaTotal = demoType === 'fieldcrop' ? 20 : 15
  const cheltuieliRows = Array.from({ length: cheltuialaTotal }).map((_, idx) => ({
    tenant_id: tenantId,
    id_cheltuiala: `DEMO-CH-${String(idx + 1).padStart(3, '0')}`,
    data: day(-88 + idx * 5),
    categorie: demoType === 'fieldcrop'
      ? (idx < 6 ? 'Combustibil / energie' : idx < 11 ? 'Îngrășăminte' : 'Consumabile')
      : (idx < 4 ? 'Forță de muncă' : idx < 7 ? 'Combustibil / energie' : idx < 10 ? 'Consumabile' : idx < 13 ? 'Reparații / întreținere' : 'Altele'),
    descriere:
      demoType === 'fieldcrop'
        ? (idx < 6 ? 'Motorină pentru tractor și utilaje' : idx < 11 ? 'Îngrășăminte NPK pentru lanuri' : 'Materiale consumabile')
        : (idx < 4 ? 'Plată manoperă pentru recoltare' : idx < 7 ? 'Combustibil pentru tractor' : idx < 10 ? 'Consumabile atelier' : idx < 13 ? 'Reparații utilaje' : 'Diverse operaționale'),
    suma_lei: demoType === 'fieldcrop' ? (idx < 6 ? 2200 : idx < 11 ? 3200 : 1500) : 120 + idx * 35,
    furnizor: 'Distribuitor Agricol Nord',
    data_origin: dataOrigin,
    demo_seed_id: seedId,
  }))
  {
    const { data, error } = await supabaseAdmin
      .from('cheltuieli_diverse')
      .insert(cheltuieliRows)
      .select('id,id_cheltuiala')
    if (error) {
      logSeedInsertError(errors, 'cheltuieli_diverse', error, cheltuieliRows[0] ?? null)
    } else {
      summary.cheltuieli = (data ?? []).length
      logSeedInsertSuccess('cheltuieli_diverse', (data ?? []) as Array<Record<string, unknown>>)
    }
  }

  const investitiiRows = Array.from({ length: 10 }).map((_, idx) => ({
    tenant_id: tenantId,
    id_investitie: `DEMO-INV-${String(idx + 1).padStart(3, '0')}`,
    data: day(-80 + idx * 8),
    parcela_id: comercialParcele[idx % Math.max(1, comercialParcele.length)]?.id ?? null,
    categorie: idx < 3 ? 'Echipamente / utilaje' : idx < 6 ? 'Material săditor' : idx < 8 ? 'Infrastructură' : 'Altele',
    furnizor: 'AgroTeh Suceava',
    descriere: idx < 3 ? 'Echipament pentru procesare' : idx < 6 ? 'Material săditor certificat' : idx < 8 ? 'Infrastructură irigații' : 'Îmbunătățiri teren',
    suma_lei: demoType === 'fieldcrop' ? 6500 + idx * 500 : 900 + idx * 180,
    data_origin: dataOrigin,
    demo_seed_id: seedId,
  }))
  {
    const { data, error } = await supabaseAdmin
      .from('investitii')
      .insert(investitiiRows)
      .select('id,id_investitie')
    if (error) {
      logSeedInsertError(errors, 'investitii', error, investitiiRows[0] ?? null)
    } else {
      summary.investitii = (data ?? []).length
      logSeedInsertSuccess('investitii', (data ?? []) as Array<Record<string, unknown>>)
    }
  }

  const activitatiRows = Array.from({ length: 12 }).map((_, idx) => ({
    tenant_id: tenantId,
    id_activitate: `DEMO-ACT-${String(idx + 1).padStart(3, '0')}`,
    data_aplicare: idx < 10 ? day(-85 + idx * 8) : day(idx - 8),
    parcela_id: comercialParcele[idx % Math.max(1, comercialParcele.length)]?.id ?? null,
    tip_activitate: idx < 4 ? 'Fungicide/Pesticide' : idx < 7 ? 'Fertirigare' : idx < 10 ? 'Fertilizare foliară' : 'Tăiere',
    produs_utilizat: idx < 4 ? (idx % 2 ? 'Cupru' : 'Mancozeb') : idx < 7 ? 'NPK / Raizamix' : 'Bionatural',
    doza: idx < 4 ? '200 ml' : '2 l/ha',
    timp_pauza_zile: idx < 4 ? 7 + (idx % 2) * 7 : 0,
    observatii: 'Aplicat pe timp uscat, fără vânt.',
    data_origin: dataOrigin,
    demo_seed_id: seedId,
  }))
  {
    const { data, error } = await supabaseAdmin
      .from('activitati_agricole')
      .insert(activitatiRows)
      .select('id,id_activitate')
    if (error) {
      logSeedInsertError(errors, 'activitati_agricole', error, activitatiRows[0] ?? null)
    } else {
      summary.activitati = (data ?? []).length
      logSeedInsertSuccess('activitati_agricole', (data ?? []) as Array<Record<string, unknown>>)
    }
  }

  if (demoType === 'solar') {
    const culturiRows = (insertedParcele ?? [])
      .filter((p) => String((p as { nume_parcela?: string }).nume_parcela ?? '').toLowerCase().includes('solar'))
      .map((p, idx) => ({
        tenant_id: tenantId,
        solar_id: p.id,
        tip_planta: ['Roșii', 'Castraveți', 'Ardei'][idx % 3],
        soi: ['Rio Grande', 'Cornișon', 'Kapia'][idx % 3],
        stadiu: 'vegetativ',
        activa: true,
        interval_tratament_zile: 10 + idx,
        observatii: 'Monitorizare cultură în solar.',
        data_origin: dataOrigin,
        demo_seed_id: seedId,
      }))
    if (culturiRows.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('culturi')
        .insert(culturiRows)
        .select('id,solar_id,tip_planta,soi')
      if (error) {
        logSeedInsertError(errors, 'culturi', error, culturiRows[0] ?? null)
      } else {
        summary.culturi = (data ?? []).length
        logSeedInsertSuccess('culturi', (data ?? []) as Array<Record<string, unknown>>)
      }
    }
  }
  if (errors.length > 0) {
    await updateTenantDemoFlags(supabaseAdmin, tenantId, {
      demo_seeded: false,
      demo_seed_id: null,
      demo_seeded_at: null,
    })
    return { status: 'failed', seedId, summary, errors }
  }

  await updateTenantDemoFlags(supabaseAdmin, tenantId, {
    demo_seeded: true,
    demo_seed_id: seedId,
    demo_seeded_at: new Date().toISOString(),
  })

  return { status: 'seeded', seedId, summary, errors }
}

export async function reloadDemoDataForTenant(
  supabaseAdmin: SupabaseClient<Database>,
  tenantId: string,
  requestedDemoType?: DemoType
): Promise<{ deletedRows: number; seedId: string; summary: DemoSeedSummary }> {
  const demoColumnsSupport = await resolveDemoColumnSupport(supabaseAdmin)
  const demoType = requestedDemoType ?? (await inferDemoTypeForTenant(supabaseAdmin, tenantId))
  const deletedRows = await deleteDemoRows({
    supabaseAdmin,
    tenantId,
    seedId: null,
    demoColumnsSupport,
  })

  await updateTenantDemoFlags(supabaseAdmin, tenantId, {
    demo_seeded: false,
    demo_seed_id: null,
    demo_seeded_at: null,
  })

  const seeded = await seedDemoDataForTenant(supabaseAdmin, tenantId, demoType)
  if (seeded.status !== 'seeded' || !seeded.seedId) {
    throw new Error(`Demo reload failed: seed status ${seeded.status}`)
  }

  return {
    deletedRows,
    seedId: seeded.seedId,
    summary: { ...EMPTY_SUMMARY },
  }
}

export async function deleteDemoDataForTenant(
  supabaseAdmin: SupabaseClient<Database>,
  tenantId: string
): Promise<{ deletedRows: number }> {
  const demoColumnsSupport = await resolveDemoColumnSupport(supabaseAdmin)
  const deletedRows = await deleteDemoRows({
    supabaseAdmin,
    tenantId,
    seedId: null,
    demoColumnsSupport,
  })

  await updateTenantDemoFlags(supabaseAdmin, tenantId, {
    demo_seeded: false,
    demo_seed_id: null,
    demo_seeded_at: null,
  })

  return { deletedRows }
}
