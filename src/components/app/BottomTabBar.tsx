'use client'

import { Ellipsis, LayoutDashboard, Leaf, ShoppingBag, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { MoreMenuDrawer } from '@/components/app/MoreMenuDrawer'
import { useAddAction } from '@/contexts/AddActionContext'

type Tab = {
  label: string
  href: string
  icon: LucideIcon
}

const DASHBOARD_TAB: Tab = { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }
const RECOLTARI_TAB: Tab = { label: 'Recoltari', href: '/recoltari', icon: Leaf }
const COMENZI_TAB: Tab = { label: 'Comenzi', href: '/comenzi', icon: ShoppingBag }

const PRIMARY_HREFS = [DASHBOARD_TAB.href, RECOLTARI_TAB.href, COMENZI_TAB.href]

type RouteAddConfig = {
  label: string
  href: string
}

function getRouteAddConfig(pathname: string): RouteAddConfig {
  if (pathname === '/dashboard') return { label: 'Adauga recoltare', href: '/recoltari?add=1' }
  if (pathname === '/recoltari' || pathname.startsWith('/recoltari/')) {
    return { label: 'Adauga recoltare', href: '/recoltari?add=1' }
  }
  if (pathname === '/comenzi' || pathname.startsWith('/comenzi/')) {
    return { label: 'Adauga comanda', href: '/comenzi?add=1' }
  }
  if (pathname === '/parcele' || pathname.startsWith('/parcele/')) {
    return { label: 'Adauga teren', href: '/parcele' }
  }
  if (pathname === '/cheltuieli' || pathname.startsWith('/cheltuieli/')) {
    return { label: 'Adauga cheltuiala', href: '/cheltuieli?add=1' }
  }
  if (pathname === '/activitati-agricole' || pathname.startsWith('/activitati-agricole/')) {
    return { label: 'Adauga activitate', href: '/activitati-agricole' }
  }
  if (pathname === '/vanzari' || pathname.startsWith('/vanzari/')) {
    return { label: 'Adauga vanzare', href: '/vanzari' }
  }
  if (pathname === '/clienti' || pathname.startsWith('/clienti/')) {
    return { label: 'Adauga client', href: '/clienti' }
  }
  if (pathname === '/culegatori' || pathname.startsWith('/culegatori/')) {
    return { label: 'Adauga culegator', href: '/culegatori' }
  }
  if (pathname === '/vanzari-butasi' || pathname.startsWith('/vanzari-butasi/')) {
    return { label: 'Adauga vanzare', href: '/vanzari-butasi' }
  }

  return { label: 'Adauga recoltare', href: '/recoltari?add=1' }
}

function TabLink({
  tab,
  active,
  router,
}: {
  tab: Tab
  active: boolean
  router: ReturnType<typeof useRouter>
}) {
  const Icon = tab.icon

  return (
    <Link
      href={tab.href}
      onTouchStart={() => {
        router.prefetch(tab.href)
      }}
      className="group flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-center transition-transform duration-150 active:scale-95"
      aria-current={active ? 'page' : undefined}
    >
      <Icon
        className="h-5 w-5"
        strokeWidth={2.2}
        style={{ opacity: active ? 1 : 0.58, color: active ? '#1f7a4e' : '#8aa096' }}
      />
      <span
        className="text-[10px] font-medium leading-none"
        style={{ color: active ? '#1f7a4e' : '#8aa096', fontWeight: active ? 700 : 500 }}
      >
        {tab.label}
      </span>
      <span className={`h-1 rounded-full transition-all ${active ? 'w-4 bg-emerald-700/90' : 'w-1 bg-transparent'}`} />
    </Link>
  )
}

export function BottomTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { triggerAddAction } = useAddAction()
  const [moreOpen, setMoreOpen] = useState(false)
  const routeAddConfig = useMemo(() => getRouteAddConfig(pathname), [pathname])

  useEffect(() => {
    router.prefetch('/dashboard')
    router.prefetch('/recoltari')
    router.prefetch('/comenzi')
  }, [router])

  const handleCenterAction = () => {
    const triggered = triggerAddAction()
    if (!triggered) {
      router.push(routeAddConfig.href)
    }
  }

  const isTabActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const moreActive = !PRIMARY_HREFS.some((href) => isTabActive(href))

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-[50] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2 lg:hidden"
        aria-label="Navigare principala"
      >
        <div className="mx-auto grid h-[76px] w-full max-w-md grid-cols-5 items-center rounded-[28px] border border-emerald-950/8 bg-white/96 px-2 shadow-[0_-8px_30px_rgba(17,24,39,0.09)] backdrop-blur">
          <TabLink tab={DASHBOARD_TAB} active={isTabActive(DASHBOARD_TAB.href)} router={router} />
          <TabLink tab={RECOLTARI_TAB} active={isTabActive(RECOLTARI_TAB.href)} router={router} />

          <div className="relative flex h-full items-center justify-center">
            <button
              type="button"
              aria-label={routeAddConfig.label}
              title={routeAddConfig.label}
              data-tutorial="quick-add-button"
              data-mobile-fab="true"
              className="absolute left-1/2 top-0 z-[100] inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/85 bg-[linear-gradient(180deg,#34b56a_0%,#1f8d4e_100%)] text-white ring-1 ring-emerald-900/8 transition-[opacity,box-shadow,transform] duration-150 active:scale-95"
              style={{ boxShadow: '0 16px 34px rgba(31,141,78,0.34), 0 0 0 6px rgba(52,181,106,0.10)' }}
              onClick={handleCenterAction}
            >
              <span className="text-[34px] font-semibold leading-none">+</span>
            </button>
          </div>

          <TabLink tab={COMENZI_TAB} active={isTabActive(COMENZI_TAB.href)} router={router} />

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="group flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-center transition-transform duration-150 active:scale-95"
            aria-label="Mai mult"
          >
            <Ellipsis
              className="h-5 w-5"
              strokeWidth={2.2}
              style={{ opacity: moreActive ? 1 : 0.58, color: moreActive ? '#1f7a4e' : '#8aa096' }}
            />
            <span
              className="text-[10px] font-medium leading-none"
              style={{ color: moreActive ? '#1f7a4e' : '#8aa096', fontWeight: moreActive ? 700 : 500 }}
            >
              Mai mult
            </span>
            <span className={`h-1 rounded-full transition-all ${moreActive ? 'w-4 bg-emerald-700/90' : 'w-1 bg-transparent'}`} />
          </button>
        </div>
      </nav>

      <MoreMenuDrawer open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}
