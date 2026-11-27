import { describe, expect, it } from 'vitest'

import { grupuriMeniu, hrefActiv, meniuAdmin, meniuFinal, meniuPrincipal } from '@/lib/navigatie/meniu'

const href = (lista: ReadonlyArray<{ href: string }>) => lista.map((intrare) => intrare.href)
const toate = (grupuri: ReturnType<typeof grupuriMeniu>) => grupuri.flatMap((grup) => href(grup.intrari))

describe('navigația comună (promptul 34, §10)', () => {
  it('proprietarul: Acasă · Livrări · Recoltări · Comenzi, apoi grupurile din „Mai mult”', () => {
    expect(meniuPrincipal({}).map((intrare) => intrare.label)).toEqual(['Acasă', 'Livrări', 'Recoltări', 'Comenzi'])
    const grupuri = grupuriMeniu({})
    expect(grupuri.map((grup) => grup.titlu)).toEqual(['Ferma', 'Bani și oameni'])
    expect(toate(grupuri)).toEqual([
      '/tratamente',
      '/tratamente/magazie',
      '/parcele',
      '/lucrari',
      '/stocuri',
      '/produse',
      '/vanzari-butasi',
      '/rapoarte',
      '/vanzari',
      '/cheltuieli',
      '/investitii',
      '/clienti',
      '/culegatori',
    ])
    expect(meniuFinal({}).map((intrare) => intrare.label)).toEqual(['Planul tău', 'Setări', 'Scrie-mi o problemă sau o sugestie'])
    expect(meniuAdmin({})).toEqual([])
  })

  it('pe telefon, „Mai mult” nu repetă ce e în bara de jos (aceleași intrări ca bara laterală, în rest)', () => {
    const desktop = toate(grupuriMeniu({}))
    const telefon = toate(grupuriMeniu({}, { faraPrincipale: true }))
    expect(telefon).toEqual(desktop.filter((h) => !href(meniuPrincipal({})).includes(h)))
  })

  it('operatorul doar cu Recoltări: Recoltări sus, nimic din bani, fără Setări și „Planul tău”', () => {
    const ctx = { memberRole: 'operator' as const, memberAccess: [{ module: 'recoltari' as const, level: 'write' as const }] }
    expect(href(meniuPrincipal(ctx))).toEqual(['/recoltari'])
    expect(toate(grupuriMeniu(ctx))).toEqual([])
    expect(meniuFinal(ctx).map((intrare) => intrare.label)).toEqual(['Scrie-mi o problemă sau o sugestie'])
  })

  it('operatorul cu Tratamente: vede Tratamente și Magazia; cu Parcele, Parcele', () => {
    const ctx = {
      memberRole: 'operator' as const,
      memberAccess: [
        { module: 'tratamente' as const, level: 'read' as const },
        { module: 'parcele' as const, level: 'read' as const },
      ],
    }
    expect(toate(grupuriMeniu(ctx))).toEqual(['/tratamente', '/tratamente/magazie', '/parcele'])
  })

  it('superadminul: zona Admin, fără „Scrie-mi…”', () => {
    expect(href(meniuAdmin({ isSuperAdmin: true }))).toEqual(['/admin', '/admin/analytics', '/admin/audit', '/admin/kit'])
    expect(meniuFinal({ isSuperAdmin: true }).some((intrare) => intrare.extern)).toBe(false)
  })

  it('intrarea activă: cea mai lungă potrivire', () => {
    const hrefs = ['/dashboard', '/tratamente', '/tratamente/magazie', '/settings']
    expect(hrefActiv('/tratamente/magazie/123', hrefs)).toBe('/tratamente/magazie')
    expect(hrefActiv('/tratamente', hrefs)).toBe('/tratamente')
    expect(hrefActiv('/tratamente/plan/1', hrefs)).toBe('/tratamente')
    expect(hrefActiv('/notificari', hrefs)).toBeNull()
    expect(hrefActiv('/cheltuieli', ['/cheltuieli', '/investitii'], 'fila=investitii')).toBe('/investitii')
    expect(hrefActiv('/cheltuieli', ['/cheltuieli', '/investitii'], '')).toBe('/cheltuieli')
  })
})
