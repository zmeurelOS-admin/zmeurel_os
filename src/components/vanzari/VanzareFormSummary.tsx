'use client'

import StatusBadge from '@/components/ui/StatusBadge'
import { DesktopFormAside } from '@/components/ui/form-dialog-layout'

interface VanzareFormSummaryProps {
  clientName: string | undefined
  clientPhone?: string | undefined
  clientAddress?: string | undefined
  qualityLabel?: string | undefined
  quantity: string | undefined
  unitPrice: string | undefined
  totalRon: number | null
  statusLabel: string
  statusVariant: 'success' | 'warning' | 'neutral'
  dateLabel: string
  notes: string | undefined
  mode: 'create' | 'edit'
  recordCode?: string
  isFromOrder?: boolean
  relatedSalesCount?: number | null
  relatedSalesLabel?: string
}

function clipNote(text: string | undefined, max = 100): string {
  const value = (text ?? '').trim()
  if (!value) return '—'
  return value.length <= max ? value : `${value.slice(0, max)}...`
}

export function VanzareFormSummary({
  clientName,
  clientPhone,
  clientAddress,
  qualityLabel,
  quantity,
  unitPrice,
  totalRon,
  statusLabel,
  statusVariant,
  dateLabel,
  notes,
  mode,
  recordCode,
  isFromOrder = false,
  relatedSalesCount = null,
  relatedSalesLabel,
}: VanzareFormSummaryProps) {
  return (
    <DesktopFormAside title={mode === 'edit' ? 'Vânzare' : 'Previzualizare'}>
      <div>
        <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">
          {clientName?.trim() || 'Fără client'}
        </p>
        {recordCode ? <p className="mt-1 font-mono text-xs text-[var(--text-tertiary)]">{recordCode}</p> : null}
      </div>

      <dl className="space-y-3 text-sm text-[var(--text-secondary)]">
        {isFromOrder ? (
          <div className="border-t border-[var(--divider)] pt-3">
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Comandă</dt>
            <dd className="mt-1">
              <StatusBadge variant="info" text="Din comandă" />
            </dd>
          </div>
        ) : null}
        {clientPhone !== undefined ? (
          <div className={isFromOrder ? undefined : 'border-t border-[var(--divider)] pt-3'}>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Telefon</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{clientPhone?.trim() || '—'}</dd>
          </div>
        ) : null}
        {clientAddress !== undefined ? (
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Locație</dt>
            <dd className="mt-0.5 line-clamp-3 text-[var(--text-primary)]">{clientAddress?.trim() || '—'}</dd>
          </div>
        ) : null}
        {qualityLabel ? (
          <div className="border-t border-[var(--divider)] pt-3">
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Calitate</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{qualityLabel}</dd>
          </div>
        ) : null}
        <div className={qualityLabel ? undefined : 'border-t border-[var(--divider)] pt-3'}>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Cantitate / Preț</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">
            {quantity ? `${quantity} kg` : '—'} · {unitPrice ? `${unitPrice} lei/kg` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Total</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-primary)]">
            {totalRon !== null ? `${totalRon.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} lei` : '—'}
          </dd>
        </div>
        <div>
          <dt className="mb-1.5 text-xs font-medium text-[var(--text-tertiary)]">Status plată</dt>
          <dd>
            <StatusBadge variant={statusVariant} text={statusLabel} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Data</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{dateLabel}</dd>
        </div>
        {relatedSalesCount !== null ? (
          <div className="border-t border-[var(--divider)] pt-3 text-xs text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-tertiary)]">{relatedSalesLabel}: </span>
            <span className="font-semibold text-[var(--text-primary)]">{relatedSalesCount}</span>
          </div>
        ) : null}
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">
            {mode === 'create' ? 'Observații lădițe' : 'Observații'}
          </dt>
          <dd className="mt-0.5 text-xs leading-relaxed text-[var(--text-primary)]">{clipNote(notes)}</dd>
        </div>
      </dl>
    </DesktopFormAside>
  )
}
