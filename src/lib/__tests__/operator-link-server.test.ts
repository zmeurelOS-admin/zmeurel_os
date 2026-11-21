import { beforeEach, describe, expect, it, vi } from 'vitest'

type Call = { table: string; op: string; payload?: unknown; filters: Array<[string, string, unknown]> }

const db = vi.hoisted(() => ({ calls: [] as Call[], updateRows: 1 }))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: (tableName: string) => {
      const call: Call = { table: tableName, op: 'select', filters: [] }
      db.calls.push(call)
      const chain: Record<string, unknown> = {}
      const filter = (kind: string) => (column: string, value: unknown) => {
        call.filters.push([kind, column, value])
        return chain
      }
      Object.assign(chain, {
        update: (payload: unknown) => {
          call.op = 'update'
          call.payload = payload
          return chain
        },
        insert: (payload: unknown) => {
          call.op = 'insert'
          call.payload = payload
          return Promise.resolve({ error: null })
        },
        eq: filter('eq'),
        is: filter('is'),
        gt: filter('gt'),
        select: () => Promise.resolve({ data: Array.from({ length: db.updateRows }, () => ({ id: 'inv-1' })), error: null }),
        then: (resolve: (value: unknown) => void) => resolve({ error: null }),
      })
      return chain
    },
  }),
}))

const row = {
  id: 'inv-1',
  tenant_id: 'tenant-1',
  token: '11111111-1111-4111-8111-111111111111',
  modules_access: [],
  created_by: 'owner-1',
  expires_at: '2099-01-01T00:00:00Z',
  used_at: null,
  used_by_user_id: null,
}

describe('claimOperatorLink', () => {
  beforeEach(() => {
    db.calls.length = 0
    db.updateRows = 1
  })

  it('marchează folosit doar dacă tokenul e exact, nefolosit și neexpirat', async () => {
    const { claimOperatorLink } = await import('@/lib/farm-members/operator-link-server')
    expect(await claimOperatorLink(row, null)).toBe(true)
    const call = db.calls[0]!
    expect(call.op).toBe('update')
    expect(call.filters).toEqual(
      expect.arrayContaining([
        ['eq', 'id', 'inv-1'],
        ['eq', 'token', row.token],
        ['is', 'used_at', null],
        ['is', 'used_by_user_id', null],
      ]),
    )
    expect(call.filters.some(([kind, column]) => kind === 'gt' && column === 'expires_at')).toBe(true)
  })

  it('reconectarea cere același utilizator', async () => {
    const { claimOperatorLink } = await import('@/lib/farm-members/operator-link-server')
    await claimOperatorLink({ ...row, used_by_user_id: 'op-1' }, 'op-1')
    expect(db.calls[0]!.filters).toContainEqual(['eq', 'used_by_user_id', 'op-1'])
  })

  it('niciun rând actualizat (deja folosit de cealaltă deschidere) → refuzat', async () => {
    db.updateRows = 0
    const { claimOperatorLink } = await import('@/lib/farm-members/operator-link-server')
    expect(await claimOperatorLink(row, null)).toBe(false)
  })
})

describe('createReconnectLink', () => {
  beforeEach(() => {
    db.calls.length = 0
  })

  it('linkurile vechi nefolosite ale aceluiași om expiră, cel nou e legat de același utilizator', async () => {
    const { createReconnectLink } = await import('@/lib/farm-members/operator-link-server')
    const link = await createReconnectLink({ tenantId: 'tenant-1', userId: 'op-1', createdBy: 'owner-1' })
    expect(link?.token).toMatch(/^[0-9a-f-]{36}$/)
    const [expire, insert] = db.calls
    expect(expire!.op).toBe('update')
    expect(expire!.filters).toEqual(
      expect.arrayContaining([
        ['eq', 'tenant_id', 'tenant-1'],
        ['eq', 'used_by_user_id', 'op-1'],
        ['is', 'used_at', null],
      ]),
    )
    expect(insert!.op).toBe('insert')
    expect(insert!.payload).toMatchObject({ tenant_id: 'tenant-1', used_by_user_id: 'op-1', modules_access: [], token: link!.token })
    const days = (Date.parse(link!.expiresAt) - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(6.9)
    expect(days).toBeLessThan(7.1)
  })
})
