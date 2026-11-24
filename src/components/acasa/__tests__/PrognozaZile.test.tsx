import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PrognozaZile, PuneLoculFermei } from '@/components/acasa/PrognozaZile'

describe('PrognozaZile (promptul 33)', () => {
  it('3 zile compacte, cu avertizarea de îngheț și de ploaie mare', () => {
    render(
      <PrognozaZile
        azi="2026-11-24"
        zile={[
          { zi: '2026-11-25', tempMin: -2, tempMax: 4, ploaieMm: 0, vantMaxKmh: 12, icon: null },
          { zi: '2026-11-26', tempMin: 3, tempMax: 8, ploaieMm: 24, vantMaxKmh: 30, icon: null },
          { zi: '2026-11-27', tempMin: 2, tempMax: 6, ploaieMm: null, vantMaxKmh: null, icon: null },
        ]}
      />,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Mâine')).toBeTruthy()
    expect(screen.getByText('24 mm')).toBeTruthy()
    expect(screen.getByText('30 km/h')).toBeTruthy()
    expect(screen.getByText('Îngheț mâine: -2 °C')).toBeTruthy()
    expect(screen.getByText('Ploaie mare joi: 24 mm')).toBeTruthy()
  })

  it('fără zile nu arată nimic; fără loc, rândul duce la Setări › Ferma', () => {
    const { container } = render(<PrognozaZile azi="2026-11-24" zile={[]} />)
    expect(container.textContent).toBe('')
    render(<PuneLoculFermei />)
    expect(screen.getByRole('link', { name: 'Pune locul fermei ca să vezi vremea ta' }).getAttribute('href')).toBe('/settings/ferma')
  })
})
