'use client'

import { Pencil, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ActionIconsProps {
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}

export function ActionIcons({ onEdit, onDelete, className }: ActionIconsProps) {
  if (!onEdit && !onDelete) return null

  return (
    <div
      className={cn(
        'absolute right-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-[var(--agri-border)] bg-white/95 p-1 shadow-sm backdrop-blur',
        className
      )}
    >
      {onEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-10 w-10 rounded-lg p-0 text-gray-500 opacity-70 transition hover:bg-amber-50 hover:text-amber-700 hover:opacity-100 lg:h-9 lg:w-9"
          onClick={(event) => {
            event.stopPropagation()
            onEdit()
          }}
          aria-label="Editează"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-10 w-10 rounded-lg p-0 text-gray-500 opacity-70 transition hover:bg-red-50 hover:text-red-700 hover:opacity-100 lg:h-9 lg:w-9"
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          aria-label="Șterge"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  )
}
