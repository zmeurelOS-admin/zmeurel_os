import { describe, expect, it } from 'vitest'

import { CAMPAIGN_DATA, checkMilestoneHit } from '@/lib/shop/campaign-mock'

describe('campaign milestone stub', () => {
  it('marchează pragul doar când noua cantitate îl traversează', () => {
    expect(
      checkMilestoneHit(CAMPAIGN_DATA.currentCount, 1, CAMPAIGN_DATA.nextMilestone),
    ).toBe(false)
    expect(
      checkMilestoneHit(CAMPAIGN_DATA.currentCount, 2, CAMPAIGN_DATA.nextMilestone),
    ).toBe(true)
  })

  it('nu marchează un prag deja atins sau o cantitate invalidă', () => {
    expect(
      checkMilestoneHit(CAMPAIGN_DATA.currentCount, 0, CAMPAIGN_DATA.nextMilestone),
    ).toBe(false)
    expect(
      checkMilestoneHit(300, 10, {
        ...CAMPAIGN_DATA.nextMilestone,
        threshold: 300,
        reached: true,
      }),
    ).toBe(false)
  })
})
