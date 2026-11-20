import { describe, expect, it } from 'vitest'

import { farmDisplayName } from '@/lib/tenant/farm-display-name'

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
})
