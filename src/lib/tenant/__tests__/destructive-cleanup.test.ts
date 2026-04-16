import { describe, expect, it } from 'vitest'

import {
  deleteTenantScopedData,
  DELETE_TARGET_ANALYTICS,
  TENANT_DESTRUCTIVE_CLEANUP_SCOPES,
  TENANT_SCOPED_DELETE_ORDER,
  type TenantCleanupDeleteTarget,
  TenantCleanupError,
} from '@/lib/tenant/destructive-cleanup'

type MockDbError = { message: string; code?: string }

function makeAdminClientMock(options: {
  deleteFailures?: Partial<Record<TenantCleanupDeleteTarget, MockDbError>>
  countByTarget?: Partial<Record<TenantCleanupDeleteTarget, number>>
  countFailures?: Partial<Record<TenantCleanupDeleteTarget, MockDbError>>
} = {}) {
  const deleteCalls: TenantCleanupDeleteTarget[] = []
  const countCalls: TenantCleanupDeleteTarget[] = []

  const admin = {
    from: (target: TenantCleanupDeleteTarget) => ({
      delete: () => ({
        eq: async () => {
          deleteCalls.push(target)
          const err = options.deleteFailures?.[target] ?? null
          return { error: err }
        },
      }),
      select: () => ({
        eq: async () => {
          countCalls.push(target)
          const err = options.countFailures?.[target] ?? null
          if (err) return { count: null, error: err }
          return { count: options.countByTarget?.[target] ?? 0, error: null }
        },
      }),
    }),
  }

  return { admin, deleteCalls, countCalls }
}

describe('tenant destructive cleanup helper', () => {
  it('scope-urile farm_reset și gdpr_farm_delete rulează același plan canonic', async () => {
    const farmMock = makeAdminClientMock()
    await deleteTenantScopedData(farmMock.admin as never, 'tenant-1', {
      scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.farmReset,
      verifyCriticalTables: false,
    })

    const gdprMock = makeAdminClientMock()
    await deleteTenantScopedData(gdprMock.admin as never, 'tenant-1', {
      scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.gdprFarmDelete,
      verifyCriticalTables: false,
    })

    const expectedPlan = [...TENANT_SCOPED_DELETE_ORDER, DELETE_TARGET_ANALYTICS]
    expect(farmMock.deleteCalls).toEqual(expectedPlan)
    expect(gdprMock.deleteCalls).toEqual(expectedPlan)
  })

  it('oprește execuția când eșuează o ștergere critică', async () => {
    const mock = makeAdminClientMock({
      deleteFailures: {
        comenzi: { message: 'permission denied' },
      },
    })

    await expect(
      deleteTenantScopedData(mock.admin as never, 'tenant-2', {
        scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.farmReset,
        verifyCriticalTables: false,
      }),
    ).rejects.toBeInstanceOf(TenantCleanupError)

    expect(mock.deleteCalls).toContain('comenzi')
    expect(mock.deleteCalls).not.toContain('vanzari_butasi')
  })

  it('tratează tabelele opționale lipsă ca skipped_missing_table', async () => {
    const mock = makeAdminClientMock({
      deleteFailures: {
        culture_stage_logs: { message: 'relation does not exist', code: 'PGRST205' },
      },
    })

    const result = await deleteTenantScopedData(mock.admin as never, 'tenant-3', {
      scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.farmReset,
      verifyCriticalTables: false,
    })

    expect(result.criticalFailure).toBe(false)
    const optionalStep = result.steps.find((step) => step.target === 'culture_stage_logs')
    expect(optionalStep?.status).toBe('skipped_missing_table')
  })

  it('verificarea post-cleanup detectează rezidual pe tabele critice', async () => {
    const mock = makeAdminClientMock({
      countByTarget: {
        comenzi: 2,
      },
    })

    await expect(
      deleteTenantScopedData(mock.admin as never, 'tenant-4', {
        scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.farmReset,
        verifyCriticalTables: true,
      }),
    ).rejects.toBeInstanceOf(TenantCleanupError)

    expect(mock.countCalls).toContain('comenzi')
  })
})
