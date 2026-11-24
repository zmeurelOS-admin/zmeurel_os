import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createPierdereStoc: vi.fn() }))

vi.mock('@/lib/analytics/trackEvent', () => ({ trackEvent: vi.fn() }))
vi.mock('@/lib/supabase/queries/ajustari-stoc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/supabase/queries/ajustari-stoc')>()),
  createPierdereStoc: mocks.createPierdereStoc,
}))

import { PierdereStocForm } from '@/components/stocuri/PierdereStocForm'

function deschide(disponibilKg: number) {
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <PierdereStocForm open onOpenChange={() => undefined} disponibilKg={disponibilKg} eticheta="Zmeură cal. I disponibilă" cultura="zmeur" azi="2026-07-20" />
    </QueryClientProvider>,
  )
}

async function scrieKg(user: ReturnType<typeof userEvent.setup>, cifre: string) {
  const tastatura = screen.getByRole('group', { name: 'Tastatură pentru kilograme' })
  for (const cifra of cifre) await user.click(within(tastatura).getByRole('button', { name: cifra }))
}


afterEach(async () => {
  cleanup()
  mocks.createPierdereStoc.mockReset()
  await new Promise((resolve) => setTimeout(resolve, 5))
  window.history.replaceState(null, '')
})

describe('PierdereStocForm (promptul 33)', () => {
  it('stricat, 5 kg: salvează pe cultura filei, fără confirmare', async () => {
    mocks.createPierdereStoc.mockResolvedValue({ delta_kg: -5 })
    const user = userEvent.setup()
    deschide(20)
    await user.click(screen.getByRole('radio', { name: /Stricat/ }))
    await scrieKg(user, '5')
    await user.click(screen.getByRole('button', { name: /Salvează/ }))
    await waitFor(() => expect(mocks.createPierdereStoc).toHaveBeenCalledTimes(1))
    expect(mocks.createPierdereStoc.mock.calls[0][0]).toMatchObject({ motiv: 'stricat', cantitateKg: 5, cultura: 'zmeur', data: '2026-07-20', subZeroConfirmat: false })
    expect(await screen.findByText('Pierdere notată')).toBeTruthy()
  })

  it('peste stoc: întreabă întâi, apoi trimite confirmarea', async () => {
    mocks.createPierdereStoc.mockResolvedValue({ delta_kg: -30 })
    const user = userEvent.setup()
    deschide(12)
    await user.click(screen.getByRole('radio', { name: /Donat/ }))
    await scrieKg(user, '30')
    await user.click(screen.getByRole('button', { name: /Salvează/ }))
    expect(await screen.findByText('Stocul trece sub zero')).toBeTruthy()
    expect(mocks.createPierdereStoc).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Da, notez pierderea' }))
    await waitFor(() => expect(mocks.createPierdereStoc).toHaveBeenCalledTimes(1))
    expect(mocks.createPierdereStoc.mock.calls[0][0]).toMatchObject({ motiv: 'donat', cantitateKg: 30, subZeroConfirmat: true })
  })

  it('„Altul” cere textul înainte de kilograme', async () => {
    const user = userEvent.setup()
    deschide(20)
    await user.click(screen.getByRole('radio', { name: /Altul/ }))
    const continua = screen.getByRole('button', { name: 'Continuă' })
    expect((continua as HTMLButtonElement).disabled).toBe(true)
    await user.type(screen.getByLabelText('Ce s-a întâmplat?'), 'grindină')
    expect((continua as HTMLButtonElement).disabled).toBe(false)
  })
})
