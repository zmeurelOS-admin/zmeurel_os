import { describe, expect, it } from 'vitest'

import {
  CATEGORII_CHELTUIELI,
  CATEGORII_CHELTUIELI_ACCEPTATE,
  CATEGORII_CHELTUIELI_VECHI,
  CATEGORII_INVESTITII,
  CATEGORII_INVESTITII_ACCEPTATE,
  CATEGORII_INVESTITII_VECHI,
  resolveCheltuialaCategorie,
  resolveInvestitieCategorie,
} from '@/lib/financial/categories'
import {
  groupByDay,
  isSameMonth,
  monthOfIso,
  monthRange,
  rowsOfMonth,
  rowsOfYear,
  shiftMonthRef,
  sortNewestFirst,
  sumLei,
} from '@/lib/financial/view'
import type { Vanzare } from '@/lib/supabase/queries/vanzari'
import { stocRamasDupa } from '@/lib/vanzari/vanzare-rapida'
import {
  VANZARE_RAPIDA_FARA_CLIENT,
  VANZARE_RAPIDA_NOTA,
  buildVanzareRows,
  incasatInLuna,
  isVanzareRapida,
  searchVanzari,
  sortVanzari,
  vanzariDinLuna,
  vanzariNeincasate,
} from '@/lib/vanzari/view'

describe('categoriile noi de cheltuieli și investiții', () => {
  it('are 8 categorii de cheltuieli și 6 de investiții', () => {
    expect(CATEGORII_CHELTUIELI).toHaveLength(8)
    expect(CATEGORII_INVESTITII).toHaveLength(6)
  })

  it('lasă numele noi neschimbate', () => {
    for (const categorie of CATEGORII_CHELTUIELI) expect(resolveCheltuialaCategorie(categorie)).toBe(categorie)
    for (const categorie of CATEGORII_INVESTITII) expect(resolveInvestitieCategorie(categorie)).toBe(categorie)
  })

  it('duce fiecare categorie veche la una nouă', () => {
    for (const veche of CATEGORII_CHELTUIELI_VECHI) expect(CATEGORII_CHELTUIELI).toContain(resolveCheltuialaCategorie(veche))
    for (const veche of CATEGORII_INVESTITII_VECHI) expect(CATEGORII_INVESTITII).toContain(resolveInvestitieCategorie(veche))
  })

  it('respectă mapările hotărâte', () => {
    expect(resolveCheltuialaCategorie('Transport și livrare')).toBe('Motorină și curent')
    expect(resolveCheltuialaCategorie('Combustibil și energie')).toBe('Motorină și curent')
    expect(resolveCheltuialaCategorie('Consumabile')).toBe('Reparații și consumabile')
    expect(resolveCheltuialaCategorie('Diverse operaționale')).toBe('Altele')
    expect(resolveCheltuialaCategorie('Fertilizanți')).toBe('Îngrășăminte')
    expect(resolveCheltuialaCategorie('Forță de muncă')).toBe('Manoperă')
    expect(resolveInvestitieCategorie('Material săditor')).toBe('Plantație')
    expect(resolveInvestitieCategorie('Depozitare și răcire')).toBe('Construcții și depozitare')
    expect(resolveInvestitieCategorie('IT și automatizări')).toBe('Altele')
  })

  it('trece manopera generată automat din Recoltări la „Manoperă”', () => {
    expect(resolveCheltuialaCategorie('Manoperă cules')).toBe('Manoperă')
  })

  it('nu ține cont de majuscule, diacritice și spații', () => {
    expect(resolveCheltuialaCategorie('  motorina si CURENT ')).toBe('Motorină și curent')
    expect(resolveInvestitieCategorie('irigatie')).toBe('Irigație')
  })

  it('ghicește categoria din text liber și cade pe „Altele”', () => {
    expect(resolveCheltuialaCategorie('caserole 250g')).toBe('Ambalaje')
    expect(resolveCheltuialaCategorie('benzină pentru motocoasă')).toBe('Motorină și curent')
    expect(resolveInvestitieCategorie('tractor second hand')).toBe('Utilaje și unelte')
    expect(resolveCheltuialaCategorie('ceva neclar')).toBe('Altele')
    expect(resolveCheltuialaCategorie(null)).toBe('Altele')
    expect(resolveInvestitieCategorie('')).toBe('Altele')
  })

  it('acceptă la intrare și numele vechi, și pe cele noi (chatul AI)', () => {
    for (const name of [...CATEGORII_CHELTUIELI, ...CATEGORII_CHELTUIELI_VECHI]) expect(CATEGORII_CHELTUIELI_ACCEPTATE).toContain(name)
    for (const name of [...CATEGORII_INVESTITII, ...CATEGORII_INVESTITII_VECHI]) expect(CATEGORII_INVESTITII_ACCEPTATE).toContain(name)
    expect(new Set(CATEGORII_CHELTUIELI_ACCEPTATE).size).toBe(CATEGORII_CHELTUIELI_ACCEPTATE.length)
  })
})

describe('perioada și totalurile din Cheltuieli', () => {
  const rows = [
    { data: '2026-11-03', suma_lei: 120.5, created_at: '2026-11-03T08:00:00Z' },
    { data: '2026-11-03', suma_lei: 30, created_at: '2026-11-03T10:00:00Z' },
    { data: '2026-10-28', suma_lei: 200, created_at: '2026-10-28T08:00:00Z' },
    { data: '2025-11-10', suma_lei: 999, created_at: '2025-11-10T08:00:00Z' },
  ]

  it('mută luna peste granița anului', () => {
    expect(shiftMonthRef({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonthRef({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonthRef({ year: 2026, month: 11 }, -14)).toEqual({ year: 2025, month: 9 })
    expect(isSameMonth(monthOfIso('2026-11-19'), { year: 2026, month: 11 })).toBe(true)
  })

  it('dă capetele lunii', () => {
    expect(monthRange({ year: 2026, month: 2 })).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(monthRange({ year: 2028, month: 2 }).end).toBe('2028-02-29')
  })

  it('alege rândurile lunii și ale anului și le adună', () => {
    expect(sumLei(rowsOfMonth(rows, { year: 2026, month: 11 }))).toBe(150.5)
    expect(sumLei(rowsOfYear(rows, 2026))).toBe(350.5)
    expect(sumLei(rowsOfYear(rows, 2025))).toBe(999)
    expect(sumLei([])).toBe(0)
  })

  it('pune cele mai noi întâi și grupează pe zile', () => {
    const sorted = sortNewestFirst(rows)
    expect(sorted[0].created_at).toBe('2026-11-03T10:00:00Z')
    expect(groupByDay(sorted).map((group) => [group.day, group.rows.length])).toEqual([
      ['2026-11-03', 2],
      ['2026-10-28', 1],
      ['2025-11-10', 1],
    ])
  })
})

function vanzare(partial: Partial<Vanzare>): Vanzare {
  return {
    id: 'v',
    id_vanzare: 'V001',
    client_sync_id: 'sync',
    data: '2026-11-10',
    data_incasare: null,
    client_id: null,
    comanda_id: null,
    cantitate_kg: 4,
    pret_lei_kg: 30,
    pret_unitar_lei: 30,
    status_plata: 'neplatit',
    observatii_ladite: null,
    sync_status: 'synced',
    conflict_flag: false,
    created_by: null,
    updated_by: null,
    created_at: '2026-11-10T09:00:00Z',
    updated_at: '2026-11-10T09:00:00Z',
    tenant_id: 't',
    ...partial,
  }
}

describe('registrul de vânzări', () => {
  const clienti = [{ id: 'c1', nume_client: 'Ana Lungu', telefon: '0745 111 222' }]
  const comenzi = [
    { id: 'o1', client_nume: null, client_nume_manual: 'Vecinul', telefon: '0722000111', observatii: null },
    { id: 'o2', client_nume: null, client_nume_manual: VANZARE_RAPIDA_FARA_CLIENT, telefon: null, observatii: VANZARE_RAPIDA_NOTA },
  ]
  const vanzari = [
    vanzare({ id: 'a', client_id: 'c1', status_plata: 'platit', data: '2026-10-30', data_incasare: '2026-11-02' }),
    vanzare({ id: 'b', comanda_id: 'o1', status_plata: 'neplatit', suma_incasata_partial_lei: 50 }),
    vanzare({
      id: 'c',
      comanda_id: 'o2',
      status_plata: 'platit',
      data: '2026-11-12',
      data_incasare: '2026-11-12',
      cantitate_kg: 2.5,
      pret_lei_kg: 35,
      observatii_ladite: `${VANZARE_RAPIDA_NOTA} | Livrare comanda o2`,
      created_at: '2026-11-12T12:00:00Z',
    }),
    vanzare({ id: 'd', status_plata: 'restanta', data: '2026-09-01', created_at: '2026-09-01T07:00:00Z' }),
  ]
  const rows = buildVanzareRows(vanzari, clienti, comenzi)
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]))

  it('ia numele și telefonul din fișa clientului, altfel de pe comandă', () => {
    expect(byId.a.clientNume).toBe('Ana Lungu')
    expect(byId.a.telefon).toBe('0745 111 222')
    expect(byId.b.clientNume).toBe('Vecinul')
    expect(byId.b.telefon).toBe('0722000111')
    expect(byId.d.clientNume).toBe('Client necunoscut')
  })

  it('recunoaște vânzarea rapidă', () => {
    expect(isVanzareRapida(`${VANZARE_RAPIDA_NOTA} | Livrare comanda x`)).toBe(true)
    expect(isVanzareRapida('Livrare comanda x')).toBe(false)
    expect(byId.c.rapida).toBe(true)
    expect(byId.c.clientNume).toBe(VANZARE_RAPIDA_FARA_CLIENT)
    expect(byId.b.rapida).toBe(false)
  })

  it('socotește totalul, ce s-a primit și restul', () => {
    expect(byId.a).toMatchObject({ total: 120, incasata: true, primit: 120, rest: 0 })
    expect(byId.b).toMatchObject({ total: 120, incasata: false, primit: 50, rest: 70 })
    expect(byId.c).toMatchObject({ total: 87.5, incasata: true, rest: 0 })
    expect(byId.d).toMatchObject({ total: 120, incasata: false, primit: 0, rest: 120 })
  })

  it('trece venitul în luna încasării, cu toată suma', () => {
    // „a” e vândută în octombrie și încasată în noiembrie: intră în noiembrie.
    expect(incasatInLuna(rows, { year: 2026, month: 11 })).toEqual({ lei: 207.5, kg: 6.5, count: 2 })
    expect(incasatInLuna(rows, { year: 2026, month: 10 })).toEqual({ lei: 0, kg: 0, count: 0 })
  })

  it('o plată parțială nu e venit până nu vine restul', () => {
    const partial = [vanzare({ status_plata: 'neplatit', suma_incasata_partial_lei: 50, data_incasare_partiala: '2026-11-11' })]
    expect(incasatInLuna(partial, { year: 2026, month: 11 }).lei).toBe(0)
  })

  it('arată neîncasatele din orice lună și vânzările lunii alese', () => {
    expect(vanzariNeincasate(rows).map((row) => row.id).sort()).toEqual(['b', 'd'])
    expect(vanzariDinLuna(rows, { year: 2026, month: 11 }).map((row) => row.id).sort()).toEqual(['b', 'c'])
    expect(sortVanzari(rows).map((row) => row.id)).toEqual(['c', 'b', 'a', 'd'])
  })

  it('caută după client, fără diacritice', () => {
    expect(searchVanzari(rows, 'ana').map((row) => row.id)).toEqual(['a'])
    expect(searchVanzari(rows, 'poarta').map((row) => row.id)).toEqual(['c'])
    expect(searchVanzari(rows, '  ')).toHaveLength(4)
  })
})

describe('stocul rămas după o vânzare rapidă', () => {
  it('scade kilogramele vândute', () => {
    expect(stocRamasDupa(12.5, 5)).toBe(7.5)
    expect(stocRamasDupa(3, 5)).toBe(-2)
    expect(stocRamasDupa(8, 0)).toBe(8)
  })

  it('nu inventează un stoc necunoscut', () => {
    expect(stocRamasDupa(null, 5)).toBeNull()
    expect(stocRamasDupa(undefined, 5)).toBeNull()
  })
})
