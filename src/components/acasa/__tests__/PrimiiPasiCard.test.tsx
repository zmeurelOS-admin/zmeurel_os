import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import { PrimiiPasiCard } from '@/components/acasa/PrimiiPasi'
import { pasiPrimii } from '@/lib/dashboard/primii-pasi'

describe('PrimiiPasiCard, fermă reală fără parcele', () => {
  const pasi = pasiPrimii({ numeFerma: 'Ferma de la deal', parcele: [], culegatori: 0, pretPus: false })

  it('arată cei 4 pași, fără nicio cultură scrisă', () => {
    const { container } = render(<PrimiiPasiCard pasi={pasi} onPas={() => undefined} onAscunde={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Primii pași · 1 din 4' })).toBeTruthy()
    expect(screen.getByText('Numele fermei: Ferma de la deal')).toBeTruthy()
    expect(screen.getByText('Adaugă prima parcelă')).toBeTruthy()
    expect(screen.getByText('Adaugă culegătorii')).toBeTruthy()
    expect(screen.getByText('Pune prețul')).toBeTruthy()
    expect(container.textContent ?? '').not.toMatch(/zmeur(?!el)/i)
  })

  it('pasul de preț, apăsat, cere întâi parcela; „Ascunde” ascunde cardul', async () => {
    const onPas = vi.fn()
    const onAscunde = vi.fn()
    render(<PrimiiPasiCard pasi={pasi} onPas={onPas} onAscunde={onAscunde} />)
    await userEvent.click(screen.getByText('Pune prețul'))
    expect(onPas).toHaveBeenCalledWith(expect.objectContaining({ cheie: 'pret', inactiv: true, motivInactiv: 'Întâi adaugă prima parcelă' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ascunde' }))
    expect(onAscunde).toHaveBeenCalled()
  })

  it('după prima parcelă de afine: „Pune prețul la afine”', () => {
    const cuAfine = pasiPrimii({ numeFerma: 'Ferma de la deal', parcele: [{ cultura: 'Afine' }], culegatori: 0, pretPus: false })
    render(<PrimiiPasiCard pasi={cuAfine} onPas={() => undefined} onAscunde={() => undefined} />)
    expect(screen.getByText('Pune prețul la afine')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Primii pași · 2 din 4' })).toBeTruthy()
  })
})
