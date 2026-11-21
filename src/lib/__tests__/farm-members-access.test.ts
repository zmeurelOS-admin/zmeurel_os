import { describe, expect, it } from 'vitest'

import {
  accessLevelForModule,
  applyTratamenteCompat,
  firstAllowedRoute,
  getAccessForPath,
  isPathAllowedForAccess,
  normalizeFarmMemberAccess,
  parseFarmMemberAccessHeader,
  resolveFarmMemberAccess,
  toStoredFarmMemberAccess,
} from '@/lib/farm-members/access'

describe('modulul tratamente', () => {
  it('e acceptat ca modul și are ruta /tratamente', () => {
    const access = normalizeFarmMemberAccess([{ module: 'tratamente', level: 'write' }])
    expect(access).toEqual([{ module: 'tratamente', level: 'write' }])
    expect(getAccessForPath('/tratamente', access)).toEqual({ module: 'tratamente', level: 'write' })
    expect(firstAllowedRoute(access)).toBe('/tratamente')
  })

  it('/tratamente nu mai ține de Lucrări (activitati)', () => {
    const access = normalizeFarmMemberAccess([{ module: 'activitati', level: 'write' }])
    expect(isPathAllowedForAccess('/lucrari', access)).toBe(true)
    expect(isPathAllowedForAccess('/activitati-agricole', access)).toBe(true)
    expect(isPathAllowedForAccess('/tratamente', access)).toBe(false)
  })
})

describe('paginile oricărui operator', () => {
  it('Mai mult și Notificări sunt permise, fără să dea nivel de acces; restul rămân după drepturi', () => {
    const access = normalizeFarmMemberAccess([{ module: 'recoltari', level: 'write' }])
    expect(isPathAllowedForAccess('/mai-mult', access)).toBe(true)
    expect(isPathAllowedForAccess('/notificari', access)).toBe(true)
    expect(isPathAllowedForAccess('/notificari/setari', access)).toBe(true)
    expect(getAccessForPath('/mai-mult', access)).toBeNull()
    expect(isPathAllowedForAccess('/mai-multe', access)).toBe(false)
    expect(isPathAllowedForAccess('/clienti', access)).toBe(false)
  })
})

describe('compatibilitatea activitati → tratamente: read', () => {
  it('un rând vechi cu Lucrări și fără Tratamente primește citire pe Tratamente', () => {
    const access = resolveFarmMemberAccess([
      { module: 'recoltari', level: 'write' },
      { module: 'activitati', level: 'write' },
    ])
    expect(accessLevelForModule(access, 'tratamente')).toBe('read')
    expect(getAccessForPath('/tratamente', access)).toEqual({ module: 'tratamente', level: 'read' })
  })

  it('nu atinge un drept de tratamente deja dat', () => {
    const access = resolveFarmMemberAccess([
      { module: 'activitati', level: 'read' },
      { module: 'tratamente', level: 'write' },
    ])
    expect(accessLevelForModule(access, 'tratamente')).toBe('write')
  })

  it('fără Lucrări nu dă nimic', () => {
    const access = resolveFarmMemberAccess([{ module: 'comenzi', level: 'write' }])
    expect(accessLevelForModule(access, 'tratamente')).toBeNull()
  })

  it('refuzul explicit („Nu”) oprește regula', () => {
    const stored = toStoredFarmMemberAccess([{ module: 'activitati', level: 'write' }])
    expect(stored).toEqual([
      { module: 'activitati', level: 'write' },
      { module: 'tratamente', level: 'none' },
    ])
    const access = resolveFarmMemberAccess(stored)
    expect(access).toEqual([{ module: 'activitati', level: 'write' }])
  })

  it('refuzul nu se scrie când Tratamente e dat sau Lucrări lipsește', () => {
    expect(toStoredFarmMemberAccess([{ module: 'comenzi', level: 'write' }])).toEqual([{ module: 'comenzi', level: 'write' }])
    expect(
      toStoredFarmMemberAccess([
        { module: 'activitati', level: 'write' },
        { module: 'tratamente', level: 'read' },
      ]),
    ).toEqual([
      { module: 'activitati', level: 'write' },
      { module: 'tratamente', level: 'read' },
    ])
  })

  it('rândul fără listă rămâne pe accesul vechi (Comenzi + Livrări)', () => {
    expect(resolveFarmMemberAccess(null, { legacyFallback: true })).toEqual([
      { module: 'comenzi', level: 'write' },
      { module: 'livrari', level: 'write' },
    ])
  })

  it('o invitație veche cu Lucrări se salvează la acceptare cu Tratamente: citire', () => {
    const resolved = resolveFarmMemberAccess([{ module: 'activitati', level: 'write' }])
    expect(toStoredFarmMemberAccess(resolved)).toEqual([
      { module: 'activitati', level: 'write' },
      { module: 'tratamente', level: 'read' },
    ])
  })

  it('antetul din proxy păstrează citirea dată de regulă', () => {
    const resolved = applyTratamenteCompat(normalizeFarmMemberAccess([{ module: 'activitati', level: 'write' }]))
    const header = resolved.map((item) => `${item.module}:${item.level}`).join(',')
    expect(parseFarmMemberAccessHeader(header)).toEqual(resolved)
  })

  it('normalizarea ignoră refuzul (nu e un nivel de acces)', () => {
    expect(normalizeFarmMemberAccess([{ module: 'tratamente', level: 'none' }])).toEqual([])
  })
})
