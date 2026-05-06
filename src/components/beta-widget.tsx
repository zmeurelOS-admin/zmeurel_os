'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, X } from 'lucide-react'

const SESSION_KEY = 'zmeurel_beta_sessions'
const LAST_SESSION_KEY = 'zmeurel_beta_last_session'
const DISMISSED_KEY = 'zmeurel_beta_dismissed'
const SESSION_GAP_MS = 30 * 60 * 1000
const WHATSAPP_URL =
  'https://wa.me/40752953048?text=Salut%20Andrei%2C%20am%20o%20sugestie%20pentru%20Zmeurel%20OS'

function readNumber(value: string | null) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function readBoolean(value: string | null) {
  return value === 'true' || value === '1'
}

export default function BetaWidget() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [isMountedVisible, setIsMountedVisible] = useState(false)
  const [pulseRing, setPulseRing] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const now = Date.now()
      const lastSession = readNumber(window.localStorage.getItem(LAST_SESSION_KEY))
      const storedSessions = readNumber(window.localStorage.getItem(SESSION_KEY))
      const dismissed = readBoolean(window.localStorage.getItem(DISMISSED_KEY))
      const isNewSession = !lastSession || now - lastSession >= SESSION_GAP_MS
      const nextSessions = isNewSession ? storedSessions + 1 : Math.max(storedSessions, 1)
      const sessions = Math.max(nextSessions, 1)

      if (isNewSession) {
        window.localStorage.setItem(SESSION_KEY, String(sessions))
        window.localStorage.setItem(LAST_SESSION_KEY, String(now))
        window.localStorage.removeItem(DISMISSED_KEY)
      } else {
        window.localStorage.setItem(SESSION_KEY, String(sessions))
      }

      const shouldStartExpanded = sessions <= 5 && !dismissed
      setIsExpanded(shouldStartExpanded)
      setIsMountedVisible(true)

      if (!shouldStartExpanded) {
        setPulseRing(true)
        window.setTimeout(() => setPulseRing(false), 700)
      }
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [])

  const showExpanded = isExpanded

  return (
    <>
      <div
        className="beta-widget print:hidden"
        aria-live="polite"
        style={{
          position: 'fixed',
          left: '1rem',
          bottom: 'calc(var(--tabbar-h) + var(--safe-b) + 8px)',
          zIndex: 40,
        }}
      >
        <div
          className="transition-all duration-300 ease-out"
          style={{
            opacity: isMountedVisible ? 1 : 0,
            transform: isMountedVisible
              ? 'translateY(0) scale(1)'
              : 'translateY(8px) scale(0.98)',
          }}
        >
          {showExpanded ? (
            <div className="relative w-[260px] rounded-2xl border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800 md:shadow-xl">
              <button
                type="button"
                className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D7A5F] focus-visible:ring-offset-2 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                onClick={() => {
                  window.localStorage.setItem(DISMISSED_KEY, 'true')
                  setIsExpanded(false)
                }}
                aria-label="Ascunde widgetul beta"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5EE] px-2.5 py-1 text-xs font-semibold text-[#3D7A5F] dark:bg-[#3D7A5F]/20 dark:text-emerald-400">
                <span>🧪</span>
                <span>Ești în beta</span>
              </div>

              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Ai o problemă sau o sugestie?</p>

              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1ebc5a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D7A5F] focus-visible:ring-offset-2"
              >
                <MessageCircle className="h-4 w-4" />
                Scrie-mi pe WhatsApp
              </a>
            </div>
          ) : (
            <button
              type="button"
              title="Beta — scrie-mi pe WhatsApp"
              aria-label="Beta — scrie-mi pe WhatsApp"
              onClick={() => {
                setIsExpanded(true)
              }}
              className={[
                'relative flex h-10 w-10 items-center justify-center rounded-full bg-[#3D7A5F] text-white shadow-md transition-all duration-150 hover:bg-[#1f4a37] hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D7A5F] focus-visible:ring-offset-2',
                pulseRing ? 'animate-[pulse-ring_700ms_ease-out_1]' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <MessageCircle className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse-ring {
          0% {
            box-shadow: 0 0 0 0 rgba(61, 122, 95, 0.4);
          }
          100% {
            box-shadow: 0 0 0 12px rgba(61, 122, 95, 0);
          }
        }

        @media print {
          .beta-widget {
            display: none !important;
          }
        }

        @media (min-width: 768px) {
          .beta-widget {
            left: 1.5rem !important;
            bottom: 1.5rem !important;
          }
        }
      `}</style>
    </>
  )
}
