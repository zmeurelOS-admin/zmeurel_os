import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PlanWizard } from '@/components/tratamente/plan-wizard/PlanWizard'
import type { PlanTratamentComplet, ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

const { upsertPlanTratamentCuLiniiActionMock } = vi.hoisted(() => ({
  upsertPlanTratamentCuLiniiActionMock: vi.fn(),
}))

vi.mock('@/app/(dashboard)/tratamente/planuri/actions', () => {
  const produse: ProdusFitosanitar[] = [
    {
      id: 'prod-1',
      tenant_id: null,
      nume_comercial: 'Cupru Standard',
      substanta_activa: 'hidroxid de cupru',
      tip: 'fungicid',
      frac_irac: 'FRAC M01',
      doza_min_ml_per_hl: 150,
      doza_max_ml_per_hl: 250,
      doza_min_l_per_ha: null,
      doza_max_l_per_ha: null,
      phi_zile: 7,
      nr_max_aplicari_per_sezon: 3,
      interval_min_aplicari_zile: 10,
      omologat_culturi: ['zmeur'],
      activ: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      created_by: null,
    },
  ]

  return {
    listCulturiPentruPlanWizardAction: vi.fn().mockResolvedValue(['zmeur']),
    listProduseFitosanitarePentruPlanWizardAction: vi.fn().mockResolvedValue(produse),
    listParcelePentruPlanWizardAction: vi.fn().mockResolvedValue([
      {
        id: 'parcela-1',
        id_parcela: 'P-01',
        nume_parcela: 'Parcelă test',
        suprafata_m2: 2500,
        cultura_tip: 'zmeur',
        tip_fruct: 'zmeur',
        active_planuri: [],
      },
    ]),
    upsertPlanTratamentCuLiniiAction: upsertPlanTratamentCuLiniiActionMock,
  }
})

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const onSave = vi.fn()

  render(
    <QueryClientProvider client={queryClient}>
      <PlanWizard onSave={onSave} onCancel={() => undefined} />
    </QueryClientProvider>
  )

  return { onSave }
}

describe('PlanWizard', () => {
  it('permite navigare între pași și păstrează state-ul până la salvare', async () => {
    const user = userEvent.setup()
    const savedPlan = {
      id: 'plan-1',
      tenant_id: 'tenant-1',
      nume: 'Plan zmeur 2026',
      cultura_tip: 'zmeur',
      descriere: 'Plan test',
      activ: true,
      arhivat: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_by: null,
      linii: [],
      parcele_asociate: [],
    } satisfies PlanTratamentComplet

    upsertPlanTratamentCuLiniiActionMock.mockResolvedValue(savedPlan)

    const { onSave } = renderWizard()

    await user.type(screen.getByLabelText('Denumire plan *'), 'Plan zmeur 2026')
    await user.selectOptions(screen.getByLabelText('Cultura țintă *'), 'zmeur')
    await user.type(screen.getByLabelText('Descriere'), 'Plan test')

    await user.click(screen.getByRole('button', { name: 'Continuă' }))

    expect(screen.getByRole('heading', { name: 'Intervenții planificate', level: 1 })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Adaugă intervenție' }))
    await user.selectOptions(screen.getByLabelText('Fenofază *'), 'buton_verde')
    await user.click(screen.getByRole('button', { name: /Adaugă manual/i }))
    await user.click(screen.getByText('Cupru Standard'))
    await user.click(screen.getByRole('button', { name: 'Salvează intervenția' }))

    expect(screen.getByText('Cupru Standard')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continuă' }))

    expect(screen.getByText('Asociere parcele')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Înapoi' }))
    expect(screen.getByText('Cupru Standard')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Înapoi' }))
    expect(screen.getByLabelText('Denumire plan *')).toHaveValue('Plan zmeur 2026')
    expect(screen.getByLabelText('Descriere')).toHaveValue('Plan test')

    await user.click(screen.getByRole('button', { name: 'Continuă' }))
    await user.click(screen.getByRole('button', { name: 'Continuă' }))
    await user.click(screen.getByRole('button', { name: 'Salvează plan' }))

    await waitFor(() => {
      expect(upsertPlanTratamentCuLiniiActionMock).toHaveBeenCalled()
      expect(onSave).toHaveBeenCalledWith(savedPlan)
    })
  }, 15_000)
})
