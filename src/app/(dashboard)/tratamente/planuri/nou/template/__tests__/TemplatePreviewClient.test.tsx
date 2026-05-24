import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as React from 'react'

import { TemplatePreviewClient } from '../[id]/TemplatePreviewClient'
import type {
  TemplateLiniePreview,
  TemplatePreview,
} from '@/app/(dashboard)/tratamente/planuri/templates/actions'
import type { PlanWizardParcelaOption } from '@/lib/supabase/queries/tratamente'
import { selectAppOption } from '@/test/helpers/select-app-option'

const { pushMock, refreshMock, cloneMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  cloneMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}))

vi.mock('@/app/(dashboard)/tratamente/planuri/templates/actions', () => ({
  clonezaTemplateInPlanNou: cloneMock,
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

const template: TemplatePreview = {
  id: '11111111-1111-4111-8111-111111111111',
  cod: 'zmeur_primocane',
  nume: 'Zmeur primocane',
  cultura_tip: 'zmeur',
  cohort: 'primocane',
  descriere: 'Calendar de tratamente și fertilizare pentru zmeur primocane.',
  durata_sezon_estimata: 'martie - octombrie',
  nr_interventii: 2,
}

const linii: TemplateLiniePreview[] = [
  {
    id: 'linie-1',
    ordine: 1,
    stadiu_trigger: 'umflare_muguri',
    cohort_trigger: 'primocane',
    tip_interventie: 'nutritie',
    metoda_aplicare: 'fertilizare_baza',
    scop: 'Fertilizare bază',
    regula_repetare: 'fara_repetare',
    interval_repetare_zile: null,
    numar_repetari_max: null,
    fereastra_start_offset_zile: null,
    fereastra_end_offset_zile: null,
    produs_sugerat_nume: 'NPK 16-16-16',
    produs_sugerat_substanta: null,
    produs_sugerat_doza_text: '200 kg/ha',
    observatii: null,
  },
  {
    id: 'linie-2',
    ordine: 2,
    stadiu_trigger: 'fruct_verde',
    cohort_trigger: 'primocane',
    tip_interventie: 'monitorizare',
    metoda_aplicare: 'capcana_verificat',
    scop: 'Verificare Drosophila',
    regula_repetare: 'interval',
    interval_repetare_zile: 5,
    numar_repetari_max: null,
    fereastra_start_offset_zile: null,
    fereastra_end_offset_zile: null,
    produs_sugerat_nume: null,
    produs_sugerat_substanta: null,
    produs_sugerat_doza_text: 'la 5 zile',
    observatii: null,
  },
]

const parcele: PlanWizardParcelaOption[] = [
  {
    id: '33333333-3333-4333-8333-333333333333',
    id_parcela: 'P-01',
    nume_parcela: 'Maravilla',
    suprafata_m2: 4000,
    cultura_tip: 'zmeur',
    tip_fruct: 'zmeur',
    active_planuri: [],
  },
]

describe('TemplatePreviewClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cloneMock.mockResolvedValue({ planId: 'plan-template' })
  })

  it('afișează preview-ul grupat pe fenofaze', () => {
    render(<TemplatePreviewClient template={template} linii={linii} parcele={parcele} />)

    expect(screen.getByRole('heading', { name: 'Zmeur primocane' })).toBeInTheDocument()
    expect(screen.getByText(/Pornire lăstari noi/i)).toBeInTheDocument()
    expect(screen.getByText(/Fructe verzi pe primocane/i)).toBeInTheDocument()
    expect(screen.getByText(/Fertilizare bază/i)).toBeInTheDocument()
    expect(screen.getByText(/Verificare Drosophila/i)).toBeInTheDocument()
  })

  it('clonează template-ul cu nume și parcelă selectată', async () => {
    const user = userEvent.setup()
    render(<TemplatePreviewClient template={template} linii={linii} parcele={parcele} />)

    await user.clear(screen.getByLabelText('Numele planului tău'))
    await user.type(screen.getByLabelText('Numele planului tău'), 'Plan Maravilla 2026')
    await selectAppOption(user, 'Asociază cu parcelă (opțional)', '33333333-3333-4333-8333-333333333333')
    await user.click(screen.getByRole('button', { name: 'Folosește acest template' }))

    await waitFor(() => {
      expect(cloneMock).toHaveBeenCalledWith({
        templateId: template.id,
        numePlan: 'Plan Maravilla 2026',
        parcelaId: '33333333-3333-4333-8333-333333333333',
        an: expect.any(Number),
      })
    })
    expect(pushMock).toHaveBeenCalledWith('/tratamente/planuri/plan-template/editor')
  })
})
