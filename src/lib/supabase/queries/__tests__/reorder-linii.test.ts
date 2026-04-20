import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock, getTenantIdByUserIdMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getTenantIdByUserIdMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/tenant/get-tenant', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tenant/get-tenant')>('@/lib/tenant/get-tenant')
  return {
    ...actual,
    getTenantIdByUserId: getTenantIdByUserIdMock,
  }
})

import { reorderLiniiPlan } from '@/lib/supabase/queries/tratamente'

function createAwaitable<T>(result: T) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (onFulfilled?: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }

  return builder
}

describe('reorderLiniiPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reorder cu listă completă matching merge', async () => {
    const updateCalls: Array<{ ordine: number }> = []

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'planuri_tratament') {
          return createAwaitable({ data: { id: 'plan-1' }, error: null })
        }

        if (table === 'planuri_tratament_linii') {
          const builder = {
            select: vi.fn(() => builder),
            eq: vi.fn(() => builder),
            order: vi.fn(() => builder),
            update: vi.fn((payload: { ordine: number }) => {
              updateCalls.push(payload)
              return builder
            }),
            maybeSingle: vi.fn(async () => ({
              data: [
                { id: 'linie-1', plan_id: 'plan-1' },
                { id: 'linie-2', plan_id: 'plan-1' },
              ],
              error: null,
            })),
            single: vi.fn(async () => ({ data: null, error: null })),
            then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
              Promise.resolve({
                data: [
                  { id: 'linie-1', plan_id: 'plan-1' },
                  { id: 'linie-2', plan_id: 'plan-1' },
                ],
                error: null,
              }).then(onFulfilled, onRejected),
          }

          return builder
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')

    await reorderLiniiPlan('plan-1', ['linie-2', 'linie-1'])

    expect(updateCalls).toEqual([{ ordine: 1 }, { ordine: 2 }])
  })

  it('reorder cu listă parțială aruncă eroare', async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'planuri_tratament') {
          return createAwaitable({ data: { id: 'plan-1' }, error: null })
        }

        if (table === 'planuri_tratament_linii') {
          return {
            ...createAwaitable({
              data: [
                { id: 'linie-1', plan_id: 'plan-1' },
                { id: 'linie-2', plan_id: 'plan-1' },
              ],
              error: null,
            }),
            update: vi.fn(() => createAwaitable({ data: null, error: null })),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')

    await expect(reorderLiniiPlan('plan-1', ['linie-1'])).rejects.toThrow(
      'Ordinea liniilor invalidă: nu toate liniile au fost furnizate'
    )
  })

  it('reorder cu ID străin planului aruncă eroare', async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'planuri_tratament') {
          return createAwaitable({ data: { id: 'plan-1' }, error: null })
        }

        if (table === 'planuri_tratament_linii') {
          return {
            ...createAwaitable({
              data: [
                { id: 'linie-1', plan_id: 'plan-1' },
                { id: 'linie-2', plan_id: 'plan-1' },
              ],
              error: null,
            }),
            update: vi.fn(() => createAwaitable({ data: null, error: null })),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')

    await expect(reorderLiniiPlan('plan-1', ['linie-1', 'linie-x'])).rejects.toThrow(
      'Linia linie-x nu aparține planului'
    )
  })
})
