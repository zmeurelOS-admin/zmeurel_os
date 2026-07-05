/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const TENANT_ID = '99485d6b-f186-49db-a379-bb9a12d34968'

function createSupabaseMock(insertedRow: Record<string, unknown>) {
  const duplicateCheck = {
    eq: vi.fn(() => duplicateCheck),
    ilike: vi.fn(() => duplicateCheck),
    limit: vi.fn(async () => ({ data: [], error: null })),
  }

  const insertSingle = vi.fn(async () => ({ data: insertedRow, error: null }))
  const insertSelect = vi.fn(() => ({ single: insertSingle }))
  const insertFn = vi.fn(() => ({ select: insertSelect }))

  const updateSingle = vi.fn(async () => ({ data: insertedRow, error: null }))
  const updateSelect = vi.fn(() => ({ single: updateSingle }))
  const updateEqTenant = vi.fn(() => ({ select: updateSelect }))
  const updateEqId = vi.fn(() => ({ eq: updateEqTenant }))
  const updateFn = vi.fn((_payload: Record<string, unknown>) => ({ eq: updateEqId }))

  const from = vi.fn((table: string) => {
    if (table !== 'clienti') throw new Error(`Unexpected table: ${table}`)
    return {
      select: vi.fn(() => duplicateCheck),
      insert: insertFn,
      update: updateFn,
    }
  })

  return { from, insertFn, updateFn }
}

describe('createClienți / updateClienți — normalizare telefon', () => {
  beforeEach(() => {
    mocks.getSupabase.mockReset()
    mocks.getTenantId.mockReset()
    mocks.getTenantId.mockResolvedValue(TENANT_ID)
    mocks.generateBusinessId.mockReset()
    mocks.generateBusinessId.mockResolvedValue('C001')
  })

  it('normalizează telefonul la creare, indiferent de formatul introdus în formular', async () => {
    const { createClienți } = await import('@/lib/supabase/queries/clienti')
    const { from, insertFn } = createSupabaseMock({
      id: 'client-1',
      tenant_id: TENANT_ID,
      id_client: 'C001',
      nume_client: 'Ion Popescu',
      telefon: '+40722123456',
      tip: 'standard',
    })
    mocks.getSupabase.mockReturnValue({ from })

    await createClienți({ nume_client: 'Ion Popescu', telefon: '0722 123 456' })

    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ telefon: '+40722123456' }),
    )
  })

  it('păstrează telefon null când nu e completat, fără să arunce eroare', async () => {
    const { createClienți } = await import('@/lib/supabase/queries/clienti')
    const { from, insertFn } = createSupabaseMock({
      id: 'client-2',
      tenant_id: TENANT_ID,
      id_client: 'C001',
      nume_client: 'Fără telefon',
      telefon: null,
      tip: 'standard',
    })
    mocks.getSupabase.mockReturnValue({ from })

    await createClienți({ nume_client: 'Fără telefon' })

    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ telefon: null }),
    )
  })

  it('normalizează telefonul la editare (update)', async () => {
    const { updateClienți } = await import('@/lib/supabase/queries/clienti')
    const { from, updateFn } = createSupabaseMock({
      id: 'client-1',
      tenant_id: TENANT_ID,
      id_client: 'C001',
      nume_client: 'Ion Popescu',
      telefon: '+40745023593',
      tip: 'standard',
    })
    mocks.getSupabase.mockReturnValue({ from })

    await updateClienți('client-1', { telefon: '0040745023593' })

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ telefon: '+40745023593' }),
    )
  })

  it('nu suprascrie telefonul la update dacă acel câmp nu e trimis deloc', async () => {
    const { updateClienți } = await import('@/lib/supabase/queries/clienti')
    const { from, updateFn } = createSupabaseMock({
      id: 'client-1',
      tenant_id: TENANT_ID,
      id_client: 'C001',
      nume_client: 'Nume nou',
      telefon: '+40745023593',
      tip: 'standard',
    })
    mocks.getSupabase.mockReturnValue({ from })

    await updateClienți('client-1', { nume_client: 'Nume nou' })

    // `telefon: undefined` e serializat de PostgREST ca "absent" (JSON.stringify
    // elimină cheile `undefined`), deci update-ul nu atinge coloana telefon.
    const callArg = updateFn.mock.calls[0][0] as Record<string, unknown>
    expect(callArg.telefon).toBeUndefined()
  })
})
