/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FinancialMutationError } from '@/lib/financial/save-errors'

const mocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
  getTenantId: vi.fn(),
  generateBusinessId: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => mocks.getSupabase(),
}))

vi.mock('@/lib/tenant/get-tenant', () => ({
  getTenantId: (...args: unknown[]) => mocks.getTenantId(...args),
}))

vi.mock('@/lib/supabase/business-ids', () => ({
  generateBusinessId: (...args: unknown[]) => mocks.generateBusinessId(...args),
}))

type QueryResponse = {
  data?: unknown
  error?: {
    code?: string
    message?: string
    details?: string
    hint?: string
    status?: number
  } | null
  status?: number
}

function createSupabaseMock(options?: {
  authUserId?: string | null
  currentTenantId?: string | null
  currentTenantError?: QueryResponse['error']
  cheltuialaResult?: QueryResponse
  cheltuialaFallbackResult?: QueryResponse
  investitieResult?: QueryResponse
}) {
  const cheltuialaSelectSingle = vi.fn(async () => ({
    data: options?.cheltuialaResult?.data ?? {
      id: 'expense-1',
      tenant_id: options?.currentTenantId ?? 'tenant-1',
      id_cheltuiala: 'CH001',
      data: '2026-07-11',
      categorie: 'Consumabile',
      descriere: 'Test',
      suma_lei: 10,
      furnizor: null,
      document_url: null,
      client_sync_id: 'sync-1',
      sync_status: 'synced',
      conflict_flag: false,
      created_by: options?.authUserId ?? 'user-1',
      updated_by: options?.authUserId ?? 'user-1',
      created_at: '2026-07-11T10:00:00Z',
      updated_at: '2026-07-11T10:00:00Z',
    },
    error: options?.cheltuialaResult?.error ?? null,
    status: options?.cheltuialaResult?.status ?? 201,
  }))
  const cheltuialaSelect = vi.fn(() => ({ single: cheltuialaSelectSingle }))
  const cheltuialaUpsert = vi.fn(() => ({ select: cheltuialaSelect }))

  const cheltuialaFallbackSingle = vi.fn(async () => ({
    data: options?.cheltuialaFallbackResult?.data ?? null,
    error: options?.cheltuialaFallbackResult?.error ?? null,
    status: options?.cheltuialaFallbackResult?.status ?? 201,
  }))
  const cheltuialaFallbackSelect = vi.fn(() => ({ single: cheltuialaFallbackSingle }))
  const cheltuialaInsert = vi.fn(() => ({ select: cheltuialaFallbackSelect }))

  const investitieSelectSingle = vi.fn(async () => ({
    data: options?.investitieResult?.data ?? {
      id: 'investment-1',
      tenant_id: options?.currentTenantId ?? 'tenant-1',
      id_investitie: 'INV001',
      data: '2026-07-11',
      parcela_id: null,
      categorie: 'Utilaje și echipamente',
      furnizor: null,
      descriere: 'Test',
      suma_lei: 55,
      created_at: '2026-07-11T10:00:00Z',
      updated_at: '2026-07-11T10:00:00Z',
    },
    error: options?.investitieResult?.error ?? null,
    status: options?.investitieResult?.status ?? 201,
  }))
  const investitieSelect = vi.fn(() => ({ single: investitieSelectSingle }))
  const investitieInsert = vi.fn(() => ({ select: investitieSelect }))

  const from = vi.fn((table: string) => {
    if (table === 'cheltuieli_diverse') {
      return {
        upsert: cheltuialaUpsert,
        insert: cheltuialaInsert,
      }
    }

    if (table === 'investitii') {
      return {
        insert: investitieInsert,
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    auth: {
      async getUser() {
        return {
          data: {
            user: options?.authUserId === null ? null : { id: options?.authUserId ?? 'user-1' },
          },
          error: options?.authUserId === null ? { message: 'Neautorizat', status: 401 } : null,
        }
      },
    },
    rpc: vi.fn(async (fn: string) => {
      if (fn !== 'current_tenant_id') {
        throw new Error(`Unexpected RPC: ${fn}`)
      }

      return {
        data: options?.currentTenantId ?? 'tenant-1',
        error: options?.currentTenantError ?? null,
        status: options?.currentTenantError ? 404 : 200,
      }
    }),
    from,
    cheltuialaUpsert,
    investitieInsert,
  }
}

describe('financial create queries', () => {
  beforeEach(() => {
    mocks.getSupabase.mockReset()
    mocks.getTenantId.mockReset()
    mocks.getTenantId.mockResolvedValue('tenant-1')
    mocks.generateBusinessId.mockReset()
  })

  it('ownerul poate salva o cheltuială', async () => {
    const supabase = createSupabaseMock({ currentTenantId: 'tenant-1' })
    mocks.getSupabase.mockReturnValue(supabase)
    mocks.generateBusinessId.mockResolvedValue('CH100')

    const { createCheltuiala } = await import('@/lib/supabase/queries/cheltuieli')
    const result = await createCheltuiala({
      data: '2026-07-11',
      categorie: 'Consumabile',
      suma_lei: 100,
      descriere: 'Motorină',
    })

    expect(result.id_cheltuiala).toBe('CH001')
    expect(supabase.cheltuialaUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        id_cheltuiala: 'CH100',
      }),
      { onConflict: 'client_sync_id' },
    )
  })

  it('ownerul poate salva o investiție', async () => {
    const supabase = createSupabaseMock({ currentTenantId: 'tenant-1' })
    mocks.getSupabase.mockReturnValue(supabase)
    mocks.generateBusinessId.mockResolvedValue('INV100')

    const { createInvestitie } = await import('@/lib/supabase/queries/investitii')
    const result = await createInvestitie({
      data: '2026-07-11',
      categorie: 'Utilaje și echipamente',
      suma_lei: 550,
      descriere: 'Pompă',
    })

    expect(result.id_investitie).toBe('INV001')
    expect(supabase.investitieInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        id_investitie: 'INV100',
      }),
    )
  })

  it('raportează clar când generate_business_id este indisponibil', async () => {
    const supabase = createSupabaseMock({ currentTenantId: 'tenant-1' })
    mocks.getSupabase.mockReturnValue(supabase)
    mocks.generateBusinessId.mockRejectedValue({
      code: 'PGRST202',
      message: 'Could not find the function public.generate_business_id(prefix) in the schema cache',
      details: undefined,
      hint: undefined,
      status: 404,
    })

    const { createInvestitie } = await import('@/lib/supabase/queries/investitii')

    await expect(
      createInvestitie({
        data: '2026-07-11',
        categorie: 'Utilaje și echipamente',
        suma_lei: 99,
      }),
    ).rejects.toMatchObject({
      kind: 'rpc_missing',
      tableOrRpc: 'public.generate_business_id',
      code: 'PGRST202',
      status: 404,
    })
  })

  it('oprește salvarea când current_tenant_id() diferă de tenantul payloadului', async () => {
    const supabase = createSupabaseMock({ currentTenantId: 'tenant-2' })
    mocks.getSupabase.mockReturnValue(supabase)
    mocks.generateBusinessId.mockResolvedValue('CH200')

    const { createCheltuiala } = await import('@/lib/supabase/queries/cheltuieli')

    await expect(
      createCheltuiala({
        data: '2026-07-11',
        categorie: 'Consumabile',
        suma_lei: 100,
      }),
    ).rejects.toMatchObject({
      kind: 'tenant_mismatch',
      tableOrRpc: 'public.current_tenant_id',
      status: 409,
      code: 'TENANT_CONTEXT_MISMATCH',
    })
  })

  it('raportează sesiunea expirată înainte de orice insert', async () => {
    const supabase = createSupabaseMock({ authUserId: null })
    mocks.getSupabase.mockReturnValue(supabase)

    const { createInvestitie } = await import('@/lib/supabase/queries/investitii')

    await expect(
      createInvestitie({
        data: '2026-07-11',
        categorie: 'Utilaje și echipamente',
        suma_lei: 50,
      }),
    ).rejects.toMatchObject({
      kind: 'session_expired',
      operation: 'auth.getUser',
      status: 401,
    })
  })

  it('normalizează erorile RLS/permisiune refuzată', async () => {
    const supabase = createSupabaseMock({
      currentTenantId: 'tenant-1',
      investitieResult: {
        data: null,
        error: {
          code: '42501',
          message: 'new row violates row-level security policy for table "investitii"',
          details: undefined,
          hint: undefined,
          status: 403,
        },
        status: 403,
      },
    })
    mocks.getSupabase.mockReturnValue(supabase)
    mocks.generateBusinessId.mockResolvedValue('INV200')

    const { createInvestitie } = await import('@/lib/supabase/queries/investitii')

    await expect(
      createInvestitie({
        data: '2026-07-11',
        categorie: 'Utilaje și echipamente',
        suma_lei: 50,
      }),
    ).rejects.toMatchObject({
      kind: 'permission_denied',
      tableOrRpc: 'public.investitii',
      code: '42501',
      status: 403,
    })
  })

  it('distinge o coliziune reală de business ID', async () => {
    const supabase = createSupabaseMock({
      currentTenantId: 'tenant-1',
      cheltuialaResult: {
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "cheltuieli_diverse_id_cheltuiala_key"',
          details: 'Key (id_cheltuiala)=(CH777) already exists.',
          hint: undefined,
          status: 409,
        },
        status: 409,
      },
    })
    mocks.getSupabase.mockReturnValue(supabase)
    mocks.generateBusinessId.mockResolvedValue('CH777')

    const { createCheltuiala } = await import('@/lib/supabase/queries/cheltuieli')

    await expect(
      createCheltuiala({
        data: '2026-07-11',
        categorie: 'Consumabile',
        suma_lei: 77,
      }),
    ).rejects.toMatchObject({
      kind: 'duplicate_business_id',
      code: '23505',
      tableOrRpc: 'public.cheltuieli_diverse',
      status: 409,
    })
  })

  it('permite salvarea când ownerul are și membership de operator, dar contextul tenantului este consistent', async () => {
    const supabase = createSupabaseMock({ currentTenantId: 'tenant-operator' })
    mocks.getSupabase.mockReturnValue(supabase)
    mocks.getTenantId.mockResolvedValue('tenant-operator')
    mocks.generateBusinessId.mockResolvedValue('INV300')

    const { createInvestitie } = await import('@/lib/supabase/queries/investitii')
    const result = await createInvestitie({
      data: '2026-07-11',
      categorie: 'Utilaje și echipamente',
      suma_lei: 300,
      descriere: 'Owner + operator',
    })

    expect(result.id).toBe('investment-1')
    expect(supabase.investitieInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-operator',
      }),
    )
  })
})

describe('FinancialMutationError shape', () => {
  it('expune un obiect de eroare bogat pentru layer-ele UI', () => {
    const error = new FinancialMutationError({
      code: '23505',
      message: 'duplicate key',
      status: 409,
      module: 'cheltuieli',
      operation: 'upsert',
      tableOrRpc: 'public.cheltuieli_diverse',
      kind: 'duplicate_business_id',
      userMessage: 'ID duplicat.',
    })

    expect(error).toMatchObject({
      code: '23505',
      status: 409,
      module: 'cheltuieli',
      operation: 'upsert',
      tableOrRpc: 'public.cheltuieli_diverse',
      kind: 'duplicate_business_id',
      userMessage: 'ID duplicat.',
    })
  })
})
