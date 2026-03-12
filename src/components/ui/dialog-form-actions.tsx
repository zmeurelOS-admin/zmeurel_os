'use client'

import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DialogFormActionsProps {
  onCancel: () => void
  onSave: () => void
  saving?: boolean
  saveLabel?: string
  cancelLabel?: string
  disabled?: boolean
  className?: string
}

export function DialogFormActions({
  onCancel,
  onSave,
  saving = false,
  saveLabel = 'Salvează',
  cancelLabel = 'Anulează',
  disabled = false,
  className,
}: DialogFormActionsProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4', className)}>
      <Button
        type="button"
        variant="outline"
        className="agri-cta h-11 rounded-xl text-sm sm:h-12"
        onClick={onCancel}
        disabled={disabled || saving}
      >
        {cancelLabel}
      </Button>
      <Button
        type="button"
        className="agri-cta h-11 rounded-xl bg-[var(--agri-primary)] text-sm text-white hover:bg-emerald-700 sm:h-12"
        onClick={onSave}
        disabled={disabled || saving}
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Se salvează...
          </>
        ) : (
          saveLabel
        )}
      </Button>
    </div>
  )
}
