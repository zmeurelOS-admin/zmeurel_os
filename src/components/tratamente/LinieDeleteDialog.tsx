'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface LinieDeleteDialogProps {
  onConfirm: () => Promise<void> | void
  onOpenChange: (open: boolean) => void
  open: boolean
  pending?: boolean
  stadiuLabel: string
}

export function LinieDeleteDialog({
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  stadiuLabel,
}: LinieDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
        <AlertDialogTitle>Ștergi intervenția?</AlertDialogTitle>
        <AlertDialogDescription>
            Ești sigur că vrei să ștergi intervenția pentru fenofaza {stadiuLabel}? Această acțiune nu afectează aplicările deja create.
        </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Renunță</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            className="bg-[var(--soft-danger-text)] text-white hover:opacity-90"
            onClick={(event) => {
              event.preventDefault()
              void onConfirm()
            }}
          >
            {pending ? 'Se șterge...' : 'Șterge intervenția'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
