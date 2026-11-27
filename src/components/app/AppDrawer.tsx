'use client'

import { Dialog } from '@/components/ui/dialog'
import { FormDialogLayout } from '@/components/ui/form-dialog-layout'

interface AppDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  contentClassName?: string
  hideHeader?: boolean
  showHandle?: boolean
  showCloseButton?: boolean
  /** Modal mai lat pe `md+` (formulare desktop); sub `md` rămâne compact. */
  desktopFormWide?: boolean
  /** Variantă compactă desktop pentru formulare scurte (header/content/footer mai dense). */
  desktopFormCompact?: boolean
}

export function AppDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  contentClassName,
  hideHeader,
  showHandle,
  showCloseButton,
  desktopFormWide,
  desktopFormCompact,
}: AppDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={title}
        description={description}
        footer={footer}
        contentClassName={contentClassName}
        hideHeader={hideHeader}
        showHandle={showHandle}
        showCloseButton={showCloseButton}
        desktopFormWide={desktopFormWide}
        desktopFormCompact={desktopFormCompact}
      >
        {children}
      </FormDialogLayout>
    </Dialog>
  )
}
