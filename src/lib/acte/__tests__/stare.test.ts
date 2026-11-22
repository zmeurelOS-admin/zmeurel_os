import { describe, expect, it } from 'vitest'

import { acteDinDocument, insiruire, lipsuriPeRand, stareActe, textBannerActe, titluLipsuri, type ActeDate } from '@/lib/acte/stare'
import { buildLegalDocsStatus, getLegalDocsMissingFields } from '@/lib/legal-docs/shared'

const CERTIFICAT_COMPLET: ActeDate = {
  full_name: 'Andrei Popa',
  legal_type: 'certificat_producator',
  locality: 'Văratec',
  phone: '0744123456',
  certificate_photo_url: 't/doc.png',
  accepted: true,
  certificate_series: 'SV',
  certificate_number: '123',
  certificate_expiry: '2027-04-03',
  cui: null,
}

describe('starea actelor', () => {
  it('complete', () => {
    expect(stareActe(CERTIFICAT_COMPLET)).toEqual({ complete: true, lipsuri: [], titlu: 'Complete', detaliu: null })
  })

  it('mockup: lipsesc seria și viza', () => {
    const stare = stareActe({ ...CERTIFICAT_COMPLET, certificate_series: '', certificate_expiry: null })
    expect(stare.titlu).toBe('Lipsesc 2 date')
    expect(stare.detaliu).toBe('Seria atestatului și valabilitatea.')
    expect(lipsuriPeRand(stare.lipsuri, 'certificat')).toHaveLength(2)
    expect(lipsuriPeRand(stare.lipsuri, 'ferma')).toHaveLength(0)
  })

  it('PFA cere CUI, nu certificat', () => {
    const stare = stareActe({ ...CERTIFICAT_COMPLET, legal_type: 'pfa', certificate_series: null, certificate_number: null, certificate_expiry: null })
    expect(stare.titlu).toBe('Lipsește o dată')
    expect(stare.lipsuri.map((item) => item.camp)).toEqual(['cui'])
    expect(stare.lipsuri[0].rand).toBe('ferma')
  })

  it('fără nimic: totul lipsește, fără câmpurile de certificat (forma nu e aleasă)', () => {
    const stare = stareActe(null)
    expect(stare.lipsuri.map((item) => item.camp)).toEqual([
      'legal_type',
      'locality',
      'full_name',
      'phone',
      'certificate_photo_url',
      'accepted',
    ])
  })

  it('titlurile', () => {
    expect(titluLipsuri(1)).toBe('Lipsește o dată')
    expect(titluLipsuri(3)).toBe('Lipsesc 3 date')
    expect(titluLipsuri(20)).toBe('Lipsesc 20 de date')
    expect(insiruire(['a'])).toBe('a')
    expect(insiruire(['a', 'b', 'c'])).toBe('a, b și c')
  })
})

describe('aceeași regulă peste tot', () => {
  const doc = {
    full_name: 'Andrei Popa',
    legal_type: 'certificat_producator' as const,
    locality: 'Văratec',
    phone: '0744123456',
    certificate_photo_url: 't/doc.png',
    legal_accepted_at: '2026-04-03T10:00:00Z',
    certificate_series: null,
    certificate_number: '123',
    certificate_expiry: null,
    cui: null,
    legal_docs_complete: false,
  }

  it('Setările (getLegalDocsMissingFields) și ecranul spun același lucru', () => {
    expect(getLegalDocsMissingFields(doc)).toEqual(stareActe(acteDinDocument(doc)).lipsuri.map((item) => item.eticheta))
    expect(buildLegalDocsStatus(doc).complete).toBe(false)
  })

  it('bannerul numără și numește aceleași lipsuri', () => {
    expect(textBannerActe(stareActe(acteDinDocument(doc)))).toBe(
      'Actele fermei: lipsesc 2 date (seria atestatului și valabilitatea).',
    )
  })
})
