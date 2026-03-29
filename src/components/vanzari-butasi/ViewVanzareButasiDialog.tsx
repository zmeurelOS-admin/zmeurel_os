'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getStatusBadgeClass, STATUS_BADGE_LAYOUT_CLASS } from '@/lib/ui/status-badges'
import { type VanzareButasi, type VanzareButasiStatus } from '@/lib/supabase/queries/vanzari-butasi'

interface ViewVanzareButasiDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vanzare: VanzareButasi | null
  clientNume?: string
  clientTelefon?: string | null
  parcelaNume?: string
  onEdit: (vanzare: VanzareButasi) => void
  onDelete: (vanzare: VanzareButasi) => void
}

const statusClasses: Record<VanzareButasiStatus, string> = {
  noua: getStatusBadgeClass('noua'),
  confirmata: getStatusBadgeClass('confirmata'),
  pregatita: getStatusBadgeClass('pregatita'),
  livrata: getStatusBadgeClass('livrata'),
  anulata: getStatusBadgeClass('anulata'),
}

const statusLabels: Record<VanzareButasiStatus, string> = {
  noua: 'Nouă',
  confirmata: 'Confirmată',
  pregatita: 'Pregătită',
  livrata: 'Livrată',
  anulata: 'Anulată',
}

function formatLei(value: number): string {
  return `${value.toFixed(2)} lei`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Nespecificata'
  return new Date(value).toLocaleDateString('ro-RO')
}

export function ViewVanzareButasiDialog({
  open,
  onOpenChange,
  vanzare,
  clientNume,
  clientTelefon,
  parcelaNume,
  onEdit,
  onDelete,
}: ViewVanzareButasiDialogProps) {
  if (!vanzare) return null

  const items = vanzare.items ?? []
  const totalCantitate = items.reduce((sum, item) => sum + Number(item.cantitate), 0)
  const totalLei = Number(vanzare.total_lei)
  const avans = Number(vanzare.avans_suma || 0)
  const restDePlata = totalLei - avans
  const resolvedClient = clientNume || vanzare.client_nume_manual || 'Client necunoscut'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="mx-auto max-w-lg rounded-xl bg-[var(--agri-surface)] p-0 lg:max-w-2xl xl:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Dialog</DialogTitle>
        </DialogHeader>
        <div className="max-h-[85dvh] overflow-y-auto p-6">
          <DialogHeader className="mb-4 flex-row items-start justify-between gap-2 space-y-0 border-b border-[var(--agri-border)] py-4 text-left lg:gap-3">
            <div className="space-y-2">
              <DialogTitle className="text-xl font-semibold text-[var(--agri-text)]">
                Comandă material saditor #{vanzare.id_vanzare_butasi}
              </DialogTitle>
              <Badge className={`badge-consistent ${STATUS_BADGE_LAYOUT_CLASS} ${statusClasses[vanzare.status]}`}>
                {statusLabels[vanzare.status]}
              </Badge>
            </div>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Închide dialog">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </DialogHeader>

          <section className="border-b border-[var(--agri-border)] py-4">
            <h3 className="mb-3 text-base font-semibold text-[var(--agri-text)]">Client</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-[var(--agri-text-muted)]">Nume</p>
                <p className="text-base font-medium text-[var(--agri-text)]">{resolvedClient}</p>
              </div>
              {clientTelefon ? (
                <div>
                  <p className="text-sm text-[var(--agri-text-muted)]">Telefon</p>
                  <p className="text-base font-medium text-[var(--agri-text)]">{clientTelefon}</p>
                </div>
              ) : null}
              {vanzare.adresa_livrare ? (
                <div>
                  <p className="text-sm text-[var(--agri-text-muted)]">Adresa livrare</p>
                  <p className="text-base font-medium text-[var(--agri-text)]">{vanzare.adresa_livrare}</p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="border-b border-[var(--agri-border)] py-4">
            <h3 className="mb-3 text-base font-semibold text-[var(--agri-text)]">Articole</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-sm text-[var(--agri-text-muted)]">
                    <th className="px-2 py-2 font-medium">Soi</th>
                    <th className="px-2 py-2 font-medium">Cantitate</th>
                    <th className="px-2 py-2 font-medium">Preț unitar</th>
                    <th className="px-2 py-2 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? 'bg-[var(--agri-surface-muted)]' : ''}>
                      <td className="px-2 py-2 text-base font-medium text-[var(--agri-text)]">{item.soi}</td>
                      <td className="px-2 py-2 text-base font-medium text-[var(--agri-text)]">{Number(item.cantitate)} buc</td>
                      <td className="px-2 py-2 text-base font-medium text-[var(--agri-text)]">
                        {Number(item.pret_unitar).toFixed(2)} lei/buc
                      </td>
                      <td className="px-2 py-2 text-base font-medium text-[var(--agri-text)]">
                        {Number(item.subtotal).toFixed(2)} lei
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[var(--agri-surface-muted)]">
                    <td className="px-2 py-2 text-base font-semibold text-[var(--agri-text)]">TOTAL</td>
                    <td className="px-2 py-2 text-base font-semibold text-[var(--agri-text)]">{totalCantitate} buc</td>
                    <td className="px-2 py-2 text-base font-semibold text-[var(--agri-text)]">-</td>
                    <td className="px-2 py-2 text-base font-bold text-[var(--agri-text)]">{formatLei(totalLei)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="border-b border-[var(--agri-border)] py-4">
            <h3 className="mb-3 text-base font-semibold text-[var(--agri-text)]">Financiar</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-[var(--agri-text-muted)]">Total comandă</p>
                <p className="text-base font-medium text-[var(--agri-text)]">{formatLei(totalLei)}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--agri-text-muted)]">Avans primit</p>
                <p className="text-base font-medium text-[var(--agri-text)]">
                  {formatLei(avans)}
                  {vanzare.avans_data ? ` (${formatDate(vanzare.avans_data)})` : ''}
                </p>
              </div>
              <div>
                <p className="text-sm text-[var(--agri-text-muted)]">Rest de plată</p>
                <p className={`text-base font-medium ${restDePlata > 0 ? 'text-[var(--value-negative)]' : 'text-[var(--value-positive)]'}`}>
                  {formatLei(restDePlata)}
                </p>
              </div>
            </div>
          </section>

          <section className="py-4">
            <h3 className="mb-3 text-base font-semibold text-[var(--agri-text)]">Date</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-[var(--agri-text-muted)]">Data comandă</p>
                <p className="text-base font-medium text-[var(--agri-text)]">{formatDate(vanzare.data_comanda)}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--agri-text-muted)]">Livrare estimată</p>
                <p className="text-base font-medium text-[var(--agri-text)]">{formatDate(vanzare.data_livrare_estimata)}</p>
              </div>
              {parcelaNume ? (
                <div>
                  <p className="text-sm text-[var(--agri-text-muted)]">Teren sursă</p>
                  <p className="text-base font-medium text-[var(--agri-text)]">{parcelaNume}</p>
                </div>
              ) : null}
              {vanzare.observatii?.trim() ? (
                <div>
                  <p className="text-sm text-[var(--agri-text-muted)]">Observații</p>
                  <p className="text-base font-medium text-[var(--agri-text)]">{vanzare.observatii}</p>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--agri-border)] px-6 py-4 lg:gap-3">
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
