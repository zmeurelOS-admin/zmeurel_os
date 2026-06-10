import { describe, expect, it } from 'vitest'

import {
  CAMPAIGN_DATA,
  isCampaignSnapshot,
  mergeCampaignSnapshot,
} from '@/lib/shop/campaign-mock'

describe('campaign snapshot', () => {
  it('înlocuiește progresul mock și derivă următorul milestone din datele live', () => {
    const campaign = mergeCampaignSnapshot({
      currentCount: 300,
      targetQty: 2000,
      status: 'active',
      milestones: [
        { threshold: 150, rewardLabel: 'Bonus 1', reached: true },
        { threshold: 300, rewardLabel: 'Bonus 2', reached: true },
        { threshold: 500, rewardLabel: 'Bonus 3', reached: false },
      ],
      leaderboard: [
        {
          anonId: '#A3F2B7C1',
          city: 'Suceava',
          count: 22,
          seasonPrizeLabel: null,
        },
      ],
    })

    expect(campaign.currentCount).toBe(300)
    expect(campaign.target).toBe(2000)
    expect(campaign.nextMilestone).toEqual({
      threshold: 500,
      rewardLabel: 'Bonus 3',
      reached: false,
      isNext: true,
    })
    expect(campaign.leaderboard).toEqual([
      {
        anonId: '#A3F2B7C1',
        city: 'Suceava',
        count: 22,
        seasonPrizeLabel: null,
      },
    ])
  })

  it('ignoră pragurile nereconciliate aflate deja sub progresul curent', () => {
    const campaign = mergeCampaignSnapshot({
      currentCount: 160,
      targetQty: 2000,
      status: 'active',
      milestones: [
        { threshold: 150, rewardLabel: 'Bonus vechi', reached: false },
        { threshold: 300, rewardLabel: 'Bonus următor', reached: false },
      ],
      leaderboard: [],
    })

    expect(campaign.milestones[0].isNext).toBe(false)
    expect(campaign.milestones[1].isNext).toBe(true)
    expect(campaign.nextMilestone.threshold).toBe(300)
    expect(campaign.leaderboard).toBe(CAMPAIGN_DATA.leaderboard)
  })

  it('respinge payloaduri publice incomplete', () => {
    expect(
      isCampaignSnapshot({
        currentCount: 10,
        targetQty: 2000,
        status: 'active',
        milestones: [{ threshold: 150, rewardLabel: 'Bonus', reached: false }],
        leaderboard: [],
      }),
    ).toBe(true)
    expect(isCampaignSnapshot({ currentCount: 10, milestones: [] })).toBe(false)
  })
})
