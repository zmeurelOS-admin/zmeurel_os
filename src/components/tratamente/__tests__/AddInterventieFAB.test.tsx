import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AddInterventieFAB } from '@/components/tratamente/AddInterventieFAB'

const listCapcaneActiveActionMock = vi.fn().mockResolvedValue({ ok: true, data: [] })

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/app/(dashboard)/tratamente/capcane/actions', () => ({
  listCapcaneActiveAction: (...args: unknown[]) => listCapcaneActiveActionMock(...args),
}))

vi.mock('@/components/tratamente/MarkAplicataSheet', () => ({
  MarkAplicataSheet: ({
    defaultMetoda,
    mode,
    open,
  }: {
    defaultMetoda?: string | null
    mode?: string
    open: boolean
  }) =>
    open ? (
      <div data-testid="mark-aplicata-sheet" data-default-metoda={defaultMetoda ?? ''} data-mode={mode}>
        MarkAplicataSheet
      </div>
    ) : null,
}))

vi.mock('@/components/tratamente/MarkCapcanaSheet', () => ({
  MarkCapcanaSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="mark-capcana-sheet">MarkCapcanaSheet</div> : null,
}))

vi.mock('@/components/tratamente/SelectorCapcaneActiveSheet', () => ({
  SelectorCapcaneActiveSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="selector-capcane-sheet">SelectorCapcaneActiveSheet</div> : null,
}))

vi.mock('@/components/tratamente/VerificaCapcanaSheet', () => ({
  VerificaCapcanaSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="verifica-capcana-sheet">VerificaCapcanaSheet</div> : null,
}))

const baseMarkAplicataProps = {
  defaultCantitateMl: null,
  defaultOperator: '',
  defaultStadiu: null,
  defaultManualStatus: 'aplicata' as const,
  configurareSezon: null,
  grupBiologic: null,
  isRubusMixt: false,
  manualParcele: [],
  meteoSnapshot: null,
  onSubmit: vi.fn(),
  pending: false,
  produseFitosanitare: [],
}

describe('AddInterventieFAB', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    listCapcaneActiveActionMock.mockClear()
  })

  it('este marcat mobile-only prin clasa lg:hidden', () => {
    render(<AddInterventieFAB markAplicataProps={baseMarkAplicataProps} />)

    expect(screen.getByRole('button', { name: 'Adaugă intervenție' })).toHaveClass('lg:hidden')
  })

  it('deschide picker-ul la click pe FAB', async () => {
    const user = userEvent.setup()

    render(<AddInterventieFAB markAplicataProps={baseMarkAplicataProps} />)

    await user.click(screen.getByRole('button', { name: 'Adaugă intervenție' }))

    expect(await screen.findByRole('button', { name: 'Foliar' })).toBeInTheDocument()
  })

  it("deschide MarkAplicataSheet în mode='manual' după pick foliar", async () => {
    const user = userEvent.setup()

    render(<AddInterventieFAB markAplicataProps={baseMarkAplicataProps} />)

    await user.click(screen.getByRole('button', { name: 'Adaugă intervenție' }))
    await user.click(await screen.findByRole('button', { name: 'Foliar' }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Foliar' })).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('mark-aplicata-sheet')).toHaveAttribute('data-mode', 'manual')
    expect(screen.getByTestId('mark-aplicata-sheet')).toHaveAttribute('data-default-metoda', 'foliar')
  })

  it('deschide MarkCapcanaSheet pentru Pus capcane', async () => {
    const user = userEvent.setup()

    render(<AddInterventieFAB markAplicataProps={baseMarkAplicataProps} />)

    await user.click(screen.getByRole('button', { name: 'Adaugă intervenție' }))
    await user.click(await screen.findByRole('button', { name: 'Pus capcane' }))

    expect(screen.getByTestId('mark-capcana-sheet')).toBeInTheDocument()
    expect(screen.queryByTestId('mark-aplicata-sheet')).not.toBeInTheDocument()
  })

  it('deschide selectorul pentru Verificat capcane', async () => {
    const user = userEvent.setup()

    render(
      <AddInterventieFAB
        markAplicataProps={baseMarkAplicataProps}
        parcele={[{ id: '11111111-1111-4111-8111-111111111111', nume_parcela: 'Maravilla', suprafata_ha: 0.4 }]}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Adaugă intervenție' }))
    await user.click(await screen.findByRole('button', { name: 'Verificat capcane' }))

    expect(await screen.findByTestId('selector-capcane-sheet')).toBeInTheDocument()
    expect(listCapcaneActiveActionMock).toHaveBeenCalled()
  })
})
