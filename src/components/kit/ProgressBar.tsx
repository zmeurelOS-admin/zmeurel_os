import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { kitText } from './text'

export type ProgressTone = 'primary' | 'success' | 'warning' | 'danger'

const TONE_CLASS: Record<ProgressTone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

export interface ProgressBarProps {
  value: number
  max: number
  /** Eticheta din stânga (ex. „Rămas în stoc”). */
  label?: ReactNode
  /** Textul din dreapta (ex. „3 din 7 livrate”). */
  valueLabel?: ReactNode
  tone?: ProgressTone
  /** Numele barei pentru cititoarele de ecran, când `label` lipsește sau nu e text. */
  'aria-label'?: string
  /** Valoarea citită de cititoarele de ecran (implicit `valueLabel`, dacă e text). */
  'aria-valuetext'?: string
  className?: string
}

/** Cât la sută din `max` reprezintă `value`, limitat la 0–100. */
export function progressPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0
  return Math.min(100, Math.max(0, (value / max) * 100))
}

/** Bară de progres cu etichetă. */
export function ProgressBar({
  value,
  max,
  label,
  valueLabel,
  tone = 'primary',
  className,
  'aria-label': ariaLabel,
  'aria-valuetext': ariaValueText,
}: ProgressBarProps) {
  const percent = progressPercent(value, max)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label || valueLabel ? (
        <div className="flex items-baseline justify-between gap-3">
          <span className={cn('font-semibold text-fg-muted', kitText.secondary)}>{label}</span>
          <span className={cn('font-bold text-fg', kitText.secondary)}>{valueLabel}</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(Math.max(value, 0), max)}
        aria-valuetext={ariaValueText ?? (typeof valueLabel === 'string' ? valueLabel : undefined)}
        className="h-3 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300 ease-out', TONE_CLASS[tone])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
