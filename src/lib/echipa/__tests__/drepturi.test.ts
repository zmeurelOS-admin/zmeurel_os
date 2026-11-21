import { describe, expect, it } from 'vitest'

import {
  accesDinCiorna,
  areVreunModul,
  cePoateFace,
  ciornaDinAcces,
  ciornaGoala,
  ECHIPA_ORDINE_MODULE,
  initialeNume,
  linkWhatsApp,
  randMembru,
  telefonWhatsApp,
  textDrepturi,
} from '@/lib/echipa/drepturi'
import { FARM_MEMBER_MODULES } from '@/lib/farm-members/access'

describe('ce poate face', () => {
  it('rezumatul din mockup: Recoltări, Lucrări (scrie) · Tratamente (citește)', () => {
    expect(
      textDrepturi([
        { module: 'tratamente', level: 'read' },
        { module: 'activitati', level: 'write' },
        { module: 'recoltari', level: 'write' },
      ]),
    ).toBe('Recoltări, Lucrări (scrie) · Tratamente (citește)')
  })

  it('proprietarul poate tot, livratorul doar Livrări', () => {
    expect(randMembru('proprietar')).toBe('Proprietar · tot')
    expect(randMembru('livrator')).toBe('Livrator · doar Livrări')
  })

  it('operatorul vechi cu Lucrări apare cu Tratamente (citește)', () => {
    expect(cePoateFace('operator', [{ module: 'activitati', level: 'write' }])).toBe('Lucrări (scrie) · Tratamente (citește)')
  })

  it('operatorul fără listă salvată are accesul vechi Comenzi + Livrări', () => {
    expect(cePoateFace('operator', null)).toBe('Comenzi, Livrări (scrie)')
  })

  it('fără module: „fără acces”', () => {
    expect(textDrepturi([])).toBe('fără acces')
  })
})

describe('ciorna Nu / Citește / Scrie', () => {
  it('pornește cu tot pe „Nu”', () => {
    const ciorna = ciornaGoala()
    expect(FARM_MEMBER_MODULES.every((module) => ciorna[module] === 'nu')).toBe(true)
    expect(areVreunModul(ciorna)).toBe(false)
    expect(accesDinCiorna(ciorna)).toEqual([])
  })

  it('dus-întors: ciornă → acces → ciornă', () => {
    const ciorna = { ...ciornaGoala(), recoltari: 'write', activitati: 'write', tratamente: 'read' } as const
    const acces = accesDinCiorna(ciorna)
    expect(acces).toEqual([
      { module: 'recoltari', level: 'write' },
      { module: 'activitati', level: 'write' },
      { module: 'tratamente', level: 'read' },
    ])
    expect(ciornaDinAcces(acces)).toEqual(ciorna)
  })

  it('refuzul explicit pe Tratamente rămâne „Nu” în ciornă', () => {
    const ciorna = ciornaDinAcces([
      { module: 'activitati', level: 'write' },
      { module: 'tratamente', level: 'none' },
    ])
    expect(ciorna.tratamente).toBe('nu')
    expect(ciorna.activitati).toBe('write')
  })

  it('lista din ecran conține toate modulele', () => {
    expect([...ECHIPA_ORDINE_MODULE].sort()).toEqual([...FARM_MEMBER_MODULES].sort())
  })
})

describe('invitația pe WhatsApp', () => {
  it('fără telefon: wa.me/?text=', () => {
    const url = linkWhatsApp({ rol: 'operator', link: 'https://zmeurel.ro/invite/abc' })
    expect(url.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(url.split('text=')[1])).toContain('https://zmeurel.ro/invite/abc')
  })

  it('cu telefon: numărul cu 40 în față', () => {
    expect(telefonWhatsApp('0744 123 456')).toBe('40744123456')
    expect(telefonWhatsApp('+40 744 123 456')).toBe('40744123456')
    expect(telefonWhatsApp('')).toBeNull()
    const url = linkWhatsApp({ rol: 'livrator', nume: 'Ion', telefon: '0744123456', link: 'https://zmeurel.ro/livrator/x' })
    expect(url.startsWith('https://wa.me/40744123456?text=')).toBe(true)
    expect(decodeURIComponent(url.split('text=')[1])).toContain('Salut Ion!')
  })

  it('inițialele', () => {
    expect(initialeNume('Ana Pavel')).toBe('AP')
    expect(initialeNume('ion')).toBe('I')
    expect(initialeNume('  ')).toBe('?')
    expect(initialeNume('Tu (cont demo)')).toBe('T')
  })
})
