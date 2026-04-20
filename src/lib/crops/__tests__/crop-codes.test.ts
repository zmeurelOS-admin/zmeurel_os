import { describe, expect, it } from 'vitest'

import {
  CROP_CODES,
  isValidCropCod,
  normalizeCropCod,
} from '@/lib/crops/crop-codes'

describe('crop-codes', () => {
  it('expune toate cele 22 coduri canonice', () => {
    expect(CROP_CODES).toEqual([
      'agris',
      'afin',
      'ardei',
      'cais',
      'capsun',
      'castravete',
      'cires',
      'coacaz',
      'dovlecel',
      'mar',
      'mur',
      'nuc',
      'par',
      'piersic',
      'prun',
      'ridiche',
      'rosie',
      'salata',
      'spanac',
      'vanata',
      'visin',
      'zmeur',
    ])
  })

  it('validează corect codurile canonice', () => {
    expect(isValidCropCod('zmeur')).toBe(true)
    expect(isValidCropCod('rosie')).toBe(true)
    expect(isValidCropCod('zmeura')).toBe(false)
    expect(isValidCropCod('rubarba')).toBe(false)
  })

  it('normalizează coduri canonice, name-uri și forme legacy', () => {
    expect(normalizeCropCod('zmeur')).toBe('zmeur')
    expect(normalizeCropCod('Zmeura')).toBe('zmeur')
    expect(normalizeCropCod('capsuni')).toBe('capsun')
    expect(normalizeCropCod('Capsuni')).toBe('capsun')
    expect(normalizeCropCod('Rosii')).toBe('rosie')
    expect(normalizeCropCod('ridichi')).toBe('ridiche')
  })

  it('întoarce null pentru valori neclare sau goale', () => {
    expect(normalizeCropCod('rubarba')).toBeNull()
    expect(normalizeCropCod('')).toBeNull()
    expect(normalizeCropCod(null)).toBeNull()
    expect(normalizeCropCod(undefined)).toBeNull()
  })
})
