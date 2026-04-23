import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { PlanLiniiList } from '@/components/tratamente/PlanLiniiList'
import type { PlanTratamentLinieCuProdus, ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

const routerRefresh = vi.fn()
const reorderLiniiActionMock = vi.fn()
const addLinieActionMock = vi.fn()
const updateLinieActionMock = vi.fn()
const deleteLinieActionMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: routerRefresh,
  }),
}))

vi.mock('@/app/(dashboard)/tratamente/planuri/[planId]/actions', () => ({
  reorderLiniiAction: (...args: unknown[]) => reorderLiniiActionMock(...args),
  addLinieAction: (...args: unknown[]) => addLinieActionMock(...args),
  updateLinieAction: (...args: unknown[]) => updateLinieActionMock(...args),
  deleteLinieAction: (...args: unknown[]) => deleteLinieActionMock(...args),
}))

function makeProdus(): ProdusFitosanitar {
  return {
    id: 'prod-1',
    tenant_id: 'tenant-1',
    nume_comercial: 'Switch',
    substanta_activa: 'Cyprodinil',
    tip: 'fungicid',
    frac_irac: '9+12',
    doza_min_ml_per_hl: null,
    doza_max_ml_per_hl: null,
    doza_min_l_per_ha: null,
    doza_max_l_per_ha: null,
    phi_zile: 7,
    nr_max_aplicari_per_sezon: null,
    interval_min_aplicari_zile: null,
    omologat_culturi: null,
    activ: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
  }
}

function makeLinie(index: number): PlanTratamentLinieCuProdus {
  return {
    id: `linie-${index}`,
    tenant_id: 'tenant-1',
    plan_id: 'plan-1',
    ordine: index,
    stadiu_trigger: 'inflorit',
    cohort_trigger: null,
    produs_id: 'prod-1',
    produs_nume_manual: null,
    doza_ml_per_hl: 500,
    doza_l_per_ha: null,
    observatii: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    produs: makeProdus(),
  }
}

describe('PlanLiniiList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    reorderLiniiActionMock.mockResolvedValue({ ok: true, data: undefined })
    addLinieActionMock.mockResolvedValue({ ok: true, data: { linieId: 'linie-new' } })
    updateLinieActionMock.mockResolvedValue({ ok: true, data: undefined })
    deleteLinieActionMock.mockResolvedValue({ ok: true, data: undefined })
  })

  it('afișează 3 rows', () => {
    render(
      <PlanLiniiList
        culturaTip="zmeur"
        linii={[makeLinie(1), makeLinie(2), makeLinie(3)]}
        planId="plan-1"
        produse={[makeProdus()]}
      />
    )

    expect(screen.getAllByText('Switch')).toHaveLength(3)
  })

  it('reorder local apelează action cu orderedIds nou', async () => {
    const user = userEvent.setup()

    render(
      <PlanLiniiList
        culturaTip="zmeur"
        linii={[makeLinie(1), makeLinie(2), makeLinie(3)]}
        planId="plan-1"
        produse={[makeProdus()]}
      />
    )

    await user.click(screen.getByRole('button', { name: /mută sus linia 2/i }))

    await waitFor(() => {
      expect(reorderLiniiActionMock).toHaveBeenCalledWith('plan-1', ['linie-2', 'linie-1', 'linie-3'])
    })
  })

  it('add intervenție deschide dialogul', async () => {
    const user = userEvent.setup()

    render(
      <PlanLiniiList
        culturaTip="zmeur"
        linii={[makeLinie(1)]}
        planId="plan-1"
        produse={[makeProdus()]}
      />
    )

    await user.click(screen.getByRole('button', { name: /adaugă intervenție/i }))

    expect(screen.getByRole('heading', { name: 'Adaugă intervenție' })).toBeInTheDocument()
  })

  it('afișează empty state la 0 intervenții', () => {
    render(
      <PlanLiniiList
        culturaTip="zmeur"
        linii={[]}
        planId="plan-1"
        produse={[makeProdus()]}
      />
    )

    expect(screen.getByText('Nu există încă intervenții în acest plan.')).toBeInTheDocument()
  })
})
