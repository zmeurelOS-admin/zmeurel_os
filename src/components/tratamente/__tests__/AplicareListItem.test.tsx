import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { AplicareListItem } from '@/components/tratamente/AplicareListItem'
import type { AplicareTratamentDetaliu } from '@/lib/supabase/queries/tratamente'
import { getLabelRo } from '@/lib/tratamente/stadii-canonic'

function buildAplicare(tip: string, status: AplicareTratamentDetaliu['status']): AplicareTratamentDetaliu {
  return {
    id: `a-${tip}-${status}`,
    tenant_id: 't1',
    parcela_id: 'p1',
    cultura_id: null,
    plan_linie_id: 'lin1',
    produs_id: 'prod1',
    produs_nume_manual: null,
    data_planificata: '2026-04-20',
    data_aplicata: null,
    doza_ml_per_hl: 80,
    doza_l_per_ha: null,
    cantitate_totala_ml: null,
    stoc_mutatie_id: null,
    status,
    meteo_snapshot: null,
    stadiu_la_aplicare: 'inflorit',
    cohort_la_aplicare: null,
    observatii: null,
    operator: null,
    created_at: '2026-04-18T08:00:00Z',
    updated_at: '2026-04-18T08:00:00Z',
    created_by: null,
    updated_by: null,
    produs: {
      id: 'prod1',
      tenant_id: 't1',
      nume_comercial: 'Switch 62.5 WG',
      substanta_activa: 'cyprodinil',
      tip,
      frac_irac: '9+12',
      phi_zile: null,
      nr_max_aplicari_per_sezon: null,
      activ: true,
    },
    linie: {
      id: 'lin1',
      tenant_id: 't1',
      plan_id: 'plan1',
      ordine: 1,
      stadiu_trigger: 'inflorit',
      cohort_trigger: null,
      produs_id: 'prod1',
      produs_nume_manual: null,
      doza_ml_per_hl: 80,
      doza_l_per_ha: null,
      observatii: null,
      sursa_linie: 'din_plan',
      motiv_adaugare: null,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    },
    parcela: {
      id: 'p1',
      id_parcela: 'P-1',
      nume_parcela: 'Parcela Nord',
      suprafata_m2: 1000,
    },
  }
}

describe('AplicareListItem', () => {
  it('folosește accent albastru pentru fungicid și afișează badge planificată', () => {
    const { container } = render(<AplicareListItem aplicare={buildAplicare('fungicid', 'planificata')} parcelaId="p1" />)

    const article = container.querySelector('article')
    expect(article).toHaveStyle({ borderLeftColor: '#3B82F6' })
    expect(screen.getByText('Planificată')).toBeInTheDocument()
    expect(screen.getByText(/apr/i)).toBeInTheDocument()
    expect(screen.getByText(`la ${getLabelRo('inflorit')}`)).toBeInTheDocument()
  })

  it('folosește accent portocaliu pentru insecticid și afișează badge aplicată', () => {
    const { container } = render(<AplicareListItem aplicare={buildAplicare('insecticid', 'aplicata')} parcelaId="p1" />)

    const article = container.querySelector('article')
    expect(article).toHaveStyle({ borderLeftColor: '#F97316' })
    expect(screen.getByText('Aplicată')).toBeInTheDocument()
  })

  it('afișează badge omisă cu mapping consistent pentru statusul nou', () => {
    render(<AplicareListItem aplicare={buildAplicare('fungicid', 'omisa')} parcelaId="p1" />)

    expect(screen.getByText('Omisă')).toBeInTheDocument()
  })

  it('afișează label contextual pentru post-recoltare la solanacee nedeterminat', () => {
    const aplicare = buildAplicare('fungicid', 'planificata')
    aplicare.stadiu_la_aplicare = 'post_recoltare'
    if (aplicare.linie) {
      aplicare.linie.stadiu_trigger = 'post_recoltare'
    }

    render(
      <AplicareListItem
        aplicare={aplicare}
        parcelaId="p1"
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
      />,
    )

    expect(screen.getByText('la Producție în curs')).toBeInTheDocument()
  })
})
