'use client'

import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface FormDialogLayoutProps {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  contentClassName?: string
}

export function FormDialogLayout({
  title,
  description,
  children,
  footer,
  contentClassName,
}: FormDialogLayoutProps) {
  return (
    <DialogContent
      aria-describedby={undefined}
      showCloseButton={false}
      className={cn(
        'w-[95%] overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl sm:max-w-lg',
        contentClassName
      )}
    >
      <DialogHeader>
        <DialogTitle className="sr-only">Dialog</DialogTitle>
      </DialogHeader>
      <div className="flex max-h-[min(88dvh,860px)] flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          <DialogHeader className="mb-5 flex-row items-start justify-between space-y-0">
            <div className="space-y-1.5">
              <DialogTitle className="text-left text-lg font-semibold text-[var(--agri-text)]">{title}</DialogTitle>
              {description ? (
                <DialogDescription className="text-left text-sm text-[var(--agri-text-muted)]">{description}</DialogDescription>
              ) : null}
            </div>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" className="rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </DialogHeader>

          {children}
        </div>

        {footer ? (
          <div className="border-t border-[var(--agri-border)] bg-white p-6 pt-4">
            {footer}
          </div>
        ) : null}
      </div>
    </DialogContent>
  )
}
