import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { IntervenieEditorSheet } from '@/components/tratamente/IntervenieEditorSheet'
import type { IntervenieEditorValue } from '@/components/tratamente/IntervenieEditorSheet'
import type { ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'
import { selectAppOption } from '@/test/helpers/select-app-option'

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

const produse: ProdusFitosanitar[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    tenant_id: null,
    nume_comercial: 'Switch 62.5 WG',
    substanta_activa: 'ciprodinil + fludioxonil',
    tip: 'fungicid',
    frac_irac: '9 + 12',
    doza_min_ml_per_hl: null,
    doza_max_ml_per_hl: null,
    doza_min_l_per_ha: 0.6,
    doza_max_l_per_ha: 0.6,
    phi_zile: 7,
    nr_max_aplicari_per_sezon: 2,
    interval_min_aplicari_zile: 10,
    omologat_culturi: ['zmeur'],
    activ: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    tenant_id: null,
    nume_comercial: 'Calbit C',
    substanta_activa: 'calciu',
    tip: 'foliar',
    frac_irac: null,
    doza_min_ml_per_hl: 200,
    doza_max_ml_per_hl: 250,
    doza_min_l_per_ha: null,
    doza_max_l_per_ha: null,
    phi_zile: 0,
    nr_max_aplicari_per_sezon: null,
    interval_min_aplicari_zile: null,
    omologat_culturi: ['zmeur'],
    activ: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
  },
]

const initialValue: IntervenieEditorValue = {
  stadiu_trigger: '',
  cohort_trigger: null,
  metoda_aplicare: 'foliar',
  tip_interventie: 'protectie',
  scop: null,
  regula_repetare: 'fara_repetare',
  interval_repetare_zile: null,
  numar_repetari_max: null,
  produs_id: null,
  produs_nume_manual: null,
  doza_ml_per_hl: null,
  doza_l_per_ha: null,
  observatii: null,
  produse: [
    {
      id: 'draft-1',
      ordine: 1,
      produs_id: null,
      produs_nume_manual: '',
      produs_nume_snapshot: null,
      substanta_activa_snapshot: '',
      tip_snapshot: '',
      frac_irac_snapshot: '',
      phi_zile_snapshot: null,
      doza_ml_per_hl: null,
      doza_l_per_ha: null,
      observatii: '',
    },
  ],
}

describe('IntervenieEditorSheet', () => {
  it('trimite o intervenție cu metodă și produse multiple', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <IntervenieEditorSheet
        culturaTip="zmeur"
        grupBiologic="rubus"
        initialValue={initialValue}
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
        open
        produse={produse}
        title="Adaugă intervenție"
      />
    )

    await selectAppOption(user, 'Fenofază', 'buton_verde')
    await selectAppOption(user, 'Metodă', 'foliar')
    await user.type(screen.getByLabelText('Scop'), 'Botritis preventiv')
    await selectAppOption(user, 'Produs din bibliotecă', '11111111-1111-4111-8111-111111111111')
    await user.click(screen.getByRole('button', { name: 'Adaugă produs' }))
    await selectAppOption(user, screen.getAllByLabelText('Produs din bibliotecă')[1]!, '22222222-2222-4222-8222-222222222222')
    await user.click(screen.getByRole('button', { name: 'Salvează intervenția' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          stadiu_trigger: 'buton_verde',
          metoda_aplicare: 'foliar',
          scop: 'Botritis preventiv',
          produse: expect.arrayContaining([
            expect.objectContaining({ produs_id: '11111111-1111-4111-8111-111111111111' }),
            expect.objectContaining({ produs_id: '22222222-2222-4222-8222-222222222222' }),
          ]),
        })
      )
    })
  }, 15_000)

  it('dezactivează salvarea până este aleasă fenofaza', () => {
    render(
      <IntervenieEditorSheet
        culturaTip="zmeur"
        grupBiologic="rubus"
        initialValue={initialValue}
        onOpenChange={() => undefined}
        onSubmit={() => undefined}
        open
        produse={produse}
        title="Adaugă intervenție"
      />
    )

    expect(screen.getByRole('button', { name: 'Salvează intervenția' })).toBeDisabled()
  })
})
