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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getStatusBadgeClass, STATUS_BADGE_LAYOUT_CLASS } from '@/lib/ui/status-badges'
import { DIALOG_DETAIL_FOOTER_CLASS } from '@/lib/ui/modal-overlay-classes'
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
  const restDePlata = Math.max(0, totalLei - avans)
  const resolvedClient = clientNume || vanzare.client_nume_manual || 'Client necunoscut'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="max-h-[85dvh] max-w-lg overflow-hidden p-0 lg:max-w-2xl xl:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Dialog</DialogTitle>
        </DialogHeader>
        <div className="max-h-[85dvh] overflow-y-auto p-6">
          <DialogHeader className="mb-4 flex-row items-start justify-between gap-2 space-y-0 border-b border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] py-4 text-left lg:gap-3">
            <div className="space-y-2">
              <DialogTitle className="text-lg font-semibold tracking-[-0.02em] text-[var(--agri-text)] [font-weight:650]">
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

          <section className="border-b border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] py-4">
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

          <section className="border-b border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] py-4">
            <h3 className="mb-3 text-base font-semibold text-[var(--agri-text)]">Articole</h3>
            <div className="overflow-hidden rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="whitespace-normal text-left text-sm font-medium normal-case tracking-normal text-[var(--agri-text-muted)]">
                      Soi
                    </TableHead>
                    <TableHead className="whitespace-normal text-right text-sm font-medium normal-case tracking-normal text-[var(--agri-text-muted)]">
                      Cantitate
                    </TableHead>
                    <TableHead className="whitespace-normal text-right text-sm font-medium normal-case tracking-normal text-[var(--agri-text-muted)]">
                      Preț unitar
                    </TableHead>
                    <TableHead className="whitespace-normal text-right text-sm font-medium normal-case tracking-normal text-[var(--agri-text-muted)]">
                      Subtotal
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id} className={index % 2 === 0 ? 'bg-[var(--agri-surface-muted)]' : undefined}>
                      <TableCell className="whitespace-normal text-base font-medium text-[var(--agri-text)]">
                        {item.soi}
                      </TableCell>
                      <TableCell className="text-right text-base font-medium tabular-nums text-[var(--agri-text)]">
                        {Number(item.cantitate)} buc
                      </TableCell>
                      <TableCell className="text-right text-base font-medium tabular-nums text-[var(--agri-text)]">
                        {Number(item.pret_unitar).toFixed(2)} lei/buc
                      </TableCell>
                      <TableCell className="text-right text-base font-medium tabular-nums text-[var(--agri-text)]">
                        {Number(item.subtotal).toFixed(2)} lei
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-[var(--agri-surface-muted)] hover:bg-[var(--agri-surface-muted)] active:bg-[var(--agri-surface-muted)]">
                    <TableCell className="text-base font-semibold text-[var(--agri-text)]">TOTAL</TableCell>
                    <TableCell className="text-right text-base font-semibold tabular-nums text-[var(--agri-text)]">
                      {totalCantitate} buc
                    </TableCell>
                    <TableCell className="text-right text-base font-semibold tabular-nums text-[var(--agri-text)]">-</TableCell>
                    <TableCell className="text-right text-base font-bold tabular-nums text-[var(--agri-text)]">
                      {formatLei(totalLei)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="border-b border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] py-4">
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

        <div className={DIALOG_DETAIL_FOOTER_CLASS}>
          <Button
            type="button"
            variant="outline"
            className="agri-cta"
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
            className="agri-cta"
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
