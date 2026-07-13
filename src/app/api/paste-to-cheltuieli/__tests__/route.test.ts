/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPasteToCheltuieliHandler } from '@/app/api/paste-to-cheltuieli/paste-to-cheltuieli-handler'
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
  businessId?: string
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

function createSupabaseMock(
  options: SupabaseMockOptions = {},
  insertSpy = vi.fn(),
) {
  const userId = options.userId === undefined ? 'user-1' : options.userId
  const businessId = options.businessId ?? 'CH-0001'

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
    async rpc(fn: string) {
      if (fn === 'generate_business_id') {
        return {
          data: businessId,
          error: null,
        }
      }

      return {
        data: null,
        error: null,
      }
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

      if (table === 'cheltuieli_diverse') {
        return {
          insert(payload: unknown) {
            insertSpy(payload)
            return {
              select() {
                return {
                  async single() {
                    return {
                      data: { id: 'expense-1' },
                      error: null,
                    }
                  },
                }
              },
            }
          },
        }
      }

      return buildMaybeSingleQuery()
    },
  }
}

function createAdminMock(ownerTenantId: string | null) {
  return {
    from(table: string) {
      if (table !== 'tenants') {
        throw new Error(`Unexpected admin table: ${table}`)
      }

      return buildMaybeSingleQuery({
        data: ownerTenantId ? { id: ownerTenantId } : null,
      })
    },
  }
}

const originalAnthropicKey = process.env.ANTHROPIC_API_KEY

afterEach(() => {
  if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = originalAnthropicKey
  vi.restoreAllMocks()
})

describe('POST /api/paste-to-cheltuieli', () => {
  it('salvează direct pentru owner autenticat când confidence este high și câmpurile minime sunt prezente', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const insertSpy = vi.fn()
    const supabase = createSupabaseMock({ ownerTenantId: 'tenant-1' }, insertSpy)
    const handler = createPasteToCheltuieliHandler({
      async createClient() {
        return supabase as never
      },
      getSupabaseAdmin() {
        return createAdminMock('tenant-1') as never
      },
      getNowContext() {
        return {
          nowIso: '2026-06-22T08:00:00.000Z',
          nowLocalDate: '2026-06-22',
          nowLocalDateTime: '2026-06-22 11:00:00',
          timezone: 'Europe/Bucharest',
        }
      },
      async invokeAnthropic() {
        return {
          text: JSON.stringify({
            data: '2026-06-22',
            categorie: 'Combustibil',
            descriere: 'Motorină pentru transport',
            suma_lei: 245.5,
            furnizor: 'Petrom',
            metoda_plata: 'card',
            incertitudini: [],
            confidence: 'high',
          }),
        }
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-cheltuieli', {
        method: 'POST',
        json: { text: 'Am plătit azi 245,5 lei cu cardul la Petrom pentru motorină.' },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      draft: false,
      data: {
        data: '2026-06-22',
        categorie: 'Combustibil',
        descriere: 'Motorină pentru transport',
        suma_lei: 245.5,
        furnizor: 'Petrom',
        metoda_plata: 'card',
        incertitudini: [],
        confidence: 'high',
      },
      inserted_id: 'expense-1',
    })
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(insertSpy).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      id_cheltuiala: 'CH-0001',
      data: '2026-06-22',
      categorie: 'Combustibil',
      descriere: 'Motorină pentru transport',
      suma_lei: 245.5,
      furnizor: 'Petrom',
      metoda_plata: 'card',
    })
  })

  it('întoarce draft când confidence este low', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const insertSpy = vi.fn()
    const supabase = createSupabaseMock({ ownerTenantId: 'tenant-1' }, insertSpy)
    const handler = createPasteToCheltuieliHandler({
      async createClient() {
        return supabase as never
      },
      getSupabaseAdmin() {
        return createAdminMock('tenant-1') as never
      },
      async invokeAnthropic() {
        return {
          text: JSON.stringify({
            data: '2026-06-22',
            categorie: 'Consumabile',
            descriere: 'Ceva pentru fermă',
            suma_lei: 50,
            furnizor: null,
            metoda_plata: null,
            incertitudini: ['Nu este clar furnizorul.'],
            confidence: 'low',
          }),
        }
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-cheltuieli', {
        method: 'POST',
        json: { text: 'Am dat vreo 50 lei pe niște consumabile.' },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      draft: true,
      data: {
        data: '2026-06-22',
        categorie: 'Consumabile',
        descriere: 'Ceva pentru fermă',
        suma_lei: 50,
        furnizor: null,
        metoda_plata: null,
        incertitudini: ['Nu este clar furnizorul.'],
        confidence: 'low',
      },
    })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('întoarce draft când lipsesc câmpuri minime chiar dacă confidence este high', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const insertSpy = vi.fn()
    const supabase = createSupabaseMock({ ownerTenantId: 'tenant-1' }, insertSpy)
    const handler = createPasteToCheltuieliHandler({
      async createClient() {
        return supabase as never
      },
      getSupabaseAdmin() {
        return createAdminMock('tenant-1') as never
      },
      async invokeAnthropic() {
        return {
          text: JSON.stringify({
            data: '2026-06-22',
            categorie: 'Transport',
            descriere: 'Transport marfă',
            suma_lei: null,
            furnizor: 'Curier local',
            metoda_plata: 'transfer',
            incertitudini: ['Suma nu este clară.'],
            confidence: 'high',
          }),
        }
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-cheltuieli', {
        method: 'POST',
        json: { text: 'Transport marfă azi, plătit prin transfer, dar nu mai știu suma.' },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      draft: true,
      data: {
        data: '2026-06-22',
        categorie: 'Transport',
        descriere: 'Transport marfă',
        suma_lei: null,
        furnizor: 'Curier local',
        metoda_plata: 'transfer',
        incertitudini: ['Suma nu este clară.'],
        confidence: 'high',
      },
    })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('refuză userul neautentificat', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const handler = createPasteToCheltuieliHandler({
      async createClient() {
        return createSupabaseMock({ userId: null }) as never
      },
      getSupabaseAdmin() {
        return createAdminMock(null) as never
      },
      async invokeAnthropic() {
        throw new Error('should not call anthropic when unauthenticated')
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-cheltuieli', {
        method: 'POST',
        json: { text: 'Am plătit 100 lei pe ambalaje.' },
      }),
    )

    expect(response.status).toBe(401)
  })

  it('refuză userul fără write pe modulul cheltuieli', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const handler = createPasteToCheltuieliHandler({
      async createClient() {
        return createSupabaseMock({
          ownerTenantId: null,
          farmMember: {
            tenant_id: 'tenant-1',
            role: 'operator',
            is_active: true,
            modules_access: [{ module: 'cheltuieli', level: 'read' }],
          },
        }) as never
      },
      getSupabaseAdmin() {
        return createAdminMock(null) as never
      },
      async invokeAnthropic() {
        throw new Error('should not call anthropic when access is denied')
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-cheltuieli', {
        method: 'POST',
        json: { text: 'Am plătit 100 lei pe ambalaje.' },
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
    const handler = createPasteToCheltuieliHandler({
      async createClient() {
        return createSupabaseMock({ ownerTenantId: 'tenant-1' }) as never
      },
      getSupabaseAdmin() {
        return createAdminMock('tenant-1') as never
      },
      async invokeAnthropic() {
        return {
          text: 'nu este json valid',
        }
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-cheltuieli', {
        method: 'POST',
        json: { text: 'Am plătit 100 lei pe ambalaje.' },
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
