'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { AuthFrame, AuthSeparator } from '@/components/auth/AuthFrame'
import { GoogleMark } from '@/components/auth/GoogleMark'
import { BigInput, Button, Notice, kitFocus, kitText } from '@/components/kit'
import { buildAuthCallbackUrl, sanitizeNextPath } from '@/lib/auth/redirects'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { getSupabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_callback_params: 'Lipsește informația necesară pentru autentificare. Încearcă din nou.',
  oauth_callback_failed: 'Intrarea cu Google nu s-a terminat. Încearcă din nou.',
  oauth_provider_error: 'Google a refuzat intrarea. Încearcă din nou.',
  verify_otp_failed: 'Linkul de confirmare nu mai e valabil.',
  tenant_lookup_failed: 'Contul s-a creat, dar ferma nu e încă gata. Încearcă din nou peste un minut.',
}

/** Unde merge un cont nou după creare: întrebarea cu numele și locul fermei. */
const DUPA_CONT_NOU = '/start/ferma'

const linkClass = cn('inline-flex min-h-touch items-center rounded-control font-bold text-primary underline', kitFocus)

/**
 * Login (promptul 31): Google, email și parolă, „Ai uitat parola?”, nota pentru operatori și „Încearcă demo-ul”.
 * `?mode=register` = contul nou cu email (fără numele fermei: îl cere ecranul de după cont).
 * Logica de autentificare e aceeași ca înainte.
 */
export default function LoginPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => getSupabase(), [])
  const mod = searchParams.get('mode') === 'register' ? 'register' : 'login'
  const nextPath = sanitizeNextPath(searchParams.get('next'))

  const [email, setEmail] = useState('')
  const [parola, setParola] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [eroare, setEroare] = useState<string | null>(null)

  useEffect(() => {
    const errorCode = searchParams.get('error')
    if (!errorCode) return
    setEroare(AUTH_ERROR_MESSAGES[errorCode] ?? 'Intrarea nu s-a terminat. Încearcă din nou.')
  }, [searchParams])

  useEffect(() => {
    setEroare(null)
  }, [mod])

  const intra = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    if (!EMAIL_REGEX.test(email.trim())) {
      setEroare('Emailul nu e scris corect.')
      return
    }
    setLoading(true)
    setEroare(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: parola })
    if (error) {
      setLoading(false)
      setEroare('Email sau parolă greșite.')
      return
    }
    trackEvent('login_success', 'auth', { source: 'login_page' })
    track('user_login')
    router.replace(nextPath)
    router.refresh()
  }

  const faContul = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    if (!EMAIL_REGEX.test(email.trim())) {
      setEroare('Emailul nu e scris corect.')
      return
    }
    if (parola.length < 8) {
      setEroare('Parola are cel puțin 8 caractere.')
      return
    }
    setLoading(true)
    setEroare(null)
    try {
      const response = await fetch('/api/auth/beta-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: parola, farmName: '' }),
      })
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string | { message?: string } }
      if (!response.ok || payload.ok === false) {
        throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || 'Nu am putut face contul.')
      }
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: parola })
      if (error) throw new Error('Contul s-a făcut, dar intrarea nu a mers. Intră cu emailul și parola.')
      trackEvent('register_success', 'auth', { source: 'login_page' })
      track('user_signup')
      router.replace(DUPA_CONT_NOU)
      router.refresh()
    } catch (cause) {
      setLoading(false)
      setEroare(cause instanceof Error && cause.message ? cause.message : 'Nu am putut face contul.')
    }
  }

  const cuGoogle = async () => {
    if (googleLoading) return
    setGoogleLoading(true)
    setEroare(null)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: buildAuthCallbackUrl(nextPath, window.location.origin), skipBrowserRedirect: true },
      })
      if (error) throw error
      if (!data?.url) throw new Error('Nu am putut porni intrarea cu Google.')
      window.location.assign(data.url)
    } catch (cause) {
      setGoogleLoading(false)
      setEroare(cause instanceof Error && cause.message ? cause.message : 'Nu am putut porni intrarea cu Google.')
    }
  }

  const register = mod === 'register'

  return (
    <AuthFrame title={register ? 'Cont nou' : 'Intră în cont'} backHref={register ? '/start' : '/'}>
      <Button type="button" variant="neutral" size="touch" className="w-full" loading={googleLoading} onClick={() => void cuGoogle()}>
        {googleLoading ? null : <GoogleMark />}
        {register ? 'Îmi fac cont cu Google' : 'Continuă cu Google'}
      </Button>
      <AuthSeparator />
      <form onSubmit={register ? faContul : intra} className="flex flex-col gap-3" noValidate>
        <BigInput
          id={register ? 'register-email' : 'login-email'}
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="nume@exemplu.ro"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <BigInput
          id={register ? 'register-password' : 'login-password'}
          label="Parolă"
          type="password"
          autoComplete={register ? 'new-password' : 'current-password'}
          placeholder={register ? 'cel puțin 8 caractere' : undefined}
          value={parola}
          onChange={(event) => setParola(event.target.value)}
          required
        />
        {register ? (
          <p className={cn(kitText.helper, 'text-fg-muted')}>Fără email de confirmare cât e beta.</p>
        ) : (
          <Link href="/reset-password-request" className={cn(kitText.secondary, linkClass, 'self-start')}>
            Ai uitat parola?
          </Link>
        )}
        {eroare ? <Notice tone="danger" title={eroare} /> : null}
        <Button type="submit" variant="primary" size="touch-lg" className="w-full" loading={loading} data-testid={register ? 'login-register-submit' : 'login-submit'}>
          {register ? 'Fă contul' : 'Intră'}
        </Button>
      </form>

      {register ? (
        <p className={cn(kitText.secondary, 'text-fg-muted')}>
          Ai deja cont?{' '}
          <Link href="/login" className={linkClass}>
            Intră
          </Link>
        </p>
      ) : (
        <>
          <Notice tone="info" title="Ești operator? Intră din linkul primit pe WhatsApp." />
          <p className={cn(kitText.secondary, 'text-fg-muted')}>
            Nu ai cont?{' '}
            <Link href="/start" className={linkClass}>
              Încearcă demo-ul
            </Link>
          </p>
        </>
      )}
    </AuthFrame>
  )
}
