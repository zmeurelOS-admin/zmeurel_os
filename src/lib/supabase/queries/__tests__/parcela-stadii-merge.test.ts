import { describe, expect, it } from 'vitest'

import { mergeParcelaStadiuInList } from '@/lib/supabase/queries/parcela-stadii'
import type { ParcelaStadiuCanonic } from '@/lib/supabase/queries/parcela-stadii'

function row(id: string, stadiu: string, updated_at: string): ParcelaStadiuCanonic {
  return {
    id,
    tenant_id: 'tenant-1',
    parcela_id: 'parcela-1',
    an: 2026,
    stadiu,
    cohort: 'floricane',
    data_observata: '2026-05-20',
    sursa: 'manual',
    observatii: null,
    created_at: '2026-05-01T00:00:00Z',
    updated_at,
    created_by: null,
  }
}

describe('mergeParcelaStadiuInList', () => {
  it('înlocuiește rândul existent la același stadiu/cohortă', () => {
    const existing = row('old', 'inflorit', '2026-05-20T08:00:00Z')
    const saved = row('old', 'inflorit', '2026-05-22T09:00:00Z')

    const merged = mergeParcelaStadiuInList([existing], saved)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.updated_at).toBe('2026-05-22T09:00:00Z')
  })

  it('adaugă rând nou când stadiul nu exista', () => {
    const merged = mergeParcelaStadiuInList([row('1', 'inflorit', '2026-05-20T08:00:00Z')], row('2', 'legare_fruct', '2026-05-21T09:00:00Z'))
    expect(merged).toHaveLength(2)
    expect(merged[0]?.stadiu).toBe('legare_fruct')
  })
})
