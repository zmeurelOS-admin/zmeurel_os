'use client'

import { CompactPageHeader } from '@/components/layout/CompactPageHeader'
import { UserProfileMenu } from '@/components/app/UserProfileMenu'
import { useAddAction } from '@/contexts/AddActionContext'

interface PageHeaderProps {
  title: string
  subtitle?: string
  rightSlot?: React.ReactNode
  summary?: React.ReactNode
}

export function PageHeader({ title, subtitle, rightSlot, summary }: PageHeaderProps) {
  const { triggerAddAction, currentLabel, hasAction } = useAddAction()

  return (
    <CompactPageHeader
      title={title}
      subtitle={subtitle}
      summary={summary}
      rightSlot={
        <div className="flex items-center justify-end gap-2 text-white lg:gap-3">
          {hasAction ? (
            <button
              type="button"
              onClick={triggerAddAction}
              className="hidden h-8 items-center rounded-full border border-white/35 bg-white/18 px-3.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/28 md:inline-flex"
            >
              {currentLabel}
            </button>
          ) : null}
          <div className="hidden md:flex">
            <UserProfileMenu />
          </div>
          {rightSlot ? <div className="hidden md:flex">{rightSlot}</div> : null}
        </div>
      }
    />
  )
}
