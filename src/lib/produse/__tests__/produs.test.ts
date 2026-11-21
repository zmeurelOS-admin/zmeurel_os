import { describe, expect, it } from 'vitest'

import {
  CIORNA_GOALA,
  ciornaDinProdus,
  ciornaSchimbata,
  detaliuProdus,
  eroriProdus,
  motivFaraStergere,
  numarDinText,
  payloadProdus,
  pretProdus,
  produseAfisate,
  unitatiDeAles,
} from '@/lib/produse/produs'
import type { Produs } from '@/lib/supabase/queries/produse'

const produs = (over: Partial<Produs>): Produs => ({
  id: 'p',
  tenant_id: 't',
  nume: 'Zmeură proaspătă',
  descriere: null,
  categorie: 'fruct',
  unitate_vanzare: 'casoletă',
  gramaj_per_unitate: 500,
  approximate_weight: null,
  association_category: null,
  pret_unitar: 18,
  moneda: 'RON',
  poza_1_url: 'https://x/1.jpg',
  poza_2_url: null,
  status: 'activ',
  created_at: '',
  updated_at: '',
  ...over,
})

describe('lista de produse', () => {
  it('detaliul rândului', () => {
    expect(detaliuProdus(produs({}))).toBe('Casoletă 500 g · fruct')
    expect(detaliuProdus(produs({ unitate_vanzare: 'kg', gramaj_per_unitate: 1000 }))).toBe('kg · fruct')
    expect(detaliuProdus(produs({ unitate_vanzare: 'buc', gramaj_per_unitate: null, categorie: 'leguma' }))).toBe('Bucată · legumă')
  })

  it('prețul', () => {
    expect(pretProdus(produs({}))).toBe('18 lei')
    expect(pretProdus(produs({ pret_unitar: null }))).toBe('—')
  })

  it('filele și căutarea fără diacritice', () => {
    const lista = [produs({ id: 'a', nume: 'Mure' }), produs({ id: 'b', nume: 'Zmeură' }), produs({ id: 'c', nume: 'Mere', status: 'inactiv' })]
    expect(produseAfisate(lista, 'activ', '').map((p) => p.id)).toEqual(['a', 'b'])
    expect(produseAfisate(lista, 'activ', 'zmeura').map((p) => p.id)).toEqual(['b'])
    expect(produseAfisate(lista, 'inactiv', '').map((p) => p.id)).toEqual(['c'])
  })

  it('unitățile de ales păstrează o valoare veche (cutie, palet)', () => {
    expect(unitatiDeAles('kg')).toEqual(['kg', 'casoletă', 'ladă', 'buc'])
    expect(unitatiDeAles('palet')).toEqual(['kg', 'casoletă', 'ladă', 'buc', 'palet'])
  })
})

describe('formularul', () => {
  it('ciorna din produs și înapoi, fără câmpuri de magazin', () => {
    const ciorna = ciornaDinProdus(produs({ pret_unitar: 18.5 }))
    expect(ciorna).toEqual({ nume: 'Zmeură proaspătă', unitate: 'casoletă', gramaj: '500', pret: '18,5', categorie: 'fruct', activ: true })
    const payload = payloadProdus(ciorna)
    expect(payload).toEqual({
      nume: 'Zmeură proaspătă',
      unitate_vanzare: 'casoletă',
      gramaj_per_unitate: 500,
      pret_unitar: 18.5,
      categorie: 'fruct',
      status: 'activ',
    })
    expect(payload).not.toHaveProperty('poza_1_url')
    expect(payload).not.toHaveProperty('association_category')
  })

  it('la kg gramajul nu se trimite', () => {
    expect(payloadProdus({ ...CIORNA_GOALA, nume: 'Mere', gramaj: '500' }).gramaj_per_unitate).toBeNull()
  })

  it('validarea', () => {
    expect(eroriProdus(CIORNA_GOALA).nume).toBeTruthy()
    expect(eroriProdus({ ...CIORNA_GOALA, nume: 'X', unitate: 'casoletă', gramaj: 'abc' }).gramaj).toBeTruthy()
    expect(eroriProdus({ ...CIORNA_GOALA, nume: 'X', pret: '12,5' })).toEqual({})
    expect(eroriProdus({ ...CIORNA_GOALA, nume: 'X', pret: '12.5.1' }).pret).toBeTruthy()
  })

  it('numere scrise cu virgulă', () => {
    expect(numarDinText(' 18,50 ')).toBe(18.5)
    expect(numarDinText('')).toBeNull()
    expect(numarDinText('-3')).toBeNaN()
  })

  it('schimbat sau nu', () => {
    const a = ciornaDinProdus(produs({}))
    expect(ciornaSchimbata(a, { ...a })).toBe(false)
    expect(ciornaSchimbata(a, { ...a, pret: '18,00' })).toBe(false)
    expect(ciornaSchimbata(a, { ...a, activ: false })).toBe(true)
  })
})

describe('ștergerea', () => {
  it('folosit în comenzi sau vânzări = doar dezactivare', () => {
    expect(motivFaraStergere({ comenzi: 0, vanzari: 0 })).toBeNull()
    expect(motivFaraStergere({ comenzi: 1, vanzari: 0 })).toMatch(/o comandă\. Nu se poate șterge/)
    expect(motivFaraStergere({ comenzi: 3, vanzari: 2 })).toMatch(/3 comenzi și 2 vânzări/)
  })
})
