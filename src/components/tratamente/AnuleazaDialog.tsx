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
import { Textarea } from '@/components/ui/textarea'

interface AnuleazaDialogProps {
  motiv: string
  onConfirm: () => Promise<void> | void
  onMotivChange: (value: string) => void
  onOpenChange: (open: boolean) => void
  open: boolean
  pending?: boolean
}

export function AnuleazaDialog({
  motiv,
  onConfirm,
  onMotivChange,
  onOpenChange,
  open,
  pending = false,
}: AnuleazaDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Anulezi aplicarea?</AlertDialogTitle>
          <AlertDialogDescription>
            Poți lăsa un motiv scurt pentru istoric. Aplicarea va rămâne înregistrată cu status anulat.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          rows={4}
          value={motiv}
          onChange={(event) => onMotivChange(event.target.value)}
          placeholder="Ex: Fereastră meteo nefavorabilă."
        />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Înapoi</AlertDialogCancel>
          <Button
            type="button"
            className="bg-[var(--status-danger-text)] text-white"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? 'Se salvează...' : 'Confirmă anularea'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
