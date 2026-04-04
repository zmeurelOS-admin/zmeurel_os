'use client'

import { cn } from '@/lib/utils'

interface CompactPageHeaderProps {
  title?: string
  subtitle?: string
  rightSlot?: React.ReactNode
  summary?: React.ReactNode
  className?: string
  /** Afișează rightSlot pe mobil (ex. acțiuni dashboard), lângă titlu. */
  showMobileRightSlot?: boolean
  /** Pe mobil, rightSlot pe rând separat sub titlu (evită înghesuirea). */
  stackMobileRightSlotBelow?: boolean
}

export function CompactPageHeader({
  title,
  subtitle,
  rightSlot,
  summary,
  className,
  showMobileRightSlot,
  stackMobileRightSlotBelow,
}: CompactPageHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 overflow-hidden border-b border-[var(--divider)] px-[var(--shell-content-px)] pb-1.5 pt-[calc(var(--safe-t)+7px)] shadow-[var(--shadow-soft)] backdrop-blur-sm sm:px-5 md:px-6 lg:static lg:z-40 lg:overflow-visible lg:border-b-0 lg:px-8 lg:pb-5 lg:pt-4 lg:shadow-none lg:backdrop-blur-none xl:px-10',
        className
      )}
    >
      <div className="absolute inset-0 bg-[color:color-mix(in_srgb,var(--surface-page)_95%,transparent)] lg:hidden" />
      <div className="absolute inset-0 hidden bg-[color:color-mix(in_srgb,var(--primary)_92%,black_8%)] lg:block" />

      <div className="relative mx-auto w-full max-w-7xl">
        {(title || subtitle) && (
          <>
            <div
              className={cn(
                'flex min-h-[42px] items-start lg:hidden',
                stackMobileRightSlotBelow && showMobileRightSlot && rightSlot
                  ? 'flex-col gap-2'
                  : 'flex-wrap justify-between gap-x-2 gap-y-2'
              )}
            >
              <div
                className={cn(
                  'min-w-0',
                  !(stackMobileRightSlotBelow && showMobileRightSlot && rightSlot) && 'flex-1 basis-[min(100%,280px)]'
                )}
              >
                {title ? (
                  <h1 className="text-[clamp(1.12rem,4.4vw,1.3rem)] leading-[1.12] tracking-[-0.02em] text-[var(--text-primary)] [font-weight:750]">
                    {title}
                  </h1>
                ) : null}
                {subtitle ? (
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.3] text-[var(--text-secondary)]">{subtitle}</p>
                ) : null}
              </div>
              {showMobileRightSlot && rightSlot ? (
                <div
                  className={cn(
                    'text-[var(--text-primary)] lg:text-[var(--text-on-accent)] [&_button]:text-[11px] [&_button]:sm:text-sm',
                    stackMobileRightSlotBelow
                      ? 'flex w-full flex-wrap items-center justify-end gap-x-1.5 gap-y-2 border-t border-[var(--divider)] lg:border-white/10 pt-2'
                      : 'shrink-0'
                  )}
                >
                  {rightSlot}
                </div>
              ) : null}
            </div>

            <div className="hidden items-start justify-between gap-3 lg:flex lg:items-center">
              <div className="min-w-0 space-y-0.5">
                {title ? <h1 className="truncate text-[1.55rem] text-[var(--text-on-accent)] [font-weight:750]">{title}</h1> : null}
                {subtitle ? <p className="line-clamp-2 text-[13px] text-[color:color-mix(in_srgb,var(--text-on-accent)_84%,transparent)]">{subtitle}</p> : null}
              </div>
              {rightSlot ? (
                <div className="flex shrink-0 items-center justify-end text-[var(--text-on-accent)] lg:items-center">{rightSlot}</div>
              ) : null}
            </div>
          </>
        )}

        {summary ? <div className="mt-2 lg:mt-3">{summary}</div> : null}
      </div>
    </header>
  )
}
