'use client'

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
}

export function PageHeader({
  title,
  subtitle,
  rightSlot,
  summary,
  headerClassName,
  expandRightSlotOnMobile,
  stackMobileRightSlotBelowTitle,
}: PageHeaderProps) {
  const { triggerAddAction, currentLabel, hasAction } = useAddAction()

  return (
    <CompactPageHeader
      title={title}
      subtitle={subtitle}
      summary={summary}
      className={headerClassName}
      showMobileRightSlot
      stackMobileRightSlotBelow={stackMobileRightSlotBelowTitle}
      rightSlot={
        <div className="flex flex-wrap items-center justify-end gap-1.5 text-[var(--text-primary)] sm:gap-2 lg:gap-2.5 lg:text-[var(--text-on-accent)]">
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
