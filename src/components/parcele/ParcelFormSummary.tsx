'use client'

import { DesktopFormAside } from '@/components/ui/form-dialog-layout'

interface ParcelFormSummaryProps {
  parcelName: string
  typeLabel: string
  purposeLabel: string
  statusLabel: string
  areaLabel: string
  locationLabel: string
  className?: string
}

export function ParcelFormSummary({
  parcelName,
  typeLabel,
  purposeLabel,
  statusLabel,
  areaLabel,
  locationLabel,
  className,
}: ParcelFormSummaryProps) {
  return (
    <div className="space-y-4">
      <DesktopFormAside title="Rezumat teren" className={className}>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">{parcelName}</p>
          <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">
            Verifică rapid contextul terenului înainte de salvare.
          </p>
        </div>

        <dl className="space-y-3 text-sm text-[var(--text-secondary)]">
          <div className="border-t border-[var(--divider)] pt-3">
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Tip</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{typeLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Scop</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{purposeLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Status</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{statusLabel}</dd>
          </div>
          <div className="border-t border-[var(--divider)] pt-3">
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Suprafață</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{areaLabel}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Locație</dt>
            <dd className="mt-0.5 break-words text-[var(--text-primary)]">{locationLabel}</dd>
          </div>
        </dl>
      </DesktopFormAside>

      <DesktopFormAside title="Ghid & recomandări">
        <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>Folosește un nume clar ca să identifici rapid terenul în listă și în rapoarte.</p>
          <p>Adaugă coordonate pentru localizare mai precisă și pentru integrarea meteo.</p>
          <p>Activează raportarea comercială doar pentru terenurile relevante în producție și vânzări.</p>
        </div>
      </DesktopFormAside>
    </div>
  )
}
