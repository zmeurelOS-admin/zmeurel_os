import { describe, expect, it } from 'vitest'

import { getCertificateExpiryInfo } from '@/lib/legal-docs/shared'
import { ziuaInRomania, zileCalendaristiceIntre } from '@/lib/utils/bucharest-date'

describe('ziuaInRomania', () => {
  it('după miezul nopții în România e deja ziua nouă, deși în UTC e încă ieri', () => {
    // iarna: 00:30 în România = 22:30 UTC în ziua dinainte
    expect(ziuaInRomania(new Date('2026-11-20T22:30:00Z'))).toBe('2026-11-21')
    // vara: 02:30 în România = 23:30 UTC
    expect(ziuaInRomania(new Date('2026-07-10T23:30:00Z'))).toBe('2026-07-11')
    expect(ziuaInRomania(new Date('2026-07-10T20:59:00Z'))).toBe('2026-07-10')
  })

  it('zile calendaristice între două date', () => {
    expect(zileCalendaristiceIntre('2026-11-21', '2026-12-21')).toBe(30)
    expect(zileCalendaristiceIntre('2026-03-28', '2026-03-30')).toBe(2)
    expect(zileCalendaristiceIntre('2026-11-21', '2026-11-20')).toBe(-1)
  })
})

describe('getCertificateExpiryInfo în ora României', () => {
  it('la 00:30 în România, un certificat expirat ieri e expirat (serverul e pe UTC)', () => {
    const now = new Date('2026-11-20T22:30:00Z') // 21.11, 00:30 în România
    expect(getCertificateExpiryInfo('2026-11-20', now).isExpired).toBe(true)
    expect(getCertificateExpiryInfo('2026-11-21', now)).toMatchObject({ isExpired: false, isExpiringSoon: true })
    expect(getCertificateExpiryInfo('2026-12-21', now).isExpiringSoon).toBe(false)
    expect(getCertificateExpiryInfo('2026-12-20', now).isExpiringSoon).toBe(true)
  })
})
