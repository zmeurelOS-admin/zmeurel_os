import { describe, expect, it } from 'vitest'

import {
  CROP_CODES,
  isValidCropCod,
  normalizeCropCod,
} from '@/lib/crops/crop-codes'

describe('crop-codes', () => {
  it('expune toate cele 42 coduri canonice', () => {
    expect(CROP_CODES).toEqual([
      'alun',
      'agris',
      'afin',
      'ardei',
      'aronia',
      'broccoli',
      'busuioc',
      'cais',
      'cartof',
      'capsun',
      'castravete',
      'catina',
      'ceapa',
      'cires',
      'coacaz',
      'conopida',
      'dovlecel',
      'fasole',
      'goji',
      'gulie',
      'mar',
      'mazare',
      'morcov',
      'mur',
      'nuc',
      'par',
      'patrunjel',
      'piersic',
      'praz',
      'prun',
      'ridiche',
      'rosie',
      'rucola',
      'salata',
      'sfecla',
      'spanac',
      'telina',
      'usturoi',
      'vanata',
      'varza',
      'visin',
      'zmeur',
    ])
  })

  it('validează corect codurile canonice', () => {
    expect(isValidCropCod('zmeur')).toBe(true)
    expect(isValidCropCod('rosie')).toBe(true)
    expect(isValidCropCod('aronia')).toBe(true)
    expect(isValidCropCod('cartof')).toBe(true)
    expect(isValidCropCod('busuioc')).toBe(true)
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
    expect(normalizeCropCod('Aronia')).toBe('aronia')
    expect(normalizeCropCod('Cătină')).toBe('catina')
    expect(normalizeCropCod('Brocoli')).toBe('broccoli')
    expect(normalizeCropCod('Busuioc')).toBe('busuioc')
    expect(normalizeCropCod('Cartofi')).toBe('cartof')
    expect(normalizeCropCod('Conopidă')).toBe('conopida')
    expect(normalizeCropCod('Mazăre')).toBe('mazare')
    expect(normalizeCropCod('Morcovi')).toBe('morcov')
    expect(normalizeCropCod('Pătrunjel')).toBe('patrunjel')
    expect(normalizeCropCod('Rucola')).toBe('rucola')
    expect(normalizeCropCod('Țelină')).toBe('telina')
    expect(normalizeCropCod('Alun')).toBe('alun')
    expect(normalizeCropCod('Usturoi')).toBe('usturoi')
  })

  it('întoarce null pentru valori neclare sau goale', () => {
    expect(normalizeCropCod('rubarba')).toBeNull()
    expect(normalizeCropCod('')).toBeNull()
    expect(normalizeCropCod(null)).toBeNull()
    expect(normalizeCropCod(undefined)).toBeNull()
  })
})
