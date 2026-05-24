import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import {
  getCurrentCanonicalStageForCohort,
  ParcelaRezumatAgronomicChips,
} from '@/components/parcele/ParcelaRezumatAgronomicChips'
import type { Parcela } from '@/lib/supabase/queries/parcele'
import type { ParcelaStadiuCanonic } from '@/lib/supabase/queries/parcela-stadii'

const createParcelaStadiuCanonic = vi.fn()
const getStadiiCanoniceParcela = vi.fn()
const getConfigurareSezonParcela = vi.fn()

vi.mock('@/lib/supabase/queries/parcela-stadii', () => ({
  createParcelaStadiuCanonic: (...args: unknown[]) => createParcelaStadiuCanonic(...args),
  getStadiiCanoniceParcela: (...args: unknown[]) => getStadiiCanoniceParcela(...args),
  getConfigurareSezonParcela: (...args: unknown[]) => getConfigurareSezonParcela(...args),
}))

vi.mock('@/lib/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const baseParcela = {
  id: 'parcela-1',
  tenant_id: 'tenant-1',
  nume_parcela: 'Delniwa',
  cultura: 'zmeur',
  tip_fruct: null,
  tip_unitate: 'camp',
  suprafata_ha: 1,
  localitate: null,
  soi_plantat: 'Maravilla',
  nr_plante: null,
  rol: null,
  apare_in_dashboard: true,
  contribuie_la_productie: true,
  status_operational: 'activ',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as Parcela

function renderChips(parcela: Parcela = baseParcela) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ParcelaRezumatAgronomicChips parcela={parcela} />
    </QueryClientProvider>
  )
}

describe('getCurrentCanonicalStageForCohort', () => {
  it('returnează stadiul cel mai recent per cohortă', () => {
    const stages: ParcelaStadiuCanonic[] = [
      {
        id: '1',
        parcela_id: 'p1',
        an: 2026,
        stadiu: 'repaus_vegetativ',
        cohort: 'floricane',
        data_observata: '2026-03-01',
        observatii: null,
        created_at: '2026-03-01T00:00:00Z',
      },
      {
        id: '2',
        parcela_id: 'p1',
        an: 2026,
        stadiu: 'inflorit',
        cohort: 'floricane',
        data_observata: '2026-05-01',
        observatii: null,
        created_at: '2026-05-01T00:00:00Z',
      },
      {
        id: '3',
        parcela_id: 'p1',
        an: 2026,
        stadiu: 'fruct_mic',
        cohort: 'primocane',
        data_observata: '2026-04-15',
        observatii: null,
        created_at: '2026-04-15T00:00:00Z',
      },
    ]

    const floricane = getCurrentCanonicalStageForCohort(stages, 'rubus', 'floricane')
    const primocane = getCurrentCanonicalStageForCohort(stages, 'rubus', 'primocane')

    expect(floricane?.stadiu).toBe('inflorit')
    expect(primocane?.stadiu).toBe('fruct_mic')
  })
})

describe('ParcelaRezumatAgronomicChips', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getConfigurareSezonParcela.mockResolvedValue({
      sistem_conducere: 'mixt_floricane_primocane',
    })
  })

  it('afișează câte un selector de stadiu per cohortă în mod mixt', async () => {
    getStadiiCanoniceParcela.mockResolvedValue([
      {
        id: '1',
        parcela_id: 'parcela-1',
        an: 2026,
        stadiu: 'inflorit',
        cohort: 'floricane',
        data_observata: '2026-05-01',
        observatii: null,
        created_at: '2026-05-01T00:00:00Z',
      },
    ])
    createParcelaStadiuCanonic.mockResolvedValue({ id: 'new' })

    renderChips()

    expect(await screen.findByText('Fenologie')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('Floricane')).toBeInTheDocument()
      expect(screen.getByText('Primocane')).toBeInTheDocument()
    })
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
  })

  it('salvează stadiul la schimbare în AppSelect', async () => {
    const user = userEvent.setup()
    getConfigurareSezonParcela.mockResolvedValue(null)
    getStadiiCanoniceParcela.mockResolvedValue([])
    createParcelaStadiuCanonic.mockResolvedValue({ id: 'new' })

    renderChips()

    const trigger = await screen.findByRole('combobox')
    await user.click(trigger)
    const options = await screen.findAllByRole('option')
    await user.click(options[0]!)

    await waitFor(() => {
      expect(createParcelaStadiuCanonic).toHaveBeenCalledWith(
        expect.objectContaining({
          parcela_id: 'parcela-1',
          stadiu: expect.any(String),
          data_observata: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        })
      )
    })
  })
})
