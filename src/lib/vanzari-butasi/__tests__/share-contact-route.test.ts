// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { POST } from '@/app/api/share/contact/route'

function shareRequest(form: FormData) {
  return new Request('https://www.zmeurel.ro/api/share/contact', { method: 'POST', body: form })
}

describe('POST /api/share/contact', () => {
  it('redirecționează la comanda nouă cu contactul din vCard', async () => {
    const form = new FormData()
    const vcf = 'BEGIN:VCARD\r\nVERSION:2.1\r\nFN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Puiu BOTO=C8=98ANI\r\nTEL;CELL:+393491943590\r\nEND:VCARD\r\n'
    form.append('contact', new File([vcf], 'Puiu.vcf', { type: 'text/x-vcard' }))
    const res = await POST(shareRequest(form))
    expect(res.status).toBe(303)
    const location = res.headers.get('location') ?? ''
    expect(location.startsWith('https://www.zmeurel.ro/vanzari-butasi#contact=')).toBe(true)
    const payload = JSON.parse(decodeURIComponent(location.split('#contact=')[1]))
    expect(payload).toEqual({ n: 'Puiu BOTOȘANI', t: '+393491943590' })
  })

  it('trimite la eroare când nu primește nimic util', async () => {
    const res = await POST(shareRequest(new FormData()))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://www.zmeurel.ro/vanzari-butasi#contact-eroare')
  })
})
