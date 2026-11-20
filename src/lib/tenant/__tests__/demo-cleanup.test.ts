import { describe, expect, it } from 'vitest'

import {
  demoCleanupMode,
  esteCaleBonAFermei,
  esteTenantIdValid,
  numaraProtejate,
  selecteazaDemoDeSters,
  semneFermaReala,
  type DemoDeSters,
  type ProtectiiCuratare,
  type StareFermaDemo,
  type TenantPentruCuratare,
} from '@/lib/tenant/demo-cleanup'

const ACUM = new Date('2026-11-20T04:00:00.000Z')
const ORA = 60 * 60 * 1000
const vechi = (ore: number) => new Date(ACUM.getTime() - ore * ORA).toISOString()

function protectii(over: Partial<ProtectiiCuratare> = {}): ProtectiiCuratare {
  return {
    superadminIds: new Set(),
    associationMemberIds: new Set(),
    esteProprietarProtejat: () => false,
    ...over,
  }
}

function tenant(id: string, owner: string | null, ore = 48, extra: Partial<TenantPentruCuratare> = {}): TenantPentruCuratare {
  return { id, owner_user_id: owner, created_at: vechi(ore), is_demo: false, is_association_approved: false, ...extra }
}

function selecteaza(tenanti: TenantPentruCuratare[], emailuri: Record<string, string | null>, p = protectii()) {
  return selecteazaDemoDeSters(tenanti, new Map(Object.entries(emailuri)), ACUM, p)
}

describe('selecteazaDemoDeSters', () => {
  it('ia un demo cu email @demo.zmeurel.local mai vechi de 24 h', () => {
    const { deSters, protejate } = selecteaza([tenant('t1', 'u1')], { u1: 'a1@demo.zmeurel.local' })
    expect(deSters).toEqual([{ tenantId: 't1', ownerUserId: 'u1', email: 'a1@demo.zmeurel.local', createdAt: vechi(48) }])
    expect(protejate).toEqual([])
  })

  it('compară emailul fără majuscule și fără spații', () => {
    const { deSters } = selecteaza([tenant('t1', 'u1')], { u1: ' A1@Demo.Zmeurel.Local ' })
    expect(deSters.map((d) => d.tenantId)).toEqual(['t1'])
    expect(deSters[0]?.email).toBe('a1@demo.zmeurel.local')
  })

  it('un demo de 23 h nu se șterge (e protejat ca prea nou)', () => {
    const { deSters, protejate } = selecteaza([tenant('t1', 'u1', 23)], { u1: 'a1@demo.zmeurel.local' })
    expect(deSters).toEqual([])
    expect(protejate).toEqual([{ tenantId: 't1', motiv: 'prea_noua' }])
  })

  it('o fermă fără created_at valid nu se șterge', () => {
    const { deSters, protejate } = selecteaza([tenant('t1', 'u1', 48, { created_at: null }), tenant('t2', 'u2', 48, { created_at: 'nu' })], {
      u1: 'a1@demo.zmeurel.local',
      u2: 'a2@demo.zmeurel.local',
    })
    expect(deSters).toEqual([])
    expect(protejate.map((p) => p.motiv)).toEqual(['data_necunoscuta', 'data_necunoscuta'])
  })

  it('@example.test nu se șterge prin acest cron', () => {
    const { deSters, protejate } = selecteaza([tenant('t1', 'u1')], { u1: 'e2e@example.test' })
    expect(deSters).toEqual([])
    expect(protejate).toEqual([])
  })

  it('is_demo = true cu email real NU se șterge; is_demo / expires_at nu decid', () => {
    const { deSters } = selecteaza([tenant('t1', 'u1', 500, { is_demo: true })], { u1: 'ion@gmail.com' })
    expect(deSters).toEqual([])
  })

  it('un demo cu is_demo = false se șterge (decide doar emailul)', () => {
    const { deSters } = selecteaza([tenant('t1', 'u1', 48, { is_demo: false })], { u1: 'a@demo.zmeurel.local' })
    expect(deSters).toHaveLength(1)
  })

  it('fără proprietar sau proprietar fără email: nu intră niciodată', () => {
    const { deSters, protejate } = selecteaza([tenant('t1', null), tenant('t2', 'u2'), tenant('t3', 'u3')], {
      u2: null,
    })
    expect(deSters).toEqual([])
    expect(protejate).toEqual([])
  })

  it('emailuri care doar seamănă cu demo nu intră', () => {
    const { deSters } = selecteaza([tenant('t1', 'u1'), tenant('t2', 'u2')], {
      u1: 'a@demo.zmeurel.local.ro',
      u2: 'demo.zmeurel.local@gmail.com',
    })
    expect(deSters).toEqual([])
  })

  it('protejează superadminii', () => {
    const { deSters, protejate } = selecteaza([tenant('t1', 'u1')], { u1: 'a@demo.zmeurel.local' }, protectii({ superadminIds: new Set(['u1']) }))
    expect(deSters).toEqual([])
    expect(protejate).toEqual([{ tenantId: 't1', motiv: 'superadmin' }])
  })

  it('protejează DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS', () => {
    const { deSters, protejate } = selecteaza(
      [tenant('t1', 'u1')],
      { u1: 'a@demo.zmeurel.local' },
      protectii({ esteProprietarProtejat: (id) => id === 'u1' }),
    )
    expect(deSters).toEqual([])
    expect(protejate).toEqual([{ tenantId: 't1', motiv: 'lista_protejata' }])
  })

  it('protejează fermele de asociație (aprobate sau proprietar membru)', () => {
    const { deSters, protejate } = selecteaza(
      [tenant('t1', 'u1', 48, { is_association_approved: true }), tenant('t2', 'u2')],
      { u1: 'a1@demo.zmeurel.local', u2: 'a2@demo.zmeurel.local' },
      protectii({ associationMemberIds: new Set(['u2']) }),
    )
    expect(deSters).toEqual([])
    expect(protejate).toEqual([
      { tenantId: 't1', motiv: 'asociatie' },
      { tenantId: 't2', motiv: 'asociatie' },
    ])
  })

  it('un proprietar cu mai multe ferme nu se șterge (ștergerea contului le-ar lua pe toate)', () => {
    const { deSters, protejate } = selecteaza([tenant('t1', 'u1'), tenant('t2', 'u1')], { u1: 'a@demo.zmeurel.local' })
    expect(deSters).toEqual([])
    expect(numaraProtejate(protejate)).toEqual({ mai_multe_ferme: 2 })
  })

  it('le ordonează de la cea mai veche', () => {
    const { deSters } = selecteaza([tenant('t1', 'u1', 30), tenant('t2', 'u2', 300), tenant('t3', 'u3', 100)], {
      u1: 'a1@demo.zmeurel.local',
      u2: 'a2@demo.zmeurel.local',
      u3: 'a3@demo.zmeurel.local',
    })
    expect(deSters.map((d) => d.tenantId)).toEqual(['t2', 't3', 't1'])
  })
})

describe('demoCleanupMode', () => {
  it('doar „sterge” șterge; orice altceva e probă', () => {
    expect(demoCleanupMode('sterge')).toBe('sterge')
    expect(demoCleanupMode(undefined)).toBe('proba')
    expect(demoCleanupMode(null)).toBe('proba')
    expect(demoCleanupMode('')).toBe('proba')
    expect(demoCleanupMode('STERGE')).toBe('proba')
    expect(demoCleanupMode('șterge')).toBe('proba')
    expect(demoCleanupMode('true')).toBe('proba')
    expect(demoCleanupMode('proba')).toBe('proba')
  })
})

describe('semneFermaReala', () => {
  const candidat: DemoDeSters = { tenantId: 't1', ownerUserId: 'u1', email: 'a@demo.zmeurel.local', createdAt: vechi(48) }
  const stareDemo = (over: Partial<StareFermaDemo> = {}): StareFermaDemo => ({
    tenant: { owner_user_id: 'u1', created_at: vechi(48), is_association_approved: false },
    ownerEmail: 'a@demo.zmeurel.local',
    ownerSuperadmin: false,
    ownerProtejat: false,
    ownerInAsociatie: false,
    fermeAleProprietarului: 1,
    profileIds: ['u1'],
    membriUserIds: [],
    comenziMagazin: 0,
    legaturiMagazin: 0,
    oferteAsociatie: 0,
    ...over,
  })

  it('un demo curat nu are semne', () => {
    expect(semneFermaReala(candidat, stareDemo(), ACUM)).toEqual([])
    expect(semneFermaReala(candidat, stareDemo({ membriUserIds: ['u1'] }), ACUM)).toEqual([])
  })

  it('o fermă care nu mai există nu are semne (nu e nimic de șters)', () => {
    expect(semneFermaReala(candidat, stareDemo({ tenant: null }), ACUM)).toEqual([])
  })

  it.each<[string, Partial<StareFermaDemo>]>([
    ['email schimbat pe unul real', { ownerEmail: 'ion@gmail.com' }],
    ['email lipsă', { ownerEmail: null }],
    ['alt proprietar', { tenant: { owner_user_id: 'u9', created_at: vechi(48) } }],
    ['superadmin', { ownerSuperadmin: true }],
    ['protejat', { ownerProtejat: true }],
    ['membru de asociație', { ownerInAsociatie: true }],
    ['aprobată în asociație', { tenant: { owner_user_id: 'u1', created_at: vechi(48), is_association_approved: true } }],
    ['prea nouă', { tenant: { owner_user_id: 'u1', created_at: vechi(2) } }],
    ['proprietar cu altă fermă', { fermeAleProprietarului: 2 }],
    ['alt utilizator în profiles (chiar demo)', { profileIds: ['u1', 'u2'] }],
    ['alt membru în farm_members', { membriUserIds: ['u1', 'u2'] }],
    ['membru șters din farm_members', { membriUserIds: [null] }],
    ['comenzi în magazin', { comenziMagazin: 1 }],
    ['legături magazin–comenzi', { legaturiMagazin: 1 }],
    ['oferte în asociație', { oferteAsociatie: 1 }],
  ])('semn: %s', (_nume, over) => {
    expect(semneFermaReala(candidat, stareDemo(over), ACUM).length).toBeGreaterThan(0)
  })
})

describe('căile bonurilor', () => {
  const T = '0a1b2c3d-1111-4222-8333-444455556666'

  it('acceptă doar un tenant_id UUID', () => {
    expect(esteTenantIdValid(T)).toBe(true)
    expect(esteTenantIdValid('')).toBe(false)
    expect(esteTenantIdValid('t1')).toBe(false)
    expect(esteTenantIdValid(null)).toBe(false)
  })

  it('o cale se șterge doar dacă e sub prefixul fermei', () => {
    expect(esteCaleBonAFermei(T, `${T}/cheltuieli/abc.jpg`)).toBe(true)
    expect(esteCaleBonAFermei(T, `${T}/investitii/x.jpg`)).toBe(true)
    expect(esteCaleBonAFermei(T, T)).toBe(false)
    expect(esteCaleBonAFermei(T, `${T}/`)).toBe(false)
    expect(esteCaleBonAFermei(T, `${T}x/cheltuieli/a.jpg`)).toBe(false)
    expect(esteCaleBonAFermei(T, `alt/${T}/a.jpg`)).toBe(false)
    expect(esteCaleBonAFermei(T, `${T}/../alt/a.jpg`)).toBe(false)
    expect(esteCaleBonAFermei(T, `${T}//a.jpg`)).toBe(false)
    expect(esteCaleBonAFermei('', '/a.jpg')).toBe(false)
    expect(esteCaleBonAFermei('t1', 't1/a.jpg')).toBe(false)
  })
})
