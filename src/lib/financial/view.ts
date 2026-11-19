/**
 * Cheltuieli și Investiții, pagina comună: perioada afișată (lună sau an), totalurile cardurilor de sus
 * și gruparea listei. Funcții pure.
 */
import { round2 } from '@/lib/format-ro'

export interface MonthRef {
  year: number
  /** 1–12. */
  month: number
}

const pad = (value: number) => String(value).padStart(2, '0')
const dayOf = (value: string | null | undefined) => String(value ?? '').slice(0, 10)

export function monthOfIso(iso: string): MonthRef {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) }
}

export function shiftMonthRef({ year, month }: MonthRef, delta: number): MonthRef {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 }
}

/** `2026-11`: prefixul zilelor dintr-o lună. */
export function monthPrefix({ year, month }: MonthRef): string {
  return `${year}-${pad(month)}`
}

/** Prima și ultima zi a lunii, ca text ISO. */
export function monthRange(ref: MonthRef): { start: string; end: string } {
  const lastDay = new Date(ref.year, ref.month, 0, 12).getDate()
  return { start: `${monthPrefix(ref)}-01`, end: `${monthPrefix(ref)}-${pad(lastDay)}` }
}

export function isSameMonth(left: MonthRef, right: MonthRef): boolean {
  return left.year === right.year && left.month === right.month
}

type Dated = { data: string | null }
type Money = Dated & { suma_lei: number | null }

export function rowsOfMonth<T extends Dated>(rows: readonly T[], ref: MonthRef): T[] {
  const prefix = monthPrefix(ref)
  return rows.filter((row) => dayOf(row.data).startsWith(prefix))
}

export function rowsOfYear<T extends Dated>(rows: readonly T[], year: number): T[] {
  const prefix = `${year}-`
  return rows.filter((row) => dayOf(row.data).startsWith(prefix))
}

export function sumLei(rows: readonly Money[]): number {
  return round2(rows.reduce((sum, row) => sum + (Number(row.suma_lei) || 0), 0))
}

/** Cele mai noi întâi; la aceeași zi, ultima introdusă întâi. */
export function sortNewestFirst<T extends Dated & { created_at?: string | null }>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (left, right) =>
      dayOf(right.data).localeCompare(dayOf(left.data)) ||
      String(right.created_at ?? '').localeCompare(String(left.created_at ?? '')),
  )
}

/** Rândurile unei liste, grupate pe zi (ziua cea mai nouă întâi). */
export function groupByDay<T extends Dated>(rows: readonly T[]): Array<{ day: string; rows: T[] }> {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const day = dayOf(row.data)
    const list = groups.get(day)
    if (list) list.push(row)
    else groups.set(day, [row])
  }
  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([day, list]) => ({ day, rows: list }))
}
