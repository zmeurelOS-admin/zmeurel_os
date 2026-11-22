'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'

import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { operatorTabs } from '@/lib/farm-members/nav'

type TabDef = {
  label: string
  href: string
  emoji: string
}

const TABS: TabDef[] = [
  { label: 'Acasă', href: '/dashboard', emoji: '🏡' },
  { label: 'Livrări', href: '/livrari', emoji: '🚚' },
  { label: 'Recoltări', href: '/recoltari', emoji: '🧺' },
  { label: 'Comenzi', href: '/comenzi', emoji: '📦' },
]

/** Fermieri și Setări sunt în „Mai mult” — 4 taburi egale pe mobil. */
const ASOCIATIE_TABS: TabDef[] = [
  { label: 'Panou', href: '/asociatie', emoji: '🏛' },
  { label: 'Produse', href: '/asociatie/produse', emoji: '🛒' },
  { label: 'Comenzi', href: '/asociatie/comenzi', emoji: '📋' },
  { label: 'Livrări', href: '/asociatie/livrari', emoji: '🚚' },
]

export function BottomTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { associationRole, memberRole, memberAccess } = useDashboardAuth()
  const isOperator = memberRole === 'operator'

  // „Mai mult” e o pagină (/mai-mult). Deschisă din bara asociației, păstrează bara asociației.
  const onMoreAssociation = pathname === '/mai-mult' && searchParams.get('spatiu') === 'asociatie'
  const inAssociationWorkspace = pathname.startsWith('/asociatie') || onMoreAssociation
  const showAssociationTabs = Boolean(associationRole) && inAssociationWorkspace
  // Operatorul: doar modulele lui (Citește / Scrie), cel mult 4, plus „Mai mult”. Proprietarul: bara de azi.
  const tabs = useMemo<TabDef[]>(() => {
    if (showAssociationTabs) return ASOCIATIE_TABS
    if (isOperator) return operatorTabs(memberAccess)
    return TABS
  }, [isOperator, memberAccess, showAssociationTabs])
  const moreHref = showAssociationTabs ? '/mai-mult?spatiu=asociatie' : '/mai-mult'

  useEffect(() => {
    if (isOperator) {
      // Rutele altor module l-ar trimite înapoi la primul modul permis: le încărcăm doar pe ale lui.
      for (const tab of tabs) router.prefetch(tab.href)
      router.prefetch('/mai-mult')
      return
    }
    router.prefetch('/dashboard')
    router.prefetch('/livrari')
    router.prefetch('/recoltari')
    router.prefetch('/comenzi')
    router.prefetch('/mai-mult')
    router.prefetch('/lucrari')
    router.prefetch('/asociatie')
    router.prefetch('/asociatie/produse')
    router.prefetch('/asociatie/comenzi')
    router.prefetch('/asociatie/livrari')
    router.prefetch('/asociatie/producatori')
    router.prefetch('/asociatie/setari')
  }, [isOperator, router, tabs])

  const isTabActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  // Tab-ul rămâne aprins pe Mai mult și pe paginile deschise de acolo care nu au tab propriu.
  const moreActive = pathname === '/mai-mult' || pathname.startsWith('/settings') || pathname.startsWith('/notificari')

  return (
    <nav
      className="border-t border-[var(--agri-border)] bg-[var(--agri-surface)] shadow-[0_-1px_3px_rgba(15,23,42,0.08)] z-nav dark:bg-[var(--agri-surface)] md:hidden"
      aria-label="Navigare principală"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        minHeight: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px))',
        paddingTop: 10,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
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
              <span style={{ fontSize: 22, opacity: active ? 1 : 0.3, lineHeight: 1.3 }}>{tab.emoji}</span>
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

        {/* Mai mult: pagină întreagă */}
        <Link
          href={moreHref}
          onTouchStart={() => router.prefetch(moreHref)}
          aria-label="Mai mult"
          aria-current={moreActive ? 'page' : undefined}
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
        </Link>
      </div>
    </nav>
  )
}
