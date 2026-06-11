import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { CampaignData } from '@/lib/shop/campaign-mock'

import styles from '../comanda.module.css'

type CampaignMeterProps = {
  campaign: CampaignData | null
}

export function CampaignMeter({ campaign }: CampaignMeterProps) {
  if (!campaign) {
    return (
      <section className="px-3" aria-label="Se încarcă progresul campaniei" aria-busy="true">
        <Card className="min-h-[220px] gap-0 overflow-hidden border-[#F3DAD4] bg-white p-[18px] shadow-[0_10px_30px_rgba(120,100,70,0.12)]">
          <CardContent className="animate-pulse space-y-5">
            <div className="flex items-end justify-between gap-3">
              <div className="flex-1 space-y-3">
                <div className="h-3 w-36 rounded-full bg-[#F3DAD4]" />
                <div className="h-7 w-full max-w-72 rounded-lg bg-[#F6E8E4]" />
              </div>
              <div className="h-12 w-16 rounded-lg bg-[#F6E8E4]" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full rounded-full bg-[#FCE4E1]" />
              <div className="h-3 w-full rounded-full bg-[#F6E8E4]" />
            </div>
            <div className="h-[62px] rounded-[18px] bg-[#FFF4D8]" />
          </CardContent>
        </Card>
      </section>
    )
  }

  const progressPercent = Math.min(100, Math.max(0, (campaign.currentCount / campaign.target) * 100))
  const remainingToNext = Math.max(0, campaign.nextMilestone.threshold - campaign.currentCount)

  return (
    <section className="px-3" aria-labelledby="campaign-meter-title">
      <Card className="gap-0 overflow-hidden border-[#F3DAD4] bg-white p-[18px] shadow-[0_10px_30px_rgba(120,100,70,0.12)]">
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#E15453]">Campania Zmeură 2026</p>
              <h2
                id="campaign-meter-title"
                className={`mt-1 text-[22px] font-semibold leading-tight text-[#312E3F] ${styles.fontDisplay}`}
              >
                Împreună spre {campaign.target.toLocaleString('ro-RO')} de caserole
              </h2>
            </div>
            <p className="shrink-0 text-right text-sm font-bold tabular-nums text-[#312E3F]">
              <span className="block text-[24px] leading-none text-[#F16B6B]">
                {campaign.currentCount.toLocaleString('ro-RO')}
              </span>
              din {campaign.target.toLocaleString('ro-RO')}
            </p>
          </div>

          <div>
            <div className="relative pt-1">
              <Progress
                value={progressPercent}
                aria-label={`${Math.round(progressPercent)}% din obiectivul campaniei`}
                className="h-4 bg-[#FCE4E1] [&_[data-slot=progress-indicator]]:bg-[#F16B6B]"
              />
              <div className="pointer-events-none absolute inset-x-0 top-1 h-4" aria-hidden>
                {campaign.milestones.map((milestone) => (
                  <span
                    key={milestone.threshold}
                    className={`absolute top-0 h-4 w-0.5 -translate-x-1/2 ${
                      milestone.reached ? 'bg-white/90' : 'bg-[#312E3F]/35'
                    }`}
                    style={{ left: `${Math.min(100, (milestone.threshold / campaign.target) * 100)}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-[#312E3F]/55">
              <span>Start</span>
              <span>{Math.round(progressPercent)}% atins</span>
              <span>{campaign.target.toLocaleString('ro-RO')}</span>
            </div>
          </div>

          <div className="rounded-[18px] bg-[#FFF4D8] px-4 py-3 text-[#312E3F]">
            <p className="text-sm font-extrabold">
              {remainingToNext} {remainingToNext === 1 ? 'caserolă' : 'caserole'} până la pragul{' '}
              {campaign.nextMilestone.threshold.toLocaleString('ro-RO')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[#312E3F]/70">
              Comanda care îl trece primește {campaign.nextMilestone.rewardLabel}.
            </p>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
