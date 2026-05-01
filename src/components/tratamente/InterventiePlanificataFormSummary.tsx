'use client'

import { DesktopFormAside } from '@/components/ui/form-dialog-layout'

interface SummaryProductItem {
  id: string
  name: string
  doseLabel: string | null
  metaLabel: string | null
}

interface InterventiePlanificataFormSummaryProps {
  stadiuLabel: string | null
  cohortLabel: string | null
  tipInterventie: string | null
  scop: string | null
  regulaRepetare: string
  intervalLabel: string | null
  repetariLabel: string | null
  products: SummaryProductItem[]
  className?: string
}

function clipText(value: string | null | undefined, max = 180): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  return text.length <= max ? text : `${text.slice(0, max)}...`
}

export function InterventiePlanificataFormSummary({
  stadiuLabel,
  cohortLabel,
  tipInterventie,
  scop,
  regulaRepetare,
  intervalLabel,
  repetariLabel,
  products,
  className,
}: InterventiePlanificataFormSummaryProps) {
  const clippedScop = clipText(scop, 160)

  return (
    <DesktopFormAside title="Rezumat intervenție" className={className}>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">
          {stadiuLabel ? `Fenofază: ${stadiuLabel}` : 'Intervenție planificată'}
        </p>
      </div>

      <dl className="space-y-2 text-sm text-[var(--text-secondary)]">
        <div className="border-t border-[var(--divider)] pt-2">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Fenofază trigger</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{stadiuLabel || '—'}</dd>
        </div>

        {cohortLabel ? (
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Cohortă</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{cohortLabel}</dd>
          </div>
        ) : null}

        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Tip intervenție</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{tipInterventie || 'Nespecificat'}</dd>
        </div>

        {clippedScop ? (
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Scop</dt>
            <dd className="mt-0.5 break-words text-[var(--text-primary)]">{clippedScop}</dd>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2 rounded-[16px] border border-[var(--divider)] bg-[var(--surface-card)] p-2 text-xs">
          <div>
            <span className="text-[var(--text-tertiary)]">Regulă repetare</span>
            <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">{regulaRepetare}</p>
          </div>
          {intervalLabel ? (
            <div>
              <span className="text-[var(--text-tertiary)]">Interval</span>
              <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">{intervalLabel}</p>
            </div>
          ) : null}
          {repetariLabel ? (
            <div>
              <span className="text-[var(--text-tertiary)]">Repetări maxime</span>
              <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">{repetariLabel}</p>
            </div>
          ) : null}
        </div>

        <div className="border-t border-[var(--divider)] pt-2">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Produse în intervenție</dt>
          <dd className="mt-1 text-base font-semibold text-[var(--text-primary)]">
            {products.length} {products.length === 1 ? 'produs' : 'produse'}
          </dd>
          <div className="mt-2 space-y-1.5">
            {products.map((product, index) => (
              <div
                key={product.id}
                className="rounded-[14px] border border-[var(--divider)] bg-[var(--surface-card)] px-2.5 py-1.5"
              >
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {index + 1}. {product.name}
                </p>
                {product.doseLabel ? (
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{product.doseLabel}</p>
                ) : null}
                {product.metaLabel ? (
                  <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{product.metaLabel}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </dl>
    </DesktopFormAside>
  )
}
