'use client'

import { MessageCircle, Phone, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DIALOG_DETAIL_FOOTER_CLASS } from '@/lib/ui/modal-overlay-classes'
import { type Comanda } from '@/lib/supabase/queries/comenzi'

interface ViewComandaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  comanda: Comanda | null
  clientName: string
  clientTelefon?: string | null
  canDeliver: boolean
  onDeliver: (comanda: Comanda) => void
  onEdit: (comanda: Comanda) => void
  onDelete: (comanda: Comanda) => void
  /** Linii din același checkout magazin (heuristic pe telefon + zi). */
  magazinGroupLines?: Comanda[]
  magazinGroupTotal?: number
  /** ERP asociație: doar detalii, fără livrare/editare/ștergere fermă. */
  associationReadOnly?: boolean
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('ro-RO')
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatLei(value: number): string {
  return `${formatNumber(value)} lei`
}

export function ViewComandaDialog({
  open,
  onOpenChange,
  comanda,
  clientName,
  clientTelefon,
  canDeliver,
  onDeliver,
  onEdit,
  onDelete,
  magazinGroupLines,
  magazinGroupTotal,
  associationReadOnly = false,
}: ViewComandaDialogProps) {
  const total = Number(comanda?.total || 0)
  const cantitate = Number(comanda?.cantitate_kg || 0)
  const pretKg = Number(comanda?.pret_per_kg || 0)

  const financialRecord = (comanda ?? {}) as Comanda & {
    avans_suma?: number | null
    avans?: number | null
  }
  const avans = Number(financialRecord.avans_suma ?? financialRecord.avans ?? 0)
  const hasAvans = Number.isFinite(avans) && avans > 0
  const restDePlata = Math.max(0, total - avans)

  const telefon = (clientTelefon || comanda?.telefon || '').trim()
  const hasTelefon = telefon.length > 0
  const whatsappPhone = telefon.replace(/[^\d+]/g, '').replace(/^\+/, '')
  const whatsappCallUrl = hasTelefon && whatsappPhone ? `https://wa.me/${whatsappPhone}` : ''
  const whatsappMessageUrl =
    hasTelefon && whatsappPhone
      ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
          `Salut! Revin pentru comanda de ${formatNumber(cantitate)} kg (total ${formatLei(total)}).`
        )}`
      : ''
  const phoneUrl = hasTelefon ? `tel:${telefon}` : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="max-h-[85dvh] w-[94vw] max-w-[420px] overflow-hidden p-0 shadow-[var(--agri-elevated-shadow)]"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Dialog</DialogTitle>
        </DialogHeader>
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Închide dialog"
            className="absolute top-3 right-3 h-8 w-8 text-[var(--agri-text-muted)]"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>
        <div className="max-h-[82dvh] overflow-y-auto p-5 sm:p-6">
          <div className="flex flex-col gap-4 leading-tight pr-10">
            <section className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-left text-[1.02rem] leading-tight text-[var(--agri-text)] [font-weight:650]">{clientName}</p>
              </div>
              <p className="text-xs text-[var(--agri-text-muted)]">Telefon</p>
              <p className="text-sm font-medium text-[var(--agri-text)]">{telefon || '-'}</p>
            </section>

            {magazinGroupLines && magazinGroupLines.length > 0 ? (
              <section className="space-y-2 border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] pt-3">
                <p className="text-sm font-medium text-[var(--agri-text)]">Origine: Magazin</p>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm text-[var(--agri-text)] [font-weight:650]">Comandă din magazin</h3>
                  <Badge variant="info" className="text-[10px] font-semibold">
                    Magazin
                  </Badge>
                </div>
                <p className="text-xs text-[var(--agri-text-muted)]">
                  {magazinGroupLines.length}{' '}
                  {magazinGroupLines.length === 1 ? 'linie în grup' : 'linii în grup'} (aceeași solicitare).
                </p>
                <ul className="space-y-2">
                  {magazinGroupLines.map((line) => (
                    <li
                      key={line.id}
                      className="rounded-lg border border-[var(--agri-border)] bg-[var(--agri-surface-muted)] p-2 text-sm"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="text-[var(--agri-text-muted)]">
                          {formatNumber(Number(line.cantitate_kg || 0))} kg
                        </span>
                        <span className="font-semibold tabular-nums text-[var(--agri-text)]">
                          {formatLei(Number(line.total || 0))}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                {typeof magazinGroupTotal === 'number' ? (
                  <p className="text-sm font-semibold text-[var(--agri-text)]">
                    Total estimat grup: {formatLei(magazinGroupTotal)}
                  </p>
                ) : null}
              </section>
            ) : null}

            <section className="space-y-3 border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] pt-3">
              <h3 className="text-sm text-[var(--agri-text)] [font-weight:650]">Detalii comandă</h3>
              <div className="flex flex-col items-center text-center">
                <p className="text-xs text-[var(--agri-text-muted)]">TOTAL</p>
                <p className="text-xl font-semibold text-[var(--agri-text)]">{formatLei(total)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-[var(--agri-text-muted)]">Cantitate</p>
                  <p className="text-sm font-medium text-[var(--agri-text)]">{formatNumber(cantitate)} kg</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs text-[var(--agri-text-muted)]">Preț per kg</p>
                  <p className="text-sm font-medium text-[var(--agri-text)]">{formatNumber(pretKg)} lei/kg</p>
                </div>
              </div>
            </section>

            {hasAvans ? (
              <section className="grid grid-cols-2 gap-2 border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] pt-3">
                <div className="space-y-1">
                  <p className="text-xs text-[var(--agri-text-muted)]">Avans</p>
                  <p className="text-sm font-medium text-[var(--agri-text)]">{formatLei(avans)}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs text-[var(--agri-text-muted)]">Rest de încasat</p>
                  <p className="text-sm font-semibold text-[var(--value-negative)]">{formatLei(restDePlata)}</p>
                </div>
              </section>
            ) : null}

            <section className="grid grid-cols-2 gap-2 border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] pt-3">
              <div className="space-y-1">
                <p className="text-xs text-[var(--agri-text-muted)]">Data comandă</p>
                <p className="text-sm font-medium text-[var(--agri-text)]">{formatDate(comanda?.data_comanda)}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-xs text-[var(--agri-text-muted)]">Data scadentă</p>
                <p className="text-sm font-medium text-[var(--agri-text)]">{formatDate(comanda?.data_livrare)}</p>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-2 border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] pt-3">
              <Button
                type="button"
                variant="outline"
                className="h-9 justify-center gap-1.5"
                disabled={!hasTelefon}
                onClick={() => {
                  if (!whatsappCallUrl) return
                  window.open(whatsappCallUrl, '_blank', 'noopener,noreferrer')
                }}
              >
                <MessageCircle className="h-4 w-4 text-green-600" />
                WhatsApp Apel
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 justify-center gap-1.5"
                disabled={!hasTelefon}
                onClick={() => {
                  if (!whatsappMessageUrl) return
                  window.open(whatsappMessageUrl, '_blank', 'noopener,noreferrer')
                }}
              >
                <MessageCircle className="h-4 w-4 text-green-600" />
                WhatsApp Mesaj
              </Button>
              <Button
                type="button"
                variant="outline"
                className="col-span-2 h-9 justify-center gap-1.5"
                disabled={!hasTelefon}
                onClick={() => {
                  if (!phoneUrl) return
                  window.open(phoneUrl, '_self')
                }}
              >
                <Phone className="h-4 w-4" />
                Apel
              </Button>
            </section>

            {(comanda?.locatie_livrare || comanda?.observatii?.trim()) ? (
            <section className="space-y-2 border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] pt-3">
                {comanda?.locatie_livrare ? (
                  <>
                    <p className="text-xs text-[var(--agri-text-muted)]">Locație livrare</p>
                    <p className="text-sm font-medium text-[var(--agri-text)]">{comanda.locatie_livrare}</p>
                  </>
                ) : null}
                {comanda?.observatii?.trim() ? (
                  <>
                    <p className="text-xs text-[var(--agri-text-muted)]">Observații</p>
                    <p className="text-sm font-medium text-[var(--agri-text)]">{comanda.observatii}</p>
                  </>
                ) : null}
              </section>
            ) : null}

            {comanda?.status === 'livrata' && comanda?.linked_vanzare_id ? (
              <section className="border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] pt-3">
                <div className="rounded-lg border border-[var(--soft-success-border)] bg-[var(--soft-success-bg)] p-2 text-sm text-[var(--soft-success-text)]">
                  Livrată pe {formatDate(comanda?.updated_at)}. Vânzare de {formatLei(total)} creată automat.
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <div className={DIALOG_DETAIL_FOOTER_CLASS}>
          {associationReadOnly ? (
            <Button type="button" variant="outline" className="agri-cta w-full" onClick={() => onOpenChange(false)}>
              Închide
            </Button>
          ) : (
            <>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {canDeliver ? (
                  <Button
                    type="button"
                    className="agri-cta bg-green-600 text-white hover:opacity-95 lg:hover:opacity-95"
                    onClick={() => {
                      if (!comanda) return
                      onOpenChange(false)
                      onDeliver(comanda)
                    }}
                  >
                    Marchează livrată
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="agri-cta text-[var(--agri-text)] lg:hover:opacity-95"
                  onClick={() => {
                    if (!comanda) return
                    onOpenChange(false)
                    onEdit(comanda)
                  }}
                >
                  Editează
                </Button>
              </div>
              <Button
                type="button"
                variant="destructive"
                className="agri-cta shrink-0 lg:hover:opacity-95"
                onClick={() => {
                  if (!comanda) return
                  onOpenChange(false)
                  onDelete(comanda)
                }}
              >
                Șterge
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
