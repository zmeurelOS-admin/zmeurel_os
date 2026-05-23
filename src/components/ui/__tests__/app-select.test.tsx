import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AppSelect } from '@/components/ui/app-select'

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
    expect(screen.getByRole('button', { name: /Maravilla 1 \(camp\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Solar DELNIWA/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Maravilla 1 \(camp\)/i }))
    expect(onChange).toHaveBeenCalledWith('parcela-a')
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

    await user.click(screen.getByRole('button', { name: /Selectează/i }))
    await user.click(screen.getByRole('button', { name: /Solar DELNIWA/i }))
    expect(onChange).toHaveBeenCalledWith('parcela-b')
  })
})
