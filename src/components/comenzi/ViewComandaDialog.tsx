'use client'

import { MessageCircle, Phone, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
        className="fixed left-1/2 top-1/2 z-[100000101] w-[94vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-4 shadow-xl"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Dialog</DialogTitle>
        </DialogHeader>
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Inchide dialog"
            className="absolute top-3 right-3 h-8 w-8 text-gray-500"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>
        <div className="max-h-[82dvh] overflow-y-auto">
          <div className="flex flex-col gap-2 leading-tight pr-10">
            <section className="space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-left text-base font-semibold text-gray-900">{clientName}</p>
              </div>
              <p className="text-xs text-gray-500">Telefon</p>
              <p className="text-sm font-medium text-gray-900">{telefon || '-'}</p>
            </section>

            <section className="space-y-2 border-t border-gray-100 pt-2">
              <h3 className="text-sm font-semibold text-gray-900">Detalii comanda</h3>
              <div className="flex flex-col items-center text-center">
                <p className="text-xs text-gray-500">TOTAL</p>
                <p className="text-xl font-semibold text-gray-900">{formatLei(total)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-2">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Cantitate</p>
                  <p className="text-sm font-medium text-gray-900">{formatNumber(cantitate)} kg</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs text-gray-500">Pret per kg</p>
                  <p className="text-sm font-medium text-gray-900">{formatNumber(pretKg)} lei/kg</p>
                </div>
              </div>
            </section>

            {hasAvans ? (
              <section className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-2">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Avans</p>
                  <p className="text-sm font-medium text-gray-900">{formatLei(avans)}</p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs text-gray-500">Rest de incasat</p>
                  <p className="text-sm font-semibold text-red-600">{formatLei(restDePlata)}</p>
                </div>
              </section>
            ) : null}

            <section className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-2">
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Data comanda</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(comanda?.data_comanda)}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-xs text-gray-500">Data scadenta</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(comanda?.data_livrare)}</p>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-2">
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
              <section className="space-y-1 border-t border-gray-100 pt-2">
                {comanda?.locatie_livrare ? (
                  <>
                    <p className="text-xs text-gray-500">Locație livrare</p>
                    <p className="text-sm font-medium text-gray-900">{comanda.locatie_livrare}</p>
                  </>
                ) : null}
                {comanda?.observatii?.trim() ? (
                  <>
                    <p className="text-xs text-gray-500">Observații</p>
                    <p className="text-sm font-medium text-gray-900">{comanda.observatii}</p>
                  </>
                ) : null}
              </section>
            ) : null}

            {comanda?.status === 'livrata' && comanda?.linked_vanzare_id ? (
              <section className="border-t border-gray-100 pt-2">
                <div className="rounded-lg bg-green-50 p-2 text-sm text-green-700">
                  Livrată pe {formatDate(comanda?.updated_at)}. Vânzare de {formatLei(total)} creata automat.
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-2 border-t border-gray-100 px-3 py-3">
          {canDeliver ? (
            <Button
              type="button"
              className="h-10 min-w-[92px] bg-green-600 text-white hover:bg-green-700 lg:hover:opacity-95"
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
            className="h-10 min-w-[92px] text-gray-700 lg:hover:opacity-95"
            onClick={() => {
              if (!comanda) return
              onOpenChange(false)
              onEdit(comanda)
            }}
          >
            Editează
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-10 min-w-[92px] lg:hover:opacity-95"
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
