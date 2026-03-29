"use client"

import { Dialog } from "@/components/ui/dialog"
import { DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/useMediaQuery"

interface ResponsiveFormContainerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  desktopClassName?: string
  mobileClassName?: string
}

export function ResponsiveFormContainer({
  open,
  onOpenChange,
  title,
  description,
  children,
  desktopClassName,
  mobileClassName,
}: ResponsiveFormContainerProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)")

  if (!open) return null

  if (!isDesktop) {
    return <div className={mobileClassName}>{children}</div>
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className={cn(
          "w-[95vw] max-w-lg overflow-hidden rounded-2xl border border-[var(--agri-border)] bg-[var(--surface-elevated)] p-0 shadow-2xl",
          desktopClassName
        )}
      >
        <div className="flex max-h-[min(88dvh,860px)] flex-col">
          <div className="flex-1 overflow-y-auto p-5 pb-20 sm:p-6 sm:pb-24">
            <div className="mb-5 flex items-start justify-between gap-3 border-b border-[var(--surface-divider)] pb-4">
              <div className="space-y-1.5 pr-8">
                <DialogTitle className="text-left text-lg font-semibold text-[var(--agri-text)]">
                  {title}
                </DialogTitle>
                {description ? (
                  <DialogDescription className="text-left text-sm text-[var(--agri-text-muted)]">
                    {description}
                  </DialogDescription>
                ) : null}
              </div>
            </div>

            {children}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
