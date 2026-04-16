/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createChatPostHandler } from '@/app/api/chat/chat-post-handler'

type MockQueryResult = {
  data?: unknown
  error?: unknown
}

function buildQuery(result: MockQueryResult = {}) {
  const query = {
    data: result.data ?? null,
    error: result.error ?? null,
    select() {
      return this
    },
    eq() {
      return this
    },
    limit() {
      return this
    },
    order() {
      return this
    },
    gte() {
      return this
    },
    ilike() {
      return this
    },
    insert() {
      return Promise.resolve({ data: null, error: null })
    },
  }

  return query
}

function createSupabaseMock() {
  return {
    auth: {
      async getUser() {
        return {
          data: {
            user: {
              id: 'user-1',
              email: 'user@example.com',
            },
          },
        }
      },
    },
    from(table: string) {
      if (table === 'profiles') return buildQuery({ data: [{ is_superadmin: false }] })
      if (table === 'ai_conversations') return buildQuery({ data: [] })
      if (table === 'parcele') {
        return buildQuery({
          data: [
            {
              id: 'parcela-delniwa',
              nume_parcela: 'Delniwa',
              nume: 'Delniwa',
              soi_plantat: 'Delniwa',
              soi: 'Delniwa',
              cultura: 'Zmeura',
              tip_fruct: 'Zmeura',
            },
          ],
        })
      }
      if (table === 'clienti') return buildQuery({ data: [] })
      if (table === 'comenzi') return buildQuery({ data: [] })
      if (table === 'activitati_agricole') return buildQuery({ data: [] })
      if (table === 'miscari_stoc') return buildQuery({ data: [] })
      if (table === 'analytics_events') return buildQuery({ data: [] })
      if (table === 'recoltari') return buildQuery({ data: [] })
      if (table === 'cheltuieli_diverse') return buildQuery({ data: [] })

      return buildQuery({ data: [] })
    },
    async rpc(name: string) {
      if (name === 'check_and_increment_ai_usage') {
        return {
          data: {
            allowed: true,
            count: 1,
            limit: 20,
          },
          error: null,
        }
      }
      return { data: null, error: null }
    },
  }
}

const originalApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
  else process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalApiKey
  vi.restoreAllMocks()
})

describe('chat-post-handler logging hygiene', () => {
  it('nu loghează inputul user brut când structured extraction eșuează', async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key'
    const inputMessage = 'Am recoltat 20 kg azi din Delniwa'

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const handler = createChatPostHandler({
      async createClient() {
        return createSupabaseMock() as never
      },
      async getTenantIdOrNull() {
        throw new Error('tenant lookup failed refresh_token=secret-value')
      },
      async generateObject() {
        throw new Error('AI_NoObjectGeneratedError')
      },
      async generateText() {
        throw new Error('generateText should not be called in this scenario')
      },
    })

    const response = await handler(
      new Request('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage,
          pathname: '/recoltari',
        }),
      }),
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { type?: string }
    expect(payload.type).toBe('form')

    const combinedLogs = JSON.stringify([
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ])

    expect(combinedLogs).not.toContain(inputMessage)
    expect(combinedLogs).not.toContain('secret-value')
    expect(combinedLogs).toContain('structured_extraction_failed')
    expect(combinedLogs).toContain('message_length')
  })
})
