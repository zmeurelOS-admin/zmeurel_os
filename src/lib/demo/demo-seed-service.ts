import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'
import { DEMO_DATA_ORIGIN } from '@/lib/demo/demo-constants'
import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'

import {
  DEMO_FIXTURE_TAG,
  DEMO_FIXED_IDS,
} from './demo-fixtures'

type DemoTable =
  | 'parcele'
  | 'culegatori'
  | 'clienti'
  | 'recoltari'
  | 'comenzi'
  | 'vanzari'
  | 'cheltuieli_diverse'
  | 'activitati_agricole'
  | 'solar_climate_logs'
  | 'culture_stage_logs'

type DemoColumnsSupport = Record<DemoTable, boolean>

export type DemoSeedSummary = {
  parcele: number
  culegatori: number
  clienti: number
  recoltari: number
  comenzi: number
  vanzari: number
  cheltuieli: number
  activitati: number
  climate: number
  etape: number
}

export type TenantDemoContext = {
  id: string
  demo_seeded: boolean
  demo_seed_id: string | null
}

const DEMO_TABLES: DemoTable[] = [
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
  'vanzari',
  'recoltari',
  'comenzi',
  'cheltuieli_diverse',
  'activitati_agricole',
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
  recoltari: 0,
  comenzi: 0,
  vanzari: 0,
  cheltuieli: 0,
  activitati: 0,
  climate: 0,
  etape: 0,
}

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
  const { error } = await ((supabaseAdmin.from(table) as unknown) as {
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

  const { data, error } = await ((supabaseAdmin.from(table) as unknown) as {
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

function isFallbackDemoRow(table: DemoTable, row: Record<string, unknown>): boolean {
  switch (table) {
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
    const baseQuery = ((supabaseAdmin.from(table) as unknown) as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string
        ) => {
          eq: (
            column: string,
            value: string
          ) => {
            eq: (
              column: string,
              value: string
            ) => Promise<{
              data: Array<{ id?: string | null }> | null
              error: { message?: string } | null
            }>
            then: undefined
          }
          then: undefined
        }
      }
    })
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('data_origin', DEMO_DATA_ORIGIN)

    const result = seedId
      ? await baseQuery.eq('demo_seed_id', seedId)
      : await ((supabaseAdmin.from(table) as unknown) as {
          select: (columns: string) => {
            eq: (
              column: string,
              value: string
            ) => {
              eq: (
                column: string,
                value: string
              ) => Promise<{
                data: Array<{ id?: string | null }> | null
                error: { message?: string } | null
              }>
              then: undefined
            }
          }
        })
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('data_origin', DEMO_DATA_ORIGIN)

    const { data, error } = result

    if (error) {
      throw new Error(`Demo select failed for ${table}: ${error.message ?? 'Unknown error'}`)
    }

    return (data ?? []).map((row: { id?: string | null }) => String(row.id ?? '')).filter(Boolean)
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
    const { error } = await ((supabaseAdmin.from(table) as unknown) as {
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

async function runSeedDemoRpc(supabaseAdmin: SupabaseClient<Database>, tenantId: string): Promise<void> {
  const { error } = await (supabaseAdmin as unknown as {
    rpc: (
      fn: string,
      args: { p_tenant_id: string }
    ) => Promise<{ error: { message?: string } | null }>
  }).rpc('seed_demo_for_tenant', {
    p_tenant_id: tenantId,
  })

  if (error) {
    throw new Error(`seed_demo_for_tenant failed: ${error.message ?? 'Unknown error'}`)
  }
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
  tenantId: string
): Promise<{ seedId: string; summary: DemoSeedSummary }> {
  const seedId = randomUUID()
  await runSeedDemoRpc(supabaseAdmin, tenantId)

  await updateTenantDemoFlags(supabaseAdmin, tenantId, {
    demo_seeded: true,
    demo_seed_id: seedId,
    demo_seeded_at: new Date().toISOString(),
  })

  return { seedId, summary: { ...EMPTY_SUMMARY } }
}

export async function reloadDemoDataForTenant(
  supabaseAdmin: SupabaseClient<Database>,
  tenantId: string
): Promise<{ deletedRows: number; seedId: string; summary: DemoSeedSummary }> {
  const demoColumnsSupport = await resolveDemoColumnSupport(supabaseAdmin)
  const deletedRows = await deleteDemoRows({
    supabaseAdmin,
    tenantId,
    seedId: null,
    demoColumnsSupport,
  })

  const seedId = randomUUID()
  await runSeedDemoRpc(supabaseAdmin, tenantId)

  await updateTenantDemoFlags(supabaseAdmin, tenantId, {
    demo_seeded: true,
    demo_seed_id: seedId,
    demo_seeded_at: new Date().toISOString(),
  })

  return {
    deletedRows,
    seedId,
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
