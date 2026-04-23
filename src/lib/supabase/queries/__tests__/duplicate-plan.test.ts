import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createClientMock, getTenantIdByUserIdMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getTenantIdByUserIdMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}))

vi.mock('@/lib/tenant/get-tenant', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tenant/get-tenant')>('@/lib/tenant/get-tenant')
  return {
    ...actual,
    getTenantIdByUserId: getTenantIdByUserIdMock,
  }
})

import { duplicatePlanTratament } from '@/lib/supabase/queries/tratamente'

function createAwaitable<T>(result: T) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (onFulfilled?: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
  }

  return builder
}

describe('duplicatePlanTratament', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('duplică planul cu N linii în aceeași ordine', async () => {
    let planSelectCount = 0
    let linesInsertPayload: unknown[] = []

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'planuri_tratament') {
          return {
            ...createAwaitable({ data: null, error: null }),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: 'plan-2',
                    tenant_id: 'tenant-1',
                    nume: 'Plan nou',
                    cultura_tip: 'zmeur',
                    descriere: 'Copie - descriere',
                    activ: true,
                    arhivat: false,
                    created_at: '2026-01-01T00:00:00Z',
                    updated_at: '2026-01-01T00:00:00Z',
                    created_by: 'user-1',
                    updated_by: 'user-1',
                  },
                  error: null,
                })),
              })),
            })),
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => {
                    planSelectCount += 1
                    if (planSelectCount === 1) {
                      return {
                        data: {
                          id: 'plan-1',
                          tenant_id: 'tenant-1',
                          nume: 'Plan sursă',
                          cultura_tip: 'zmeur',
                          descriere: 'descriere',
                          activ: true,
                          arhivat: false,
                          created_at: '2026-01-01T00:00:00Z',
                          updated_at: '2026-01-01T00:00:00Z',
                          created_by: null,
                          updated_by: null,
                        },
                        error: null,
                      }
                    }

                    return {
                      data: {
                        id: 'plan-2',
                        tenant_id: 'tenant-1',
                        nume: 'Plan nou',
                        cultura_tip: 'zmeur',
                        descriere: 'Copie - descriere',
                        activ: true,
                        arhivat: false,
                        created_at: '2026-01-01T00:00:00Z',
                        updated_at: '2026-01-01T00:00:00Z',
                        created_by: 'user-1',
                        updated_by: 'user-1',
                      },
                      error: null,
                    }
                  }),
                })),
              })),
            })),
          }
        }

        if (table === 'planuri_tratament_linii') {
          return {
            ...createAwaitable({ data: null, error: null }),
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(async () => ({
                    data: planSelectCount === 1
                      ? [
                          {
                            id: 'linie-1',
                            tenant_id: 'tenant-1',
                            plan_id: 'plan-1',
                            ordine: 1,
                            stadiu_trigger: 'inflorit',
                            produs_id: 'prod-1',
                            produs_nume_manual: null,
                            doza_ml_per_hl: 500,
                            doza_l_per_ha: null,
                            observatii: 'obs 1',
                            created_at: '2026-01-01T00:00:00Z',
                            updated_at: '2026-01-01T00:00:00Z',
                            produs: null,
                          },
                          {
                            id: 'linie-2',
                            tenant_id: 'tenant-1',
                            plan_id: 'plan-1',
                            ordine: 2,
                            stadiu_trigger: 'fruct_verde',
                            produs_id: null,
                            produs_nume_manual: 'Produs manual',
                            doza_ml_per_hl: null,
                            doza_l_per_ha: 2,
                            observatii: 'obs 2',
                            created_at: '2026-01-01T00:00:00Z',
                            updated_at: '2026-01-01T00:00:00Z',
                            produs: null,
                          },
                        ]
                      : [
                          {
                            id: 'linie-3',
                            tenant_id: 'tenant-1',
                            plan_id: 'plan-2',
                            ordine: 1,
                            stadiu_trigger: 'inflorit',
                            produs_id: 'prod-1',
                            produs_nume_manual: null,
                            doza_ml_per_hl: 500,
                            doza_l_per_ha: null,
                            observatii: 'obs 1',
                            created_at: '2026-01-01T00:00:00Z',
                            updated_at: '2026-01-01T00:00:00Z',
                            produs: null,
                          },
                          {
                            id: 'linie-4',
                            tenant_id: 'tenant-1',
                            plan_id: 'plan-2',
                            ordine: 2,
                            stadiu_trigger: 'fruct_verde',
                            produs_id: null,
                            produs_nume_manual: 'Produs manual',
                            doza_ml_per_hl: null,
                            doza_l_per_ha: 2,
                            observatii: 'obs 2',
                            created_at: '2026-01-01T00:00:00Z',
                            updated_at: '2026-01-01T00:00:00Z',
                            produs: null,
                          },
                        ],
                    error: null,
                  })),
                })),
              })),
            })),
            insert: vi.fn((payload: unknown[]) => {
              linesInsertPayload = payload
              return { then: Promise.resolve({ data: null, error: null }).then.bind(Promise.resolve({ data: null, error: null })) }
            }),
          }
        }

        if (table === 'planuri_tratament_linie_produse') {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
            insert: vi.fn(async () => ({ data: null, error: null })),
          }
        }

        if (table === 'produse_fitosanitare') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [
                  {
                    id: 'prod-1',
                    tenant_id: 'tenant-1',
                    nume_comercial: 'Produs 1',
                    substanta_activa: 'sub',
                    tip: 'fungicid',
                    frac_irac: null,
                    phi_zile: null,
                    nr_max_aplicari_per_sezon: null,
                    activ: true,
                  },
                ],
                error: null,
              })),
            })),
          }
        }

        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')

    const result = await duplicatePlanTratament('plan-1', 'Plan nou')

    expect(Array.isArray(linesInsertPayload)).toBe(true)
    expect(linesInsertPayload).toHaveLength(2)
    expect((linesInsertPayload[0] as { ordine: number }).ordine).toBe(1)
    expect((linesInsertPayload[1] as { ordine: number }).ordine).toBe(2)
    expect(result.id).toBe('plan-2')
    expect(result.linii).toHaveLength(2)
  })

  it('aruncă eroare pentru plan inexistent', async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
      from: vi.fn((table: string) => {
        if (table === 'planuri_tratament') {
          return createAwaitable({ data: null, error: null })
        }
        if (table === 'planuri_tratament_linii') {
          return createAwaitable({ data: [], error: null })
        }
        throw new Error(`Unexpected table: ${table}`)
      }),
    }

    createClientMock.mockResolvedValue(supabase)
    getTenantIdByUserIdMock.mockResolvedValue('tenant-1')

    await expect(duplicatePlanTratament('plan-missing', 'Plan nou')).rejects.toThrow(
      'Planul selectat nu a fost găsit.'
    )
  })
})
