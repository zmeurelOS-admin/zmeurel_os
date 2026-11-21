import { describe, expect, it } from 'vitest'

import { settingsRouteForLegacyHash } from '@/lib/setari/legacy-links'

describe('settingsRouteForLegacyHash', () => {
  it('ancorele vechi duc la subpagina nouă', () => {
    expect(settingsRouteForLegacyHash('#profil')).toBe('/settings/cont')
    expect(settingsRouteForLegacyHash('#gdpr')).toBe('/settings/cont')
    expect(settingsRouteForLegacyHash('#parola')).toBe('/settings/cont')
    expect(settingsRouteForLegacyHash('#locatie')).toBe('/settings/ferma')
    expect(settingsRouteForLegacyHash('#tema')).toBe('/settings/aspect')
    expect(settingsRouteForLegacyHash('#interfata')).toBe('/settings/aspect')
    expect(settingsRouteForLegacyHash('#notificari-push')).toBe('/notificari/setari')
    expect(settingsRouteForLegacyHash('#echipa')).toBe('/settings/echipa')
    expect(settingsRouteForLegacyHash('#documente-legale')).toBe('/settings/ferma/acte')
    expect(settingsRouteForLegacyHash('#pret-standard')).toBe('/settings/pret-standard')
    expect(settingsRouteForLegacyHash('#acasa')).toBe('/settings/acasa')
    expect(settingsRouteForLegacyHash('#ferma')).toBe('/settings/schimba-ferma')
  })

  it('fără ancoră, ancoră necunoscută sau secțiune scoasă: rămâi pe listă', () => {
    expect(settingsRouteForLegacyHash('')).toBeNull()
    expect(settingsRouteForLegacyHash(null)).toBeNull()
    expect(settingsRouteForLegacyHash('#nimic')).toBeNull()
    expect(settingsRouteForLegacyHash('#ai')).toBeNull()
  })
})
