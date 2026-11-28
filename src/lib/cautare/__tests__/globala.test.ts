import { describe, expect, it } from 'vitest'

import { cautaGlobal, cautaInGrup, grupuriPermise, normalizeaza, paginiCautare, scor, type ElementCautare } from '@/lib/cautare/globala'

const el = (id: string, titlu: string, extra: Partial<ElementCautare> = {}): ElementCautare => ({ id, titlu, href: `/x/${id}`, texte: [titlu], ...extra })

describe('căutarea globală (promptul 35, §2)', () => {
  it('fără diacritice și fără majuscule', () => {
    expect(normalizeaza('  Ștefan   CEL Mare ')).toBe('stefan cel mare')
    expect(scor(el('1', 'Ștefan Popescu'), 'stefan')).toBe(3)
    expect(scor(el('1', 'Ștefan Popescu'), 'POPESC')).toBe(3)
  })

  it('începutul unui cuvânt din nume e mai bun decât oriunde; un alt text e mai slab decât numele', () => {
    expect(scor(el('1', 'Mega Image'), 'ima')).toBe(3)
    expect(scor(el('1', 'Megaimage'), 'ima')).toBe(1)
    expect(scor(el('1', 'Ana', { texte: ['Ana', 'Str. Universității'] }), 'univ')).toBe(2)
    expect(scor(el('1', 'Ana'), 'xyz')).toBe(0)
  })

  it('telefonul: după cifre, cu spații, fără zero în față; cel puțin 3 cifre', () => {
    const ana = el('1', 'Ana', { telefoane: ['0744 112 233'] })
    expect(scor(ana, '0744112')).toBe(1)
    expect(scor(ana, '744 11')).toBe(1)
    expect(scor(ana, '74')).toBe(0)
  })

  it('ordinea în grup și limita de 5', () => {
    const elemente = ['Marin', 'Maria', 'Ana Maria', 'Mara', 'Marcel', 'Marius', 'Tamara'].map((nume, i) => el(String(i), nume))
    const rezultate = cautaInGrup('clienti', elemente, 'mar')
    expect(rezultate).toHaveLength(5)
    expect(rezultate.every((r) => r.scor === 3)).toBe(true)
    expect(rezultate.map((r) => r.titlu)).not.toContain('Tamara')
  })

  it('grupurile în ordinea fixă; cele goale lipsesc', () => {
    const grupuri = cautaGlobal(
      'maravilla',
      { comenzi: [el('c', 'Maravilla SRL')], parcele: [el('p', 'Maravilla 1')], clienti: [el('k', 'Ion')] },
      { pagini: true, comenzi: true, clienti: true, parcele: true, culegatori: true },
    )
    expect(grupuri.map((g) => g.grup)).toEqual(['comenzi', 'parcele'])
    expect(cautaGlobal('  ', { comenzi: [el('c', 'X')] }, { pagini: true, comenzi: true, clienti: true, parcele: true, culegatori: true })).toEqual([])
  })

  it('operatorul fără Comenzi nu primește grupul Comenzi, chiar dacă datele există', () => {
    const ctx = { memberRole: 'operator' as const, memberAccess: [{ module: 'parcele' as const, level: 'read' as const }] }
    const permise = grupuriPermise(ctx)
    expect(permise).toEqual({ pagini: true, comenzi: false, clienti: false, parcele: true, culegatori: false })
    const grupuri = cautaGlobal('ana', { comenzi: [el('c', 'Ana')], parcele: [el('p', 'Ana parcela')] }, permise)
    expect(grupuri.map((g) => g.grup)).toEqual(['parcele'])
  })

  it('paginile: doar cele vizibile; operatorul nu vede paginile de bani și setările', () => {
    const proprietar = paginiCautare({}).map((p) => p.titlu)
    expect(proprietar).toEqual(expect.arrayContaining(['Bani și rapoarte', 'Magazia', 'Registrul de tratamente', 'Setări › Echipa']))
    const operator = paginiCautare({ memberRole: 'operator', memberAccess: [{ module: 'recoltari', level: 'write' }] }).map((p) => p.titlu)
    expect(operator).toContain('Recoltări')
    for (const ascuns of ['Bani și rapoarte', 'Cheltuieli', 'Magazia', 'Registrul de tratamente', 'Setări › Echipa', 'Comenzi și livrări']) expect(operator).not.toContain(ascuns)
    expect(cautaInGrup('pagini', paginiCautare({}), 'magaz')[0]?.href).toBe('/tratamente/magazie')
  })
})
