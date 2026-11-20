/* @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const mocks = vi.hoisted(() => ({
  db: {} as Record<string, Row[]>,
  users: [] as Array<{ id: string; email: string }>,
  meteo: new Map<string, unknown>(),
  invokes: [] as Array<{ name: string; body: unknown }>,
  failTenant: null as string | null,
  created: [] as Array<{ tenantId: string; type: string; title: string; data: Record<string, unknown>; options: unknown }>,
  captureApiError: vi.fn(),
}))

vi.mock('@/lib/monitoring/report-error', () => ({ captureApiError: mocks.captureApiError }))

vi.mock('@/lib/notifications/create', () => ({
  createNotificationForTenantOwner: async (
    tenantId: string,
    type: string,
    title: string,
    _body: string,
    data: Record<string, unknown>,
    _entityType: string | null,
    _entityId: string | null,
    options: unknown,
  ) => {
    mocks.created.push({ tenantId, type, title, data, options })
    // Ca în realitate: rândul ajunge în `notifications`, deci a doua rulare îl găsește.
    ;(mocks.db.notifications ??= []).push({ id: `n${mocks.created.length}`, type, data })
    return `n${mocks.created.length}`
  },
}))

/** Un query builder minim peste `mocks.db`: eq / in / not is null / ->> / range. */
function query(table: string) {
  const filters: Array<(row: Row) => boolean> = []
  let range: [number, number] | null = null
  const read = (row: Row, column: string) => {
    const [col, key] = column.split('->>')
    const value = row[col]
    return key ? (value as Row | null)?.[key] : value
  }
  const builder = {
    select: () => builder,
    order: () => builder,
    limit: () => builder,
    eq: (column: string, value: unknown) => {
      if (column === 'tenant_id' && value === mocks.failTenant && table !== 'notifications') {
        filters.push(() => {
          throw new Error('boom')
        })
      }
      filters.push((row) => read(row, column) === value)
      return builder
    },
    in: (column: string, values: unknown[]) => {
      filters.push((row) => values.includes(read(row, column)))
      return builder
    },
    not: (column: string, op: string, value: unknown) => {
      if (op === 'is' && value === null) filters.push((row) => read(row, column) !== null && read(row, column) !== undefined)
      return builder
    },
    range: (from: number, to: number) => {
      range = [from, to]
      return builder
    },
    then: (resolve: (value: { data: Row[] | null; error: unknown }) => unknown, reject: (e: unknown) => unknown) => {
      try {
        let rows = (mocks.db[table] ?? []).filter((row) => filters.every((f) => f(row)))
        if (range) rows = rows.slice(range[0], range[1] + 1)
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
      } catch (error) {
        return Promise.resolve({ data: null, error }).then(resolve, reject)
      }
    },
  }
  return builder
}

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => query(table),
    auth: {
      admin: {
        listUsers: async () => ({ data: { users: mocks.users }, error: null }),
      },
    },
    functions: {
      invoke: async (name: string, { body }: { body: { tenant_id: string } }) => {
        mocks.invokes.push({ name, body })
        const data = mocks.meteo.get(body.tenant_id)
        return data ? { data, error: null } : { data: null, error: new Error('fără meteo') }
      },
    },
  }),
}))

const originalCronSecret = process.env.CRON_SECRET

function request(path: string) {
  return new Request(`http://localhost:3000${path}`, { headers: { authorization: 'Bearer cron-secret' } })
}

function seedFerme() {
  mocks.users = [
    { id: 'u1', email: 'ferma1@example.com' },
    { id: 'u2', email: 'ferma2@example.com' },
    { id: 'u-demo', email: 'guest+abc@demo.zmeurel.local' },
  ]
  mocks.db.tenants = [
    { id: 't1', owner_user_id: 'u1', is_demo: false },
    { id: 't2', owner_user_id: 'u2', is_demo: false },
    { id: 't-demo', owner_user_id: 'u-demo', is_demo: false },
    { id: 't-demo2', owner_user_id: 'u1', is_demo: true },
  ]
}

describe('cronurile verificării zilnice', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret'
    vi.useFakeTimers()
    mocks.db = {}
    mocks.users = []
    mocks.meteo = new Map()
    mocks.invokes = []
    mocks.failTenant = null
    mocks.created = []
    mocks.captureApiError.mockReset()
    seedFerme()
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalCronSecret
  })

  it('fără secret: 401', async () => {
    const { GET } = await import('@/app/api/cron/notificari-seara/route')
    const res = await GET(new Request('http://localhost:3000/api/cron/notificari-seara'))
    expect(res.status).toBe(401)
  })

  it('seara: comenzile de mâine, fără demo, o singură dată chiar dacă rulează de două ori', async () => {
    vi.setSystemTime(new Date('2026-11-20T17:00:00Z')) // 19:00 în București
    const comanda = (id: string, tenant_id: string, status: string) => ({
      id,
      tenant_id,
      data_livrare: '2026-11-21',
      status,
      cantitate_kg: 10,
    })
    mocks.db.comenzi = [
      comanda('a', 't1', 'confirmata'),
      comanda('b', 't1', 'in_livrare'),
      comanda('c', 't-demo', 'confirmata'),
      comanda('d', 't-demo2', 'noua'),
    ]
    const { GET } = await import('@/app/api/cron/notificari-seara/route')

    const first = await (await GET(request('/api/cron/notificari-seara'))).json()
    expect(first).toMatchObject({ ok: true, azi: '2026-11-20', fermeVerificate: 2, trimise: { comenzi_maine: 1 }, dubluri: 0, erori: 0 })
    expect(mocks.created).toHaveLength(1)
    expect(mocks.created[0]).toMatchObject({
      tenantId: 't1',
      type: 'comenzi_maine',
      title: '1 comandă de livrat mâine',
      data: { reminder_key: 'maine:t1:2026-11-20' },
      options: { awaitPush: true },
    })

    const second = await (await GET(request('/api/cron/notificari-seara'))).json()
    expect(second).toMatchObject({ trimise: { comenzi_maine: 0 }, dubluri: 1 })
    expect(mocks.created).toHaveLength(1)
  })

  it('dimineața: meteo doar cu loc salvat; o fermă cu eroare nu le oprește pe celelalte', async () => {
    vi.setSystemTime(new Date('2027-01-10T05:00:00Z')) // 7:00 în București
    mocks.db.tenant_settings = [
      { tenant_id: 't1', latitudine_default: 47.6, longitudine_default: 26.2 },
      { tenant_id: 't-demo', latitudine_default: 47.6, longitudine_default: 26.2 },
    ]
    mocks.meteo.set('t1', { available: true, fetchedAt: '2027-01-10T04:30:00Z', forecastTomorrow: { tempMin: -18 } })
    mocks.meteo.set('t2', { available: true, fetchedAt: '2027-01-10T04:30:00Z', forecastTomorrow: { tempMin: -25 } })
    mocks.db.vanzari = [
      // t2: 14 zile, neîncasat
      { id: 'v1', tenant_id: 't2', client_id: 'cl1', data: '2026-12-27', cantitate_kg: 4, pret_lei_kg: 30, status_plata: 'neplatit', suma_incasata_partial_lei: null },
    ]
    mocks.db.clienti = [{ id: 'cl1', tenant_id: 't2', nume_client: 'Ioana Rotaru' }]
    mocks.failTenant = 't1' // vânzările lui t1 nu se pot citi

    const { GET } = await import('@/app/api/cron/notificari-dimineata/route')
    const body = await (await GET(request('/api/cron/notificari-dimineata'))).json()

    // Prognoza s-a cerut doar pentru t1 (t2 n-are loc salvat, t-demo e demo).
    expect(mocks.invokes).toEqual([{ name: 'fetch-meteo', body: { tenant_id: 't1' } }])
    expect(mocks.created.map((n) => [n.tenantId, n.type, n.title])).toEqual([
      ['t1', 'meteo_inghet', 'Ger puternic la noapte: −18 °C'],
      ['t2', 'incasari_restante', 'Ioana Rotaru: 120 lei de 14 zile'],
    ])
    expect(body).toMatchObject({
      ok: true,
      azi: '2027-01-10',
      fermeCuLoc: 1,
      fermeCuMeteo: 1,
      fermeVerificate: 1,
      trimise: { meteo_inghet: 1, meteo_grindina: 0, incasari_restante: 1 },
      erori: 1,
    })
    expect(mocks.captureApiError).toHaveBeenCalledTimes(1)
    expect(mocks.captureApiError.mock.calls[0][1]).toMatchObject({ tenantId: 't1' })
  })

  it('dimineața: dacă fetch-meteo nu răspunde, încearcă get-meteo; fără niciun răspuns, nicio alertă', async () => {
    vi.setSystemTime(new Date('2027-01-10T05:00:00Z'))
    mocks.db.tenant_settings = [{ tenant_id: 't1', latitudine_default: 47.6, longitudine_default: 26.2 }]
    const { GET } = await import('@/app/api/cron/notificari-dimineata/route')
    const body = await (await GET(request('/api/cron/notificari-dimineata'))).json()
    expect(mocks.invokes.map((i) => i.name)).toEqual(['fetch-meteo', 'get-meteo'])
    expect(mocks.created).toEqual([])
    expect(body).toMatchObject({ fermeCuMeteo: 0, erori: 1 })
  })
})
