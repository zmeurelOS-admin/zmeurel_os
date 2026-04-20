import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { AplicareHero } from '@/components/tratamente/AplicareHero'
import type { AplicareTratamentDetaliu } from '@/lib/supabase/queries/tratamente'
import { getLabelRo } from '@/lib/tratamente/stadii-canonic'

function buildAplicare(): AplicareTratamentDetaliu {
  return {
    id: 'a1',
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
    status: 'planificata',
    meteo_snapshot: null,
    stadiu_la_aplicare: 'inflorit',
    cohort_la_aplicare: null,
    observatii: null,
    operator: null,
    created_at: '2026-04-18T08:00:00.000Z',
    updated_at: '2026-04-18T08:00:00.000Z',
    created_by: null,
    updated_by: null,
    produs: {
      id: 'prod1',
      tenant_id: 't1',
      nume_comercial: 'Switch 62.5 WG',
      substanta_activa: 'cyprodinil',
      tip: 'fungicid',
      frac_irac: '9+12',
      phi_zile: 7,
      nr_max_aplicari_per_sezon: 3,
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
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T00:00:00.000Z',
    },
    parcela: {
      id: 'p1',
      id_parcela: 'P1',
      nume_parcela: 'Parcela Nord',
      suprafata_m2: 1000,
    },
  }
}

describe('AplicareHero', () => {
  it('afișează produsul, tipul și FRAC', () => {
    render(<AplicareHero aplicare={buildAplicare()} />)

    expect(screen.getByText('Switch 62.5 WG')).toBeInTheDocument()
    expect(screen.getByText('Fungicid · FRAC 9+12')).toBeInTheDocument()
    expect(screen.getByText(`la ${getLabelRo('inflorit')}`)).toBeInTheDocument()
  })

  it('afișează numele manual când produsul lipsește', () => {
    const aplicare = buildAplicare()
    aplicare.produs = null
    aplicare.produs_nume_manual = 'Produs manual'

    render(<AplicareHero aplicare={aplicare} />)

    expect(screen.getByText('Produs manual')).toBeInTheDocument()
    expect(screen.queryByText(/FRAC/i)).not.toBeInTheDocument()
  })

  it('afișează badge-ul verde și metadatele când aplicarea este efectuată', () => {
    const aplicare = buildAplicare()
    aplicare.status = 'aplicata'
    aplicare.data_aplicata = '2026-04-20T08:30:00.000Z'
    aplicare.operator = 'Ion Popescu'

    render(<AplicareHero aplicare={aplicare} />)

    expect(screen.getAllByText('Aplicată').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Ion Popescu/i)).toBeInTheDocument()
    expect(screen.getByText(/20 apr 2026/i)).toBeInTheDocument()
  })

  it('afișează label contextual pentru post-recoltare la solanacee nedeterminat', () => {
    const aplicare = buildAplicare()
    aplicare.stadiu_la_aplicare = 'post_recoltare'
    if (aplicare.linie) {
      aplicare.linie.stadiu_trigger = 'post_recoltare'
    }

    render(
      <AplicareHero
        aplicare={aplicare}
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
