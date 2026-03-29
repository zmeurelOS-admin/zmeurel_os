"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
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
    className={cn(
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
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
    <DialogOverlay
      className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm"
      style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
    />
    <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "relative grid max-h-[calc(100dvh-2rem)] w-[92vw] max-w-sm gap-4 overflow-y-auto rounded-2xl border border-[var(--agri-border)] bg-[var(--surface-elevated)] p-6 text-[var(--agri-text)] shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            style={{ backgroundColor: 'transparent' }}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-[var(--agri-surface-muted)] data-[state=open]:text-[var(--agri-text-muted)]"
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
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse gap-3 pb-[env(safe-area-inset-bottom,0px)] sm:flex-row sm:justify-end sm:gap-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
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
    className={cn("text-sm text-[var(--agri-text-muted)]", className)}
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
