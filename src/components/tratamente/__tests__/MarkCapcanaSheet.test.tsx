import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MarkCapcanaSheet } from '@/components/tratamente/MarkCapcanaSheet'

const montaCapcanaActionMock = vi.fn()
const toastSuccessMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('@/app/(dashboard)/tratamente/capcane/actions', () => ({
  montaCapcanaAction: (...args: unknown[]) => montaCapcanaActionMock(...args),
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

const singleParcela = [{ id: '11111111-1111-4111-8111-111111111111', nume_parcela: 'Maravilla', suprafata_ha: 0.4 }]
const multipleParcele = [
  { id: '11111111-1111-4111-8111-111111111111', nume_parcela: 'Maravilla', suprafata_ha: 0.4 },
  { id: '22222222-2222-4222-8222-222222222222', nume_parcela: 'Delniwa', suprafata_ha: 0.8 },
]

describe('MarkCapcanaSheet', () => {
  beforeEach(() => {
    montaCapcanaActionMock.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
  })

  it('afișează titlul, toate tipurile de capcană și selectează implicit Drosophila', () => {
    render(
      <MarkCapcanaSheet
        open
        onOpenChange={vi.fn()}
        parcelaId={singleParcela[0].id}
        parcele={singleParcela}
      />
    )

    expect(screen.getByText('Pus capcane')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Drosophila/i })).toBeChecked()
    expect(screen.getByText('Lipicioasă galbenă')).toBeInTheDocument()
    expect(screen.getByText('Lipicioasă albastră')).toBeInTheDocument()
    expect(screen.getByText('Feromonală')).toBeInTheDocument()
    expect(screen.getByText('Altă capcană')).toBeInTheDocument()
  })

  it('afișează badge-ul Recomandat pentru Drosophila la maturitate', () => {
    render(
      <MarkCapcanaSheet
        open
        onOpenChange={vi.fn()}
        parcelaId={singleParcela[0].id}
        parcele={singleParcela}
        fenofazaCurenta="maturitate"
      />
    )

    expect(screen.getByText('Recomandat')).toBeInTheDocument()
  })

  it('afișează helperul de densitate pentru 0.4 ha și 4 bucăți', () => {
    render(
      <MarkCapcanaSheet
        open
        onOpenChange={vi.fn()}
        parcelaId={singleParcela[0].id}
        parcele={singleParcela}
      />
    )

    expect(screen.getByText(/Ai 4 buc pe 0\.4 ha = 10\.0\/ha\./i)).toBeInTheDocument()
    expect(screen.getByText(/^OK$/)).toBeInTheDocument()
  })

  it('apelează montaCapcanaAction cu payload-ul corect la salvare', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const onSuccess = vi.fn()
    montaCapcanaActionMock.mockResolvedValue({ ok: true })

    render(
      <MarkCapcanaSheet
        open
        onOpenChange={onOpenChange}
        parcelaId={singleParcela[0].id}
        parcele={singleParcela}
        onSuccess={onSuccess}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Salvează montarea' }))

    await waitFor(() => {
      expect(montaCapcanaActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          parcelaId: singleParcela[0].id,
          tipCapcana: 'drosophila_otet',
          nrBucati: 4,
          observatii: undefined,
          fotoUrl: undefined,
        })
      )
    })
    expect(toastSuccessMock).toHaveBeenCalledWith('Capcane montate')
    expect(onSuccess).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('validează parcela și numărul de bucăți înainte de salvare', async () => {
    const user = userEvent.setup()
    montaCapcanaActionMock.mockResolvedValue({ ok: true })

    const { rerender } = render(
      <MarkCapcanaSheet open onOpenChange={vi.fn()} parcele={multipleParcele} />
    )

    await user.click(screen.getByRole('button', { name: 'Salvează montarea' }))

    expect(screen.getByText('Alege parcela pe care ai montat capcanele.')).toBeInTheDocument()
    expect(montaCapcanaActionMock).not.toHaveBeenCalled()

    rerender(
      <MarkCapcanaSheet
        open
        onOpenChange={vi.fn()}
        parcelaId={singleParcela[0].id}
        parcele={singleParcela}
      />
    )

    const countInput = screen.getByRole('spinbutton')
    await user.clear(countInput)
    await user.type(countInput, '0')
    await user.click(screen.getByRole('button', { name: 'Salvează montarea' }))

    expect(screen.getByText('Numărul de capcane trebuie să fie mai mare decât 0.')).toBeInTheDocument()
    expect(montaCapcanaActionMock).not.toHaveBeenCalled()
  })
})
