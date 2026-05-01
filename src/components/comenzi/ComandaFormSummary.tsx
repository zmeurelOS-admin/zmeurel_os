'use client'

import StatusBadge from '@/components/ui/StatusBadge'
import { DesktopFormAside } from '@/components/ui/form-dialog-layout'

interface ComandaFormSummaryProps {
  clientName: string
  phone: string
  location: string
  quantityLabel: string
  unitPriceLabel: string
  totalLabel: string
  statusLabel: string
  statusVariant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'
  notes?: string
  className?: string
}

export function ComandaFormSummary({
  clientName,
  phone,
  location,
  quantityLabel,
  unitPriceLabel,
  totalLabel,
  statusLabel,
  statusVariant,
  notes,
  className,
}: ComandaFormSummaryProps) {
  const trimmedNotes = notes?.trim() ?? ''

  return (
    <div className="space-y-4">
      <DesktopFormAside title="Rezumat comandă" className={className}>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">{clientName}</p>
          <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">
            Verifică livrarea și totalul estimat înainte de salvare.
          </p>
        </div>

        <dl className="space-y-3 text-sm text-[var(--text-secondary)]">
          <div className="border-t border-[var(--divider)] pt-3">
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Telefon</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{phone}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Locație livrare</dt>
            <dd className="mt-0.5 break-words text-[var(--text-primary)]">{location}</dd>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-[var(--divider)] bg-[var(--surface-card)] p-3 text-xs">
            <div>
              <span className="text-[var(--text-tertiary)]">Cantitate</span>
              <p className="font-medium tabular-nums text-[var(--text-primary)]">{quantityLabel}</p>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Preț / kg</span>
              <p className="font-medium tabular-nums text-[var(--text-primary)]">{unitPriceLabel}</p>
            </div>
          </div>
          <div className="border-t border-[var(--divider)] pt-3">
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Total estimat</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-primary)]">
              {totalLabel}
            </dd>
          </div>
        </dl>

        <div className="border-t border-[var(--divider)] pt-3">
          <p className="text-xs font-medium text-[var(--text-tertiary)]">Status</p>
          <div className="mt-2">
            <StatusBadge text={statusLabel} variant={statusVariant} />
          </div>
        </div>

        {trimmedNotes ? (
          <div className="border-t border-[var(--divider)] pt-3">
            <p className="text-xs font-medium text-[var(--text-tertiary)]">Observații</p>
            <p className="mt-1 break-words text-xs leading-relaxed text-[var(--text-secondary)]">
              {trimmedNotes.length > 220 ? `${trimmedNotes.slice(0, 220)}…` : trimmedNotes}
            </p>
          </div>
        ) : null}
      </DesktopFormAside>

      <DesktopFormAside title="Ghid & recomandări">
        <div className="space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p>Caută mai întâi clientul în listă pentru a evita duplicatele.</p>
          <p>Completează locația de livrare pentru organizarea mai clară a traseului.</p>
          <p>Verifică prețul și cantitatea înainte de salvare.</p>
        </div>
      </DesktopFormAside>
    </div>
  )
}
