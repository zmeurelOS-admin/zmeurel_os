import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { MarkAplicataSheet } from '@/components/tratamente/MarkAplicataSheet'
import type { InterventieProdusV2, ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

function renderSheet(component: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

function makeProdus(id: string, nume: string, substanta = 'substanță'): ProdusFitosanitar {
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
    activ: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_by: null,
  }
}

function makePlanProdus(
  id: string,
  produs: ProdusFitosanitar,
  ordine: number,
  doza: number
): InterventieProdusV2 {
  return {
    id,
    tenant_id: 'tenant-1',
    plan_linie_id: 'linie-1',
    ordine,
    produs_id: produs.id,
    produs_nume_manual: null,
    produs_nume_snapshot: produs.nume_comercial,
    substanta_activa_snapshot: produs.substanta_activa,
    tip_snapshot: produs.tip,
    frac_irac_snapshot: produs.frac_irac,
    phi_zile_snapshot: produs.phi_zile,
    doza_ml_per_hl: doza,
    doza_l_per_ha: null,
    observatii: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    produs,
  }
}

describe('MarkAplicataSheet', () => {
  it('afișează doar stadiile valide pentru grupul biologic curent', async () => {
    renderSheet(
      <MarkAplicataSheet
        defaultCantitateMl={null}
        defaultOperator="ion"
        defaultStadiu="rasad"
        grupBiologic="solanacee"
        meteoSnapshot={null}
        onOpenChange={() => undefined}
        onSubmit={() => undefined}
        open
      />
    )

    const nativeSelect = document.querySelector('select[aria-hidden="true"]') as HTMLSelectElement
    expect(nativeSelect.value).toBe('rasad')
    const optionValues = Array.from(nativeSelect.options).map((option) => option.value)

    expect(optionValues).toContain('transplant')
    expect(optionValues).toContain('legare_fruct')
    expect(optionValues).not.toContain('buton_roz')
  })

  it('afișează label contextual pentru post-recoltare la solanacee nedeterminat', async () => {
    renderSheet(
      <MarkAplicataSheet
        configurareSezon={{
          id: 'cfg-1',
          tenant_id: 't1',
          parcela_id: 'p1',
          an: 2026,
          sistem_conducere: null,
          tip_ciclu_soi: 'nedeterminat',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        }}
        defaultCantitateMl={null}
        defaultOperator="ion"
        defaultStadiu="post_recoltare"
        grupBiologic="solanacee"
        meteoSnapshot={null}
        onOpenChange={() => undefined}
        onSubmit={() => undefined}
        open
      />
    )

    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('Producție în curs')
  })

  it('pornește aplicarea din plan cu produsele planificate și salvează override-ul produselor efective', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const cupru = makeProdus('prod-1', 'Cupru Standard', 'hidroxid de cupru')
    const sulf = makeProdus('prod-2', 'Sulf Rapid', 'sulf')
    const calciu = makeProdus('prod-3', 'Calciu Foliar', 'calciu')

    renderSheet(
      <MarkAplicataSheet
        defaultCantitateMl={500}
        defaultOperator="Ion"
        defaultStadiu="inflorit"
        meteoSnapshot={null}
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
        open
        produseFitosanitare={[cupru, sulf, calciu]}
        produsePlanificate={[
          makePlanProdus('linie-prod-1', cupru, 1, 200),
          makePlanProdus('linie-prod-2', sulf, 2, 300),
        ]}
      />
    )

    expect(screen.getByText('Produse planificate')).toBeInTheDocument()
    expect(screen.getByText('Cupru Standard · Sulf Rapid')).toBeInTheDocument()

    const doseInputs = screen.getAllByLabelText('Doză ml/hl')
    await user.clear(doseInputs[0])
    await user.type(doseInputs[0], '220')

    await user.click(screen.getByRole('button', { name: 'Adaugă produs' }))
    await user.type(screen.getAllByLabelText('Nume manual').at(-1)!, 'Amino manual')
    await user.click(screen.getByRole('button', { name: 'Șterge produsul 2' }))
    await user.click(screen.getByRole('button', { name: 'Marchează aplicarea' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const submitted = onSubmit.mock.calls[0]?.[0]
    expect(submitted.produse).toHaveLength(2)
    expect(submitted.produse[0]).toMatchObject({
      produs_id: 'prod-1',
      doza_ml_per_hl: 220,
      ordine: 1,
    })
    expect(submitted.produse[1]).toMatchObject({
      produs_id: null,
      produs_nume_manual: 'Amino manual',
      ordine: 2,
    })
    expect(submitted.diferenteFataDePlan?.automat).toEqual(
      expect.arrayContaining(['Doză ml/hl diferită la produs #1', 'Produs #2 diferă de plan'])
    )
  }, 15_000)

  it('salvează intervenție manuală cu parcelă, sursă manuală și produse multiple', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    renderSheet(
      <MarkAplicataSheet
        mode="manual"
        defaultCantitateMl={null}
        defaultManualData="2026-04-23T10:30"
        defaultManualParcelaId="00000000-0000-4000-8000-000000000001"
        defaultManualParcelaLabel="Parcela Nord"
        defaultManualStatus="aplicata"
        defaultOperator=""
        defaultStadiu="inflorit"
        meteoSnapshot={null}
        onOpenChange={() => undefined}
        onSubmit={onSubmit}
        open
        produseFitosanitare={[]}
      />
    )

    expect(screen.getByText('Intervenție manuală')).toBeInTheDocument()
    expect(screen.getByText('Manuală')).toBeInTheDocument()
    expect(screen.getByText('Parcela Nord')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Tip intervenție'), 'nutritie')
    await user.type(screen.getByLabelText('Scop'), 'Corecție calciu')
    await user.type(screen.getByLabelText('Nume manual'), 'Calciu manual')
    await user.click(screen.getByRole('button', { name: 'Adaugă produs' }))
    await user.type(screen.getAllByLabelText('Nume manual').at(-1)!, 'Aminoacizi manual')
    await user.click(screen.getByRole('button', { name: 'Salvează intervenția' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const submitted = onSubmit.mock.calls[0]?.[0]
    expect(submitted).toMatchObject({
      manual_parcela_id: '00000000-0000-4000-8000-000000000001',
      manual_status: 'aplicata',
      manual_data: '2026-04-23T10:30',
      tip_interventie: 'nutritie',
      scop: 'Corecție calciu',
      diferenteFataDePlan: null,
    })
    expect(submitted.produse).toHaveLength(2)
    expect(submitted.produse.map((produs: { produs_nume_manual: string }) => produs.produs_nume_manual)).toEqual([
      'Calciu manual',
      'Aminoacizi manual',
    ])
  }, 15_000)
})
