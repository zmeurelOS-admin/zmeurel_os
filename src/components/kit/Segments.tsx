'use client'

import { useId, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { kitFocus, kitText } from './text'

export interface SegmentOption<T extends string = string> {
  value: T
  label: ReactNode
  /** Contor afișat după etichetă. */
  count?: number
}

export interface SegmentsProps<T extends string = string> {
  options: ReadonlyArray<SegmentOption<T>>
  value: T
  onValueChange: (value: T) => void
  /** Ce alege utilizatorul (ex. „Ce comenzi arăt”). */
  'aria-label': string
  /** Id-ul zonei pe care o schimbă segmentele (`aria-controls`). */
  panelId?: string
  className?: string
}

/** Segmente: 2–5 opțiuni pe un rând, câte una activă. Ținta are 48 px. */
export function Segments<T extends string = string>({
  options,
  value,
  onValueChange,
  panelId,
  className,
  'aria-label': ariaLabel,
}: SegmentsProps<T>) {
  const baseId = useId()

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = options.findIndex((option) => option.value === value)
    let next = -1
    if (event.key === 'ArrowRight') next = (current + 1) % options.length
    else if (event.key === 'ArrowLeft') next = (current - 1 + options.length) % options.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = options.length - 1
    if (next < 0) return
    event.preventDefault()
    onValueChange(options[next].value)
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn('grid gap-1 rounded-box bg-surface-muted p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            id={`${baseId}-${option.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'flex h-touch min-w-0 items-center justify-center gap-1.5 rounded-control px-2 font-bold',
              kitText.secondary,
              kitFocus,
              selected ? 'bg-surface text-fg shadow-1' : 'text-fg-muted',
            )}
          >
            <span className="truncate">{option.label}</span>
            {option.count !== undefined ? <span className="font-semibold opacity-70">{option.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
