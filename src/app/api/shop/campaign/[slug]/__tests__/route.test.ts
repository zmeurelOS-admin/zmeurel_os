import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '@/app/api/shop/campaign/[slug]/route'

const maybeSingle = vi.fn()
const order = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'shop_campaigns') {
        const campaignQuery = {
          eq: vi.fn(() => campaignQuery),
          maybeSingle,
        }
        return {
          select: vi.fn(() => campaignQuery),
        }
      }

      if (table === 'shop_campaign_milestones') {
        const milestonesQuery = {
          eq: vi.fn(() => milestonesQuery),
          order,
        }
        return {
          select: vi.fn(() => milestonesQuery),
        }
      }

      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

describe('GET /api/shop/campaign/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  it('returnează numai progresul public al campaniei', async () => {
    maybeSingle.mockResolvedValue({
      data: {
        id: '21d158e1-dfa3-4db3-894b-d64ecad29b45',
        current_count: 321,
        target_qty: 2000,
        status: 'active',
      },
      error: null,
    })
    order.mockResolvedValue({
      data: [
        {
          threshold: 500,
          reward_label: 'un coș cu produse locale',
          reached: false,
        },
      ],
      error: null,
    })

    const response = await GET(new Request('https://example.test/api/shop/campaign/zmeura-2026'), {
      params: Promise.resolve({ slug: 'zmeura-2026' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=30')
    expect(payload).toEqual({
      currentCount: 321,
      targetQty: 2000,
      status: 'active',
      milestones: [
        {
          threshold: 500,
          rewardLabel: 'un coș cu produse locale',
          reached: false,
        },
      ],
    })
    expect(JSON.stringify(payload)).not.toMatch(/phone|customer|tenant/i)
  })

  it('returnează 404 pentru o campanie inexistentă', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })

    const response = await GET(new Request('https://example.test/api/shop/campaign/lipsa'), {
      params: Promise.resolve({ slug: 'lipsa' }),
    })

    expect(response.status).toBe(404)
  })
})
