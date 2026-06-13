import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '@/app/api/shop/campaign/[slug]/admin/route'

const {
  campaignMaybeSingleMock,
  getSupabaseAdminMock,
  getTenantIdByUserIdMock,
  getUserMock,
  ordersTenantEqMock,
  statusesTenantEqMock,
  winnersTenantEqMock,
} = vi.hoisted(() => ({
  campaignMaybeSingleMock: vi.fn(),
  getSupabaseAdminMock: vi.fn(),
  getTenantIdByUserIdMock: vi.fn(),
  getUserMock: vi.fn(),
  ordersTenantEqMock: vi.fn(),
  statusesTenantEqMock: vi.fn(),
  winnersTenantEqMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table !== 'shop_campaigns') throw new Error(`unexpected table ${table}`)
      const query = {
        eq: vi.fn(() => query),
        maybeSingle: campaignMaybeSingleMock,
      }
      return { select: vi.fn(() => query) }
    },
  }),
}))

vi.mock('@/lib/tenant/get-tenant', () => ({
  getTenantIdByUserId: getTenantIdByUserIdMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: getSupabaseAdminMock,
}))

const campaignId = '21d158e1-dfa3-4db3-894b-d64ecad29b45'
const tenantId = '00000000-0000-4000-8000-000000000301'
const orderId = '00000000-0000-4000-8000-000000000101'
const milestoneId = '00000000-0000-4000-8000-000000000201'

function request() {
  return GET(
    new Request('https://example.test/api/shop/campaign/zmeura-2026/admin'),
    { params: Promise.resolve({ slug: 'zmeura-2026' }) },
  )
}

describe('GET /api/shop/campaign/[slug]/admin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getUserMock.mockResolvedValue({
      data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
    })
    getTenantIdByUserIdMock.mockResolvedValue(tenantId)
    campaignMaybeSingleMock.mockResolvedValue({
      data: {
        id: campaignId,
        slug: 'zmeura-2026',
        title: 'Campania Zmeură 2026',
        current_count: 35,
        target_qty: 2000,
        status: 'active',
      },
      error: null,
    })

    ordersTenantEqMock.mockResolvedValue({
      data: [
        {
          id: orderId,
          created_at: '2026-06-10T08:00:00.000Z',
          customer_name: 'Maria Popescu',
          customer_phone: '0740123456',
          delivery_mode: 'livrare',
          delivery_address: null,
          delivery_city: 'Suceava',
          in_suceava: true,
          delivery_date: null,
          delivery_position: null,
          items: [{ qty: 5 }],
          total_lei: 90,
          notes: null,
          status: 'confirmata',
          notified_wa: false,
        },
      ],
      error: null,
    })
    statusesTenantEqMock.mockResolvedValue({
      data: [
        { status: 'confirmata' },
        { status: 'anulata' },
      ],
      error: null,
    })
    winnersTenantEqMock.mockResolvedValue({
      data: [
        {
          id: orderId,
          customer_name: 'Maria Popescu',
          customer_phone: '0740123456',
        },
      ],
      error: null,
    })

    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === 'shop_orders') {
          return {
            select: (columns: string) => {
              if (columns === '*') {
                const query = {
                  eq: vi.fn((column: string) =>
                    column === 'tenant_id' ? ordersTenantEqMock() : query,
                  ),
                  neq: vi.fn(() => query),
                }
                return query
              }

              if (columns === 'status') {
                const query = {
                  eq: vi.fn((column: string) =>
                    column === 'tenant_id' ? statusesTenantEqMock() : query,
                  ),
                }
                return query
              }

              const query = {
                in: vi.fn(() => query),
                eq: vi.fn((column: string) =>
                  column === 'tenant_id' ? winnersTenantEqMock() : query,
                ),
              }
              return query
            },
          }
        }

        if (table === 'shop_campaign_milestones') {
          const query = {
            eq: vi.fn(() => query),
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: milestoneId,
                  threshold: 25,
                  reward_label: 'O caserolă bonus',
                  reached: true,
                  reached_at: '2026-06-10T08:00:00.000Z',
                  reached_by_order_id: orderId,
                },
                {
                  id: '00000000-0000-4000-8000-000000000202',
                  threshold: 50,
                  reward_label: 'Două caserole bonus',
                  reached: false,
                  reached_at: null,
                  reached_by_order_id: null,
                },
              ],
              error: null,
            }),
          }
          return { select: vi.fn(() => query) }
        }

        if (table === 'shop_campaign_milestone_rewards') {
          const query = {
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  milestone_id: milestoneId,
                  order_id: orderId,
                  status: 'pending',
                },
              ],
              error: null,
            }),
          }
          return { select: vi.fn(() => query) }
        }

        throw new Error(`unexpected admin table ${table}`)
      },
    })
  })

  it('returnează 401 înainte de orice acces service-role când sesiunea lipsește', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })

    const response = await request()

    expect(response.status).toBe(401)
    expect(getSupabaseAdminMock).not.toHaveBeenCalled()
  })

  it('returnează clasamentul complet și toate milestone-urile', async () => {
    const response = await request()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(payload.campaign).toMatchObject({
      id: campaignId,
      currentCount: 35,
      targetQty: 2000,
    })
    expect(payload.leaderboard).toEqual([
      expect.objectContaining({
        rang: 1,
        customerName: 'Maria Popescu',
        customerPhone: '0740123456',
        totalQty: 5,
        finalPrize: '2 kg zmeură + miere + jeleu de zmeure',
      }),
    ])
    expect(payload.activeTotals).toEqual({
      orderCount: 1,
      totalQty: 5,
      totalLei: 90,
    })
    expect(payload.dailySummary).toEqual([
      {
        date: '2026-06-10',
        orderCount: 1,
        totalQty: 5,
        totalLei: 90,
      },
    ])
    expect(payload.deliverySummary).toEqual([
      { mode: 'livrare', orderCount: 1, totalQty: 5, totalLei: 90 },
      { mode: 'ridicare', orderCount: 0, totalQty: 0, totalLei: 0 },
    ])
    expect(payload.zoneSummary).toEqual([
      { zone: 'suceava', orderCount: 1, totalQty: 5 },
      { zone: 'exterior', orderCount: 0, totalQty: 0 },
      { zone: 'unclassified', orderCount: 0, totalQty: 0 },
    ])
    expect(payload.statusSummary).toEqual([
      { status: 'noua', orderCount: 0 },
      { status: 'confirmata', orderCount: 1 },
      { status: 'in_livrare', orderCount: 0 },
      { status: 'livrata', orderCount: 0 },
      { status: 'anulata', orderCount: 1 },
    ])
    expect(payload.deliverySchedule).toEqual([
      {
        date: 'neprogramate',
        label: 'Neprogramate',
        orderCount: 1,
        totalQty: 5,
        totalLei: 90,
      },
    ])
    expect(payload.milestones).toEqual([
      expect.objectContaining({
        id: milestoneId,
        rewardStatus: 'pending',
        winnerName: 'Maria Popescu',
        winnerPhone: '0740123456',
      }),
      expect.objectContaining({
        threshold: 50,
        rewardStatus: 'unreached',
        winnerName: null,
      }),
    ])
  })
})
