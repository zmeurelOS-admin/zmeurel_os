'use client'

import { FormEvent, useMemo, useState, type CSSProperties } from 'react'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/ui/toast'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { getSupabase } from '@/lib/supabase/client'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getSignupRedirectUrl() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).trim()
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, '')
  return `${normalizedSiteUrl}/auth/callback`
}

function getOAuthRedirectUrl() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')).trim()
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, '')
  return `${normalizedSiteUrl}/auth/callback`
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = useMemo(() => getSupabase(), [])
  const initialTab = useMemo<'login' | 'register'>(() => {
    if (typeof window === 'undefined') return 'login'
    const requestedMode = new URLSearchParams(window.location.search).get('mode')
    if (requestedMode === 'register') return 'register'
    return 'login'
  }, [])
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
  const [verificationPending, setVerificationPending] = useState(false)
  const [registerFeedback, setRegisterFeedback] = useState<string | null>(null)

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
      router.replace('/dashboard')
      router.refresh()
    } catch {
      router.replace('/dashboard')
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

    if (farmName.trim().length < 2) {
      const message = 'Numele fermei este obligatoriu.'
      toast.error(message)
      setRegisterFeedback(message)
      return
    }

    if (registerPassword.length < 8) {
      const message = 'Parola trebuie sa aiba minim 8 caractere.'
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

    const emailRedirectTo = getSignupRedirectUrl()
    console.log('Signup redirectTo:', emailRedirectTo)

    try {
      const { error } = await supabase.auth.signUp({
        email: registerEmail.trim(),
        password: registerPassword,
        options: {
          emailRedirectTo,
          data: {
            farm_name: farmName.trim(),
          },
        },
      })

      setRegisterLoading(false)

      if (error) {
        toast.error(error.message)
        setRegisterFeedback(error.message)
        return
      }

      trackEvent('register_success', 'auth', { source: 'login_page' })
      track('user_signup')
      setVerificationPending(true)
      setRegisterFeedback('Cont creat. Verifica emailul pentru confirmare.')
      toast.success('Cont creat. Verifica emailul pentru confirmare.')
    } catch (error: unknown) {
      setRegisterLoading(false)
      const message = (error as { message?: string })?.message || 'Eroare la creare cont.'
      setRegisterFeedback(message)
      toast.error(message)
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)

    const redirectTo = getOAuthRedirectUrl()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })

    if (error) {
      setGoogleLoading(false)
      toast.error(error.message)
    }
  }

  const loginBackgroundStyle = {
    '--landing-hero-start': 'var(--agri-primary)',
    '--landing-hero-end': '#2fa65e',
    '--landing-accent': '#F16B6B',
  } as CSSProperties

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[var(--landing-hero-start)] to-[var(--landing-hero-end)] p-4"
      style={loginBackgroundStyle}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-28 left-1/2 h-[440px] w-[440px] -translate-x-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 72%)' }}
        />
        <div
          className="absolute right-[-120px] top-10 h-[320px] w-[320px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(241,107,107,0.12) 0%, rgba(241,107,107,0) 72%)' }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/70 bg-white p-6 shadow-lg sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-[#312E3F]">Zmeurel OS</h1>
          <p className="mt-2 text-sm text-gray-500">Autentificare ți creare cont fermier</p>
        </div>

        {verificationPending ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Verificare email in asteptare. Deschide emailul de confirmare ți revino in aplicatie.
          </div>
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'login' | 'register')}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Creeaza cont</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-3 font-medium text-gray-700 hover:bg-gray-50"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.6C16.8 3 14.6 2 12 2 6.8 2 2.5 6.5 2.5 12S6.8 22 12 22c6.9 0 9.1-4.9 9.1-7.4 0-.5 0-.9-.1-1.3H12z"
                  />
                  <path fill="#34A853" d="M3.6 7.3l3.2 2.4c.9-2.6 3.3-4.4 6.2-4.4 1.9 0 3.1.8 3.8 1.5l2.6-2.6C16.8 3 14.6 2 12 2 8.4 2 5.2 4 3.6 7.3z" />
                  <path fill="#FBBC05" d="M12 22c2.5 0 4.7-.8 6.3-2.3l-2.9-2.4c-.8.6-1.8 1-3.4 1-3.9 0-5.3-2.5-5.6-3.8l-3.2 2.5C4.8 20 8.1 22 12 22z" />
                  <path fill="#4285F4" d="M21.1 12.8c0-.6 0-1-.2-1.5H12v3.9h5.5c-.2 1.1-1 2.7-2.6 3.7l2.9 2.4c1.7-1.5 3.3-4.4 3.3-8.5z" />
                </svg>
                {googleLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se redirectioneaza...
                  </>
                ) : (
                  'Continuă cu Google'
                )}
              </button>

              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-sm text-gray-400">sau</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Parola</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end">
                <Link
                  href="/reset-password-request"
                  className="text-sm font-medium text-emerald-700 hover:underline"
                >
                  Ai uitat parola??
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#F16B6B] text-white hover:bg-[#e05555]"
                disabled={loginLoading || googleLoading}
              >
                {loginLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se autentifica...
                  </>
                ) : (
                  'Intra in cont'
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register" className="mt-4">
            <form onSubmit={handleRegister} className="space-y-4">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-3 font-medium text-gray-700 hover:bg-gray-50"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.6C16.8 3 14.6 2 12 2 6.8 2 2.5 6.5 2.5 12S6.8 22 12 22c6.9 0 9.1-4.9 9.1-7.4 0-.5 0-.9-.1-1.3H12z"
                  />
                  <path fill="#34A853" d="M3.6 7.3l3.2 2.4c.9-2.6 3.3-4.4 6.2-4.4 1.9 0 3.1.8 3.8 1.5l2.6-2.6C16.8 3 14.6 2 12 2 8.4 2 5.2 4 3.6 7.3z" />
                  <path fill="#FBBC05" d="M12 22c2.5 0 4.7-.8 6.3-2.3l-2.9-2.4c-.8.6-1.8 1-3.4 1-3.9 0-5.3-2.5-5.6-3.8l-3.2 2.5C4.8 20 8.1 22 12 22z" />
                  <path fill="#4285F4" d="M21.1 12.8c0-.6 0-1-.2-1.5H12v3.9h5.5c-.2 1.1-1 2.7-2.6 3.7l2.9 2.4c1.7-1.5 3.3-4.4 3.3-8.5z" />
                </svg>
                {googleLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se redirectioneaza...
                  </>
                ) : (
                  'Continuă cu Google'
                )}
              </button>

              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-sm text-gray-400">sau</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

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
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-farm">Nume fermă</Label>
                <Input
                  id="register-farm"
                  type="text"
                  placeholder="Fermă Mea"
                  value={farmName}
                  onChange={(event) => setFarmName(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password">Parola</Label>
                <Input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minim 8 caractere"
                  value={registerPassword}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password-confirm">Confirmă parola</Label>
                <Input
                  id="register-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeta parola"
                  value={registerConfirmPassword}
                  onChange={(event) => setRegisterConfirmPassword(event.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[#F16B6B] text-white hover:bg-[#e05555]"
                disabled={registerLoading || googleLoading}
              >
                {registerLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se creeaza contul...
                  </>
                ) : (
                  'Creeaza cont'
                )}
              </Button>

              {registerFeedback ? (
                <p className={`text-sm ${verificationPending ? 'text-emerald-700' : 'text-red-600'}`}>
                  {registerFeedback}
                </p>
              ) : null}
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

