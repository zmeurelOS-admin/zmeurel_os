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

function getStatsPill(label: string, count: number) {
  const isApplied = label === 'Aplicate'
  return {
    className: isApplied ? 'bg-[#eaf3de] text-[#3b6d11]' : 'bg-[#e6f1fb] text-[#185fa5]',
    dotClassName: isApplied ? 'bg-[#3b6d11]' : 'bg-[#185fa5]',
    text: isApplied ? `${count} aplicate` : `${count} planificate`,
  }
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
  const statsPill = getStatsPill(label, count)

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
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statsPill.className}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${statsPill.dotClassName}`} />
          {statsPill.text}
        </span>
      </div>

      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[13px] font-medium text-[var(--text-primary)]">{label}</span>
        <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
          {count}
        </span>
      </div>

      {count > 0 ? (
        <div className="space-y-3">
          {aplicari.map((aplicare) => (
            <div
              key={aplicare.id}
              className="flex overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)]"
            >
              <div className="my-2.5 ml-2.5 w-[3px] shrink-0 rounded-full bg-[#3D7A5F]" />
              <div className="min-w-0 flex-1 p-3">
                <AplicareListItem aplicare={aplicare} parcelaId={parcelaId} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mr-2 mt-2 h-8 w-8 shrink-0 self-start text-[var(--text-secondary)] hover:text-destructive"
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
        <div className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--surface-card-muted)] px-4 py-3 text-[13px] text-[var(--text-secondary)]">
          {getEmptyMessage(label)}
        </div>
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
