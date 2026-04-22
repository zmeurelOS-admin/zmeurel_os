'use client'

import { DesktopFormAside } from '@/components/ui/form-dialog-layout'

interface CheltuialaFormSummaryProps {
  amount: string | undefined
  category: string | undefined
  date: string | undefined
  supplier: string | undefined
  description: string | undefined
  mode: 'create' | 'edit'
}

function formatCurrency(value: string | undefined): string {
  const amount = Number(String(value ?? '').replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0) {
    return '—'
  }

  return `${amount.toLocaleString('ro-RO', {
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  })} lei`
}

function formatDate(value: string | undefined): string {
  const date = value?.trim()
  if (!date) {
    return '—'
  }

  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('ro-RO')
}

function compactText(value: string | undefined, fallback = '—', max = 90): string {
  const text = value?.trim()
  if (!text) {
    return fallback
  }

  return text.length <= max ? text : `${text.slice(0, max)}...`
}

export function CheltuialaFormSummary({
  amount,
  category,
  date,
  supplier,
  description,
  mode,
}: CheltuialaFormSummaryProps) {
  return (
    <DesktopFormAside title={mode === 'edit' ? 'Cheltuială' : 'Previzualizare'}>
      <div>
        <p className="text-xs font-medium text-[var(--text-tertiary)]">Valoare</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-normal text-[var(--text-primary)]">
          {formatCurrency(amount)}
        </p>
      </div>

      <dl className="space-y-3 text-sm text-[var(--text-secondary)]">
        <div className="border-t border-[var(--divider)] pt-3">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Categorie</dt>
          <dd className="mt-0.5 font-medium text-[var(--text-primary)]">{compactText(category)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Data</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{formatDate(date)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Furnizor</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{compactText(supplier)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Descriere</dt>
          <dd className="mt-0.5 text-xs leading-relaxed text-[var(--text-primary)]">
            {compactText(description, '—', 120)}
          </dd>
        </div>
      </dl>
    </DesktopFormAside>
  )
}
