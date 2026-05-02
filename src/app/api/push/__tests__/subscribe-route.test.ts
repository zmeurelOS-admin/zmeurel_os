import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/push/subscribe/route'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => mocks.getSupabaseAdmin(),
}))

const USER_A = '11111111-1111-1111-1111-111111111111'
const USER_B = '22222222-2222-2222-2222-222222222222'
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc-123'

interface FakeRow {
  id: number
  user_id: string
  endpoint: string
  keys_p256dh: string
  keys_auth: string
}

interface Store {
  rows: FakeRow[]
  nextId: number
  adminCalls: { table: string; op: string; filters: Record<string, unknown> }[]
}

function makeStore(): Store {
  return { rows: [], nextId: 1, adminCalls: [] }
}

function buildSupabaseClient(userId: string | null, store: Store) {
  function tableHandler(table: string) {
    void table
    const filters: Record<string, unknown> = {}

    function thenable<T>(getResult: () => Promise<T>) {
      return { then: (resolve: (v: T) => unknown) => getResult().then(resolve) }
    }

    const builder: Record<string, unknown> = {}
    builder.select = () => builder
    builder.limit = () => builder
    builder.eq = (col: string, val: unknown) => {
      filters[col] = val
      return builder
    }
    builder.maybeSingle = async () => {
      const found = store.rows.find(
        (r) => r.user_id === filters.user_id && r.endpoint === filters.endpoint,
      )
      return found ? { data: { id: found.id }, error: null } : { data: null, error: null }
    }

    builder.update = (patch: Partial<FakeRow>) => {
      const updateFilters: Record<string, unknown> = {}
      const updateChain: Record<string, unknown> = {}
      const finalize = async () => {
        let target: FakeRow | undefined
        if (updateFilters.id !== undefined) {
          target = store.rows.find((r) => r.id === updateFilters.id)
        } else if (updateFilters.user_id && updateFilters.endpoint) {
          target = store.rows.find(
            (r) => r.user_id === updateFilters.user_id && r.endpoint === updateFilters.endpoint,
          )
        }
        if (target) Object.assign(target, patch)
        return { error: null }
      }
      updateChain.eq = (col: string, val: unknown) => {
        updateFilters[col] = val
        return Object.assign(updateChain, thenable(finalize))
      }
      return updateChain
    }

    builder.insert = async (payload: Omit<FakeRow, 'id'>) => {
      const exists = store.rows.find(
        (r) => r.user_id === payload.user_id && r.endpoint === payload.endpoint,
      )
      if (exists) return { error: { code: '23505' } }
      store.rows.push({ id: store.nextId++, ...payload })
      return { error: null }
    }

    return builder
  }

  return {
    auth: {
      getUser: async () => ({
        data: { user: userId ? { id: userId, email: 'u@example.com' } : null },
        error: null,
      }),
    },
    from: vi.fn(tableHandler),
  }
}

function buildAdminClient(store: Store) {
  return {
    from: (table: string) => ({
      delete: () => {
        const filters: { endpoint?: string; neq_user_id?: string } = {}
        const chain: Record<string, unknown> = {}
        const finalize = async () => {
          store.adminCalls.push({ table, op: 'delete', filters: { ...filters } })
          for (let i = store.rows.length - 1; i >= 0; i--) {
            if (
              store.rows[i].endpoint === filters.endpoint &&
              store.rows[i].user_id !== filters.neq_user_id
            ) {
              store.rows.splice(i, 1)
            }
          }
          return { error: null }
        }
        chain.eq = (col: string, val: string) => {
          if (col === 'endpoint') filters.endpoint = val
          return chain
        }
        chain.neq = (col: string, val: string) => {
          if (col === 'user_id') filters.neq_user_id = val
          return Object.assign(chain, {
            then: (resolve: (v: unknown) => unknown) => finalize().then(resolve),
          })
        }
        return chain
      },
    }),
  }
}

function payload() {
  return {
    subscription: {
      endpoint: ENDPOINT,
      keys: { p256dh: 'p256-key', auth: 'auth-key' },
    },
  }
}

describe('POST /api/push/subscribe', () => {
  let store: Store

  beforeEach(() => {
    vi.clearAllMocks()
    store = makeStore()
    mocks.getSupabaseAdmin.mockReturnValue(buildAdminClient(store))
  })

  it('respinge cu 401 când utilizatorul nu e autentificat', async () => {
    mocks.createClient.mockResolvedValue(buildSupabaseClient(null, store))
    const req = createSameOriginRequest('/api/push/subscribe', { method: 'POST', json: payload() })
    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(store.rows).toHaveLength(0)
  })

  it('happy path: utilizator nou se abonează → 1 rând în DB', async () => {
    mocks.createClient.mockResolvedValue(buildSupabaseClient(USER_A, store))
    const req = createSameOriginRequest('/api/push/subscribe', { method: 'POST', json: payload() })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0]).toMatchObject({ user_id: USER_A, endpoint: ENDPOINT })
  })

  it('re-subscribe același user este idempotent: rămâne 1 rând cu chei rotite', async () => {
    mocks.createClient.mockResolvedValue(buildSupabaseClient(USER_A, store))
    await POST(createSameOriginRequest('/api/push/subscribe', { method: 'POST', json: payload() }))
    const res = await POST(
      createSameOriginRequest('/api/push/subscribe', {
        method: 'POST',
        json: {
          subscription: { endpoint: ENDPOINT, keys: { p256dh: 'rotated-p256', auth: 'rotated-auth' } },
        },
      }),
    )
    expect(res.status).toBe(200)
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0]).toMatchObject({
      user_id: USER_A,
      endpoint: ENDPOINT,
      keys_p256dh: 'rotated-p256',
      keys_auth: 'rotated-auth',
    })
  })

  it('endpoint preluat: când B se abonează cu endpoint care era al lui A, rândul lui A este șters', async () => {
    mocks.createClient.mockResolvedValue(buildSupabaseClient(USER_A, store))
    await POST(createSameOriginRequest('/api/push/subscribe', { method: 'POST', json: payload() }))
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0].user_id).toBe(USER_A)

    mocks.createClient.mockResolvedValue(buildSupabaseClient(USER_B, store))
    const res = await POST(createSameOriginRequest('/api/push/subscribe', { method: 'POST', json: payload() }))
    expect(res.status).toBe(200)

    expect(store.rows).toHaveLength(1)
    expect(store.rows[0]).toMatchObject({ user_id: USER_B, endpoint: ENDPOINT })

    expect(store.adminCalls).toContainEqual({
      table: 'push_subscriptions',
      op: 'delete',
      filters: { endpoint: ENDPOINT, neq_user_id: USER_B },
    })
  })

  it('respinge body invalid cu 400', async () => {
    mocks.createClient.mockResolvedValue(buildSupabaseClient(USER_A, store))
    const req = createSameOriginRequest('/api/push/subscribe', { method: 'POST', json: { foo: 'bar' } })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
