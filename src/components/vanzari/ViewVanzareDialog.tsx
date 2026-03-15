'use client'

import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { type Vanzare } from '@/lib/supabase/queries/vanzari'

interface ViewVanzareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vanzare: Vanzare | null
  clientNume?: string
  clientTelefon?: string | null
  onEdit: (vanzare: Vanzare) => void
  onDelete: (vanzare: Vanzare) => void
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

function toPaymentStatus(statusPlata: string): 'platit' | 'neplatit' {
  const normalized = statusPlata?.trim().toLowerCase()
  return normalized === 'platit' ? 'platit' : 'neplatit'
}

export function ViewVanzareDialog({
  open,
  onOpenChange,
  vanzare,
  clientNume,
  clientTelefon,
  onEdit,
  onDelete,
}: ViewVanzareDialogProps) {
  if (!vanzare) return null

  const total = Number(vanzare.cantitate_kg || 0) * Number(vanzare.pret_lei_kg || 0)
  const paymentStatus = toPaymentStatus(vanzare.status_plata)

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
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Vânzare #{vanzare.id_vanzare || vanzare.id}
            </DialogTitle>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Inchide dialog">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </DialogHeader>

          <section className="border-b border-gray-100 py-4">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Client</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Nume</p>
                <p className="text-base font-medium text-gray-900">{clientNume || 'Nespecificat'}</p>
              </div>
              {clientTelefon ? (
                <div>
                  <p className="text-sm text-gray-500">Telefon</p>
                  <p className="text-base font-medium text-gray-900">{clientTelefon}</p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="border-b border-gray-100 py-4">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Detalii vânzare</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Cantitate</p>
                <p className="text-base font-medium text-gray-900">{formatKg(vanzare.cantitate_kg)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Preț/kg</p>
                <p className="text-base font-medium text-gray-900">{formatLei(vanzare.pret_lei_kg)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-lg font-bold text-gray-900">{formatLei(total)}</p>
              </div>
            </div>
          </section>

          <section className="border-b border-gray-100 py-4">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Plată</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Metodă plată</p>
                <p className="text-base font-medium text-gray-900">{vanzare.status_plata || 'Nespecificată'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="text-base font-medium text-gray-900">{paymentStatus}</p>
              </div>
            </div>
          </section>

          <section className="py-4">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Date</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Data vânzare</p>
                <p className="text-base font-medium text-gray-900">{formatDate(vanzare.data)}</p>
              </div>
              {vanzare.observatii_ladite?.trim() ? (
                <div>
                  <p className="text-sm text-gray-500">Observații</p>
                  <p className="text-base font-medium text-gray-900">{vanzare.observatii_ladite}</p>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 lg:gap-3">
          <Button
            type="button"
            variant="outline"
            className="lg:hover:opacity-95"
            onClick={() => {
              onOpenChange(false)
              onEdit(vanzare)
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
              onDelete(vanzare)
            }}
          >
            🗑️ Șterge
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
