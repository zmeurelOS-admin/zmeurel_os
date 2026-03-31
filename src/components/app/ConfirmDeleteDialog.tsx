'use client'

import { AppDialog } from '@/components/app/AppDialog'
import { Button } from '@/components/ui/button'
import { hapticConfirm } from '@/lib/utils/haptic'

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  itemName?: string
  itemType?: string
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  loading?: boolean
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  itemName,
  itemType = 'Element',
  title = 'Confirmi ștergerea?',
  description,
  confirmText = 'Șterge',
  cancelText = 'Anulează',
  loading = false,
}: ConfirmDeleteDialogProps) {
  const label = itemName ? `${itemType} ${itemName}` : itemType
  const bodyText = description ?? `Urmeaza sa stergi ${label}.`

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <div className="flex w-full flex-row items-center justify-between gap-3">
          <Button type="button" variant="outline" className="agri-cta shrink-0" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            type="button"
            className="agri-cta shrink-0 bg-red-600 text-white hover:opacity-95 dark:bg-red-700 dark:hover:opacity-95"
            onClick={() => {
              hapticConfirm()
              onConfirm()
            }}
            disabled={loading}
          >
            {loading ? 'Se șterge...' : confirmText}
          </Button>
        </div>
      }
    >
      <p className="text-sm font-medium text-[var(--agri-text-muted)]">{bodyText}</p>
    </AppDialog>
  )
}
