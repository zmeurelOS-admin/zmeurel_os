import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { CompactPageHeader } from '@/components/layout/CompactPageHeader'
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
      subtitle={parcelaName}
      showMobileRightSlot
      rightSlot={
        <span className="inline-flex h-8 items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--text-primary)] lg:border-white/20 lg:bg-white/12 lg:text-[var(--text-on-accent)]">
          {an}
        </span>
      }
      summary={
        <div className="flex items-center justify-start">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Înapoi la parcelă
            </Link>
          </Button>
        </div>
      }
    />
  )
}
