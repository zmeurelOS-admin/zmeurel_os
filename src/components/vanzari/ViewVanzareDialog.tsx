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
        className="mx-auto max-w-lg rounded-xl bg-[var(--surface-elevated)] p-0 lg:max-w-2xl xl:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Dialog</DialogTitle>
        </DialogHeader>
        <div className="max-h-[85dvh] overflow-y-auto p-6">
          <DialogHeader className="mb-4 flex-row items-start justify-between gap-2 space-y-0 border-b border-[var(--surface-divider)] py-4 text-left lg:gap-3">
            <DialogTitle className="text-xl font-semibold text-[var(--agri-text)]">
              Vânzare #{vanzare.id_vanzare || vanzare.id}
            </DialogTitle>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Închide dialog">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </DialogHeader>

          <section className="border-b border-[var(--surface-divider)] py-4">
            <h3 className="mb-3 text-base font-semibold text-[var(--agri-text)]">Client</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-[var(--agri-text-muted)]">Nume</p>
                <p className="text-base font-medium text-[var(--agri-text)]">{clientNume || 'Nespecificat'}</p>
              </div>
              {clientTelefon ? (
                <div>
                  <p className="text-sm text-[var(--agri-text-muted)]">Telefon</p>
                  <p className="text-base font-medium text-[var(--agri-text)]">{clientTelefon}</p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="border-b border-[var(--surface-divider)] py-4">
            <h3 className="mb-3 text-base font-semibold text-[var(--agri-text)]">Detalii vânzare</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-[var(--agri-text-muted)]">Cantitate</p>
                <p className="text-base font-medium text-[var(--agri-text)]">{formatKg(vanzare.cantitate_kg)}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--agri-text-muted)]">Preț/kg</p>
                <p className="text-base font-medium text-[var(--agri-text)]">{formatLei(vanzare.pret_lei_kg)}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--agri-text-muted)]">Total</p>
                <p className="text-lg font-bold text-[var(--agri-text)]">{formatLei(total)}</p>
              </div>
            </div>
          </section>

          <section className="border-b border-[var(--surface-divider)] py-4">
            <h3 className="mb-3 text-base font-semibold text-[var(--agri-text)]">Plată</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-[var(--agri-text-muted)]">Metodă plată</p>
                <p className="text-base font-medium text-[var(--agri-text)]">{vanzare.status_plata || 'Nespecificată'}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--agri-text-muted)]">Status</p>
                <p className="text-base font-medium text-[var(--agri-text)]">{paymentStatus}</p>
              </div>
            </div>
          </section>

          <section className="py-4">
            <h3 className="mb-3 text-base font-semibold text-[var(--agri-text)]">Date</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-[var(--agri-text-muted)]">Data vânzare</p>
                <p className="text-base font-medium text-[var(--agri-text)]">{formatDate(vanzare.data)}</p>
              </div>
              {vanzare.observatii_ladite?.trim() ? (
                <div>
                  <p className="text-sm text-[var(--agri-text-muted)]">Observații</p>
                  <p className="text-base font-medium text-[var(--agri-text)]">{vanzare.observatii_ladite}</p>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--surface-divider)] px-6 py-4 lg:gap-3">
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
