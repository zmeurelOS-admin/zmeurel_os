'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

import { deleteAplicareAction } from '@/app/(dashboard)/parcele/[id]/tratamente/aplicare/[aplicareId]/actions'
import { AplicareListItem } from '@/components/tratamente/AplicareListItem'
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
import { AppCard } from '@/components/ui/app-card'
import { Button } from '@/components/ui/button'
import type { AplicareTratamentDetaliu } from '@/lib/supabase/queries/tratamente'
import { toast } from '@/lib/ui/toast'

interface AplicareListaClientProps {
  aplicari: AplicareTratamentDetaliu[]
  parcelaId: string
  label: string
  count: number
}

function getEmptyMessage(label: string): string {
  return label === 'Aplicate'
    ? 'Nu există aplicări efectuate în acest sezon.'
    : 'Nu există aplicări planificate în acest sezon.'
}

export function AplicareListaClient({
  aplicari,
  parcelaId,
  label,
  count,
}: AplicareListaClientProps) {
  const router = useRouter()
  const [selectedAplicare, setSelectedAplicare] = useState<AplicareTratamentDetaliu | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!selectedAplicare) return

    startTransition(async () => {
      const result = await deleteAplicareAction(selectedAplicare.id, parcelaId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success('Aplicarea a fost ștearsă definitiv.')
      setSelectedAplicare(null)
      router.refresh()
    })
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base text-[var(--text-primary)] [font-weight:650]">{label}</h2>
        <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
          {count}
        </span>
      </div>

      {count > 0 ? (
        <div className="space-y-3">
          {aplicari.map((aplicare) => (
            <div key={aplicare.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <AplicareListItem aplicare={aplicare} parcelaId={parcelaId} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-1 h-8 w-8 shrink-0 text-[var(--text-secondary)] hover:text-destructive"
                aria-label="Șterge aplicarea"
                disabled={isPending}
                onClick={() => setSelectedAplicare(aplicare)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <AppCard className="rounded-2xl border-dashed bg-[var(--surface-card-muted)] p-4">
          <p className="text-sm text-[var(--text-secondary)]">{getEmptyMessage(label)}</p>
        </AppCard>
      )}

      <AlertDialog open={selectedAplicare !== null} onOpenChange={(open) => (!open ? setSelectedAplicare(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Șterge aplicarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Această acțiune este ireversibilă. Aplicarea și toate produsele asociate vor fi șterse permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Anulează</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault()
                handleDelete()
              }}
            >
              {isPending ? 'Se șterge...' : 'Șterge definitiv'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
