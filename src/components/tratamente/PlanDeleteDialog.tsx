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

interface PlanDeleteDialogProps {
  countAplicari: number
  onConfirm: () => Promise<void> | void
  onOpenChange: (open: boolean) => void
  open: boolean
  pending?: boolean
  planName: string
}

export function PlanDeleteDialog({
  countAplicari,
  onConfirm,
  onOpenChange,
  open,
  pending = false,
  planName,
}: PlanDeleteDialogProps) {
  const blocked = countAplicari > 0

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ștergi planul?</AlertDialogTitle>
          <AlertDialogDescription>
            {blocked
              ? 'Planul are aplicări istorice și nu poate fi șters definitiv. Dezactivează-l în schimb ca să păstrezi istoricul.'
              : `Planul „${planName}” va fi șters definitiv împreună cu intervențiile și asocierile lui active.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {blocked ? (
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] p-3 text-sm text-[var(--text-secondary)]">
            Acest plan are {countAplicari} aplicări asociate și nu poate fi șters complet.
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Renunță</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending || blocked}
            className="bg-[var(--soft-danger-text)] text-white hover:opacity-90"
            onClick={(event) => {
              event.preventDefault()
              if (!blocked) {
                void onConfirm()
              }
            }}
          >
            {pending ? 'Se șterge...' : 'Șterge'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
