import { describe, expect, it } from 'vitest'

import type { ParcelaStadiuCanonic } from '@/lib/supabase/queries/parcela-stadii'
// Lăstarii pe cohorte și modul de lucru (fostul „mixt”) au testele în `lastari.test.ts` (promptul 33).
import { resolveStadiuFenologicCurentParcela } from '@/lib/parcele/fenofaza-curenta-parcela'

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

  it('preferă updated_at la reînregistrarea aceluiași stadiu (upsert)', () => {
    const stadii = [
      makeRow({
        id: 'stadiu-legare-fruct',
        stadiu: 'legare_fruct',
        cohort: 'floricane',
        created_at: '2026-05-21T10:00:00Z',
        updated_at: '2026-05-21T10:00:00Z',
      }),
      makeRow({
        id: 'stadiu-inflorit',
        stadiu: 'inflorit',
        cohort: 'floricane',
        created_at: '2026-05-18T08:00:00Z',
        updated_at: '2026-05-22T09:00:00Z',
      }),
    ]

    const current = resolveStadiuFenologicCurentParcela(stadii, 'rubus', 'floricane')
    expect(current?.stadiu).toBe('inflorit')
  })

  // Promptul 33 (întrebarea 14): ultimul după `data_observata`; o notare cu o zi mai veche nu devine stadiul curent,
  // chiar dacă e înregistrată mai târziu. Corecția „înapoi” merge cu ziua de azi (vezi testul următor).
  it('o notare cu o zi mai veche nu devine stadiul curent, chiar dacă e înregistrată mai târziu', () => {
    const stadii = [
      makeRow({
        id: 'stadiu-legare-fruct',
        stadiu: 'legare_fruct',
        cohort: 'floricane',
        data_observata: '2026-05-20',
        created_at: '2026-05-20T08:00:00Z',
        updated_at: '2026-05-20T08:00:00Z',
      }),
      makeRow({
        id: 'stadiu-inflorit-corectie',
        stadiu: 'inflorit',
        cohort: 'floricane',
        data_observata: '2026-05-18',
        created_at: '2026-05-21T09:00:00Z',
        updated_at: '2026-05-21T09:00:00Z',
      }),
    ]

    const current = resolveStadiuFenologicCurentParcela(stadii, 'rubus', 'floricane')
    expect(current?.id).toBe('stadiu-legare-fruct')
    expect(current?.stadiu).toBe('legare_fruct')
  })

  it('„Tăiat” ca ultim rând: lăstarul rămâne fără stadiu', () => {
    const stadii = [
      makeRow({ id: 'a', stadiu: 'post_recoltare', cohort: 'floricane', data_observata: '2026-08-01' }),
      makeRow({ id: 'b', stadiu: 'taiat', cohort: 'floricane', data_observata: '2026-08-10' }),
    ]
    expect(resolveStadiuFenologicCurentParcela(stadii, 'rubus', 'floricane')).toBeNull()
  })

  it('la aceeași data_observata câștigă created_at mai recent, indiferent de ordinea fenologică', () => {
    const stadii = [
      makeRow({
        id: 'stadiu-legare-fruct',
        stadiu: 'legare_fruct',
        cohort: 'floricane',
        data_observata: '2026-05-20',
        created_at: '2026-05-20T08:00:00Z',
        updated_at: '2026-05-20T08:00:00Z',
      }),
      makeRow({
        id: 'stadiu-inflorit',
        stadiu: 'inflorit',
        cohort: 'floricane',
        data_observata: '2026-05-20',
        created_at: '2026-05-20T14:00:00Z',
        updated_at: '2026-05-20T14:00:00Z',
      }),
    ]

    const current = resolveStadiuFenologicCurentParcela(stadii, 'rubus', 'floricane')
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
