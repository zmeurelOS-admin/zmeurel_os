'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { MoreMenuDrawer } from '@/components/app/MoreMenuDrawer'

type TabDef = {
  label: string
  href: string
  emoji: string
}

const TABS: TabDef[] = [
  { label: 'Acasă', href: '/dashboard', emoji: '🏡' },
  { label: 'Activități', href: '/activitati-agricole', emoji: '🌱' },
  { label: 'Recoltări', href: '/recoltari', emoji: '🧺' },
  { label: 'Comenzi', href: '/comenzi', emoji: '📦' },
]

export function BottomTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    router.prefetch('/dashboard')
    router.prefetch('/recoltari')
    router.prefetch('/comenzi')
    router.prefetch('/activitati-agricole')
  }, [router])

  // Close more menu when route changes (e.g. browser back, link tap)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (moreOpen) setMoreOpen(false) }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const isTabActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  // ••• is active only when the menu is explicitly open, not based on pathname
  const moreActive = moreOpen

  return (
    <>
      <nav
        className="border-t border-[var(--agri-border)] bg-[color:rgba(255,255,255,0.9)] shadow-[0_-1px_3px_rgba(0,0,0,0.1)] backdrop-blur-xl dark:bg-[color:rgba(15,23,42,0.9)] md:hidden"
        aria-label="Navigare principală"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          minHeight: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          paddingTop: 10,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          zIndex: 50,
        }}
      >
        <div
          style={{
            display: 'flex',
            width: '100%',
            maxWidth: 430,
            margin: '0 auto',
            justifyContent: 'space-around',
          }}
        >
          {TABS.map((tab) => {
            const active = isTabActive(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onTouchStart={() => router.prefetch(tab.href)}
                aria-current={active ? 'page' : undefined}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  padding: '4px 4px 6px',
                  textDecoration: 'none',
                }}
              >
                <span style={{ fontSize: 22, opacity: active ? 1 : 0.3, lineHeight: 1.3 }}>
                  {tab.emoji}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: active ? 'var(--agri-text)' : 'var(--agri-text-muted)',
                    lineHeight: 1.2,
                  }}
                >
                  {tab.label}
                </span>
                  <div
                  style={{
                    width: active ? 16 : 0,
                    height: 2.5,
                    background: 'var(--agri-primary)',
                    borderRadius: 1,
                    transition: 'width 0.15s ease',
                  }}
                />
              </Link>
            )
          })}

          {/* Mai mult */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Mai mult"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '4px 4px 6px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                fontSize: 16,
                opacity: moreActive ? 1 : 0.3,
                lineHeight: 1.3,
                letterSpacing: 1,
                color: 'var(--agri-text)',
              }}
            >
              •••
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: moreActive ? 'var(--agri-text)' : 'var(--agri-text-muted)',
                lineHeight: 1.2,
              }}
            >
              Mai mult
            </span>
            <div
              style={{
                width: moreActive ? 16 : 0,
                height: 2.5,
                background: 'var(--agri-primary)',
                borderRadius: 1,
                transition: 'width 0.15s ease',
              }}
            />
          </button>
        </div>
      </nav>

      <MoreMenuDrawer open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}
