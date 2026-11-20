import { describe, expect, it } from 'vitest'

import {
  deleteTenantScopedData,
  DELETE_TARGET_ANALYTICS,
  TENANT_DESTRUCTIVE_CLEANUP_SCOPES,
  TENANT_SCOPED_DELETE_ORDER,
  TREATMENT_CHAIN_DELETE_ORDER,
  type TenantCleanupDeleteTarget,
  TenantCleanupError,
} from '@/lib/tenant/destructive-cleanup'
import { DEMO_ONLY_DELETE_ORDER } from '@/lib/tenant/demo-cleanup-server'

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
  it('farm_reset: lanțul de tratamente și legăturile magazin → comandă pleacă înainte de lista comună', async () => {
    const farmMock = makeAdminClientMock()
    await deleteTenantScopedData(farmMock.admin as never, 'tenant-1', {
      scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.farmReset,
      verifyCriticalTables: false,
    })

    expect(farmMock.deleteCalls).toEqual([
      ...TREATMENT_CHAIN_DELETE_ORDER,
      'shop_order_erp_links',
      ...TENANT_SCOPED_DELETE_ORDER,
      DELETE_TARGET_ANALYTICS,
    ])
    // Comenzile din magazin rămân la resetare.
    expect(farmMock.deleteCalls).not.toContain('shop_orders')
    expect(farmMock.deleteCalls).not.toContain('association_product_offers')
  })

  it('gdpr_farm_delete: șterge și comenzile din magazin și ofertele către asociație', async () => {
    const gdprMock = makeAdminClientMock()
    await deleteTenantScopedData(gdprMock.admin as never, 'tenant-1', {
      scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.gdprFarmDelete,
      verifyCriticalTables: false,
    })

    expect(gdprMock.deleteCalls).toEqual([
      ...TREATMENT_CHAIN_DELETE_ORDER,
      'shop_order_erp_links',
      'shop_orders',
      'association_product_offers',
      ...TENANT_SCOPED_DELETE_ORDER,
      DELETE_TARGET_ANALYTICS,
    ])
  })

  it('ordinea respectă cheile: copiii RESTRICT / NO ACTION înaintea părinților', async () => {
    for (const scope of [TENANT_DESTRUCTIVE_CLEANUP_SCOPES.farmReset, TENANT_DESTRUCTIVE_CLEANUP_SCOPES.gdprFarmDelete]) {
      const mock = makeAdminClientMock()
      await deleteTenantScopedData(mock.admin as never, 'tenant-1', { scope, verifyCriticalTables: false })
      const at = (target: TenantCleanupDeleteTarget) => mock.deleteCalls.indexOf(target)
      // RESTRICT spre parcele
      expect(at('aplicari_tratament')).toBeLessThan(at('parcele'))
      expect(at('capcane_montate')).toBeLessThan(at('parcele'))
      // RESTRICT spre produse_fitosanitare și planuri_tratament
      for (const child of ['aplicari_tratament', 'aplicari_tratament_produse', 'planuri_tratament_linii', 'planuri_tratament_linie_produse'] as const) {
        expect(at(child)).toBeLessThan(at('produse_fitosanitare'))
      }
      expect(at('parcele_planuri')).toBeLessThan(at('planuri_tratament'))
      // NO ACTION spre comenzi
      expect(at('shop_order_erp_links')).toBeLessThan(at('comenzi'))
      if (scope === TENANT_DESTRUCTIVE_CLEANUP_SCOPES.gdprFarmDelete) {
        expect(at('shop_order_erp_links')).toBeLessThan(at('shop_orders'))
      }
    }
  })

  it('verifică după ștergere și tabelele noi din lanț', async () => {
    const mock = makeAdminClientMock({ countByTarget: { aplicari_tratament: 2 } })
    await expect(
      deleteTenantScopedData(mock.admin as never, 'tenant-1', {
        scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.farmReset,
        verifyCriticalTables: true,
      }),
    ).rejects.toBeInstanceOf(TenantCleanupError)
    expect(mock.countCalls[0]).toBe('aplicari_tratament_produse')
  })

  it('demo_tenant_cleanup rămâne pe planul comun, fără lanțul de tratamente', async () => {
    const demoMock = makeAdminClientMock()
    await deleteTenantScopedData(demoMock.admin as never, 'tenant-1', {
      scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.demoTenantCleanup,
      verifyCriticalTables: false,
    })
    expect(demoMock.deleteCalls).toEqual([...TENANT_SCOPED_DELETE_ORDER, DELETE_TARGET_ANALYTICS])
    expect(DEMO_ONLY_DELETE_ORDER).toEqual([
      'aplicari_tratament_produse',
      'capcane_verificari',
      'capcane_montate',
      'aplicari_tratament',
      'parcele_planuri',
      'planuri_tratament_linie_produse',
      'planuri_tratament_linii',
      'planuri_tratament',
      'produse_fitosanitare',
      'ai_usage_log',
    ])
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
