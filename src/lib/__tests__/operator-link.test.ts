import { describe, expect, it } from 'vitest'

import {
  cereLinkNou,
  evaluateOperatorLink,
  hiddenOperatorEmail,
  isHiddenOperatorEmail,
  operatorAccountKind,
  ownerDisplayName,
  withoutHiddenOperatorEmails,
  type OperatorLinkRow,
} from '@/lib/farm-members/operator-link'

const NOW = Date.parse('2026-11-21T10:00:00Z')

function row(overrides: Partial<OperatorLinkRow> = {}): OperatorLinkRow {
  return {
    id: 'inv-1',
    tenant_id: 'tenant-1',
    token: '11111111-1111-4111-8111-111111111111',
    modules_access: [{ module: 'comenzi', level: 'write' }],
    created_by: 'owner-1',
    expires_at: '2026-11-28T10:00:00Z',
    used_at: null,
    used_by_user_id: null,
    ...overrides,
  }
}

const membruActiv = { id: 'm-1', name: 'Ana', phone: null, is_active: true, role: 'operator' }

describe('evaluateOperatorLink: tokenul', () => {
  it('valid: prima invitație', () => {
    expect(evaluateOperatorLink({ row: row(), hasModules: true, now: NOW })).toEqual({ ok: true, kind: 'nou' })
  })

  it('inexistent', () => {
    expect(evaluateOperatorLink({ row: null, hasModules: false, now: NOW })).toEqual({ ok: false, reason: 'not_found' })
  })

  it('expirat (inclusiv exact la expirare)', () => {
    expect(evaluateOperatorLink({ row: row({ expires_at: '2026-11-20T10:00:00Z' }), hasModules: true, now: NOW })).toEqual({
      ok: false,
      reason: 'expired',
    })
    expect(evaluateOperatorLink({ row: row({ expires_at: '2026-11-21T10:00:00Z' }), hasModules: true, now: NOW }).ok).toBe(false)
  })

  it('folosit: a doua deschidere e refuzată', () => {
    expect(
      evaluateOperatorLink({ row: row({ used_at: '2026-11-21T09:00:00Z', used_by_user_id: 'op-1' }), hasModules: true, now: NOW }),
    ).toEqual({ ok: false, reason: 'used' })
  })

  it('fără drepturi: refuzat', () => {
    expect(evaluateOperatorLink({ row: row({ modules_access: [] }), hasModules: false, now: NOW })).toEqual({
      ok: false,
      reason: 'no_modules',
    })
  })

  it('reconectare: intră în același utilizator', () => {
    const state = evaluateOperatorLink({
      row: row({ used_by_user_id: 'op-1', modules_access: [] }),
      hasModules: false,
      member: membruActiv,
      now: NOW,
    })
    expect(state).toEqual({ ok: true, kind: 'reconectare', userId: 'op-1' })
  })

  it('reconectare pentru un operator dezactivat: refuzată', () => {
    expect(
      evaluateOperatorLink({
        row: row({ used_by_user_id: 'op-1', modules_access: [] }),
        hasModules: false,
        member: { ...membruActiv, is_active: false },
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: 'inactive' })
    expect(
      evaluateOperatorLink({ row: row({ used_by_user_id: 'op-1', modules_access: [] }), hasModules: false, member: null, now: NOW }),
    ).toEqual({ ok: false, reason: 'inactive' })
  })

  it('reconectare al cărei utilizator a fost șters nu devine invitație nouă', () => {
    // `used_by_user_id` devine null (on delete set null), drepturile sunt goale.
    expect(evaluateOperatorLink({ row: row({ modules_access: [] }), hasModules: false, now: NOW }).ok).toBe(false)
  })
})

describe('domeniul ascuns', () => {
  it('emailul intern e recunoscut, fără majuscule și spații', () => {
    const email = hiddenOperatorEmail('abc')
    expect(email).toBe('op-abc@operator.zmeurel.local')
    expect(isHiddenOperatorEmail(email)).toBe(true)
    expect(isHiddenOperatorEmail('  OP-X@Operator.Zmeurel.Local ')).toBe(true)
    expect(isHiddenOperatorEmail('ana@gmail.com')).toBe(false)
    expect(isHiddenOperatorEmail('guest+1@demo.zmeurel.local')).toBe(false)
    expect(isHiddenOperatorEmail(null)).toBe(false)
  })

  it('e scos din destinatarii emailurilor', () => {
    expect(withoutHiddenOperatorEmails(['ana@gmail.com', 'op-1@operator.zmeurel.local', null])).toEqual(['ana@gmail.com', null])
  })

  it('felul contului operatorului', () => {
    expect(operatorAccountKind({ email: 'op-1@operator.zmeurel.local' })).toBe('link')
    expect(operatorAccountKind({ email: 'ana@gmail.com', app_metadata: { provider: 'google' } })).toBe('google')
    expect(operatorAccountKind({ email: 'ana@gmail.com', identities: [{ provider: 'email' }, { provider: 'google' }] })).toBe('google')
    expect(operatorAccountKind({ email: 'ana@gmail.com', app_metadata: { provider: 'email' } })).toBe('parola')
  })
})

describe('numele proprietarului', () => {
  it('din full_name, din email sau necunoscut', () => {
    expect(ownerDisplayName({ email: 'x@y.ro', user_metadata: { full_name: ' Andrei  Popa ' } })).toBe('Andrei Popa')
    expect(ownerDisplayName({ email: 'ion.vasile@gmail.com', user_metadata: {} })).toBe('Ion Vasile')
    expect(ownerDisplayName({ email: 'guest+abc@demo.zmeurel.local', user_metadata: {} })).toBeNull()
    expect(ownerDisplayName(null)).toBeNull()
  })

  it('textul pentru link nou', () => {
    expect(cereLinkNou('Andrei')).toBe('Cere-i lui Andrei un link nou.')
    expect(cereLinkNou(null)).toBe('Cere-i proprietarului fermei un link nou.')
  })
})
