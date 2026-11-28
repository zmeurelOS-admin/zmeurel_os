import { describe, expect, it } from 'vitest'

import {
  comenziSiLivrari,
  grupuriMeniu,
  hrefActiv,
  hrefActivDesktop,
  intrariMeniuDesktop,
  meniuAdmin,
  meniuDesktop,
  meniuFinal,
  meniuPrincipal,
  vedeBanii,
} from '@/lib/navigatie/meniu'

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

describe('bara laterală pe desktop, grupată (promptul 35, §1)', () => {
  const grupuri = (ctx: Parameters<typeof meniuDesktop>[0]) =>
    Object.fromEntries(meniuDesktop(ctx).grupuri.map((grup) => [grup.titlu, grup.intrari.map((intrare) => intrare.label)]))

  it('proprietarul: Acasă sus, apoi Vânzări · Ferma · Bani, Setări jos', () => {
    const meniu = meniuDesktop({})
    expect(meniu.sus.map((intrare) => intrare.label)).toEqual(['Acasă'])
    expect(meniu.grupuri.map((grup) => grup.titlu)).toEqual(['Vânzări', 'Ferma', 'Bani'])
    expect(grupuri({})).toEqual({
      Vânzări: ['Comenzi și livrări', 'Clienți', 'Stocuri', 'Vânzări', 'Produse', 'Material săditor'],
      Ferma: ['Parcele', 'Tratamente', 'Recoltări', 'Lucrări', 'Culegători'],
      Bani: ['Bani și rapoarte', 'Cheltuieli', 'Investiții'],
    })
    expect(meniu.jos.map((intrare) => intrare.label)).toEqual(['Planul tău', 'Setări', 'Scrie-mi o problemă sau o sugestie'])
    expect(meniu.admin).toEqual([])
    expect(comenziSiLivrari({})).toBe(true)
  })

  it('bara de jos și „Mai mult” de pe telefon rămân neschimbate', () => {
    expect(meniuPrincipal({}).map((intrare) => intrare.label)).toEqual(['Acasă', 'Livrări', 'Recoltări', 'Comenzi'])
    expect(grupuriMeniu({}).map((grup) => grup.titlu)).toEqual(['Ferma', 'Bani și oameni'])
  })

  it('operatorul nu vede grupul „Bani”, nici Vânzări, Stocuri, Material săditor; are „Mai mult” jos', () => {
    const ctx = {
      memberRole: 'operator' as const,
      memberAccess: [
        { module: 'comenzi' as const, level: 'write' as const },
        { module: 'livrari' as const, level: 'write' as const },
        { module: 'tratamente' as const, level: 'read' as const },
        { module: 'recoltari' as const, level: 'write' as const },
      ],
    }
    const meniu = meniuDesktop(ctx)
    expect(meniu.grupuri.map((grup) => grup.titlu)).toEqual(['Vânzări', 'Ferma'])
    expect(grupuri(ctx)).toEqual({ Vânzări: ['Comenzi și livrări'], Ferma: ['Tratamente', 'Recoltări'] })
    const hrefuri = intrariMeniuDesktop(meniu).map((intrare) => intrare.href)
    for (const bani of ['/rapoarte', '/vanzari', '/cheltuieli', '/investitii', '/stocuri', '/vanzari-butasi']) expect(hrefuri).not.toContain(bani)
    expect(meniu.jos.map((intrare) => intrare.label)).toEqual(['Mai mult', 'Scrie-mi o problemă sau o sugestie'])
    expect(vedeBanii(ctx)).toBe(false)
  })

  it('operatorul doar cu Livrări vede „Livrări” (spre /livrari), fără comutator', () => {
    const ctx = { memberRole: 'operator' as const, memberAccess: [{ module: 'livrari' as const, level: 'write' as const }] }
    expect(meniuDesktop(ctx).grupuri[0].intrari.map((intrare) => [intrare.label, intrare.href])).toEqual([['Livrări', '/livrari']])
    expect(comenziSiLivrari(ctx)).toBe(false)
  })

  it('operatorul fără Parcele și fără Tratamente nu le vede', () => {
    const ctx = { memberRole: 'operator' as const, memberAccess: [{ module: 'recoltari' as const, level: 'read' as const }] }
    expect(grupuri(ctx)).toEqual({ Ferma: ['Recoltări'] })
  })

  it('superadminul: zona Admin', () => {
    expect(meniuDesktop({ isSuperAdmin: true }).admin.map((intrare) => intrare.href)).toEqual(['/admin', '/admin/analytics', '/admin/audit', '/admin/kit'])
  })

  it('contul de asociație: grupul „Asociația”; altfel lipsește', () => {
    expect(meniuDesktop({ associationRole: 'admin' }).grupuri.map((grup) => grup.titlu)).toEqual(['Vânzări', 'Ferma', 'Bani', 'Asociația'])
    expect(grupuri({ associationRole: 'admin' }).Asociația).toEqual(['Gustă din Bucovina'])
    expect(meniuDesktop({}).grupuri.some((grup) => grup.titlu === 'Asociația')).toBe(false)
  })

  it('intrarea activă: Livrări sub „Comenzi și livrări”, Magazia sub Tratamente', () => {
    const hrefs = intrariMeniuDesktop(meniuDesktop({})).map((intrare) => intrare.href)
    expect(hrefActivDesktop('/livrari', hrefs)).toBe('/comenzi')
    expect(hrefActivDesktop('/tratamente/magazie/1', hrefs)).toBe('/tratamente')
    expect(hrefActivDesktop('/cheltuieli', hrefs, 'fila=investitii')).toBe('/investitii')
    expect(hrefActivDesktop('/notificari', hrefs)).toBeNull()
  })
})
