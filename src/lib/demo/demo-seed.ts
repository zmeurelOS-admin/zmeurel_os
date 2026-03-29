import { DEMO_DATA_ORIGIN, DEMO_SEED_ID } from '@/lib/demo/demo-constants'
import { buildDemoDates } from '@/lib/demo/demo-fixtures'
import type { TenantDemoContext } from '@/lib/demo/demo-seed-service'
import { createServiceRoleClient } from '@/lib/supabase/admin'

type DemoType = 'berries' | 'solar'
type SeedStatus = 'seeded' | 'already_seeded'
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
type QueryError = { code?: string; message?: string } | null
type SelectResult<T> = Promise<{ data: T[] | null; error: QueryError }>
type SelectBuilder<T> = {
  eq: (column: string, value: string) => SelectBuilder<T>
  in: (column: string, values: string[]) => SelectBuilder<T>
  ilike: (column: string, pattern: string) => SelectBuilder<T>
  limit: (value: number) => SelectResult<T>
}
type TableSelector<T> = {
  select: (columns: string) => SelectBuilder<T>
}
type UpdateBuilder = Promise<{ error: QueryError }> & {
  eq: (column: string, value: string) => UpdateBuilder
  in: (column: string, values: string[]) => UpdateBuilder
  ilike: (column: string, pattern: string) => UpdateBuilder
}
type TableUpdater = {
  update: (values: Record<string, unknown>) => UpdateBuilder
}
type DateDemoTable = 'activitati_agricole' | 'recoltari' | 'vanzari' | 'comenzi'

const FALLBACK_FIXTURE_TAG = '[DEMO_FIXTURE_FALLBACK]'
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

type FallbackParcelaRow = {
  id_parcela: string
  nume_parcela: string
  an_plantare: number
  suprafata_m2: number
  nr_plante: number
  status: string
  tip_fruct: string
  observatii: string
}

type FallbackClientRow = {
  id_client: string
  nume_client: string
  telefon: string
  email: string
  adresa: string
  pret_negociat_lei_kg: number
  observatii: string
}

function isDemoType(value: unknown): value is DemoType {
  return value === 'berries' || value === 'solar'
}

function isClientNameColumnMismatch(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('clienti') &&
    normalized.includes('column') &&
    normalized.includes('nume') &&
    normalized.includes('does not exist')
  )
}

function normalizeSeedStatus(status: unknown): SeedStatus {
  if (status === 'already_seeded' || status === 'skipped_existing_data') {
    return 'already_seeded'
  }
  return 'seeded'
}

function isSchemaMismatchError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === 'PGRST204' || error.code === 'PGRST205' || error.code === '42703' || error.code === '42P01') {
    return true
  }

  const normalized = (error.message ?? '').toLowerCase()
  return (
    (normalized.includes('column') || normalized.includes('relation')) &&
    normalized.includes('does not exist')
  )
}

function logSeedDuration(start: number) {
  void start
}

function buildFallbackRows(tenantId: string, demoType: DemoType): {
  parcele: FallbackParcelaRow[]
  clienti: FallbackClientRow[]
} {
  const seedCode = tenantId.replace(/-/g, '').slice(0, 6).toUpperCase()
  const year = new Date().getFullYear()
  const fixtureTag = FALLBACK_FIXTURE_TAG

  if (demoType === 'solar') {
    return {
      parcele: [
        {
          id_parcela: `DEMO-PAR-${seedCode}-01`,
          nume_parcela: 'Solar Demo Rosii',
          an_plantare: year,
          suprafata_m2: 420,
          nr_plante: 680,
          status: 'Activ',
          tip_fruct: 'Legume',
          observatii: `${fixtureTag} Parcela solar demo`,
        },
        {
          id_parcela: `DEMO-PAR-${seedCode}-02`,
          nume_parcela: 'Solar Demo Castraveti',
          an_plantare: year,
          suprafata_m2: 380,
          nr_plante: 620,
          status: 'Activ',
          tip_fruct: 'Legume',
          observatii: `${fixtureTag} Parcela solar demo`,
        },
      ],
      clienti: [
        {
          id_client: `DEMO-CLI-${seedCode}-01`,
          nume_client: 'Bistro Verde',
          telefon: '0740100200',
          email: 'bistro@example.ro',
          adresa: 'Suceava',
          pret_negociat_lei_kg: 16,
          observatii: `${fixtureTag} Client demo`,
        },
        {
          id_client: `DEMO-CLI-${seedCode}-02`,
          nume_client: 'Magazin de proximitate',
          telefon: '0740300400',
          email: 'magazin@example.ro',
          adresa: 'Radauti',
          pret_negociat_lei_kg: 14,
          observatii: `${fixtureTag} Client demo`,
        },
      ],
    }
  }

  return {
    parcele: [
      {
        id_parcela: `DEMO-PAR-${seedCode}-01`,
        nume_parcela: 'Zmeura Delniwa Demo',
        an_plantare: year - 1,
        suprafata_m2: 1200,
        nr_plante: 920,
        status: 'Activ',
        tip_fruct: 'Zmeura',
        observatii: `${fixtureTag} Parcela berries demo`,
      },
      {
        id_parcela: `DEMO-PAR-${seedCode}-02`,
        nume_parcela: 'Zmeura Maravilla Demo',
        an_plantare: year - 2,
        suprafata_m2: 1350,
        nr_plante: 1050,
        status: 'Activ',
        tip_fruct: 'Zmeura',
        observatii: `${fixtureTag} Parcela berries demo`,
      },
    ],
    clienti: [
      {
        id_client: `DEMO-CLI-${seedCode}-01`,
        nume_client: 'Cofetaria Sweet',
        telefon: '0740100200',
        email: 'sweet@example.ro',
        adresa: 'Suceava',
        pret_negociat_lei_kg: 25,
        observatii: `${fixtureTag} Client demo`,
      },
      {
        id_client: `DEMO-CLI-${seedCode}-02`,
        nume_client: 'Magazin Local',
        telefon: '0740300400',
        email: 'magazin@example.ro',
        adresa: 'Radauti',
        pret_negociat_lei_kg: 23,
        observatii: `${fixtureTag} Client demo`,
      },
    ],
  }
}

async function hasStableDemoParcela(tenantId: string, demoSeedId: string): Promise<boolean> {
  const admin = createServiceRoleClient()
  const { data, error } = await ((admin.from('parcele') as unknown) as TableSelector<{ id: string }>)
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('demo_seed_id', demoSeedId)
    .limit(1)

  if (error) {
    if (isSchemaMismatchError(error)) return false
    throw new Error(`Stable demo parcela check failed: ${error.message ?? 'Unknown error'}`)
  }

  return (data?.length ?? 0) > 0
}

async function hasLegacyDemoParcela(tenantId: string, fallbackParcelaIds: string[]): Promise<boolean> {
  const admin = createServiceRoleClient()

  const { data: demoOriginRows, error: demoOriginError } = await ((admin.from('parcele') as unknown) as TableSelector<{ id: string }>)
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('data_origin', DEMO_DATA_ORIGIN)
    .limit(1)

  if (demoOriginError && !isSchemaMismatchError(demoOriginError)) {
    throw new Error(`Legacy demo parcela check failed: ${demoOriginError.message ?? 'Unknown error'}`)
  }

  if ((demoOriginRows?.length ?? 0) > 0) {
    return true
  }

  if (fallbackParcelaIds.length > 0) {
    const { data: fallbackIdRows, error: fallbackIdError } = await ((admin.from('parcele') as unknown) as TableSelector<{ id: string }>)
      .select('id')
      .eq('tenant_id', tenantId)
      .in('id_parcela', fallbackParcelaIds)
      .limit(1)

    if (fallbackIdError) {
      throw new Error(`Fallback parcela id check failed: ${fallbackIdError.message ?? 'Unknown error'}`)
    }

    if ((fallbackIdRows?.length ?? 0) > 0) {
      return true
    }
  }

  const { data: fallbackTagRows, error: fallbackTagError } = await ((admin.from('parcele') as unknown) as TableSelector<{ id: string }>)
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('observatii', `%${FALLBACK_FIXTURE_TAG}%`)
    .limit(1)

  if (fallbackTagError) {
    throw new Error(`Fallback parcela tag check failed: ${fallbackTagError.message ?? 'Unknown error'}`)
  }

  return (fallbackTagRows?.length ?? 0) > 0
}

async function verifySeededDemoParcela(
  tenantId: string,
  demoSeedId: string,
  fallbackParcelaIds: string[]
): Promise<boolean> {
  if (await hasStableDemoParcela(tenantId, demoSeedId)) {
    return true
  }

  return hasLegacyDemoParcela(tenantId, fallbackParcelaIds)
}

async function hasAnyParcela(tenantId: string): Promise<boolean> {
  const admin = createServiceRoleClient()
  const { data, error } = await ((admin.from('parcele') as unknown) as TableSelector<{ id: string }>)
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)

  if (error) {
    throw new Error(`Existing parcela check failed: ${error.message ?? 'Unknown error'}`)
  }

  return (data?.length ?? 0) > 0
}

async function updateTenantDemoState(tenantId: string, seeded: boolean, demoSeedId: string | null): Promise<void> {
  const admin = createServiceRoleClient()
  const { error } = await ((admin.from('tenants') as unknown) as TableUpdater)
    .update({
      demo_seeded: seeded,
      demo_seed_id: demoSeedId,
      demo_seeded_at: seeded ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId)

  if (error) {
    throw new Error(`Tenant demo state update failed: ${error.message ?? 'Unknown error'}`)
  }
}

async function normalizeDemoRowsByOrigin(tenantId: string, demoSeedId: string): Promise<void> {
  const admin = createServiceRoleClient()

  for (const table of DEMO_TABLES) {
    const { error } = await ((admin.from(table) as unknown) as TableUpdater)
      .update({
        demo_seed_id: demoSeedId,
        data_origin: DEMO_DATA_ORIGIN,
      })
      .eq('tenant_id', tenantId)
      .eq('data_origin', DEMO_DATA_ORIGIN)

    if (error && !isSchemaMismatchError(error)) {
      throw new Error(`Demo row normalization failed for ${table}: ${error.message ?? 'Unknown error'}`)
    }
  }
}

async function normalizeFallbackRows(
  tenantId: string,
  demoSeedId: string,
  rows: ReturnType<typeof buildFallbackRows>
): Promise<void> {
  const admin = createServiceRoleClient()

  const { error: parcelaIdError } = await ((admin.from('parcele') as unknown) as TableUpdater)
    .update({
      demo_seed_id: demoSeedId,
      data_origin: DEMO_DATA_ORIGIN,
    })
    .eq('tenant_id', tenantId)
    .in('id_parcela', rows.parcele.map((row) => row.id_parcela))

  if (parcelaIdError && !isSchemaMismatchError(parcelaIdError)) {
    throw new Error(`Fallback parcela normalization failed: ${parcelaIdError.message ?? 'Unknown error'}`)
  }

  const { error: parcelaTagError } = await ((admin.from('parcele') as unknown) as TableUpdater)
    .update({
      demo_seed_id: demoSeedId,
      data_origin: DEMO_DATA_ORIGIN,
    })
    .eq('tenant_id', tenantId)
    .ilike('observatii', `%${FALLBACK_FIXTURE_TAG}%`)

  if (parcelaTagError && !isSchemaMismatchError(parcelaTagError)) {
    throw new Error(`Fallback parcela tag normalization failed: ${parcelaTagError.message ?? 'Unknown error'}`)
  }

  const { error: clientIdError } = await ((admin.from('clienti') as unknown) as TableUpdater)
    .update({
      demo_seed_id: demoSeedId,
      data_origin: DEMO_DATA_ORIGIN,
    })
    .eq('tenant_id', tenantId)
    .in('id_client', rows.clienti.map((row) => row.id_client))

  if (clientIdError && !isSchemaMismatchError(clientIdError)) {
    throw new Error(`Fallback clienti normalization failed: ${clientIdError.message ?? 'Unknown error'}`)
  }

  const { error: clientTagError } = await ((admin.from('clienti') as unknown) as TableUpdater)
    .update({
      demo_seed_id: demoSeedId,
      data_origin: DEMO_DATA_ORIGIN,
    })
    .eq('tenant_id', tenantId)
    .ilike('observatii', `%${FALLBACK_FIXTURE_TAG}%`)

  if (clientTagError && !isSchemaMismatchError(clientTagError)) {
    throw new Error(`Fallback clienti tag normalization failed: ${clientTagError.message ?? 'Unknown error'}`)
  }
}

async function normalizeExistingDemoRows(
  tenantId: string,
  demoSeedId: string,
  rows: ReturnType<typeof buildFallbackRows>
): Promise<void> {
  await normalizeDemoRowsByOrigin(tenantId, demoSeedId)
  await normalizeFallbackRows(tenantId, demoSeedId, rows)
}

async function refreshDemoDates(tenantId: string, demoSeedId: string): Promise<void> {
  const admin = createServiceRoleClient()
  const dates = buildDemoDates()

  const updates: Array<{
    table: DateDemoTable
    values: Record<string, string>
  }> = [
    { table: 'activitati_agricole', values: { data_aplicare: dates.today.toISOString() } },
    { table: 'recoltari', values: { data: dates.yesterday.toISOString() } },
    { table: 'vanzari', values: { data: dates.today.toISOString() } },
    { table: 'comenzi', values: { data_comanda: dates.today.toISOString(), data_livrare: dates.tomorrow.toISOString() } },
  ]

  for (const update of updates) {
    const { error } = await ((admin.from(update.table) as unknown) as TableUpdater)
      .update(update.values)
      .eq('tenant_id', tenantId)
      .eq('data_origin', DEMO_DATA_ORIGIN)
      .eq('demo_seed_id', demoSeedId)

    if (error && !isSchemaMismatchError(error)) {
      throw new Error(`Demo date refresh failed for ${update.table}: ${error.message ?? 'Unknown error'}`)
    }
  }
}

async function seedFallbackRows(tenantId: string, demoType: DemoType, demoSeedId: string): Promise<void> {
  const admin = createServiceRoleClient()
  const rows = buildFallbackRows(tenantId, demoType)

  const { data: existingParcele, error: existingParceleError } = await admin
    .from('parcele')
    .select('id_parcela')
    .eq('tenant_id', tenantId)
    .in('id_parcela', rows.parcele.map((row) => row.id_parcela))

  if (existingParceleError) {
    throw new Error(`Fallback parcela check failed: ${existingParceleError.message ?? 'Unknown error'}`)
  }

  const existingParcelaIds = new Set((existingParcele ?? []).map((row) => row.id_parcela))
  const parceleToInsert = rows.parcele
    .filter((row) => !existingParcelaIds.has(row.id_parcela))
    .map((row) => ({
      ...row,
      tenant_id: tenantId,
      data_origin: DEMO_DATA_ORIGIN,
      demo_seed_id: demoSeedId,
    }))

  if (parceleToInsert.length > 0) {
    const { error: parcelaInsertError } = await admin.from('parcele').insert(parceleToInsert)
    if (parcelaInsertError) {
      throw new Error(`Fallback parcela insert failed: ${parcelaInsertError.message ?? 'Unknown error'}`)
    }
  }

  const { data: existingClienți, error: existingCliențiError } = await admin
    .from('clienti')
    .select('id_client')
    .eq('tenant_id', tenantId)
    .in('id_client', rows.clienti.map((row) => row.id_client))

  if (existingCliențiError) {
    throw new Error(`Fallback clienti check failed: ${existingCliențiError.message ?? 'Unknown error'}`)
  }

  const existingClientIds = new Set((existingClienți ?? []).map((row) => row.id_client))
  const clientiToInsert = rows.clienti
    .filter((row) => !existingClientIds.has(row.id_client))
    .map((row) => ({
      ...row,
      tenant_id: tenantId,
      data_origin: DEMO_DATA_ORIGIN,
      demo_seed_id: demoSeedId,
    }))

  if (clientiToInsert.length > 0) {
    const { error: clientiInsertError } = await admin.from('clienti').insert(clientiToInsert)
    if (clientiInsertError) {
      throw new Error(`Fallback clienti insert failed: ${clientiInsertError.message ?? 'Unknown error'}`)
    }
  }
}

async function resolveDemoType(request: Request): Promise<DemoType | null> {
  const url = new URL(request.url)
  const queryValue = url.searchParams.get('demo_type')

  if (queryValue !== null) {
    if (!isDemoType(queryValue)) {
      throw new InvalidDemoTypeError()
    }
    return queryValue
  }

  const body = await request.json().catch(() => null) as { demo_type?: unknown } | null
  if (body?.demo_type === undefined) return null

  if (!isDemoType(body.demo_type)) {
    throw new InvalidDemoTypeError()
  }

  return body.demo_type
}

export class InvalidDemoTypeError extends Error {
  constructor() {
    super('Invalid demo_type. Allowed values: berries, solar.')
    this.name = 'InvalidDemoTypeError'
  }
}

export type RunDemoSeedResult = {
  success: true
  status: SeedStatus
  demo_type: DemoType
  demo_seed_id: string
}

type RunDemoSeedParams = {
  request: Request
  tenant: TenantDemoContext
  userId: string
}

export async function runDemoSeed({ request, tenant, userId }: RunDemoSeedParams): Promise<RunDemoSeedResult> {
  const start = Date.now()
  const demoSeedId = DEMO_SEED_ID

  const demoType = await resolveDemoType(request)
  const normalizedDemoType = demoType ?? 'berries'
  const fallbackRows = buildFallbackRows(tenant.id, normalizedDemoType)
  const finish = (status: SeedStatus): RunDemoSeedResult => {
    logSeedDuration(start)
    return {
      success: true,
      status,
      demo_type: normalizedDemoType,
      demo_seed_id: demoSeedId,
    }
  }

  if (await hasStableDemoParcela(tenant.id, demoSeedId)) {
    await updateTenantDemoState(tenant.id, true, demoSeedId)
    await refreshDemoDates(tenant.id, demoSeedId)
    return finish('already_seeded')
  }

  if (await hasLegacyDemoParcela(tenant.id, fallbackRows.parcele.map((row) => row.id_parcela))) {
    await normalizeExistingDemoRows(tenant.id, demoSeedId, fallbackRows)
    if (await hasStableDemoParcela(tenant.id, demoSeedId)) {
      await updateTenantDemoState(tenant.id, true, demoSeedId)
      await refreshDemoDates(tenant.id, demoSeedId)
      return finish('already_seeded')
    }
  }

  if (await hasAnyParcela(tenant.id)) {
    return finish('already_seeded')
  }

  if (tenant.demo_seeded || tenant.demo_seed_id) {
    await updateTenantDemoState(tenant.id, false, null)
  }

  console.info('[demo-seed] seed start', {
    userId,
    tenantId: tenant.id,
    demoType: normalizedDemoType,
    demoSeedId,
  })

  const admin = createServiceRoleClient()
  const rpcArgs: { p_tenant_id: string; p_demo_type?: DemoType } = {
    p_tenant_id: tenant.id,
  }
  if (demoType !== null) {
    rpcArgs.p_demo_type = demoType
  }
  const rpcClient = admin as unknown as {
    rpc: (
      fn: string,
      args: { p_tenant_id: string; p_demo_type?: DemoType }
    ) => Promise<{ data?: { status?: string } | null; error: { message?: string } | null }>
  }

  const { data: seedData, error: seedError } = await rpcClient.rpc('seed_demo_for_tenant', {
    ...rpcArgs,
  })

  const seedErrorMessage = seedError?.message ?? ''
  const missingTypedRpc =
    seedErrorMessage.toLowerCase().includes('function') &&
    seedErrorMessage.toLowerCase().includes('seed_demo_for_tenant')

  if (seedError && missingTypedRpc) {
    const { data: legacyData, error: legacyError } = await rpcClient.rpc('seed_demo_for_tenant', {
      p_tenant_id: tenant.id,
    })
    if (legacyError) {
      throw new Error(`seed_demo_for_tenant failed: ${legacyError.message ?? 'Unknown error'}`)
    }

    await normalizeExistingDemoRows(tenant.id, demoSeedId, fallbackRows)
    await updateTenantDemoState(tenant.id, true, demoSeedId)
    await refreshDemoDates(tenant.id, demoSeedId)

    if (!(await verifySeededDemoParcela(tenant.id, demoSeedId, fallbackRows.parcele.map((row) => row.id_parcela)))) {
      throw new Error('Demo seed verification failed after legacy RPC path')
    }

    return finish(normalizeSeedStatus(legacyData?.status))
  }

  if (seedError && isClientNameColumnMismatch(seedErrorMessage)) {
    console.warn('[demo-seed] falling back to direct inserts due clienti column mismatch', {
      tenantId: tenant.id,
      seedErrorMessage,
    })

    await seedFallbackRows(tenant.id, normalizedDemoType, demoSeedId)
    await normalizeExistingDemoRows(tenant.id, demoSeedId, fallbackRows)
    await updateTenantDemoState(tenant.id, true, demoSeedId)
    await refreshDemoDates(tenant.id, demoSeedId)

    if (!(await verifySeededDemoParcela(tenant.id, demoSeedId, fallbackRows.parcele.map((row) => row.id_parcela)))) {
      throw new Error('Demo seed verification failed after fallback inserts')
    }

    return finish('seeded')
  } else if (seedError) {
    throw new Error(`seed_demo_for_tenant failed: ${seedError.message ?? 'Unknown error'}`)
  }

  await normalizeExistingDemoRows(tenant.id, demoSeedId, fallbackRows)
  await updateTenantDemoState(tenant.id, true, demoSeedId)
  await refreshDemoDates(tenant.id, demoSeedId)

  if (!(await verifySeededDemoParcela(tenant.id, demoSeedId, fallbackRows.parcele.map((row) => row.id_parcela)))) {
    throw new Error('Demo seed verification failed: no stable demo parcela marker found')
  }

  console.info('[demo-seed] seed success', {
    userId,
    tenantId: tenant.id,
    demoType: normalizedDemoType,
    demoSeedId,
  })

  return finish(normalizeSeedStatus(seedData?.status))
}
