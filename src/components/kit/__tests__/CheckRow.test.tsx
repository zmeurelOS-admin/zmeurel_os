import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CheckRow, canToggleCheckRow } from '@/components/kit'

describe('CheckRow', () => {
  it('regula: blocat nu se poate bifa, dar blocat și bifat se poate debifa', () => {
    expect(canToggleCheckRow(false, false)).toBe(true)
    expect(canToggleCheckRow(true, false)).toBe(true)
    expect(canToggleCheckRow(false, true)).toBe(false)
    expect(canToggleCheckRow(true, true)).toBe(true)
  })

  it('se bifează și se debifează la apăsare', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    const { rerender } = render(
      <CheckRow title="Maria Ionescu" trailing="5 kg" checked={false} onCheckedChange={onCheckedChange} />,
    )

    const row = screen.getByRole('checkbox', { name: /Maria Ionescu/ })
    expect(row).toHaveAttribute('aria-checked', 'false')
    await user.click(row)
    expect(onCheckedChange).toHaveBeenLastCalledWith(true)

    rerender(<CheckRow title="Maria Ionescu" trailing="5 kg" checked onCheckedChange={onCheckedChange} />)
    expect(row).toHaveAttribute('aria-checked', 'true')
    await user.click(row)
    expect(onCheckedChange).toHaveBeenLastCalledWith(false)
  })

  it('blocat: nu se poate bifa, nici cu mouse-ul, nici cu tastatura', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(
      <CheckRow
        title="Patiseria Bucovina"
        trailing="12 kg"
        checked={false}
        onCheckedChange={onCheckedChange}
        locked
        lockedReason="Nu ajunge stocul: lipsesc 3 kg"
      />,
    )

    const row = screen.getByRole('checkbox', { name: /Patiseria Bucovina/ })
    expect(row).toHaveAttribute('aria-disabled', 'true')

    await user.click(row)
    row.focus()
    await user.keyboard('{Enter}')
    await user.keyboard(' ')

    expect(onCheckedChange).not.toHaveBeenCalled()
    expect(row).toHaveAttribute('aria-checked', 'false')
  })

  it('blocat: rămâne focusabil, iar motivul e legat de rând', () => {
    render(
      <CheckRow
        title="Patiseria Bucovina"
        checked={false}
        onCheckedChange={() => undefined}
        locked
        lockedReason="Nu ajunge stocul: lipsesc 3 kg"
      />,
    )

    const row = screen.getByRole('checkbox', { name: /Patiseria Bucovina/ })
    expect(row).not.toBeDisabled()
    expect(row).toHaveAccessibleDescription('Nu ajunge stocul: lipsesc 3 kg')
  })

  it('blocat, dar deja bifat: se poate debifa', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(
      <CheckRow
        title="Ion Popescu"
        checked
        onCheckedChange={onCheckedChange}
        locked
        lockedReason="Nu ajunge stocul: lipsesc 2 kg"
      />,
    )

    const row = screen.getByRole('checkbox', { name: /Ion Popescu/ })
    expect(row).not.toHaveAttribute('aria-disabled')
    await user.click(row)
    expect(onCheckedChange).toHaveBeenCalledWith(false)
  })
})
