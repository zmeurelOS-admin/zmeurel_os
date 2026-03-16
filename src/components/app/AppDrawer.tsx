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
}

export function AppDrawer({ open, onOpenChange, title, description, children, footer, contentClassName }: AppDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout title={title} description={description} footer={footer} contentClassName={contentClassName}>
        {children}
      </FormDialogLayout>
    </Dialog>
  )
}
