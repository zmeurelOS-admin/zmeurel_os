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
        'w-[95%] overflow-hidden rounded-2xl border border-[var(--agri-border)] bg-[var(--surface-elevated)] p-0 shadow-2xl sm:max-w-lg',
        contentClassName
      )}
    >
      <DialogHeader>
        <DialogTitle className="sr-only">Dialog</DialogTitle>
      </DialogHeader>
      <div
        className="flex max-h-[min(88vh,860px)] flex-col"
        style={{ maxHeight: 'min(88dvh, 860px)' }}
      >
        {showHandle && (
          <div className="flex justify-center pb-1 pt-3">
            <div className="h-1 w-10 rounded-full bg-[var(--text-hint)]" />
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5 pb-20 sm:p-6 sm:pb-24">
          {!hideHeader && (
            <DialogHeader className="mb-5 space-y-0 border-b border-[var(--surface-divider)] pb-4">
              <div className="space-y-1.5">
                <DialogTitle className="text-left text-lg font-semibold text-[var(--agri-text)]">{title}</DialogTitle>
                {description ? (
                  <DialogDescription className="text-left text-sm text-[var(--agri-text-muted)]">{description}</DialogDescription>
                ) : null}
              </div>
            </DialogHeader>
          )}

          {children}
        </div>

        {footer ? (
          <div className="border-t border-[var(--surface-divider)] bg-[var(--surface-elevated)] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-4 sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:pt-4">
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:[&>*]:w-auto [&>*]:w-full">
              {footer}
            </div>
          </div>
        ) : null}
      </div>
    </DialogContent>
  )
}
