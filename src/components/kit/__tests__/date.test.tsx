import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CalendarPanel } from '@/components/kit/CalendarSheet'
import {
  addDaysIso,
  buildMonthGrid,
  defaultDateShortcuts,
  isIsoOutOfRange,
  isMonthOutOfRange,
  monthOfIso,
  shiftMonth,
} from '@/components/kit/lib/date'

describe('zile calendaristice', () => {
  it('addDaysIso trece corect peste sfârșit de lună și de an', () => {
    expect(addDaysIso('2026-11-19', 1)).toBe('2026-11-20')
    expect(addDaysIso('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDaysIso('2026-12-31', 2)).toBe('2027-01-02')
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('limitele min și max sunt incluse în interval', () => {
    expect(isIsoOutOfRange('2026-11-19', '2026-11-19', '2026-11-25')).toBe(false)
    expect(isIsoOutOfRange('2026-11-25', '2026-11-19', '2026-11-25')).toBe(false)
    expect(isIsoOutOfRange('2026-11-18', '2026-11-19')).toBe(true)
    expect(isIsoOutOfRange('2026-11-26', undefined, '2026-11-25')).toBe(true)
    expect(isIsoOutOfRange('2026-11-26')).toBe(false)
  })

  it('grila lunii începe luni', () => {
    // 1 noiembrie 2026 e duminică: 6 celule goale înainte.
    const november = buildMonthGrid({ year: 2026, month: 11 })
    expect(november.leadingBlanks).toBe(6)
    expect(november.days).toHaveLength(30)
    expect(november.days[0]).toBe('2026-11-01')
    expect(november.days[29]).toBe('2026-11-30')

    // 1 iunie 2026 e luni: nicio celulă goală.
    expect(buildMonthGrid({ year: 2026, month: 6 }).leadingBlanks).toBe(0)
  })

  it('februarie are 29 de zile în an bisect', () => {
    expect(buildMonthGrid({ year: 2028, month: 2 }).days).toHaveLength(29)
    expect(buildMonthGrid({ year: 2027, month: 2 }).days).toHaveLength(28)
  })

  it('shiftMonth trece peste an în ambele sensuri', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth({ year: 2026, month: 11 }, -11)).toEqual({ year: 2025, month: 12 })
  })

  it('monthOfIso cade pe luna zilei de rezervă când valoarea lipsește', () => {
    expect(monthOfIso('2026-12-05', '2026-11-19')).toEqual({ year: 2026, month: 12 })
    expect(monthOfIso(null, '2026-11-19')).toEqual({ year: 2026, month: 11 })
    expect(monthOfIso('nu e dată', '2026-11-19')).toEqual({ year: 2026, month: 11 })
  })

  it('o lună fără nicio zi permisă e în afara intervalului', () => {
    expect(isMonthOutOfRange({ year: 2026, month: 10 }, '2026-11-19')).toBe(true)
    expect(isMonthOutOfRange({ year: 2026, month: 11 }, '2026-11-19')).toBe(false)
    expect(isMonthOutOfRange({ year: 2027, month: 1 }, undefined, '2026-12-31')).toBe(true)
  })

  it('scurtăturile implicite sunt Azi, Mâine, Poimâine', () => {
    expect(defaultDateShortcuts('2026-11-30')).toEqual([
      { label: 'Azi', value: '2026-11-30' },
      { label: 'Mâine', value: '2026-12-01' },
      { label: 'Poimâine', value: '2026-12-02' },
    ])
  })
})

describe('CalendarPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 19, 10, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('arată luna curentă, în română, cu ziua de azi marcată', () => {
    render(<CalendarPanel value={null} onChange={() => undefined} />)

    expect(screen.getByText('noiembrie 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'joi, 19 noiembrie' })).toHaveAttribute('aria-current', 'date')
  })

  it('scurtăturile aleg Azi, Mâine și Poimâine', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CalendarPanel value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Azi' }))
    await user.click(screen.getByRole('button', { name: 'Mâine' }))
    await user.click(screen.getByRole('button', { name: 'Poimâine' }))

    expect(onChange.mock.calls.map((call) => call[0])).toEqual(['2026-11-19', '2026-11-20', '2026-11-21'])
  })

  it('zilele din afara limitelor sunt inactive', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CalendarPanel value={null} onChange={onChange} min="2026-11-19" max="2026-11-25" shortcuts={false} />)

    const before = screen.getByRole('button', { name: 'miercuri, 18 noiembrie' })
    const after = screen.getByRole('button', { name: 'joi, 26 noiembrie' })
    expect(before).toBeDisabled()
    expect(after).toBeDisabled()

    await user.click(before)
    expect(onChange).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'marți, 24 noiembrie' }))
    expect(onChange).toHaveBeenCalledWith('2026-11-24')
  })

  it('săgețile schimbă luna și se opresc la limită', async () => {
    const user = userEvent.setup()
    render(<CalendarPanel value={null} onChange={() => undefined} min="2026-11-19" />)

    expect(screen.getByRole('button', { name: 'Luna anterioară' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Luna următoare' }))
    expect(screen.getByText('decembrie 2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Luna anterioară' })).toBeEnabled()
  })

  it('pornește pe luna zilei alese și o marchează', () => {
    const { container } = render(<CalendarPanel value="2026-12-24" onChange={() => undefined} />)

    expect(screen.getByText('decembrie 2026')).toBeInTheDocument()
    const selected = within(container).getByRole('button', { name: 'joi, 24 decembrie' })
    expect(selected).toHaveAttribute('aria-pressed', 'true')
  })
})
