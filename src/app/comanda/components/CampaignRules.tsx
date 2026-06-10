import { Card, CardContent } from '@/components/ui/card'
import type { CampaignData } from '@/lib/shop/campaign-mock'

import styles from '../comanda.module.css'

type CampaignRulesProps = {
  campaign: CampaignData
}

export function CampaignRules({ campaign }: CampaignRulesProps) {
  return (
    <section className="px-3" aria-labelledby="campaign-rules-title">
      <Card className="gap-0 border-[#F3DAD4] bg-white p-[18px] shadow-[0_8px_24px_rgba(120,100,70,0.09)]">
        <CardContent className="space-y-0">
          <h2
            id="campaign-rules-title"
            className={`text-[24px] font-semibold text-[#312E3F] ${styles.fontDisplay}`}
          >
            Regulile campaniei
          </h2>
          <ul className="mt-4 space-y-3">
            {campaign.rules.map((rule, index) => (
              <li key={rule} className="flex items-start gap-3 text-sm leading-relaxed text-[#312E3F]/78">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#FFF0ED] text-xs font-extrabold text-[#E15453]">
                  {index + 1}
                </span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
