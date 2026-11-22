import { describe, expect, it } from 'vitest'

import {
  aplicariRamase,
  calculeazaStoc,
  categorieCheltuiala,
  convertesteInStoc,
  costEstimat,
  costTratamentePerioada,
  dozaUltimaAplicare,
  estePeTerminate,
  faraPreturi,
  formatCantitateStoc,
  iesireDorita,
  iesiriPeLot,
  pretMediu,
  pretPeUnitate,
  rezumatMagazie,
  sincronizeazaIesire,
  textAplicariRamase,
  textIesiri,
  textPretPeUnitate,
  textVerificare,
  unitateDinAplicare,
  verificaMagazie,
  type MiscareStoc,
} from '@/lib/magazie'
import { sumarRaport, type DateRaport, type Perioada } from '@/lib/rapoarte/raport'

describe('conversiile de unități', () => {
  it('ml → l și g → kg împart la 1000', () => {
    expect(convertesteInStoc(150, 'ml', 'l')).toBeCloseTo(0.15)
    expect(convertesteInStoc(60, 'g', 'kg')).toBeCloseTo(0.06)
    expect(convertesteInStoc(1.2, 'kg', 'kg')).toBe(1.2)
    expect(convertesteInStoc(2, 'l', 'l')).toBe(2)
    expect(convertesteInStoc(3, 'buc', 'buc')).toBe(3)
    expect(convertesteInStoc(3, 'nr_bucati', 'buc')).toBe(3)
  })

  it('unitățile incompatibile nu scad nimic', () => {
    expect(convertesteInStoc(5, 'buc', 'l')).toBeNull()
    expect(convertesteInStoc(5, 'ml', 'kg')).toBeNull()
    expect(convertesteInStoc(5, 'g', 'l')).toBeNull()
    expect(convertesteInStoc(5, 'ml_10l', 'l')).toBeNull()
    expect(convertesteInStoc(5, 'kg_parcela', 'kg')).toBeNull()
    expect(convertesteInStoc(5, 'l', 'buc')).toBeNull()
    expect(convertesteInStoc(null, 'l', 'l')).toBeNull()
  })

  it('unitatea propusă din cum s-a aplicat', () => {
    expect(unitateDinAplicare('ml')).toBe('l')
    expect(unitateDinAplicare('g')).toBe('kg')
    expect(unitateDinAplicare('ml_10l')).toBeNull()
  })

  it('formatul cantității', () => {
    expect(formatCantitateStoc(0.8, 'kg')).toBe('0,8 kg')
    expect(formatCantitateStoc(-1.2, 'kg')).toBe('−1,2 kg')
    expect(formatCantitateStoc(5, 'kg', true)).toBe('+5 kg')
    expect(formatCantitateStoc(0.15, 'l')).toBe('0,15 l')
  })
})

describe('ieșirea automată (triggerul)', () => {
  const magazie = { unitate: 'kg' as const, start: '2026-05-20' }
  const facut = { status: 'aplicata', produsId: 'p1', cantitate: 1200, unitate: 'g', zi: '2026-06-12' }

  it('un tratament făcut scade cantitatea convertită', () => {
    expect(iesireDorita(facut, magazie)).toEqual({ cantitate: 1.2, produsId: 'p1', zi: '2026-06-12' })
  })

  it('tratamentele vechi (dinainte de prima intrare) nu scad', () => {
    expect(iesireDorita({ ...facut, zi: '2026-05-19' }, magazie)).toEqual({ cantitate: null, motiv: 'vechi' })
    // Chiar în ziua primei intrări, scade.
    expect(iesireDorita({ ...facut, zi: '2026-05-20' }, magazie).cantitate).toBeCloseTo(1.2)
    // Produs fără nicio intrare sau numărătoare: nu scade.
    expect(iesireDorita(facut, { unitate: 'kg', start: null })).toEqual({ cantitate: null, motiv: 'vechi' })
  })

  it('planificat, fără produs, fără cantitate, neurmărit sau incompatibil: nimic', () => {
    expect(iesireDorita({ ...facut, status: 'planificata' }, magazie)).toEqual({ cantitate: null, motiv: 'nefacut' })
    expect(iesireDorita({ ...facut, produsId: null }, magazie)).toEqual({ cantitate: null, motiv: 'fara_produs' })
    expect(iesireDorita({ ...facut, cantitate: null }, magazie)).toEqual({ cantitate: null, motiv: 'fara_cantitate' })
    expect(iesireDorita({ ...facut, cantitate: 0 }, magazie)).toEqual({ cantitate: null, motiv: 'fara_cantitate' })
    expect(iesireDorita(facut, null)).toEqual({ cantitate: null, motiv: 'neurmarit' })
    expect(iesireDorita({ ...facut, unitate: 'ml' }, magazie)).toEqual({ cantitate: null, motiv: 'incompatibil' })
  })

  it('sincronizarea: făcut → rând nou; planificat → nimic', () => {
    expect(sincronizeazaIesire(null, iesireDorita(facut, magazie))).toEqual({ tip: 'insereaza', rand: { produsId: 'p1', cantitate: -1.2, zi: '2026-06-12' } })
    expect(sincronizeazaIesire(null, iesireDorita({ ...facut, status: 'planificata' }, magazie))).toEqual({ tip: 'nimic' })
  })

  it('sincronizarea: planificat → făcut, apoi înapoi planificat / anulat → rândul se șterge', () => {
    const existent = { produsId: 'p1', cantitate: -1.2, zi: '2026-06-12' }
    expect(sincronizeazaIesire(existent, iesireDorita({ ...facut, status: 'planificata' }, magazie))).toEqual({ tip: 'sterge' })
    expect(sincronizeazaIesire(existent, iesireDorita({ ...facut, status: 'anulata' }, magazie))).toEqual({ tip: 'sterge' })
  })

  it('sincronizarea: editat (altă cantitate, altă zi, alt produs) → același rând, actualizat', () => {
    const existent = { produsId: 'p1', cantitate: -1.2, zi: '2026-06-12' }
    expect(sincronizeazaIesire(existent, iesireDorita({ ...facut, cantitate: 2000 }, magazie))).toEqual({
      tip: 'actualizeaza',
      rand: { produsId: 'p1', cantitate: -2, zi: '2026-06-12' },
    })
    expect(sincronizeazaIesire(existent, iesireDorita({ ...facut, produsId: 'p2' }, magazie))).toEqual({
      tip: 'actualizeaza',
      rand: { produsId: 'p2', cantitate: -1.2, zi: '2026-06-12' },
    })
    expect(sincronizeazaIesire(existent, iesireDorita(facut, magazie))).toEqual({ tip: 'nimic' })
  })

  it('sincronizarea: produsul scos (cantitate ștearsă) sau mutat înainte de magazie → rândul se șterge', () => {
    const existent = { produsId: 'p1', cantitate: -1.2, zi: '2026-06-12' }
    expect(sincronizeazaIesire(existent, iesireDorita({ ...facut, cantitate: null }, magazie))).toEqual({ tip: 'sterge' })
    expect(sincronizeazaIesire(existent, iesireDorita({ ...facut, zi: '2026-05-01' }, magazie))).toEqual({ tip: 'sterge' })
  })
})

const m = (partial: Partial<MiscareStoc> & Pick<MiscareStoc, 'tip' | 'cantitate'>): MiscareStoc => ({
  produs_id: 'p1',
  data: '2026-06-01',
  ...partial,
})

describe('stocul, „ajunge pentru N” și „pe terminate”', () => {
  const miscari: MiscareStoc[] = [
    m({ tip: 'corectie', cantitate: -2, data: '2026-05-01' }),
    m({ tip: 'intrare', cantitate: 5, data: '2026-05-20', pret_total_lei: 82.4 }),
    m({ tip: 'intrare', cantitate: 3, data: '2026-05-25', pret_total_lei: 60 }),
    // Lotul de pe 12 iunie: 2 parcele.
    m({ tip: 'iesire_tratament', cantitate: -0.7, data: '2026-06-12', grup: 'lot-b', created_at: '2026-06-12T08:00:00Z' }),
    m({ tip: 'iesire_tratament', cantitate: -0.5, data: '2026-06-12', grup: 'lot-b', created_at: '2026-06-12T08:00:00Z' }),
    m({ tip: 'iesire_tratament', cantitate: -1, data: '2026-06-02', grup: 'lot-a', created_at: '2026-06-02T08:00:00Z' }),
  ]

  it('doza ultimei aplicări e suma pe lot', () => {
    expect(dozaUltimaAplicare(miscari)).toBeCloseTo(1.2)
    expect(dozaUltimaAplicare([m({ tip: 'intrare', cantitate: 5 })])).toBeNull()
  })

  it('ajunge pentru N aplicări', () => {
    expect(aplicariRamase(3.6, 1.2)).toBeCloseTo(3)
    expect(aplicariRamase(-1, 1.2)).toBe(0)
    expect(aplicariRamase(3, null)).toBeNull()
    expect(textAplicariRamase(0.67)).toBe('ajunge pentru ~1 aplicare')
    expect(textAplicariRamase(9.2)).toBe('ajunge pentru ~9 aplicări')
    expect(textAplicariRamase(0.2)).toBe('nu mai ajunge pentru o aplicare')
    expect(textAplicariRamase(null)).toBeNull()
  })

  it('pe terminate: sub prag; fără prag, sub ultima doză; la zero sau negativ mereu', () => {
    expect(estePeTerminate(0.8, 2, 1.2)).toBe(true)
    expect(estePeTerminate(3, 2, 5)).toBe(false) // pragul are întâietate față de doză
    expect(estePeTerminate(0.8, null, 1.2)).toBe(true)
    expect(estePeTerminate(1.5, null, 1.2)).toBe(false)
    expect(estePeTerminate(5, null, null)).toBe(false)
    expect(estePeTerminate(0, null, null)).toBe(true)
    expect(estePeTerminate(-0.4, 2, null)).toBe(true)
  })

  it('prețul mediu ponderat, doar din intrările cu preț', () => {
    expect(pretMediu(miscari)).toBeCloseTo((82.4 + 60) / 8)
    expect(pretMediu([m({ tip: 'intrare', cantitate: 5 }), m({ tip: 'corectie', cantitate: 2 })])).toBeNull()
    // O intrare fără preț nu strică media.
    expect(pretMediu([m({ tip: 'intrare', cantitate: 10, pret_total_lei: 100 }), m({ tip: 'intrare', cantitate: 10 })])).toBe(10)
  })

  it('stocul pe produs, pentru proprietar', () => {
    const [rand] = calculeazaStoc({
      produse: [{ produs_id: 'p1', nume: 'Kristalon Galben', tip: 'ingrasamant', unitate: 'kg', prag: 2 }],
      miscari,
      esteProprietar: true,
    })
    expect(rand.stoc).toBeCloseTo(3.8)
    expect(rand.doza_ultima).toBeCloseTo(1.2)
    expect(rand.aplicari_ramase).toBeCloseTo(3.8 / 1.2)
    expect(rand.pe_terminate).toBe(false)
    expect(rand.pret_mediu).toBeCloseTo(17.8)
    expect(rand.valoare).toBeCloseTo(3.8 * 17.8)
    expect(rand.ultima_miscare).toBe('2026-06-12')
  })

  it('prețurile sunt ascunse operatorului', () => {
    const [rand] = calculeazaStoc({
      produse: [{ produs_id: 'p1', nume: 'Kristalon', tip: 'ingrasamant', unitate: 'kg', prag: null }],
      miscari,
      esteProprietar: false,
    })
    expect(rand.stoc).toBeCloseTo(3.8)
    expect(rand.pret_mediu).toBeNull()
    expect(rand.valoare).toBeNull()
    expect(faraPreturi({ stoc: 1, pret_mediu: 10, valoare: 10 }, false)).toEqual({ stoc: 1, pret_mediu: null, valoare: null })
    expect(faraPreturi({ stoc: 1, pret_mediu: 10, valoare: 10 }, true)).toEqual({ stoc: 1, pret_mediu: 10, valoare: 10 })
  })

  it('rezumatul din Tratamente', () => {
    expect(rezumatMagazie([{ pe_terminate: true }, { pe_terminate: false }, { pe_terminate: true }]).text).toBe('3 produse · 2 pe terminate')
    expect(rezumatMagazie([{ pe_terminate: false }]).text).toBe('1 produs')
  })
})

describe('formularul de tratament', () => {
  const stoc = [
    { produs_id: 'k', unitate: 'kg' as const, stoc: 0.8, pret_mediu: 16.48, start: '2026-05-01' },
    { produs_id: 'a', unitate: 'kg' as const, stoc: 18, pret_mediu: 4, start: '2026-05-01' },
    { produs_id: 'b', unitate: 'l' as const, stoc: 0.4, pret_mediu: null, start: '2026-05-01' },
  ]

  it('„rămân Y” și „lipsesc Z”, cu costul', () => {
    const verificari = verificaMagazie({
      produse: [
        { produsId: 'k', nume: 'Kristalon', cantitate: 1.2, unitate: 'kg' },
        { produsId: 'a', nume: 'Azotat', cantitate: 2000, unitate: 'g' },
        { produsId: null, nume: 'Scris de mână', cantitate: 1, unitate: 'kg' },
        { produsId: 'b', nume: 'Borofol', cantitate: 2, unitate: 'buc' },
      ],
      stoc,
      facut: true,
      zi: '2026-06-12',
    })
    expect(verificari[0]).toMatchObject({ tip: 'lipsa', lipsesc: expect.closeTo(0.4, 5) })
    expect(textVerificare(verificari[0])).toBe('în magazie 0,8 kg · lipsesc 0,4')
    expect(verificari[1]).toMatchObject({ tip: 'ajunge', ramane: 16 })
    expect(textVerificare(verificari[1])).toBe('în magazie 18 kg · rămân 16')
    expect(verificari[2]).toEqual({ tip: 'neurmarit', nume: 'Scris de mână' })
    expect(verificari[3]).toMatchObject({ tip: 'incompatibil' })
    expect(costEstimat(verificari)).toBeCloseTo(1.2 * 16.48 + 2 * 4)
  })

  it('planificat nu scade; o zi dinainte de magazie nu scade', () => {
    const produse = [{ produsId: 'a', nume: 'Azotat', cantitate: 2, unitate: 'kg' }]
    expect(verificaMagazie({ produse, stoc, facut: false, zi: '2026-06-12' })[0].tip).toBe('nu_scade')
    expect(verificaMagazie({ produse, stoc, facut: true, zi: '2026-04-01' })[0].tip).toBe('nu_scade')
    // Operatorul (fără preț) nu primește cost.
    expect(costEstimat(verificaMagazie({ produse, stoc: stoc.map((r) => ({ ...r, pret_mediu: null })), facut: true, zi: '2026-06-12' }))).toBeNull()
  })

  it('lista de aplicări: „−1,2 kg din magazie”, adunat pe lot', () => {
    const iesiri = [
      { aplicare_id: 'x1', produs_id: 'k', cantitate: 0.7, unitate: 'kg' },
      { aplicare_id: 'x2', produs_id: 'k', cantitate: 0.5, unitate: 'kg' },
      { aplicare_id: 'x2', produs_id: 'b', cantitate: 0.15, unitate: 'l' },
      { aplicare_id: 'alt', produs_id: 'k', cantitate: 9, unitate: 'kg' },
    ]
    const lot = iesiriPeLot(['x1', 'x2'], iesiri)
    expect(textIesiri(lot)).toBe('−1,2 kg și −0,15 l din magazie')
    expect(textIesiri([])).toBeNull()
  })
})

describe('banii: prețul pe unitate, categoria, Rapoartele', () => {
  it('prețul pe unitate la „Am cumpărat”', () => {
    expect(pretPeUnitate(412, 25)).toBeCloseTo(16.48)
    expect(textPretPeUnitate(16.48, 'kg')).toBe('16,48 lei/kg')
    expect(pretPeUnitate(null, 25)).toBeNull()
    expect(pretPeUnitate(412, 0)).toBeNull()
  })

  it('categoria cheltuielii', () => {
    expect(categorieCheltuiala('ingrasamant')).toBe('Îngrășăminte')
    expect(categorieCheltuiala('fungicid')).toBe('Tratamente')
    expect(categorieCheltuiala(null)).toBe('Tratamente')
  })

  it('linia „Tratamente: X lei în sezon” = preț mediu × cantitățile scăzute în perioadă', () => {
    const miscari: MiscareStoc[] = [
      m({ tip: 'intrare', cantitate: 25, pret_total_lei: 412, data: '2026-05-20' }),
      m({ tip: 'iesire_tratament', cantitate: -1.2, data: '2026-06-12' }),
      m({ tip: 'iesire_tratament', cantitate: -1, data: '2025-06-12' }), // alt sezon
      m({ produs_id: 'fara', tip: 'iesire_tratament', cantitate: -3, data: '2026-06-12' }),
      m({ produs_id: 'fara', tip: 'corectie', cantitate: 5, data: '2026-05-01' }),
    ]
    const cost = costTratamentePerioada({ miscari, start: '2026-01-01', end: '2026-12-31' })
    expect(cost.lei).toBeCloseTo(1.2 * 16.48)
    expect(cost.produseFaraPret).toBe(1)
  })

  it('linia din Rapoarte nu dublează cheltuiala: profitul rămâne încasat − cheltuieli', () => {
    const perioada: Perioada = { tip: 'sezon', start: '2026-01-01', end: '2026-12-31', eticheta: 'în sezonul 2026' }
    const date: DateRaport = {
      recoltari: [],
      vanzari: [{ id: 'v', data: '2026-06-20', client_id: null, cantitate_kg: 10, pret_lei_kg: 50, status_plata: 'platit', data_incasare: '2026-06-20' }],
      // Cumpărătura trecută la cheltuieli („Trece și la cheltuieli”) e deja aici, o singură dată.
      cheltuieli: [{ id: 'c', data: '2026-05-20', categorie: 'Îngrășăminte', suma_lei: 412 }],
      butasi: [],
      investitii: [],
      parcele: [],
      culegatori: [],
      clienti: [],
    }
    const sumar = sumarRaport(date, perioada)
    const cost = costTratamentePerioada({
      miscari: [m({ tip: 'intrare', cantitate: 25, pret_total_lei: 412, data: '2026-05-20' }), m({ tip: 'iesire_tratament', cantitate: -1.2, data: '2026-06-12' })],
      start: perioada.start,
      end: perioada.end,
    })
    expect(cost.lei).toBeGreaterThan(0)
    expect(sumar.cheltuieli).toBe(412)
    expect(sumar.profit).toBe(sumar.incasat - 412)
  })
})
