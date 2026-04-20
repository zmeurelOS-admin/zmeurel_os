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

interface PlanDeactivateDialogProps {
  isArchived: boolean
  onConfirm: () => Promise<void> | void
  onOpenChange: (open: boolean) => void
  open: boolean
  pending?: boolean
  planName: string
}

export function PlanDeactivateDialog({
  isArchived,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  planName,
}: PlanDeactivateDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isArchived ? 'Reactivezi planul?' : 'Dezactivezi planul?'}</AlertDialogTitle>
          <AlertDialogDescription>
            {isArchived
              ? `Planul „${planName}” va redeveni disponibil pentru selecții noi.`
              : `Planul „${planName}” va fi dezactivat și ascuns din selecțiile noi. Aplicările istorice rămân neschimbate.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Renunță</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              void onConfirm()
            }}
          >
            {pending ? 'Se salvează...' : isArchived ? 'Reactivează' : 'Dezactivează'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
