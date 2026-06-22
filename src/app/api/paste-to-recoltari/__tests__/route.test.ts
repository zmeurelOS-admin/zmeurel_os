/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPasteToRecoltariHandler } from '@/app/api/paste-to-recoltari/paste-to-recoltari-handler'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

type QueryResult = {
  data?: unknown
  error?: unknown
}

type SupabaseMockOptions = {
  userId?: string | null
  ownerTenantId?: string | null
  farmMember?: {
    tenant_id: string
    role: 'operator' | 'livrator'
    is_active: boolean
    modules_access: unknown
  } | null
  profileTenantId?: string | null
}

function buildMaybeSingleQuery(result: QueryResult = {}) {
  return {
    select() {
      return this
    },
    eq() {
      return this
    },
    order() {
      return this
    },
    limit() {
      return this
    },
    maybeSingle() {
      return Promise.resolve({
        data: result.data ?? null,
        error: result.error ?? null,
      })
    },
  }
}

function createSupabaseMock(options: SupabaseMockOptions = {}) {
  const userId = options.userId === undefined ? 'user-1' : options.userId

  return {
    auth: {
      async getUser() {
        return {
          data: {
            user: userId ? { id: userId } : null,
          },
          error: null,
        }
      },
    },
    from(table: string) {
      if (table === 'tenants') {
        return buildMaybeSingleQuery({
          data: options.ownerTenantId ? { id: options.ownerTenantId } : null,
        })
      }

      if (table === 'farm_members') {
        return buildMaybeSingleQuery({
          data: options.farmMember ?? null,
        })
      }

      if (table === 'profiles') {
        return buildMaybeSingleQuery({
          data: options.profileTenantId ? { tenant_id: options.profileTenantId } : null,
        })
      }

      return buildMaybeSingleQuery()
    },
  }
}

const originalAnthropicKey = process.env.ANTHROPIC_API_KEY

afterEach(() => {
  if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = originalAnthropicKey
  vi.restoreAllMocks()
})

describe('POST /api/paste-to-recoltari', () => {
  it('întoarce draft pentru mesaj cu total kg fără separare cal1/cal2', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const handler = createPasteToRecoltariHandler({
      async createClient() {
        return createSupabaseMock({ ownerTenantId: 'tenant-1' }) as never
      },
      getSupabaseAdmin() {
        return {} as never
      },
      async invokeAnthropic() {
        return {
          text: JSON.stringify({
            data: '2026-06-22',
            culegator_nume: 'Ion Popescu',
            parcela_referita: 'Maravilla 1',
            cantitate_kg: 42,
            cantitate_kg_separata: {
              cal1: null,
              cal2: null,
            },
            observatii: null,
            incertitudini: [],
            confidence: 'high',
          }),
        }
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-recoltari', {
        method: 'POST',
        json: { text: 'Ion Popescu a cules azi 42 kg din Maravilla 1.' },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      draft: true,
      data: {
        data: '2026-06-22',
        culegator_nume: 'Ion Popescu',
        parcela_referita: 'Maravilla 1',
        cantitate_kg: 42,
        cantitate_kg_separata: {
          cal1: null,
          cal2: null,
        },
        observatii: null,
        incertitudini: [],
        confidence: 'high',
      },
    })
  })

  it('întoarce draft pentru mesaj cu cal1/cal2 separate', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const handler = createPasteToRecoltariHandler({
      async createClient() {
        return createSupabaseMock({ ownerTenantId: 'tenant-1' }) as never
      },
      getSupabaseAdmin() {
        return {} as never
      },
      async invokeAnthropic() {
        return {
          text: JSON.stringify({
            data: '2026-06-22',
            culegator_nume: 'Maria',
            parcela_referita: 'Solar 2',
            cantitate_kg: null,
            cantitate_kg_separata: {
              cal1: 18.5,
              cal2: 3.25,
            },
            observatii: 'Sortat direct în lădițe.',
            incertitudini: [],
            confidence: 'high',
          }),
        }
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-recoltari', {
        method: 'POST',
        json: { text: 'Maria a cules în Solar 2: 18.5 kg cal 1 și 3.25 kg cal 2.' },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      draft: true,
      data: {
        data: '2026-06-22',
        culegator_nume: 'Maria',
        parcela_referita: 'Solar 2',
        cantitate_kg: null,
        cantitate_kg_separata: {
          cal1: 18.5,
          cal2: 3.25,
        },
        observatii: 'Sortat direct în lădițe.',
        incertitudini: [],
        confidence: 'high',
      },
    })
  })

  it('întoarce tot draft și pentru confidence low cu câmpuri lipsă', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const handler = createPasteToRecoltariHandler({
      async createClient() {
        return createSupabaseMock({ ownerTenantId: 'tenant-1' }) as never
      },
      getSupabaseAdmin() {
        return {} as never
      },
      async invokeAnthropic() {
        return {
          text: JSON.stringify({
            data: null,
            culegator_nume: null,
            parcela_referita: 'Parcelă mică',
            cantitate_kg: null,
            cantitate_kg_separata: {
              cal1: null,
              cal2: null,
            },
            observatii: 'Mesaj ambiguu.',
            incertitudini: ['Lipsesc data, culegătorul și cantitatea.'],
            confidence: 'low',
          }),
        }
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-recoltari', {
        method: 'POST',
        json: { text: 'Am cules ceva din parcela mică.' },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      draft: true,
      data: {
        data: null,
        culegator_nume: null,
        parcela_referita: 'Parcelă mică',
        cantitate_kg: null,
        cantitate_kg_separata: {
          cal1: null,
          cal2: null,
        },
        observatii: 'Mesaj ambiguu.',
        incertitudini: ['Lipsesc data, culegătorul și cantitatea.'],
        confidence: 'low',
      },
    })
  })

  it('refuză userul neautentificat', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const handler = createPasteToRecoltariHandler({
      async createClient() {
        return createSupabaseMock({ userId: null }) as never
      },
      getSupabaseAdmin() {
        return {} as never
      },
      async invokeAnthropic() {
        throw new Error('should not call anthropic when unauthenticated')
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-recoltari', {
        method: 'POST',
        json: { text: 'Am cules 20 kg.' },
      }),
    )

    expect(response.status).toBe(401)
  })

  it('refuză operatorul fără write pe modulul recoltari', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const handler = createPasteToRecoltariHandler({
      async createClient() {
        return createSupabaseMock({
          ownerTenantId: null,
          farmMember: {
            tenant_id: 'tenant-1',
            role: 'operator',
            is_active: true,
            modules_access: [{ module: 'recoltari', level: 'read' }],
          },
        }) as never
      },
      getSupabaseAdmin() {
        return {} as never
      },
      async invokeAnthropic() {
        throw new Error('should not call anthropic when access is denied')
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-recoltari', {
        method: 'POST',
        json: { text: 'Am cules 20 kg.' },
      }),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'FORBIDDEN',
      },
    })
  })

  it('întoarce 502 când modelul răspunde cu JSON invalid', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const handler = createPasteToRecoltariHandler({
      async createClient() {
        return createSupabaseMock({ ownerTenantId: 'tenant-1' }) as never
      },
      getSupabaseAdmin() {
        return {} as never
      },
      async invokeAnthropic() {
        return {
          text: 'nu este json valid',
        }
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-recoltari', {
        method: 'POST',
        json: { text: 'Am cules 20 kg.' },
      }),
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'INVALID_MODEL_RESPONSE',
      },
    })
  })
})
