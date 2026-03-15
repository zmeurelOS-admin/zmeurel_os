import type { Metadata } from 'next'
import Link from 'next/link'

import Footer from '@/components/landing/footer'
import { buildLoginUrl } from '@/lib/auth/redirects'

export const metadata: Metadata = {
  title: 'Politica de confidențialitate | Zmeurel OS',
}

export default function ConfidentialitatePage() {
  return (
    <main
      className="flex min-h-screen flex-col bg-[linear-gradient(180deg,#fffaf7_0%,#ffffff_100%)] text-[var(--agri-text)]"
      style={
        {
          '--landing-raspberry': '#F16B6B',
          '--landing-leaf': '#2F6F4E',
          '--landing-dark': '#312E3F',
        } as React.CSSProperties
      }
    >
      {/* Simple nav */}
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3 rounded-full border border-white/70 bg-white/78 px-3 py-2 shadow-[0_12px_32px_rgba(49,46,63,0.08)] backdrop-blur sm:px-5 sm:py-3">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--landing-dark)] sm:gap-3 sm:text-sm"
          >
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--landing-dark)] text-xs font-bold text-white shadow-lg sm:size-10 sm:text-sm">
              ZO
            </span>
            <span className="hidden sm:inline truncate">Zmeurel OS</span>
          </Link>
          <Link
            href={buildLoginUrl()}
            className="text-sm text-[color:var(--agri-text-muted)] transition-colors hover:text-[var(--landing-dark)]"
          >
            Login
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[28px] border border-[color:rgba(47,111,78,0.10)] bg-white/80 p-8 shadow-[0_16px_48px_rgba(49,46,63,0.07)] sm:p-12">
          <div className="space-y-3 text-center">
            <div className="text-4xl">🔒</div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--landing-dark)] sm:text-3xl">
              Politica de confidențialitate
            </h1>
            <p className="text-base leading-7 text-[color:var(--agri-text-muted)]">
              Pagina este în construcție. Ne cerem scuze pentru inconveniență.
            </p>
            <p className="text-sm text-[color:var(--agri-text-muted)]">
              Întrebări?{' '}
              <a
                href="mailto:contact@zmeurel.ro"
                className="font-medium text-[var(--landing-leaf)] underline-offset-2 hover:underline"
              >
                contact@zmeurel.ro
              </a>
            </p>
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--agri-text-muted)] transition-colors hover:text-[var(--landing-dark)]"
            >
              ← Înapoi la pagina principală
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  )
}
