'use client'

import StatusBadge from '@/components/ui/StatusBadge'
import { DesktopFormAside } from '@/components/ui/form-dialog-layout'

export type CulegatorDialogActivitySummary = {
  seasonKg: number
  seasonCount: number
  lastRecoltare: { date: string; parcela: string; kg: number } | null
}

interface CulegatorFormSummaryProps {
  title: string | undefined
  phone: string | undefined
  employmentType: string | undefined
  rate: string | undefined
  startDate: string | undefined
  active: boolean
  observations: string | undefined
  mode: 'create' | 'edit'
  recordCode?: string
  activitySummary?: CulegatorDialogActivitySummary | null
}

function formatDateRo(iso: string | undefined | null): string {
  if (!iso?.trim()) return '—'
  const raw = iso.slice(0, 10)
  const d = new Date(`${raw}T12:00:00`)
  return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString('ro-RO')
}

function clipNote(text: string | undefined, max = 120): string {
  const t = (text ?? '').trim()
  if (!t) return '—'
  return t.length <= max ? t : `${t.slice(0, max)}...`
}

function formatKg(value: number): string {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(value)
}

function parseRate(value: string | undefined): number {
  const n = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function CulegatorFormSummary({
  title,
  phone,
  employmentType,
  rate,
  startDate,
  active,
  observations,
  mode,
  recordCode,
  activitySummary = null,
}: CulegatorFormSummaryProps) {
  const rateNumber = parseRate(rate)
  const estimatedSeasonPayment =
    activitySummary && activitySummary.seasonKg > 0 && rateNumber > 0 ? activitySummary.seasonKg * rateNumber : null

  return (
    <DesktopFormAside title={mode === 'edit' ? 'Culegător' : 'Previzualizare'}>
      <div>
        <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">
          {title?.trim() || (mode === 'create' ? 'Culegător nou' : '—')}
        </p>
        {recordCode ? (
          <p className="mt-1 font-mono text-xs text-[var(--text-tertiary)]">{recordCode}</p>
        ) : null}
      </div>

      <dl className="space-y-3 text-sm text-[var(--text-secondary)]">
        <div className="border-t border-[var(--divider)] pt-3">
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Telefon</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{phone?.trim() || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Tip / tarif</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">
            {employmentType || '—'}
            {rateNumber > 0 ? ` · ${rateNumber.toLocaleString('ro-RO')} lei/kg` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-[var(--text-tertiary)]">Data angajării</dt>
          <dd className="mt-0.5 text-[var(--text-primary)]">{formatDateRo(startDate)}</dd>
        </div>
        <div>
          <dt className="mb-1.5 text-xs font-medium text-[var(--text-tertiary)]">Status</dt>
          <dd>
            <StatusBadge variant={active ? 'success' : 'neutral'} text={active ? 'Activ' : 'Inactiv'} />
          </dd>
        </div>
      </dl>

      {activitySummary ? (
        <div className="space-y-2 border-t border-[var(--divider)] pt-3 text-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
            Activitate (sezon curent)
          </p>
          <p>
            <span className="text-[var(--text-tertiary)]">Kg sezon: </span>
            <span className="font-semibold text-[var(--text-primary)]">{formatKg(activitySummary.seasonKg)} kg</span>
          </p>
          <p>
            <span className="text-[var(--text-tertiary)]">Recoltări: </span>
            <span className="font-semibold text-[var(--text-primary)]">{activitySummary.seasonCount}</span>
          </p>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            Ultima:{' '}
            {activitySummary.lastRecoltare
              ? `${activitySummary.lastRecoltare.date} · ${activitySummary.lastRecoltare.parcela} · ${formatKg(activitySummary.lastRecoltare.kg)} kg`
              : '—'}
          </p>
          {estimatedSeasonPayment !== null ? (
            <p>
              <span className="text-[var(--text-tertiary)]">Estimat plată sezon: </span>
              <span className="font-semibold text-[var(--text-primary)]">
                {estimatedSeasonPayment.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} lei
              </span>
              <span className="mt-0.5 block text-[10px] text-[var(--text-tertiary)]">kg sezon × tarif din formular</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-[var(--divider)] pt-3">
        <p className="text-xs font-medium text-[var(--text-tertiary)]">Observații</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-primary)]">{clipNote(observations)}</p>
      </div>
    </DesktopFormAside>
  )
}
