import * as React from 'react'
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
]

function renderStep(initialLinii: PlanWizardLinieDraft[] = []) {
  const TestHost = () => {
    const [linii, setLinii] = React.useState<PlanWizardLinieDraft[]>(initialLinii)

    return (
      <>
        <PlanWizardStepLinii culturaTip="zmeur" linii={linii} produse={produse} onChange={setLinii} />
        <div data-testid="state">{JSON.stringify(linii)}</div>
      </>
    )
  }

  return render(<TestHost />)
}

describe('PlanWizardStepLinii', () => {
  it('permite adăugare, editare, ștergere și reorder pentru linii', async () => {
    const user = userEvent.setup()

    renderStep()

    await user.click(screen.getByRole('button', { name: /adaugă linie tratament/i }))
    await user.selectOptions(screen.getByLabelText('Stadiu fenologic *'), 'buton_verde')
    await user.click(screen.getByRole('button', { name: /cupru standard/i }))
    await user.click(screen.getByRole('button', { name: 'Salvează linia' }))

    expect(screen.getByText('Cupru Standard')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /adaugă linie/i }))
    await user.selectOptions(screen.getByLabelText('Stadiu fenologic *'), 'inflorit')
    await user.click(screen.getByRole('button', { name: /sulf rapid/i }))
    await user.click(screen.getByRole('button', { name: 'Salvează linia' }))

    const cardsBeforeMove = screen.getAllByText(/Cupru Standard|Sulf Rapid/)
    expect(cardsBeforeMove[0]).toHaveTextContent('Cupru Standard')

    await user.click(screen.getByRole('button', { name: 'Mută sus linia 2' }))

    const stateAfterMove = JSON.parse(screen.getByTestId('state').textContent ?? '[]') as Array<{ produs_id: string | null }>
    expect(stateAfterMove[0]?.produs_id).toBe('prod-2')

    await user.click(screen.getByRole('button', { name: 'Editează linia 1' }))
    await user.clear(screen.getByLabelText('Observații'))
    await user.type(screen.getByLabelText('Observații'), 'Aplicare după ploaie')
    await user.click(screen.getByRole('button', { name: 'Salvează linia' }))

    expect(screen.getByText('Aplicare după ploaie')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Șterge linia 1' }))
    await user.click(screen.getByRole('button', { name: 'Confirmă' }))

    expect(screen.queryByText('Sulf Rapid')).not.toBeInTheDocument()
    expect(screen.getByText('Cupru Standard')).toBeInTheDocument()
  }, 15_000)
})
