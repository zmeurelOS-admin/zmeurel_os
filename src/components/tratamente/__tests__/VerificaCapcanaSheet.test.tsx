import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { VerificaCapcanaSheet } from '@/components/tratamente/VerificaCapcanaSheet'

const verificaCapcanaActionMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('@/app/(dashboard)/tratamente/capcane/actions', () => ({
  verificaCapcanaAction: (...args: unknown[]) => verificaCapcanaActionMock(...args),
}))

vi.mock('@/components/app/DashboardAuthContext', () => ({
  useDashboardAuth: () => ({ tenantId: 'tenant-1' }),
}))

vi.mock('@/lib/ui/toast', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

const originalHasPointerCapture = HTMLElement.prototype.hasPointerCapture
const originalSetPointerCapture = HTMLElement.prototype.setPointerCapture
const originalReleasePointerCapture = HTMLElement.prototype.releasePointerCapture

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false
  HTMLElement.prototype.setPointerCapture = () => undefined
  HTMLElement.prototype.releasePointerCapture = () => undefined
})

afterAll(() => {
  HTMLElement.prototype.hasPointerCapture = originalHasPointerCapture
  HTMLElement.prototype.setPointerCapture = originalSetPointerCapture
  HTMLElement.prototype.releasePointerCapture = originalReleasePointerCapture
})

const baseCapcana = {
  id: '33333333-3333-4333-8333-333333333333',
  tipCapcana: 'drosophila_otet' as const,
  nrBucati: 4,
  parcelaNume: 'Maravilla',
  dataMontare: '2026-05-06',
}

describe('VerificaCapcanaSheet', () => {
  beforeEach(() => {
    verificaCapcanaActionMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
  })

  it('afișează sumarul capcanei', () => {
    render(
      <VerificaCapcanaSheet
        open
        onOpenChange={vi.fn()}
        capcanaMontata={baseCapcana}
      />
    )

    expect(screen.getByText('Verifică capcane')).toBeInTheDocument()
    expect(screen.getByText('Drosophila — capcană oțet · Maravilla')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getAllByText('Maravilla').length).toBeGreaterThan(0)
  })

  it('afișează warning când pragul pentru Drosophila este depășit', async () => {
    const user = userEvent.setup()

    render(
      <VerificaCapcanaSheet
        open
        onOpenChange={vi.fn()}
        capcanaMontata={baseCapcana}
      />
    )

    const countInput = screen.getByRole('spinbutton')
    await user.clear(countInput)
    await user.type(countInput, '15')

    expect(screen.getByText(/Prag depășit/i)).toBeInTheDocument()
    expect(screen.getByText('Recomandat tratament')).toBeInTheDocument()
  })

  it('trimite payload-ul corect când acțiunea este scos', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    verificaCapcanaActionMock.mockResolvedValue({ ok: true })

    render(
      <VerificaCapcanaSheet
        open
        onOpenChange={onOpenChange}
        capcanaMontata={baseCapcana}
      />
    )

    await user.click(screen.getByLabelText('Scos definitiv'))
    await user.click(screen.getByRole('button', { name: 'Salvează verificarea' }))

    await waitFor(() => {
      expect(verificaCapcanaActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          capcanaMontataId: baseCapcana.id,
          actiune: 'scos',
          pragDepasit: false,
          fotoUrl: undefined,
        })
      )
    })
    expect(toastSuccessMock).toHaveBeenCalledWith('Verificare salvată')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('trimite acțiunea implicită inlocuit fără să marcheze capcana drept scoasă', async () => {
    const user = userEvent.setup()
    verificaCapcanaActionMock.mockResolvedValue({ ok: true })

    render(
      <VerificaCapcanaSheet
        open
        onOpenChange={vi.fn()}
        capcanaMontata={baseCapcana}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Salvează verificarea' }))

    await waitFor(() => {
      expect(verificaCapcanaActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          capcanaMontataId: baseCapcana.id,
          actiune: 'inlocuit',
          pragDepasit: false,
        })
      )
    })
  })
})
