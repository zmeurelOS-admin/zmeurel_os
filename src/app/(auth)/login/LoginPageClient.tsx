'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { buildAuthCallbackUrl, sanitizeNextPath } from '@/lib/auth/redirects'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { getSupabase } from '@/lib/supabase/client'
import { toast } from '@/lib/ui/toast'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_callback_params: 'Lipseste informatia necesara pentru autentificare. Incearca din nou.',
  oauth_callback_failed: 'Autentificarea cu Google nu a putut fi finalizata.',
  oauth_provider_error: 'Google a refuzat autentificarea. Incearca din nou.',
  verify_otp_failed: 'Linkul de confirmare nu mai este valid.',
  tenant_lookup_failed: 'Contul a fost creat, dar configurarea fermei nu s-a terminat inca.',
}

const cardClassName =
  'rounded-2xl border border-black/5 bg-white p-6 shadow-sm sm:p-6'

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.6C16.8 3 14.6 2 12 2 6.8 2 2.5 6.5 2.5 12S6.8 22 12 22c6.9 0 9.1-4.9 9.1-7.4 0-.5 0-.9-.1-1.3H12z"
      />
      <path
        fill="#34A853"
        d="M3.6 7.3l3.2 2.4c.9-2.6 3.3-4.4 6.2-4.4 1.9 0 3.1.8 3.8 1.5l2.6-2.6C16.8 3 14.6 2 12 2 8.4 2 5.2 4 3.6 7.3z"
      />
      <path
        fill="#FBBC05"
        d="M12 22c2.5 0 4.7-.8 6.3-2.3l-2.9-2.4c-.8.6-1.8 1-3.4 1-3.9 0-5.3-2.5-5.6-3.8l-3.2 2.5C4.8 20 8.1 22 12 22z"
      />
      <path
        fill="#4285F4"
        d="M21.1 12.8c0-.6 0-1-.2-1.5H12v3.9h5.5c-.2 1.1-1 2.7-2.6 3.7l2.9 2.4c1.7-1.5 3.3-4.4 3.3-8.5z"
      />
    </svg>
  )
}

function SectionDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-[var(--agri-border)]" />
      <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--agri-text-muted)]">sau</span>
      <div className="h-px flex-1 bg-[var(--agri-border)]" />
    </div>
  )
}

export default function LoginPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => getSupabase(), [])
  const initialTab = searchParams.get('mode') === 'register' ? 'register' : 'login'
  const nextPath = sanitizeNextPath(searchParams.get('next'))

  const [activeTab, setActiveTab] = useState<'login' | 'register'>(initialTab)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const [registerEmail, setRegisterEmail] = useState('')
  const [registerPassword, setRegisterPassword] = useState('')
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('')
  const [farmName, setFarmName] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerFeedback, setRegisterFeedback] = useState<string | null>(null)

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    const errorCode = searchParams.get('error')
    if (!errorCode) return
    const message = AUTH_ERROR_MESSAGES[errorCode] ?? 'Autentificarea nu a putut fi finalizata.'
    toast.error(message)
  }, [searchParams])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!EMAIL_REGEX.test(loginEmail)) {
      toast.error('Email invalid.')
      return
    }

    setLoginLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    })

    setLoginLoading(false)

    if (error) {
      toast.error('Email sau parola incorecta.')
      return
    }

    try {
      trackEvent('login_success', 'auth', { source: 'login_page' })
      track('user_login')
      router.replace(nextPath)
      router.refresh()
    } catch (error) {
      console.error('Post-login redirect handling failed:', error)
      router.replace(nextPath)
      router.refresh()
    }
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRegisterFeedback(null)

    if (!EMAIL_REGEX.test(registerEmail)) {
      const message = 'Email invalid.'
      toast.error(message)
      setRegisterFeedback(message)
      return
    }

    if (farmName.trim().length === 1) {
      const message = 'Numele fermei trebuie sa aiba minimum 2 caractere sau sa ramana gol.'
      toast.error(message)
      setRegisterFeedback(message)
      return
    }

    if (registerPassword.length < 8) {
      const message = 'Parola trebuie sa aiba minimum 8 caractere.'
      toast.error(message)
      setRegisterFeedback(message)
      return
    }

    if (registerPassword !== registerConfirmPassword) {
      const message = 'Parolele nu coincid.'
      toast.error(message)
      setRegisterFeedback(message)
      return
    }

    setRegisterLoading(true)

    try {
      const signupResponse = await fetch('/api/auth/beta-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: registerEmail.trim(),
          password: registerPassword,
          farmName: farmName.trim(),
        }),
      })
      const signupPayload = (await signupResponse.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string | { message?: string }
      }

      if (!signupResponse.ok || signupPayload.ok === false) {
        const message =
          typeof signupPayload.error === 'string'
            ? signupPayload.error
            : signupPayload.error?.message || 'Nu am putut crea contul.'
        toast.error(message)
        setRegisterFeedback(message)
        return
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: registerEmail.trim(),
        password: registerPassword,
      })

      if (error) {
        const message = error.message || 'Contul a fost creat, dar autentificarea a esuat.'
        toast.error(message)
        setRegisterFeedback(message)
        return
      }

      trackEvent('register_success', 'auth', { source: 'login_page' })
      track('user_signup')
      setRegisterFeedback(null)
      toast.success('Cont creat. Intri direct in aplicatie.')
      router.replace(nextPath)
      router.refresh()
    } catch (error: unknown) {
      const message = (error as { message?: string })?.message || 'Eroare la crearea contului.'
      setRegisterFeedback(message)
      toast.error(message)
    } finally {
      setRegisterLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: buildAuthCallbackUrl(nextPath, window.location.origin),
          skipBrowserRedirect: true,
        },
      })

      if (error) {
        throw error
      }

      if (!data?.url) {
        throw new Error('Nu am putut porni autentificarea cu Google.')
      }

      window.location.assign(data.url)
    } catch (error) {
      console.error('Google sign-in failed:', error)
      setGoogleLoading(false)
      const message =
        error instanceof Error ? error.message : 'Nu am putut porni autentificarea cu Google.'
      toast.error(message)
    }
  }

  return (
    <main className="min-h-screen bg-[var(--agri-bg)] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[420px] items-center">
        <div className="w-full space-y-4">
          <div className="space-y-2 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-semibold text-[var(--agri-primary)] shadow-sm">
              Z
            </div>
            <div>
              <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--agri-text)]">Zmeurel OS</h1>
              <p className="mt-1 text-sm text-[var(--agri-text-muted)]">
                Autentificare si creare cont pentru ferma
              </p>
            </div>
          </div>

          <div className="text-center">
            <Link
              href="/start"
              className="text-sm text-[var(--agri-text-muted)] underline-offset-2 hover:text-[var(--agri-text)] hover:underline"
            >
              Încearcă demo fără cont →
            </Link>
          </div>

          <div className={cardClassName}>
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as 'login' | 'register')}
              className="w-full"
            >
              <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-[var(--agri-surface-muted)] p-1">
                <TabsTrigger value="login" className="rounded-xl text-sm">
                  Login
                </TabsTrigger>
                <TabsTrigger value="register" className="rounded-xl text-sm">
                  Creeaza cont
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-5">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      placeholder="email@exemplu.ro"
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Parola</Label>
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Introdu parola"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Link
                      href="/reset-password-request"
                      className="text-sm font-medium text-[var(--agri-primary)] hover:underline"
                    >
                      Ai uitat parola?
                    </Link>
                  </div>

                  <Button
                    type="submit"
                    className="h-11 w-full rounded-xl bg-[var(--agri-primary)] text-white hover:bg-emerald-700"
                    disabled={loginLoading || googleLoading}
                  >
                    {loginLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Se autentifica...
                      </>
                    ) : (
                      'Autentifica-te'
                    )}
                  </Button>

                  <SectionDivider />

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl border-[var(--agri-border)] bg-white text-[var(--agri-text)] hover:bg-[var(--agri-surface-muted)]"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                  >
                    {googleLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Se redirectioneaza...
                      </>
                    ) : (
                      <>
                        <GoogleMark />
                        Continua cu Google
                      </>
                    )}
                  </Button>

                  <p className="text-center text-sm text-[var(--agri-text-muted)]">
                    Nu ai cont?{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('register')}
                      className="font-medium text-[var(--agri-primary)]"
                    >
                      Creeaza unul
                    </button>
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-5">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      autoComplete="email"
                      placeholder="email@exemplu.ro"
                      value={registerEmail}
                      onChange={(event) => setRegisterEmail(event.target.value)}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-farm">Nume ferma (optional)</Label>
                    <Input
                      id="register-farm"
                      type="text"
                      placeholder="Ferma mea"
                      value={farmName}
                      onChange={(event) => setFarmName(event.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Parola</Label>
                    <Input
                      id="register-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Minimum 8 caractere"
                      value={registerPassword}
                      onChange={(event) => setRegisterPassword(event.target.value)}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-password-confirm">Confirma parola</Label>
                    <Input
                      id="register-password-confirm"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repeta parola"
                      value={registerConfirmPassword}
                      onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                      required
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="h-11 w-full rounded-xl bg-[var(--agri-primary)] text-white hover:bg-emerald-700"
                    disabled={registerLoading || googleLoading}
                  >
                    {registerLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Se creeaza contul...
                      </>
                    ) : (
                      'Continua cu email'
                    )}
                  </Button>

                  <SectionDivider />

                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl border-[var(--agri-border)] bg-white text-[var(--agri-text)] hover:bg-[var(--agri-surface-muted)]"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                  >
                    {googleLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Se redirectioneaza...
                      </>
                    ) : (
                      <>
                        <GoogleMark />
                        Continua cu Google
                      </>
                    )}
                  </Button>

                  {registerFeedback ? (
                    <p className="rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] px-4 py-3 text-sm text-[var(--agri-text-muted)]">
                      {registerFeedback}
                    </p>
                  ) : null}

                  <p className="text-center text-sm text-[var(--agri-text-muted)]">
                    Ai deja cont?{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('login')}
                      className="font-medium text-[var(--agri-primary)]"
                    >
                      Autentifica-te
                    </button>
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </main>
  )
}
