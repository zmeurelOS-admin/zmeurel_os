import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

export const TENANT_SCOPED_DELETE_ORDER = [
  'vanzari_butasi_items',
  'miscari_stoc',
  'alert_dismissals',
  'integrations_google_contacts',
  'comenzi',
  'culture_stage_logs',
  'solar_climate_logs',
  'activitati_extra_season',
  'vanzari_butasi',
  'vanzari',
  'recoltari',
  'cheltuieli_diverse',
  'activitati_agricole',
  'culturi',
  'investitii',
  'nomenclatoare',
  'clienti',
  'culegatori',
  'crop_varieties',
  'crops',
  'parcele',
] as const

export type TenantScopedDeleteTable = (typeof TENANT_SCOPED_DELETE_ORDER)[number]

/**
 * Lanțul de tratamente și capcane, copil → părinte. Are chei `ON DELETE RESTRICT` spre `parcele`,
 * `produse_fitosanitare` și `planuri_tratament`: lista comună șterge `parcele` explicit, așa că aceste rânduri
 * trebuie să plece înainte. (Toate au și `tenant_id ... ON DELETE CASCADE`, dar RESTRICT se verifică imediat.)
 * Inventar refăcut din `pg_constraint` pe 21.11.2026.
 */
export const TREATMENT_CHAIN_DELETE_ORDER = [
  'aplicari_tratament_produse',
  'capcane_verificari',
  'capcane_montate',
  'aplicari_tratament',
  'parcele_planuri',
  'planuri_tratament_linie_produse',
  'planuri_tratament_linii',
  'planuri_tratament',
  'produse_fitosanitare',
] as const
export type TreatmentChainDeleteTable = (typeof TREATMENT_CHAIN_DELETE_ORDER)[number]

/** `shop_order_erp_links.comanda_id` → `comenzi` e `NO ACTION`: legătura pleacă înainte de `comenzi`. */
export const DELETE_TARGET_SHOP_ORDER_LINKS = 'shop_order_erp_links' as const
/** Doar la ștergerea GDPR: comenzile din magazin ale fermei și ofertele ei către asociație. */
export const GDPR_ONLY_DELETE_ORDER = ['shop_orders', 'association_product_offers'] as const
export type GdprOnlyDeleteTable = (typeof GDPR_ONLY_DELETE_ORDER)[number]

export const DELETE_TARGET_ANALYTICS = 'analytics_events' as const
export type TenantCleanupDeleteTarget =
  | TenantScopedDeleteTable
  | TreatmentChainDeleteTable
  | typeof DELETE_TARGET_SHOP_ORDER_LINKS
  | GdprOnlyDeleteTable
  | typeof DELETE_TARGET_ANALYTICS

export const TENANT_DESTRUCTIVE_CLEANUP_SCOPES = {
  farmReset: 'farm_reset',
  gdprFarmDelete: 'gdpr_farm_delete',
  demoTenantCleanup: 'demo_tenant_cleanup',
} as const
export type TenantDestructiveCleanupScope =
  (typeof TENANT_DESTRUCTIVE_CLEANUP_SCOPES)[keyof typeof TENANT_DESTRUCTIVE_CLEANUP_SCOPES]

export type CleanupStepDefinition = {
  target: TenantCleanupDeleteTarget
  critical: boolean
  allowMissingTable?: boolean
}

const OPTIONAL_TENANT_TABLES = new Set<TenantScopedDeleteTable>([
  'culture_stage_logs',
  'solar_climate_logs',
  'activitati_extra_season',
  'culturi',
  'nomenclatoare',
  'crop_varieties',
  'crops',
])

const CANONICAL_OPERATIONAL_STEPS: CleanupStepDefinition[] = [
  ...TENANT_SCOPED_DELETE_ORDER.map((table) => ({
    target: table,
    critical: !OPTIONAL_TENANT_TABLES.has(table),
    allowMissingTable: OPTIONAL_TENANT_TABLES.has(table),
  })),
  {
    target: DELETE_TARGET_ANALYTICS,
    critical: true,
  },
]

export type TenantCleanupStepResult = {
  target: TenantCleanupDeleteTarget
  critical: boolean
  status: 'deleted' | 'skipped_missing_table' | 'failed'
  error?: string
}

export type TenantCleanupVerificationResult = {
  target: TenantCleanupDeleteTarget
  critical: boolean
  status: 'empty' | 'residual_rows' | 'failed'
  remainingRows?: number
  error?: string
}

export type TenantCleanupResult = {
  tenantId: string
  scope: TenantDestructiveCleanupScope
  steps: TenantCleanupStepResult[]
  verification: TenantCleanupVerificationResult[]
  complete: boolean
  criticalFailure: boolean
  nonCriticalFailure: boolean
}

export class TenantCleanupError extends Error {
  result: TenantCleanupResult

  constructor(message: string, result: TenantCleanupResult) {
    super(message)
    this.name = 'TenantCleanupError'
    this.result = result
  }
}

type AdminClient = SupabaseClient<Database>

function isMissingTableError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null
  if (!candidate) return false
  if (candidate.code === 'PGRST205' || candidate.code === '42P01') return true
  const message = (candidate.message ?? '').toLowerCase()
  return message.includes('does not exist') || message.includes('relation') || message.includes('could not find')
}

function criticalStep(target: TenantCleanupDeleteTarget): CleanupStepDefinition {
  return { target, critical: true }
}

/**
 * Resetarea fermei și ștergerea GDPR sunt cerute explicit de om și trebuie să șteargă toate datele fermei:
 * întâi lanțul de tratamente (RESTRICT spre `parcele`) și legăturile magazin → comandă (NO ACTION spre
 * `comenzi`), apoi lista comună.
 *
 * - `farm_reset`: comenzile din magazin (`shop_orders`) rămân; pleacă doar legătura lor cu `comenzi`.
 * - `gdpr_farm_delete`: pleacă și `shop_orders` (după legături) și `association_product_offers`.
 * - `demo_tenant_cleanup`: neschimbat. Lanțul de tratamente îl șterge `demo-cleanup-server.ts` înainte.
 */
const FARM_RESET_STEPS: CleanupStepDefinition[] = [
  ...TREATMENT_CHAIN_DELETE_ORDER.map(criticalStep),
  criticalStep(DELETE_TARGET_SHOP_ORDER_LINKS),
  ...CANONICAL_OPERATIONAL_STEPS,
]

const GDPR_FARM_DELETE_STEPS: CleanupStepDefinition[] = [
  ...TREATMENT_CHAIN_DELETE_ORDER.map(criticalStep),
  criticalStep(DELETE_TARGET_SHOP_ORDER_LINKS),
  ...GDPR_ONLY_DELETE_ORDER.map(criticalStep),
  ...CANONICAL_OPERATIONAL_STEPS,
]

export function getScopeSteps(scope: TenantDestructiveCleanupScope): CleanupStepDefinition[] {
  switch (scope) {
    case TENANT_DESTRUCTIVE_CLEANUP_SCOPES.farmReset:
      return FARM_RESET_STEPS
    case TENANT_DESTRUCTIVE_CLEANUP_SCOPES.gdprFarmDelete:
      return GDPR_FARM_DELETE_STEPS
    default:
      return CANONICAL_OPERATIONAL_STEPS
  }
}

async function deleteTargetRows(admin: AdminClient, target: TenantCleanupDeleteTarget, tenantId: string) {
  const { error } = await admin.from(target).delete().eq('tenant_id', tenantId)
  if (error) {
    throw error
  }
}

async function countRowsByTenant(
  admin: AdminClient,
  target: TenantCleanupDeleteTarget,
  tenantId: string
): Promise<number> {
  const { count, error } = await admin
    .from(target)
    .select('tenant_id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  if (error) {
    throw error
  }

  return count ?? 0
}

function buildInitialResult(tenantId: string, scope: TenantDestructiveCleanupScope): TenantCleanupResult {
  return {
    tenantId,
    scope,
    steps: [],
    verification: [],
    complete: true,
    criticalFailure: false,
    nonCriticalFailure: false,
  }
}

function finalizeCompleteness(result: TenantCleanupResult) {
  const hasFailedStep = result.steps.some((step) => step.status === 'failed')
  const hasFailedVerification = result.verification.some(
    (check) => check.status === 'failed' || check.status === 'residual_rows'
  )

  result.complete = !(hasFailedStep || hasFailedVerification)
}

export async function deleteTenantScopedData(
  admin: AdminClient,
  tenantId: string,
  options: {
    scope?: TenantDestructiveCleanupScope
    verifyCriticalTables?: boolean
  } = {}
) {
  const scope = options.scope ?? TENANT_DESTRUCTIVE_CLEANUP_SCOPES.farmReset
  const verifyCriticalTables = options.verifyCriticalTables ?? true
  const result = buildInitialResult(tenantId, scope)
  const steps = getScopeSteps(scope)

  for (const step of steps) {
    try {
      await deleteTargetRows(admin, step.target, tenantId)
      result.steps.push({
        target: step.target,
        critical: step.critical,
        status: 'deleted',
      })
    } catch (error) {
      if (step.allowMissingTable && isMissingTableError(error)) {
        result.steps.push({
          target: step.target,
          critical: step.critical,
          status: 'skipped_missing_table',
        })
        continue
      }

      const message = error instanceof Error ? error.message : 'Unknown error'
      result.steps.push({
        target: step.target,
        critical: step.critical,
        status: 'failed',
        error: message,
      })

      if (step.critical) {
        result.criticalFailure = true
        result.complete = false
        throw new TenantCleanupError(`Delete failed for ${step.target}`, result)
      }

      result.nonCriticalFailure = true
    }
  }

  if (verifyCriticalTables) {
    for (const step of steps) {
      if (!step.critical) continue
      try {
        const remainingRows = await countRowsByTenant(admin, step.target, tenantId)
        if (remainingRows > 0) {
          result.verification.push({
            target: step.target,
            critical: step.critical,
            status: 'residual_rows',
            remainingRows,
          })
          result.criticalFailure = true
          result.complete = false
          throw new TenantCleanupError(`Cleanup verification failed for ${step.target}`, result)
        }

        result.verification.push({
          target: step.target,
          critical: step.critical,
          status: 'empty',
          remainingRows: 0,
        })
      } catch (error) {
        if (error instanceof TenantCleanupError) {
          throw error
        }

        const message = error instanceof Error ? error.message : 'Unknown error'
        result.verification.push({
          target: step.target,
          critical: step.critical,
          status: 'failed',
          error: message,
        })
        result.criticalFailure = true
        result.complete = false
        throw new TenantCleanupError(`Cleanup verification failed for ${step.target}`, result)
      }
    }
  }

  finalizeCompleteness(result)
  return result
}

export async function deleteTenantScopedDataBatch(
  admin: AdminClient,
  tenantIds: string[],
  onError?: (table: TenantCleanupDeleteTarget, error: Error) => void,
  options: {
    scope?: TenantDestructiveCleanupScope
    verifyCriticalTables?: boolean
  } = {}
) {
  if (tenantIds.length === 0) return []

  const results: TenantCleanupResult[] = []
  for (const tenantId of tenantIds) {
    try {
      const result = await deleteTenantScopedData(admin, tenantId, options)
      results.push(result)
    } catch (error) {
      if (error instanceof TenantCleanupError) {
        results.push(error.result)
        for (const step of error.result.steps) {
          if (step.status === 'failed') {
            onError?.(step.target, new Error(step.error ?? 'Unknown error'))
          }
        }
        for (const check of error.result.verification) {
          if (check.status === 'failed' || check.status === 'residual_rows') {
            const message =
              check.status === 'residual_rows'
                ? `Residual rows detected: ${check.remainingRows ?? 0}`
                : check.error ?? 'Unknown error'
            onError?.(check.target, new Error(message))
          }
        }
        continue
      }
      throw error
    }
  }

  return results
}
