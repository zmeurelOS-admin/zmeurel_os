'use client'

import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { BottomSheet } from './BottomSheet'
import {
  buildMonthGrid,
  defaultDateShortcuts,
  isIsoOutOfRange,
  isMonthOutOfRange,
  longDayRo,
  monthOfIso,
  monthTitleRo,
  shiftMonth,
  todayIso,
  type DateShortcut,
} from './lib/date'
import { kitFocus, kitText } from './text'

const WEEKDAYS = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D']

export interface CalendarPanelProps {
  /** Ziua aleasă, ca text ISO (`2026-11-19`), sau `null`. */
  value: string | null
  onChange: (value: string) => void
  /** Prima zi permisă (inclusiv). */
  min?: string
  /** Ultima zi permisă (inclusiv). */
  max?: string
  /** Scurtăturile de deasupra calendarului. Implicit Azi / Mâine / Poimâine; `false` le ascunde. */
  shortcuts?: ReadonlyArray<DateShortcut> | false
  className?: string
}

/**
 * Calendarul, fără foaie. Se pune direct în pagină sau într-un pas de `StepForm`
 * (acolo nu se deschide o a doua fereastră peste formular).
 */
export function CalendarPanel({ value, onChange, min, max, shortcuts, className }: CalendarPanelProps) {
  const [today] = useState(todayIso)
  const [view, setView] = useState(() => monthOfIso(value, today))

  const grid = buildMonthGrid(view)
  const quick = shortcuts === false ? [] : (shortcuts ?? defaultDateShortcuts(today))

  const pick = (iso: string) => {
    setView(monthOfIso(iso, today))
    onChange(iso)
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {quick.length ? (
        <div className="flex gap-2">
          {quick.map((shortcut) => {
            const selected = shortcut.value === value
            return (
              <button
                key={shortcut.value}
                type="button"
                aria-pressed={selected}
                disabled={isIsoOutOfRange(shortcut.value, min, max)}
                onClick={() => pick(shortcut.value)}
                className={cn(
                  'h-touch min-w-0 flex-1 rounded-box border-2 px-1 font-bold disabled:cursor-not-allowed disabled:opacity-45',
                  kitText.secondary,
                  kitFocus,
                  selected ? 'border-primary bg-primary text-primary-contrast' : 'border-border bg-surface text-fg',
                )}
              >
                {shortcut.label}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="quiet"
          size="icon-touch"
          aria-label="Luna anterioară"
          disabled={isMonthOutOfRange(shiftMonth(view, -1), min, max)}
          onClick={() => setView(shiftMonth(view, -1))}
          className="bg-surface-muted"
        >
          <ChevronLeft aria-hidden />
        </Button>
        <p className={cn('font-bold capitalize text-fg', kitText.card)} aria-live="polite">
          {monthTitleRo(view)}
        </p>
        <Button
          type="button"
          variant="quiet"
          size="icon-touch"
          aria-label="Luna următoare"
          disabled={isMonthOutOfRange(shiftMonth(view, 1), min, max)}
          onClick={() => setView(shiftMonth(view, 1))}
          className="bg-surface-muted"
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>

      <div>
        <div className="grid grid-cols-7 gap-0.5 text-center" aria-hidden>
          {WEEKDAYS.map((day) => (
            <span key={day} className={cn('py-1 font-semibold text-fg-muted', kitText.helper)}>
              {day}
            </span>
          ))}
        </div>
        {/* Spațiu de 2 px: la 390 px lățime, fiecare zi rămâne de cel puțin 48 px. */}
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: grid.leadingBlanks }, (_, index) => (
            <span key={`gol-${index}`} />
          ))}
          {grid.days.map((iso, index) => {
            const selected = iso === value
            const isToday = iso === today
            return (
              <button
                key={iso}
                type="button"
                disabled={isIsoOutOfRange(iso, min, max)}
                aria-label={longDayRo(iso)}
                aria-pressed={selected}
                aria-current={isToday ? 'date' : undefined}
                onClick={() => pick(iso)}
                className={cn(
                  'h-touch rounded-control font-semibold disabled:cursor-not-allowed disabled:opacity-30',
                  kitText.base,
                  kitFocus,
                  selected ? 'bg-primary text-primary-contrast' : 'text-fg active:bg-surface-muted',
                  !selected && isToday && 'ring-2 ring-inset ring-primary',
                )}
              >
                {index + 1}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export interface CalendarSheetProps extends Omit<CalendarPanelProps, 'className'> {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Ce dată se alege (ex. „Când livrezi?”). */
  title: ReactNode
  description?: ReactNode
  /** Foaia rămâne deschisă după alegerea zilei. Implicit se închide. */
  keepOpenOnSelect?: boolean
}

/** Calendar în foaie de jos, cu scurtături și limite. */
export function CalendarSheet({
  open,
  onOpenChange,
  title,
  description,
  keepOpenOnSelect = false,
  onChange,
  ...panelProps
}: CalendarSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <CalendarPanel
        {...panelProps}
        onChange={(iso) => {
          onChange(iso)
          if (!keepOpenOnSelect) onOpenChange(false)
        }}
      />
    </BottomSheet>
  )
}
