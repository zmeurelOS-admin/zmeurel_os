'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { ClipboardList, LayoutDashboard, Leaf, MoreHorizontal, Plus, Receipt } from 'lucide-react'

import { MoreMenuDrawer } from '@/components/app/MoreMenuDrawer'
import { useAddAction } from '@/contexts/AddActionContext'

type Tab = {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
}

const DASHBOARD_TAB: Tab = { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }
const RECOLTARI_TAB: Tab = { label: 'Recoltari', href: '/recoltari', icon: Leaf }
const COMENZI_TAB: Tab = { label: 'Comenzi', href: '/comenzi', icon: ClipboardList }

const PRIMARY_HREFS = [DASHBOARD_TAB.href, RECOLTARI_TAB.href, COMENZI_TAB.href]

const quickActions: Array<{ label: string; href: string; icon: ComponentType<{ className?: string }> }> = [
  { label: 'Adauga recoltare', href: '/recoltari?add=1', icon: Leaf },
  { label: 'Adauga comanda', href: '/comenzi?add=1', icon: ClipboardList },
  { label: 'Adauga cheltuiala', href: '/cheltuieli?add=1', icon: Receipt },
]

type RouteAddConfig = {
  label: string
  href: string
}

function getRouteAddConfig(pathname: string): RouteAddConfig {
  if (pathname === '/dashboard') return { label: 'Adauga recoltare', href: '/recoltari?add=1' }
  if (pathname === '/recoltari' || pathname.startsWith('/recoltari/')) return { label: 'Adauga recoltare', href: '/recoltari?add=1' }
  if (pathname === '/comenzi' || pathname.startsWith('/comenzi/')) return { label: 'Adauga comanda', href: '/comenzi?add=1' }
  if (pathname === '/parcele' || pathname.startsWith('/parcele/')) return { label: 'Adauga parcela', href: '/parcele' }
  if (pathname === '/cheltuieli' || pathname.startsWith('/cheltuieli/')) return { label: 'Adauga cheltuiala', href: '/cheltuieli?add=1' }
  if (pathname === '/activitati-agricole' || pathname.startsWith('/activitati-agricole/')) return { label: 'Adauga activitate', href: '/activitati-agricole' }
  if (pathname === '/vanzari' || pathname.startsWith('/vanzari/')) return { label: 'Adauga vanzare', href: '/vanzari' }
  if (pathname === '/clienti' || pathname.startsWith('/clienti/')) return { label: 'Adauga client', href: '/clienti' }
  if (pathname === '/culegatori' || pathname.startsWith('/culegatori/')) return { label: 'Adauga culegator', href: '/culegatori' }
  if (pathname === '/stocuri' || pathname.startsWith('/stocuri/') || pathname === '/stoc' || pathname.startsWith('/stoc/')) {
    return { label: 'Adauga recoltare', href: '/recoltari?add=1' }
  }
  if (pathname === '/vanzari-butasi' || pathname.startsWith('/vanzari-butasi/')) {
    return { label: 'Adauga comanda butasi', href: '/vanzari-butasi' }
  }

  return { label: 'Adauga recoltare', href: '/recoltari?add=1' }
}

function TabLink({ tab, active, router }: { tab: Tab; active: boolean; router: ReturnType<typeof useRouter> }) {
  const Icon = tab.icon

  return (
    <Link
      href={tab.href}
      onTouchStart={() => {
        router.prefetch(tab.href)
      }}
      className="group relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-1"
    >
      <span className={`absolute top-1 h-1 w-8 rounded-full transition ${active ? 'bg-[var(--agri-primary)]' : 'bg-transparent'}`} />
      <Icon className={`h-5 w-5 ${active ? 'text-[var(--agri-primary)]' : 'text-[var(--agri-text-muted)]'}`} />
      <span className={`text-[11px] font-semibold ${active ? 'text-[var(--agri-primary)]' : 'text-[var(--agri-text-muted)]'}`}>{tab.label}</span>
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
        className="fixed inset-x-0 bottom-0 z-[100000080] border-t border-[var(--agri-border)] bg-white/95 backdrop-blur"
        style={{ paddingBottom: 'var(--safe-b)' }}
        aria-label="Navigare principala"
      >
        <div className="mx-auto grid h-[var(--tabbar-h)] w-full max-w-4xl grid-cols-5 gap-1 px-2">
          <TabLink tab={DASHBOARD_TAB} active={isTabActive(DASHBOARD_TAB.href)} router={router} />
          <TabLink tab={RECOLTARI_TAB} active={isTabActive(RECOLTARI_TAB.href)} router={router} />

          <div className="relative flex min-h-[56px] items-center justify-center">
            <button
              type="button"
              aria-label={centerLabel}
              title={centerLabel}
              className="absolute -top-5 inline-flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-amber-500 text-white shadow-xl transition hover:bg-amber-600 active:scale-95"
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
              <Plus className="h-6 w-6" />
            </button>
          </div>

          <TabLink tab={COMENZI_TAB} active={isTabActive(COMENZI_TAB.href)} router={router} />

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="group relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-1"
            aria-label="Mai multe module"
          >
            <span className={`absolute top-1 h-1 w-8 rounded-full transition ${moreActive ? 'bg-[var(--agri-primary)]' : 'bg-transparent'}`} />
            <MoreHorizontal className={`h-5 w-5 ${moreActive ? 'text-[var(--agri-primary)]' : 'text-[var(--agri-text-muted)]'}`} />
            <span className={`text-[11px] font-semibold ${moreActive ? 'text-[var(--agri-primary)]' : 'text-[var(--agri-text-muted)]'}`}>More</span>
          </button>
        </div>
      </nav>

      <MoreMenuDrawer open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}
