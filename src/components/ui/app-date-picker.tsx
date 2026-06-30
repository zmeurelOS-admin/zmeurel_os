'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ro } from 'date-fns/locale'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  formatDateDisplayRo,
  formatDateTimeDisplayRo,
  getLocalNowDateTimeValue,
  getLocalTodayIsoDate,
  localDateFromIsoDate,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
  toIsoDateOnly,
  type AppDatePickerMode,
} from '@/lib/ui/app-date-picker-utils'
import { cn } from '@/lib/utils'

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const

export interface AppDatePickerProps {
  id: string
  label?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  mode?: AppDatePickerMode
  disabled?: boolean
  error?: string
  triggerClassName?: string
  min?: string
  max?: string
}

function getDisplayValue(value: string, mode: AppDatePickerMode, placeholder: string): string {
  if (!value.trim()) return placeholder
  return mode === 'datetime' ? formatDateTimeDisplayRo(value) : formatDateDisplayRo(value)
}

function getSelectedDate(value: string, mode: AppDatePickerMode): Date | null {
  if (!value.trim()) return null
  if (mode === 'datetime') {
    const parsed = parseDateTimeLocalValue(value)
    return parsed ? localDateFromIsoDate(parsed.date) : null
  }
  return localDateFromIsoDate(value)
}

function buildCalendarDays(viewMonth: Date): Date[] {
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  return eachDayOfInterval({ start: gridStart, end: gridEnd })
}

function NativeTimeInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (time: string) => void
}) {
  return (
    <div className="border-t border-[var(--agri-border)] pt-3">
      <Label htmlFor={id} className="mb-1.5 block px-0.5 text-xs font-medium text-[var(--agri-text-muted)]">
        Oră
      </Label>
      <input
        id={id}
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'agri-control flex h-11 w-full min-h-[44px] rounded-lg border border-[var(--agri-border)] bg-[var(--agri-surface)] px-3 text-base text-[var(--agri-text)] shadow-sm',
          '[color-scheme:light] dark:[color-scheme:dark]'
        )}
      />
    </div>
  )
}

function isDateDisabled(day: Date, min?: string, max?: string): boolean {
  const iso = toIsoDateOnly(day.getFullYear(), day.getMonth() + 1, day.getDate())
  if (min && iso < min) return true
  if (max && iso > max) return true
  return false
}

type CalendarPanelProps = {
  viewMonth: Date
  selectedDate: Date | null
  draftTime: string
  timeInputId: string
  mode: AppDatePickerMode
  min?: string
  max?: string
  onSelectDay: (day: Date) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onTimeChange: (time: string) => void
}

function CalendarPanel({
  viewMonth,
  selectedDate,
  draftTime,
  timeInputId,
  mode,
  min,
  max,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  onToday,
  onTimeChange,
}: CalendarPanelProps) {
  const days = useMemo(() => buildCalendarDays(viewMonth), [viewMonth])

  return (
    <div className="space-y-3 p-1">
      <div className="flex items-center justify-between gap-2 px-1">
        <button
          type="button"
          aria-label="Luna anterioară"
          onClick={onPrevMonth}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--agri-text-muted)] transition-colors hover:bg-[var(--agri-surface-muted)] hover:text-[var(--agri-text)]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <p className="text-sm font-semibold capitalize text-[var(--agri-text)]">
          {format(viewMonth, 'LLLL yyyy', { locale: ro })}
        </p>
        <button
          type="button"
          aria-label="Luna următoare"
          onClick={onNextMonth}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--agri-text-muted)] transition-colors hover:bg-[var(--agri-surface-muted)] hover:text-[var(--agri-text)]"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 px-0.5" role="row">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            role="columnheader"
            className="flex h-8 items-center justify-center text-[11px] font-semibold text-[var(--agri-text-muted)]"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Calendar">
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth)
          const selected = selectedDate ? isSameDay(day, selectedDate) : false
          const today = isToday(day)
          const disabled = isDateDisabled(day, min, max)
          const iso = toIsoDateOnly(day.getFullYear(), day.getMonth() + 1, day.getDate())

          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-current={today ? 'date' : undefined}
              disabled={disabled}
              onClick={() => onSelectDay(day)}
              className={cn(
                'flex h-10 w-full items-center justify-center rounded-lg text-sm transition-colors',
                !inMonth && 'text-[var(--agri-text-muted)] opacity-50',
                inMonth && !selected && 'text-[var(--agri-text)] hover:bg-[var(--agri-surface-muted)]',
                selected && 'bg-[var(--agri-primary)] font-semibold text-white hover:bg-[var(--agri-primary)]',
                today && !selected && 'ring-1 ring-[color:color-mix(in_srgb,var(--agri-primary)_35%,transparent)]',
                disabled && 'cursor-not-allowed opacity-30 hover:bg-transparent'
              )}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>

      {mode === 'datetime' ? (
        <NativeTimeInput id={timeInputId} value={draftTime} onChange={onTimeChange} />
      ) : null}

      <button
        type="button"
        onClick={onToday}
        disabled={isDateDisabled(new Date(), min, max)}
        className="flex h-10 w-full items-center justify-center rounded-lg border border-[var(--agri-border)] text-sm font-medium text-[var(--agri-primary)] transition-colors hover:bg-[var(--agri-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        Astăzi
      </button>
    </div>
  )
}

export function AppDatePicker({
  id,
  label,
  placeholder = 'Selectează data',
  value,
  onChange,
  onBlur,
  mode = 'date',
  disabled = false,
  error,
  triggerClassName,
  min,
  max,
}: AppDatePickerProps) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [open, setOpen] = useState(false)
  const selectedDate = getSelectedDate(value, mode)
  const parsedDateTime = mode === 'datetime' ? parseDateTimeLocalValue(value) : null

  const [viewMonth, setViewMonth] = useState<Date>(() => selectedDate ?? new Date())
  const [draftTime, setDraftTime] = useState(parsedDateTime?.time ?? '12:00')
  const [pendingDate, setPendingDate] = useState<string | null>(parsedDateTime?.date ?? (value.trim() || null))

  useEffect(() => {
    if (!open) return
    const base = getSelectedDate(value, mode) ?? new Date()
    setViewMonth(base)
    const parsed = mode === 'datetime' ? parseDateTimeLocalValue(value) : null
    setDraftTime(parsed?.time ?? '12:00')
    setPendingDate(parsed?.date ?? (value.trim() || null))
  }, [open, value, mode])

  const labelId = label ? `${id}-label` : undefined
  const panelId = `${id}-calendar`
  const displayValue = getDisplayValue(value, mode, placeholder)
  const hasValue = Boolean(value.trim())

  const commitDate = (day: Date, close: boolean) => {
    const isoDate = toIsoDateOnly(day.getFullYear(), day.getMonth() + 1, day.getDate())
    if (mode === 'datetime') {
      setPendingDate(isoDate)
      const next = toDateTimeLocalValue(isoDate, draftTime)
      onChange(next)
      if (close) {
        setOpen(false)
        onBlur?.()
      }
      return
    }
    onChange(isoDate)
    setOpen(false)
    onBlur?.()
  }

  const handleSelectDay = (day: Date) => {
    if (isDateDisabled(day, min, max)) return
    commitDate(day, mode === 'date')
  }

  const handleTimeChange = (time: string) => {
    setDraftTime(time)
    const dateIso = pendingDate ?? getLocalTodayIsoDate()
    onChange(toDateTimeLocalValue(dateIso, time))
  }

  const handleToday = () => {
    const today = new Date()
    if (isDateDisabled(today, min, max)) return
    setViewMonth(today)
    if (mode === 'datetime') {
      const iso = getLocalTodayIsoDate()
      const time = draftTime || parseDateTimeLocalValue(getLocalNowDateTimeValue())?.time || '12:00'
      setPendingDate(iso)
      onChange(toDateTimeLocalValue(iso, time))
      return
    }
    commitDate(today, true)
  }

  const calendar = (
    <CalendarPanel
      viewMonth={viewMonth}
      selectedDate={
        pendingDate ? localDateFromIsoDate(pendingDate) : selectedDate
      }
      draftTime={draftTime}
      timeInputId={`${id}-time`}
      mode={mode}
      min={min}
      max={max}
      onSelectDay={handleSelectDay}
      onPrevMonth={() => setViewMonth((current) => subMonths(current, 1))}
      onNextMonth={() => setViewMonth((current) => addMonths(current, 1))}
      onToday={handleToday}
      onTimeChange={handleTimeChange}
    />
  )

  const trigger = (
    <button
      id={id}
      type="button"
      role="combobox"
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={panelId}
      aria-labelledby={labelId}
      aria-label={label ? undefined : placeholder}
      onClick={isMobile ? () => !disabled && setOpen(true) : undefined}
      className={cn(
        'agri-control flex h-12 w-full items-center justify-between rounded-md border border-[var(--agri-border)] bg-[var(--agri-surface)] px-3 text-left text-base shadow-sm',
        disabled && 'cursor-not-allowed opacity-60',
        triggerClassName
      )}
    >
      <span
        className={cn(
          'flex min-w-0 items-center gap-2 truncate',
          hasValue ? 'text-[var(--agri-text)]' : 'text-[var(--agri-text-muted)]'
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-[var(--agri-text-muted)]" aria-hidden />
        <span className="truncate">{displayValue}</span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-[var(--agri-text-muted)]" aria-hidden />
    </button>
  )

  return (
    <div className="space-y-1.5">
      {label ? (
        <Label id={labelId} htmlFor={id}>
          {label}
        </Label>
      ) : null}

      {isMobile ? (
        <>
          {trigger}
          <Sheet
            open={open}
            onOpenChange={(next) => {
              setOpen(next)
              if (!next) onBlur?.()
            }}
          >
            <SheetContent
              side="bottom"
              className="max-h-[85vh] rounded-t-[22px] border-[var(--agri-border)] bg-[var(--agri-surface)] px-4 pb-6 pt-2"
            >
              <SheetHeader className="pb-2 text-left">
                <SheetTitle className="text-base text-[var(--agri-text)]">{label ?? 'Selectează data'}</SheetTitle>
              </SheetHeader>
              <div id={panelId} role="dialog" aria-modal="true">
                {calendar}
                {mode === 'datetime' ? (
                  <button
                    type="button"
                    className="mt-3 flex h-11 w-full items-center justify-center rounded-lg bg-[var(--agri-primary)] text-sm font-semibold text-white"
                    onClick={() => {
                      setOpen(false)
                      onBlur?.()
                    }}
                  >
                    Gata
                  </button>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <Popover
          open={open}
          onOpenChange={(nextOpen) => {
            if (disabled) return
            setOpen(nextOpen)
            if (!nextOpen) onBlur?.()
          }}
        >
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            id={panelId}
            role="dialog"
            align="start"
            sideOffset={6}
            onOpenAutoFocus={(event) => event.preventDefault()}
            className="z-[1105] w-[min(100vw-2rem,22.5rem)] overflow-hidden rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] p-2 shadow-lg"
          >
            {calendar}
          </PopoverContent>
        </Popover>
      )}

      {error ? <p className="text-xs text-[var(--status-danger-text)]">{error}</p> : null}
    </div>
  )
}
