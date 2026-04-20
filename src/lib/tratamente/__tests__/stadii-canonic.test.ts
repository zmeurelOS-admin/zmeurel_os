import { describe, expect, it } from 'vitest'

import {
  PROFILURI_STADII_PER_GRUP,
  STADII_META,
  getGrupBiologicForCropCod,
  getLabelRo,
  getManagementCategory,
  getOrdine,
  getOrdineInGrup,
  getStadiuUrmatorInGrup,
  isCategoryAtLeast,
  isStadiuValidPentruGrup,
  listAllStadiiCanonice,
  listStadiiByCategory,
  listStadiiInOrdine,
  listStadiiPentruGrup,
  normalizeStadiu,
} from '@/lib/tratamente/stadii-canonic'

describe('stadii-canonic', () => {
  it('păstrează profilul implicit Rubus pentru helper-ele legacy', () => {
    expect(listStadiiInOrdine()).toEqual([
      'repaus_vegetativ',
      'umflare_muguri',
      'buton_verde',
      'buton_roz',
      'inflorit',
      'scuturare_petale',
      'fruct_verde',
      'parga',
      'maturitate',
      'post_recoltare',
    ])
  })

  it('expune toate cele 22 de coduri canonice cu meta completă', () => {
    expect(listAllStadiiCanonice()).toHaveLength(22)
    expect(listAllStadiiCanonice()).toEqual([
      'rasad',
      'semanat',
      'repaus_vegetativ',
      'transplant',
      'umflare_muguri',
      'crestere_vegetativa',
      'formare_rozeta',
      'buton_verde',
      'etaj_floral',
      'buton_roz',
      'inflorit',
      'scuturare_petale',
      'legare_fruct',
      'fruct_verde',
      'formare_capatana',
      'bulbificare',
      'umplere_pastaie',
      'ingrosare_radacina',
      'parga',
      'maturitate',
      'bolting',
      'post_recoltare',
    ])
    expect(STADII_META.rasad.management_category).toBe('vegetativ')
    expect(STADII_META.legare_fruct.management_category).toBe('fruct_mic')
    expect(STADII_META.bolting.label_ro).toBe('Înspicuire (bolting)')
  })

  it('returnează label-ul și ordinea fixată pentru stadii existente și noi', () => {
    expect(getLabelRo('inflorit')).toBe('Înflorit')
    expect(getOrdine('inflorit')).toBe(5)
    expect(getLabelRo('rasad')).toBe('Răsad')
    expect(getOrdine('rasad')).toBe(0)
    expect(getLabelRo('etaj_floral')).toBe('Apariție etaj floral')
    expect(getOrdine('bolting')).toBe(10)
  })

  it('returnează categoria semantică corectă pentru toate cele 22 de stadii', () => {
    const expectations = {
      rasad: 'vegetativ',
      semanat: 'vegetativ',
      repaus_vegetativ: 'repaus',
      transplant: 'vegetativ',
      umflare_muguri: 'vegetativ',
      crestere_vegetativa: 'vegetativ',
      formare_rozeta: 'vegetativ',
      buton_verde: 'vegetativ',
      etaj_floral: 'prefloral',
      buton_roz: 'prefloral',
      inflorit: 'inflorit',
      scuturare_petale: 'inflorit',
      legare_fruct: 'fruct_mic',
      fruct_verde: 'fruct_mic',
      formare_capatana: 'fruct_mic',
      bulbificare: 'fruct_mic',
      umplere_pastaie: 'fruct_mic',
      ingrosare_radacina: 'fruct_mic',
      parga: 'coacere',
      maturitate: 'post_recoltare',
      bolting: 'post_recoltare',
      post_recoltare: 'post_recoltare',
    } as const

    for (const [cod, category] of Object.entries(expectations)) {
      expect(getManagementCategory(cod as keyof typeof expectations)).toBe(category)
    }
  })

  it('grupează toate stadiile pe categoria de management', () => {
    expect(listStadiiByCategory('repaus')).toEqual(['repaus_vegetativ'])
    expect(listStadiiByCategory('vegetativ')).toEqual([
      'rasad',
      'semanat',
      'transplant',
      'umflare_muguri',
      'crestere_vegetativa',
      'formare_rozeta',
      'buton_verde',
    ])
    expect(listStadiiByCategory('prefloral')).toEqual(['etaj_floral', 'buton_roz'])
    expect(listStadiiByCategory('inflorit')).toEqual(['inflorit', 'scuturare_petale'])
    expect(listStadiiByCategory('fruct_mic')).toEqual([
      'legare_fruct',
      'fruct_verde',
      'formare_capatana',
      'bulbificare',
      'umplere_pastaie',
      'ingrosare_radacina',
    ])
    expect(listStadiiByCategory('coacere')).toEqual(['parga'])
    expect(listStadiiByCategory('post_recoltare')).toEqual(['maturitate', 'bolting', 'post_recoltare'])
  })

  it('compară corect pragurile de management pentru cazuri limită', () => {
    expect(isCategoryAtLeast('parga', 'fruct_mic')).toBe(true)
    expect(isCategoryAtLeast('buton_verde', 'inflorit')).toBe(false)
    expect(isCategoryAtLeast('scuturare_petale', 'inflorit')).toBe(true)
    expect(isCategoryAtLeast('maturitate', 'post_recoltare')).toBe(true)
    expect(isCategoryAtLeast('rasad', 'vegetativ')).toBe(true)
    expect(isCategoryAtLeast('bolting', 'coacere')).toBe(true)
  })

  it('expune profilurile exacte pentru fiecare grup biologic și fallback Rubus', () => {
    expect(PROFILURI_STADII_PER_GRUP.rubus).toEqual([
      'repaus_vegetativ',
      'umflare_muguri',
      'buton_verde',
      'buton_roz',
      'inflorit',
      'scuturare_petale',
      'fruct_verde',
      'parga',
      'maturitate',
      'post_recoltare',
    ])
    expect(PROFILURI_STADII_PER_GRUP.arbusti_fara_cane).toEqual([
      'repaus_vegetativ',
      'umflare_muguri',
      'buton_verde',
      'inflorit',
      'scuturare_petale',
      'fruct_verde',
      'parga',
      'maturitate',
      'post_recoltare',
    ])
    expect(PROFILURI_STADII_PER_GRUP.pomi_samanoase).toEqual([
      'repaus_vegetativ',
      'umflare_muguri',
      'buton_verde',
      'buton_roz',
      'inflorit',
      'scuturare_petale',
      'legare_fruct',
      'fruct_verde',
      'parga',
      'maturitate',
      'post_recoltare',
    ])
    expect(PROFILURI_STADII_PER_GRUP.pomi_samburoase).toEqual(PROFILURI_STADII_PER_GRUP.pomi_samanoase)
    expect(PROFILURI_STADII_PER_GRUP.nucifere).toEqual([
      'repaus_vegetativ',
      'umflare_muguri',
      'buton_verde',
      'inflorit',
      'legare_fruct',
      'fruct_verde',
      'maturitate',
      'post_recoltare',
    ])
    expect(PROFILURI_STADII_PER_GRUP.solanacee).toEqual([
      'rasad',
      'transplant',
      'crestere_vegetativa',
      'etaj_floral',
      'inflorit',
      'legare_fruct',
      'fruct_verde',
      'parga',
      'maturitate',
      'post_recoltare',
    ])
    expect(PROFILURI_STADII_PER_GRUP.cucurbitacee).toEqual([
      'rasad',
      'transplant',
      'crestere_vegetativa',
      'inflorit',
      'legare_fruct',
      'fruct_verde',
      'maturitate',
      'post_recoltare',
    ])
    expect(PROFILURI_STADII_PER_GRUP.brassicaceae).toEqual([
      'rasad',
      'transplant',
      'crestere_vegetativa',
      'formare_rozeta',
      'formare_capatana',
      'maturitate',
      'post_recoltare',
    ])
    expect(PROFILURI_STADII_PER_GRUP.allium).toEqual([
      'semanat',
      'crestere_vegetativa',
      'bulbificare',
      'parga',
      'maturitate',
      'post_recoltare',
    ])
    expect(PROFILURI_STADII_PER_GRUP.leguminoase).toEqual([
      'semanat',
      'crestere_vegetativa',
      'inflorit',
      'legare_fruct',
      'umplere_pastaie',
      'maturitate',
      'post_recoltare',
    ])
    expect(PROFILURI_STADII_PER_GRUP.radacinoase).toEqual([
      'semanat',
      'crestere_vegetativa',
      'formare_rozeta',
      'ingrosare_radacina',
      'maturitate',
      'post_recoltare',
    ])
    expect(PROFILURI_STADII_PER_GRUP.frunzoase).toEqual([
      'semanat',
      'crestere_vegetativa',
      'maturitate',
      'bolting',
      'post_recoltare',
    ])
    expect(listStadiiPentruGrup(null)).toEqual(PROFILURI_STADII_PER_GRUP.rubus)
    expect(listStadiiPentruGrup(undefined)).toEqual(PROFILURI_STADII_PER_GRUP.rubus)
  })

  it('validează corect stadiile în profil și expune ordinea/următorul stadiu', () => {
    expect(isStadiuValidPentruGrup('rasad', 'solanacee')).toBe(true)
    expect(isStadiuValidPentruGrup('buton_roz', 'arbusti_fara_cane')).toBe(false)
    expect(getOrdineInGrup('rasad', 'solanacee')).toBe(0)
    expect(getOrdineInGrup('buton_roz', 'arbusti_fara_cane')).toBe(-1)
    expect(getStadiuUrmatorInGrup('inflorit', 'solanacee')).toBe('legare_fruct')
    expect(getStadiuUrmatorInGrup('post_recoltare', 'solanacee')).toBeNull()
  })

  it('leagă codurile de culturi canonice de grupurile biologice', () => {
    expect(getGrupBiologicForCropCod('zmeur')).toBe('rubus')
    expect(getGrupBiologicForCropCod('capsun')).toBe('arbusti_fara_cane')
    expect(getGrupBiologicForCropCod('rosie')).toBe('solanacee')
    expect(getGrupBiologicForCropCod('ridiche')).toBe('radacinoase')
  })

  it('normalizează codurile canonice, etichetele RO și aliasurile legacy pentru stadii noi și vechi', () => {
    expect(normalizeStadiu('repaus_vegetativ')).toBe('repaus_vegetativ')
    expect(normalizeStadiu('Repaus vegetativ')).toBe('repaus_vegetativ')
    expect(normalizeStadiu('Inflorit')).toBe('inflorit')
    expect(normalizeStadiu('Pârgă')).toBe('parga')
    expect(normalizeStadiu('Post-recoltare')).toBe('post_recoltare')
    expect(normalizeStadiu('Răsad')).toBe('rasad')
    expect(normalizeStadiu('Semanat / rasarire')).toBe('semanat')
    expect(normalizeStadiu('Transplant / prindere')).toBe('transplant')
    expect(normalizeStadiu('Aparitie etaj floral')).toBe('etaj_floral')
    expect(normalizeStadiu('Formare rozeta')).toBe('formare_rozeta')
    expect(normalizeStadiu('Bulbificare')).toBe('bulbificare')
    expect(normalizeStadiu('Ingrosare radacina')).toBe('ingrosare_radacina')
    expect(normalizeStadiu('Inspicuire')).toBe('bolting')
    expect(normalizeStadiu('cadere_petale')).toBe('scuturare_petale')
    expect(normalizeStadiu('crestere_fruct')).toBe('fruct_verde')
  })

  it('întoarce null pentru valori necunoscute sau goale', () => {
    expect(normalizeStadiu('')).toBeNull()
    expect(normalizeStadiu('necunoscut_total')).toBeNull()
  })
})
