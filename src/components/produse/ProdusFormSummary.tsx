'use client'

import StatusBadge from '@/components/ui/StatusBadge'
import { DesktopFormAside } from '@/components/ui/form-dialog-layout'

interface ProdusFormSummaryProps {
  title: string | undefined
  categoryLabel: string | undefined
  unit: string | undefined
  priceLabel: string
  gramaj: string | undefined
  approximateWeight: string | undefined
  statusLabel: string
  statusVariant: 'success' | 'neutral'
  description: string | undefined
  mode: 'create' | 'edit'
}

function clipNote(text: string | undefined, max = 120): string {
  const value = (text ?? '').trim()
  if (!value) return '—'
  return value.length <= max ? value : `${value.slice(0, max)}...`
}

export function ProdusFormSummary({
  title,
  categoryLabel,
  unit,
  priceLabel,
  gramaj,
  approximateWeight,
  statusLabel,
  statusVariant,
  description,
  mode,
}: ProdusFormSummaryProps) {
  return (
    <DesktopFormAside title={mode === 'edit' ? 'Produs' : 'Previzualizare'}>
      <div>
        <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">
          {title?.trim() || 'Produs nou'}
        </p>
      </div>

      <dl className="space-y-3 text-sm text-[var(--text-secondary)]">
        <div className="border-t border-[var(--divider)] pt-3">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Categorie</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{categoryLabel || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Unitate</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{unit || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Preț</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-[var(--text-primary)]">{priceLabel}</dd>
        </div>
        {gramaj?.trim() ? (
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Gramaj</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{gramaj} g</dd>
          </div>
        ) : null}
        {approximateWeight?.trim() ? (
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Greutate aproximativă</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{approximateWeight}</dd>
          </div>
        ) : null}
        <div className="border-t border-[var(--divider)] pt-3">
          <dt className="mb-1.5 text-xs font-medium text-[var(--text-tertiary)]">Status</dt>
          <dd>
            <StatusBadge variant={statusVariant} text={statusLabel} />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Descriere</dt>
          <dd className="mt-0.5 text-xs leading-relaxed text-[var(--text-primary)]">{clipNote(description)}</dd>
        </div>
      </dl>
    </DesktopFormAside>
  )
}
