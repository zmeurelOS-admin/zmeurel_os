'use client'

import { MessageCircle, Phone, X } from 'lucide-react'

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
          <div className="flex flex-col gap-2 leading-tight pr-10">
            <section className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-left text-base font-semibold text-[var(--agri-text)]">{clientName}</p>
              </div>
              <p className="text-xs text-[var(--agri-text-muted)]">Telefon</p>
              <p className="text-sm font-medium text-[var(--agri-text)]">{telefon || '-'}</p>
            </section>

            <section className="space-y-2 border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] pt-2">
              <h3 className="text-sm font-semibold text-[var(--agri-text)]">Detalii comandă</h3>
              <div className="flex flex-col items-center text-center">
                <p className="text-xs text-[var(--agri-text-muted)]">TOTAL</p>
                <p className="text-xl font-semibold text-[var(--agri-text)]">{formatLei(total)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-[var(--agri-surface-muted)] p-2">
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
              <section className="grid grid-cols-2 gap-2 border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] pt-2">
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

            <section className="grid grid-cols-2 gap-2 border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] pt-2">
              <div className="space-y-1">
                <p className="text-xs text-[var(--agri-text-muted)]">Data comandă</p>
                <p className="text-sm font-medium text-[var(--agri-text)]">{formatDate(comanda?.data_comanda)}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-xs text-[var(--agri-text-muted)]">Data scadentă</p>
                <p className="text-sm font-medium text-[var(--agri-text)]">{formatDate(comanda?.data_livrare)}</p>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-2 border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] pt-2">
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
            <section className="space-y-1 border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] pt-2">
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
              <section className="border-t border-[color:color-mix(in_srgb,var(--agri-border)_55%,transparent)] pt-2">
                <div className="rounded-lg border border-[var(--soft-success-border)] bg-[var(--soft-success-bg)] p-2 text-sm text-[var(--soft-success-text)]">
                  Livrată pe {formatDate(comanda?.updated_at)}. Vânzare de {formatLei(total)} creată automat.
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <div className={DIALOG_DETAIL_FOOTER_CLASS}>
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
                LIVRAT!
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
