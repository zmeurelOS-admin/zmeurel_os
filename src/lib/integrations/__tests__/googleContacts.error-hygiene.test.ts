/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchContactsPaged } from '@/lib/integrations/googleContacts'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('google contacts error hygiene', () => {
  it('nu expune body brut de provider în eroarea de fetch contacts', async () => {
    const providerBody = 'invalid_grant for ion@example.com refresh_token=super-secret'

    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => providerBody,
    })) as unknown as typeof fetch

    await expect(
      fetchContactsPaged({
        accessToken: 'access-token',
      }),
    ).rejects.toThrow('Google contacts fetch failed (status 400, body_length 60)')

    await expect(
      fetchContactsPaged({
        accessToken: 'access-token',
      }),
    ).rejects.not.toThrow(/ion@example\.com|super-secret/)
  })
})
