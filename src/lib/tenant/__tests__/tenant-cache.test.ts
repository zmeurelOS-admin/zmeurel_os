import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getTenantId, getTenantIdOrNull, primeTenantIdCache, resetTenantIdCache } from '@/lib/tenant/get-tenant'
import type { Database } from '@/types/supabase'

type Rows = { farm_members?: { tenant_id: string } | null; tenants?: { id: string } | null; profiles?: { tenant_id: string | null } | null }

/** Un client Supabase care numără cererile: fiecare `maybeSingle()` e o cerere către un tabel. */
function fakeSupabase(options: { sessionUserId: string | null; rows?: Rows; failTable?: string }) {
  const requests: string[] = []
  const getUser = vi.fn(async () => ({ data: { user: null }, error: { message: 'no session' } }))
  const state = { sessionUserId: options.sessionUserId, rows: options.rows ?? {}, failTable: options.failTable }

  const builder = (table: string) => {
    const chain: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'order', 'limit']) chain[method] = () => chain
    chain.maybeSingle = async () => {
      requests.push(table)
      if (state.failTable === table) return { data: null, error: new Error('rețea') }
      return { data: state.rows[table as keyof Rows] ?? null, error: null }
    }
    return chain
  }

  const client = {
    auth: {
      getSession: async () => ({
        data: { session: state.sessionUserId ? { user: { id: state.sessionUserId } } : null },
        error: null,
      }),
      getUser,
    },
    from: builder,
  }

  return { client: client as unknown as SupabaseClient<Database>, requests, getUser, state }
}

describe('tenantul ținut minte în browser', () => {
  beforeEach(() => {
    resetTenantIdCache()
  })

  it('îl rezolvă o singură dată, oricâte interogări îl cer', async () => {
    const { client, requests, getUser } = fakeSupabase({ sessionUserId: 'u1', rows: { tenants: { id: 't1' } } })

    const rezultate = await Promise.all([getTenantId(client), getTenantId(client), getTenantIdOrNull(client)])
    await getTenantId(client)

    expect(rezultate).toEqual(['t1', 't1', 't1'])
    // O singură rezolvare: operator? (farm_members) și proprietar? (tenants), deodată. Fără `auth/v1/user`.
    expect(requests).toEqual(['farm_members', 'tenants'])
    expect(getUser).not.toHaveBeenCalled()
  })

  it('tenantul primit de la server nu mai cere nimic', async () => {
    const { client, requests } = fakeSupabase({ sessionUserId: 'u1', rows: { tenants: { id: 'alt-tenant' } } })
    primeTenantIdCache('u1', 't-server')

    expect(await getTenantId(client)).toBe('t-server')
    expect(requests).toEqual([])
  })

  it('alt utilizator în sesiune: nu primește tenantul celui dinainte', async () => {
    const { client, requests, state } = fakeSupabase({ sessionUserId: 'u1', rows: { tenants: { id: 't1' } } })
    expect(await getTenantId(client)).toBe('t1')

    state.sessionUserId = 'u2'
    state.rows = { farm_members: { tenant_id: 't2' } }
    expect(await getTenantId(client)).toBe('t2')
    expect(requests).toEqual(['farm_members', 'tenants', 'farm_members', 'tenants'])
  })

  it('operatorul unei ferme lucrează în ferma aceea, chiar dacă are și una a lui', async () => {
    const { client } = fakeSupabase({
      sessionUserId: 'u1',
      rows: { farm_members: { tenant_id: 't-ferma' }, tenants: { id: 't-propriu' } },
    })
    expect(await getTenantId(client)).toBe('t-ferma')
  })

  it('fără fermă proprie și fără rol de operator: tenantul din profil', async () => {
    const { client, requests } = fakeSupabase({ sessionUserId: 'u1', rows: { profiles: { tenant_id: 't-profil' } } })
    expect(await getTenantId(client)).toBe('t-profil')
    expect(requests).toEqual(['farm_members', 'tenants', 'profiles'])
  })

  it('după `resetTenantIdCache` (delogare, invitație acceptată) se rezolvă din nou', async () => {
    const { client, requests } = fakeSupabase({ sessionUserId: 'u1', rows: { tenants: { id: 't1' } } })
    await getTenantId(client)
    resetTenantIdCache()
    await getTenantId(client)
    expect(requests).toEqual(['farm_members', 'tenants', 'farm_members', 'tenants'])
  })

  it('o eroare nu rămâne în memorie: următorul apel încearcă din nou', async () => {
    const { client, state } = fakeSupabase({ sessionUserId: 'u1', rows: { tenants: { id: 't1' } }, failTable: 'farm_members' })
    await expect(getTenantId(client)).rejects.toThrow('rețea')

    state.failTable = undefined
    expect(await getTenantId(client)).toBe('t1')
  })

  it('„fără tenant” nu rămâne în memorie (ferma creată imediat după se vede)', async () => {
    const { client, state } = fakeSupabase({ sessionUserId: 'u1' })
    expect(await getTenantIdOrNull(client)).toBeNull()
    await expect(getTenantId(client)).rejects.toThrow('Tenant indisponibil')

    state.rows = { tenants: { id: 't-nou' } }
    expect(await getTenantId(client)).toBe('t-nou')
  })

  it('după 10 minute se rezolvă din nou (un operator scos din fermă nu rămâne agățat)', async () => {
    vi.useFakeTimers()
    try {
      const { client, requests } = fakeSupabase({ sessionUserId: 'u1', rows: { tenants: { id: 't1' } } })
      await getTenantId(client)
      vi.advanceTimersByTime(9 * 60_000)
      await getTenantId(client)
      expect(requests).toHaveLength(2)

      vi.advanceTimersByTime(2 * 60_000)
      await getTenantId(client)
      expect(requests).toHaveLength(4)
    } finally {
      vi.useRealTimers()
    }
  })

  it('fără sesiune locală: drumul vechi, prin `getUser`, care refuză', async () => {
    const { client, getUser } = fakeSupabase({ sessionUserId: null })
    await expect(getTenantId(client)).rejects.toThrow('Neautorizat')
    expect(await getTenantIdOrNull(client)).toBeNull()
    expect(getUser).toHaveBeenCalledTimes(2)
  })
})
