/**
 * Ziua calendaristică în ora României (`Europe/Bucharest`), oriunde ar rula codul: pe server (UTC pe Vercel)
 * sau pe un telefon cu alt fus. `toISOString().slice(0, 10)` dă ziua UTC, deci ziua de ieri între 00:00 și
 * 02:00 (iarna) / 03:00 (vara) în România.
 */
const FUS_ORAR_ROMANIA = 'Europe/Bucharest'

/** `YYYY-MM-DD` pentru momentul dat, în București. */
export function ziuaInRomania(moment: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUS_ORAR_ROMANIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(moment)
}

/** Câte zile calendaristice sunt de la `de` la `pana` (`YYYY-MM-DD`; negativ = în urmă). */
export function zileCalendaristiceIntre(de: string, pana: string): number {
  const a = Date.parse(`${de.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${pana.slice(0, 10)}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}
