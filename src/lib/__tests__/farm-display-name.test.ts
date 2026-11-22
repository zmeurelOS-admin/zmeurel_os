import { describe, expect, it } from 'vitest'

import { farmDisplayName, farmDisplayNameOrFallback } from '@/lib/tenant/farm-display-name'

describe('farmDisplayName', () => {
  it('arată „Ferma demo” în locul numelui tehnic al demo-ului', () => {
    expect(farmDisplayName('tenant_demo_1a2b3c4d')).toBe('Ferma demo')
    expect(farmDisplayName('  TENANT_DEMO_abc ')).toBe('Ferma demo')
  })

  it('lasă neschimbat un nume real', () => {
    expect(farmDisplayName('Ferma Popa')).toBe('Ferma Popa')
    expect(farmDisplayName(' Zmeurel ')).toBe('Zmeurel')
    expect(farmDisplayName('Ferma tenant_demo_x')).toBe('Ferma tenant_demo_x')
  })

  it('întoarce null pentru nume lipsă', () => {
    expect(farmDisplayName(null)).toBeNull()
    expect(farmDisplayName(undefined)).toBeNull()
    expect(farmDisplayName('   ')).toBeNull()
  })

  it('alt nume intern (`tenant_…`) devine „Ferma”', () => {
    expect(farmDisplayName('tenant_ab12cd34')).toBe('Ferma')
    expect(farmDisplayName('TENANT_x-1')).toBe('Ferma')
  })
})

describe('farmDisplayNameOrFallback', () => {
  it('numele real rămâne', () => {
    expect(farmDisplayNameOrFallback('Ferma Popa', { demo: true })).toBe('Ferma Popa')
  })
  it('demo: „Ferma demo” la nume lipsă sau intern', () => {
    expect(farmDisplayNameOrFallback('tenant_demo_4723a180')).toBe('Ferma demo')
    expect(farmDisplayNameOrFallback(null, { demo: true })).toBe('Ferma demo')
    expect(farmDisplayNameOrFallback('tenant_ab12', { demo: true })).toBe('Ferma demo')
  })
  it('altfel „Ferma”', () => {
    expect(farmDisplayNameOrFallback(null)).toBe('Ferma')
    expect(farmDisplayNameOrFallback('  ')).toBe('Ferma')
    expect(farmDisplayNameOrFallback('tenant_ab12')).toBe('Ferma')
  })
})
