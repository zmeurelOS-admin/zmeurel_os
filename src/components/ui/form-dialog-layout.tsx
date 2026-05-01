'use client'

import type { ReactNode } from 'react'

import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/** Secțiune vizuală pentru formulare (pilot desktop: scanare + ierarhie clară pe ecran mare). */
export function FormDialogSection({
  label,
  children,
  className,
}: {
  label?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-2 md:space-y-2.5', className)}>
      {label ? (
        <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">{label}</h3>
      ) : null}
      {children}
    </section>
  )
}

export function DesktopFormGrid({
  children,
  aside,
  className,
}: {
  children: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'space-y-3.5 md:grid md:grid-cols-[minmax(0,1fr)_16rem] md:items-start md:gap-4 md:space-y-0 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-5',
        className,
      )}
    >
      <div className="min-w-0 space-y-3.5 md:space-y-4">{children}</div>
      {aside ? <aside className="hidden md:sticky md:top-2 md:block md:self-start">{aside}</aside> : null}
    </div>
  )
}

export function DesktopFormAside({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'space-y-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-3 shadow-[var(--shadow-soft)]',
        className,
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">{title}</p>
      {children}
    </div>
  )
}

export function DesktopFormPanel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'space-y-2.5 md:space-y-3 md:rounded-[22px] md:border md:border-[var(--border-default)] md:bg-[var(--surface-card)] md:p-3 md:shadow-[var(--shadow-soft)] lg:rounded-[24px] lg:p-3.5',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface FormDialogLayoutProps {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  contentClassName?: string
  hideHeader?: boolean
  showHandle?: boolean
  showCloseButton?: boolean
  /** De la `md+`: modal centrat mai lat, padding generos — mobilul rămâne pe lățimea compactă existentă. */
  desktopFormWide?: boolean
  /** De la `md+`: variantă compactă pentru formulare scurte (padding/înălțime reduse). */
  desktopFormCompact?: boolean
}

export function FormDialogLayout({
  title,
  description,
  children,
  footer,
  contentClassName,
  hideHeader,
  showHandle,
  showCloseButton = false,
  desktopFormWide = false,
  desktopFormCompact = false,
}: FormDialogLayoutProps) {
  return (
    <DialogContent
      aria-describedby={undefined}
      showCloseButton={showCloseButton}
      className={cn(
        'w-[min(96vw,720px)] overflow-hidden rounded-[var(--agri-radius-lg)] border border-[var(--agri-border-card)] bg-[var(--agri-surface)] p-0 shadow-[var(--agri-elevated-shadow)] sm:max-w-lg',
        desktopFormWide && 'md:w-[min(96vw,84rem)] md:max-w-none md:rounded-2xl',
        desktopFormCompact && 'md:rounded-[20px]',
        contentClassName,
      )}
    >
      <div
        className={cn(
          'flex max-h-[min(88dvh,860px)] flex-col',
          desktopFormWide && 'md:max-h-[min(92dvh,60rem)]',
          desktopFormCompact && 'md:max-h-[min(82dvh,40rem)]',
        )}
      >
        {showHandle && (
          <div className="flex justify-center pb-1 pt-3 md:pt-4">
            <div className="h-1 w-10 rounded-full bg-[var(--text-hint)]" />
          </div>
        )}
        {!hideHeader ? (
          <DialogHeader
            className={cn(
              'border-b border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] px-4 pb-3 pt-3 sm:px-5',
              desktopFormWide && 'md:px-5 md:pb-3 md:pt-3',
              desktopFormCompact && 'md:px-5 md:pb-3 md:pt-3',
            )}
          >
            <div
              className={cn(
                'space-y-1 pr-8 md:flex md:items-baseline md:gap-2.5 md:space-y-0',
                desktopFormWide && 'md:pr-10',
                desktopFormCompact && 'md:pr-9',
              )}
            >
              <DialogTitle
                className={cn(
                  'text-left text-lg font-semibold tracking-[-0.02em] text-[var(--agri-text)] [font-weight:650]',
                  desktopFormWide && 'md:text-[1.15rem]',
                  desktopFormCompact && 'md:text-[1.05rem]',
                )}
              >
                {title}
              </DialogTitle>
              {description ? (
                <DialogDescription
                  className={cn(
                    'text-left text-sm leading-snug text-[var(--agri-text-muted)] md:flex-1 md:text-[13px]',
                    desktopFormCompact && 'md:text-[12px] md:leading-snug',
                  )}
                >
                  {description}
                </DialogDescription>
              ) : null}
            </div>
          </DialogHeader>
        ) : (
          <DialogHeader className="sr-only">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}

        <div
          className={cn(
            'flex-1 overflow-y-auto p-4 pb-[calc(3rem+env(safe-area-inset-bottom,0px))] sm:p-4 sm:pb-[calc(3.2rem+env(safe-area-inset-bottom,0px))]',
            desktopFormWide &&
              'md:px-5 md:py-3.5 md:pb-[calc(3.2rem+env(safe-area-inset-bottom,0px))]',
            desktopFormCompact &&
              'md:px-5 md:py-3 md:pb-[calc(3.1rem+env(safe-area-inset-bottom,0px))]',
          )}
        >
          {children}
        </div>

        {footer ? (
          <div
            className={cn(
              'shrink-0 border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--agri-surface-muted)_40%,var(--agri-surface))] p-3 pb-[calc(0.8rem+env(safe-area-inset-bottom,0px))] pt-2 sm:p-3.5 sm:pb-[calc(0.95rem+env(safe-area-inset-bottom,0px))] sm:pt-2.5',
              desktopFormWide && 'md:px-5 md:py-2.5',
              desktopFormCompact && 'md:px-5 md:py-2.5',
            )}
          >
            <div
              className={cn(
                'flex w-full flex-row items-center gap-3',
                desktopFormWide ? 'md:justify-end md:gap-4' : 'justify-between',
              )}
            >
              {footer}
            </div>
          </div>
        ) : null}
      </div>
    </DialogContent>
  )
}
