'use client'

import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { buildAuthCallbackUrl, buildLoginUrl } from '@/lib/auth/redirects'
import {
  disableFarmSetupMode,
  enableDemoMode,
  markDemoSeedAttempted,
} from '@/lib/demo/onboarding-storage'
import { getSupabase } from '@/lib/supabase/client'
import { toast } from '@/lib/ui/toast'
import { track } from '@/lib/analytics/track'

type PendingAction = 'demo' | 'google' | null
type AuthState = 'loading' | 'guest' | 'user'
type DemoType = 'berries' | 'solar' | 'orchard' | 'fieldcrop'
type Step = 'auth' | 'farm-type'

const FARM_TYPE_OPTIONS: Array<{
  type: DemoType
  emoji: string
  title: string
  description: string
  tags: string[]
}> = [
  {
    type: 'berries',
    emoji: '🫐',
    title: 'Fructe de pădure',
    description: 'Fermă demo cu zmeură, mur, afin și căpșuni. Culegători, recoltări și vânzări incluse.',
    tags: ['Zmeură', 'Mur', 'Afin', 'Căpșuni'],
  },
  {
    type: 'solar',
    emoji: '🏠',
    title: 'Solarii',
    description: 'Fermă demo cu sere și solarii. Roșii, castraveți și ardei, cu stoc și comenzi.',
    tags: ['Roșii', 'Castraveți', 'Ardei'],
  },
  {
    type: 'orchard',
    emoji: '🌳',
    title: 'Livezi',
    description: 'Model demo de livadă cu meri, pruni și cireși, cu activități sezoniere și vânzări.',
    tags: ['Meri', 'Pruni', 'Cireși'],
  },
  {
    type: 'fieldcrop',
    emoji: '🌾',
    title: 'Cultură mare',
    description: 'Scenariu de cultură mare cu grâu, porumb și floarea-soarelui, costuri mari și cicluri mecanizate.',
    tags: ['Grâu', 'Porumb', 'Floarea-soarelui'],
  },
]

const cardClassName =
  'rounded-2xl border border-border bg-white p-6 shadow-sm dark:bg-slate-800 sm:p-6'

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

export default function StartOnboardingPage() {
  const router = useRouter()
  const supabase = useMemo(() => getSupabase(), [])
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('auth')
  const [chosenDemoType, setChosenDemoType] = useState<DemoType | null>(null)

  const isBusy = pendingAction !== null

  useEffect(() => {
    let mounted = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      const hasSession = Boolean(data.session)
      setAuthState(hasSession ? 'user' : 'guest')
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      setAuthState(session ? 'user' : 'guest')
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  useEffect(() => {
    if (authState !== 'user') return
    if (pendingAction !== null) return
    router.replace('/dashboard')
  }, [authState, pendingAction, router])

  const handleRetry = () => {
    if (isBusy) return
    setErrorMessage(null)
    setChosenDemoType(null)
  }

  const handleGoogleStart = async () => {
    if (isBusy) return
    setPendingAction('google')
    setErrorMessage(null)

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: buildAuthCallbackUrl('/dashboard', window.location.origin),
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
      setPendingAction(null)
      const message =
        error instanceof Error ? error.message : 'Nu am putut porni autentificarea cu Google.'
      setErrorMessage(message)
      toast.error(message)
    }
  }

  const handleStartDemo = async (demoType: DemoType) => {
    if (isBusy) return

    setPendingAction('demo')
    setErrorMessage(null)

    try {
      if (authState === 'user') {
        router.replace('/dashboard')
        return
      }

      const guestResponse = await fetch('/api/auth/beta-guest', {
        method: 'POST',
      })
      const guestPayload = (await guestResponse.json().catch(() => ({}))) as {
        ok?: boolean
        email?: string
        accessToken?: string
        refreshToken?: string
        error?: string | { message?: string }
      }

      if (!guestResponse.ok || guestPayload.ok === false || !guestPayload.accessToken || !guestPayload.refreshToken) {
        const message =
          typeof guestPayload.error === 'string'
            ? guestPayload.error
            : guestPayload.error?.message || 'Nu am putut porni demo-ul.'
        throw new Error(message)
      }

      const { error: guestLoginError } = await supabase.auth.setSession({
        access_token: guestPayload.accessToken,
        refresh_token: guestPayload.refreshToken,
      })

      if (guestLoginError) {
        throw guestLoginError
      }

      const response = await fetch('/api/demo/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo_type: demoType }),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean
        status?: string
        inserted?: Record<string, number>
        errors?: Array<{ table?: string; error?: string; message?: string; details?: string; hint?: string; code?: string }>
        error?: string | { message?: string }
      }

      console.info('Demo seed response:', JSON.stringify({
        status: payload.status,
        inserted: payload.inserted,
        errors: payload.errors?.length ?? 0,
      }))

      if (!response.ok || payload.success === false) {
        if (payload.errors?.length) {
          console.error('Demo seed errors:', JSON.stringify(payload.errors))
        }
        const tableList =
          payload.errors
            ?.map((e) =>
              [e.table, e.message || e.error].filter(Boolean).join(': ')
            )
            .filter(Boolean)
            .join('; ') ?? ''
        const firstError = payload.errors?.[0]
        const message = tableList
          ? `Eroare seed — tabele: ${tableList}`
          : firstError?.table && (firstError.error || firstError.message)
            ? `Eroare seed: ${firstError.table} — ${firstError.error || firstError.message}`
            : typeof payload.error === 'string'
              ? payload.error
              : payload.error?.message || 'Nu am putut încărca datele demo.'
        throw new Error(message)
      }

      if (payload.status !== 'seeded') {
        throw new Error('Demo-ul nu a fost inițializat complet.')
      }

      if ((payload.inserted?.parcele ?? 0) <= 0) {
        console.error('Demo seed inserted zero parcele:', JSON.stringify(payload))
        throw new Error('Demo-ul a pornit incomplet: nu s-au creat parcelele.')
      }

      if (
        demoType === 'berries' &&
        (payload.inserted?.parcele ?? 0) < 6
      ) {
        console.error('Demo seed inserted fewer berries parcels than expected:', JSON.stringify(payload))
        throw new Error('Demo-ul berries a pornit incomplet: parcelele lipsesc.')
      }

      if (
        demoType === 'berries' &&
        (payload.inserted?.recoltari ?? 0) < 15
      ) {
        console.error('Demo seed inserted fewer berries harvests than expected:', JSON.stringify(payload))
        throw new Error('Demo-ul berries a pornit incomplet: recoltările lipsesc.')
      }

      if (
        demoType === 'berries' &&
        (payload.inserted?.comenzi ?? 0) < 12
      ) {
        console.error('Demo seed inserted fewer berries orders than expected:', JSON.stringify(payload))
        throw new Error('Demo-ul berries a pornit incomplet: comenzile lipsesc.')
      }

      enableDemoMode()
      disableFarmSetupMode()
      markDemoSeedAttempted()
      track('demo_started', { demo_type: demoType })
      router.replace('/dashboard')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nu am putut încărca datele demo.'
      setChosenDemoType(null)
      setErrorMessage(message)
      toast.error(message)
      setPendingAction(null)
    }
  }

  const handleChooseFarmType = (demoType: DemoType) => {
    setChosenDemoType(demoType)
    void handleStartDemo(demoType)
  }

  if (step === 'farm-type') {
    return (
      <main className="min-h-screen bg-[var(--agri-bg)] px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl items-center">
          <div className="mx-auto w-full max-w-2xl space-y-5">
            <div className="space-y-2 text-center">
              <Image src="/icons/icon.svg" alt="Zmeurel OS" width={48} height={48} className="mx-auto" />
              <div>
                <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--agri-text)]">
                  Ce tip de fermă vrei să explorezi?
                </h1>
                <p className="mt-1 text-sm text-[var(--agri-text-muted)]">
                  Alege un demo presetat. Îl poți reseta oricând din setări.
                </p>
              </div>
            </div>

            <div className="grid items-stretch gap-4 sm:grid-cols-2">
              {FARM_TYPE_OPTIONS.map((option) => {
                const isSelected = chosenDemoType === option.type
                const isLoading = isSelected && pendingAction === 'demo'
                return (
                  <button
                    key={option.type}
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => handleChooseFarmType(option.type)}
                    className="flex min-h-[260px] flex-col items-start gap-4 rounded-2xl border border-border bg-white p-6 text-left shadow-sm transition-all hover:border-emerald-300 hover:shadow-md dark:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:p-8"
                  >
                    <span className="text-5xl">{isLoading ? '⏳' : option.emoji}</span>
                    <div className="space-y-2">
                      <p className="text-xl font-semibold text-foreground">
                        {isLoading ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Se pregătește...
                          </span>
                        ) : option.title}
                      </p>
                      <p className="text-base text-muted-foreground">{option.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {option.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>

            <Button
              type="button"
              variant="ghost"
              className="h-10 w-full rounded-xl text-foreground hover:bg-[var(--agri-surface-muted)]"
              disabled={isBusy}
              onClick={() => setStep('auth')}
            >
              ← Înapoi
            </Button>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <div>{errorMessage}</div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRetry}
                  disabled={isBusy}
                  className="mt-3 h-9 rounded-xl border-red-200 bg-white text-red-700 hover:bg-red-100"
                >
                  Încearcă din nou
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--agri-bg)] px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl items-center">
        <div className="mx-auto w-full max-w-[420px] space-y-4">
          <div className="space-y-2 text-center">
            <Image src="/icons/icon.svg" alt="Zmeurel OS" width={48} height={48} className="mx-auto" />
            <div>
              <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[var(--agri-text)]">
                Intră în aplicație
              </h1>
              <p className="mt-1 text-sm text-[var(--agri-text-muted)]">
                Intri rapid cu Google, cu email sau direct într-o fermă demo.
              </p>
            </div>
          </div>

          <section className={cardClassName}>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">Începe în mai puțin de 5 secunde</h2>
              <p className="text-sm text-muted-foreground">
                Pentru beta nu cerem confirmare pe email. După autentificare intri direct în dashboard.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <Button
                type="button"
                className="h-11 w-full rounded-xl bg-[var(--agri-primary)] text-white hover:bg-emerald-700"
                onClick={handleGoogleStart}
                disabled={authState === 'loading' || isBusy}
              >
                {pendingAction === 'google' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Se redirecționează...
                  </>
                ) : (
                  <>
                    <GoogleMark />
                    Continuă cu Google
                  </>
                )}
              </Button>

              <Button
                asChild
                variant="outline"
                className="h-11 w-full rounded-xl border border-border bg-white text-foreground hover:bg-[var(--agri-surface-muted)] dark:bg-slate-800"
              >
                <Link href={buildLoginUrl({ mode: 'register', next: '/dashboard' })}>Continuă cu email</Link>
              </Button>

              <SectionDivider />

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl border border-border bg-white text-foreground hover:bg-[var(--agri-surface-muted)] dark:bg-slate-800"
                onClick={() => {
                  if (authState === 'user') {
                    router.replace('/dashboard')
                    return
                  }
                  setErrorMessage(null)
                  setStep('farm-type')
                }}
                disabled={authState === 'loading' || isBusy}
              >
                Continuă fără cont
              </Button>

              <Button asChild variant="ghost" className="h-10 w-full rounded-xl text-foreground hover:bg-[var(--agri-surface-muted)]">
                <Link href={buildLoginUrl({ next: '/dashboard' })}>Am deja cont</Link>
              </Button>
            </div>
          </section>

          <section className={cardClassName}>
            <h2 className="text-sm font-semibold text-foreground">Ce primești în demo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ferma demo pornește cu parcele, recoltări, stoc, vânzări și culegători, într-un tenant separat și resetabil.
            </p>
          </section>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div>{errorMessage}</div>
              <Button
                type="button"
                variant="outline"
                onClick={handleRetry}
                disabled={isBusy}
                className="mt-3 h-9 rounded-xl border-red-200 bg-white text-red-700 hover:bg-red-100"
              >
                Încearcă din nou
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}
