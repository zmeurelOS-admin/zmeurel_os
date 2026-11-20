/* @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  deleteTenantScopedData: vi.fn(),
  captureApiError: vi.fn(),
}))

vi.mock('@/lib/monitoring/report-error', () => ({
  captureApiError: (...args: unknown[]) => mocks.captureApiError(...args),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createServiceRoleClient: () => mocks.createServiceRoleClient(),
}))

vi.mock('@/lib/tenant/destructive-cleanup', async (importOriginal) => ({
  // Listele (ex. lanțul de tratamente) rămân cele reale; doar ștergerea comună e simulată.
  ...(await importOriginal<typeof import('@/lib/tenant/destructive-cleanup')>()),
  deleteTenantScopedData: (...args: unknown[]) => mocks.deleteTenantScopedData(...args),
}))

const ENV_KEYS = ['CRON_SECRET', 'DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS', 'DEMO_CLEANUP_MODE'] as const
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))

const HOUR = 60 * 60 * 1000
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString()
const tid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const uid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`

type Row = Record<string, unknown>
type Op = { kind: 'delete' | 'remove' | 'deleteUser' | 'scoped'; target: string; filters?: Array<[string, unknown]> }

/** Client Supabase fals: citește din `db`, înregistrează în `ops` orice ștergere, în ordine. */
function makeAdmin(options: {
  db: Record<string, Row[]>
  users: Array<{ id: string; email: string | null }>
  files?: string[]
  getUserEmail?: (id: string, call: number) => string | null | undefined
}) {
  const db = options.db
  const files = new Set(options.files ?? [])
  const ops: Op[] = []
  let getUserCalls = 0

  class Query implements PromiseLike<{ data: unknown; error: null }> {
    private filters: Array<[string, unknown]> = []
    private isDelete = false
    private single = false
    private limitN: number | null = null
    private rangeAB: [number, number] | null = null

    constructor(private readonly table: string) {}

    select() {
      return this
    }
    order() {
      return this
    }
    eq(column: string, value: unknown) {
      this.filters.push([column, value])
      return this
    }
    limit(n: number) {
      this.limitN = n
      return this
    }
    range(a: number, b: number) {
      this.rangeAB = [a, b]
      return this
    }
    maybeSingle() {
      this.single = true
      return this
    }
    delete() {
      this.isDelete = true
      return this
    }

    private run() {
      const rows = db[this.table] ?? []
      const match = (row: Row) => this.filters.every(([column, value]) => row[column] === value)
      if (this.isDelete) {
        ops.push({ kind: 'delete', target: this.table, filters: [...this.filters] })
        db[this.table] = rows.filter((row) => !match(row))
        return { data: null, error: null }
      }
      let out = rows.filter(match)
      if (this.rangeAB) out = out.slice(this.rangeAB[0], this.rangeAB[1] + 1)
      if (this.limitN !== null) out = out.slice(0, this.limitN)
      if (this.single) return { data: out[0] ?? null, error: null }
      return { data: out, error: null }
    }

    then<A, B>(
      onfulfilled?: ((value: { data: unknown; error: null }) => A | PromiseLike<A>) | null,
      onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ) {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected)
    }
  }

  const admin = {
    from: (table: string) => new Query(table),
    storage: {
      from: (bucket: string) => ({
        list: async (prefix: string, opts: { limit: number; offset: number }) => {
          expect(bucket).toBe('bonuri')
          const children = new Map<string, boolean>()
          for (const path of files) {
            if (!path.startsWith(`${prefix}/`)) continue
            const rest = path.slice(prefix.length + 1)
            const [name, ...more] = rest.split('/')
            children.set(name, more.length === 0 || children.get(name) === true)
          }
          const entries = [...children.entries()].map(([name, isFile]) => ({ name, id: isFile ? `id-${name}` : null }))
          return { data: entries.slice(opts.offset, opts.offset + opts.limit), error: null }
        },
        remove: async (paths: string[]) => {
          expect(bucket).toBe('bonuri')
          for (const path of paths) {
            ops.push({ kind: 'remove', target: path })
            files.delete(path)
          }
          return { data: [], error: null }
        },
      }),
    },
    auth: {
      admin: {
        listUsers: async ({ page, perPage }: { page: number; perPage: number }) => ({
          data: { users: options.users.slice((page - 1) * perPage, page * perPage) },
          error: null,
        }),
        getUserById: async (id: string) => {
          getUserCalls += 1
          const user = options.users.find((u) => u.id === id)
          const email = options.getUserEmail ? options.getUserEmail(id, getUserCalls) : user?.email
          return { data: { user: user ? { id, email: email ?? undefined } : null }, error: null }
        },
        deleteUser: async (id: string) => {
          ops.push({ kind: 'deleteUser', target: id })
          return { data: null, error: null }
        },
      },
    },
  }

  return { admin, ops, files, db }
}

/** O bază cu `demoCount` demo-uri vechi curate (+ ce adaugi). */
function scenario(demoCount: number, extra: { tenants?: Row[]; users?: Array<{ id: string; email: string | null }>; profiles?: Row[] } = {}) {
  const tenants: Row[] = []
  const users: Array<{ id: string; email: string | null }> = []
  const profiles: Row[] = []
  for (let i = 1; i <= demoCount; i += 1) {
    tenants.push({ id: tid(i), owner_user_id: uid(i), created_at: ago(48 + i), is_demo: false, is_association_approved: false })
    users.push({ id: uid(i), email: `guest-${i}@demo.zmeurel.local` })
    profiles.push({ id: uid(i), tenant_id: tid(i), is_superadmin: false })
  }
  return {
    db: {
      tenants: [...tenants, ...(extra.tenants ?? [])],
      profiles: [...profiles, ...(extra.profiles ?? [])],
      association_members: [] as Row[],
      farm_members: [] as Row[],
      shop_orders: [] as Row[],
      shop_order_erp_links: [] as Row[],
      association_product_offers: [] as Row[],
    } as Record<string, Row[]>,
    users: [...users, ...(extra.users ?? [])],
  }
}

function createRequest(secret: string) {
  return new Request('http://localhost:3000/api/cron/demo-tenant-cleanup', {
    method: 'GET',
    headers: { authorization: `Bearer ${secret}` },
  })
}

async function runRoute() {
  vi.resetModules()
  const { GET } = await import('@/app/api/cron/demo-tenant-cleanup/route')
  const response = await GET(createRequest('cron-secret'))
  return { response, payload: (await response.json()) as Record<string, unknown> }
}

describe('GET /api/cron/demo-tenant-cleanup', () => {
  beforeEach(() => {
    mocks.createServiceRoleClient.mockReset()
    mocks.deleteTenantScopedData.mockReset()
    mocks.captureApiError.mockReset()
    process.env.CRON_SECRET = 'cron-secret'
    delete process.env.DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS
    delete process.env.DEMO_CLEANUP_MODE
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key]
      else process.env[key] = originalEnv[key]
    }
  })

  function wireScopedDelete(ops: Op[], fail?: (tenantId: string) => boolean) {
    mocks.deleteTenantScopedData.mockImplementation(async (_admin: unknown, tenantId: string) => {
      ops.push({ kind: 'scoped', target: tenantId })
      if (fail?.(tenantId)) throw new Error('Delete failed for comenzi')
      return { tenantId, steps: [], verification: [], complete: true }
    })
  }

  it('respinge request fără secret valid', async () => {
    vi.resetModules()
    const { GET } = await import('@/app/api/cron/demo-tenant-cleanup/route')
    const response = await GET(createRequest('invalid'))
    expect(response.status).toBe(401)
  })

  it.each([undefined, '', 'STERGE', 'șterge', 'true', 'proba'])(
    'proba (DEMO_CLEANUP_MODE=%s) doar numără: niciun delete / remove / deleteUser',
    async (mode) => {
      if (mode !== undefined) process.env.DEMO_CLEANUP_MODE = mode
      const s = scenario(3, {
        tenants: [
          { id: tid(90), owner_user_id: uid(90), created_at: ago(5), is_demo: false },
          { id: tid(91), owner_user_id: uid(91), created_at: ago(500), is_demo: true },
          { id: tid(92), owner_user_id: uid(92), created_at: ago(500), is_demo: false },
        ],
        users: [
          { id: uid(90), email: 'nou@demo.zmeurel.local' },
          { id: uid(91), email: 'ion@gmail.com' },
          { id: uid(92), email: 'e2e@example.test' },
        ],
      })
      const fake = makeAdmin({
        ...s,
        files: [
          `${tid(1)}/cheltuieli/a.jpg`,
          `${tid(1)}/investitii/b.jpg`,
          `${tid(2)}/cheltuieli/c.jpg`,
          `${tid(91)}/cheltuieli/real.jpg`,
        ],
      })
      mocks.createServiceRoleClient.mockReturnValue(fake.admin)
      wireScopedDelete(fake.ops)

      const { response, payload } = await runRoute()

      expect(response.status).toBe(200)
      expect(payload).toMatchObject({
        ok: true,
        mod: 'proba',
        fermeDeSters: 3,
        fermeInRulare: 3,
        limitaPeRulare: 50,
        fisiereBonuri: 3,
        protejate: { prea_noua: 1 },
        semneFermaReala: [],
      })
      expect(payload.emailuriExemplu).toEqual([
        'guest-3@demo.zmeurel.local',
        'guest-2@demo.zmeurel.local',
        'guest-1@demo.zmeurel.local',
      ])
      expect(fake.ops).toEqual([])
      expect(mocks.deleteTenantScopedData).not.toHaveBeenCalled()
      expect(fake.files.size).toBe(4)
    },
  )

  it('proba arată primele 20 de emailuri și semnele de fermă reală, fără să șteargă', async () => {
    const s = scenario(25, { profiles: [{ id: uid(99), tenant_id: tid(25), is_superadmin: false }] })
    const fake = makeAdmin(s)
    mocks.createServiceRoleClient.mockReturnValue(fake.admin)

    const { payload } = await runRoute()

    expect(payload.mod).toBe('proba')
    expect((payload.emailuriExemplu as string[]).length).toBe(20)
    expect(payload.semneFermaReala).toEqual([
      expect.objectContaining({ tenantId: tid(25), semne: [expect.stringContaining('profiles')] }),
    ])
    expect(fake.ops).toEqual([])
  })

  it('sterge: fișiere → date → tenants → auth, doar pentru demo-urile eligibile', async () => {
    process.env.DEMO_CLEANUP_MODE = 'sterge'
    const s = scenario(2, {
      tenants: [
        { id: tid(91), owner_user_id: uid(91), created_at: ago(500), is_demo: true },
        { id: tid(92), owner_user_id: uid(92), created_at: ago(500), is_demo: false },
      ],
      users: [
        { id: uid(91), email: 'ion@gmail.com' },
        { id: uid(92), email: 'e2e@example.test' },
      ],
    })
    const fake = makeAdmin({
      ...s,
      files: [`${tid(1)}/cheltuieli/a.jpg`, `${tid(1)}/investitii/b.jpg`, `${tid(91)}/cheltuieli/real.jpg`],
    })
    mocks.createServiceRoleClient.mockReturnValue(fake.admin)
    wireScopedDelete(fake.ops)

    const { response, payload } = await runRoute()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({ ok: true, mod: 'sterge', fermeSterse: 2, utilizatoriStersi: 2, fisiereSterse: 2 })
    expect([...fake.files]).toEqual([`${tid(91)}/cheltuieli/real.jpg`])

    // Pentru ferma 1 (a doua în ordine; cea mai veche e ferma 2): ordinea exactă.
    const opsT1 = fake.ops.filter(
      (op) =>
        op.target.startsWith(tid(1)) ||
        op.target === tid(1) ||
        op.target === uid(1) ||
        op.filters?.some(([, value]) => value === tid(1) || value === uid(1)),
    )
    const kinds = opsT1.map((op) => (op.kind === 'delete' ? `delete:${op.target}` : op.kind))
    expect(kinds.slice(0, 2)).toEqual(['remove', 'remove'])
    expect(kinds.indexOf('delete:aplicari_tratament')).toBeLessThan(kinds.indexOf('scoped'))
    expect(kinds.indexOf('delete:produse_fitosanitare')).toBeLessThan(kinds.indexOf('scoped'))
    expect(kinds.indexOf('scoped')).toBeLessThan(kinds.indexOf('delete:tenants'))
    expect(kinds.indexOf('delete:tenants')).toBeLessThan(kinds.indexOf('deleteUser'))
    expect(kinds.at(-1)).toBe('deleteUser')

    const tenantDeletes = fake.ops.filter((op) => op.kind === 'delete' && op.target === 'tenants')
    expect(tenantDeletes).toEqual([
      { kind: 'delete', target: 'tenants', filters: [['id', tid(2)], ['owner_user_id', uid(2)]] },
      { kind: 'delete', target: 'tenants', filters: [['id', tid(1)], ['owner_user_id', uid(1)]] },
    ])
    expect(fake.ops.filter((op) => op.kind === 'deleteUser').map((op) => op.target)).toEqual([uid(2), uid(1)])
    expect(mocks.deleteTenantScopedData).toHaveBeenCalledWith(
      fake.admin,
      tid(1),
      expect.objectContaining({ scope: 'demo_tenant_cleanup', verifyCriticalTables: true }),
    )
    // Nimic despre fermele reale / de test.
    const touched = JSON.stringify(fake.ops)
    for (const id of [tid(91), tid(92), uid(91), uid(92)]) expect(touched).not.toContain(id)
  })

  it('sterge: protecțiile (superadmin, lista din env, asociație) nu se ating', async () => {
    process.env.DEMO_CLEANUP_MODE = 'sterge'
    process.env.DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS = ` ${uid(2).toUpperCase()} `
    const s = scenario(4)
    s.db.profiles.find((p) => p.id === uid(1))!.is_superadmin = true
    s.db.association_members.push({ user_id: uid(3), role: 'viewer' })
    const fake = makeAdmin(s)
    mocks.createServiceRoleClient.mockReturnValue(fake.admin)
    wireScopedDelete(fake.ops)

    const { payload } = await runRoute()

    expect(payload).toMatchObject({
      mod: 'sterge',
      fermeDeSters: 1,
      fermeSterse: 1,
      protejate: { superadmin: 1, lista_protejata: 1, asociatie: 1 },
    })
    expect(fake.ops.filter((op) => op.kind === 'deleteUser').map((op) => op.target)).toEqual([uid(4)])
    const touched = JSON.stringify(fake.ops)
    for (const id of [tid(1), tid(2), tid(3), uid(1), uid(2), uid(3)]) expect(touched).not.toContain(id)
  })

  it('sterge: cel mult 50 de ferme pe rulare, cele mai vechi întâi', async () => {
    process.env.DEMO_CLEANUP_MODE = 'sterge'
    const fake = makeAdmin(scenario(60))
    mocks.createServiceRoleClient.mockReturnValue(fake.admin)
    wireScopedDelete(fake.ops)

    const { payload } = await runRoute()

    expect(payload).toMatchObject({
      fermeDeSters: 60,
      fermeInRulare: 50,
      fermeSterse: 50,
      utilizatoriStersi: 50,
      ramasePentruUrmatoareaRulare: 10,
    })
    const deletedUsers = fake.ops.filter((op) => op.kind === 'deleteUser').map((op) => op.target)
    expect(deletedUsers).toHaveLength(50)
    // Cele mai noi 10 (1..10) rămân pentru noaptea următoare.
    for (let i = 1; i <= 10; i += 1) expect(deletedUsers).not.toContain(uid(i))
  })

  it.each<[string, (s: ReturnType<typeof scenario>) => void]>([
    ['alt utilizator în profiles', (s) => s.db.profiles.push({ id: uid(77), tenant_id: tid(2), is_superadmin: false })],
    ['alt membru în farm_members', (s) => s.db.farm_members.push({ tenant_id: tid(2), user_id: uid(77) })],
    ['comenzi în magazin', (s) => s.db.shop_orders.push({ id: 'o1', tenant_id: tid(2) })],
    ['oferte în asociație', (s) => s.db.association_product_offers.push({ id: 'p1', tenant_id: tid(2) })],
  ])('sterge: semn de fermă reală (%s) oprește rularea înainte de orice ștergere', async (_name, addSign) => {
    process.env.DEMO_CLEANUP_MODE = 'sterge'
    const s = scenario(3)
    addSign(s)
    const fake = makeAdmin({ ...s, files: [`${tid(3)}/cheltuieli/a.jpg`] })
    mocks.createServiceRoleClient.mockReturnValue(fake.admin)
    wireScopedDelete(fake.ops)

    const { response, payload } = await runRoute()

    expect(response.status).toBe(500)
    expect(payload).toMatchObject({ ok: false, mod: 'sterge', oprit: true, fermeSterse: 0 })
    expect(String(payload.error)).toContain(tid(2))
    expect(fake.ops).toEqual([])
    expect(mocks.deleteTenantScopedData).not.toHaveBeenCalled()
    expect(mocks.captureApiError).toHaveBeenCalled()
  })

  it('sterge: reverifică emailul la fiecare fermă și se oprește când nu mai e demo', async () => {
    process.env.DEMO_CLEANUP_MODE = 'sterge'
    const s = scenario(3)
    // Lista inițială (listUsers) spune demo; reverificarea fermei 2 (getUserById) dă un email real,
    // dar abia după ce ferma 3 (cea mai veche) a fost ștearsă.
    let preflightDone = false
    const fake = makeAdmin({
      ...s,
      getUserEmail: (id, call) => {
        if (call > 3) preflightDone = true
        if (preflightDone && id === uid(2)) return 'ion@gmail.com'
        return s.users.find((u) => u.id === id)?.email
      },
    })
    mocks.createServiceRoleClient.mockReturnValue(fake.admin)
    wireScopedDelete(fake.ops)

    const { response, payload } = await runRoute()

    expect(response.status).toBe(500)
    expect(payload).toMatchObject({ ok: false, oprit: true, fermeSterse: 1 })
    expect(String(payload.error)).toContain('emailul proprietarului nu mai e demo')
    expect(fake.ops.filter((op) => op.kind === 'deleteUser').map((op) => op.target)).toEqual([uid(3)])
    const touched = JSON.stringify(fake.ops)
    for (const id of [tid(1), tid(2), uid(1), uid(2)]) expect(touched).not.toContain(id)
  })

  it('sterge: emailul real la reverificare, înainte de prima ștergere = nimic șters', async () => {
    process.env.DEMO_CLEANUP_MODE = 'sterge'
    const s = scenario(2)
    const fake = makeAdmin({ ...s, getUserEmail: (id) => (id === uid(1) ? 'ion@gmail.com' : s.users.find((u) => u.id === id)?.email) })
    mocks.createServiceRoleClient.mockReturnValue(fake.admin)
    wireScopedDelete(fake.ops)

    const { response, payload } = await runRoute()

    expect(response.status).toBe(500)
    expect(payload).toMatchObject({ oprit: true, fermeSterse: 0 })
    expect(fake.ops).toEqual([])
  })

  it('sterge: o fermă care dă eroare nu oprește restul și e raportată', async () => {
    process.env.DEMO_CLEANUP_MODE = 'sterge'
    const fake = makeAdmin(scenario(3))
    mocks.createServiceRoleClient.mockReturnValue(fake.admin)
    wireScopedDelete(fake.ops, (tenantId) => tenantId === tid(2))

    const { response, payload } = await runRoute()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({ ok: true, fermeSterse: 2, utilizatoriStersi: 2 })
    expect(payload.erori).toEqual([expect.stringContaining(tid(2))])
    expect(mocks.captureApiError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ route: '/api/cron/demo-tenant-cleanup', tenantId: tid(2) }),
    )
    // Ferma cu eroare își păstrează rândul din tenants și utilizatorul.
    expect(fake.db.tenants.map((t) => t.id)).toEqual([tid(2)])
    expect(fake.ops.filter((op) => op.kind === 'deleteUser').map((op) => op.target)).toEqual([uid(3), uid(1)])
  })
})
