'use client'

import { Loader2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  disableFarmSetupMode,
  enableDemoMode,
  markDemoSeedAttempted,
} from '@/lib/demo/onboarding-storage'
import {
  clearDemoTutorialPending,
  markDemoTutorialSeen,
} from '@/lib/demo/tutorial-storage'
import { toast } from '@/lib/ui/toast'

type DemoType = 'berries' | 'solar'
type PendingAction = DemoType | null

export default function StartOnboardingPage() {
  const router = useRouter()
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isBusy = pendingAction !== null

  const handleRetry = () => {
    if (isBusy) return
    setErrorMessage(null)
    router.refresh()
    window.location.reload()
  }

  const handleStartDemo = async (demoType: DemoType) => {
    if (isBusy) return

    setPendingAction(demoType)
    setErrorMessage(null)

    try {
      const response = await fetch('/api/demo/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo_type: demoType }),
      })
      const payload = (await response.json().catch(() => ({}))) as { status?: string; error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'Nu am putut încărca datele demo.')
      }

      if (payload.status !== 'seeded' && payload.status !== 'already_seeded') {
        throw new Error('Raspuns invalid de la seed demo.')
      }

      enableDemoMode()
      disableFarmSetupMode()
      markDemoSeedAttempted()
      clearDemoTutorialPending()
      markDemoTutorialSeen()
      router.replace('/dashboard')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nu am putut încărca datele demo.'
      setErrorMessage(message)
      toast.error(message)
    } finally {
      setPendingAction(null)
    }
  }

  const landingBackgroundStyle = {
    '--landing-accent': '#F16B6B',
    '--landing-hero-start': 'var(--agri-primary)',
    '--landing-hero-end': '#2fa65e',
    backgroundImage: 'linear-gradient(135deg, var(--landing-hero-start) 0%, var(--landing-hero-end) 100%)',
  } as CSSProperties

  return (
    <main className="relative min-h-screen overflow-hidden" style={landingBackgroundStyle}>
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-28 left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 72%)' }}
        />
        <div
          className="absolute right-[-120px] top-12 h-[320px] w-[320px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(241,107,107,0.12) 0%, rgba(241,107,107,0) 72%)' }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1000px] px-4 py-12 sm:px-6 sm:py-16">
        <section className="text-center">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-coral-light)] text-3xl shadow-sm">
            🌱
          </div>
          <h1 className="mt-5 text-3xl font-semibold text-white">Testează Zmeurel OS în modul demo</h1>
          <p className="mt-2 text-base text-emerald-50">
            Alege tipul fermei pentru a vedea cum funcționează aplicația
          </p>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <article className="agri-card flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold text-[var(--agri-text)]">🍓 Fructe de pădure / câmp</h2>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">Ideal pentru:</p>
            <p className="mt-1 text-sm text-[var(--agri-text-muted)]">zmeură, afine, mure, căpșuni</p>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">Demo include:</p>
            <ul className="mt-2 space-y-2 text-sm text-[var(--agri-text-muted)]">
              <li>- terenuri</li>
              <li>- recoltări</li>
              <li>- activități agricole</li>
              <li>- vânzări</li>
            </ul>

            <button
              type="button"
              onClick={() => handleStartDemo('berries')}
              disabled={isBusy}
              className="agri-control mt-6 h-11 rounded-xl bg-[var(--agri-primary)] px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="inline-flex items-center gap-2">
                {pendingAction === 'berries' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Pornește demo
              </span>
            </button>
          </article>

          <article className="agri-card flex h-full flex-col rounded-2xl border bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold text-[var(--agri-text)]">🍅 Legume în solarii</h2>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">Ideal pentru:</p>
            <p className="mt-1 text-sm text-[var(--agri-text-muted)]">roșii, castraveți, ardei</p>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">Demo include:</p>
            <ul className="mt-2 space-y-2 text-sm text-[var(--agri-text-muted)]">
              <li>- solarii</li>
              <li>- climat solar</li>
              <li>- etape cultură</li>
              <li>- activități solarii</li>
            </ul>

            <button
              type="button"
              onClick={() => handleStartDemo('solar')}
              disabled={isBusy}
              className="agri-control mt-6 h-11 rounded-xl bg-[var(--agri-primary)] px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <span className="inline-flex items-center gap-2">
                {pendingAction === 'solar' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Pornește demo
              </span>
            </button>
          </article>
        </section>

        {errorMessage ? (
          <div className="mt-4 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-[var(--agri-danger)]">{errorMessage}</p>
            <button
              type="button"
              onClick={handleRetry}
              disabled={isBusy}
              className="agri-control h-10 rounded-xl border border-white/60 bg-white px-4 text-sm font-semibold text-[var(--agri-text)] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Reîncearcă
            </button>
          </div>
        ) : null}
      </div>
    </main>
  )
}
