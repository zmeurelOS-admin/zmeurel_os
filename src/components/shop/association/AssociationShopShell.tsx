'use client'

import { type CSSProperties, type ReactNode, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Home, Search, ShoppingBag, Store, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { AssociationShopFooter } from '@/components/shop/association/AssociationShopFooter'
import { useAssociationShop } from '@/components/shop/association/association-shop-context'
import { labelForCategory } from '@/components/shop/association/tokens'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import {
  ASSOCIATION_SHOP_BASE,
  ASSOCIATION_SHOP_PRODUCATORI_PATH,
  associationShopProdusePath,
} from '@/lib/shop/association-routes'
import { gustaBrandColors, gustaBrandShadows, gustaPrimaryTints } from '@/lib/shop/association/brand-tokens'
import { cn } from '@/lib/utils'

export type { AssociationCartLine } from '@/components/shop/association/AssociationCartProvider'

const MD_QUERY = '(min-width: 768px)'

const Z_SIDEBAR = 100
const Z_TOPBAR = 50
const Z_BOTTOMNAV = 200

const SIDEBAR_CAT_EMOJI: Record<string, string> = {
  fructe_legume: '🍓',
  lactate_branzeturi: '🧀',
  carne_mezeluri: '🥩',
  miere_apicole: '🍯',
  conserve_muraturi: '🫙',
  panificatie_patiserie: '🍞',
  bauturi: '🧃',
  oua: '🥚',
  altele: '🌿',
}

function emojiForCategoryKey(key: string): string {
  const k = key.trim().toLowerCase()
  return SIDEBAR_CAT_EMOJI[k] ?? '🌱'
}

function normalizeCat(s: string): string {
  return s.trim().toLowerCase()
}

export function AssociationShopShell({ children }: { children?: ReactNode }) {
  const isDesktop = useMediaQuery(MD_QUERY)
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const {
    searchQuery,
    setSearchQuery,
    showCart,
    setShowCart,
    cartLineCount,
    cartTotalQty,
    totalLeiLabel,
    sidebarCategories,
    publicSettings,
  } = useAssociationShop()

  const isHome = pathname === ASSOCIATION_SHOP_BASE || pathname === `${ASSOCIATION_SHOP_BASE}/`
  const isShop = pathname.startsWith(`${ASSOCIATION_SHOP_BASE}/produse`)
  const isProducers = pathname.startsWith(ASSOCIATION_SHOP_PRODUCATORI_PATH)

  const urlCategory = searchParams.get('categorie')?.trim() ?? ''

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const navBtnClass = (active: boolean) =>
    cn(
      'assoc-heading flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm transition-colors duration-200',
      active ? 'font-semibold' : 'font-medium',
    )

  const navBtnStyle = (active: boolean): CSSProperties => ({
    backgroundColor: active ? 'rgba(255,255,255,0.15)' : 'transparent',
    color: gustaBrandColors.secondary,
  })

  const linkNavClass = (active: boolean) => navBtnClass(active)

  return (
    <div
      className="min-h-[100dvh]"
      style={{ backgroundColor: gustaBrandColors.secondary, color: gustaBrandColors.text }}
      data-association-shop-ui="shell-v2"
    >
      {isDesktop ? (
        <aside
          className="fixed left-0 top-0 flex h-[100dvh] w-[260px] flex-col border-r shadow-md transition-colors duration-200"
          style={{
            zIndex: Z_SIDEBAR,
            backgroundColor: gustaBrandColors.primary,
            borderColor: gustaPrimaryTints[80],
            boxShadow: gustaBrandShadows.md,
          }}
        >
          <Link
            href={ASSOCIATION_SHOP_BASE}
            className="flex shrink-0 items-start gap-2 border-b border-white/15 px-4 py-5 text-left transition hover:bg-white/5"
          >
            <div className="rounded-[18px] bg-white/10 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
              <Image
                src="/images/asociatie/logo_nav_simbol_alb.png"
                alt="Gustă din Bucovina"
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 object-contain"
                priority
              />
            </div>
          </Link>

          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
            <Link
              href={ASSOCIATION_SHOP_BASE}
              className={linkNavClass(isHome)}
              style={navBtnStyle(isHome)}
              onMouseEnter={(e) => {
                if (!isHome) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isHome ? 'rgba(255,255,255,0.15)' : 'transparent'
              }}
            >
              <span aria-hidden>🏠</span>
              Acasă
            </Link>
            <Link
              href={associationShopProdusePath()}
              className={linkNavClass(isShop)}
              style={navBtnStyle(isShop)}
              onMouseEnter={(e) => {
                if (!isShop) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isShop ? 'rgba(255,255,255,0.15)' : 'transparent'
              }}
            >
              <span aria-hidden>🏪</span>
              Magazin
            </Link>
            <Link
              href={ASSOCIATION_SHOP_PRODUCATORI_PATH}
              className={linkNavClass(isProducers)}
              style={navBtnStyle(isProducers)}
              onMouseEnter={(e) => {
                if (!isProducers) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isProducers ? 'rgba(255,255,255,0.15)' : 'transparent'
              }}
            >
              <span aria-hidden>👤</span>
              Producători
            </Link>

            <div className="my-3 border-t border-white/15" />

            <p className="assoc-heading mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-white/55">
              Categorii
            </p>
            <div className="flex flex-col gap-0.5">
              {sidebarCategories.map((cat) => {
                const active =
                  isShop && urlCategory.length > 0 && normalizeCat(urlCategory) === normalizeCat(cat)
                return (
                  <Link
                    key={cat}
                    href={associationShopProdusePath({ categorie: cat })}
                    className={navBtnClass(active)}
                    style={navBtnStyle(active)}
                    onMouseEnter={(e) => {
                      if (!active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = active
                        ? 'rgba(255,255,255,0.15)'
                        : 'transparent'
                    }}
                  >
                    <span className="text-base" aria-hidden>
                      {emojiForCategoryKey(cat)}
                    </span>
                    <span className="truncate">{labelForCategory(cat)}</span>
                  </Link>
                )
              })}
            </div>
          </nav>

          <div className="shrink-0 border-t border-white/15 px-4 py-4 text-[11px] leading-relaxed text-white/80">
            <p className="assoc-heading font-bold text-white/95">Piața Volantă</p>
            <p className="mt-1 font-medium">Din drag de Bucovina</p>
            <p className="mt-1">Sâmbătă 08:00–12:30</p>
            <p className="mt-0.5 text-white/70">DAJ Suceava</p>
          </div>
        </aside>
      ) : null}

      <div className={cn('flex min-h-[100dvh] flex-col', isDesktop && 'ml-[260px]')}>
        <header
          className={cn(
            'sticky top-0 flex flex-col gap-2 border-b px-4 py-3 md:flex-row md:items-center md:gap-4 md:px-6',
            !isDesktop && 'pt-[max(0.75rem,env(safe-area-inset-top,0px))]',
          )}
          style={{
            zIndex: Z_TOPBAR,
            backgroundColor: gustaBrandColors.secondary,
            borderColor: gustaPrimaryTints[40],
            boxShadow: gustaBrandShadows.sm,
          }}
        >
          {!isDesktop ? (
            <Link href={ASSOCIATION_SHOP_BASE} className="flex items-center gap-2">
              <Image
                src="/images/gusta-logo-horizontal.png"
                alt="Gustă din Bucovina"
                width={120}
                height={30}
                className="h-auto w-[120px] shrink-0"
                priority
              />
            </Link>
          ) : null}

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative max-w-[420px] flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: gustaPrimaryTints[80] }}
                aria-hidden
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Caută produse..."
                className="assoc-body h-10 w-full rounded-[10px] border pl-9 pr-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-offset-2"
                style={
                  {
                    borderColor: gustaPrimaryTints[40],
                    backgroundColor: '#fff',
                    color: gustaBrandColors.text,
                    ['--tw-ring-color' as string]: `${gustaBrandColors.primary}55`,
                  } as CSSProperties
                }
                aria-label="Caută în magazin"
              />
            </div>

            {isDesktop ? (
              <button
                type="button"
                onClick={() => setShowCart(true)}
                aria-label="Deschide coșul de cumpărături"
                className="assoc-heading relative flex shrink-0 items-center gap-2 rounded-[12px] border px-4 py-2 text-sm font-bold transition hover:brightness-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={
                  {
                    borderColor: gustaPrimaryTints[40],
                    backgroundColor: '#fff',
                    color: gustaBrandColors.primary,
                    boxShadow: gustaBrandShadows.sm,
                    ['--tw-outline-color' as string]: gustaBrandColors.primary,
                  } as CSSProperties
                }
              >
                <ShoppingBag className="h-5 w-5" aria-hidden />
                <span className="hidden sm:inline">Coș</span>
                {cartLineCount > 0 ? (
                  <span
                    className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-extrabold text-white"
                    style={{ backgroundColor: gustaBrandColors.accent }}
                  >
                    {cartTotalQty % 1 === 0 ? cartTotalQty : cartTotalQty.toFixed(1)}
                  </span>
                ) : null}
                <span className="tabular-nums text-xs font-bold opacity-90">{totalLeiLabel} RON</span>
              </button>
            ) : null}
          </div>
        </header>

        <main className={cn('min-h-0 flex-1', !isDesktop && 'pb-[calc(80px+env(safe-area-inset-bottom,0px))]')}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        <div className={cn(!isDesktop && 'pb-[calc(70px+env(safe-area-inset-bottom,0px))]')}>
          <AssociationShopFooter settings={publicSettings} />
        </div>
      </div>

      {!isDesktop ? (
        <nav
          className="fixed bottom-0 left-0 right-0 flex h-[calc(70px+env(safe-area-inset-bottom,0px))] items-stretch justify-around border-t pt-1"
          style={{
            zIndex: Z_BOTTOMNAV,
            backgroundColor: 'rgba(255, 249, 227, 0.92)',
            borderColor: gustaPrimaryTints[40],
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            boxShadow: `0 -4px 24px rgba(13, 99, 66, 0.06)`,
          }}
        >
          <BottomTabLink
            href={ASSOCIATION_SHOP_BASE}
            label="Acasă"
            icon={<Home className="h-6 w-6" />}
            active={isHome}
          />
          <BottomTabLink
            href={associationShopProdusePath()}
            label="Magazin"
            icon={<Store className="h-6 w-6" />}
            active={isShop}
          />
          <BottomTabLink
            href={ASSOCIATION_SHOP_PRODUCATORI_PATH}
            label="Producători"
            icon={<Users className="h-6 w-6" />}
            active={isProducers}
          />
          <BottomTab
            label="Coș"
            icon={<ShoppingBag className="h-6 w-6" />}
            active={showCart}
            onClick={() => setShowCart(true)}
            badge={cartLineCount > 0 ? cartTotalQty : undefined}
          />
        </nav>
      ) : null}
    </div>
  )
}

function BottomTabLink({
  href,
  label,
  icon,
  active,
}: {
  href: string
  label: string
  icon: ReactNode
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="assoc-body flex flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-1 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={
        {
          color: active ? gustaBrandColors.primary : gustaPrimaryTints[80],
          fontWeight: active ? 700 : 500,
          ['--tw-outline-color' as string]: gustaBrandColors.primary,
        } as CSSProperties
      }
    >
      {icon}
      <span className="max-w-[4.5rem] truncate text-[10px] leading-tight">{label}</span>
    </Link>
  )
}

function BottomTab({
  label,
  icon,
  active,
  onClick,
  badge,
}: {
  label: string
  icon: ReactNode
  active: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="assoc-body flex flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-1 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={
        {
          color: active ? gustaBrandColors.primary : gustaPrimaryTints[80],
          fontWeight: active ? 700 : 500,
          ['--tw-outline-color' as string]: gustaBrandColors.primary,
        } as CSSProperties
      }
    >
      <span className="relative">
        {icon}
        {badge != null && badge > 0 ? (
          <span
            className="absolute -right-2 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-0.5 text-[10px] font-extrabold text-white"
            style={{ backgroundColor: gustaBrandColors.accent }}
          >
            {badge % 1 === 0 ? badge : badge.toFixed(1)}
          </span>
        ) : null}
      </span>
      <span className="max-w-[4.5rem] truncate text-[10px] leading-tight">{label}</span>
    </button>
  )
}
