'use client'

import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  parcelaNume?: string
  itemName?: string
  itemType?: string
  description?: string
  loading?: boolean
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  parcelaNume,
  itemName,
  itemType,
  description,
  loading = false,
}: DeleteConfirmDialogProps) {
  const targetName = parcelaNume || itemName || 'elementul selectat'
  const targetType = itemType || 'Element'

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      itemName={targetName}
      itemType={targetType}
      description={description}
      loading={loading}
      title="Confirmi ștergerea?"
      cancelText="Anulează"
      confirmText="Șterge"
    />
  )
}
