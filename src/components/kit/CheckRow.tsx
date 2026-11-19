'use client'

import { useId, type ReactNode } from 'react'
import { Check, Lock } from 'lucide-react'

import { cn } from '@/lib/utils'

import { kitFocus, kitText } from './text'

/**
 * Un rând blocat nu se poate bifa. Unul blocat, dar deja bifat, se poate debifa
 * (ex. stocul a scăzut după ce comanda a fost aleasă).
 */
export function canToggleCheckRow(checked: boolean, locked: boolean): boolean {
  return checked || !locked
}

export interface CheckRowProps {
  title: ReactNode
  detail?: ReactNode
  /** Zona din dreapta: cantitate, sumă. */
  trailing?: ReactNode
  /** Insignă lângă titlu (ex. `StatusPill` „Prioritară”). */
  badge?: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Rândul nu se poate bifa (ex. nu ajunge stocul). */
  locked?: boolean
  /** De ce e blocat (ex. „Nu ajunge stocul: lipsesc 3 kg”). Se afișează și se citește. */
  lockedReason?: ReactNode
  className?: string
}

/** Rând bifabil, cu stare blocată și motiv. */
export function CheckRow({
  title,
  detail,
  trailing,
  badge,
  checked,
  onCheckedChange,
  locked = false,
  lockedReason,
  className,
}: CheckRowProps) {
  const reasonId = useId()
  const blocked = !canToggleCheckRow(checked, locked)
  const showReason = locked && Boolean(lockedReason)

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      // Nu `disabled`: rândul rămâne focusabil, ca motivul să poată fi citit.
      aria-disabled={blocked || undefined}
      aria-describedby={showReason ? reasonId : undefined}
      onClick={() => {
        if (blocked) return
        onCheckedChange(!checked)
      }}
      className={cn(
        'flex min-h-[68px] w-full items-center gap-3 rounded-box border-2 px-4 py-3 text-left transition-colors',
        kitFocus,
        blocked
          ? 'cursor-not-allowed border-border bg-surface-muted'
          : checked
            ? 'border-primary bg-primary-soft'
            : 'border-border bg-surface',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-control border-2 [&_svg]:size-4',
          blocked
            ? 'border-border-strong bg-surface-muted text-fg-muted'
            : checked
              ? 'border-primary bg-primary text-primary-contrast'
              : 'border-border-strong bg-surface',
        )}
      >
        {blocked ? <Lock /> : checked ? <Check strokeWidth={3} /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('font-bold', kitText.base, blocked ? 'text-fg-muted' : 'text-fg')}>{title}</span>
          {badge}
        </span>
        {detail ? <span className={cn('text-fg-muted', kitText.secondary)}>{detail}</span> : null}
        {showReason ? (
          <span id={reasonId} className={cn('font-semibold text-danger-text', kitText.secondary)}>
            {lockedReason}
          </span>
        ) : null}
      </span>
      {trailing ? (
        <span className={cn('shrink-0 font-bold', kitText.base, blocked ? 'text-fg-muted' : 'text-fg')}>{trailing}</span>
      ) : null}
    </button>
  )
}
