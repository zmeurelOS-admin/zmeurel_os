import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { CupruCumulatCard } from '@/components/tratamente/CupruCumulatCard'

describe('CupruCumulatCard', () => {
  it('nivel ok afișează bara verde și procent', () => {
    render(
      <CupruCumulatCard
        metrici={{
          parcelaId: 'p1',
          an: 2026,
          cupruKgHa: 1.2,
          cupruAlertLevel: 'ok',
          fracViolatii: 0,
          fracDetalii: [],
          totalAplicari: 2,
          urmatoareaAplicare: null,
          ultimaAplicare: null,
        }}
        aplicariCuCupru={[]}
      />
    )

    expect(screen.getByTestId('cupru-progress')).toHaveClass('bg-[var(--status-success-text)]')
    expect(screen.getByText(/Procent:/i)).toBeInTheDocument()
  })

  it('nivel exceeded afișează bara roșie și mesaj', () => {
    render(
      <CupruCumulatCard
        metrici={{
          parcelaId: 'p1',
          an: 2026,
          cupruKgHa: 4.8,
          cupruAlertLevel: 'exceeded',
          fracViolatii: 0,
          fracDetalii: [],
          totalAplicari: 4,
          urmatoareaAplicare: null,
          ultimaAplicare: null,
        }}
        aplicariCuCupru={[]}
      />
    )

    expect(screen.getByTestId('cupru-progress')).toHaveClass('bg-[var(--status-danger-text)]')
    expect(screen.getByText(/depășită/i)).toBeInTheDocument()
  })

  it('afișează corect maximum 3 aplicări și restul în more', () => {
    render(
      <CupruCumulatCard
        metrici={{
          parcelaId: 'p1',
          an: 2026,
          cupruKgHa: 3.2,
          cupruAlertLevel: 'warning',
          fracViolatii: 0,
          fracDetalii: [],
          totalAplicari: 4,
          urmatoareaAplicare: null,
          ultimaAplicare: null,
        }}
        aplicariCuCupru={[
          { id: '1', produs: 'A', data: '1 apr' },
          { id: '2', produs: 'B', data: '2 apr' },
          { id: '3', produs: 'C', data: '3 apr' },
          { id: '4', produs: 'D', data: '4 apr' },
        ]}
      />
    )

    expect(screen.getByText('A · 1 apr')).toBeInTheDocument()
    expect(screen.getByText('B · 2 apr')).toBeInTheDocument()
    expect(screen.getByText('C · 3 apr')).toBeInTheDocument()
    expect(screen.getByText('+ 1 more')).toBeInTheDocument()
  })
})

