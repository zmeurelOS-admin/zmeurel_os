import { describe, expect, it } from 'vitest'

import { parseSharedContact } from '@/lib/vanzari-butasi/shared-contact'

describe('parseSharedContact', () => {
  it('citește vCard 3.0 cu nume și telefon mobil', () => {
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Popescu;Ion;;;',
      'FN:Ion Popescu',
      'TEL;TYPE=HOME:0230 111 222',
      'TEL;TYPE=CELL:+40 744 123 456',
      'END:VCARD',
    ].join('\r\n')
    expect(parseSharedContact(vcf)).toEqual({ name: 'Ion Popescu', phone: '+40744123456' })
  })

  it('decodează vCard 2.1 QUOTED-PRINTABLE cu diacritice (exportul tipic Android)', () => {
    const vcf = [
      'BEGIN:VCARD',
      'VERSION:2.1',
      'N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:;Puiu BOTO=C8=98ANI;;;',
      'FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Puiu BOTO=C8=98ANI VREA SA FAC=C4=82 PLANTA=C8=9AIE',
      'TEL;CELL:+393491943590',
      'TEL;CELL:+393491943590',
      'END:VCARD',
    ].join('\n')
    expect(parseSharedContact(vcf)).toEqual({
      name: 'Puiu BOTOȘANI VREA SA FACĂ PLANTAȚIE',
      phone: '+393491943590',
    })
  })

  it('acceptă linii QUOTED-PRINTABLE continuate cu „=”', () => {
    const vcf = 'BEGIN:VCARD\nFN;ENCODING=QUOTED-PRINTABLE:Ana =\nMaria\nTEL:0744000111\nEND:VCARD'
    expect(parseSharedContact(vcf)).toEqual({ name: 'Ana Maria', phone: '0744000111' })
  })

  it('folosește N când lipsește FN', () => {
    const vcf = 'BEGIN:VCARD\nN:Rusu;Gheorghe;;;\nTEL;PREF:0752 987 654\nEND:VCARD'
    expect(parseSharedContact(vcf)).toEqual({ name: 'Gheorghe Rusu', phone: '0752987654' })
  })

  it('acceptă și text simplu (nume + număr)', () => {
    expect(parseSharedContact('Cozma Elena\n+40 733 555 010')).toEqual({
      name: 'Cozma Elena',
      phone: '+40733555010',
    })
  })

  it('întoarce null pentru conținut gol', () => {
    expect(parseSharedContact('')).toBeNull()
    expect(parseSharedContact('BEGIN:VCARD\nEND:VCARD')).toBeNull()
  })
})
