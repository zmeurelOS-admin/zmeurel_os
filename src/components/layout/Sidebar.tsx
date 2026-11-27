'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'

import { AssociationContextSwitcher } from '@/components/association/AssociationContextSwitcher'
import { AssociationSidebar } from '@/components/association/AssociationSidebar'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { ICONITE_MENIU } from '@/components/app/navigatie-iconite'
import { UserProfileMenu } from '@/components/app/UserProfileMenu'
import { LogoCuNume } from '@/components/brand/LogoCuNume'
import { kitFocus, kitText } from '@/components/kit'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useDemoBannerVisible } from '@/hooks/useDemoBannerVisible'
import { APP_NAME } from '@/lib/brand'
import { ASOCIATIE, grupuriMeniu, hrefActiv, meniuAdmin, meniuFinal, meniuPrincipal, type IntrareMeniu } from '@/lib/navigatie/meniu'
import { useShopOrdersInLivrareCount, ShopOrdersInLivrareNavBadge } from '@/lib/shop/useShopOrdersInLivrareCount'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'sidebar-collapsed'
const EXPANDED_WIDTH = 240
const COLLAPSED_WIDTH = 64
const DEMO_BANNER_HEIGHT = 48

/** Rândul vechi al zonei asociației (`AssociationSidebar`): emoji + nume. */
export type SidebarNavItem = {
  href: string
  label: string
  emoji: string
  /** Activ doar la potrivire exactă (ex. hub fără sub-rute). */
  exact?: boolean
  /** Prefixe suplimentare care marchează itemul ca activ. */
  activePrefixes?: string[]
}

function isActiveHref(href: string, pathname: string, searchString: string, hash: string, exactPath = false) {
  const [beforeHash, hashPart = ''] = href.split('#')
  const [base, search = ''] = beforeHash.split('?')
  const pathNorm = pathname.replace(/\/$/, '') || '/'
  const baseNorm = base.replace(/\/$/, '') || '/'
  if (exactPath ? pathNorm !== baseNorm : !pathname.startsWith(base)) return false
  if (search && search !== searchString) return false
  if (hashPart && `#${hashPart}` !== hash) return false
  return true
}

export function isNavItemActive(item: SidebarNavItem, pathname: string, searchString: string, hash: string) {
  if (item.activePrefixes?.some((prefix) => pathname.startsWith(prefix))) return true
  return isActiveHref(item.href, pathname, searchString, hash, item.exact === true)
}

type SidebarLinkProps = {
  href: string
  label: string
  emoji?: string
  icon?: ReactNode
  collapsed: boolean
  active: boolean
  extern?: boolean
  onNavigate?: () => void
  badge?: ReactNode
}

/** Un rând al barei laterale (folosit și de zona asociației). */
export function SidebarLink({ href, label, emoji, icon, collapsed, active, extern, onNavigate, badge }: SidebarLinkProps) {
  const continut = (
    <>
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-control [&_svg]:size-5',
          active ? 'bg-primary text-primary-contrast' : 'text-fg-muted',
        )}
        aria-hidden
      >
        {icon ?? <span className="text-[19px] leading-none">{emoji}</span>}
      </span>
      {collapsed ? null : (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 break-words">{label}</span>
          {badge ? <span className="shrink-0">{badge}</span> : null}
          {extern ? <ExternalLink className="ml-auto size-4 shrink-0 text-fg-subtle" aria-hidden /> : null}
        </span>
      )}
    </>
  )
  const className = cn(
    'flex min-h-touch items-center rounded-control font-semibold transition-colors',
    collapsed ? 'justify-center px-1' : 'gap-2.5 px-2 py-1',
    active ? 'bg-primary-soft text-fg' : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
    kitText.secondary,
    kitFocus,
  )
  if (extern) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={collapsed ? label : undefined} className={className}>
        {continut}
      </a>
    )
  }
  return (
    <Link href={href} aria-current={active ? 'page' : undefined} aria-label={label} title={collapsed ? label : undefined} onClick={onNavigate} className={className}>
      {continut}
    </Link>
  )
}

function Grup({ titlu, separat = false, collapsed, children }: { titlu?: string; separat?: boolean; collapsed: boolean; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      {titlu && !collapsed ? <h2 className={cn('px-2 pb-1 pt-3 font-bold text-fg-subtle', kitText.helper)}>{titlu}</h2> : null}
      {(titlu && collapsed) || separat ? <div className="mx-2 my-2 h-px bg-border" aria-hidden /> : null}
      {children}
    </div>
  )
}

/**
 * Bara laterală de pe desktop (promptul 34, §10): aceeași navigație și aceleași nume ca pe telefon — Acasă · Livrări ·
 * Recoltări · Comenzi, apoi rândurile din „Mai mult” (`src/lib/navigatie/meniu.ts`). Sus logo-ul „Caietul Fermei” și
 * clopoțelul, jos contul. În zona asociației (`/asociatie/*`), lista asociației.
 */
export function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isSuperAdmin, associationRole, memberRole, memberAccess } = useDashboardAuth()
  const bannerVisible = useDemoBannerVisible()
  const [collapsed, setCollapsed] = useState(false)
  const [hash, setHash] = useState('')
  const { data: shopInLivrareCount = 0 } = useShopOrdersInLivrareCount()

  const searchString = searchParams.toString()
  const inAssociationWorkspace = pathname.startsWith('/asociatie')
  const ctx = useMemo(() => ({ memberRole, memberAccess, isSuperAdmin, associationRole }), [associationRole, isSuperAdmin, memberAccess, memberRole])
  const operator = memberRole === 'operator'

  const principale = useMemo(() => meniuPrincipal(ctx), [ctx])
  const grupuri = useMemo(() => {
    // Operatorul are în bara de jos (și aici, sus) modulele lui; nu le repetăm în grupuri.
    const sus = new Set(principale.map((intrare) => intrare.href))
    return grupuriMeniu(ctx)
      .map((grup) => ({ ...grup, intrari: grup.intrari.filter((intrare) => !sus.has(intrare.href)) }))
      .filter((grup) => grup.intrari.length > 0)
  }, [ctx, principale])
  const admin = useMemo(() => meniuAdmin(ctx), [ctx])
  const final = useMemo<IntrareMeniu[]>(() => {
    const randuri = meniuFinal(ctx)
    // Operatorul nu are Setări; „Mai mult” îi dă notificările și ieșirea din cont, ca pe telefon.
    return operator ? [{ href: '/mai-mult', label: 'Mai mult', iconita: 'mai-mult', ton: 'neutral' }, ...randuri] : randuri
  }, [ctx, operator])

  const toateHref = useMemo(
    () => [...principale, ...grupuri.flatMap((grup) => grup.intrari), ...admin, ...final, ASOCIATIE].map((intrare) => intrare.href),
    [admin, final, grupuri, principale],
  )
  const activ = hrefActiv(pathname, toateHref, searchString)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1')
      } catch {
        setCollapsed(false)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      // Fără acces la stocare: rămâne lățimea din sesiune.
    }
    document.documentElement.style.setProperty('--sidebar-width', `${collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH}px`)
  }, [collapsed])

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash || '')
    updateHash()
    window.addEventListener('hashchange', updateHash)
    return () => window.removeEventListener('hashchange', updateHash)
  }, [])

  const bannerOffset = bannerVisible ? DEMO_BANNER_HEIGHT : 0
  const rand = (intrare: IntrareMeniu) => (
    <SidebarLink
      key={intrare.href}
      href={intrare.href}
      label={intrare.label}
      icon={ICONITE_MENIU[intrare.iconita]}
      collapsed={collapsed}
      active={activ === intrare.href}
      extern={intrare.extern}
      badge={intrare.href === '/livrari' && shopInLivrareCount > 0 ? <ShopOrdersInLivrareNavBadge count={shopInLivrareCount} /> : undefined}
    />
  )

  return (
    <aside
      className="fixed left-0 top-0 z-nav hidden border-r border-border bg-surface text-fg transition-[width] duration-300 ease-in-out md:flex"
      style={{ top: bannerOffset, height: `calc(100vh - ${bannerOffset}px)`, width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      aria-label="Navigare desktop"
    >
      <div className="flex h-full w-full flex-col">
        <div className={cn('flex items-center gap-2 border-b border-border py-3', collapsed ? 'flex-col px-2' : 'px-3')}>
          <Link href="/dashboard" aria-label={`${APP_NAME}: Acasă`} className={cn('min-w-0 flex-1 rounded-control py-1', kitFocus)}>
            {collapsed ? (
              <Image src="/icons/icon.svg" alt={APP_NAME} width={40} height={40} className="mx-auto size-10" />
            ) : (
              <LogoCuNume className="h-10" />
            )}
          </Link>
          <NotificationBell deschidere="dreapta" />
        </div>

        {associationRole ? (
          <div className={cn('border-b border-border px-2 py-2', collapsed && 'px-1.5')}>
            <AssociationContextSwitcher collapsed={collapsed} />
          </div>
        ) : null}

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2" aria-label="Module">
          {inAssociationWorkspace ? (
            <AssociationSidebar collapsed={collapsed} pathname={pathname} searchString={searchString} hash={hash} />
          ) : (
            <>
              <Grup collapsed={collapsed}>{principale.map(rand)}</Grup>
              {associationRole ? <Grup collapsed={collapsed}>{rand(ASOCIATIE)}</Grup> : null}
              {grupuri.map((grup) => (
                <Grup key={grup.titlu} titlu={grup.titlu} collapsed={collapsed}>
                  {grup.intrari.map(rand)}
                </Grup>
              ))}
            </>
          )}
          {admin.length > 0 ? (
            <Grup titlu={`Admin (${APP_NAME})`} collapsed={collapsed}>
              {admin.map(rand)}
            </Grup>
          ) : null}
          {inAssociationWorkspace ? null : (
            <Grup separat collapsed={collapsed}>
              {final.map(rand)}
            </Grup>
          )}
        </nav>

        <div className={cn('flex items-center gap-1 border-t border-border p-2', collapsed && 'flex-col')}>
          <div className="min-w-0 flex-1">
            <UserProfileMenu restrans={collapsed} />
          </div>
          <button
            type="button"
            aria-label={collapsed ? 'Lărgește bara laterală' : 'Strânge bara laterală'}
            onClick={() => setCollapsed((current) => !current)}
            className={cn('flex size-touch shrink-0 items-center justify-center rounded-control text-fg-muted hover:bg-surface-muted', kitFocus)}
          >
            {collapsed ? <ChevronRight className="size-5" aria-hidden /> : <ChevronLeft className="size-5" aria-hidden />}
          </button>
        </div>
      </div>
    </aside>
  )
}
