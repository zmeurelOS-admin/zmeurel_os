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

import { countAplicariPlan } from '@/lib/supabase/queries/tratamente'

function createAwaitable<T>(result: T) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (onFulfilled?: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }

  return builder
}

describe('countAplicariPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('plan cu 0 linii întoarce 0 aplicări', async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'planuri_tratament') {
          return createAwaitable({ data: { id: 'plan-1' }, error: null })
        }
        if (table === 'planuri_tratament_linii') {
          return createAwaitable({ data: [], error: null })
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')

    await expect(countAplicariPlan('plan-1')).resolves.toBe(0)
  })

  it('plan cu linii dar fără aplicări întoarce 0', async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'planuri_tratament') {
          return createAwaitable({ data: { id: 'plan-1' }, error: null })
        }
        if (table === 'planuri_tratament_linii') {
          return createAwaitable({ data: [{ id: 'linie-1' }], error: null })
        }
        if (table === 'aplicari_tratament') {
          return createAwaitable({ count: 0, error: null })
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')

    await expect(countAplicariPlan('plan-1')).resolves.toBe(0)
  })

  it('plan cu aplicări întoarce count corect', async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'planuri_tratament') {
          return createAwaitable({ data: { id: 'plan-1' }, error: null })
        }
        if (table === 'planuri_tratament_linii') {
          return createAwaitable({ data: [{ id: 'linie-1' }, { id: 'linie-2' }], error: null })
        }
        if (table === 'aplicari_tratament') {
          return createAwaitable({ count: 3, error: null })
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')

    await expect(countAplicariPlan('plan-1')).resolves.toBe(3)
  })
})
