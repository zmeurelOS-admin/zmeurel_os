import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PlanSaveInput } from '@/lib/tratamente/import/types'

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  getTenantIdByUserId: vi.fn(),
}))

function createSupabaseMock(capturedRpcCalls: Array<{ name: string; args: unknown }>) {
  function makeResponse(table: string) {
    if (table === 'planuri_tratament') {
      return {
        data: {
          id: 'plan-1',
          tenant_id: 'tenant-1',
          nume: 'Plan skip test',
          cultura_tip: 'zmeur',
          descriere: 'Descriere',
          activ: true,
          arhivat: false,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          created_by: 'user-1',
          updated_by: 'user-1',
        },
        error: null,
      }
    }

    return { data: [], error: null }
  }

  function createQueryBuilder(table: string) {
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      in: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => makeResponse(table)),
      single: vi.fn(async () => makeResponse(table)),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(makeResponse(table)).then(onFulfilled, onRejected),
    }
    return builder
  }

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
      })),
    },
    rpc: vi.fn(async (name: string, args: unknown) => {
      capturedRpcCalls.push({ name, args })
      return {
        data: {
          plan: { id: 'plan-1' },
          linii: [],
          parcele_asociate: [],
        },
        error: null,
      }
    }),
    from: vi.fn((table: string) => createQueryBuilder(table)),
  }
}

describe('skip lines RPC contract', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.getTenantIdByUserId.mockResolvedValue('tenant-1')
  })

  it(
    'saveImportedPlansAction păstrează gap-ul de ordine 1 și 3 în p_linii la RPC',
    async () => {
      const capturedRpcCalls: Array<{ name: string; args: unknown }> = []
      const supabase = createSupabaseMock(capturedRpcCalls)

      vi.doMock('next/cache', () => ({
        revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
      }))
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: async () => supabase,
      }))
      vi.doMock('@/lib/tenant/get-tenant', () => ({
        getTenantIdByUserId: (...args: unknown[]) => mocks.getTenantIdByUserId(...args),
      }))

      const { saveImportedPlansAction } = await import(
        '@/app/(dashboard)/tratamente/planuri/import/actions'
      )

      const payload: PlanSaveInput[] = [
        {
          plan_metadata: {
            nume: 'Plan skip test',
            cultura_tip: 'zmeur',
            descriere: 'Descriere',
          },
          linii: [
            {
              ordine: 1,
              stadiu_trigger: 'umflare_muguri',
              produs_id: 'prod-1',
              produs_nume_manual: null,
              doza_ml_per_hl: 500,
              doza_l_per_ha: null,
              observatii: 'Linia 1',
            },
            {
              ordine: 3,
              stadiu_trigger: 'cadere_petale',
              produs_id: 'prod-3',
              produs_nume_manual: null,
              doza_ml_per_hl: 50,
              doza_l_per_ha: null,
              observatii: 'Linia 3',
            },
          ],
        },
      ]

      const result = await saveImportedPlansAction(payload, 2026)

      expect(result).toEqual({ success: 1, failed: [] })
      expect(capturedRpcCalls).toHaveLength(1)
      const rpcCall = capturedRpcCalls[0]
      expect(rpcCall?.name).toBe('upsert_plan_tratament_cu_linii')
      const rpcArgs = rpcCall?.args as { p_linii: Array<{ ordine: number }> }
      expect(rpcArgs.p_linii).toHaveLength(2)
      expect(rpcArgs.p_linii.map((line) => line.ordine)).toEqual([1, 3])
    },
    30_000
  )

  it(
    'saveImportedPlansAction nu aruncă eroare când payload-ul păstrează gap de ordine',
    async () => {
      const capturedRpcCalls: Array<{ name: string; args: unknown }> = []
      const supabase = createSupabaseMock(capturedRpcCalls)

      vi.doMock('next/cache', () => ({
        revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
      }))
      vi.doMock('@/lib/supabase/server', () => ({
        createClient: async () => supabase,
      }))
      vi.doMock('@/lib/tenant/get-tenant', () => ({
        getTenantIdByUserId: (...args: unknown[]) => mocks.getTenantIdByUserId(...args),
      }))

      const { saveImportedPlansAction } = await import(
        '@/app/(dashboard)/tratamente/planuri/import/actions'
      )

      const payload: PlanSaveInput[] = [
        {
          plan_metadata: {
            nume: 'Plan skip test',
            cultura_tip: 'zmeur',
            descriere: 'Descriere',
          },
          linii: [
            {
              ordine: 1,
              stadiu_trigger: 'umflare_muguri',
              produs_id: 'prod-1',
              produs_nume_manual: null,
              doza_ml_per_hl: 500,
              doza_l_per_ha: null,
              observatii: 'Linia 1',
            },
            {
              ordine: 3,
              stadiu_trigger: 'cadere_petale',
              produs_id: 'prod-3',
              produs_nume_manual: null,
              doza_ml_per_hl: 50,
              doza_l_per_ha: null,
              observatii: 'Linia 3',
            },
          ],
        },
      ]

      await expect(saveImportedPlansAction(payload, 2026)).resolves.toEqual({
        success: 1,
        failed: [],
      })
    },
    30_000
  )
})
