import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LoadedOperatorLink } from '@/lib/farm-members/operator-link-server'

const TOKEN = '11111111-1111-4111-8111-111111111111'

const server = vi.hoisted(() => ({
  link: null as unknown as LoadedOperatorLink,
  claimed: new Set<string>(),
  createdUsers: [] as string[],
  sessions: [] as string[],
  currentUser: null as { id: string } | null,
  emails: new Map<string, string>(),
  signOutOthers: 0,
}))

vi.mock('@/lib/api/route-security', () => ({ validateSameOriginMutation: () => null }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: server.currentUser } }),
      signOut: async () => {
        server.signOutOthers += 1
        return { error: null }
      },
    },
  }),
}))

vi.mock('@/lib/farm-members/operator-link-server', () => ({
  loadOperatorLink: async () => server.link,
  // Ca în baza de date: `update … where used_at is null` reușește o singură dată.
  claimOperatorLink: async (row: { id: string }) => {
    if (server.claimed.has(row.id)) return false
    server.claimed.add(row.id)
    return true
  },
  releaseOperatorLink: async (id: string) => {
    server.claimed.delete(id)
  },
  turnIntoReconnectLink: async () => undefined,
  markOperatorLinkUser: async () => undefined,
  createHiddenOperatorUser: async () => {
    const id = `op-${server.createdUsers.length + 1}`
    server.createdUsers.push(id)
    const email = `${id}@operator.zmeurel.local`
    server.emails.set(id, email)
    return { id, email }
  },
  removeAutoCreatedTenants: async () => undefined,
  deleteFreshHiddenUser: async () => undefined,
  linkUserToFarm: async () => ({ ok: true }),
  firstRouteForMember: async () => '/comenzi',
  getAuthUserEmail: async (id: string) => server.emails.get(id) ?? null,
  startSessionWithoutPassword: async (_client: unknown, email: string) => {
    server.sessions.push(email)
    return true
  },
}))

function linkNou(): LoadedOperatorLink {
  return {
    row: {
      id: 'inv-1',
      tenant_id: 'tenant-1',
      token: TOKEN,
      modules_access: [{ module: 'comenzi', level: 'write' }],
      created_by: 'owner-1',
      expires_at: '2099-01-01T00:00:00Z',
      used_at: null,
      used_by_user_id: null,
      invitee_name: 'Ana Pavel',
    },
    state: { ok: true, kind: 'nou' },
    modules: [{ module: 'comenzi', level: 'write' }],
    member: null,
  }
}

function linkReconectare(userId: string): LoadedOperatorLink {
  return {
    row: { ...linkNou().row!, id: 'inv-2', modules_access: [], used_by_user_id: userId },
    state: { ok: true, kind: 'reconectare', userId },
    modules: [],
    member: { id: 'm-1', name: 'Ana Pavel', phone: null, is_active: true, role: 'operator' },
  }
}

async function intra(body: unknown = { token: TOKEN }) {
  const { POST } = await import('@/app/api/invite/accept/route')
  const response = await POST(
    new Request('https://zmeurel.ro/api/invite/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return { status: response.status, json: (await response.json()) as { success: boolean; error?: string; redirect_to?: string } }
}

describe('POST /api/invite/accept (intrare din link)', () => {
  beforeEach(() => {
    server.link = linkNou()
    server.claimed.clear()
    server.createdUsers.length = 0
    server.sessions.length = 0
    server.currentUser = null
    server.emails.clear()
    server.signOutOthers = 0
  })

  it('prima invitație: un cont ascuns, sesiune pornită, primul modul', async () => {
    const { status, json } = await intra()
    expect(status).toBe(200)
    expect(json).toEqual({ success: true, redirect_to: '/comenzi' })
    expect(server.createdUsers).toEqual(['op-1'])
    expect(server.sessions).toEqual(['op-1@operator.zmeurel.local'])
  })

  it('a doua folosire e refuzată și nu creează alt cont', async () => {
    await intra()
    const second = await intra()
    expect(second.status).toBe(410)
    expect(second.json.error).toBe('used')
    expect(server.createdUsers).toHaveLength(1)
  })

  it('două deschideri simultane: un singur cont', async () => {
    const results = await Promise.all([intra(), intra()])
    expect(results.map((r) => r.status).sort()).toEqual([200, 410])
    expect(server.createdUsers).toHaveLength(1)
  })

  it('reconectarea intră în același utilizator, fără cont nou, și închide celelalte sesiuni', async () => {
    await intra()
    server.link = linkReconectare('op-1')
    const { status, json } = await intra()
    expect(status).toBe(200)
    expect(json.success).toBe(true)
    expect(server.createdUsers).toEqual(['op-1'])
    expect(server.sessions).toEqual(['op-1@operator.zmeurel.local', 'op-1@operator.zmeurel.local'])
    expect(server.signOutOthers).toBe(1)
  })

  it('link expirat / folosit / dezactivat: refuzat, fără cont', async () => {
    for (const reason of ['expired', 'used', 'inactive'] as const) {
      server.link = { ...linkNou(), state: { ok: false, reason } }
      const { status, json } = await intra()
      expect(status).toBe(410)
      expect(json.error).toBe(reason)
    }
    expect(server.createdUsers).toHaveLength(0)
  })

  it('logat în alt cont: nu schimbă contul pe tăcute', async () => {
    server.currentUser = { id: 'proprietar' }
    const { status, json } = await intra()
    expect(status).toBe(409)
    expect(json.error).toBe('signed_in_as_other')
    expect(server.createdUsers).toHaveLength(0)
    expect(server.claimed.size).toBe(0)
  })

  it('nu acceptă alte câmpuri decât tokenul (fără parolă, fără tenant)', async () => {
    const { status, json } = await intra({ token: TOKEN, tenant_id: 'alt-tenant', password: 'secret123' })
    // Câmpurile în plus se ignoră: ferma vine doar din invitație.
    expect(status).toBe(200)
    expect(JSON.stringify(json)).not.toContain('secret123')
    const invalid = await intra({ token: 'nu-e-uuid' })
    expect(invalid.status).toBe(400)
  })
})
