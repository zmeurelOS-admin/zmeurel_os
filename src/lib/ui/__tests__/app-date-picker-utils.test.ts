import { describe, expect, it } from 'vitest'

import {
  formatDateDisplayRo,
  formatDateTimeDisplayRo,
  getLocalTodayIsoDate,
  isSameIsoDate,
  parseDateTimeLocalValue,
  toDateTimeLocalValue,
  toIsoDateOnly,
} from '@/lib/ui/app-date-picker-utils'

describe('app-date-picker-utils', () => {
  it('formatează data în română fără shift de zi', () => {
    expect(formatDateDisplayRo('2026-05-23')).toBe('23.05.2026')
    expect(formatDateTimeDisplayRo('2026-05-23T21:47')).toBe('23.05.2026, 21:47')
  })

  it('parsează și reconstruiește datetime-local', () => {
    expect(parseDateTimeLocalValue('2026-05-23T21:47')).toEqual({
      date: '2026-05-23',
      time: '21:47',
    })
    expect(toDateTimeLocalValue('2026-05-23', '21:47')).toBe('2026-05-23T21:47')
  })

  it('compară date ISO fără obiect Date', () => {
    expect(isSameIsoDate('2026-05-23', '2026-05-23')).toBe(true)
    expect(isSameIsoDate('2026-05-23', '2026-05-24')).toBe(false)
  })

  it('construiește ISO date only din părți', () => {
    expect(toIsoDateOnly(2026, 5, 3)).toBe('2026-05-03')
  })

  it('azi local rămâne în format YYYY-MM-DD', () => {
    const today = getLocalTodayIsoDate()
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
