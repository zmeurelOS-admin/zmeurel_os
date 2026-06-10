import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { CampaignMeter } from '@/app/comanda/components/CampaignMeter'
import { CampaignMilestones } from '@/app/comanda/components/CampaignMilestones'
import { CampaignRules } from '@/app/comanda/components/CampaignRules'
import { SeasonLeaderboard } from '@/app/comanda/components/SeasonLeaderboard'
import { CAMPAIGN_DATA } from '@/lib/shop/campaign-mock'

describe('campaign sections', () => {
  it('derivează meter-ul și conținutul public din CampaignData', () => {
    render(
      <>
        <CampaignMeter campaign={CAMPAIGN_DATA} />
        <SeasonLeaderboard campaign={CAMPAIGN_DATA} />
        <CampaignRules campaign={CAMPAIGN_DATA} />
      </>,
    )

    expect(screen.getByText('498')).toBeInTheDocument()
    expect(screen.getByText('2 caserole până la pragul 500')).toBeInTheDocument()
    expect(screen.getByText('Client Zmeurel #07')).toBeInTheDocument()
    expect(
      screen.getByText('Comanda care trece un prag primește bonusul afișat pentru acel prag.'),
    ).toBeInTheDocument()
  })

  it('afișează inițial cinci praguri și extinde restul la cerere', async () => {
    const user = userEvent.setup()
    render(<CampaignMilestones campaign={CAMPAIGN_DATA} />)

    expect(screen.getByText('1.000 caserole')).toBeInTheDocument()
    expect(screen.queryByText('1.250 caserole')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Vezi toate pragurile' }))

    expect(screen.getByText('1.250 caserole')).toBeInTheDocument()
    expect(screen.getByText('2.000 caserole')).toBeInTheDocument()
  })
})
