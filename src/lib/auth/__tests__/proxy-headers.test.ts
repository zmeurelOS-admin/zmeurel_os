import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { stripProxyOwnedHeaders } from '@/lib/auth/proxy-headers'

type Member = { tenant_id: string; role: string; modules_access: unknown } | null

const state: {
  user: { id: string; email: string } | null
  member: Member
  ownTenantId: string | null
  refreshCookie: boolean
} = { user: null, member: null, ownTenantId: null, refreshCookie: false }

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (c: unknown[]) => void } }) => ({
    auth: {
      getUser: async () => {
        if (state.refreshCookie) {
          options.cookies.setAll([{ name: 'sb-test-auth-token', value: 'refreshed', options: { path: '/', httpOnly: true } }])
        }
        return { data: { user: state.user }, error: null }
      },
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => {
    const chain = {
      from: () => chain,
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: state.member, error: null }),
    }
    return chain
  },
}))

vi.mock('@/lib/tenant/get-tenant', () => ({
  getNonOperatorTenantIdOrNull: async () => state.ownTenantId,
  getTenantIdByUserIdOrNull: async () => state.ownTenantId,
}))

/** Antetul cererii spre pagină, așa cum îl transmite Next din răspunsul proxy-ului. */
function forwarded(response: Response, name: string): string | null {
  const kept = (response.headers.get('x-middleware-override-headers') ?? '').split(',').map((item) => item.trim())
  if (!kept.includes(name)) return null
  return response.headers.get(`x-middleware-request-${name}`)
}

function cerere(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(path, 'https://zmeurel.ro'), {
    headers: { cookie: 'sb-test-auth-token=vechi', ...headers },
  })
}

describe('stripProxyOwnedHeaders', () => {
  it('șterge antetele x-zmeurel-* și păstrează step-up-ul și restul', () => {
    const headers = new Headers({
      'x-zmeurel-tenant-id': 'fals',
      'X-Zmeurel-Member-Role': 'operator',
      'x-zmeurel-access-level-comenzi': 'write',
      'x-zmeurel-step-up-token': 'confirmare',
      accept: 'text/html',
    })
    stripProxyOwnedHeaders(headers)
    expect(headers.get('x-zmeurel-tenant-id')).toBeNull()
    expect(headers.get('x-zmeurel-member-role')).toBeNull()
    expect(headers.get('x-zmeurel-access-level-comenzi')).toBeNull()
    expect(headers.get('x-zmeurel-step-up-token')).toBe('confirmare')
    expect(headers.get('accept')).toBe('text/html')
  })
})

describe('proxy: antetele spre pagină', () => {
  beforeEach(() => {
    state.user = { id: 'user-1', email: 'ana@exemplu.ro' }
    state.member = null
    state.ownTenantId = 'tenant-propriu'
    state.refreshCookie = false
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
  })

  it('un x-zmeurel-tenant-id trimis de client nu ajunge la pagină; cel pus de proxy ajunge', async () => {
    const { proxy } = await import('@/proxy')
    const response = await proxy(
      cerere('/dashboard', {
        'x-zmeurel-tenant-id': 'tenant-strain',
        'x-zmeurel-member-role': 'operator',
        'x-zmeurel-member-modules': 'comenzi:write',
      }),
    )
    expect(response.status).toBe(200)
    expect(forwarded(response, 'x-zmeurel-tenant-id')).toBe('tenant-propriu')
    expect(forwarded(response, 'x-zmeurel-user-id')).toBe('user-1')
    expect(forwarded(response, 'x-zmeurel-user-email')).toBe('ana@exemplu.ro')
    expect(forwarded(response, 'x-zmeurel-member-role')).toBeNull()
    expect(forwarded(response, 'x-zmeurel-member-modules')).toBeNull()
  })

  it('operatorul: rolul și drepturile puse de proxy ajung la pagină', async () => {
    state.member = { tenant_id: 'tenant-ferma', role: 'operator', modules_access: [{ module: 'comenzi', level: 'read' }] }
    const { proxy } = await import('@/proxy')
    const response = await proxy(cerere('/comenzi', { 'x-zmeurel-access-level': 'write' }))
    expect(response.status).toBe(200)
    expect(forwarded(response, 'x-zmeurel-tenant-id')).toBe('tenant-ferma')
    expect(forwarded(response, 'x-zmeurel-member-role')).toBe('operator')
    expect(forwarded(response, 'x-zmeurel-member-modules')).toContain('comenzi:read')
    expect(forwarded(response, 'x-zmeurel-access-level')).toBe('read')
  })

  it('cookie-urile de sesiune reîmprospătate sunt pe răspuns și pe redirecturi', async () => {
    state.refreshCookie = true
    const { proxy } = await import('@/proxy')
    const response = await proxy(cerere('/dashboard'))
    expect(response.cookies.get('sb-test-auth-token')?.value).toBe('refreshed')
    expect(forwarded(response, 'cookie')).toContain('sb-test-auth-token=refreshed')

    state.member = { tenant_id: 'tenant-ferma', role: 'operator', modules_access: [{ module: 'comenzi', level: 'read' }] }
    const redirect = await proxy(cerere('/settings'))
    expect(redirect.status).toBeGreaterThanOrEqual(300)
    expect(redirect.status).toBeLessThan(400)
    expect(redirect.cookies.get('sb-test-auth-token')?.value).toBe('refreshed')
  })

  it('operatorul din link dezactivat (fără apartenență, fără fermă): pagina de acces oprit, nu /start', async () => {
    state.user = { id: 'op-1', email: 'op-abc@operator.zmeurel.local' }
    state.member = null
    state.ownTenantId = null
    const { proxy } = await import('@/proxy')
    for (const path of ['/comenzi', '/start', '/login']) {
      const response = await proxy(cerere(path))
      expect(response.headers.get('location')).toContain('/acces-oprit')
    }
    const page = await proxy(cerere('/acces-oprit'))
    expect(page.status).toBe(200)
  })

  it('operatorul din link activ ajunge în ferma lui, nu pe /start', async () => {
    state.user = { id: 'op-1', email: 'op-abc@operator.zmeurel.local' }
    state.member = { tenant_id: 'tenant-ferma', role: 'operator', modules_access: [{ module: 'recoltari', level: 'write' }] }
    state.ownTenantId = null
    const { proxy } = await import('@/proxy')
    const start = await proxy(cerere('/start'))
    expect(start.headers.get('location')).toContain('/recoltari')
    const page = await proxy(cerere('/recoltari'))
    expect(page.status).toBe(200)
    expect(forwarded(page, 'x-zmeurel-tenant-id')).toBe('tenant-ferma')
  })

  it('fără sesiune, pe o rută protejată: login, fără antete de identitate', async () => {
    state.user = null
    const { proxy } = await import('@/proxy')
    const response = await proxy(cerere('/dashboard', { 'x-zmeurel-user-id': 'fals' }))
    expect(response.status).toBeGreaterThanOrEqual(300)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('rută publică fără sesiune: antetele false nu trec', async () => {
    state.user = null
    const { proxy } = await import('@/proxy')
    const response = await proxy(cerere('/login', { 'x-zmeurel-tenant-id': 'tenant-strain' }))
    expect(response.status).toBe(200)
    expect(forwarded(response, 'x-zmeurel-tenant-id')).toBeNull()
  })
})
