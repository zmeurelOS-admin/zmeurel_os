import { describe, expect, it } from 'vitest'

import type { ParcelaStadiuCanonic } from '@/lib/supabase/queries/parcela-stadii'
import { resolveStadiuFenologicCurentParcela } from '@/lib/tratamente/fenofaza-curenta-parcela'

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

describe('resolveStadiuFenologicCurentParcela', () => {
  it('ignoră rândurile invalide și alege cel valid cu created_at cel mai recent', () => {
    const stadii = [
      makeRow({
        id: 'stadiu-gol',
        stadiu: '',
        cohort: 'floricane',
        created_at: '2026-05-23T15:00:00Z',
      }),
      makeRow({
        id: 'stadiu-inflorit',
        stadiu: 'inflorit',
        cohort: 'floricane',
        created_at: '2026-05-23T10:00:00Z',
      }),
      makeRow({
        id: 'stadiu-primocane',
        stadiu: 'crestere_lastari',
        cohort: 'primocane',
        created_at: '2026-05-23T16:00:00Z',
      }),
    ]

    const current = resolveStadiuFenologicCurentParcela(stadii, 'rubus', 'floricane')
    expect(current?.id).toBe('stadiu-inflorit')
    expect(current?.stadiu).toBe('inflorit')
  })

  it('permite corecția înapoi: câștigă ultima înregistrare, nu cea fenologic mai avansată', () => {
    const stadii = [
      makeRow({
        id: 'stadiu-legare-fruct',
        stadiu: 'legare_fruct',
        cohort: 'floricane',
        data_observata: '2026-05-20',
        created_at: '2026-05-20T08:00:00Z',
      }),
      makeRow({
        id: 'stadiu-inflorit-corectie',
        stadiu: 'inflorit',
        cohort: 'floricane',
        data_observata: '2026-05-18',
        created_at: '2026-05-21T09:00:00Z',
      }),
    ]

    const current = resolveStadiuFenologicCurentParcela(stadii, 'rubus', 'floricane')
    expect(current?.id).toBe('stadiu-inflorit-corectie')
    expect(current?.stadiu).toBe('inflorit')
  })

  it('ignoră rândurile din altă cohortă', () => {
    const stadii = [
      makeRow({
        id: 'stadiu-primocane',
        stadiu: 'crestere_lastari',
        cohort: 'primocane',
      }),
    ]

    expect(resolveStadiuFenologicCurentParcela(stadii, 'rubus', 'floricane')).toBeNull()
  })
})
