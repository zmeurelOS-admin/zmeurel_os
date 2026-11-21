'use client'

import { useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Flag, Truck } from 'lucide-react'

import { BottomSheet, Button, CheckRow, Notice, ProgressBar, StatusPill, kitText } from '@/components/kit'
import {
  defaultDeliverySelection,
  deliveryCandidates,
  localitateScurta,
  parseStocInsuficient,
  planDelivery,
} from '@/lib/comenzi/day-view'
import { formatKg, formatLei } from '@/lib/format-ro'
import { queryKeys } from '@/lib/query-keys'
import { getComenziStockSummaryAzi, updateComanda, type Comanda } from '@/lib/supabase/queries/comenzi'
import { toast } from '@/lib/ui/toast'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

import { invalidateDupaComanda } from './useComandaActions'

export interface PuneInLivrareSheetProps {
  open: boolean
  /** Referință stabilă (setter sau `useCallback`). */
  onOpenChange: (open: boolean) => void
  /** Comenzile de pe „Azi” (cele deja în livrare sunt ignorate). */
  aziComenzi: readonly Comanda[]
  clientName: (comanda: Comanda) => string
  /** Stocul cal. 1 disponibil acum (`get_sellable_cal1_stock_summary`). `null` = încă se încarcă. */
  stocDisponibilKg: number | null
}

/**
 * „Pune în livrare azi”: listă bifabilă, cu prioritarele sus și bifate. „Rămas în stoc” scade la fiecare bifă,
 * iar o comandă care nu mai încape e blocată. Garda reală e pe server (`set_comanda_in_delivery`).
 */
export function PuneInLivrareSheet({ open, onOpenChange, aziComenzi, clientName, stocDisponibilKg }: PuneInLivrareSheetProps) {
  const queryClient = useQueryClient()
  const candidates = useMemo(() => deliveryCandidates(aziComenzi), [aziComenzi])

  const [selected, setSelected] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)

  // La fiecare deschidere: prioritarele bifate, restul la alegere.
  const [wasOpen, setWasOpen] = useState(false)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (open) {
      setSelected(defaultDeliverySelection(candidates))
      setError(null)
      setSending(false)
    }
  }

  // O comandă trimisă sau ștearsă între timp iese și din selecție.
  const liveIds = useMemo(() => new Set(candidates.map((comanda) => comanda.id)), [candidates])
  const selectedLive = useMemo(() => selected.filter((id) => liveIds.has(id)), [selected, liveIds])
  const stock = stocDisponibilKg ?? 0
  const plan = planDelivery(candidates, selectedLive, stock)
  const stockKnown = stocDisponibilKg !== null

  const refresh = () => invalidateDupaComanda(queryClient)

  const send = async () => {
    if (!plan.canSubmit || inFlight.current) return
    inFlight.current = true
    setSending(true)
    setError(null)

    // În ordinea listei: prioritarele întâi, ca ele să prindă stocul dacă s-a schimbat între timp.
    const queue = candidates.filter((comanda) => selectedLive.includes(comanda.id))
    let sent = 0
    try {
      for (const comanda of queue) {
        await updateComanda(comanda.id, { status: 'in_livrare' })
        sent += 1
        setSelected((previous) => previous.filter((id) => id !== comanda.id))
      }
      hapticSuccess()
      toast.success(sent === 1 ? 'O comandă trimisă în Livrări' : `${sent} comenzi trimise în Livrări`)
      onOpenChange(false)
    } catch (cause) {
      hapticError()
      const stockError = parseStocInsuficient(cause)
      const prefix = sent > 0 ? `${sent === 1 ? 'O comandă a plecat' : `${sent} comenzi au plecat`} în Livrări. ` : ''
      setError(
        stockError
          ? `${prefix}Stocul s-a schimbat între timp: mai sunt ${formatKg(stockError.disponibilKg)}. Am reîncărcat lista; verifică bifele.`
          : `${prefix}${cause instanceof Error && cause.message ? cause.message : 'Trimiterea s-a oprit. Verifică internetul și încearcă din nou.'}`,
      )
      // Stocul real, de pe server, înainte de următoarea încercare.
      void queryClient.fetchQuery({ queryKey: queryKeys.comenziStockSummaryAzi, queryFn: getComenziStockSummaryAzi, staleTime: 0 })
    } finally {
      refresh()
      inFlight.current = false
      setSending(false)
    }
  }

  const toggle = (id: string, checked: boolean) =>
    setSelected((previous) => (checked ? [...previous.filter((item) => item !== id), id] : previous.filter((item) => item !== id)))

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Pune în livrare azi"
      description="Bifează ce pleacă azi, cât ajunge recolta. Ordinea pe drum o faci în Livrări."
      footer={
        <Button
          type="button"
          variant="primary"
          size="touch-lg"
          className="w-full"
          disabled={!plan.canSubmit || !stockKnown}
          loading={sending}
          onClick={() => void send()}
        >
          <Truck aria-hidden />
          {plan.selectedCount > 0
            ? `Trimite în Livrări (${plan.selectedCount}) · ${formatKg(plan.selectedKg)}`
            : 'Bifează cel puțin o comandă'}
        </Button>
      }
    >
      <div className="space-y-3">
        {error ? (
          <Notice tone="danger" title="Nu au plecat toate">
            {error}
          </Notice>
        ) : null}

        {stockKnown && plan.prioritareExceedStock ? (
          <Notice tone="warning" title="Prioritarele nu încap în stoc">
            Prioritarele cer {formatKg(plan.prioritareKg)}, iar în stoc sunt {formatKg(stock)}. Notează recoltarea de azi
            sau debifează una.
          </Notice>
        ) : null}

        <div className="rounded-box border border-border bg-surface p-3">
          <ProgressBar
            label="Rămas în stoc"
            valueLabel={stockKnown ? formatKg(Math.max(0, plan.remainingKg)) : 'se încarcă…'}
            value={Math.max(0, plan.remainingKg)}
            max={Math.max(stock, 0.01)}
            tone={plan.remainingKg < 0 ? 'danger' : plan.remainingKg === 0 ? 'warning' : 'primary'}
          />
          <p className={cn('mt-2 text-fg-muted', kitText.helper)}>
            {stockKnown
              ? plan.remainingKg < 0
                ? `Bifele depășesc stocul cu ${formatKg(-plan.remainingKg)}.`
                : `Din ${formatKg(stock)} calitatea 1, bifate ${formatKg(plan.selectedKg)}.`
              : 'Calculez stocul de calitatea 1.'}
          </p>
        </div>

        {candidates.length === 0 ? (
          <Notice tone="success" title="Toate comenzile de azi sunt deja în livrare" />
        ) : (
          <ul className="space-y-2">
            {candidates.map((comanda) => {
              const checked = selectedLive.includes(comanda.id)
              const missing = plan.locked[comanda.id]
              const name = clientName(comanda)
              return (
                <li key={comanda.id}>
                  <CheckRow
                    title={name}
                    detail={[localitateScurta(comanda.locatie_livrare), comanda.total > 0 ? formatLei(comanda.total) : null]
                      .filter(Boolean)
                      .join(' · ')}
                    trailing={<span className={cn('font-extrabold text-fg', kitText.base)}>{formatKg(comanda.cantitate_kg)}</span>}
                    badge={
                      comanda.prioritara ? (
                        <StatusPill tone="warning" icon={<Flag aria-hidden />}>
                          Prioritară
                        </StatusPill>
                      ) : undefined
                    }
                    checked={checked}
                    onCheckedChange={(next) => toggle(comanda.id, next)}
                    locked={!checked && missing !== undefined && stockKnown}
                    lockedReason={missing !== undefined ? `Nu ajunge stocul: lipsesc ${formatKg(missing)}` : undefined}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </BottomSheet>
  )
}
