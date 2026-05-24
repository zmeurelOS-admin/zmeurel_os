import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AppSelect } from '@/components/ui/app-select'

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

const options = [
  { value: '', label: 'Selectează teren' },
  { value: 'parcela-a', label: 'Maravilla 1 (camp)' },
  { value: 'parcela-b', label: 'Solar DELNIWA', emoji: '☀️' },
]

describe('AppSelect', () => {
  it('afișează opțiunile și apelează onChange la selecție', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <AppSelect
        id="teren-select"
        label="Teren"
        placeholder="Selectează teren"
        value=""
        options={options}
        onChange={onChange}
      />
    )

    expect(screen.getByLabelText('Teren')).toBeInTheDocument()

    await user.click(screen.getByLabelText('Teren'))
    expect(screen.getByRole('option', { name: /Maravilla 1 \(camp\)/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Solar DELNIWA/i })).toBeInTheDocument()

    await user.click(screen.getByRole('option', { name: /Maravilla 1 \(camp\)/i }))
    expect(onChange).toHaveBeenCalledWith('parcela-a')
  })

  it('folosește un container de listă scrollabil pentru opțiuni lungi', async () => {
    const user = userEvent.setup()
    const longOptions = Array.from({ length: 12 }, (_, index) => ({
      value: `stadiu-${index}`,
      label: `Stadiu ${index + 1}`,
    }))

    render(
      <AppSelect
        id="stadiu-select-scroll"
        label="Stadiu"
        placeholder="Selectează stadiul"
        value=""
        options={longOptions}
        onChange={() => undefined}
      />
    )

    await user.click(screen.getByLabelText('Stadiu'))

    const listbox = screen.getByRole('listbox', { name: 'Stadiu' })
    expect(listbox).toHaveClass('overflow-y-auto')
    expect(listbox).toHaveClass('min-h-0')
    expect(listbox).toHaveClass('overscroll-contain')
  })

  it('afișează emoji în opțiune când este furnizat', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <AppSelect
        id="teren-select-emoji"
        value=""
        options={options}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('combobox', { name: /Selectează/i }))
    await user.click(screen.getByRole('option', { name: /Solar DELNIWA/i }))
    expect(onChange).toHaveBeenCalledWith('parcela-b')
  })
})
