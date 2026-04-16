/* @vitest-environment node */

import { randomUUID, randomBytes } from 'node:crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  refreshAccessTokenIfNeeded,
  upsertGoogleIntegration,
} from '@/lib/integrations/googleContacts'
import {
  encryptTokenSecret,
  GOOGLE_TOKEN_ENCRYPTION_ENV,
  TokenEncryptionConfigError,
} from '@/lib/integrations/token-secret-crypto'

const originalFetch = globalThis.fetch
const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID
const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET
const originalGoogleEncryptionKey = process.env[GOOGLE_TOKEN_ENCRYPTION_ENV]

function setEncryptionKey() {
  process.env[GOOGLE_TOKEN_ENCRYPTION_ENV] = randomBytes(32).toString('base64')
}

function setGoogleOAuthEnv() {
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
}

function baseIntegration(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    tenant_id: randomUUID(),
    user_id: randomUUID(),
    user_email: 'owner@example.com',
    connected_email: 'owner@gmail.com',
    access_token: null,
    refresh_token: null,
    token_expires_at: null,
    scope: 'contacts.readonly',
    sync_token: null,
    sync_enabled: true,
    sync_window: 'seara',
    last_sync_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

afterEach(() => {
  globalThis.fetch = originalFetch

  if (originalGoogleClientId === undefined) delete process.env.GOOGLE_CLIENT_ID
  else process.env.GOOGLE_CLIENT_ID = originalGoogleClientId

  if (originalGoogleClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET
  else process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret

  if (originalGoogleEncryptionKey === undefined) delete process.env[GOOGLE_TOKEN_ENCRYPTION_ENV]
  else process.env[GOOGLE_TOKEN_ENCRYPTION_ENV] = originalGoogleEncryptionKey
})

describe('googleContacts token security', () => {
  it('criptează tokenurile la upsert și păstrează runtime values în memorie', async () => {
    setEncryptionKey()
    const upsertCalls: Array<Record<string, unknown>> = []

    const supabaseMock = {
      from: (table: string) => {
        if (table !== 'integrations_google_contacts') throw new Error(`unexpected table ${table}`)
        return {
          upsert: (payload: Record<string, unknown>) => {
            upsertCalls.push(payload)
            return {
              select: () => ({
                single: async () => ({
                  data: baseIntegration(payload),
                  error: null,
                }),
              }),
            }
          },
        }
      },
    } as never

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ email: 'owner@gmail.com' }),
    })) as unknown as typeof fetch

    const result = await upsertGoogleIntegration({
      supabase: supabaseMock,
      tenantId: randomUUID(),
      userId: randomUUID(),
      userEmail: 'owner@example.com',
      tokenData: {
        access_token: 'access_plain',
        refresh_token: 'refresh_plain',
        scope: 'contacts.readonly',
      },
    })

    expect(upsertCalls).toHaveLength(1)
    expect(String(upsertCalls[0].access_token)).toMatch(/^enc:v1\./)
    expect(String(upsertCalls[0].refresh_token)).toMatch(/^enc:v1\./)
    expect(String(upsertCalls[0].access_token)).not.toContain('access_plain')
    expect(String(upsertCalls[0].refresh_token)).not.toContain('refresh_plain')
    expect(result.access_token).toBe('access_plain')
    expect(result.refresh_token).toBe('refresh_plain')
  })

  it('decriptează refresh token la read și persistă noile tokenuri criptat', async () => {
    setEncryptionKey()
    setGoogleOAuthEnv()

    const encryptedAccess = encryptTokenSecret('stale_access_plain')
    const encryptedRefresh = encryptTokenSecret('refresh_plain')
    const updateCalls: Array<Record<string, unknown>> = []
    let responseRow = baseIntegration({
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      token_expires_at: new Date(Date.now() - 60_000).toISOString(),
    })

    const supabaseMock = {
      from: (table: string) => {
        if (table !== 'integrations_google_contacts') throw new Error(`unexpected table ${table}`)
        return {
          update: (payload: Record<string, unknown>) => {
            updateCalls.push(payload)
            responseRow = { ...responseRow, ...payload }
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({ data: responseRow, error: null }),
                }),
              }),
            }
          },
        }
      },
    } as never

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body as URLSearchParams
      expect(body.get('refresh_token')).toBe('refresh_plain')

      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'fresh_access_plain',
          expires_in: 3600,
          scope: 'contacts.readonly',
        }),
      }
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await refreshAccessTokenIfNeeded({
      supabase: supabaseMock,
      integration: responseRow,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(updateCalls).toHaveLength(1)
    expect(String(updateCalls[0].access_token)).toMatch(/^enc:v1\./)
    expect(String(updateCalls[0].refresh_token)).toMatch(/^enc:v1\./)
    expect(String(updateCalls[0].access_token)).not.toContain('fresh_access_plain')
    expect(result.access_token).toBe('fresh_access_plain')
    expect(result.refresh_token).toBe('refresh_plain')
  })

  it('migrează transparent tokenurile legacy plaintext la primul read reușit', async () => {
    setEncryptionKey()

    const updateCalls: Array<Record<string, unknown>> = []
    let responseRow = baseIntegration({
      access_token: 'legacy_access_plain',
      refresh_token: 'legacy_refresh_plain',
      token_expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    })

    const supabaseMock = {
      from: (table: string) => {
        if (table !== 'integrations_google_contacts') throw new Error(`unexpected table ${table}`)
        return {
          update: (payload: Record<string, unknown>) => {
            updateCalls.push(payload)
            responseRow = { ...responseRow, ...payload }
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({ data: responseRow, error: null }),
                }),
              }),
            }
          },
        }
      },
    } as never

    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await refreshAccessTokenIfNeeded({
      supabase: supabaseMock,
      integration: responseRow,
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(updateCalls).toHaveLength(1)
    expect(String(updateCalls[0].access_token)).toMatch(/^enc:v1\./)
    expect(String(updateCalls[0].refresh_token)).toMatch(/^enc:v1\./)
    expect(result.access_token).toBe('legacy_access_plain')
    expect(result.refresh_token).toBe('legacy_refresh_plain')
  })

  it('eșuează controlat când lipsește cheia și tokenul din DB este criptat', async () => {
    setEncryptionKey()
    const encryptedAccess = encryptTokenSecret('access_plain')
    const encryptedRefresh = encryptTokenSecret('refresh_plain')
    delete process.env[GOOGLE_TOKEN_ENCRYPTION_ENV]

    const supabaseMock = {
      from: () => {
        throw new Error('should not reach DB update path')
      },
    } as never

    await expect(
      refreshAccessTokenIfNeeded({
        supabase: supabaseMock,
        integration: baseIntegration({
          access_token: encryptedAccess,
          refresh_token: encryptedRefresh,
          token_expires_at: new Date(Date.now() - 60_000).toISOString(),
        }),
      }),
    ).rejects.toBeInstanceOf(TokenEncryptionConfigError)
  })

  it('blochează write-ul dacă lipsește cheia de criptare', async () => {
    delete process.env[GOOGLE_TOKEN_ENCRYPTION_ENV]

    const supabaseMock = {
      from: () => ({
        upsert: () => ({
          select: () => ({
            single: async () => ({ data: baseIntegration(), error: null }),
          }),
        }),
      }),
    } as never

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ email: 'owner@gmail.com' }),
    })) as unknown as typeof fetch

    await expect(
      upsertGoogleIntegration({
        supabase: supabaseMock,
        tenantId: randomUUID(),
        userId: randomUUID(),
        userEmail: 'owner@example.com',
        tokenData: {
          access_token: 'new_access_plain',
          refresh_token: 'new_refresh_plain',
        },
      }),
    ).rejects.toBeInstanceOf(TokenEncryptionConfigError)
  })

  it('nu expune tokenuri în mesajul de eroare când refresh-ul Google eșuează', async () => {
    setEncryptionKey()
    setGoogleOAuthEnv()

    const encryptedAccess = encryptTokenSecret('stale_access_plain')
    const encryptedRefresh = encryptTokenSecret('refresh_sensitive_value')

    const supabaseMock = {
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({ data: baseIntegration(), error: null }),
            }),
          }),
        }),
      }),
    } as never

    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => 'contains_refresh_sensitive_value',
    })) as unknown as typeof fetch

    await expect(
      refreshAccessTokenIfNeeded({
        supabase: supabaseMock,
        integration: baseIntegration({
          access_token: encryptedAccess,
          refresh_token: encryptedRefresh,
          token_expires_at: new Date(Date.now() - 60_000).toISOString(),
        }),
      }),
    ).rejects.toThrow('Google refresh token failed (status 400)')
  })
})
