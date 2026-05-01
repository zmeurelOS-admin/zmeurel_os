'use client'

import { DesktopFormAside } from '@/components/ui/form-dialog-layout'
import { cn } from '@/lib/utils'

export interface CulturaFormSummaryProps {
  parcelaLabel?: string
  tipPlantaDisplay: string
  soiDisplay: string
  suprafataDisplay: string
  plantCountFieldTitle: string
  plantCountDisplay: string
  rowCountFieldTitle: string
  rowCountDisplay: string
  rowSpacingFieldTitle: string
  rowSpacingDisplay: string
  showRowCount: boolean
  showRowSpacing: boolean
  dataPlantariiDisplay: string
  intervalTratamentDisplay: string
  observatiiDisplay: string
  className?: string
}

export function CulturaFormSummary({
  parcelaLabel,
  tipPlantaDisplay,
  soiDisplay,
  suprafataDisplay,
  plantCountFieldTitle,
  plantCountDisplay,
  rowCountFieldTitle,
  rowCountDisplay,
  rowSpacingFieldTitle,
  rowSpacingDisplay,
  showRowCount,
  showRowSpacing,
  dataPlantariiDisplay,
  intervalTratamentDisplay,
  observatiiDisplay,
  className,
}: CulturaFormSummaryProps) {
  return (
    <DesktopFormAside title="Rezumat cultură" className={className}>
      {parcelaLabel ? (
        <div className="space-y-0.5">
          <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">{parcelaLabel}</p>
        </div>
      ) : null}

      <dl className="space-y-1.5 text-sm text-[var(--text-secondary)]">
        <div className={cn(parcelaLabel && 'border-t border-[var(--divider)] pt-2')}>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Tip plantă</dt>
          <dd className="mt-0.5 font-semibold text-[var(--text-primary)]">{tipPlantaDisplay}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Soi / varietate</dt>
          <dd className="mt-0.5 font-semibold text-[var(--text-primary)]">{soiDisplay}</dd>
        </div>
        <div className="border-t border-[var(--divider)] pt-2">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Suprafață ocupată</dt>
          <dd className="mt-0.5 font-semibold text-[var(--text-primary)]">{suprafataDisplay}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">{plantCountFieldTitle}</dt>
          <dd className="mt-0.5 font-semibold text-[var(--text-primary)]">{plantCountDisplay}</dd>
        </div>
        {showRowCount ? (
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">{rowCountFieldTitle}</dt>
            <dd className="mt-0.5 font-semibold text-[var(--text-primary)]">{rowCountDisplay}</dd>
          </div>
        ) : null}
        {showRowSpacing ? (
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">{rowSpacingFieldTitle}</dt>
            <dd className="mt-0.5 font-semibold text-[var(--text-primary)]">{rowSpacingDisplay}</dd>
          </div>
        ) : null}
        <div className="border-t border-[var(--divider)] pt-2">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Data plantării</dt>
          <dd className="mt-0.5 font-semibold text-[var(--text-primary)]">{dataPlantariiDisplay}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Interval tratament recomandat</dt>
          <dd className="mt-0.5 font-semibold text-[var(--text-primary)]">{intervalTratamentDisplay}</dd>
        </div>
        <div className="border-t border-[var(--divider)] pt-2">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Observații</dt>
          <dd className="mt-0.5 break-words font-semibold text-[var(--text-primary)]">{observatiiDisplay}</dd>
        </div>
      </dl>
    </DesktopFormAside>
  )
}
