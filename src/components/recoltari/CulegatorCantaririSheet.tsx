'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'

import { BottomSheet, Button, Notice, kitText } from '@/components/kit'
import { getHarvestCropSelection, stripHiddenAgricultureMetadata } from '@/lib/parcele/crop-config'
import type { RecoltareWorkerAggregate } from '@/lib/recoltari/aggregate-by-culegator'
import { formatKg, formatLei, formatTarif } from '@/lib/recoltari/day-view'
import { getRecoltareDeleteImpact } from '@/lib/supabase/queries/miscari-stoc'
import { getRecoltareTotalKg, type Recoltare } from '@/lib/supabase/queries/recoltari'
import { cn } from '@/lib/utils'

import { cropText } from './RecoltareKgChoices'

export interface CulegatorCantaririSheetProps {
  open: boolean
  /** Referință stabilă (setter sau `useCallback`). */
  onOpenChange: (open: boolean) => void
  /** Culegătorul deschis, cu recoltările lui din ziua afișată. */
  worker: RecoltareWorkerAggregate | null
  parcelaName: (parcelaId: string | null) => string
  canEdit: boolean
  canDelete: boolean
  onEdit: (recoltare: Recoltare) => void
  /** Ștergerea confirmată (pagina o programează, cu anulare). */
  onDelete: (recoltare: Recoltare) => void
}

function timeOf(recoltare: Recoltare): string {
  const created = new Date(recoltare.created_at)
  if (Number.isNaN(created.getTime())) return ''
  return created.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Cântăririle unui culegător într-o zi: detaliile fiecăreia, „Editează” și „Șterge”.
 * Confirmarea ștergerii ține locul listei, în aceeași foaie (fără a doua fereastră deasupra).
 */
export function CulegatorCantaririSheet({
  open,
  onOpenChange,
  worker,
  parcelaName,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: CulegatorCantaririSheetProps) {
  // Ultimul culegător afișat rămâne pe ecran cât se animă închiderea foii.
  const [shown, setShown] = useState<RecoltareWorkerAggregate | null>(worker)
  if (worker && worker !== shown) setShown(worker)

  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) setConfirmingId(null)
  }

  const confirming = shown?.harvests.find((item) => item.id === confirmingId) ?? null

  const impact = useQuery({
    queryKey: ['recoltare-delete-impact', confirming?.id ?? null],
    queryFn: () => getRecoltareDeleteImpact(confirming!.id),
    enabled: Boolean(confirming),
    staleTime: 10000,
    refetchOnWindowFocus: false,
  })
  const blocked = impact.data?.hasDownstreamSales === true

  if (!shown) return null

  if (confirming) {
    return (
      <BottomSheet
        open={open}
        onOpenChange={onOpenChange}
        title={`Ștergi cântărirea de ${formatKg(getRecoltareTotalKg(confirming))}?`}
        description={`${shown.workerName} · ${parcelaName(confirming.parcela_id)} · ${timeOf(confirming)}`}
        footer={
          <div className="flex flex-col gap-2.5">
            <Button
              type="button"
              variant="danger"
              size="touch-lg"
              className="w-full"
              disabled={blocked || impact.isLoading}
              loading={impact.isLoading}
              onClick={() => {
                onDelete(confirming)
                setConfirmingId(null)
              }}
            >
              <Trash2 aria-hidden />
              Șterge cântărirea
            </Button>
            <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => setConfirmingId(null)}>
              Renunță
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {blocked ? (
            <Notice tone="danger" title="Nu poate fi ștearsă">
              Kilogramele din această recoltare sunt deja vândute sau promise în comenzi.
            </Notice>
          ) : impact.data?.hasStock ? (
            <Notice tone="warning" title={`Se scad ${formatKg(impact.data.stockToRemoveKg)} din stoc`}>
              Ai 5 secunde să anulezi, din notificarea care apare după ștergere.
            </Notice>
          ) : impact.isError ? (
            <Notice tone="warning" title="Nu am putut verifica stocul">
              Dacă recoltarea e deja vândută, ștergerea va fi refuzată și rândul revine în listă.
            </Notice>
          ) : (
            <p className={cn('text-fg-muted', kitText.secondary)}>
              Ai 5 secunde să anulezi, din notificarea care apare după ștergere.
            </p>
          )}
        </div>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={shown.workerName}
      description={`${shown.harvestCount === 1 ? 'O cântărire' : `${shown.harvestCount} cântăriri`} · ${formatKg(shown.totalKg)} · ${formatLei(shown.totalPaymentLei)}`}
    >
      <ul className="space-y-3">
        {shown.harvests.map((recoltare) => {
          const crop = cropText(getHarvestCropSelection(recoltare.observatii))
          const note = stripHiddenAgricultureMetadata(recoltare.observatii)
          return (
            <li key={recoltare.id} className="rounded-box border-2 border-border bg-surface p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className={cn('font-extrabold text-fg', kitText.section)}>{formatKg(getRecoltareTotalKg(recoltare))}</span>
                <span className={cn('shrink-0 text-fg-muted', kitText.secondary)}>{timeOf(recoltare)}</span>
              </div>

              <dl className={cn('mt-2 space-y-1 text-fg', kitText.secondary)}>
                <Detaliu label="Parcelă" value={[parcelaName(recoltare.parcela_id), crop].filter(Boolean).join(' · ')} />
                <Detaliu
                  label="Calitate"
                  value={
                    recoltare.kg_cal2 > 0
                      ? `Cal. 1: ${formatKg(recoltare.kg_cal1)} · Cal. 2: ${formatKg(recoltare.kg_cal2)}`
                      : `Cal. 1: ${formatKg(recoltare.kg_cal1)}`
                  }
                />
                <Detaliu
                  label="Plată"
                  value={`${formatLei(recoltare.valoare_munca_lei)} (${formatTarif(recoltare.pret_lei_pe_kg_snapshot)})`}
                />
                {note ? <Detaliu label="Notă" value={note} /> : null}
              </dl>

              {canEdit || canDelete ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {canEdit ? (
                    <Button type="button" variant="neutral" size="touch" onClick={() => onEdit(recoltare)}>
                      <Pencil aria-hidden />
                      Editează
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      type="button"
                      variant="quiet"
                      size="touch"
                      className="text-danger-text"
                      onClick={() => setConfirmingId(recoltare.id)}
                    >
                      <Trash2 aria-hidden />
                      Șterge
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </BottomSheet>
  )
}

function Detaliu({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-fg-muted">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{value}</dd>
    </div>
  )
}
