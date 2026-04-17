import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { MeteoWindowBar } from '@/components/tratamente/MeteoWindowBar'

const ferestre = Array.from({ length: 24 }, (_, index) => ({
  ora_start: `2026-04-20T${String(index).padStart(2, '0')}:00:00.000Z`,
  ora_end: `2026-04-20T${String((index + 1) % 24).padStart(2, '0')}:00:00.000Z`,
  safe: index % 2 === 0,
  motiv_blocaj: index % 2 === 0 ? null : 'Vânt > 15 km/h',
  temperatura_c: 8 + index / 2,
  vant_kmh: index % 2 === 0 ? 8 : 18,
  precipitatii_mm: index % 2 === 0 ? 0 : 0.8,
}))

describe('MeteoWindowBar', () => {
  it('afișează 24 de segmente orare', () => {
    render(<MeteoWindowBar dateLabel="Luni, 20 apr" ferestre={ferestre} />)

    expect(screen.getAllByTestId('meteo-segment')).toHaveLength(24)
  })

  it('colorează segmentele safe și unsafe', () => {
    render(<MeteoWindowBar dateLabel="Luni, 20 apr" ferestre={ferestre} />)

    const segments = screen.getAllByTestId('meteo-segment')
    expect(segments[0]).toHaveClass('bg-green-500')
    expect(segments[1]).toHaveClass('bg-red-500')
  })

  it('afișează legenda cu temp min/max corect calculate', () => {
    render(<MeteoWindowBar dateLabel="Luni, 20 apr" ferestre={ferestre} />)

    expect(screen.getByText('Temp: 8°C - 19.5°C')).toBeInTheDocument()
    expect(screen.getByText('Vânt max: 18 km/h')).toBeInTheDocument()
  })
})
