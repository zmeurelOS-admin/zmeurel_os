import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Serverul, pe scurt: ce coloane lipsesc și ce cereri a primit. */
const server = vi.hoisted(() => ({
  missing: new Set<string>(),
  requests: [] as string[],
  /** Cererea comună (prin `tenants`) pică din alt motiv decât o coloană lipsă. */
  combinedBroken: false,
}))

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({
    from: (table: string) => ({
      select: (columns: string) => {
        const run = async () => {
          server.requests.push(`${table}?${columns}`)
          if (table === 'tenants') {
            if (server.combinedBroken) return { error: { code: 'PGRST200', message: 'relationship not found' } }
            // `id,comenzi(prioritara,client_sync_id),…` → `comenzi.prioritara`, `comenzi.client_sync_id`, …
            const cerute = [...columns.matchAll(/(\w+)\(([^)]*)\)/g)].flatMap(([, child, cols]) =>
              cols.split(',').map((col) => `${child}.${col}`),
            )
            const lipsa = cerute.find((coloana) => server.missing.has(coloana))
            return lipsa ? { error: { code: '42703', message: `column ${lipsa} does not exist` } } : { error: null }
          }
          return server.missing.has(`${table}.${columns}`)
            ? { error: { code: '42703', message: `column ${table}.${columns} does not exist` } }
            : { error: null }
        }
        // Interogarea se poate lungi cu `.limit()` și se execută la `await`.
        const query: { limit: () => typeof query; then: PromiseLike<{ error: unknown }>['then'] } = {
          limit: () => query,
          then: (onFulfilled, onRejected) => run().then(onFulfilled, onRejected),
        }
        return query
      },
    }),
  }),
}))

/** O „sesiune” nouă a aplicației: modulul pornește de la zero, `localStorage` rămâne. */
async function sesiuneNoua() {
  vi.resetModules()
  return import('@/lib/schema-features')
}

describe('verificarea structurii bazei de date, ținută minte în browser', () => {
  beforeEach(() => {
    server.missing = new Set()
    server.requests = []
    server.combinedBroken = false
    window.localStorage.clear()
  })

  it('prima deschidere, cu toate migrările aplicate: o singură cerere pentru toate grupurile', async () => {
    const { loadSchemaFeatures } = await sesiuneNoua()
    const features = await loadSchemaFeatures()

    expect(Object.values(features).every(Boolean)).toBe(true)
    expect(server.requests).toHaveLength(1)
    expect(server.requests[0]).toContain('tenants?id,')
    expect(server.requests[0]).toContain('comenzi(prioritara,client_sync_id)')
    expect(server.requests[0]).toContain('tenant_settings(pret_standard_perioada,acasa_perioada_mod)')
  })

  it('următoarele deschideri: nicio cerere', async () => {
    await (await sesiuneNoua()).loadSchemaFeatures()
    server.requests = []

    const { loadSchemaFeatures } = await sesiuneNoua()
    const features = await loadSchemaFeatures()

    expect(Object.values(features).every(Boolean)).toBe(true)
    expect(server.requests).toEqual([])
  })

  it('o migrare neaplicată: se află care grup lipsește, iar data viitoare se mai caută doar acela', async () => {
    server.missing = new Set(['aplicari_tratament.lot_id'])
    const prima = await (await sesiuneNoua()).loadSchemaFeatures()

    expect(prima.tratamenteLot).toBe(false)
    expect(prima.comenziPrioritara).toBe(true)
    // O cerere comună (care pică) + câte una pe grup.
    expect(server.requests).toHaveLength(1 + Object.keys(prima).length)

    server.requests = []
    const aDoua = await (await sesiuneNoua()).loadSchemaFeatures()
    expect(aDoua.tratamenteLot).toBe(false)
    expect(server.requests).toEqual(['aplicari_tratament?lot_id'])

    // Migrarea a fost aplicată între timp: grupul apare și rămâne ținut minte.
    server.missing = new Set()
    server.requests = []
    const aTreia = await (await sesiuneNoua()).loadSchemaFeatures()
    expect(aTreia.tratamenteLot).toBe(true)
    expect(server.requests).toEqual(['aplicari_tratament?lot_id'])

    server.requests = []
    await (await sesiuneNoua()).loadSchemaFeatures()
    expect(server.requests).toEqual([])
  })

  it('cererea comună nu merge: se verifică pe rând, cu același rezultat', async () => {
    server.combinedBroken = true
    const { loadSchemaFeatures } = await sesiuneNoua()
    const features = await loadSchemaFeatures()

    expect(Object.values(features).every(Boolean)).toBe(true)
    expect(server.requests).toHaveLength(1 + Object.keys(features).length)
  })

  it('în aceeași sesiune verificarea se face o singură dată', async () => {
    const { loadSchemaFeatures } = await sesiuneNoua()
    await Promise.all([loadSchemaFeatures(), loadSchemaFeatures()])
    await loadSchemaFeatures()
    expect(server.requests).toHaveLength(1)
  })
})
