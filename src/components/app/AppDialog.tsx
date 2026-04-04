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
  /** Modal mai lat pe `md+` (formulare desktop); sub `md` rămâne compact. */
  desktopFormWide?: boolean
}

export function AppDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  contentClassName,
  desktopFormWide,
}: AppDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={title}
        description={description}
        footer={footer}
        contentClassName={contentClassName}
        desktopFormWide={desktopFormWide}
      >
        {children}
      </FormDialogLayout>
    </Dialog>
  )
}
