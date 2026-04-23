import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AssignParcelaSheet } from '@/components/tratamente/AssignParcelaSheet'

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

describe('AssignParcelaSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('afișează lista de parcele', () => {
    render(
      <AssignParcelaSheet
        anInitial={2026}
        onOpenChange={() => undefined}
        onSubmit={() => undefined}
        open
        parcele={[
          { id: 'p1', id_parcela: 'P1', nume_parcela: 'Parcela Nord', suprafata_m2: 10000, cultura_tip: 'zmeur', tip_fruct: 'zmeur', active_planuri: [] },
        ]}
      />
    )

    expect(screen.getByText('Parcela Nord')).toBeInTheDocument()
  })

  it('selectorul de an este pre-populat cu anul curent dat', () => {
    render(
      <AssignParcelaSheet
        anInitial={2026}
        onOpenChange={() => undefined}
        onSubmit={() => undefined}
        open
        parcele={[]}
      />
    )

    expect(screen.getByDisplayValue('2026')).toBeInTheDocument()
  })

  it('submit este blocat fără parcelă selectată', () => {
    render(
      <AssignParcelaSheet
        anInitial={2026}
        onOpenChange={() => undefined}
        onSubmit={() => undefined}
        open
        parcele={[
          { id: 'p1', id_parcela: 'P1', nume_parcela: 'Parcela Nord', suprafata_m2: 10000, cultura_tip: 'zmeur', tip_fruct: 'zmeur', active_planuri: [] },
        ]}
      />
    )

    expect(screen.getByRole('button', { name: 'Asociază' })).toBeDisabled()
  })

  it('submit cu date valide apelează action', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <AssignParcelaSheet
        anInitial={2026}
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
        open
        parcele={[
          { id: 'p1', id_parcela: 'P1', nume_parcela: 'Parcela Nord', suprafata_m2: 10000, cultura_tip: 'zmeur', tip_fruct: 'zmeur', active_planuri: [] },
        ]}
      />
    )

    await user.click(screen.getByText('Parcela Nord'))
    await user.click(screen.getByRole('button', { name: 'Asociază' }))

    expect(onSubmit).toHaveBeenCalledWith({ an: 2026, parcelaId: 'p1' })
  })
})
