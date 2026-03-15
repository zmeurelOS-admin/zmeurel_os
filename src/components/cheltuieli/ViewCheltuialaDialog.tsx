'use client'

import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Cheltuiala } from '@/lib/supabase/queries/cheltuieli'

interface ViewCheltuialaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cheltuiala: Cheltuiala | null
  onEdit: (cheltuiala: Cheltuiala) => void
  onDelete: (cheltuiala: Cheltuiala) => void
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ro-RO')
}

function formatLei(value: number): string {
  return `${Number(value || 0).toFixed(2)} lei`
}

export function ViewCheltuialaDialog({
  open,
  onOpenChange,
  cheltuiala,
  onEdit,
  onDelete,
}: ViewCheltuialaDialogProps) {
  if (!cheltuiala) return null

  const extended = cheltuiala as Cheltuiala & { metoda_plata?: string | null }
  const metodaPlata = extended.metoda_plata || 'Nespecificata'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="mx-auto max-w-lg rounded-xl bg-white p-0 lg:max-w-2xl xl:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Dialog</DialogTitle>
        </DialogHeader>
        <div className="max-h-[85dvh] overflow-y-auto p-6">
          <DialogHeader className="mb-4 flex-row items-start justify-between gap-2 space-y-0 border-b border-gray-100 py-4 text-left lg:gap-3">
            <DialogTitle className="text-xl font-semibold text-gray-900">Cheltuială</DialogTitle>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Inchide dialog">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </DialogHeader>

          <section className="border-b border-gray-100 py-4">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Detalii</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Categorie</p>
                <p className="text-base font-medium text-gray-900">{cheltuiala.categorie || 'Nespecificata'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Furnizor</p>
                <p className="text-base font-medium text-gray-900">{cheltuiala.furnizor || 'Nespecificat'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Descriere</p>
                <p className="text-base font-medium text-gray-900">{cheltuiala.descriere || '-'}</p>
              </div>
            </div>
          </section>

          <section className="border-b border-gray-100 py-4">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Financiar</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Sumă</p>
                <p className="text-lg font-bold text-gray-900">{formatLei(cheltuiala.suma_lei)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Metodă plată</p>
                <p className="text-base font-medium text-gray-900">{metodaPlata}</p>
              </div>
            </div>
          </section>

          <section className="border-b border-gray-100 py-4">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Date</h3>
            <div>
              <p className="text-sm text-gray-500">Data</p>
              <p className="text-base font-medium text-gray-900">{formatDate(cheltuiala.data)}</p>
            </div>
          </section>

          <section className="py-4">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Document</h3>
            {cheltuiala.document_url ? (
              <a
                href={cheltuiala.document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-emerald-700 hover:underline"
              >
                Vezi atașament
              </a>
            ) : (
              <p className="text-base font-medium text-gray-900">Fără atașament</p>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="h-10 min-w-[100px]"
            onClick={() => {
              onOpenChange(false)
              onEdit(cheltuiala)
            }}
          >
            ✏️ Editează
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-10 min-w-[100px]"
            onClick={() => {
              onOpenChange(false)
              onDelete(cheltuiala)
            }}
          >
            🗑️ Șterge
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
