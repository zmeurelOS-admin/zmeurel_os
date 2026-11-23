import { describe, expect, it } from 'vitest'

import { esteFermaNoua, esteNumeImplicit, numePropus } from '@/lib/auth/cont-nou'

describe('contul nou', () => {
  const acum = Date.parse('2026-11-23T10:00:00Z')

  it('numele puse automat', () => {
    expect(esteNumeImplicit('Ferma mea')).toBe(true)
    expect(esteNumeImplicit("Ion Popescu's Farm")).toBe(true)
    expect(esteNumeImplicit('tenant_demo_ab12cd34')).toBe(true)
    expect(esteNumeImplicit('')).toBe(true)
    expect(esteNumeImplicit('Ferma Zmeurel')).toBe(false)
  })

  it('numele propus în câmp', () => {
    expect(numePropus('Ferma mea')).toBe('')
    expect(numePropus('  Livada Bunicii ')).toBe('Livada Bunicii')
  })

  it('ferma tocmai creată, fără localitate', () => {
    expect(esteFermaNoua({ created_at: '2026-11-23T09:58:00Z', localitate: null }, acum)).toBe(true)
    expect(esteFermaNoua({ created_at: '2026-11-23T09:58:00Z', localitate: 'Văratec' }, acum)).toBe(false)
    expect(esteFermaNoua({ created_at: '2026-11-22T09:58:00Z', localitate: null }, acum)).toBe(false)
    expect(esteFermaNoua({ created_at: null, localitate: null }, acum)).toBe(false)
  })
})
