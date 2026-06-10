import { Card, CardContent } from '@/components/ui/card'
import type { CampaignData } from '@/lib/shop/campaign-mock'

import styles from '../comanda.module.css'

type SeasonLeaderboardProps = {
  campaign: CampaignData
}

export function SeasonLeaderboard({ campaign }: SeasonLeaderboardProps) {
  const seasonPrizes = campaign.leaderboard.filter((entry) => entry.seasonPrizeLabel)

  return (
    <section className="px-3" aria-labelledby="season-leaderboard-title">
      <Card className="gap-0 border-[#F3DAD4] bg-[#312E3F] p-[18px] text-white shadow-[0_10px_30px_rgba(49,46,63,0.2)]">
        <CardContent className="space-y-4 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#FFB1AA]">Cei mai pofticioși</p>
            <h2
              id="season-leaderboard-title"
              className={`mt-1 text-[24px] font-semibold text-white ${styles.fontDisplay}`}
            >
              Top sezon
            </h2>
          </div>

          <ol className="space-y-2">
            {campaign.leaderboard.map((entry, index) => (
              <li
                key={entry.anonId}
                className="flex min-w-0 items-center gap-3 rounded-[16px] bg-white/[0.09] px-3 py-3"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#F16B6B] text-sm font-extrabold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{entry.anonId}</p>
                  {entry.city ? <p className="text-xs text-white/60">{entry.city}</p> : null}
                </div>
                <p className="shrink-0 text-right text-sm font-extrabold tabular-nums text-[#FFB1AA]">
                  {entry.count}
                  <span className="ml-1 text-[10px] font-semibold text-white/55">caserole</span>
                </p>
              </li>
            ))}
          </ol>

          <p className="rounded-xl bg-white/[0.08] px-3 py-3 text-xs leading-relaxed text-white/[0.72]">
            Clasamentul este anonimizat. Datele personale nu sunt afișate public.
          </p>

          {seasonPrizes.length > 0 ? (
            <div className="border-t border-white/[0.12] pt-4">
              <p className="text-sm font-extrabold text-white">Premiile finale ale sezonului</p>
              <ul className="mt-2 space-y-1.5 text-xs text-white/75">
                {seasonPrizes.map((entry, index) => (
                  <li key={entry.anonId} className="flex items-start gap-2">
                    <span className="font-extrabold text-[#FFB1AA]">Locul {index + 1}</span>
                    <span>· {entry.seasonPrizeLabel}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}
