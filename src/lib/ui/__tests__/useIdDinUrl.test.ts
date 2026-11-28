import { describe, expect, it } from 'vitest'

import { adresaCuParametru } from '@/lib/ui/useIdDinUrl'

describe('parametrii din adresă (promptul 35, §4)', () => {
  it('pune, schimbă și scoate un parametru, păstrându-i pe ceilalți', () => {
    expect(adresaCuParametru('/comenzi', '', 'id', 'a1')).toBe('/comenzi?id=a1')
    expect(adresaCuParametru('/comenzi', 'filtru=azi&id=a1', 'id', 'b2')).toBe('/comenzi?filtru=azi&id=b2')
    expect(adresaCuParametru('/comenzi', 'id=a1&vedere=tabel', 'vedere', null)).toBe('/comenzi?id=a1')
    expect(adresaCuParametru('/comenzi', 'id=a1', 'id', null)).toBe('/comenzi')
  })
})
