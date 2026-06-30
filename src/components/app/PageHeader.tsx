'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { type DashboardContentShellVariant } from '@/components/app/DashboardContentShell'
import { CompactPageHeader } from '@/components/layout/CompactPageHeader'
import { UserProfileMenu } from '@/components/app/UserProfileMenu'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useAddAction } from '@/contexts/AddActionContext'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  rightSlot?: React.ReactNode
  summary?: React.ReactNode
  headerClassName?: string
  /** Dashboard: acțiuni layout vizibile și pe ecrane înguste (altfel rightSlot rămânea ascuns pe mobil). */
  expandRightSlotOnMobile?: boolean
  /** Dashboard: pe mobil, acțiunile sub titlu pe rând dedicat. */
  stackMobileRightSlotBelowTitle?: boolean
  /** Dashboard: aliniază header-ul la aceeași lățime cu body-ul standardizat. */
  contentVariant?: DashboardContentShellVariant
}

const QUICK_NAV_ITEMS = [
  { href: '/comenzi', label: 'Comenzi' },
  { href: '/livrari', label: 'Livrări' },
  { href: '/recoltari', label: 'Recoltări' },
  { href: '/clienti', label: 'Clienți' },
] as const

function isQuickNavActive(pathname: string, href: (typeof QUICK_NAV_ITEMS)[number]['href']) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function PageHeader({
  title,
  subtitle,
  rightSlot,
  summary,
  headerClassName,
  expandRightSlotOnMobile,
  stackMobileRightSlotBelowTitle,
  contentVariant,
}: PageHeaderProps) {
  const { triggerAddAction, currentLabel, hasAction } = useAddAction()
  const pathname = usePathname()

  return (
    <CompactPageHeader
      title={title}
      subtitle={subtitle}
      summary={summary}
      className={headerClassName}
      showMobileRightSlot
      stackMobileRightSlotBelow={stackMobileRightSlotBelowTitle}
      contentVariant={contentVariant}
      rightSlot={
        <div className="flex flex-wrap items-center justify-end gap-1.5 text-[var(--text-primary)] sm:gap-2 lg:gap-2.5 lg:text-[var(--text-on-accent)]">
          <nav
            aria-label="Navigare rapidă"
            className="hidden items-center gap-1 lg:flex"
          >
            {QUICK_NAV_ITEMS.map((item) => {
              const isActive = isQuickNavActive(pathname, item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'h-7 items-center rounded-full border px-2.5 text-xs font-medium transition lg:inline-flex',
                    isActive
                      ? 'border-white/45 bg-white/22 text-[var(--text-on-accent)]'
                      : 'border-white/24 bg-white/10 text-[color:color-mix(in_srgb,var(--text-on-accent)_88%,transparent)] hover:bg-white/18 hover:text-[var(--text-on-accent)]'
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <NotificationBell />
          {hasAction ? (
            <button
              type="button"
              onClick={triggerAddAction}
              className="hidden h-8 items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-sm [font-weight:650] text-[var(--text-primary)] transition hover:bg-[var(--surface-card-muted)] md:inline-flex lg:border-white/30 lg:bg-white/14 lg:text-[var(--text-on-accent)] lg:hover:bg-white/24"
            >
              {currentLabel}
            </button>
          ) : null}
          <div className="hidden md:flex">
            <UserProfileMenu />
          </div>
          {rightSlot ? (
            <div className={cn('flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2', !expandRightSlotOnMobile && 'hidden md:flex')}>
              {rightSlot}
            </div>
          ) : null}
        </div>
      }
    />
  )
}
