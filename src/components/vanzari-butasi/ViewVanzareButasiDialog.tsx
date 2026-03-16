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
        className="mx-auto max-w-lg rounded-xl bg-white p-0 lg:max-w-2xl xl:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Dialog</DialogTitle>
        </DialogHeader>
        <div className="max-h-[85dvh] overflow-y-auto p-6">
          <DialogHeader className="mb-4 flex-row items-start justify-between gap-2 space-y-0 border-b border-gray-100 py-4 text-left lg:gap-3">
            <div className="space-y-2">
              <DialogTitle className="text-xl font-semibold text-gray-900">
                Comandă material saditor #{vanzare.id_vanzare_butasi}
              </DialogTitle>
              <Badge className={`badge-consistent ${STATUS_BADGE_LAYOUT_CLASS} ${statusClasses[vanzare.status]}`}>
                {statusLabels[vanzare.status]}
              </Badge>
            </div>
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
                <p className="text-base font-medium text-gray-900">{resolvedClient}</p>
              </div>
              {clientTelefon ? (
                <div>
                  <p className="text-sm text-gray-500">Telefon</p>
                  <p className="text-base font-medium text-gray-900">{clientTelefon}</p>
                </div>
              ) : null}
              {vanzare.adresa_livrare ? (
                <div>
                  <p className="text-sm text-gray-500">Adresa livrare</p>
                  <p className="text-base font-medium text-gray-900">{vanzare.adresa_livrare}</p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="border-b border-gray-100 py-4">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Articole</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-sm text-gray-500">
                    <th className="px-2 py-2 font-medium">Soi</th>
                    <th className="px-2 py-2 font-medium">Cantitate</th>
                    <th className="px-2 py-2 font-medium">Preț unitar</th>
                    <th className="px-2 py-2 font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="px-2 py-2 text-base font-medium text-gray-900">{item.soi}</td>
                      <td className="px-2 py-2 text-base font-medium text-gray-900">{Number(item.cantitate)} buc</td>
                      <td className="px-2 py-2 text-base font-medium text-gray-900">
                        {Number(item.pret_unitar).toFixed(2)} lei/buc
                      </td>
                      <td className="px-2 py-2 text-base font-medium text-gray-900">
                        {Number(item.subtotal).toFixed(2)} lei
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50">
                    <td className="px-2 py-2 text-base font-semibold text-gray-900">TOTAL</td>
                    <td className="px-2 py-2 text-base font-semibold text-gray-900">{totalCantitate} buc</td>
                    <td className="px-2 py-2 text-base font-semibold text-gray-900">-</td>
                    <td className="px-2 py-2 text-base font-bold text-gray-900">{formatLei(totalLei)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="border-b border-gray-100 py-4">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Financiar</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Total comandă</p>
                <p className="text-base font-medium text-gray-900">{formatLei(totalLei)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Avans primit</p>
                <p className="text-base font-medium text-gray-900">
                  {formatLei(avans)}
                  {vanzare.avans_data ? ` (${formatDate(vanzare.avans_data)})` : ''}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Rest de plată</p>
                <p className={`text-base font-medium ${restDePlata > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatLei(restDePlata)}
                </p>
              </div>
            </div>
          </section>

          <section className="py-4">
            <h3 className="mb-3 text-base font-semibold text-gray-900">Date</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-500">Data comandă</p>
                <p className="text-base font-medium text-gray-900">{formatDate(vanzare.data_comanda)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Livrare estimată</p>
                <p className="text-base font-medium text-gray-900">{formatDate(vanzare.data_livrare_estimata)}</p>
              </div>
              {parcelaNume ? (
                <div>
                  <p className="text-sm text-gray-500">Teren sursă</p>
                  <p className="text-base font-medium text-gray-900">{parcelaNume}</p>
                </div>
              ) : null}
              {vanzare.observatii?.trim() ? (
                <div>
                  <p className="text-sm text-gray-500">Observații</p>
                  <p className="text-base font-medium text-gray-900">{vanzare.observatii}</p>
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
