import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ConfigurareSezonDialog } from '@/components/tratamente/ConfigurareSezonDialog'

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

describe('ConfigurareSezonDialog', () => {
  it('afișează selectorul pentru sistemul de conducere la rubus', () => {
    render(
      <ConfigurareSezonDialog
        an={2026}
        configurareSezon={null}
        grupBiologic="rubus"
        open
        onOpenChange={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    expect(screen.getByText('Sistem de conducere')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('afișează selectorul pentru tipul de ciclu la solanacee', () => {
    render(
      <ConfigurareSezonDialog
        an={2026}
        configurareSezon={null}
        grupBiologic="solanacee"
        open
        onOpenChange={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    expect(screen.getByText('Tip ciclu soi')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('afișează mesajul informativ pentru culturile care nu necesită configurare', () => {
    render(
      <ConfigurareSezonDialog
        an={2026}
        configurareSezon={null}
        grupBiologic="frunzoase"
        open
        onOpenChange={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    expect(screen.getByText('Nu sunt necesare configurări specifice pentru această cultură.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Închide' })).toBeInTheDocument()
  })
})

