import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  formatStadiuFenologicCurentSummary,
  ParcelaStadiuCurentDisplay,
} from '@/components/parcele/ParcelaStadiuCurentDisplay'
import type { ParcelaStadiuCanonic } from '@/lib/supabase/queries/parcela-stadii'
import { resolveStadiiFenologiceCurenteParcela } from '@/lib/tratamente/fenofaza-curenta-parcela'
import { getLabelPentruGrup } from '@/lib/tratamente/stadii-canonic'

function makeRow(
  overrides: Partial<ParcelaStadiuCanonic> & Pick<ParcelaStadiuCanonic, 'stadiu' | 'cohort'>
): ParcelaStadiuCanonic {
  return {
    id: overrides.id ?? 'stadiu-1',
    tenant_id: 'tenant-1',
    parcela_id: 'parcela-1',
    an: 2026,
    stadiu: overrides.stadiu,
    cohort: overrides.cohort,
    data_observata: overrides.data_observata ?? '2026-05-23',
    sursa: 'manual',
    observatii: null,
    created_at: overrides.created_at ?? '2026-05-23T12:00:00Z',
    updated_at: overrides.updated_at ?? '2026-05-23T12:00:00Z',
    created_by: null,
  }
}

describe('ParcelaStadiuCurentDisplay', () => {
  it('afișează două badge-uri pe dual-cohort (layout mobil compact)', () => {
    const stages = [
      makeRow({ id: '1', stadiu: 'inflorit', cohort: 'floricane', created_at: '2026-05-01T00:00:00Z' }),
      makeRow({ id: '2', stadiu: 'crestere_vegetativa', cohort: 'primocane', created_at: '2026-05-02T00:00:00Z' }),
    ]

    render(
      <div style={{ width: 320 }}>
        <ParcelaStadiuCurentDisplay
          canonicalStages={stages}
          grupBiologic="rubus"
          seasonConfig={{ sistem_conducere: 'mixt_floricane_primocane' } as never}
          variant="badge"
        />
      </div>
    )

    expect(screen.getByTestId('stadiu-curent-dual-badge')).toBeInTheDocument()
    expect(screen.getByText(/Flor:/)).toBeInTheDocument()
    expect(screen.getByText(/Prim:/)).toBeInTheDocument()
  })

  it('formatează rezumatul per cohortă pentru text inline', () => {
    const stages = [
      makeRow({ id: '1', stadiu: 'inflorit', cohort: 'floricane' }),
      makeRow({ id: '2', stadiu: 'crestere_vegetativa', cohort: 'primocane' }),
    ]
    const entries = resolveStadiiFenologiceCurenteParcela(stages, 'rubus', true)
    const summary = formatStadiuFenologicCurentSummary(entries, 'rubus')

    expect(summary).toContain(`Floricane: ${getLabelPentruGrup('inflorit', 'rubus', { cohort: 'floricane' })}`)
    expect(summary).toContain(
      `Primocane: ${getLabelPentruGrup('crestere_vegetativa', 'rubus', { cohort: 'primocane' })}`
    )
  })
})
