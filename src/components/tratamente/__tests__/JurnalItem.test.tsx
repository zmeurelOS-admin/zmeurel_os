import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { JurnalItem } from '@/components/tratamente/JurnalItem'
import type { JurnalAplicareItem } from '@/lib/supabase/queries/tratamente'

function makeItem(overrides: Partial<JurnalAplicareItem> = {}): JurnalAplicareItem {
  return {
    aplicareId: overrides.aplicareId ?? 'aplicare-1',
    dataAplicata: overrides.dataAplicata ?? '2026-05-09',
    parcelaId: overrides.parcelaId ?? 'parcela-1',
    parcelaNume: overrides.parcelaNume ?? 'Maravilla',
    metodaAplicare: overrides.metodaAplicare ?? 'foliar',
    produse: overrides.produse ?? [
      { nume: 'Movento', dozaText: '0.75 L/ha' },
      { nume: 'Calbit C', dozaText: '2.5 L/ha' },
    ],
    status: overrides.status ?? 'aplicata',
  }
}

describe('JurnalItem', () => {
  it('afișează parcela, primul produs și sumarul dozelor', () => {
    render(<JurnalItem item={makeItem()} onClick={vi.fn()} />)

    expect(screen.getByText('Maravilla')).toBeInTheDocument()
    expect(screen.getByText('Movento +1')).toBeInTheDocument()
    expect(screen.getByText('0.75 L/ha + 2.5 L/ha')).toBeInTheDocument()
  })

  it('apelează callback-ul la click', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(<JurnalItem item={makeItem()} onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: /Maravilla/i }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('randează ciornele ca item-uri editabile existente', () => {
    render(
      <JurnalItem
        item={makeItem({
          status: 'ciorna',
          produse: [{ nume: 'Ciornă tratament', dozaText: '' }],
        })}
        onClick={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: /Ciornă tratament/i })).toBeInTheDocument()
  })
})
