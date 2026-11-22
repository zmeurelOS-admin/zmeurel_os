import { describe, expect, it } from 'vitest'

import {
  SETARI_MEMENTO_IMPLICITE,
  avertizareCulesLaTratament,
  calculeazaMemento,
  linkAnalizaNoua,
  normalizeazaZileMemento,
  produseDeEvitat,
  textNotificareMemento,
  textParceleMemento,
  textProdusDeEvitat,
  titluCardMemento,
  type ParcelaCules,
} from '@/lib/analize/memento'
import { notificareMemento } from '@/lib/analize/memento-cron'
import { NOTIFICARI_PREFERINTE_IMPLICITE, normalizeazaPreferinte, permitePush, setariAnalize, tipuriDeSalvat } from '@/lib/notifications/preferinte'
import { getNotificationHref } from '@/lib/notifications/navigation'
import { pushActionsDinDate } from '@/lib/notifications/send-push'
import { adaugaZile } from '@/lib/tratamente/zile'

const CULES = '2026-06-22'
const parcele: ParcelaCules[] = [
  { parcelaId: 'm1', nume: 'Maravilla 1', dataCules: CULES },
  { parcelaId: 'm2', nume: 'Maravilla 2', dataCules: '2026-06-25' },
  { parcelaId: 'd', nume: 'DELNIWA', dataCules: '2026-07-15' },
  { parcelaId: 'x', nume: 'Fără dată', dataCules: null },
]

const calc = (azi: string, extra: Partial<Parameters<typeof calculeazaMemento>[0]> = {}) =>
  calculeazaMemento({ azi, parcele, analize: [], setari: SETARI_MEMENTO_IMPLICITE, stare: null, ...extra })

const ziCu = (n: number) => adaugaZile(CULES, -n)

describe('calendarul mementoului', () => {
  it('trimite la 21, 14, 7 și 3 zile înainte, nu în celelalte zile', () => {
    for (const n of [21, 14, 7, 3]) expect(calc(ziCu(n)).trimiteAzi).toBe(true)
    for (const n of [20, 15, 13, 8, 6, 5, 4, 2, 1]) expect(calc(ziCu(n)).trimiteAzi).toBe(false)
  })

  it('cardul din Acasă apare din fereastra de 21 de zile, nu înainte', () => {
    expect(calc(ziCu(22)).activ).toBe(false)
    expect(calc(ziCu(22)).motiv).toBe('departe')
    expect(calc(ziCu(20)).activ).toBe(true)
    expect(calc(ziCu(20)).trimiteAzi).toBe(false)
  })

  it('grupează parcelele care încep în aceeași săptămână', () => {
    const r = calc(ziCu(21))
    expect(r.parcele.map((p) => p.parcelaId)).toEqual(['m1', 'm2'])
    expect(r.dataCules).toBe(CULES)
    expect(r.zileRamase).toBe(21)
  })

  it('zilnic din ziua culesului (și după), cu comutatorul pornit', () => {
    for (const n of [0, -1, -5]) expect(calc(ziCu(n)).trimiteAzi).toBe(true)
    const fara = calc(ziCu(-1), { setari: { ...SETARI_MEMENTO_IMPLICITE, zilnic: false } })
    expect(fara.trimiteAzi).toBe(false)
    expect(fara.activ).toBe(true)
  })

  it('zilele alese din Setări schimbă calendarul (ex. doar 1)', () => {
    const setari = { pornit: true, zile: [1], zilnic: false }
    expect(calc(ziCu(1), { setari }).trimiteAzi).toBe(true)
    expect(calc(ziCu(21), { setari }).trimiteAzi).toBe(false)
  })

  it('amânarea suspendă până la acea zi; în ziua ei trimite din nou', () => {
    const stare = { dezactivat: false, amanatPana: ziCu(4) }
    const azi = ziCu(7)
    expect(calc(azi, { stare }).trimiteAzi).toBe(false)
    expect(calc(azi, { stare }).motiv).toBe('amanat')
    expect(calc(azi, { stare }).activ).toBe(false)
    expect(calc(ziCu(4), { stare }).trimiteAzi).toBe(true)
    expect(calc(ziCu(3), { stare }).trimiteAzi).toBe(true)
  })

  it('se oprește la o analiză prelevată în fereastra sezonului pe acele parcele', () => {
    const analize = [{ parcele: ['m1', 'm2'], data_prelevare: ziCu(10) }]
    const r = calc(ziCu(7), { analize })
    // Rămâne DELNIWA, mai târziu, deci nu se trimite azi pentru Maravilla.
    expect(r.parcele.map((p) => p.parcelaId)).toEqual(['d'])
    expect(r.trimiteAzi).toBe(false)
    const toate = calc(ziCu(7), { analize: [...analize, { parcele: ['d'], data_prelevare: ziCu(5) }] })
    expect(toate.motiv).toBe('trimisa')
    expect(toate.activ).toBe(false)
  })

  it('o analiză de anul trecut sau prea veche nu oprește mementoul', () => {
    expect(calc(ziCu(7), { analize: [{ parcele: ['m1', 'm2'], data_prelevare: '2025-07-01' }] }).trimiteAzi).toBe(true)
    expect(calc(ziCu(7), { analize: [{ parcele: ['m1', 'm2'], data_prelevare: adaugaZile(CULES, -61) }] }).trimiteAzi).toBe(true)
  })

  it('„Nu fac analize anul acesta” și comutatorul general opresc tot', () => {
    expect(calc(ziCu(21), { stare: { dezactivat: true, amanatPana: null } })).toMatchObject({ motiv: 'dezactivat', activ: false, trimiteAzi: false })
    expect(calc(ziCu(21), { setari: { ...SETARI_MEMENTO_IMPLICITE, pornit: false } })).toMatchObject({ motiv: 'oprit', activ: false, trimiteAzi: false })
  })

  it('fără date de cules în anul curent: nimic', () => {
    const r = calculeazaMemento({ azi: '2026-06-01', parcele: [{ parcelaId: 'a', nume: 'A', dataCules: null }], analize: [], setari: SETARI_MEMENTO_IMPLICITE, stare: null })
    expect(r.motiv).toBe('fara_data')
  })

  it('liniștea 22–6: notificarea se creează, dar push-ul nu pleacă noaptea', () => {
    const noapte = new Date('2026-06-01T20:30:00Z') // 23:30 în România (vara)
    const dimineata = new Date('2026-06-01T05:00:00Z') // 8:00
    expect(permitePush(NOTIFICARI_PREFERINTE_IMPLICITE, 'analize_memento', noapte)).toBe(false)
    expect(permitePush(NOTIFICARI_PREFERINTE_IMPLICITE, 'analize_memento', dimineata)).toBe(true)
    expect(permitePush({ ...NOTIFICARI_PREFERINTE_IMPLICITE, tipuri: { analize: false } }, 'analize_memento', dimineata)).toBe(false)
  })

  it('zilele din Setări se salvează în preferințele de notificări și se citesc înapoi', () => {
    const tipuri = tipuriDeSalvat({ tipuri: { analize: true }, linisteNoaptea: true, analize: { zile: [14, 1], zilnic: false } })
    const citit = normalizeazaPreferinte({ tipuri, liniste_noaptea: true })
    expect(setariAnalize(citit)).toEqual({ pornit: true, zile: [14, 1], zilnic: false })
    expect(setariAnalize(NOTIFICARI_PREFERINTE_IMPLICITE)).toEqual({ pornit: true, zile: [21, 14, 7, 3], zilnic: true })
    expect(normalizeazaZileMemento([3, 21, 99, 3, '7'])).toEqual([21, 7, 3])
  })
})

describe('produsele de evitat', () => {
  const produse = [
    { nume: 'Fungicid X', pauzaZile: 28 },
    { nume: 'Insecticid Y', pauzaZile: 21 },
    { nume: 'Produs Z', pauzaZile: 3 },
    { nume: 'fungicid x', pauzaZile: 14 },
    { nume: 'Fertirigare', pauzaZile: 0 },
    { nume: '', pauzaZile: 40 },
  ]
  it('pauza mai lungă decât zilele rămase, plus „la limită” la egalitate', () => {
    const r = produseDeEvitat(produse, 21)
    expect(r).toEqual([
      { nume: 'Fungicid X', pauzaZile: 28, laLimita: false },
      { nume: 'Insecticid Y', pauzaZile: 21, laLimita: true },
    ])
    expect(textProdusDeEvitat(r[0])).toBe('pauză 28 de zile: mai lungă decât zilele rămase')
    expect(textProdusDeEvitat(r[1])).toBe('pauză 21 de zile: la limită')
  })
  it('din ziua culesului: orice produs cu pauză', () => {
    expect(produseDeEvitat(produse, 0).map((p) => p.nume)).toEqual(['Fungicid X', 'Insecticid Y', 'Produs Z'])
  })
})

describe('textele mementoului', () => {
  it('notificarea de la 21 de zile, ca în mockup', () => {
    expect(textNotificareMemento({ zileRamase: 21, parcele: ['Maravilla 1', 'Maravilla 2'], produseDeEvitat: 2 })).toEqual({
      title: 'Peste 21 de zile începe culesul',
      body: 'Maravilla 1 și 2. Programează analiza la fructe și evită acum produsele cu pauză lungă (2 în fermă).',
    })
    expect(textNotificareMemento({ zileRamase: 0, parcele: ['DELNIWA'], produseDeEvitat: 0 }).title).toBe('Culesul începe azi. Analiza nu e trimisă')
    expect(textParceleMemento(['Maravilla 1', 'DELNIWA', 'Solar'])).toBe('Maravilla 1, DELNIWA și Solar')
    expect(titluCardMemento(7)).toBe('Analiza la fructe · culesul în 7 zile')
  })

  it('notificarea are butoanele „Am trimis” (deep link) și „Amână 3 zile” (POST, fără token)', () => {
    const n = notificareMemento({ tenantId: 't1', azi: ziCu(21), calcul: calc(ziCu(21)), produseDeEvitat: 2 })
    expect(n.type).toBe('analize_memento')
    expect(n.reminderKey).toBe(`analize:t1:${ziCu(21)}`)
    const actions = pushActionsDinDate(n.data)
    expect(actions).toEqual([
      { action: 'am-trimis', title: 'Am trimis', url: '/tratamente?tab=analize&noua=1&parcele=m1,m2', post: undefined },
      { action: 'amana', title: 'Amână 3 zile', url: undefined, post: '/api/analize/memento/amana' },
    ])
    expect(JSON.stringify(n.data)).not.toMatch(/token/i)
    expect(getNotificationHref({ type: 'analize_memento', data: null }, null)).toBe('/dashboard?memento=analize')
    expect(linkAnalizaNoua([])).toBe('/tratamente?tab=analize&noua=1')
  })

  it('butoanele din date nu acceptă adrese din afara aplicației și cel mult două', () => {
    const actions = pushActionsDinDate({
      push_actions: [
        { action: 'a', title: 'A', url: 'https://rau.example/x' },
        { action: 'b', title: 'B', url: '//rau.example' },
        { action: 'c', title: 'C', url: '/ok' },
        { action: 'd', title: 'D', post: '/ok2' },
        { action: 'e', title: 'E', url: '/ok3' },
      ],
    })
    expect(actions.map((a) => a.action)).toEqual(['c', 'd'])
  })
})

describe('avertizarea la tratament', () => {
  const p = [
    { parcelaId: 'm1', nume: 'Maravilla 1', dataCules: '2026-06-22' },
    { parcelaId: 'd', nume: 'DELNIWA', dataCules: null },
  ]
  it('pauza trece de începutul culesului: avertizează, cu ziua de la care se poate culege', () => {
    const a = avertizareCulesLaTratament({ pauzaZile: 28, ziAplicare: '2026-06-01', parcele: p })
    expect(a?.titlu).toBe('Pauza trece de începutul culesului')
    expect(a?.text).toBe(
      'Culesul la Maravilla 1 e estimat peste 21 de zile; pauza ține 28. Poți salva, dar fructele n-ar trebui culese și analizate înainte de 29 iunie.',
    )
    expect(a?.parcelaIds).toEqual(['m1'])
  })
  it('pauza care se termină până la cules sau fără pauză: nimic', () => {
    expect(avertizareCulesLaTratament({ pauzaZile: 21, ziAplicare: '2026-06-01', parcele: p })).toBeNull()
    expect(avertizareCulesLaTratament({ pauzaZile: 0, ziAplicare: '2026-06-01', parcele: p })).toBeNull()
  })
  it('culesul deja început sau necunoscut: nimic (acolo e pauza obișnuită)', () => {
    expect(avertizareCulesLaTratament({ pauzaZile: 7, ziAplicare: '2026-06-25', parcele: p })).toBeNull()
  })
})
