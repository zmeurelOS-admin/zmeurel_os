'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getStatusBadgeClass, STATUS_BADGE_LAYOUT_CLASS } from '@/lib/ui/status-badges'
import type { Client } from '@/lib/supabase/queries/clienti'
import type { Comanda } from '@/lib/supabase/queries/comenzi'
import { downloadVCard } from '@/lib/utils/downloadVCard'

interface ClientDetailsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client | null
  comenzi: Comanda[]
  isLoadingComenzi?: boolean
  onEdit: (client: Client) => void
  onDelete: (client: Client) => void
}

const statusLabelMap: Record<string, string> = {
  noua: 'Nouă',
  confirmata: 'Confirmată',
  programata: 'Programată',
  in_livrare: 'În livrare',
  livrata: 'Livrată',
  anulata: 'Anulată',
}

const statusClassMap: Record<string, string> = {
  noua: getStatusBadgeClass('noua'),
  confirmata: getStatusBadgeClass('confirmata'),
  programata: getStatusBadgeClass('pregatita'),
  in_livrare: getStatusBadgeClass('pregatita'),
  livrata: getStatusBadgeClass('livrata'),
  anulata: getStatusBadgeClass('anulata'),
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('ro-RO')
}

function formatKg(value: number): string {
  return `${Number(value || 0).toFixed(2)} kg`
}

function formatLei(value: number): string {
  return `${Number(value || 0).toFixed(2)} lei`
}

export function ClientDetailsDrawer({
  open,
  onOpenChange,
  client,
  comenzi,
  isLoadingComenzi = false,
  onEdit,
  onDelete,
}: ClientDetailsDrawerProps) {
  if (!client) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[85dvh] rounded-t-2xl rounded-b-none p-0 sm:max-h-[80vh] sm:rounded-2xl sm:p-0"
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Detalii client</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[85dvh] flex-col sm:max-h-[80vh]">
          <DialogHeader className="border-b border-[var(--agri-border)] px-4 py-4 text-left">
            <DialogTitle>Detalii client</DialogTitle>
            <DialogDescription>Informații de contact și comenzi asociate</DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">
                Client
              </h3>
              <div className="space-y-3 rounded-xl border border-[var(--agri-border)] bg-white p-3">
                <p className="text-base font-semibold text-[var(--agri-text)]">{client.nume_client}</p>
                <p className="text-sm text-[var(--agri-text-muted)]">Telefon: {client.telefon || '-'}</p>
                <p className="text-sm text-[var(--agri-text-muted)]">Locație livrare: {client.adresa || '-'}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10"
                    disabled={!client.telefon}
                    onClick={() => {
                      if (!client.telefon) return
                      downloadVCard(client.nume_client, client.telefon)
                    }}
                  >
                    Salvează contact
                  </Button>
                  <a
                    href={client.telefon ? `tel:${client.telefon}` : undefined}
                    className={`inline-flex h-10 items-center justify-center rounded-xl border text-sm font-medium ${
                      client.telefon
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'pointer-events-none border-slate-200 bg-slate-100 text-slate-400'
                    }`}
                  >
                    Sună
                  </a>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">
                Comenzi asociate
              </h3>

              {isLoadingComenzi ? (
                <p className="text-sm text-[var(--agri-text-muted)]">Se încarcă comenzile...</p>
              ) : null}

              {!isLoadingComenzi && comenzi.length === 0 ? (
                <p className="rounded-xl border border-[var(--agri-border)] bg-white p-3 text-sm text-[var(--agri-text-muted)]">
                  Nu există comenzi asociate pentru acest client.
                </p>
              ) : null}

              {!isLoadingComenzi && comenzi.length > 0 ? (
                <div className="space-y-2">
                  {comenzi.map((comanda) => {
                    const statusLabel = statusLabelMap[comanda.status] || comanda.status
                    const statusClass = statusClassMap[comanda.status] || getStatusBadgeClass(comanda.status)

                    return (
                      <div key={comanda.id} className="rounded-xl border border-[var(--agri-border)] bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1 text-sm">
                            <p className="text-[var(--agri-text-muted)]">
                              Data: {formatDate(comanda.data_livrare || comanda.data_comanda)}
                            </p>
                            <p className="text-[var(--agri-text-muted)]">
                              Cantitate: <span className="value-kg">{formatKg(comanda.cantitate_kg)}</span>
                            </p>
                            <p className="font-semibold text-[var(--agri-text)]">
                              Suma: <span className="value-money-positive">{formatLei(comanda.total)}</span>
                            </p>
                          </div>
                          <Badge className={`badge-consistent ${STATUS_BADGE_LAYOUT_CLASS} ${statusClass}`}>
                            {statusLabel}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </section>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-[var(--agri-border)] p-4">
            <Button type="button" variant="outline" className="agri-cta h-11" onClick={() => onEdit(client)}>
              Editează
            </Button>
            <Button
              type="button"
              className="agri-cta h-11 bg-[var(--agri-danger)] text-white hover:bg-red-700"
              onClick={() => onDelete(client)}
            >
              Șterge
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
