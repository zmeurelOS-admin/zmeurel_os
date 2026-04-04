import { describe, expect, it, vi, beforeEach } from 'vitest'

import { loadProducerProfile } from '@/lib/shop/load-producer-profile'

const getSupabaseAdmin = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}))

const TID = 'c0000000-0000-4000-8000-000000000001'
const PID = 'd0000000-0000-4000-8000-000000000001'

function resolveResult(data: unknown) {
  return Promise.resolve({ data, error: null })
}

describe('loadProducerProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returnează null pentru UUID invalid', async () => {
    getSupabaseAdmin.mockReturnValue({ from: () => ({}) })
    await expect(loadProducerProfile('not-uuid')).resolves.toBeNull()
  })

  it('returnează null pentru tenant inexistent', async () => {
    getSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      auth: { admin: { getUserById: async () => ({ data: null, error: null }) } },
    })
    await expect(loadProducerProfile(TID)).resolves.toBeNull()
  })

  it('returnează null pentru tenant neaprobat și fără allowlist', async () => {
    getSupabaseAdmin.mockReturnValue({
      from: (table: string) => {
        if (table === 'tenants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: TID,
                    nume_ferma: 'F',
                    owner_user_id: 'owner-1',
                    is_association_approved: false,
                    descriere_publica: null,
                    poze_ferma: [],
                    localitate: 'Suceava',
                    specialitate: null,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        return {}
      },
      auth: {
        admin: {
          getUserById: async () => ({
            data: { user: { email: 'unknown@unknown.test' } },
            error: null,
          }),
        },
      },
    })
    await expect(loadProducerProfile(TID)).resolves.toBeNull()
  })

  it('returnează profil + produse pentru tenant aprobat; produse cu association_listed true', async () => {
    getSupabaseAdmin.mockReturnValue({
      from: (table: string) => {
        if (table === 'tenants') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: TID,
                    nume_ferma: 'Ferma Bio',
                    owner_user_id: 'owner-1',
                    is_association_approved: true,
                    descriere_publica: 'Bio',
                    poze_ferma: [],
                    localitate: 'Suceava',
                    specialitate: 'Fructe',
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === 'produse') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    order: () =>
                      resolveResult([
                        {
                          id: PID,
                          tenant_id: TID,
                          nume: 'Produs',
                          descriere: null,
                          categorie: 'x',
                          unitate_vanzare: 'kg',
                          gramaj_per_unitate: null,
                          pret_unitar: 10,
                          association_price: 9,
                          moneda: 'RON',
                          poza_1_url: null,
                          poza_2_url: null,
                          status: 'activ',
                          association_listed: true,
                        },
                      ]),
                  }),
                }),
              }),
            }),
          }
        }
        return {}
      },
      auth: { admin: { getUserById: async () => ({ data: null, error: null }) } },
    })
    const out = await loadProducerProfile(TID)
    expect(out).not.toBeNull()
    expect(out?.farm.numeFerma).toBe('Ferma Bio')
    expect(out?.products).toHaveLength(1)
    expect(out?.products[0]?.displayPrice).toBe(9)
  })
})
