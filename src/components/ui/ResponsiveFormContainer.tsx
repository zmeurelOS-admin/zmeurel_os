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
          "w-[95vw] max-w-lg overflow-hidden rounded-[var(--agri-radius-lg)] border border-[var(--agri-border-card)] bg-[var(--agri-surface)] p-0 shadow-[var(--agri-elevated-shadow)]",
          desktopClassName
        )}
      >
        <div className="flex max-h-[min(88dvh,860px)] flex-col">
          <div className="flex-1 overflow-y-auto p-6 pb-20 sm:p-7 sm:pb-24">
            <div className="mb-6 flex items-start justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] pb-5">
              <div className="space-y-2 pr-8">
                <DialogTitle className="text-left text-lg font-semibold tracking-[-0.02em] text-[var(--agri-text)]">
                  {title}
                </DialogTitle>
                {description ? (
                  <DialogDescription className="text-left text-sm leading-relaxed text-[var(--agri-text-muted)]">
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
