'use client'

import Link from 'next/link'

import { CompactPageHeader } from '@/components/layout/CompactPageHeader'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { ParcelaTratamenteFenologieBar } from '@/components/tratamente/ParcelaTratamenteFenologieBar'
import { ParcelaTratamenteManualTrigger } from '@/components/tratamente/ParcelaTratamenteManualTrigger'
import type { StageState } from '@/components/tratamente/StadiuCurentCard'
import { Button } from '@/components/ui/button'
import type { ConfigurareSezon } from '@/lib/tratamente/configurare-sezon'
import type { GrupBiologic } from '@/lib/tratamente/stadii-canonic'

interface ParcelaTratamenteHeaderProps {
  an: number
  backHref: string
  configurareSezon?: ConfigurareSezon | null
  dualStageState?: { floricane: StageState; primocane: StageState } | null
  grupBiologic?: GrupBiologic | null
  parcelaName: string
  showManualTrigger?: boolean
  singleStageState?: StageState | null
}

export function ParcelaTratamenteHeader({
  an,
  backHref,
  configurareSezon = null,
  dualStageState = null,
  grupBiologic,
  parcelaName,
  showManualTrigger,
  singleStageState = null,
}: ParcelaTratamenteHeaderProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const shouldShowManualTrigger = showManualTrigger ?? isDesktop

  return (
    <CompactPageHeader
      title="Protecție & Nutriție"
      subtitle={`${parcelaName} · ${an}`}
      showMobileRightSlot={false}
      rightSlot={
        <span className="hidden h-8 items-center rounded-full border border-white/20 bg-white/12 px-3 text-xs font-semibold text-[var(--text-on-accent)] lg:inline-flex">
          {an}
        </span>
      }
      summary={
        <div className="flex w-full flex-col gap-2">
          <div className="flex w-full items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" className="min-h-9 shrink" asChild>
              <Link href={backHref}>← Înapoi la parcelă</Link>
            </Button>
            {shouldShowManualTrigger ? <ParcelaTratamenteManualTrigger /> : null}
          </div>
          <ParcelaTratamenteFenologieBar
            configurareSezon={configurareSezon}
            dualStageState={dualStageState}
            grupBiologic={grupBiologic}
            singleStageState={singleStageState}
          />
        </div>
      }
    />
  )
}
