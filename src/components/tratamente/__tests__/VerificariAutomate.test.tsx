import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { VerificariAutomate } from '@/components/tratamente/VerificariAutomate'

describe('VerificariAutomate', () => {
  it('afișează PHI safe cu status OK', () => {
    render(
      <VerificariAutomate
        phi={{ tone: 'success', message: 'PHI OK — aplicare sigură înainte de recoltare' }}
        sezon={{ tone: 'success', message: 'Aplicat 1/3 dată anul acesta' }}
        stoc={{ tone: 'neutral', message: '— (verificare manuală)' }}
      />,
    )

    expect(screen.getByText(/PHI OK/i)).toBeInTheDocument()
    expect(screen.getAllByLabelText('Status OK').length).toBeGreaterThan(0)
  })

  it('afișează conflict PHI cu dată', () => {
    render(
      <VerificariAutomate
        phi={{ tone: 'danger', message: 'Conflict PHI cu recoltare de 27 apr' }}
        sezon={{ tone: 'success', message: 'Aplicat 1/3 dată anul acesta' }}
        stoc={{ tone: 'neutral', message: '— (verificare manuală)' }}
      />,
    )

    expect(screen.getByText(/27 apr/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Status critic')).toBeInTheDocument()
  })

  it('marchează verde când numărul de aplicări este sub maxim', () => {
    render(
      <VerificariAutomate
        phi={{ tone: 'success', message: 'PHI OK — aplicare sigură înainte de recoltare' }}
        sezon={{ tone: 'success', message: 'Aplicat 1/3 dată anul acesta' }}
        stoc={{ tone: 'neutral', message: '— (verificare manuală)' }}
      />,
    )

    expect(screen.getByText('Aplicat 1/3 dată anul acesta')).toBeInTheDocument()
  })

  it('marchează roșu când numărul de aplicări depășește maximul', () => {
    render(
      <VerificariAutomate
        phi={{ tone: 'success', message: 'PHI OK — aplicare sigură înainte de recoltare' }}
        sezon={{ tone: 'danger', message: 'Aplicat 4/3 dată anul acesta' }}
        stoc={{ tone: 'neutral', message: '— (verificare manuală)' }}
      />,
    )

    expect(screen.getByText('Aplicat 4/3 dată anul acesta')).toBeInTheDocument()
    expect(screen.getByLabelText('Status critic')).toBeInTheDocument()
  })

  it('afișează stoc necunoscut ca neutru', () => {
    render(
      <VerificariAutomate
        phi={{ tone: 'success', message: 'PHI OK — aplicare sigură înainte de recoltare' }}
        sezon={{ tone: 'success', message: 'Aplicat 1/3 dată anul acesta' }}
        stoc={{ tone: 'neutral', message: '— (verificare manuală)' }}
      />,
    )

    expect(screen.getByText('— (verificare manuală)')).toBeInTheDocument()
    expect(screen.getByLabelText('Status neutru')).toBeInTheDocument()
  })
})
