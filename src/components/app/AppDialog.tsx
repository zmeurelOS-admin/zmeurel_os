'use client'

import { Dialog } from '@/components/ui/dialog'
import { FormDialogLayout } from '@/components/ui/form-dialog-layout'

interface AppDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  contentClassName?: string
  showCloseButton?: boolean
  mobileFullHeight?: boolean
  /** Modal mai lat pe `md+` (formulare desktop); sub `md` rămâne compact. */
  desktopFormWide?: boolean
  /** Variantă compactă desktop pentru formulare scurte (header/content/footer mai dense). */
  desktopFormCompact?: boolean
  /** Dialog peste Sheet (mobil): nu propagă dismiss către părinte. */
  isolateFromParentModal?: boolean
}

export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  contentClassName,
  showCloseButton,
  mobileFullHeight,
  desktopFormWide,
  desktopFormCompact,
  isolateFromParentModal,
}: AppDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={title}
        description={description}
        footer={footer}
        contentClassName={contentClassName}
        showCloseButton={showCloseButton}
        mobileFullHeight={mobileFullHeight}
        desktopFormWide={desktopFormWide}
        desktopFormCompact={desktopFormCompact}
        isolateFromParentModal={isolateFromParentModal}
      >
        {children}
      </FormDialogLayout>
    </Dialog>
  )
}
