import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type * as React from 'react'

import { PlanTemplateStartScreen } from '@/components/tratamente/plan-wizard/PlanTemplateStartScreen'
import { PLAN_TEMPLATES, buildTemplateWizardValues } from '@/components/tratamente/plan-wizard/templates'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { selectAppOption } from '@/test/helpers/select-app-option'

const { pushMock, refreshMock, upsertMock, produseMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  upsertMock: vi.fn(),
  produseMock: [
    {
      id: 'prod-kocide',
      tenant_id: null,
      nume_comercial: 'Kocide 2000',
      substanta_activa: 'cupru',
      tip: 'fungicid',
      frac_irac: 'M01',
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
  ],
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}))

vi.mock('@/components/app/AppShell', () => ({
  AppShell: ({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) => (
    <div>
      {header}
      {children}
    </div>
  ),
}))

vi.mock('@/components/app/PageHeader', () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  ),
}))

vi.mock('@/lib/ui/toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const produse = produseMock as ProdusFitosanitar[]

vi.mock('@/app/(dashboard)/tratamente/planuri/actions', () => ({
  listCulturiPentruPlanWizardAction: vi.fn().mockResolvedValue(['zmeur']),
  listProduseFitosanitarePentruPlanWizardAction: vi.fn().mockResolvedValue(produseMock),
  listParcelePentruPlanWizardAction: vi.fn().mockResolvedValue([
    {
      id: 'parcela-maravilla',
      id_parcela: 'P-01',
      nume_parcela: 'Maravilla',
      suprafata_m2: 4000,
      cultura_tip: 'zmeur',
      tip_fruct: 'zmeur',
      active_planuri: [],
    },
  ]),
  upsertPlanTratamentCuLiniiAction: upsertMock,
}))

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <PlanTemplateStartScreen />
    </QueryClientProvider>
  )
}

describe('PlanTemplateStartScreen', () => {
  beforeEach(() => {
    pushMock.mockClear()
    refreshMock.mockClear()
    upsertMock.mockReset()
  })

  it('afișează două template-uri și opțiunea Plan gol', async () => {
    renderScreen()

    expect(screen.getByRole('button', { name: /Zmeur primocane/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Zmeur mixt floricane \+ primocane/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Plan gol/i })).toBeInTheDocument()
  })

  it('afișează preview pentru Zmeur primocane cu 20 intervenții grupate pe fenofază', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByRole('button', { name: /Zmeur primocane/i }))

    expect(screen.getByRole('heading', { name: /Preview Zmeur primocane/i })).toBeInTheDocument()
    expect(screen.getByText('20 intervenții grupate pe fenofază.')).toBeInTheDocument()
    expect(screen.getByText('Primocane în repaus')).toBeInTheDocument()
    expect(screen.getByText('Recoltare pe primocane')).toBeInTheDocument()
  })

  it('apelează upsertPlanTratamentCuLiniiAction cu 20 linii și parcela selectată', async () => {
    const user = userEvent.setup()
    upsertMock.mockResolvedValue({
      id: 'plan-nou',
      tenant_id: 'tenant-1',
      nume: 'Plan Maravilla 2026',
      cultura_tip: 'zmeur',
      descriere: '',
      activ: true,
      arhivat: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      created_by: null,
      updated_by: null,
      linii: [],
      parcele_asociate: [],
    })

    renderScreen()

    await user.click(screen.getByRole('button', { name: /Zmeur primocane/i }))
    expect(screen.getByLabelText('Parcelă')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Nume plan'))
    await user.type(screen.getByLabelText('Nume plan'), 'Plan Maravilla 2026')
    await selectAppOption(user, 'Parcelă', 'parcela-maravilla')
    await user.click(screen.getByRole('button', { name: 'Folosește template' }))

    await waitFor(() => {
      expect(upsertMock).toHaveBeenCalledTimes(1)
    })

    const [planData, liniiData, parceleIds] = upsertMock.mock.calls[0]
    expect(planData).toMatchObject({
      nume: 'Plan Maravilla 2026',
      cultura_tip: 'zmeur',
      activ: true,
      arhivat: false,
    })
    expect(liniiData).toHaveLength(20)
    expect(parceleIds).toEqual(['parcela-maravilla'])
    expect(pushMock).toHaveBeenCalledWith('/tratamente/planuri/plan-nou/editeaza')
  })

  it('Plan gol intră în wizard fără linii precompletate', async () => {
    const user = userEvent.setup()
    renderScreen()

    await user.click(screen.getByRole('button', { name: /Plan gol/i }))

    expect(screen.getAllByRole('heading', { name: 'Informații plan' }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Preview Zmeur primocane')).not.toBeInTheDocument()
  })
})

describe('PLAN_TEMPLATES', () => {
  it('template-ul Zmeur primocane produce 20 linii valide pentru wizard', () => {
    const template = PLAN_TEMPLATES.find((item) => item.id === 'zmeur-primocane')

    expect(template).toBeDefined()
    const values = buildTemplateWizardValues(template!, produse, {
      an: 2026,
      nume: 'Plan Maravilla 2026',
      parcelaId: 'parcela-maravilla',
    })

    expect(values.linii).toHaveLength(20)
    expect(values.linii[0]?.produse[0]).toMatchObject({
      produs_id: 'prod-kocide',
      produs_nume_manual: '',
    })
    expect(values.linii.some((linie) => linie.produse.some((produs) => produs.produs_nume_manual))).toBe(true)
    expect(values.revizuire.parcele_ids).toEqual(['parcela-maravilla'])
  })
})
