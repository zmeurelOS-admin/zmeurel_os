"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { MODAL_OVERLAY_CLASSES } from "@/lib/ui/modal-overlay-classes"
import { useDocumentModalState } from "@/components/ui/modal-layer"

type DialogProps = React.ComponentProps<typeof DialogPrimitive.Root> & {
  disableHistory?: boolean
}

const Dialog = ({ open, onOpenChange, disableHistory = false, ...props }: DialogProps) => {
  const addedHistoryEntryRef = React.useRef(false)
  const closingFromBackRef = React.useRef(false)
  useDocumentModalState(Boolean(open))

  React.useEffect(() => {
    if (disableHistory || typeof window === "undefined" || !open || addedHistoryEntryRef.current) return

    window.history.pushState(
      {
        ...(window.history.state ?? {}),
        __zmeurelDialog: true,
      },
      ""
    )
    addedHistoryEntryRef.current = true

    const handlePopState = () => {
      if (!addedHistoryEntryRef.current) return
      closingFromBackRef.current = true
      addedHistoryEntryRef.current = false
      onOpenChange?.(false)
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [open, onOpenChange, disableHistory])

  React.useEffect(() => {
    if (disableHistory || typeof window === "undefined" || open) return

    if (closingFromBackRef.current) {
      closingFromBackRef.current = false
      return
    }

    if (addedHistoryEntryRef.current) {
      addedHistoryEntryRef.current = false
      if (window.history.state?.__zmeurelDialog) {
        window.history.back()
      }
    }
  }, [open, disableHistory])

  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props} />
}

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(MODAL_OVERLAY_CLASSES, className)}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean
  }
>(({ className, children, showCloseButton = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "relative grid max-h-[88dvh] w-[min(96vw,720px)] max-w-sm gap-5 overflow-y-auto rounded-[var(--agri-radius-lg)] border border-[var(--agri-border-card)] bg-[var(--agri-surface)] p-5 text-[var(--agri-text)] shadow-[var(--agri-elevated-shadow)] outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:max-w-lg sm:p-6",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 flex size-10 touch-manipulation items-center justify-center rounded-full bg-transparent opacity-80 transition-[transform,opacity] duration-150 ease-out hover:opacity-100 active:scale-[0.97] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--agri-primary)_28%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--agri-surface)] disabled:pointer-events-none data-[state=open]:bg-[var(--agri-surface-muted)] data-[state=open]:text-[var(--agri-text-muted)] sm:right-4 sm:top-4"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </div>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-left",
      className?.includes("sr-only")
        ? null
        : "sticky top-0 z-10 bg-[var(--agri-surface)]/95 backdrop-blur-sm",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const items = React.Children.toArray(children).filter(
    (child) => child !== null && child !== undefined && typeof child !== "boolean"
  )
  const multi = items.length > 1
  return (
    <div
      className={cn(
        "flex w-full flex-row flex-wrap items-center gap-3 pb-[env(safe-area-inset-bottom,0px)]",
        className?.includes("sr-only")
          ? null
          : "sticky bottom-0 z-10 bg-[color:color-mix(in_srgb,var(--agri-surface-muted)_40%,var(--agri-surface))] backdrop-blur-sm",
        multi ? "justify-between" : "justify-end",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-tight tracking-[-0.02em] text-[var(--agri-text)] [font-weight:650]",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm leading-relaxed text-[var(--agri-text-muted)]", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
