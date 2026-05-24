import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { MarkAplicataSheet } from '@/components/tratamente/MarkAplicataSheet'
import type { InterventieProdusV2, ProdusFitosanitar } from '@/lib/supabase/queries/tratamente'

vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

vi.mock('@/components/app/DashboardAuthContext', () => ({
  useDashboardAuth: () => ({
    userId: 'user-1',
    email: 'fermier@example.test',
    isSuperAdmin: false,
    tenantId: 'tenant-1',
  }),
}))

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  }),
}))

const originalHasPointerCapture = HTMLElement.prototype.hasPointerCapture
const originalSetPointerCapture = HTMLElement.prototype.setPointerCapture
const originalReleasePointerCapture = HTMLElement.prototype.releasePointerCapture

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false
  HTMLElement.prototype.setPointerCapture = () => undefined
  HTMLElement.prototype.releasePointerCapture = () => undefined
})

afterAll(() => {
  HTMLElement.prototype.hasPointerCapture = originalHasPointerCapture
  HTMLElement.prototype.setPointerCapture = originalSetPointerCapture
  HTMLElement.prototype.releasePointerCapture = originalReleasePointerCapture
})

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
    cantitate_text: null,
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

    const stadiuCombobox = screen
      .getAllByRole('combobox')
      .find((combobox) => /răsad/i.test(combobox.textContent ?? ''))

    expect(stadiuCombobox).toBeDefined()
    expect(stadiuCombobox).toHaveTextContent('Răsad')

    await userEvent.setup().click(stadiuCombobox!)

    expect(await screen.findByRole('option', { name: 'Transplant / prindere' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Legare fruct' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Boboci florali' })).not.toBeInTheDocument()
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

    const stadiuCombobox = screen
      .getAllByRole('combobox')
      .find((combobox) => /producție în curs/i.test(combobox.textContent ?? ''))

    expect(stadiuCombobox).toBeDefined()
    expect(stadiuCombobox).toHaveTextContent('Producție în curs')
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

    const cantitateInputs = screen.getAllByLabelText('Cantitate aplicată')
    await user.clear(cantitateInputs[0]!)
    await user.type(cantitateInputs[0]!, '220 ml/hl')

    await user.click(screen.getByRole('button', { name: 'Adaugă produs' }))
    await user.type(screen.getAllByLabelText('Nume manual').at(-1)!, 'Amino manual')
    await user.type(screen.getAllByLabelText('Cantitate aplicată').at(-1)!, '150 ml/hl')
    await user.click(screen.getAllByRole('combobox').at(-1)!)
    await user.click(await screen.findByRole('option', { name: 'Îngrășământ / fertilizant' }))
    await user.click(screen.getByRole('button', { name: 'Șterge produsul 2' }))
    await user.click(screen.getByRole('button', { name: 'Marchează aplicarea' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const submitted = onSubmit.mock.calls[0]?.[0]
    expect(submitted.produse).toHaveLength(2)
    expect(submitted.produse[0]).toMatchObject({
      produs_id: 'prod-1',
      doza_ml_per_hl: null,
      cantitate_text: '220 ml/hl',
      ordine: 1,
    })
    expect(submitted.produse[1]).toMatchObject({
      produs_id: null,
      produs_nume_manual: 'Amino manual',
      cantitate_text: '150 ml/hl',
      ordine: 2,
    })
    expect(submitted.diferenteFataDePlan?.automat).toEqual(
      expect.arrayContaining(['Cantitate diferită la produs #1', 'Produs #2 diferă de plan'])
    )
  }, 15_000)

  it('nu afișează cohortă sau stadiu fenologic în mod manual', async () => {
    renderSheet(
      <MarkAplicataSheet
        defaultMetoda="foliar"
        defaultManualParcelaId="parcela-1"
        defaultManualParcelaLabel="Parcela Nord"
        defaultManualStatus="aplicata"
        grupBiologic="rubus"
        isRubusMixt
        manualParcele={[]}
        meteoSnapshot={null}
        mode="manual"
        onOpenChange={() => undefined}
        onSubmit={() => undefined}
        open
        produseFitosanitare={[]}
      />
    )

    expect(screen.queryByRole('combobox', { name: /Cohortă pentru intervenție/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Stadiu la aplicare')).not.toBeInTheDocument()
    expect(screen.queryByText(/Fenofază la aplicare/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Nu există fenofază înregistrată/i)).not.toBeInTheDocument()
  })

  it.todo(
    'salvează intervenție manuală cu parcelă, sursă manuală și produse multiple — UI-ul a trecut la controale custom și branch async cu meteo; testul se rescrie în Sprint 4 odată cu extinderea sheet-ului'
  )
})
