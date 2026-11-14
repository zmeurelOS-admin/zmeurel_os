'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ComponentType } from 'react'
import { Banknote, Home, Plus, ShoppingBag, Sprout, ClipboardList, Receipt, ShoppingBasket } from 'lucide-react'

import { AppDrawer } from '@/components/app/AppDrawer'
import { MoreMenuDrawer } from '@/components/app/MoreMenuDrawer'
import { useAddAction } from '@/contexts/AddActionContext'
import { getZoneForPath, OPEN_FARM_MENU_EVENT, ZONES, type ZoneKey } from '@/lib/navigation/zones'
import { cn } from '@/lib/utils'

const ZONE_ICONS: Record<ZoneKey, ComponentType<{ className?: string; strokeWidth?: number }>> = {
  azi: Home,
  camp: Sprout,
  vanzare: ShoppingBag,
  bani: Banknote,
}

/** Rute fără acțiune proprie de adăugare: „+” deschide alegerea rapidă. */
function hasNoPageAddAction(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/stocuri') ||
    pathname.startsWith('/rapoarte') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/livrari') ||
    pathname.startsWith('/notificari')
  )
}

const QUICK_ADD = [
  { label: 'Recoltare', href: '/recoltari', icon: ShoppingBasket },
  { label: 'Comandă', href: '/comenzi?add=1', icon: ShoppingBag },
  { label: 'Lucrare', href: '/activitati-agricole?openForm=1', icon: ClipboardList },
  { label: 'Cheltuială', href: '/cheltuieli?add=1', icon: Receipt },
] as const

/**
 * V2 · Bara de jos pentru fermă: Azi, Câmp, +, Vânzare, Bani.
 * „+” face acțiunea paginii curente (aceeași ca vechiul FAB); unde nu există, deschide alegerea rapidă.
 * Meniul fermei (restul modulelor) se deschide din antet, prin evenimentul OPEN_FARM_MENU_EVENT.
 */
export function FarmBottomTabBar() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const { triggerAddAction, hasAction, currentLabel } = useAddAction()
  const [menuOpen, setMenuOpen] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)
  const activeZone = getZoneForPath(pathname)

  useEffect(() => {
    ZONES.forEach((zone) => router.prefetch(zone.href))
  }, [router])

  useEffect(() => {
    const open = () => setMenuOpen(true)
    window.addEventListener(OPEN_FARM_MENU_EVENT, open)
    return () => window.removeEventListener(OPEN_FARM_MENU_EVENT, open)
  }, [])

  const onPlus = () => {
    // Pe Cules, „+” duce la formularul rapid din pagină, nu la dialogul lung.
    if (pathname.startsWith('/recoltari')) {
      const quick = document.getElementById('cules-rapid-titlu')
      if (quick) {
        quick.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
    if (hasAction && !hasNoPageAddAction(pathname) && triggerAddAction()) return
    setQuickOpen(true)
  }

  const plusLabel = hasAction && !hasNoPageAddAction(pathname) ? currentLabel : 'Adaugă'

  return (
    <>
      <nav
        aria-label="Navigare principală"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--agri-border)] bg-[var(--agri-surface)] md:hidden"
        style={{ paddingBottom: 'var(--safe-b)' }}
      >
        <div className="mx-auto grid h-[var(--tabbar-h)] max-w-[480px] grid-cols-[1fr_1fr_72px_1fr_1fr] items-center gap-1 px-2">
          {ZONES.flatMap((zone, index) => {
            const Icon = ZONE_ICONS[zone.key]
            const active = activeZone?.key === zone.key
            const link = (
              <Link
                key={zone.key}
                href={zone.href}
                aria-current={active ? 'page' : undefined}
                onTouchStart={() => router.prefetch(zone.href)}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[12.5px] transition-colors',
                  active
                    ? 'bg-[var(--pill-active-bg)] text-[var(--pill-active-text)] [font-weight:800]'
                    : 'text-[var(--text-secondary)] [font-weight:700]',
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={active ? 2.4 : 2} aria-hidden />
                {zone.label}
              </Link>
            )
            if (index !== 2) return [link]
            return [
              <div key="plus" className="flex justify-center">
                <button
                  type="button"
                  onClick={onPlus}
                  aria-label={plusLabel}
                  data-tutorial="quick-add-button"
                  data-mobile-fab="true"
                  className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--agri-primary)] text-[var(--agri-primary-contrast)] shadow-[0_4px_12px_rgba(140,14,58,0.28)] transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                >
                  <Plus className="h-7 w-7" strokeWidth={2.75} aria-hidden />
                </button>
              </div>,
              link,
            ]
          })}
        </div>
      </nav>

      <AppDrawer open={quickOpen} onOpenChange={setQuickOpen} title="Ce adaugi?" showHandle>
        <div className="grid grid-cols-2 gap-2.5 pb-2">
          {QUICK_ADD.map(({ label, href, icon: Icon }) => (
            <button
              key={href}
              type="button"
              onClick={() => {
                setQuickOpen(false)
                window.setTimeout(() => router.push(href), 0)
              }}
              className="flex min-h-24 flex-col items-start justify-between gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-3.5 text-left text-[17px] text-[var(--text-primary)] active:scale-[0.98] [font-weight:800]"
            >
              <Icon className="h-7 w-7 text-[var(--agri-primary)]" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </AppDrawer>

      <MoreMenuDrawer open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  )
}
