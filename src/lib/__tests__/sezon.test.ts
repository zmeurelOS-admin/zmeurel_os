import { describe, expect, it } from 'vitest'

import { inceputSezon, inceputSezonAn, zileRecoltareDinAn } from '@/lib/sezon'

const r = (data: string) => ({ data })

describe('sezonul — o singură regulă', () => {
  it('începe la prima recoltare din anul curent', () => {
    expect(inceputSezon('2026-11-21', [r('2026-06-14'), r('2026-06-02T08:00:00'), r('2025-06-01'), r('2026-07-01')])).toBe(
      '2026-06-02',
    )
  })

  it('fără nicio recoltare anul acesta: de la 1 ianuarie', () => {
    expect(inceputSezon('2026-04-10', [r('2025-06-01'), r('2025-07-15')])).toBe('2026-01-01')
    expect(inceputSezon('2026-04-10', [])).toBe('2026-01-01')
  })

  it('o recoltare trecută în viitor (după azi) nu mută începutul', () => {
    expect(inceputSezon('2026-05-01', [r('2026-06-14')])).toBe('2026-01-01')
  })

  it('sezonul unui an anume (comparația cu anul trecut pe desktop)', () => {
    expect(inceputSezonAn(2025, [r('2025-06-20'), r('2025-06-05'), r('2026-06-01')])).toBe('2025-06-05')
    expect(inceputSezonAn(2024, [r('2025-06-20')])).toBe('2024-01-01')
  })

  it('zilele de recoltare din an, până azi', () => {
    expect(zileRecoltareDinAn([r('2026-06-14'), r('2025-06-01'), r('2026-12-01')], '2026', '2026-11-21')).toEqual(['2026-06-14'])
  })
})
