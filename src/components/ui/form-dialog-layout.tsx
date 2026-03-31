'use client'

import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface FormDialogLayoutProps {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  contentClassName?: string
  hideHeader?: boolean
  showHandle?: boolean
}

export function FormDialogLayout({
  title,
  description,
  children,
  footer,
  contentClassName,
  hideHeader,
  showHandle,
}: FormDialogLayoutProps) {
  return (
    <DialogContent
      aria-describedby={undefined}
      showCloseButton={false}
      className={cn(
        'w-[min(96vw,720px)] overflow-hidden rounded-[var(--agri-radius-lg)] border border-[var(--agri-border-card)] bg-[var(--agri-surface)] p-0 shadow-[var(--agri-elevated-shadow)] sm:max-w-lg',
        contentClassName
      )}
    >
      <div className="flex max-h-[88dvh] flex-col" style={{ maxHeight: 'min(88dvh, 860px)' }}>
        {showHandle && (
          <div className="flex justify-center pb-1 pt-3">
            <div className="h-1 w-10 rounded-full bg-[var(--text-hint)]" />
          </div>
        )}
        {!hideHeader ? (
          <DialogHeader className="border-b border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] px-6 pb-5 pt-5 sm:px-7">
            <div className="space-y-2 pr-8">
              <DialogTitle className="text-left text-lg font-semibold tracking-[-0.02em] text-[var(--agri-text)] [font-weight:650]">
                {title}
              </DialogTitle>
              {description ? (
                <DialogDescription className="text-left text-sm leading-relaxed text-[var(--agri-text-muted)]">
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

        <div className="flex-1 overflow-y-auto p-6 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] sm:p-7 sm:pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] bg-[color:color-mix(in_srgb,var(--agri-surface-muted)_40%,var(--agri-surface))] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-4 sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pt-5">
            <div className="flex w-full flex-row items-center justify-between gap-3">{footer}</div>
          </div>
        ) : null}
      </div>
    </DialogContent>
  )
}
