import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

import { kitFocus, kitText } from './text'

export interface ListRowProps {
  /** Întreg, pe câte rânduri are nevoie (promptul 34, §6 și §9): titlul trebuie să se poată citi. */
  title: ReactNode
  /** Întreg, pe câte rânduri are nevoie (promptul 34, §9: nimic tăiat). */
  detail?: ReactNode
  /**
   * Conținutul cercului din stânga. Implicit: inițiala titlului (când titlul e text).
   * `false` ascunde cercul.
   */
  avatar?: ReactNode | false
  /** Înlocuiește cercul cu altceva (ex. numărul opririi pe traseu). */
  leading?: ReactNode
  /** Zona din dreapta: insignă, sumă, cantitate. */
  trailing?: ReactNode
  /** Săgeata din dreapta. Implicit apare când rândul e apăsabil. */
  chevron?: boolean
  onClick?: () => void
  disabled?: boolean
  'aria-label'?: string
  className?: string
}

/** Rând de listă: cerc cu inițială, titlu, detaliu, zonă în dreapta, săgeată. */
export function ListRow({
  title,
  detail,
  avatar,
  leading,
  trailing,
  chevron,
  onClick,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: ListRowProps) {
  const interactive = Boolean(onClick)
  const showChevron = chevron ?? interactive
  const avatarContent =
    avatar === false ? null : (avatar ?? (typeof title === 'string' ? (title.trim().charAt(0) || '?').toUpperCase() : null))

  const content = (
    <>
      {leading ??
        (avatarContent ? (
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-muted font-extrabold text-fg [&_svg]:size-5',
              kitText.base,
            )}
            aria-hidden
          >
            {avatarContent}
          </span>
        ) : null)}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('break-words font-bold text-fg', kitText.base)}>{title}</span>
        {detail ? <span className={cn('break-words text-fg-muted', kitText.secondary)}>{detail}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
      {showChevron ? <ChevronRight className="size-5 shrink-0 text-fg-muted" aria-hidden /> : null}
    </>
  )

  const rowClass = cn(
    'flex min-h-[68px] w-full items-center gap-3 rounded-box border-2 border-border bg-surface px-4 py-2.5 text-left',
    className,
  )

  if (!interactive) {
    return <div className={rowClass}>{content}</div>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(rowClass, kitFocus, 'active:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-45')}
    >
      {content}
    </button>
  )
}
