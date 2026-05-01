'use client'

import { DesktopFormAside } from '@/components/ui/form-dialog-layout'

interface VanzareButasiFormSummaryProps {
  clientName: string
  statusLabel: string
  orderDateLabel: string
  deliveryDateLabel: string
  location: string
  sourceParcelName: string
  productsLabel: string
  totalLabel: string
  advanceLabel: string
  remainingLabel: string
  notes?: string
  className?: string
}

function clipText(value: string | undefined, max = 130): string {
  const current = (value ?? '').trim()
  if (!current) return '—'
  return current.length <= max ? current : `${current.slice(0, max)}…`
}

export function VanzareButasiFormSummary({
  clientName,
  statusLabel,
  orderDateLabel,
  deliveryDateLabel,
  location,
  sourceParcelName,
  productsLabel,
  totalLabel,
  advanceLabel,
  remainingLabel,
  notes,
  className,
}: VanzareButasiFormSummaryProps) {
  return (
    <DesktopFormAside title="Rezumat comandă" className={className}>
      <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">{clientName}</p>

      <dl className="space-y-1.5 text-sm text-[var(--text-secondary)]">
        <div className="border-t border-[var(--divider)] pt-2">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Status</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{statusLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Data</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{orderDateLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Livrare estimată</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{deliveryDateLabel}</dd>
        </div>
        <div className="border-t border-[var(--divider)] pt-2">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Locație</dt>
          <dd className="mt-0.5 break-words text-[var(--text-primary)]">{clipText(location)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Teren sursă</dt>
          <dd className="mt-0.5 break-words text-[var(--text-primary)]">{sourceParcelName}</dd>
        </div>
        <div className="grid grid-cols-1 gap-2 rounded-[16px] border border-[var(--divider)] bg-[var(--surface-card)] p-2 text-xs">
          <div>
            <span className="text-[var(--text-tertiary)]">Produse</span>
            <p className="font-medium text-[var(--text-primary)]">{productsLabel}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[var(--text-tertiary)]">Avans</span>
              <p className="font-medium tabular-nums text-[var(--text-primary)]">{advanceLabel}</p>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Rest</span>
              <p className="font-medium tabular-nums text-[var(--text-primary)]">{remainingLabel}</p>
            </div>
          </div>
        </div>
        <div className="border-t border-[var(--divider)] pt-2">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Total estimat</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-primary)]">{totalLabel}</dd>
        </div>
      </dl>

      {notes?.trim() ? (
        <div className="border-t border-[var(--divider)] pt-2">
          <p className="text-xs font-medium text-[var(--text-tertiary)]">Observații</p>
          <p className="mt-1 break-words text-xs leading-relaxed text-[var(--text-secondary)]">
            {clipText(notes, 150)}
          </p>
        </div>
      ) : null}
    </DesktopFormAside>
  )
}
