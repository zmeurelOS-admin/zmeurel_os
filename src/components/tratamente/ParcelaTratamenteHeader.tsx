import Link from 'next/link'

import { CompactPageHeader } from '@/components/layout/CompactPageHeader'
import { ParcelaTratamenteManualTrigger } from '@/components/tratamente/ParcelaTratamenteManualTrigger'
import { Button } from '@/components/ui/button'

interface ParcelaTratamenteHeaderProps {
  an: number
  backHref: string
  parcelaName: string
}

export function ParcelaTratamenteHeader({
  an,
  backHref,
  parcelaName,
}: ParcelaTratamenteHeaderProps) {
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
        <div className="flex w-full items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" className="min-h-9 shrink" asChild>
            <Link href={backHref}>← Înapoi la parcelă</Link>
          </Button>
          <ParcelaTratamenteManualTrigger />
        </div>
      }
    />
  )
}
