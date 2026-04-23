import * as React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PlanWizardStepLinii } from '@/components/tratamente/plan-wizard/PlanWizardStepLinii'
import type { PlanWizardLinieDraft } from '@/components/tratamente/plan-wizard/types'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

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
  {
    id: 'prod-2',
    tenant_id: 'tenant-1',
    nume_comercial: 'Sulf Rapid',
    substanta_activa: 'sulf',
    tip: 'fungicid',
    frac_irac: 'FRAC M02',
    doza_min_ml_per_hl: 300,
    doza_max_ml_per_hl: 300,
    doza_min_l_per_ha: null,
    doza_max_l_per_ha: null,
    phi_zile: 5,
    nr_max_aplicari_per_sezon: 4,
    interval_min_aplicari_zile: 7,
    omologat_culturi: ['zmeur'],
    activ: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: 'user-1',
  },
  {
    id: 'prod-3',
    tenant_id: 'tenant-1',
    nume_comercial: 'Calciu Foliar',
    substanta_activa: 'calciu',
    tip: 'foliar',
    frac_irac: null,
    doza_min_ml_per_hl: 200,
    doza_max_ml_per_hl: 300,
    doza_min_l_per_ha: null,
    doza_max_l_per_ha: null,
    phi_zile: 0,
    nr_max_aplicari_per_sezon: null,
    interval_min_aplicari_zile: null,
    omologat_culturi: ['zmeur'],
    activ: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: 'user-1',
  },
]

function renderStep(
  initialLinii: PlanWizardLinieDraft[] = [],
  options?: { culturaTip?: string; grupBiologic?: 'rubus' | 'solanacee' }
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const TestHost = () => {
    const [linii, setLinii] = React.useState<PlanWizardLinieDraft[]>(initialLinii)

    return (
      <>
        <PlanWizardStepLinii
          culturaTip={options?.culturaTip ?? 'zmeur'}
          grupBiologic={options?.grupBiologic}
          linii={linii}
          produse={produse}
          onChange={setLinii}
        />
        <div data-testid="state">{JSON.stringify(linii)}</div>
      </>
    )
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <TestHost />
    </QueryClientProvider>
  )
}

describe('PlanWizardStepLinii', () => {
  it('permite adăugare, editare, ștergere și reorder pentru linii', async () => {
    const user = userEvent.setup()

    renderStep()

    await user.click(screen.getAllByRole('button', { name: /adaugă intervenție/i })[0])
    await user.selectOptions(screen.getByLabelText('Fenofază *'), 'buton_verde')
    await user.click(screen.getByRole('button', { name: /Adaugă manual/i }))
    await user.click(screen.getByText('Cupru Standard'))
    await user.click(screen.getByRole('button', { name: 'Salvează intervenția' }))

    expect(screen.getByText('Cupru Standard')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Adaugă intervenție' }))
    await user.selectOptions(screen.getByLabelText('Fenofază *'), 'inflorit')
    await user.click(screen.getByRole('button', { name: /Adaugă manual/i }))
    await user.click(screen.getByText('Sulf Rapid'))
    await user.click(screen.getByRole('button', { name: 'Salvează intervenția' }))

    const cardsBeforeMove = screen.getAllByText(/Cupru Standard|Sulf Rapid/)
    expect(cardsBeforeMove[0]).toHaveTextContent('Cupru Standard')

    await user.click(screen.getByRole('button', { name: 'Mută sus intervenția 2' }))

    const stateAfterMove = JSON.parse(screen.getByTestId('state').textContent ?? '[]') as Array<{ produse: Array<{ produs_id: string | null }> }>
    expect(stateAfterMove[0]?.produse[0]?.produs_id).toBe('prod-2')

    await user.click(screen.getByRole('button', { name: 'Editează intervenția 1' }))
    await user.clear(screen.getByLabelText('Observații intervenție'))
    await user.type(screen.getByLabelText('Observații intervenție'), 'Aplicare după ploaie')
    await user.click(screen.getByRole('button', { name: 'Salvează intervenția' }))

    expect(screen.getByText('Aplicare după ploaie')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Șterge intervenția 1' }))
    await user.click(screen.getByRole('button', { name: 'Confirmă' }))

    expect(screen.queryByText('Sulf Rapid')).not.toBeInTheDocument()
    expect(screen.getByText('Cupru Standard')).toBeInTheDocument()
  }, 15_000)

  it('filtrează selectorul de stadii după grupul biologic al culturii', async () => {
    const user = userEvent.setup()

    renderStep([], { culturaTip: 'rosie', grupBiologic: 'solanacee' })

    await user.click(screen.getAllByRole('button', { name: /adaugă intervenție/i })[0])

    const select = screen.getByLabelText('Fenofază *') as HTMLSelectElement
    const optionValues = Array.from(select.options).map((option) => option.value)

    expect(optionValues).toContain('rasad')
    expect(optionValues).toContain('transplant')
    expect(optionValues).toContain('etaj_floral')
    expect(optionValues).not.toContain('buton_roz')
  })

  it('permite produse multiple pe aceeași intervenție, reordonare și ștergere produs', async () => {
    const user = userEvent.setup()

    renderStep()

    await user.click(screen.getAllByRole('button', { name: /adaugă intervenție/i })[0])
    await user.selectOptions(screen.getByLabelText('Fenofază *'), 'buton_verde')

    await user.click(screen.getByRole('button', { name: /Adaugă manual/i }))
    await user.click(screen.getByText('Cupru Standard'))

    await user.click(screen.getByRole('button', { name: 'Adaugă produs' }))
    await user.click(screen.getAllByRole('button', { name: /Adaugă manual/i }).at(-1)!)
    await user.click(screen.getByText('Sulf Rapid'))

    await user.click(screen.getByRole('button', { name: 'Mută sus produsul 2' }))
    await user.click(screen.getByRole('button', { name: 'Salvează intervenția' }))

    const stateAfterSave = JSON.parse(screen.getByTestId('state').textContent ?? '[]') as Array<{
      produse: Array<{ produs_id: string | null; ordine: number }>
    }>
    expect(stateAfterSave[0]?.produse).toMatchObject([
      { produs_id: 'prod-2', ordine: 1 },
      { produs_id: 'prod-1', ordine: 2 },
    ])
    expect(screen.getByText(/Sulf Rapid · 300 ml\/hl/i)).toBeInTheDocument()
    expect(screen.getByText(/Cupru Standard · 200 ml\/hl/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Editează intervenția 1' }))
    await user.click(screen.getByRole('button', { name: 'Șterge produsul 2' }))
    await user.click(screen.getByRole('button', { name: 'Salvează intervenția' }))

    const stateAfterDelete = JSON.parse(screen.getByTestId('state').textContent ?? '[]') as Array<{
      produse: Array<{ produs_id: string | null; ordine: number }>
    }>
    expect(stateAfterDelete[0]?.produse).toHaveLength(1)
    expect(stateAfterDelete[0]?.produse[0]).toMatchObject({ produs_id: 'prod-2', ordine: 1 })
    expect(screen.queryByText(/Cupru Standard · 200 ml\/hl/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Sulf Rapid · 300 ml\/hl/i)).toBeInTheDocument()
  }, 15_000)

  it('redeschide/renderizează intervențiile V2 cu produse copil existente', () => {
    renderStep([
      {
        id: 'linie-1',
        ordine: 1,
        stadiu_trigger: 'inflorit',
        cohort_trigger: null,
        tip_interventie: 'protectie',
        scop: 'Protecție înflorit',
        regula_repetare: 'interval',
        interval_repetare_zile: 7,
        numar_repetari_max: 2,
        produs_id: 'prod-1',
        produs_nume_manual: '',
        dozaUnitate: 'ml/hl',
        doza: 200,
        observatii: 'Intervenție importată V2',
        produse: [
          {
            id: 'linie-1-produs-1',
            ordine: 1,
            produs_id: 'prod-1',
            produs_nume_manual: '',
            produs_nume_snapshot: 'Cupru Standard',
            substanta_activa_snapshot: 'hidroxid de cupru',
            tip_snapshot: 'fungicid',
            frac_irac_snapshot: 'FRAC M01',
            phi_zile_snapshot: 7,
            doza_ml_per_hl: 200,
            doza_l_per_ha: null,
            observatii: '',
          },
          {
            id: 'linie-1-produs-2',
            ordine: 2,
            produs_id: 'prod-3',
            produs_nume_manual: '',
            produs_nume_snapshot: 'Calciu Foliar',
            substanta_activa_snapshot: 'calciu',
            tip_snapshot: 'foliar',
            frac_irac_snapshot: '',
            phi_zile_snapshot: 0,
            doza_ml_per_hl: 250,
            doza_l_per_ha: null,
            observatii: '',
          },
        ],
      },
    ])

    expect(screen.getByText('Protecție înflorit')).toBeInTheDocument()
    expect(screen.getByText(/Cupru Standard · 200 ml\/hl/i)).toBeInTheDocument()
    expect(screen.getByText(/Calciu Foliar · 250 ml\/hl/i)).toBeInTheDocument()
    expect(screen.getByText('Intervenție importată V2')).toBeInTheDocument()
  })
})
