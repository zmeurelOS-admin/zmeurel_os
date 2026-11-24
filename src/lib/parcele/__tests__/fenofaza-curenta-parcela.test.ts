import { describe, expect, it } from 'vitest'

import type { ParcelaStadiuCanonic } from '@/lib/supabase/queries/parcela-stadii'
import {
  isParcelaRubusMixtFenologie,
  resolveStadiiFenologiceCurenteParcela,
  resolveStadiuFenologicCurentParcela,
} from '@/lib/parcele/fenofaza-curenta-parcela'

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

describe('resolveStadiiFenologiceCurenteParcela', () => {
  it('returnează câte un stadiu per cohortă pe Rubus mixt', () => {
    const stadii = [
      makeRow({
        id: '1',
        stadiu: 'repaus_vegetativ',
        cohort: 'floricane',
        created_at: '2026-03-01T00:00:00Z',
      }),
      makeRow({
        id: '2',
        stadiu: 'inflorit',
        cohort: 'floricane',
        created_at: '2026-05-01T00:00:00Z',
      }),
      makeRow({
        id: '3',
        stadiu: 'fruct_verde',
        cohort: 'primocane',
        created_at: '2026-04-15T00:00:00Z',
      }),
    ]

    const entries = resolveStadiiFenologiceCurenteParcela(stadii, 'rubus', true)
    expect(entries).toHaveLength(2)
    expect(entries[0]?.stage?.stadiu).toBe('inflorit')
    expect(entries[1]?.stage?.stadiu).toBe('fruct_verde')
  })

  it('mono-cohort returnează o singură intrare fără cohort', () => {
    const stadii = [
      makeRow({ id: '1', stadiu: 'buton_verde', cohort: null, created_at: '2026-04-01T00:00:00Z' }),
    ]

    const entries = resolveStadiiFenologiceCurenteParcela(stadii, 'solanacee', false)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.cohort).toBeNull()
    expect(entries[0]?.stage?.stadiu).toBe('buton_verde')
  })
})

describe('isParcelaRubusMixtFenologie', () => {
  it('detectează mixt din configurare sezon', () => {
    expect(
      isParcelaRubusMixtFenologie('rubus', { sistem_conducere: 'mixt_floricane_primocane' }, [])
    ).toBe(true)
  })

  it('detectează mixt din stadii pe cohorte chiar fără configurare', () => {
    expect(
      isParcelaRubusMixtFenologie(
        'rubus',
        null,
        [makeRow({ stadiu: 'inflorit', cohort: 'floricane' })]
      )
    ).toBe(true)
  })
})
