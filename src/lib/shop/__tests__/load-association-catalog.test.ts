import { describe, expect, it, vi, beforeEach } from 'vitest'

import { loadAssociationCatalog } from '@/lib/shop/load-association-catalog'

const getSupabaseAdmin = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}))

const TID = 'a0000000-0000-4000-8000-000000000001'
const PID1 = 'b0000000-0000-4000-8000-000000000001'

function resolveResult(data: unknown) {
  return Promise.resolve({ data, error: null })
}

function makeChain(endResult: Promise<{ data: unknown; error: null }>) {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          in: () => ({
            order: () => endResult,
          }),
        }),
      }),
    }),
  }
}

describe('loadAssociationCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('include doar produse listate; displayPrice din association_price; farmName din tenants', async () => {
    const prodRows = [
      {
        id: PID1,
        tenant_id: TID,
        nume: 'Zmeură',
        descriere: null,
        categorie: 'Fructe',
        unitate_vanzare: 'kg',
        gramaj_per_unitate: null,
        pret_unitar: 20,
        association_price: 17,
        moneda: 'RON',
        poza_1_url: null,
        poza_2_url: null,
        status: 'activ',
        association_listed: true,
      },
    ]
    getSupabaseAdmin.mockReturnValue({
      from: (table: string) => {
        if (table === 'tenants') {
          return {
            select: (cols: string) => {
              if (cols.includes('nume_ferma')) {
                return {
                  in: () =>
                    resolveResult([
                      {
                        id: TID,
                        nume_ferma: 'Ferma Nord',
                        logo_url: 'logos/ferma-nord.jpg',
                        descriere_publica: 'Ferma cu zmeură și mure.',
                        localitate: 'Suceava',
                        website: 'fermanord.ro',
                        facebook: 'ferma.nord',
                        instagram: 'fermanord',
                        whatsapp: '+40700000000',
                        email_public: 'contact@fermanord.ro',
                        program_piata: 'Sâmbătă, 08:00 - 12:00',
                      },
                    ]),
                }
              }
              return resolveResult([
                { id: TID, owner_user_id: 'o1', is_association_approved: true },
              ])
            },
          }
        }
        if (table === 'produse') {
          return makeChain(resolveResult(prodRows))
        }
        return {}
      },
      storage: {
        from: () => ({
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
        }),
      },
      auth: { admin: { getUserById: async () => ({ data: null, error: new Error('x') }) } },
    })

    const rows = await loadAssociationCatalog()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.displayPrice).toBe(17)
    expect(rows[0]?.farmName).toBe('Ferma Nord')
    expect(rows[0]?.producerLogoUrl).toBe('https://cdn.test/logos/ferma-nord.jpg')
    expect(rows[0]?.producerDescription).toBe('Ferma cu zmeură și mure.')
    expect(rows[0]?.producerLocation).toBe('Suceava')
    expect(rows[0]?.producerWebsite).toBe('fermanord.ro')
    expect(rows[0]?.producerFacebook).toBe('ferma.nord')
    expect(rows[0]?.producerInstagram).toBe('fermanord')
    expect(rows[0]?.producerWhatsapp).toBe('+40700000000')
    expect(rows[0]?.producerEmailPublic).toBe('contact@fermanord.ro')
    expect(rows[0]?.producerProgramPiata).toBe('Sâmbătă, 08:00 - 12:00')
    expect(rows[0]?.pret_unitar).toBe(20)
  })

  it('displayPrice = pret_unitar când association_price lipsește', async () => {
    const prodRows = [
      {
        id: PID1,
        tenant_id: TID,
        nume: 'P',
        descriere: null,
        categorie: 'x',
        unitate_vanzare: 'kg',
        gramaj_per_unitate: null,
        pret_unitar: 33,
        association_price: null,
        moneda: 'RON',
        poza_1_url: null,
        poza_2_url: null,
        status: 'activ',
        association_listed: true,
      },
    ]
    getSupabaseAdmin.mockReturnValue({
      from: (table: string) => {
        if (table === 'tenants') {
          return {
            select: (cols: string) => {
              if (cols.includes('nume_ferma')) {
                return {
                  in: () => resolveResult([{ id: TID, nume_ferma: 'F', logo_url: null }]),
                }
              }
              return resolveResult([
                { id: TID, owner_user_id: 'o1', is_association_approved: true },
              ])
            },
          }
        }
        if (table === 'produse') {
          return makeChain(resolveResult(prodRows))
        }
        return {}
      },
      storage: {
        from: () => ({
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
        }),
      },
      auth: { admin: { getUserById: async () => ({ data: null, error: new Error('x') }) } },
    })
    const rows = await loadAssociationCatalog()
    expect(rows[0]?.displayPrice).toBe(33)
  })
})
