'use client'

import { DesktopFormAside } from '@/components/ui/form-dialog-layout'

interface RecoltareFormSummaryProps {
  parcelaLabel: string
  dataLabel: string
  culegatorName: string | undefined
  cropLabel: string
  kgCal1: number
  kgCal2: number
  totalKg: number
  pctCal1: number
  pctCal2: number
  hasValidTarif: boolean
  tarifLeiKg: number
  valoareMunca: number | null
  observatii: string | undefined
}

function clipText(value: string | undefined, max = 200): string | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  return text.length <= max ? text : `${text.slice(0, max)}...`
}

export function RecoltareFormSummary({
  parcelaLabel,
  dataLabel,
  culegatorName,
  cropLabel,
  kgCal1,
  kgCal2,
  totalKg,
  pctCal1,
  pctCal2,
  hasValidTarif,
  tarifLeiKg,
  valoareMunca,
  observatii,
}: RecoltareFormSummaryProps) {
  const clippedObservatii = clipText(observatii)

  return (
    <DesktopFormAside title="Rezumat live">
      <div>
        <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">{parcelaLabel}</p>
      </div>

      <dl className="space-y-3 text-sm text-[var(--text-secondary)]">
        <div className="border-t border-[var(--divider)] pt-3">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Data recoltării</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{dataLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Culegător</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{culegatorName?.trim() || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Cultură / soi</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{cropLabel}</dd>
        </div>
        <div className="border-t border-[var(--divider)] pt-3">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Total recoltat</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--text-primary)]">
            {totalKg.toFixed(2)} kg
          </dd>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-[var(--text-tertiary)]">Cal I</span>
            <p className="font-medium tabular-nums text-[var(--text-primary)]">
              {kgCal1.toFixed(2)} kg
              {totalKg > 0 ? ` (${pctCal1}%)` : ''}
            </p>
          </div>
          <div>
            <span className="text-[var(--text-tertiary)]">Cal II</span>
            <p className="font-medium tabular-nums text-[var(--text-primary)]">
              {kgCal2.toFixed(2)} kg
              {totalKg > 0 ? ` (${pctCal2}%)` : ''}
            </p>
          </div>
        </div>
        <div className="border-t border-[var(--divider)] pt-3">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Tarif (profil)</dt>
          <dd className="mt-0.5 tabular-nums text-[var(--text-primary)]">
            {hasValidTarif ? `${tarifLeiKg.toFixed(2)} lei/kg` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">De plată (estim.)</dt>
          <dd className="mt-1 text-base font-semibold tabular-nums text-[var(--text-primary)]">
            {valoareMunca !== null ? `${valoareMunca.toFixed(2)} lei` : '—'}
          </dd>
        </div>
      </dl>

      {clippedObservatii ? (
        <div className="border-t border-[var(--divider)] pt-3">
          <p className="text-xs font-medium text-[var(--text-tertiary)]">Observații</p>
          <p className="mt-1 max-h-24 overflow-y-auto text-xs leading-relaxed text-[var(--text-secondary)]">
            {clippedObservatii}
          </p>
        </div>
      ) : null}
    </DesktopFormAside>
  )
}
