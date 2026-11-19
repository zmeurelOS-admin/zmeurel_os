/**
 * Zile calendaristice ca text ISO (`2026-11-19`), în ora locală a telefonului, fără conversii UTC.
 * Peste utilitarele din `lib/ui/app-date-picker-utils`.
 */
import { getLocalTodayIsoDate, localDateFromIsoDate, parseIsoDateOnly, toIsoDateOnly } from '@/lib/ui/app-date-picker-utils'

export { getLocalTodayIsoDate as todayIso }

/** Ziua aflată la `days` zile de `iso` (negativ = în urmă). Text nevalid → rămâne neschimbat. */
export function addDaysIso(iso: string, days: number): string {
  const date = localDateFromIsoDate(iso)
  if (!date) return iso
  date.setDate(date.getDate() + days)
  return toIsoDateOnly(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/** Ziua e în afara intervalului permis (`min` și `max` sunt incluse în interval). */
export function isIsoOutOfRange(iso: string, min?: string, max?: string): boolean {
  return Boolean((min && iso < min) || (max && iso > max))
}

export interface CalendarMonth {
  year: number
  /** 1–12. */
  month: number
}

/** Luna în care cade o zi; text nevalid → luna lui `fallbackIso`. */
export function monthOfIso(iso: string | null | undefined, fallbackIso: string): CalendarMonth {
  const parsed = (iso ? parseIsoDateOnly(iso) : null) ?? parseIsoDateOnly(fallbackIso)
  if (!parsed) return { year: 1970, month: 1 }
  return { year: parsed.year, month: parsed.month }
}

export function shiftMonth({ year, month }: CalendarMonth, delta: number): CalendarMonth {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 }
}

export interface MonthGrid {
  /** Câte celule goale sunt înaintea zilei de 1 (săptămâna începe luni). */
  leadingBlanks: number
  /** Zilele lunii, ca text ISO, în ordine. */
  days: string[]
}

export function buildMonthGrid({ year, month }: CalendarMonth): MonthGrid {
  const first = new Date(year, month - 1, 1, 12)
  const daysInMonth = new Date(year, month, 0, 12).getDate()
  return {
    leadingBlanks: (first.getDay() + 6) % 7,
    days: Array.from({ length: daysInMonth }, (_, index) => toIsoDateOnly(year, month, index + 1)),
  }
}

/** Luna nu mai are nicio zi permisă (pentru dezactivarea săgeților). */
export function isMonthOutOfRange(month: CalendarMonth, min?: string, max?: string): boolean {
  const { days } = buildMonthGrid(month)
  return Boolean((min && days[days.length - 1] < min) || (max && days[0] > max))
}

export interface DateShortcut {
  label: string
  value: string
}

/** Scurtăturile implicite ale calendarului. */
export function defaultDateShortcuts(today: string): DateShortcut[] {
  return [
    { label: 'Azi', value: today },
    { label: 'Mâine', value: addDaysIso(today, 1) },
    { label: 'Poimâine', value: addDaysIso(today, 2) },
  ]
}

export function monthTitleRo({ year, month }: CalendarMonth): string {
  return new Date(year, month - 1, 1, 12).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })
}

/** Ex. „joi, 19 noiembrie”. */
export function longDayRo(iso: string): string {
  const date = localDateFromIsoDate(iso)
  if (!date) return iso
  return date.toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' })
}
