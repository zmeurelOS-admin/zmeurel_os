/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { id: string; delta_kg: number; tip: string; client_sync_id: string | null }
type RpcArgs = { p_tip: string; p_delta_kg: number; p_client_sync_id?: string }

const mocks = vi.hoisted(() => ({
  /** Serverul are parametrul `p_client_sync_id` (migrarea aplicată)? */
  areCheie: true,
  rows: [] as { id: string; delta_kg: number; tip: string; client_sync_id: string | null }[],
  calls: [] as Record<string, unknown>[],
  /** Eroarea întoarsă de următorul apel RPC (o singură dată). */
  nextError: null as { code?: string; message?: string } | null,
}))

vi.mock('@/lib/tenant/get-tenant', () => ({ getTenantId: async () => 'tenant-1' }))
vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({
    // Se poartă ca `create_ajustare_stoc` din migrarea 20261121190000: o cheie deja scrisă întoarce rândul ei.
    rpc: async (_fn: string, args: RpcArgs) => {
      mocks.calls.push(args)
      if ('p_client_sync_id' in args && !mocks.areCheie) {
        return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.create_ajustare_stoc' } }
      }
      if (mocks.nextError) {
        const error = mocks.nextError
        mocks.nextError = null
        return { data: null, error }
      }
      const key = args.p_client_sync_id ?? null
      const existing = key ? mocks.rows.find((row) => row.client_sync_id === key) : undefined
      if (existing) return { data: existing, error: null }
      const row: Row = { id: `a${mocks.rows.length + 1}`, delta_kg: args.p_delta_kg, tip: args.p_tip, client_sync_id: key }
      mocks.rows.push(row)
      return { data: row, error: null }
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: (_column: string, key: string) => ({
            maybeSingle: async () => ({ data: mocks.rows.find((row) => row.client_sync_id === key) ?? null, error: null }),
          }),
        }),
      }),
    }),
  }),
}))

import { createAjustareStoc, resetAjustariStocCheieCache } from '@/lib/supabase/queries/ajustari-stoc'

const KEY = '22222222-2222-4222-8222-222222222222'

describe('ajustarea de stoc cu cheie de idempotență', () => {
  beforeEach(() => {
    mocks.areCheie = true
    mocks.rows = []
    mocks.calls = []
    mocks.nextError = null
    resetAjustariStocCheieCache()
  })

  it('aceeași cheie de două ori: un singur rând', async () => {
    const prima = await createAjustareStoc({ tip: 'pierdere', cantitateKg: 4, clientSyncId: KEY })
    const aDoua = await createAjustareStoc({ tip: 'pierdere', cantitateKg: 4, clientSyncId: KEY })
    expect(mocks.rows).toHaveLength(1)
    expect(aDoua.id).toBe(prima.id)
    expect(mocks.calls[0]).toMatchObject({ p_client_sync_id: KEY, p_delta_kg: -4 })
  })

  it('chei diferite: două ajustări', async () => {
    await createAjustareStoc({ tip: 'pierdere', cantitateKg: 4, clientSyncId: KEY })
    await createAjustareStoc({ tip: 'pierdere', cantitateKg: 4, clientSyncId: '33333333-3333-4333-8333-333333333333' })
    expect(mocks.rows).toHaveLength(2)
  })

  it('fără migrare (PGRST202): salvează fără cheie și nu mai încearcă a doua oară cu ea', async () => {
    mocks.areCheie = false
    await createAjustareStoc({ tip: 'corectie_plus', cantitateKg: 2, clientSyncId: KEY })
    expect(mocks.rows).toHaveLength(1)
    expect(mocks.calls).toHaveLength(2)
    expect(mocks.calls[1]).not.toHaveProperty('p_client_sync_id')

    await createAjustareStoc({ tip: 'corectie_plus', cantitateKg: 2, clientSyncId: '33333333-3333-4333-8333-333333333333' })
    expect(mocks.calls).toHaveLength(3)
    expect(mocks.calls[2]).not.toHaveProperty('p_client_sync_id')
  })

  it('23505 pe cheie (două cereri simultane): recitește rândul, fără eroare', async () => {
    mocks.rows = [{ id: 'a1', delta_kg: -4, tip: 'pierdere', client_sync_id: KEY }]
    mocks.nextError = {
      code: '23505',
      message: 'duplicate key value violates unique constraint "ajustari_stoc_tenant_client_sync_id_uq"',
    }
    const row = await createAjustareStoc({ tip: 'pierdere', cantitateKg: 4, clientSyncId: KEY })
    expect(row.id).toBe('a1')
    expect(mocks.rows).toHaveLength(1)
  })

  it('o altă eroare rămâne eroare', async () => {
    mocks.nextError = { code: 'P0001', message: 'STOC_INSUFICIENT' }
    await expect(createAjustareStoc({ tip: 'pierdere', cantitateKg: 4, clientSyncId: KEY })).rejects.toThrow('Stoc insuficient')
    expect(mocks.rows).toHaveLength(0)
  })
})
