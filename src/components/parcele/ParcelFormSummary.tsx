'use client'

import { DesktopFormAside } from '@/components/ui/form-dialog-layout'

interface ParcelFormSummaryProps {
  parcelName: string
  typeLabel: string
  cultureLabel: string
  varietyLabel: string
  statusLabel: string
  areaLabel: string
  locationLabel: string
  solarCultureMessage?: string | null
  /** Doar teren Câmp: valoare formatată sau „—”. Dacă e `null`, rândul e ascuns. */
  campPlantCountLabel?: string | null
  className?: string
}

export function ParcelFormSummary({
  parcelName,
  typeLabel,
  cultureLabel,
  varietyLabel,
  statusLabel,
  areaLabel,
  locationLabel,
  solarCultureMessage,
  campPlantCountLabel,
  className,
}: ParcelFormSummaryProps) {
  const showsSolarMessage = Boolean(solarCultureMessage)
  const showsCampPlants = campPlantCountLabel != null

  return (
    <DesktopFormAside title="Rezumat teren" className={className}>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">{parcelName}</p>
      </div>

      <dl className="space-y-1.5 text-sm text-[var(--text-secondary)]">
        <div className="border-t border-[var(--divider)] pt-2">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Tip</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{typeLabel}</dd>
        </div>
        {showsSolarMessage ? (
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Culturi pentru solar</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{solarCultureMessage}</dd>
          </div>
        ) : (
          <>
            <div>
              <dt className="text-xs font-medium text-[var(--text-tertiary)]">Cultură</dt>
              <dd className="mt-0.5 text-[var(--text-primary)]">{cultureLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-[var(--text-tertiary)]">Soi</dt>
              <dd className="mt-0.5 text-[var(--text-primary)]">{varietyLabel}</dd>
            </div>
          </>
        )}
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Status</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{statusLabel}</dd>
        </div>
        <div className="border-t border-[var(--divider)] pt-2">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Suprafață</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{areaLabel}</dd>
        </div>
        {showsCampPlants ? (
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Număr plante</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{campPlantCountLabel}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Locație</dt>
          <dd className="mt-0.5 break-words text-[var(--text-primary)]">{locationLabel}</dd>
        </div>
      </dl>
    </DesktopFormAside>
  )
}
