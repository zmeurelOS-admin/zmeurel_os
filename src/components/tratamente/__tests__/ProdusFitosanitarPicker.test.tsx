import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ProdusFitosanitarPicker } from '@/components/tratamente/ProdusFitosanitarPicker'
import type { InsertTenantProdus, ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

vi.mock('@/lib/ui/toast', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}))

function makeProdus(
  id: string,
  nume: string,
  substanta: string,
  activ = true
): ProdusFitosanitar {
  return {
    id,
    tenant_id: 'tenant-1',
    nume_comercial: nume,
    substanta_activa: substanta,
    tip: 'fungicid',
    frac_irac: 'FRAC M01',
    doza_min_ml_per_hl: null,
    doza_max_ml_per_hl: null,
    doza_min_l_per_ha: null,
    doza_max_l_per_ha: null,
    phi_zile: 7,
    nr_max_aplicari_per_sezon: null,
    interval_min_aplicari_zile: null,
    omologat_culturi: ['zmeur'],
    activ,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
  }
}

describe('ProdusFitosanitarPicker', () => {
  it('ascunde produsele inactive implicit și le afișează la cerere', async () => {
    const user = userEvent.setup()
    const active = makeProdus('prod-1', 'Cupru Standard', 'hidroxid de cupru')
    const inactive = makeProdus('prod-2', 'Produs Inactiv', 'sulf', false)
    const onChange = vi.fn()

    render(
      <ProdusFitosanitarPicker
        onChange={onChange}
        produse={[inactive, active]}
        value={null}
      />
    )

    await user.click(screen.getByRole('button', { name: /Alege din bibliotecă/i }))

    expect(screen.getByText('Cupru Standard')).toBeInTheDocument()
    expect(screen.queryByText('Produs Inactiv')).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Arată și inactive'))

    expect(screen.getByText('Produs Inactiv')).toBeInTheDocument()

    await user.click(screen.getByText('Produs Inactiv'))
    expect(onChange).toHaveBeenCalledWith(inactive)
  })

  it('creează rapid produs nou și selectează duplicatul existent când numele și substanța coincid', async () => {
    const user = userEvent.setup()
    const existing = makeProdus('prod-1', 'Cupru Standard', 'hidroxid de cupru')
    const created = makeProdus('prod-2', 'Sulf Rapid', 'sulf')
    const onChange = vi.fn()
    const onCreateProduct = vi.fn(async (_data: InsertTenantProdus) => created)

    const { rerender } = render(
      <ProdusFitosanitarPicker
        onChange={onChange}
        onCreateProduct={onCreateProduct}
        produse={[existing]}
        value={null}
      />
    )

    await user.click(screen.getByRole('button', { name: /Alege din bibliotecă/i }))
    await user.click(screen.getByText('Adaugă produs în bibliotecă'))
    await user.type(screen.getByLabelText('Nume comercial *'), 'Sulf Rapid')
    await user.type(screen.getByLabelText('Substanță activă *'), 'sulf')
    await user.click(screen.getByRole('button', { name: 'Salvează în bibliotecă' }))

    await waitFor(() => expect(onCreateProduct).toHaveBeenCalledTimes(1))
    expect(onChange).toHaveBeenLastCalledWith(created)

    onChange.mockClear()
    onCreateProduct.mockClear()
    rerender(
      <ProdusFitosanitarPicker
        onChange={onChange}
        onCreateProduct={onCreateProduct}
        produse={[existing]}
        value={null}
      />
    )

    await user.click(screen.getByRole('button', { name: /Alege din bibliotecă/i }))
    await user.click(screen.getByText('Adaugă produs în bibliotecă'))
    await user.type(screen.getByLabelText('Nume comercial *'), 'Cupru Standard')
    await user.type(screen.getByLabelText('Substanță activă *'), 'hidroxid de cupru')
    await user.click(screen.getByRole('button', { name: 'Salvează în bibliotecă' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(existing))
    expect(onCreateProduct).not.toHaveBeenCalled()
  }, 15_000)
})
