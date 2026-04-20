import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { FracRotationCard } from '@/components/tratamente/FracRotationCard'

describe('FracRotationCard', () => {
  it('zero aplicări afișează empty state', () => {
    render(<FracRotationCard timeline={[]} violatii={[]} />)
    expect(screen.getByText(/Nicio aplicare înregistrată/i)).toBeInTheDocument()
  })

  it('cu violări afișează alerta', () => {
    render(
      <FracRotationCard
        timeline={[{ aplicareId: 'a1', cod: 'M01' }]}
        violatii={[{ frac: 'M01', aplicari_consecutive: 3 }]}
      />
    )

    expect(screen.getByText(/M01 folosit de 3 ori consecutiv/i)).toBeInTheDocument()
  })

  it('același cod are culoare deterministică între randări', () => {
    const { rerender } = render(
      <FracRotationCard
        timeline={[{ aplicareId: 'a1', cod: 'M01' }]}
        violatii={[]}
      />
    )

    const firstStyle = screen.getByTestId('frac-chip-M01').getAttribute('style')

    rerender(
      <FracRotationCard
        timeline={[{ aplicareId: 'a2', cod: 'M01' }]}
        violatii={[]}
      />
    )

    const secondStyle = screen.getByTestId('frac-chip-M01').getAttribute('style')
    expect(firstStyle).toBe(secondStyle)
  })
})

