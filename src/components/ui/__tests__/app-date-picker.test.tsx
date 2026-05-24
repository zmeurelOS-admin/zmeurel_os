import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AppDatePicker } from '@/components/ui/app-date-picker'

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

describe('AppDatePicker', () => {
  it('afișează luna, navighează și selectează o zi (format YYYY-MM-DD)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <AppDatePicker
        id="test-date"
        label="Data"
        value=""
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('combobox', { name: 'Data' }))
    expect(screen.getByRole('grid', { name: 'Calendar' })).toBeInTheDocument()
    expect(screen.getByText(/\d{4}/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Luna următoare' }))
    await user.click(screen.getByRole('button', { name: 'Luna anterioară' }))

    const dayCell = screen.getAllByRole('gridcell').find((cell) => cell.textContent === '15' && !cell.hasAttribute('disabled'))
    expect(dayCell).toBeDefined()
    await user.click(dayCell!)

    expect(onChange).toHaveBeenCalled()
    const saved = onChange.mock.calls.at(-1)?.[0] as string
    expect(saved).toMatch(/^\d{4}-\d{2}-15$/)
  })

  it('setează azi la click pe Astăzi', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <AppDatePicker
        id="test-today"
        label="Data aplicare"
        value=""
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('combobox', { name: 'Data aplicare' }))
    await user.click(screen.getByRole('button', { name: 'Astăzi' }))

    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })

  it('păstrează ora la schimbarea zilei în mod datetime', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <AppDatePicker
        id="test-datetime"
        label="Data aplicării"
        mode="datetime"
        value="2026-05-10T14:30"
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('combobox', { name: 'Data aplicării' }))
    const dayCell = screen.getAllByRole('gridcell').find((cell) => cell.textContent === '20' && !cell.hasAttribute('disabled'))
    await user.click(dayCell!)

    expect(onChange).toHaveBeenCalledWith('2026-05-20T14:30')
  })
})
