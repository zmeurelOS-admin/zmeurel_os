'use client'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

interface GenereazaAplicariDialogProps {
  creatableCount: number
  open: boolean
  onConfirm: () => Promise<void> | void
  onOpenChange: (open: boolean) => void
  pending?: boolean
  skippedCount: number
}

export function GenereazaAplicariDialog({
  creatableCount,
  open,
  onConfirm,
  onOpenChange,
  pending = false,
  skippedCount,
}: GenereazaAplicariDialogProps) {
  const hasAplicari = creatableCount > 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Generează aplicări</AlertDialogTitle>
          <AlertDialogDescription>
            {hasAplicari
              ? `Se vor crea ${creatableCount} aplicări planificate pe baza planului și a fenofazelor înregistrate. Continui?`
              : 'Nu există aplicări noi de generat pentru planul și fenofazele înregistrate acum.'}
            {skippedCount > 0 ? ` ${skippedCount} aplicări existau deja și vor fi ignorate.` : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{hasAplicari ? 'Anulează' : 'Închide'}</AlertDialogCancel>
          <Button
            type="button"
            className="bg-[var(--agri-primary)] text-white"
            disabled={pending || !hasAplicari}
            onClick={async () => {
              await onConfirm()
            }}
          >
            {pending ? 'Se generează...' : 'Generează aplicări'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
