import {
  calculatePhiDeadline,
  getEarliestSafeRecoltare,
  isAplicareSafeForRecoltare,
} from '@/lib/tratamente/phi-checker'

describe('phi-checker', () => {
  it('calculează corect termenul PHI', () => {
    const deadline = calculatePhiDeadline(new Date('2026-05-10T00:00:00Z'), 7)
    expect(deadline.toISOString()).toBe('2026-05-17T00:00:00.000Z')
  })

  it('detectează conflicte înainte de expirarea PHI', () => {
    const result = isAplicareSafeForRecoltare(
      [
        {
          aplicareId: 'a1',
          produsNume: 'Switch 62.5 WG',
          dataAplicata: new Date('2026-05-10T00:00:00Z'),
          phiZile: 7,
        },
      ],
      new Date('2026-05-15T00:00:00Z')
    )

    expect(result.safe).toBe(false)
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0]?.aplicareId).toBe('a1')
  })

  it('tratează produs fără PHI ca safe', () => {
    const result = isAplicareSafeForRecoltare(
      [
        {
          aplicareId: 'a-fara-phi',
          produsNume: 'Biostimulator fără PHI',
          dataAplicata: new Date('2026-05-10T00:00:00Z'),
          phiZile: null,
        },
      ],
      new Date('2026-05-11T00:00:00Z')
    )

    expect(result.safe).toBe(true)
    expect(result.conflicts).toEqual([])
  })

  it('returnează cea mai devreme recoltare sigură după toate aplicările', () => {
    const earliest = getEarliestSafeRecoltare([
      {
        aplicareId: 'a1',
        produsNume: 'Topas 100 EC',
        dataAplicata: new Date('2026-05-01T00:00:00Z'),
        phiZile: 14,
      },
      {
        aplicareId: 'a2',
        produsNume: 'Mospilan 20 SG',
        dataAplicata: new Date('2026-05-12T00:00:00Z'),
        phiZile: 3,
      },
    ])

    expect(earliest?.toISOString()).toBe('2026-05-15T00:00:00.000Z')
  })

  it('returnează null pentru getEarliestSafeRecoltare cu listă goală', () => {
    expect(getEarliestSafeRecoltare([])).toBeNull()
  })
})
