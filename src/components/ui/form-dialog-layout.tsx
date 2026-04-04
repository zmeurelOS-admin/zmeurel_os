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
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-3 md:space-y-4', className)}>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">{label}</h3>
      {children}
    </section>
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
  /** De la `md+`: modal centrat mai lat, padding generos — mobilul rămâne pe lățimea compactă existentă. */
  desktopFormWide?: boolean
}

export function FormDialogLayout({
  title,
  description,
  children,
  footer,
  contentClassName,
  hideHeader,
  showHandle,
  desktopFormWide = false,
}: FormDialogLayoutProps) {
  return (
    <DialogContent
      aria-describedby={undefined}
      showCloseButton={false}
      className={cn(
        'w-[min(96vw,720px)] overflow-hidden rounded-[var(--agri-radius-lg)] border border-[var(--agri-border-card)] bg-[var(--agri-surface)] p-0 shadow-[var(--agri-elevated-shadow)] sm:max-w-lg',
        desktopFormWide && 'md:w-[min(92vw,56rem)] md:max-w-4xl md:rounded-2xl',
        contentClassName
      )}
    >
      <div
        className={cn(
          'flex max-h-[min(88dvh,860px)] flex-col',
          desktopFormWide && 'md:max-h-[min(90dvh,56rem)]',
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
              'border-b border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] px-6 pb-5 pt-5 sm:px-7',
              desktopFormWide && 'md:px-8 md:pb-6 md:pt-6',
            )}
          >
            <div className={cn('space-y-2 pr-8', desktopFormWide && 'md:space-y-2.5 md:pr-10')}>
              <DialogTitle
                className={cn(
                  'text-left text-lg font-semibold tracking-[-0.02em] text-[var(--agri-text)] [font-weight:650]',
                  desktopFormWide && 'md:text-xl',
                )}
              >
                {title}
              </DialogTitle>
              {description ? (
                <DialogDescription className="text-left text-sm leading-relaxed text-[var(--agri-text-muted)] md:text-[15px]">
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
            'flex-1 overflow-y-auto p-6 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] sm:p-7 sm:pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]',
            desktopFormWide &&
              'md:px-8 md:py-6 md:pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]',
          )}
        >
          {children}
        </div>

        {footer ? (
          <div
            className={cn(
              'shrink-0 border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--agri-surface-muted)_40%,var(--agri-surface))] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-4 sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pt-5',
              desktopFormWide && 'md:px-8 md:py-5',
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
