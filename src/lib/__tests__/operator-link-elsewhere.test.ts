import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { user_id: string; tenant_id: string; is_active: boolean }

const db = vi.hoisted(() => ({ rows: [] as Row[], fail: false }))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: () => {
      const eq: Record<string, unknown> = {}
      const neq: Record<string, unknown> = {}
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          eq[column] = value
          return query
        },
        neq: (column: string, value: unknown) => {
          neq[column] = value
          return query
        },
        limit: async () => {
          if (db.fail) return { data: null, error: { message: 'boom' } }
          const data = db.rows.filter(
            (row) => row.user_id === eq.user_id && row.is_active === eq.is_active && row.tenant_id !== neq.tenant_id,
          )
          return { data: data.map(() => ({ id: 'x' })), error: null }
        },
      }
      return query
    },
  }),
}))

describe('hasActiveMembershipElsewhere', () => {
  beforeEach(() => {
    db.rows = []
    db.fail = false
  })

  it('operatorul activ doar în ferma linkului: nu', async () => {
    db.rows = [{ user_id: 'op-1', tenant_id: 'ferma-1', is_active: true }]
    const { hasActiveMembershipElsewhere } = await import('@/lib/farm-members/operator-link-server')
    expect(await hasActiveMembershipElsewhere('op-1', 'ferma-1')).toBe(false)
  })

  it('operatorul activ în altă fermă: da (linkul fermei străine e refuzat)', async () => {
    db.rows = [
      { user_id: 'op-1', tenant_id: 'ferma-lui', is_active: true },
      { user_id: 'op-1', tenant_id: 'ferma-straina', is_active: true },
    ]
    const { hasActiveMembershipElsewhere } = await import('@/lib/farm-members/operator-link-server')
    expect(await hasActiveMembershipElsewhere('op-1', 'ferma-straina')).toBe(true)
  })

  it('dezactivat în ferma veche, activ doar în cea a linkului: nu', async () => {
    db.rows = [
      { user_id: 'op-1', tenant_id: 'ferma-veche', is_active: false },
      { user_id: 'op-1', tenant_id: 'ferma-noua', is_active: true },
    ]
    const { hasActiveMembershipElsewhere } = await import('@/lib/farm-members/operator-link-server')
    expect(await hasActiveMembershipElsewhere('op-1', 'ferma-noua')).toBe(false)
  })

  it('citirea a picat: refuz (nu deschide ușa)', async () => {
    db.fail = true
    const { hasActiveMembershipElsewhere } = await import('@/lib/farm-members/operator-link-server')
    expect(await hasActiveMembershipElsewhere('op-1', 'ferma-1')).toBe(true)
  })
})
