import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ creeazaLucrari: vi.fn(), getLucrari: vi.fn() }))

vi.mock('@/lib/analytics/trackEvent', () => ({ trackEvent: vi.fn() }))
vi.mock('@/lib/schema-features', () => ({ useSchemaFeatures: () => ({ lucrariPlanificate: true }) }))
vi.mock('@/components/lucrari/useCineOptiuni', () => ({ useCineOptiuni: () => ({ optiuni: [], vedeProprietarul: true }) }))
vi.mock('@/lib/supabase/queries/lucrari', () => ({
  creeazaLucrari: mocks.creeazaLucrari,
  getLucrari: mocks.getLucrari,
  modificaLucrare: vi.fn(),
}))

import { LucrareStepForm } from '@/components/lucrari/LucrareStepForm'

function deschide() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <LucrareStepForm open onOpenChange={() => undefined} parcele={[{ id: 'p1', nume_parcela: 'Maravilla 1' }]} todayIso="2026-11-27" />
    </QueryClientProvider>,
  )
}

afterEach(async () => {
  cleanup()
  mocks.creeazaLucrari.mockReset()
  mocks.getLucrari.mockReset()
  await new Promise((resolve) => setTimeout(resolve, 5))
})

describe('LucrareStepForm — „Altele” (promptul 34, §7)', () => {
  it('„Ce ai făcut?” e obligatoriu; textul pleacă în „tip_activitate” cu prefixul', async () => {
    mocks.getLucrari.mockResolvedValue([])
    mocks.creeazaLucrari.mockResolvedValue(undefined)
    const user = userEvent.setup()
    deschide()
    await user.click(screen.getByRole('radio', { name: /Altele/ }))
    await user.click(screen.getByRole('button', { name: 'Continuă' }))
    await user.click(screen.getByRole('button', { name: /Maravilla 1/ }))
    const salveaza = screen.getByRole('button', { name: 'Salvează lucrarea' }) as HTMLButtonElement
    expect(salveaza.disabled).toBe(true)
    await user.type(screen.getByRole('textbox', { name: 'Ce ai făcut?' }), 'Plasă de umbrire: demontat și legat')
    expect(salveaza.disabled).toBe(false)
    await user.click(salveaza)
    await waitFor(() => expect(mocks.creeazaLucrari).toHaveBeenCalledTimes(1))
    expect(mocks.creeazaLucrari.mock.calls[0][0][0]).toMatchObject({ tip_activitate: 'Altele: Plasă de umbrire: demontat și legat', parcela_id: 'p1' })
  })

  it('alegerile rapide vin din textele folosite des și completează pasul 2', async () => {
    mocks.getLucrari.mockResolvedValue([
      { id: 'a', tip_activitate: 'Altele: Plasă de umbrire', created_at: '2026-06-01T10:00:00Z', lot_id: 'L1' },
      { id: 'b', tip_activitate: 'Altele: Plasă de umbrire', created_at: '2026-07-01T10:00:00Z', lot_id: 'L2' },
    ])
    const user = userEvent.setup()
    deschide()
    await user.click(await screen.findByRole('button', { name: 'Plasă de umbrire' }))
    expect((screen.getByRole('textbox', { name: 'Ce ai făcut?' }) as HTMLInputElement).value).toBe('Plasă de umbrire')
  })
})
