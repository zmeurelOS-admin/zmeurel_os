import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AplicareListaClient } from '@/components/tratamente/AplicareListaClient'
import type { AplicareTratamentDetaliu } from '@/lib/supabase/queries/tratamente'

const { deleteAplicareActionMock, refreshMock } = vi.hoisted(() => ({
  deleteAplicareActionMock: vi
    .fn<(aplicareId: string, parcelaId: string) => Promise<{ ok: true }>>()
    .mockResolvedValue({ ok: true }),
  refreshMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

vi.mock('@/app/(dashboard)/parcele/[id]/tratamente/aplicari-actions', () => ({
  deleteAplicareAction: deleteAplicareActionMock,
}))

vi.mock('@/components/tratamente/EditAplicareButton', () => ({
  EditAplicareButton: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}))

function buildAplicare(
  id: string,
  productName: string,
  date: string,
  scope: string
): AplicareTratamentDetaliu {
  return {
    id,
    tenant_id: 'tenant-1',
    parcela_id: '00000000-0000-4000-8000-000000000101',
    cultura_id: null,
    plan_linie_id: null,
    sursa: 'manuala',
    produs_id: null,
    produs_nume_manual: productName,
    data_planificata: null,
    data_aplicata: date,
    doza_ml_per_hl: null,
    doza_l_per_ha: null,
    metoda_aplicare: 'foliar',
    cantitate_totala_ml: null,
    stoc_mutatie_id: null,
    status: 'aplicata',
    tip_interventie: 'nutritie',
    scop: scope,
    stadiu_fenologic_id: null,
    diferente_fata_de_plan: null,
    meteo_snapshot: null,
    stadiu_la_aplicare: null,
    cohort_la_aplicare: null,
    observatii: null,
    operator: null,
    created_at: date,
    updated_at: date,
    created_by: null,
    updated_by: null,
    produs: null,
    produse_aplicare: [
      {
        id: `product-${id}`,
        tenant_id: 'tenant-1',
        aplicare_id: id,
        plan_linie_produs_id: null,
        ordine: 1,
        produs_id: null,
        produs_nume_manual: productName,
        produs_nume_snapshot: productName,
        substanta_activa_snapshot: null,
        tip_snapshot: 'foliar',
        frac_irac_snapshot: null,
        phi_zile_snapshot: null,
        doza_ml_per_hl: null,
        doza_l_per_ha: null,
        cantitate_totala: null,
        unitate_cantitate: null,
        stoc_mutatie_id: null,
        cantitate_text: '250 ml',
        observatii: null,
        created_at: date,
        updated_at: date,
        produs: null,
        plan_linie_produs: null,
      },
    ],
    linie: null,
    parcela: {
      id: '00000000-0000-4000-8000-000000000101',
      id_parcela: 'P-1',
      nume_parcela: 'Maravilla 1',
      suprafata_m2: 1200,
    },
  }
}

describe('AplicareListaClient', () => {
  it('grupează pe dată, expandează inline și confirmă ștergerea rândului selectat', async () => {
    const user = userEvent.setup()
    const first = buildAplicare(
      '00000000-0000-4000-8000-000000000201',
      'Calciu foliar',
      '2026-06-05T08:00:00.000Z',
      'Stimulare fructificare'
    )
    const second = buildAplicare(
      '00000000-0000-4000-8000-000000000202',
      'Amino mix',
      '2026-06-05T10:00:00.000Z',
      'Fertilizare'
    )

    render(
      <AplicareListaClient
        aplicari={[first, second]}
        parcelaId="00000000-0000-4000-8000-000000000101"
      />
    )

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Calciu foliar')).toBeInTheDocument()
    expect(screen.getByText('Amino mix')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Calciu foliar/i }))
    expect(screen.getByText('Stimulare fructificare')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editează' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Șterge' }))
    expect(screen.getByRole('heading', { name: 'Ștergi această aplicare?' })).toBeInTheDocument()
    expect(screen.getByText('Acțiunea nu poate fi anulată. Va fi ștearsă doar aplicarea selectată și produsele asociate ei.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Șterge' }))

    await waitFor(() => expect(deleteAplicareActionMock).toHaveBeenCalledTimes(1))
    expect(deleteAplicareActionMock).toHaveBeenCalledWith(first.id, first.parcela_id)
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })
})
