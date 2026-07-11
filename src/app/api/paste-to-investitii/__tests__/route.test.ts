/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPasteToInvestitiiHandler } from '@/app/api/paste-to-investitii/paste-to-investitii-handler'
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
  const businessId = options.businessId ?? 'INV-0001'

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

      if (table === 'investitii') {
        return {
          insert(payload: unknown) {
            insertSpy(payload)
            return {
              select() {
                return {
                  async single() {
                    return {
                      data: { id: 'investment-1' },
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

describe('POST /api/paste-to-investitii', () => {
  it('salvează direct pentru owner când suma este sub prag și confidence este high', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const insertSpy = vi.fn()
    const supabase = createSupabaseMock({ ownerTenantId: 'tenant-1' }, insertSpy)
    const handler = createPasteToInvestitiiHandler({
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
            categorie: 'Utilaje și echipamente',
            descriere: 'Motocoasă nouă',
            suma_lei: 500,
            furnizor: 'Agro Util',
            parcela_referita: 'Solar 1',
            incertitudini: [],
            confidence: 'high',
          }),
        }
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-investitii', {
        method: 'POST',
        json: { text: 'Am cumpărat o motocoasă nouă cu 500 lei de la Agro Util pentru Solar 1.' },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      draft: false,
      data: {
        data: '2026-06-22',
        categorie: 'Utilaje și echipamente',
        descriere: 'Motocoasă nouă',
        suma_lei: 500,
        furnizor: 'Agro Util',
        parcela_referita: 'Solar 1',
        incertitudini: [],
        confidence: 'high',
      },
      inserted_id: 'investment-1',
    })
    expect(insertSpy).toHaveBeenCalledTimes(1)
    expect(insertSpy).toHaveBeenCalledWith({
      tenant_id: 'tenant-1',
      id_investitie: 'INV-0001',
      data: '2026-06-22',
      categorie: 'Utilaje și echipamente',
      descriere: 'Motocoasă nouă',
      suma_lei: 500,
      furnizor: 'Agro Util',
    })
  })

  it('întoarce draft above_threshold când suma depășește pragul', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const insertSpy = vi.fn()
    const supabase = createSupabaseMock({ ownerTenantId: 'tenant-1' }, insertSpy)
    const handler = createPasteToInvestitiiHandler({
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
            categorie: 'Irigații și fertigare',
            descriere: 'Kit irigare',
            suma_lei: 3500,
            furnizor: 'Irigatii Expert',
            parcela_referita: null,
            incertitudini: [],
            confidence: 'high',
          }),
        }
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-investitii', {
        method: 'POST',
        json: { text: 'Am cumpărat azi un kit de irigare cu 3500 lei.' },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      draft: true,
      draft_reason: 'above_threshold',
      data: {
        data: '2026-06-22',
        categorie: 'Irigații și fertigare',
        descriere: 'Kit irigare',
        suma_lei: 3500,
        furnizor: 'Irigatii Expert',
        parcela_referita: null,
        incertitudini: [],
        confidence: 'high',
      },
    })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('întoarce draft low_confidence când confidence este low', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const insertSpy = vi.fn()
    const supabase = createSupabaseMock({ ownerTenantId: 'tenant-1' }, insertSpy)
    const handler = createPasteToInvestitiiHandler({
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
            categorie: 'Construcții și amenajări',
            descriere: 'Lucrare la magazie',
            suma_lei: 500,
            furnizor: null,
            parcela_referita: null,
            incertitudini: ['Furnizorul nu este clar.'],
            confidence: 'low',
          }),
        }
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-investitii', {
        method: 'POST',
        json: { text: 'Am băgat cam 500 lei în magazie.' },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      draft: true,
      draft_reason: 'low_confidence',
      data: {
        data: '2026-06-22',
        categorie: 'Construcții și amenajări',
        descriere: 'Lucrare la magazie',
        suma_lei: 500,
        furnizor: null,
        parcela_referita: null,
        incertitudini: ['Furnizorul nu este clar.'],
        confidence: 'low',
      },
    })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('întoarce draft missing_fields când suma_lei lipsește', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const insertSpy = vi.fn()
    const supabase = createSupabaseMock({ ownerTenantId: 'tenant-1' }, insertSpy)
    const handler = createPasteToInvestitiiHandler({
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
            categorie: 'Sisteme de susținere și protecție',
            descriere: 'Spalieri',
            suma_lei: null,
            furnizor: 'Agro Metal',
            parcela_referita: 'Maravilla 1',
            incertitudini: ['Suma nu este clară.'],
            confidence: 'high',
          }),
        }
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-investitii', {
        method: 'POST',
        json: { text: 'Am luat spalieri pentru Maravilla 1, dar nu mai știu suma.' },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      draft: true,
      draft_reason: 'missing_fields',
      data: {
        data: '2026-06-22',
        categorie: 'Sisteme de susținere și protecție',
        descriere: 'Spalieri',
        suma_lei: null,
        furnizor: 'Agro Metal',
        parcela_referita: 'Maravilla 1',
        incertitudini: ['Suma nu este clară.'],
        confidence: 'high',
      },
    })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('refuză userul neautentificat', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const handler = createPasteToInvestitiiHandler({
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
      createSameOriginRequest('/api/paste-to-investitii', {
        method: 'POST',
        json: { text: 'Am investit 500 lei într-un utilaj.' },
      }),
    )

    expect(response.status).toBe(401)
  })

  it('refuză operatorul fără write pe modulul investitii', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const handler = createPasteToInvestitiiHandler({
      async createClient() {
        return createSupabaseMock({
          ownerTenantId: null,
          farmMember: {
            tenant_id: 'tenant-1',
            role: 'operator',
            is_active: true,
            modules_access: [{ module: 'investitii', level: 'read' }],
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
      createSameOriginRequest('/api/paste-to-investitii', {
        method: 'POST',
        json: { text: 'Am investit 500 lei într-un utilaj.' },
      }),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'FORBIDDEN',
      },
    })
  })

  it('refuză controlat și operatorul care declară write pe modulul investitii', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    const handler = createPasteToInvestitiiHandler({
      async createClient() {
        return createSupabaseMock({
          ownerTenantId: null,
          farmMember: {
            tenant_id: 'tenant-1',
            role: 'operator',
            is_active: true,
            modules_access: [{ module: 'investitii', level: 'write' }],
          },
        }) as never
      },
      getSupabaseAdmin() {
        return createAdminMock(null) as never
      },
      async invokeAnthropic() {
        throw new Error('should not call anthropic when generic financial access is denied')
      },
    })

    const response = await handler(
      createSameOriginRequest('/api/paste-to-investitii', {
        method: 'POST',
        json: { text: 'Am investit 500 lei într-un utilaj.' },
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
    const handler = createPasteToInvestitiiHandler({
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
      createSameOriginRequest('/api/paste-to-investitii', {
        method: 'POST',
        json: { text: 'Am investit 500 lei într-un utilaj.' },
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
