/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  features: { cheiIdempotenta: true } as Record<string, boolean>,
  existing: null as Record<string, unknown> | null,
  insertResult: { data: null as unknown, error: null as unknown },
  inserted: [] as Record<string, unknown>[],
  lookups: 0,
}))

vi.mock('@/lib/schema-features', () => ({
  loadSchemaFeaturesSafe: async () => mocks.features,
}))
vi.mock('@/lib/tenant/get-tenant', () => ({ getTenantId: async () => 'tenant-1' }))
vi.mock('@/lib/supabase/business-ids', () => ({ generateBusinessId: async () => 'CUL-1' }))
vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => {
              mocks.lookups += 1
              return { data: mocks.existing, error: null }
            },
          }),
        }),
      }),
      insert: (payload: Record<string, unknown>) => {
        mocks.inserted.push(payload)
        return { select: () => ({ single: async () => mocks.insertResult }) }
      },
    }),
  }),
}))

import { isClientSyncConflict } from '@/lib/supabase/idempotency'
import { createCulegator } from '@/lib/supabase/queries/culegatori'

const KEY = '11111111-1111-4111-8111-111111111111'

describe('cheia de idempotență la creare', () => {
  beforeEach(() => {
    mocks.features = { cheiIdempotenta: true }
    mocks.existing = null
    mocks.inserted = []
    mocks.lookups = 0
    mocks.insertResult = { data: { id: 'w1', nume_prenume: 'Ion' }, error: null }
  })

  it('recunoaște conflictul pe cheie (23505 pe client_sync_id), nu orice 23505', () => {
    expect(
      isClientSyncConflict({
        code: '23505',
        message: 'duplicate key value violates unique constraint "culegatori_tenant_client_sync_id_uq"',
      }),
    ).toBe(true)
    expect(isClientSyncConflict({ code: '23505', details: 'Key (tenant_id, client_sync_id)=(a, b) already exists.' })).toBe(true)
    expect(isClientSyncConflict({ code: '23505', message: 'duplicate key value violates unique constraint "culegatori_id_culegator_key"' })).toBe(false)
    expect(isClientSyncConflict({ code: '42501' })).toBe(false)
    expect(isClientSyncConflict(null)).toBe(false)
  })

  it('trimite cheia când baza de date are coloana', async () => {
    await createCulegator({ nume_prenume: 'Ion', tarif_lei_kg: 2, client_sync_id: KEY })
    expect(mocks.inserted[0]).toMatchObject({ client_sync_id: KEY, tenant_id: 'tenant-1' })
  })

  it('fără coloană (migrare neaplicată): nu trimite cheia', async () => {
    mocks.features = { cheiIdempotenta: false }
    await createCulegator({ nume_prenume: 'Ion', tarif_lei_kg: 2, client_sync_id: KEY })
    expect(mocks.inserted[0]).not.toHaveProperty('client_sync_id')
    expect(mocks.lookups).toBe(0)
  })

  it('reîncercarea cu aceeași cheie întoarce rândul deja salvat, fără a doua inserare', async () => {
    mocks.existing = { id: 'w1', nume_prenume: 'Ion' }
    const row = await createCulegator({ nume_prenume: 'Ion', tarif_lei_kg: 2, client_sync_id: KEY })
    expect(row).toMatchObject({ id: 'w1' })
    expect(mocks.inserted).toHaveLength(0)
  })

  it('23505 pe cheie la inserare (cereri simultane) = reușită: recitește rândul', async () => {
    mocks.insertResult = {
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint "culegatori_tenant_client_sync_id_uq"' },
    }
    let calls = 0
    const original = mocks.existing
    // Prima căutare (înainte de inserare) nu găsește nimic; a doua (după 23505) găsește rândul.
    Object.defineProperty(mocks, 'existing', {
      configurable: true,
      get: () => (calls++ === 0 ? original : { id: 'w1', nume_prenume: 'Ion' }),
      set: () => {},
    })
    const row = await createCulegator({ nume_prenume: 'Ion', tarif_lei_kg: 2, client_sync_id: KEY })
    expect(row).toMatchObject({ id: 'w1' })
    Object.defineProperty(mocks, 'existing', { configurable: true, writable: true, value: null })
  })
})
