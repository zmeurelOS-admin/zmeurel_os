'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
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

/** Fermieri și Setări sunt în „Mai mult” — 4 taburi egale pe mobil. */
const ASOCIATIE_TABS: TabDef[] = [
  { label: 'Panou', href: '/asociatie', emoji: '🏛' },
  { label: 'Produse', href: '/asociatie/produse', emoji: '🛒' },
  { label: 'Comenzi', href: '/asociatie/comenzi', emoji: '📋' },
]

export function BottomTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { associationRole } = useDashboardAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const prevPathnameRef = useRef(pathname)

  const inAssociationWorkspace = pathname.startsWith('/asociatie')
  const tabs = useMemo(() => {
    if (associationRole && inAssociationWorkspace) {
      return ASOCIATIE_TABS
    }
    return TABS
  }, [associationRole, inAssociationWorkspace])

  useEffect(() => {
    router.prefetch('/dashboard')
    router.prefetch('/recoltari')
    router.prefetch('/comenzi')
    router.prefetch('/activitati-agricole')
    router.prefetch('/asociatie')
    router.prefetch('/asociatie/produse')
    router.prefetch('/asociatie/comenzi')
    router.prefetch('/asociatie/producatori')
    router.prefetch('/asociatie/setari')
  }, [router])

  // Închide meniul doar la schimbare reală de rută (nu la re-randări cu același pathname)
  useEffect(() => {
    if (prevPathnameRef.current === pathname) return
    prevPathnameRef.current = pathname
    setMoreOpen(false)
  }, [pathname])

  const isTabActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  // ••• is active only when the menu is explicitly open, not based on pathname
  const moreActive = moreOpen

  return (
    <>
      <nav
        className="border-t border-[var(--agri-border)] bg-[var(--agri-surface)] shadow-[0_-1px_3px_rgba(15,23,42,0.08)] dark:bg-[var(--agri-surface)] md:hidden"
        aria-label="Navigare principală"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          minHeight: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px))',
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
          {tabs.map((tab) => {
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
