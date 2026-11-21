/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const FARM_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const FARM_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const ORDER_A = '11111111-1111-4111-8111-111111111111'
const ORDER_B = '22222222-2222-4222-8222-222222222222'
const ORDER_A_NOUA = '33333333-3333-4333-8333-333333333333'

type ShopOrder = { id: string; tenant_id: string; status: string; azi: boolean }
type Member = {
  id: string
  tenant_id: string
  name: string
  phone: null
  invite_token: string
  is_active: boolean
  role: string
}

const db = vi.hoisted(() => ({
  members: [] as Member[],
  orders: [] as ShopOrder[],
}))

/** Un `shop_orders` minim: `update` schimbă doar rândurile care trec de toate filtrele, ca în Postgres. */
function makeAdmin() {
  return {
    from: (table: string) => {
      if (table === 'farm_members') {
        const filters: Record<string, unknown> = {}
        const query = {
          select: () => query,
          eq: (column: string, value: unknown) => {
            filters[column] = value
            return query
          },
          maybeSingle: async () => ({
            data:
              db.members.find(
                (m) =>
                  m.invite_token === filters.invite_token &&
                  m.is_active === filters.is_active &&
                  m.role === filters.role,
              ) ?? null,
            error: null,
          }),
        }
        return query
      }
      if (table === 'shop_orders') {
        const filters: Record<string, unknown> = {}
        let patch: Partial<ShopOrder> = {}
        let onlyToday = false
        const query = {
          update: (values: Partial<ShopOrder>) => {
            patch = values
            return query
          },
          eq: (column: string, value: unknown) => {
            filters[column] = value
            return query
          },
          or: () => {
            onlyToday = true
            return query
          },
          select: async () => {
            const hit = db.orders.filter(
              (o) =>
                o.id === filters.id &&
                o.tenant_id === filters.tenant_id &&
                o.status === filters.status &&
                (!onlyToday || o.azi),
            )
            hit.forEach((o) => Object.assign(o, patch))
            return { data: hit.map((o) => ({ id: o.id })), error: null }
          },
        }
        return query
      }
      throw new Error(`tabel neașteptat: ${table}`)
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => makeAdmin() }))

async function livreaza(orderId: string, token: string) {
  const { POST } = await import('@/app/api/livrator/deliver/route')
  const response = await POST(
    new Request('https://zmeurel.ro/api/livrator/deliver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, token }),
    }),
  )
  return { status: response.status, json: (await response.json()) as { success: boolean; error?: string } }
}

function statusOf(id: string) {
  return db.orders.find((o) => o.id === id)?.status
}

describe('POST /api/livrator/deliver', () => {
  beforeEach(() => {
    db.members = [
      { id: 'm-a', tenant_id: FARM_A, name: 'Livrator A', phone: null, invite_token: 'token-a', is_active: true, role: 'livrator' },
      { id: 'm-oprit', tenant_id: FARM_A, name: 'Oprit', phone: null, invite_token: 'token-oprit', is_active: false, role: 'livrator' },
    ]
    db.orders = [
      { id: ORDER_A, tenant_id: FARM_A, status: 'in_livrare', azi: true },
      { id: ORDER_B, tenant_id: FARM_B, status: 'in_livrare', azi: true },
      { id: ORDER_A_NOUA, tenant_id: FARM_A, status: 'noua', azi: true },
    ]
  })

  it('livratorul marchează o comandă din traseul de azi al fermei lui', async () => {
    const { status, json } = await livreaza(ORDER_A, 'token-a')
    expect(status).toBe(200)
    expect(json.success).toBe(true)
    expect(statusOf(ORDER_A)).toBe('livrata')
  })

  it('comanda altei ferme nu se atinge, chiar cu token valid', async () => {
    const { status, json } = await livreaza(ORDER_B, 'token-a')
    expect(status).toBe(404)
    expect(json.success).toBe(false)
    expect(statusOf(ORDER_B)).toBe('in_livrare')
  })

  it('o comandă care nu e în livrare nu se marchează livrată', async () => {
    const { status } = await livreaza(ORDER_A_NOUA, 'token-a')
    expect(status).toBe(404)
    expect(statusOf(ORDER_A_NOUA)).toBe('noua')
  })

  it('o comandă din altă zi nu se marchează livrată', async () => {
    db.orders[0].azi = false
    const { status } = await livreaza(ORDER_A, 'token-a')
    expect(status).toBe(404)
    expect(statusOf(ORDER_A)).toBe('in_livrare')
  })

  it('token necunoscut sau livrator dezactivat: 401, nimic schimbat', async () => {
    for (const token of ['token-inexistent', 'token-oprit']) {
      const { status } = await livreaza(ORDER_A, token)
      expect(status).toBe(401)
    }
    expect(statusOf(ORDER_A)).toBe('in_livrare')
  })
})
