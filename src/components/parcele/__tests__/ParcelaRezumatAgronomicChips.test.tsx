import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import {
  getCurrentCanonicalStageForCohort,
  ParcelaRezumatAgronomicChips,
} from '@/components/parcele/ParcelaRezumatAgronomicChips'
import type { Parcela } from '@/lib/supabase/queries/parcele'
import { queryKeys } from '@/lib/query-keys'
import type { ParcelaStadiuCanonic } from '@/lib/supabase/queries/parcela-stadii'
import { getLabelPentruGrup } from '@/lib/tratamente/stadii-canonic'

const createParcelaStadiuCanonic = vi.fn()
const getStadiiCanoniceParcela = vi.fn()
const getConfigurareSezonParcela = vi.fn()

vi.mock('@/lib/supabase/queries/parcela-stadii', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/queries/parcela-stadii')>()
  return {
    ...actual,
    createParcelaStadiuCanonic: (...args: unknown[]) => createParcelaStadiuCanonic(...args),
    getStadiiCanoniceParcela: (...args: unknown[]) => getStadiiCanoniceParcela(...args),
    getConfigurareSezonParcela: (...args: unknown[]) => getConfigurareSezonParcela(...args),
  }
})

vi.mock('@/lib/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
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

function makeStageRow(
  overrides: Partial<ParcelaStadiuCanonic> & Pick<ParcelaStadiuCanonic, 'id' | 'stadiu'>
): ParcelaStadiuCanonic {
  return {
    tenant_id: 'tenant-1',
    parcela_id: 'parcela-1',
    an: 2026,
    cohort: null,
    data_observata: '2026-05-01',
    observatii: null,
    sursa: 'manual',
    created_by: null,
    created_at: '2026-05-01T00:00:00Z',
    updated_at: '2026-05-01T00:00:00Z',
    ...overrides,
  }
}

function renderChips(parcela: Parcela = baseParcela) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ParcelaRezumatAgronomicChips parcela={parcela} />
    </QueryClientProvider>
  )
  return { ...view, queryClient }
}

describe('getCurrentCanonicalStageForCohort', () => {
  it('returnează ultima înregistrare validă per cohortă (created_at)', () => {
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
        stadiu: 'fruct_verde',
        cohort: 'primocane',
        data_observata: '2026-04-15',
        observatii: null,
        created_at: '2026-04-15T00:00:00Z',
      },
    ]

    const floricane = getCurrentCanonicalStageForCohort(stages, 'rubus', 'floricane')
    const primocane = getCurrentCanonicalStageForCohort(stages, 'rubus', 'primocane')

    expect(floricane?.stadiu).toBe('inflorit')
    expect(primocane?.stadiu).toBe('fruct_verde')
  })

  it('permite corecția înapoi față de un stadiu fenologic mai avansat', () => {
    const stages: ParcelaStadiuCanonic[] = [
      {
        id: '1',
        parcela_id: 'p1',
        an: 2026,
        stadiu: 'legare_fruct',
        cohort: 'floricane',
        data_observata: '2026-05-20',
        observatii: null,
        created_at: '2026-05-20T08:00:00Z',
      },
      {
        id: '2',
        parcela_id: 'p1',
        an: 2026,
        stadiu: 'inflorit',
        cohort: 'floricane',
        data_observata: '2026-05-18',
        observatii: null,
        created_at: '2026-05-21T09:00:00Z',
      },
    ]

    expect(getCurrentCanonicalStageForCohort(stages, 'rubus', 'floricane')?.stadiu).toBe('inflorit')
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

  it('reafișează stadiul selectat după salvare (setQueryData + refetch)', async () => {
    const user = userEvent.setup()
    const inflorit = makeStageRow({
      id: 'stadiu-inflorit',
      stadiu: 'inflorit',
      created_at: '2026-05-10T08:00:00Z',
      updated_at: '2026-05-10T08:00:00Z',
    })
    const legare = makeStageRow({
      id: 'stadiu-legare',
      stadiu: 'legare_fruct',
      created_at: '2026-05-22T09:00:00Z',
      updated_at: '2026-05-22T09:00:00Z',
    })

    getConfigurareSezonParcela.mockResolvedValue(null)
    getStadiiCanoniceParcela.mockResolvedValue([inflorit])
    createParcelaStadiuCanonic.mockResolvedValue(legare)

    const { queryClient } = renderChips()

    const trigger = await screen.findByRole('combobox')
    const infloritLabel = getLabelPentruGrup('inflorit', 'rubus')
    await waitFor(() => {
      expect(trigger).toHaveTextContent(infloritLabel)
    })

    getStadiiCanoniceParcela.mockResolvedValue([inflorit, legare])

    await user.click(trigger)
    const legareLabel = getLabelPentruGrup('legare_fruct', 'rubus')
    const legareOption = await screen.findByRole('option', { name: new RegExp(legareLabel, 'i') })
    await user.click(legareOption)

    await waitFor(() => {
      expect(createParcelaStadiuCanonic).toHaveBeenCalledWith(
        expect.objectContaining({ stadiu: 'legare_fruct' })
      )
    })

    await waitFor(() => {
      const cached = queryClient.getQueryData<ParcelaStadiuCanonic[]>(
        queryKeys.parcelaCultureStages('parcela-1')
      )
      expect(cached?.some((row) => row.stadiu === 'legare_fruct')).toBe(true)
      expect(screen.getByRole('combobox')).toHaveTextContent(legareLabel)
    })
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
