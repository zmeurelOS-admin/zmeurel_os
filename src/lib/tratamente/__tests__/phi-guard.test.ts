import { buildPhiConflicts, buildPhiGuardResult } from '@/lib/tratamente/phi-guard'

describe('phi-guard', () => {
  it('returnează safe când nu există conflicte', () => {
    const result = buildPhiGuardResult([], '2026-05-20')

    expect(result.safe).toBe(true)
    expect(result.conflicts).toEqual([])
    expect(result.earliestSafeDate).toBeNull()
    expect(result.mesaj).toBe('Recoltarea poate fi efectuată. Nu există aplicări cu PHI activ.')
  })

  it('construiește conflictul cu delay corect pentru o singură aplicare', () => {
    const conflicts = buildPhiConflicts(
      [
        {
          aplicareId: 'a1',
          produsNume: 'Switch 62.5 WG',
          dataAplicata: new Date('2026-05-10T00:00:00.000Z'),
          phiZile: 7,
          phiDeadline: new Date('2026-05-17T00:00:00.000Z'),
        },
      ],
      '2026-05-13'
    )

    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]?.zilelamasepotDelay).toBe(4)
    expect(conflicts[0]?.phiDeadline).toBe('2026-05-17')
  })

  it('returnează earliestSafeDate maximă când există multiple conflicte', () => {
    const conflicts = buildPhiConflicts(
      [
        {
          aplicareId: 'a1',
          produsNume: 'Switch 62.5 WG',
          dataAplicata: new Date('2026-05-10T00:00:00.000Z'),
          phiZile: 7,
          phiDeadline: new Date('2026-05-17T00:00:00.000Z'),
        },
        {
          aplicareId: 'a2',
          produsNume: 'Topas 100 EC',
          dataAplicata: new Date('2026-05-12T00:00:00.000Z'),
          phiZile: 14,
          phiDeadline: new Date('2026-05-26T00:00:00.000Z'),
        },
      ],
      '2026-05-20'
    )

    const result = buildPhiGuardResult(conflicts, '2026-05-20')

    expect(result.safe).toBe(false)
    expect(result.earliestSafeDate).toBe('2026-05-26')
    expect(result.conflicts).toHaveLength(2)
  })

  it('mesajul de conflict include PHI și dată sigură', () => {
    const conflicts = buildPhiConflicts(
      [
        {
          aplicareId: 'a1',
          produsNume: 'Signum',
          dataAplicata: new Date('2026-05-10T00:00:00.000Z'),
          phiZile: 3,
          phiDeadline: new Date('2026-05-13T00:00:00.000Z'),
        },
      ],
      '2026-05-12'
    )

    const result = buildPhiGuardResult(conflicts, '2026-05-12')

    expect(result.mesaj).toContain('PHI')
    expect(result.mesaj).toContain('dată sigură')
    expect(result.mesaj).toContain('Signum')
  })
})

