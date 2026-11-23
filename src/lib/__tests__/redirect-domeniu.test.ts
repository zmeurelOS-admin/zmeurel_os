import { describe, expect, it } from 'vitest'

import { destinatieRedirect, flagRedirectActiv, normalizeazaHost, type CerereRedirect } from '@/lib/redirect-domeniu'

const APP = 'https://caietulfermei.ro'

function cerere(host: string, url: string, extra: Partial<CerereRedirect> = {}): CerereRedirect {
  const parsed = new URL(url, 'http://x.local')
  return { host, pathname: parsed.pathname, search: parsed.search, activ: true, appUrl: APP, ...extra }
}

describe('destinatieRedirect', () => {
  it('flag oprit: nicio redirecționare, pe niciun host', () => {
    for (const host of ['zmeurel.ro', 'www.zmeurel.ro', 'app.zmeurel.ro', 'www.caietulfermei.ro']) {
      expect(destinatieRedirect(cerere(host, '/a/abc?x=1', { activ: false }))).toBeNull()
    }
  })

  it('zmeurel.ro, www.zmeurel.ro, app.zmeurel.ro: aceeași cale, cu query, pe caietulfermei.ro', () => {
    expect(destinatieRedirect(cerere('zmeurel.ro', '/a/abc?x=1'))).toBe('https://caietulfermei.ro/a/abc?x=1')
    expect(destinatieRedirect(cerere('www.zmeurel.ro', '/login?next=%2Fcomenzi'))).toBe('https://caietulfermei.ro/login?next=%2Fcomenzi')
    expect(destinatieRedirect(cerere('app.zmeurel.ro', '/dashboard'))).toBe('https://caietulfermei.ro/dashboard')
  })

  it('raportul public din QR (/a/<token>)', () => {
    expect(destinatieRedirect(cerere('app.zmeurel.ro', '/a/tok_1234567890abcdef'))).toBe('https://caietulfermei.ro/a/tok_1234567890abcdef')
    expect(destinatieRedirect(cerere('zmeurel.ro', '/a/tok_1234567890abcdef'))).toBe('https://caietulfermei.ro/a/tok_1234567890abcdef')
  })

  it('invitația operatorului și linkul de livrator', () => {
    expect(destinatieRedirect(cerere('zmeurel.ro', '/invite/AbC123_-x'))).toBe('https://caietulfermei.ro/invite/AbC123_-x')
    expect(destinatieRedirect(cerere('zmeurel.ro', '/livrator/tok123'))).toBe('https://caietulfermei.ro/livrator/tok123')
  })

  it('/ de pe zmeurel.ro și www.zmeurel.ro merge la magazin; de pe app.zmeurel.ro, la platformă', () => {
    expect(destinatieRedirect(cerere('zmeurel.ro', '/'))).toBe('https://comanda.zmeurel.ro/')
    expect(destinatieRedirect(cerere('www.zmeurel.ro', '/?utm_source=fb'))).toBe('https://comanda.zmeurel.ro/?utm_source=fb')
    expect(destinatieRedirect(cerere('app.zmeurel.ro', '/'))).toBe('https://caietulfermei.ro/')
  })

  it('www.caietulfermei.ro → caietulfermei.ro', () => {
    expect(destinatieRedirect(cerere('www.caietulfermei.ro', '/start?demo=1'))).toBe('https://caietulfermei.ro/start?demo=1')
    expect(destinatieRedirect(cerere('www.caietulfermei.ro', '/'))).toBe('https://caietulfermei.ro/')
  })

  it('nu atinge magazinul, preview-urile, localhost și caietulfermei.ro', () => {
    expect(destinatieRedirect(cerere('comanda.zmeurel.ro', '/'))).toBeNull()
    expect(destinatieRedirect(cerere('comanda.zmeurel.ro', '/comanda?x=1'))).toBeNull()
    expect(destinatieRedirect(cerere('zmeurel-git-redesign-abc.vercel.app', '/a/abc'))).toBeNull()
    expect(destinatieRedirect(cerere('localhost:3000', '/a/abc?x=1'))).toBeNull()
    expect(destinatieRedirect(cerere('127.0.0.1:3000', '/'))).toBeNull()
    expect(destinatieRedirect(cerere('caietulfermei.ro', '/a/abc'))).toBeNull()
  })

  it('rutele de cron nu se redirecționează, nici pe hosturile vechi', () => {
    expect(destinatieRedirect(cerere('zmeurel.ro', '/api/cron/notificari-dimineata'))).toBeNull()
    expect(destinatieRedirect(cerere('www.zmeurel.ro', '/api/cron/demo-tenant-cleanup?x=1'))).toBeNull()
  })

  it('hostul cu port sau majuscule se normalizează', () => {
    expect(destinatieRedirect(cerere('ZMEUREL.RO:443', '/x'))).toBe('https://caietulfermei.ro/x')
    expect(normalizeazaHost('WWW.Zmeurel.ro.')).toBe('www.zmeurel.ro')
  })

  it('fără bucle: dacă adresa platformei e încă zmeurel.ro, nu se redirecționează spre același host', () => {
    expect(destinatieRedirect(cerere('zmeurel.ro', '/a/abc', { appUrl: 'https://zmeurel.ro' }))).toBeNull()
    // www.zmeurel.ro → zmeurel.ro e alt host, deci merge
    expect(destinatieRedirect(cerere('www.zmeurel.ro', '/a/abc', { appUrl: 'https://zmeurel.ro' }))).toBe('https://zmeurel.ro/a/abc')
  })

  it('host lipsă sau adresă invalidă: nimic', () => {
    expect(destinatieRedirect(cerere('', '/a/abc'))).toBeNull()
    expect(destinatieRedirect(cerere('zmeurel.ro', '/a/abc', { appUrl: 'nu e url' }))).toBeNull()
  })
})

describe('flagRedirectActiv', () => {
  it('doar „1” pornește redirecționarea', () => {
    expect(flagRedirectActiv('1')).toBe(true)
    expect(flagRedirectActiv(' 1 ')).toBe(true)
    expect(flagRedirectActiv(undefined)).toBe(false)
    expect(flagRedirectActiv('0')).toBe(false)
    expect(flagRedirectActiv('true')).toBe(false)
  })
})
