import { describe, expect, it } from 'vitest'

import { DEFAULT_APP_URL, esteProductie, originDinUrl, originValida, primaOrigineValida } from '@/lib/brand'

const DEV = { productie: false }
const PROD = { productie: true }

describe('originDinUrl (promptul 33)', () => {
  it('adresele bune dau originea, fără cale și fără „/” final', () => {
    expect(originDinUrl('https://caietulfermei.ro', PROD)).toBe('https://caietulfermei.ro')
    expect(originDinUrl('https://caietulfermei.ro/', PROD)).toBe('https://caietulfermei.ro')
    expect(originDinUrl('https://caietulfermei.ro/login?x=1', PROD)).toBe('https://caietulfermei.ro')
    expect(originDinUrl('  https://caietulfermei.ro  ', PROD)).toBe('https://caietulfermei.ro')
    expect(originDinUrl('http://staging.caietulfermei.ro:8080/x', PROD)).toBe('http://staging.caietulfermei.ro:8080')
  })

  it('localhost: doar în afara producției', () => {
    expect(originDinUrl('http://localhost:3000', DEV)).toBe('http://localhost:3000')
    expect(originDinUrl('http://127.0.0.1:3001/', DEV)).toBe('http://127.0.0.1:3001')
    expect(originDinUrl('http://localhost:3000', PROD)).toBe(DEFAULT_APP_URL)
    expect(originDinUrl('http://127.0.0.1:3001', PROD)).toBe(DEFAULT_APP_URL)
  })

  it('orice altceva: adresa implicită', () => {
    const stricate: unknown[] = [
      'www.zmeurel.ro:443',
      'caietulfermei.ro',
      'value',
      'valuehttps://caietulfermei.ro',
      'https://value',
      'https://valuehttps',
      'ftp://caietulfermei.ro',
      'javascript:alert(1)',
      '',
      '   ',
      undefined,
      null,
      'https://',
      'https://user:pass@caietulfermei.ro',
      'https://user@caietulfermei.ro',
      'https://.caietulfermei.ro',
      42,
    ]
    for (const valoare of stricate) {
      expect(originDinUrl(valoare, DEV)).toBe(DEFAULT_APP_URL)
      expect(originDinUrl(valoare, PROD)).toBe(DEFAULT_APP_URL)
      expect(originValida(valoare, PROD)).toBeNull()
    }
  })

  it('nu aruncă niciodată și rezultatul e mereu protocol://host', () => {
    for (const valoare of ['%%%', 'https://[::1', '\u0000', 'http://', '//caietulfermei.ro', 'https://a..b']) {
      expect(() => originDinUrl(valoare, PROD)).not.toThrow()
      expect(originDinUrl(valoare, PROD)).toMatch(/^https?:\/\/[^/]+$/)
    }
  })

  it('primaOrigineValida: prima valoare care trece regula', () => {
    expect(primaOrigineValida(['value', undefined, 'https://caietulfermei.ro/x'], PROD)).toBe('https://caietulfermei.ro')
    expect(primaOrigineValida(['http://localhost:3000', 'https://zmeurel.ro'], PROD)).toBe('https://zmeurel.ro')
    expect(primaOrigineValida(['value', ''], PROD)).toBeNull()
  })

  it('producția = VERCEL_ENV=production', () => {
    expect(esteProductie({ VERCEL_ENV: 'production' })).toBe(true)
    expect(esteProductie({ VERCEL_ENV: 'preview' })).toBe(false)
    expect(esteProductie({ NEXT_PUBLIC_VERCEL_ENV: 'production' })).toBe(true)
    expect(esteProductie({})).toBe(false)
  })
})

describe('locurile care fac adrese absolute din env', () => {
  it('buildAuthCallbackUrl: o valoare stricată nu ajunge în adresa de întoarcere', async () => {
    const { buildAuthCallbackUrl } = await import('@/lib/auth/redirects')
    const vechi = process.env.NEXT_PUBLIC_SITE_URL
    try {
      // În browser, o valoare stricată cade pe originea paginii (nu pe „https://value”).
      process.env.NEXT_PUBLIC_SITE_URL = 'value'
      expect(buildAuthCallbackUrl('/comenzi')).toBe(`${window.location.origin}/auth/callback?next=%2Fcomenzi`)
      process.env.NEXT_PUBLIC_SITE_URL = 'https://valuehttps'
      expect(new URL(buildAuthCallbackUrl('/comenzi')).hostname).not.toBe('valuehttps')
      process.env.NEXT_PUBLIC_SITE_URL = 'https://caietulfermei.ro/'
      expect(buildAuthCallbackUrl('/comenzi')).toBe('https://caietulfermei.ro/auth/callback?next=%2Fcomenzi')
      expect(buildAuthCallbackUrl('/x', 'https://staging.caietulfermei.ro')).toBe('https://staging.caietulfermei.ro/auth/callback?next=%2Fx')
    } finally {
      process.env.NEXT_PUBLIC_SITE_URL = vechi
    }
  })

  it('origineAplicatie (QR-ul raportului public): env validat, apoi hostul cererii, apoi adresa platformei', async () => {
    const { origineAplicatie } = await import('@/lib/analize/raport-server')
    const vechiApp = process.env.NEXT_PUBLIC_APP_URL
    const vechiSite = process.env.NEXT_PUBLIC_SITE_URL
    try {
      process.env.NEXT_PUBLIC_APP_URL = 'valuehttps://caietulfermei.ro'
      process.env.NEXT_PUBLIC_SITE_URL = 'https://caietulfermei.ro/'
      expect(origineAplicatie('alt.host.ro', 'https')).toBe('https://caietulfermei.ro')
      process.env.NEXT_PUBLIC_APP_URL = ''
      process.env.NEXT_PUBLIC_SITE_URL = 'value'
      expect(origineAplicatie('caietulfermei.ro', 'https')).toBe('https://caietulfermei.ro')
      // Fără env și fără host valid: adresa platformei (`APP_URL`, deja validată la pornire).
      const { APP_URL } = await import('@/lib/brand')
      expect(origineAplicatie('value', 'https')).toBe(APP_URL)
      expect(origineAplicatie(null, null)).toBe(APP_URL)
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = vechiApp
      process.env.NEXT_PUBLIC_SITE_URL = vechiSite
    }
  })
})
