import { describe, expect, it } from 'vitest'

import { normalizePhoneNumber } from '@/lib/utils/normalize-phone'

describe('normalizePhoneNumber', () => {
  it('normalizează formatul național 07xxxxxxxx la +407xxxxxxxx', () => {
    expect(normalizePhoneNumber('0745023593')).toBe('+40745023593')
  })

  it('păstrează formatul internațional +407xxxxxxxx explicit', () => {
    expect(normalizePhoneNumber('+40745023593')).toBe('+40745023593')
  })

  it('normalizează formatul 0040xxxxxxxxx la +407xxxxxxxx', () => {
    expect(normalizePhoneNumber('0040745023593')).toBe('+40745023593')
  })

  it('normalizează formatul 40xxxxxxxxx (fără +) la +407xxxxxxxx', () => {
    expect(normalizePhoneNumber('40745023593')).toBe('+40745023593')
  })

  it('normalizează un subscriber number RO fără niciun prefix la +407xxxxxxxx', () => {
    expect(normalizePhoneNumber('745023593')).toBe('+40745023593')
  })

  it('curăță spații, liniuțe și paranteze indiferent de format', () => {
    expect(normalizePhoneNumber('+40 (745) 023-593')).toBe('+40745023593')
    expect(normalizePhoneNumber('0745 023 593')).toBe('+40745023593')
  })

  it('păstrează numere internaționale non-RO cu propriul cod de țară, fără să forțeze spre RO', () => {
    expect(normalizePhoneNumber('+447454894809')).toBe('+447454894809')
    expect(normalizePhoneNumber('+1 415 555 0132')).toBe('+14155550132')
  })

  it('toate variantele echivalente ale aceluiași număr produc rezultatul identic', () => {
    const variants = ['0745023593', '+40745023593', '0040745023593', '40745023593', '745023593']
    const normalized = variants.map(normalizePhoneNumber)
    expect(new Set(normalized).size).toBe(1)
    expect(normalized[0]).toBe('+40745023593')
  })

  it('nu aruncă eroare și întoarce inputul neschimbat pentru string gol', () => {
    expect(normalizePhoneNumber('')).toBe('')
    expect(normalizePhoneNumber('   ')).toBe('')
  })

  it('uniformizează cu prefix "+" un format necunoscut, fără să inventeze un cod de țară', () => {
    expect(normalizePhoneNumber('12345')).toBe('+12345')
  })
})
