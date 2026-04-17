import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { StadiuCurentCard } from '@/components/tratamente/StadiuCurentCard'
import type { StadiuFenologicParcela } from '@/lib/supabase/queries/tratamente'

describe('StadiuCurentCard', () => {
  it('afișează empty state când nu există stadiu', () => {
    const onUpdate = vi.fn()

    render(
      <StadiuCurentCard
        stadiuCurent={null}
        stadiuProgress={0}
        stadiuUrmator={null}
        onRecord={onUpdate}
      />,
    )

    expect(screen.getByText('Nu ai înregistrat niciun stadiu anul acesta.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Înregistrează primul stadiu' })).toBeInTheDocument()
  })

  it('afișează stadiul curent și progress bar-ul pentru un stadiu înregistrat', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    const stadiuCurent: StadiuFenologicParcela = {
      id: 's1',
      tenant_id: 't1',
      parcela_id: 'p1',
      an: 2026,
      stadiu: 'buton_verde',
      data_observata: '2026-04-12',
      sursa: 'manual',
      observatii: null,
      created_at: '2026-04-12T08:00:00Z',
      updated_at: '2026-04-12T08:00:00Z',
      created_by: null,
    }

    const { container } = render(
      <StadiuCurentCard
        stadiuCurent={stadiuCurent}
        stadiuProgress={33}
        stadiuUrmator="buton_roz"
        onRecord={onUpdate}
      />,
    )

    expect(screen.getByText('Buton verde')).toBeInTheDocument()
    expect(screen.getByText(/Observat 12 apr/i)).toBeInTheDocument()

    const progressFill = container.querySelector('div[style*="width: 33%"]')
    expect(progressFill).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Actualizează stadiu' }))
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })
})
