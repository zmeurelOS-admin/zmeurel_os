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
  disableHistory?: boolean
  hideHeader?: boolean
  showHandle?: boolean
  /** Modal mai lat pe `md+` (formulare desktop); sub `md` rămâne compact. */
  desktopFormWide?: boolean
}

export function AppDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  contentClassName,
  disableHistory,
  hideHeader,
  showHandle,
  desktopFormWide,
}: AppDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disableHistory={disableHistory}>
      <FormDialogLayout
        title={title}
        description={description}
        footer={footer}
        contentClassName={contentClassName}
        hideHeader={hideHeader}
        showHandle={showHandle}
        desktopFormWide={desktopFormWide}
      >
        {children}
      </FormDialogLayout>
    </Dialog>
  )
}
