'use client'

import { useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import type { CampaignData } from '@/lib/shop/campaign-mock'

import styles from '../comanda.module.css'

type CampaignMilestonesProps = {
  campaign: CampaignData
}

const INITIAL_VISIBLE_MILESTONES = 5

export function CampaignMilestones({ campaign }: CampaignMilestonesProps) {
  const [showAll, setShowAll] = useState(false)
  const visibleMilestones = showAll
    ? campaign.milestones
    : campaign.milestones.slice(0, INITIAL_VISIBLE_MILESTONES)
  const hasHiddenMilestones = campaign.milestones.length > INITIAL_VISIBLE_MILESTONES

  return (
    <section className="px-3" aria-labelledby="campaign-milestones-title">
      <Card className="gap-0 border-[#F3DAD4] bg-white p-[18px] shadow-[0_8px_26px_rgba(120,100,70,0.1)]">
        <CardContent className="space-y-0">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#E15453]">Bonusuri pe drum</p>
            <h2
              id="campaign-milestones-title"
              className={`mt-1 text-[24px] font-semibold text-[#312E3F] ${styles.fontDisplay}`}
            >
              Praguri și premii
            </h2>
          </div>

          <ol className="space-y-2">
            {visibleMilestones.map((milestone) => (
              <li
                key={milestone.threshold}
                className={`flex min-w-0 items-center gap-3 rounded-[16px] border px-3 py-3 ${
                  milestone.isNext
                    ? 'border-[#F16B6B] bg-[#FFF0ED] shadow-[0_4px_14px_rgba(241,107,107,0.12)]'
                    : 'border-[#F3DAD4] bg-[#FFF9F7]'
                } ${milestone.reached ? 'opacity-55' : ''}`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-extrabold ${
                    milestone.reached ? 'bg-[#E8F5EE] text-[#0D9B5C]' : 'bg-white text-[#F16B6B]'
                  }`}
                  aria-hidden
                >
                  {milestone.reached ? '✓' : milestone.threshold / 50}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold tabular-nums text-[#312E3F]">
                      {milestone.threshold.toLocaleString('ro-RO')} caserole
                    </p>
                    {milestone.isNext ? (
                      <span className="rounded-full bg-[#F16B6B] px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
                        URMĂTOR
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#312E3F]/70">{milestone.rewardLabel}</p>
                </div>
              </li>
            ))}
          </ol>

          {hasHiddenMilestones ? (
            <button
              type="button"
              onClick={() => setShowAll((current) => !current)}
              aria-expanded={showAll}
              className="mt-4 min-h-11 w-full rounded-xl border border-[#F3DAD4] bg-[#FFF6F3] px-4 text-sm font-bold text-[#312E3F] transition active:scale-[0.985]"
            >
              {showAll ? 'Ascunde pragurile finale' : 'Vezi toate pragurile'}
            </button>
          ) : null}

          <p className="mt-4 rounded-xl bg-[#FFF6F3] px-3 py-3 text-xs leading-relaxed text-[#312E3F]/72">
            Comanda care trece un prag primește bonusul afișat. Premiile se acordă o singură dată per prag
            și se validează la livrare.
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
