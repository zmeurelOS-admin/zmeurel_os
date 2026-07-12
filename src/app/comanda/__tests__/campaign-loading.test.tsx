import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ShopClient } from '@/app/comanda/ShopClient'
import type { CampaignSnapshot } from '@/lib/shop/campaign-mock'

const PRODUCTS = [
  {
    id: 'zmeura',
    name: 'Zmeură',
    description: 'Zmeură proaspătă',
    unit_label: 'Caserolă 500 g',
    price_lei: 18,
    bulk_threshold_kg: null,
    bulk_price_lei: null,
    available: true,
    sort_order: 1,
  },
]

const LIVE_CAMPAIGN: CampaignSnapshot = {
  currentCount: 273,
  targetQty: 2000,
  status: 'active',
  milestones: [
    {
      threshold: 300,
      rewardLabel: '+1 caserolă 500 g',
      reached: false,
    },
  ],
  leaderboard: [],
}

function campaignResponse() {
  return new Response(JSON.stringify(LIVE_CAMPAIGN), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('ShopClient campaign loading', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('afișează skeleton până la primul răspuns live, fără flash cu valoarea mock', async () => {
    let resolveCampaign: ((response: Response) => void) | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveCampaign = resolve
          }),
      ),
    )

    render(<ShopClient loadError={null} products={PRODUCTS} />)

    expect(screen.getByLabelText('Se încarcă progresul campaniei')).toBeInTheDocument()
    expect(screen.getByLabelText('Se încarcă pragurile campaniei')).toBeInTheDocument()
    expect(screen.queryByText('498')).not.toBeInTheDocument()

    await act(async () => {
      resolveCampaign?.(campaignResponse())
    })

    expect(await screen.findByText('273')).toBeInTheDocument()
    expect(screen.queryByLabelText('Se încarcă progresul campaniei')).not.toBeInTheDocument()
  })

  it('folosește fallback după retry-uri și recuperează datele live la revenirea online', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)

    render(<ShopClient loadError={null} products={PRODUCTS} />)

    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(screen.getByText('498')).toBeInTheDocument()

    fetchMock.mockResolvedValueOnce(campaignResponse())
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(screen.getByText('273')).toBeInTheDocument()
    expect(screen.queryByText('498')).not.toBeInTheDocument()
  })
})
