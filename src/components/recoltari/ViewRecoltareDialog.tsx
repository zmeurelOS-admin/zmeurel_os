'use client'

import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { type Recoltare } from '@/lib/supabase/queries/recoltari'

interface ViewRecoltareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recoltare: Recoltare | null
  parcelaNume?: string
  parcelaTip?: string
  culegatorNume?: string
  onEdit: (recoltare: Recoltare) => void
  onDelete: (recoltare: Recoltare) => void
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ro-RO')
}

function formatKg(value: number): string {
  return `${Number(value || 0).toFixed(2)} kg`
}

function formatLei(value: number): string {
  return `${Number(value || 0).toFixed(2)} lei`
}

export function ViewRecoltareDialog({
  open,
  onOpenChange,
  recoltare,
  parcelaNume,
  parcelaTip,
  culegatorNume,
  onEdit,
  onDelete,
}: ViewRecoltareDialogProps) {
  if (!recoltare) return null

  const kgCal1 = Number(recoltare.kg_cal1 || 0)
  const kgCal2 = Number(recoltare.kg_cal2 || 0)
  const totalKg = kgCal1 + kgCal2
  const title = parcelaNume ? `Recoltare - ${parcelaNume}` : `Recoltare #${recoltare.id_recoltare || recoltare.id}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="mx-auto max-w-lg rounded-xl bg-white p-0 lg:max-w-2xl xl:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Dialog</DialogTitle>
        </DialogHeader>
        <div className="max-h-[85dvh] overflow-y-auto p-6">
          <DialogHeader className="mb-4 flex-row items-start justify-between gap-2 space-y-0 border-b border-gray-100 py-4 text-left lg:gap-3">
            <DialogTitle className="text-xl font-semibold text-gray-900">{title}</DialogTitle>
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
                <p className="text-sm text-gray-500">Parcelă</p>
                <div className="flex items-center gap-2">
                  <p className="text-base font-medium text-gray-900">{parcelaNume || 'Nespecificata'}</p>
                  {parcelaTip ? (
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                      {parcelaTip}
                    </span>
                  ) : null}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Culegator</p>
                <p className="text-base font-medium text-gray-900">{culegatorNume || 'Nespecificat'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Data</p>
                <p className="text-base font-medium text-gray-900">{formatDate(recoltare.data)}</p>
              </div>
            </div>
          </section>

          <section className="border-b border-gray-100 py-4">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Cantitati</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Cal1</p>
                <p className="text-base font-medium text-gray-900">{formatKg(kgCal1)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Cal2</p>
                <p className="text-base font-medium text-gray-900">{formatKg(kgCal2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-base font-bold text-gray-900">{formatKg(totalKg)}</p>
              </div>
            </div>
          </section>

          <section className="border-b border-gray-100 py-4">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Financiar</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Pret/kg</p>
                <p className="text-base font-medium text-gray-900">
                  {formatLei(Number(recoltare.pret_lei_pe_kg_snapshot || 0))}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Valoare munca</p>
                <p className="text-base font-medium text-gray-900">{formatLei(Number(recoltare.valoare_munca_lei || 0))}</p>
              </div>
            </div>
          </section>

          {recoltare.observatii?.trim() ? (
            <section className="py-4">
              <h3 className="mb-3 text-base font-semibold text-gray-900">Observații</h3>
              <p className="text-base font-medium text-gray-900">{recoltare.observatii}</p>
            </section>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 lg:gap-3">
          <Button
            type="button"
            variant="outline"
            className="lg:hover:opacity-95"
            onClick={() => {
              onOpenChange(false)
              onEdit(recoltare)
            }}
          >
            ✏️ Editează
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="lg:hover:opacity-95"
            onClick={() => {
              onOpenChange(false)
              onDelete(recoltare)
            }}
          >
            🗑️ Șterge
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
