'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { kitFocus, kitText } from './text'

export type ToggleRowTone = 'primary' | 'warning'

const ON_ROW_CLASS: Record<ToggleRowTone, string> = {
  primary: 'border-primary bg-primary-soft',
  warning: 'border-warning bg-warning-bg',
}

const ON_TRACK_CLASS: Record<ToggleRowTone, string> = {
  primary: 'border-primary bg-primary',
  warning: 'border-warning bg-warning',
}

export interface ToggleRowProps {
  title: ReactNode
  subtitle?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Culoarea stării pornite: `warning` pentru lucruri care cer atenție (ex. „Prioritară”). */
  tone?: ToggleRowTone
  icon?: ReactNode
  disabled?: boolean
  className?: string
}

/** Rând cu titlu, subtitlu și comutator. Tot rândul e ținta; starea pornită e evidențiată. */
export function ToggleRow({
  title,
  subtitle,
  checked,
  onCheckedChange,
  tone = 'primary',
  icon,
  disabled = false,
  className,
}: ToggleRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'flex min-h-[68px] w-full items-center gap-3 rounded-box border-2 px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        kitFocus,
        checked ? ON_ROW_CLASS[tone] : 'border-border bg-surface',
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            'shrink-0 [&_svg]:size-5',
            checked ? (tone === 'warning' ? 'text-warning-text' : 'text-primary') : 'text-fg-muted',
          )}
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('font-bold text-fg', kitText.base)}>{title}</span>
        {subtitle ? <span className={cn('text-fg-muted', kitText.secondary)}>{subtitle}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative h-8 w-14 shrink-0 rounded-full border-2 transition-colors',
          checked ? ON_TRACK_CLASS[tone] : 'border-border-strong bg-surface-muted',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 size-6 rounded-full transition-transform',
            checked ? 'translate-x-6 bg-primary-contrast' : 'bg-fg-muted',
          )}
        />
      </span>
    </button>
  )
}
