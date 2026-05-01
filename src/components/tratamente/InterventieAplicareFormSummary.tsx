'use client'

import { DesktopFormAside } from '@/components/ui/form-dialog-layout'

interface SummaryProductItem {
  id: string
  name: string
  doseLabel: string | null
}

interface SummaryMeteo {
  temperatura: string | null
  umiditate: string | null
  vant: string | null
  precipitatii: string | null
  descriere: string | null
}

interface SummaryDifferences {
  automat?: string[]
  observatii?: string | null
}

interface InterventieAplicareFormSummaryProps {
  title: string
  contextLabel?: string | null
  statusLabel?: string | null
  dateCaption: string
  dateLabel?: string | null
  cohortLabel?: string | null
  tipInterventie?: string | null
  scop?: string | null
  operator?: string | null
  stadiuLabel?: string | null
  cantitateLabel?: string | null
  plannedProductsLabel?: string | null
  products: SummaryProductItem[]
  meteo?: SummaryMeteo | null
  differences?: SummaryDifferences | null
  className?: string
}

function clipText(value: string | null | undefined, max = 180): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  return text.length <= max ? text : `${text.slice(0, max)}...`
}

export function InterventieAplicareFormSummary({
  title,
  contextLabel,
  statusLabel,
  dateCaption,
  dateLabel,
  cohortLabel,
  tipInterventie,
  scop,
  operator,
  stadiuLabel,
  cantitateLabel,
  plannedProductsLabel,
  products,
  meteo,
  differences,
  className,
}: InterventieAplicareFormSummaryProps) {
  const clippedContext = clipText(contextLabel, 120)
  const clippedScop = clipText(scop, 160)
  const clippedMeteoDescription = clipText(meteo?.descriere ?? null, 140)
  const clippedDifferenceNote = clipText(differences?.observatii ?? null, 160)

  return (
    <DesktopFormAside title={title} className={className}>
      <div className="space-y-0.5">
        <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">
          {clippedContext ? `Context: ${clippedContext}` : 'Datele se actualizează live'}
        </p>
      </div>

      <dl className="space-y-2 text-sm text-[var(--text-secondary)]">
        {statusLabel ? (
          <div className="border-t border-[var(--divider)] pt-2">
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Status</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{statusLabel}</dd>
          </div>
        ) : null}

        <div className={statusLabel ? '' : 'border-t border-[var(--divider)] pt-2'}>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">{dateCaption}</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{dateLabel?.trim() || '—'}</dd>
        </div>

        {cohortLabel ? (
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Cohortă</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{cohortLabel}</dd>
          </div>
        ) : null}

        {tipInterventie ? (
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Tip intervenție</dt>
            <dd className="mt-0.5 text-[var(--text-primary)]">{tipInterventie}</dd>
          </div>
        ) : null}

        {clippedScop ? (
          <div>
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Scop</dt>
            <dd className="mt-0.5 break-words text-[var(--text-primary)]">{clippedScop}</dd>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2 rounded-[16px] border border-[var(--divider)] bg-[var(--surface-card)] p-2 text-xs">
          <div>
            <span className="text-[var(--text-tertiary)]">Operator</span>
            <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">{operator?.trim() || '—'}</p>
          </div>
          <div>
            <span className="text-[var(--text-tertiary)]">Stadiu</span>
            <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">{stadiuLabel?.trim() || '—'}</p>
          </div>
          <div>
            <span className="text-[var(--text-tertiary)]">Cantitate soluție</span>
            <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">{cantitateLabel?.trim() || '—'}</p>
          </div>
        </div>

        {plannedProductsLabel ? (
          <div className="border-t border-[var(--divider)] pt-2">
            <dt className="text-xs font-medium text-[var(--text-tertiary)]">Plan de referință</dt>
            <dd className="mt-0.5 break-words text-[var(--text-primary)]">Produse: {plannedProductsLabel}</dd>
          </div>
        ) : null}

        <div className="border-t border-[var(--divider)] pt-2">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Produse în formular</dt>
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
              </div>
            ))}
          </div>
        </div>
      </dl>

      {meteo ? (
        <div className="border-t border-[var(--divider)] pt-2">
          <p className="text-xs font-medium text-[var(--text-tertiary)]">Snapshot meteo</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
            <p>{`Temp: ${meteo.temperatura ?? '—'}°C`}</p>
            <p>{`Umiditate: ${meteo.umiditate ?? '—'}%`}</p>
            <p>{`Vânt: ${meteo.vant ?? '—'} km/h`}</p>
            <p>{`Ploaie 24h: ${meteo.precipitatii ?? '—'} mm`}</p>
          </div>
          {clippedMeteoDescription ? (
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">{clippedMeteoDescription}</p>
          ) : null}
        </div>
      ) : null}

      {differences && (differences.automat?.length || clippedDifferenceNote) ? (
        <div className="border-t border-[var(--divider)] pt-2">
          <p className="text-xs font-medium text-[var(--text-tertiary)]">Diferențe față de plan</p>
          {differences.automat?.length ? (
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              {differences.automat.slice(0, 3).map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          ) : null}
          {clippedDifferenceNote ? (
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">{clippedDifferenceNote}</p>
          ) : null}
        </div>
      ) : null}
    </DesktopFormAside>
  )
}
