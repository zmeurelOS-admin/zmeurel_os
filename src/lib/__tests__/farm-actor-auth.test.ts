import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: vi.fn() }))

import { actorCanWrite, resolveFarmActor, type FarmActor } from '@/lib/farm-members/actor-auth'

type Membership = {
  user_id: string
  tenant_id: string
  is_active: boolean
  role: string
  modules_access: unknown
  created_at: string
}
type Tenant = { id: string; owner_user_id: string; created_at: string }

function makeAdmin(db: { members: Membership[]; tenants: Tenant[] }) {
  return {
    from: (table: string) => {
      const filters: Record<string, unknown> = {}
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters[column] = value
          return query
        },
        order: () => query,
        limit: () => query,
        maybeSingle: async () => {
          if (table === 'farm_members') {
            const rows = db.members
              .filter(
                (m) => m.user_id === filters.user_id && m.is_active === filters.is_active && m.role === filters.role,
              )
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
            return { data: rows[0] ?? null, error: null }
          }
          const rows = db.tenants
            .filter((t) => t.owner_user_id === filters.owner_user_id)
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
          return { data: rows[0] ?? null, error: null }
        },
      }
      return query
    },
  } as never
}

describe('resolveFarmActor', () => {
  it('proprietarul: ferma lui, are voie tot', async () => {
    const admin = makeAdmin({
      members: [],
      tenants: [{ id: 'ferma-1', owner_user_id: 'u-1', created_at: '2026-01-01' }],
    })
    const actor = await resolveFarmActor(admin, { id: 'u-1', email: 'a@b.ro' })
    expect(actor).toEqual({ userId: 'u-1', email: 'a@b.ro', tenantId: 'ferma-1', isOwner: true, access: [] })
    expect(actorCanWrite(actor!, 'comenzi')).toBe(true)
  })

  it('operatorul: ferma în care lucrează, chiar dacă are și o fermă a lui; drepturile din rândul lui', async () => {
    const admin = makeAdmin({
      members: [
        {
          user_id: 'u-2',
          tenant_id: 'ferma-sefului',
          is_active: true,
          role: 'operator',
          modules_access: [
            { module: 'recoltari', level: 'write' },
            { module: 'comenzi', level: 'read' },
          ],
          created_at: '2026-02-01',
        },
      ],
      tenants: [{ id: 'ferma-lui-goala', owner_user_id: 'u-2', created_at: '2026-01-01' }],
    })
    const actor = await resolveFarmActor(admin, { id: 'u-2' })
    expect(actor?.tenantId).toBe('ferma-sefului')
    expect(actor?.isOwner).toBe(false)
    expect(actorCanWrite(actor!, 'recoltari')).toBe(true)
    expect(actorCanWrite(actor!, 'comenzi')).toBe(false)
    expect(actorCanWrite(actor!, 'comenzi', 'livrari')).toBe(false)
    expect(actorCanWrite(actor!, 'comenzi', 'recoltari')).toBe(true)
  })

  it('operatorul dezactivat și livratorul nu sunt operatori; fără fermă proprie nu există actor', async () => {
    const admin = makeAdmin({
      members: [
        { user_id: 'u-3', tenant_id: 'ferma-1', is_active: false, role: 'operator', modules_access: [], created_at: '2026-02-01' },
        { user_id: 'u-4', tenant_id: 'ferma-1', is_active: true, role: 'livrator', modules_access: [], created_at: '2026-02-01' },
      ],
      tenants: [],
    })
    expect(await resolveFarmActor(admin, { id: 'u-3' })).toBeNull()
    expect(await resolveFarmActor(admin, { id: 'u-4' })).toBeNull()
  })

  it('operatorul cu drepturi doar pe Comenzi și Livrări nu scrie în Clienți', () => {
    const actor: FarmActor = {
      userId: 'u',
      email: null,
      tenantId: 't',
      isOwner: false,
      access: [
        { module: 'comenzi', level: 'write' },
        { module: 'livrari', level: 'write' },
      ],
    }
    expect(actorCanWrite(actor, 'livrari')).toBe(true)
    expect(actorCanWrite(actor, 'clienti')).toBe(false)
  })
})
