'use client'

import { AlertTriangle } from 'lucide-react'

import { AppDialog } from '@/components/app/AppDialog'
import { Button } from '@/components/ui/button'

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
        <div className="flex items-center justify-center gap-3">
          <Button type="button" variant="outline" className="agri-cta" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            type="button"
            className="agri-cta bg-[var(--agri-danger)] text-white hover:bg-red-700"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Se șterge...' : confirmText}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <p className="pt-1 text-sm font-medium text-[var(--agri-text-muted)]">{bodyText}</p>
      </div>
    </AppDialog>
  )
}
