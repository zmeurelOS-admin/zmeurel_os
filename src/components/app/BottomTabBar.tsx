'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { ClipboardList, Leaf, Receipt } from 'lucide-react'

import { MoreMenuDrawer } from '@/components/app/MoreMenuDrawer'
import { useAddAction } from '@/contexts/AddActionContext'

type Tab = {
  label: string
  href: string
  icon: string
}

const DASHBOARD_TAB: Tab = { label: 'Dashboard', href: '/dashboard', icon: '📊' }
const RECOLTARI_TAB: Tab = { label: 'Recoltări', href: '/recoltari', icon: '🫐' }
const COMENZI_TAB: Tab = { label: 'Comenzi', href: '/comenzi', icon: '📦' }

const PRIMARY_HREFS = [DASHBOARD_TAB.href, RECOLTARI_TAB.href, COMENZI_TAB.href]

const quickActions: Array<{ label: string; href: string; icon: ComponentType<{ className?: string }> }> = [
  { label: 'Adaugă recoltare', href: '/recoltarișadd=1', icon: Leaf },
  { label: 'Adaugă comanda', href: '/comenzișadd=1', icon: ClipboardList },
  { label: 'Adaugă cheltuială', href: '/cheltuielișadd=1', icon: Receipt },
]

type RouteAddConfig = {
  label: string
  href: string
}

function getRouteAddConfig(pathname: string): RouteAddConfig {
  if (pathname === '/dashboard') return { label: 'Adaugă recoltare', href: '/recoltarișadd=1' }
  if (pathname === '/recoltari' || pathname.startsWith('/recoltari/')) return { label: 'Adaugă recoltare', href: '/recoltarișadd=1' }
  if (pathname === '/comenzi' || pathname.startsWith('/comenzi/')) return { label: 'Adaugă comanda', href: '/comenzișadd=1' }
  if (pathname === '/parcele' || pathname.startsWith('/parcele/')) return { label: 'Adaugă teren', href: '/parcele' }
  if (pathname === '/cheltuieli' || pathname.startsWith('/cheltuieli/')) return { label: 'Adaugă cheltuială', href: '/cheltuielișadd=1' }
  if (pathname === '/activitati-agricole' || pathname.startsWith('/activitati-agricole/')) return { label: 'Adaugă activitate', href: '/activitati-agricole' }
  if (pathname === '/vanzari' || pathname.startsWith('/vanzari/')) return { label: 'Adaugă vânzare', href: '/vanzari' }
  if (pathname === '/clienti' || pathname.startsWith('/clienti/')) return { label: 'Adaugă client', href: '/clienti' }
  if (pathname === '/culegatori' || pathname.startsWith('/culegatori/')) return { label: 'Adaugă culegator', href: '/culegatori' }
  if (pathname === '/stocuri' || pathname.startsWith('/stocuri/')) {
    return { label: 'Adaugă recoltare', href: '/recoltarișadd=1' }
  }
  if (pathname === '/vanzari-butasi' || pathname.startsWith('/vanzari-butasi/')) {
    return { label: 'Adaugă vanzare material saditor', href: '/vanzari-butasi' }
  }

  return { label: 'Adaugă recoltare', href: '/recoltarișadd=1' }
}

function TabLink({ tab, active, router }: { tab: Tab; active: boolean; router: ReturnType<typeof useRouter> }) {
  return (
    <Link
      href={tab.href}
      onTouchStart={() => {
        router.prefetch(tab.href)
      }}
      className="group relative flex min-h-[56px] flex-col items-center justify-center rounded-xl px-1 transition-transform duration-150 active:scale-95"
    >
      <span
        className="leading-none"
        style={{ opacity: active ? 1 : 0.5, fontSize: '20px' }}
      >
        {tab.icon}
      </span>
      <span
        style={{
          color: active ? '#2D6A4F' : '#95A5A6',
          fontWeight: active ? 700 : 500,
          fontSize: '10px',
          lineHeight: 1.2,
        }}
      >
        {tab.label}
      </span>
      {active ? <div style={{ width: '16px', height: '2px', background: '#2D6A4F', borderRadius: '1px', marginTop: '2px' }} /> : null}
    </Link>
  )
}

export function BottomTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { triggerAddAction } = useAddAction()
  const [moreOpen, setMoreOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggeredRef = useRef(false)
  const routeAddConfig = useMemo(() => getRouteAddConfig(pathname), [pathname])
  const centerLabel = routeAddConfig.label

  useEffect(() => {
    router.prefetch('/dashboard')
    router.prefetch('/recoltari')
    router.prefetch('/comenzi')
    router.prefetch('/cheltuieli')
  }, [router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuickAddOpen(false)
  }, [pathname])

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleCenterPointerDown = () => {
    longPressTriggeredRef.current = false
    clearLongPressTimer()
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      setQuickAddOpen(true)
    }, 450)
  }

  const handleCenterPointerUp = () => {
    clearLongPressTimer()
  }

  const handleCenterDefaultAction = () => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      return
    }
    setQuickAddOpen(false)
    const triggered = triggerAddAction()
    if (!triggered) {
      router.push(routeAddConfig.href)
    }
  }

  const handleQuickAction = (href: string) => {
    setQuickAddOpen(false)
    router.push(href)
  }

  const isTabActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const moreActive = !PRIMARY_HREFS.some((href) => isTabActive(href))

  return (
    <>
      {quickAddOpen ? (
        <>
          <button
            type="button"
            aria-label="Inchide meniul de adaugare rapida"
            onClick={() => setQuickAddOpen(false)}
            className="fixed inset-0 z-[100000060] bg-transparent"
          />
          <div className="fixed left-1/2 bottom-[calc(var(--tabbar-h)+var(--safe-b)+16px)] z-[100000070] w-[min(92vw,280px)] -translate-x-1/2 rounded-2xl border border-[var(--agri-border)] bg-white p-2 shadow-2xl">
            <div className="space-y-1">
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.href}
                    type="button"
                    className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-[var(--agri-text)] hover:bg-[var(--agri-surface-muted)]"
                    onClick={() => handleQuickAction(action.href)}
                  >
                    <Icon className="h-4 w-4 text-[var(--agri-primary)]" />
                    {action.label}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      ) : null}

      <nav
        className="fixed inset-x-0 bottom-0 z-[100000080]"
        style={{
          background: '#FFFFFF',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          paddingTop: '8px',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 26px)',
        }}
        aria-label="Navigare principala"
      >
        <div
          className="mx-auto w-full max-w-4xl px-2"
          style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}
        >
          <TabLink tab={DASHBOARD_TAB} active={isTabActive(DASHBOARD_TAB.href)} router={router} />
          <TabLink tab={RECOLTARI_TAB} active={isTabActive(RECOLTARI_TAB.href)} router={router} />

          <div className="flex min-h-[72px] items-center justify-center" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) * 0.15)' }}>
            <button
              type="button"
              aria-label={centerLabel}
              title={centerLabel}
              data-tutorial="quick-add-button"
              className="inline-flex h-20 w-20 items-center justify-center rounded-full text-white shadow-xl ring-4 ring-white transition-transform duration-150 active:scale-95"
              style={{
                marginTop: '-32px',
                background: 'linear-gradient(135deg, var(--agri-primary) 0%, #2fa65e 100%)',
                boxShadow: '0 14px 28px rgba(0,0,0,0.22), 0 8px 18px rgba(45,106,79,0.35)',
              }}
              onPointerDown={handleCenterPointerDown}
              onPointerUp={handleCenterPointerUp}
              onPointerLeave={handleCenterPointerUp}
              onPointerCancel={handleCenterPointerUp}
              onContextMenu={(event) => {
                event.preventDefault()
                setQuickAddOpen(true)
              }}
              onClick={handleCenterDefaultAction}
            >
              <span className="text-3xl font-bold leading-none text-white">+</span>
            </button>
          </div>

          <TabLink tab={COMENZI_TAB} active={isTabActive(COMENZI_TAB.href)} router={router} />

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="group relative flex min-h-[56px] flex-col items-center justify-center rounded-xl px-1 transition-transform duration-150 active:scale-95"
            aria-label="Mai multe module"
          >
            <span
              className="leading-none"
              style={{ opacity: moreActive ? 1 : 0.5, fontSize: '20px' }}
            >
              •••
            </span>
            <span
              style={{
                color: moreActive ? '#2D6A4F' : '#95A5A6',
                fontWeight: moreActive ? 700 : 500,
                fontSize: '10px',
                lineHeight: 1.2,
              }}
            >
              More
            </span>
            {moreActive ? <div style={{ width: '16px', height: '2px', background: '#2D6A4F', borderRadius: '1px', marginTop: '2px' }} /> : null}
          </button>
        </div>
      </nav>

      <MoreMenuDrawer open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}
