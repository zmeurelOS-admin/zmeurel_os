import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CardAstazi } from '@/components/tratamente/CardAstazi'
import type { SugestieAstazi } from '@/lib/supabase/queries/tratamente'

function makeSugestie(overrides: Partial<SugestieAstazi> = {}): SugestieAstazi {
  return {
    parcela: { id: 'parcela-1', nume: 'Maravilla' },
    fenofazaCurenta: 'inflorit',
    metoda: 'foliar',
    titlu: 'Botritis preventiv',
    produs: { nume: 'Switch 62.5 WG', dozaText: '0.6 kg/ha' },
    sursa: 'plan',
    ...overrides,
  }
}

describe('CardAstazi', () => {
  it('afișează sugestia venită din planul activ', () => {
    render(<CardAstazi sugestie={makeSugestie()} onStropitAcum={vi.fn()} />)

    expect(screen.getByText(/Sugestie din planul tău activ/i)).toBeInTheDocument()
    expect(screen.getByText('Switch 62.5 WG — 0.6 kg/ha')).toBeInTheDocument()
    expect(screen.getByText(/Parcelă Maravilla/i)).toBeInTheDocument()
  })

  it('afișează sursa platformă când sugestia vine din reguli globale', () => {
    render(<CardAstazi sugestie={makeSugestie({ sursa: 'platforma' })} onStropitAcum={vi.fn()} />)

    expect(screen.getByText(/Sugestie din recomandări platformă/i)).toBeInTheDocument()
  })

  it('afișează empty state când nu există sugestie activă', () => {
    render(<CardAstazi sugestie={null} onStropitAcum={vi.fn()} />)

    expect(screen.getByText('Nu există o sugestie activă pentru azi.')).toBeInTheDocument()
  })

  it('apelează callback-ul pentru Stropit acum', async () => {
    const user = userEvent.setup()
    const onStropitAcum = vi.fn()

    render(<CardAstazi sugestie={makeSugestie()} onStropitAcum={onStropitAcum} />)

    await user.click(screen.getByRole('button', { name: 'Stropit acum' }))

    expect(onStropitAcum).toHaveBeenCalledTimes(1)
  })
})
