'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CalendarDays,
  Check,
  Flag,
  MessageCircle,
  Pencil,
  Phone,
  RotateCcw,
  Trash2,
  Truck,
  UserPlus,
  XCircle,
} from 'lucide-react'

import {
  BigInput,
  BottomSheet,
  Button,
  CalendarPanel,
  Notice,
  Segments,
  StatusPill,
  SummaryList,
  SummaryRow,
  buttonVariants,
  kitText,
  parseDecimal,
} from '@/components/kit'
import { parseStocInsuficient } from '@/lib/comenzi/day-view'
import {
  comandaDayLabel,
  comandaDinMagazin,
  comandaKindLabel,
  comandaNota,
  comandaPlata,
  comandaStatus,
  phoneForLinks,
} from '@/lib/comenzi/display'
import { formatKg, formatLei, formatLeiKg, formatNumber, round2, weekdayDateRo } from '@/lib/format-ro'
import type { Comanda, ComandaPaymentStatus } from '@/lib/supabase/queries/comenzi'
import { toast } from '@/lib/ui/toast'
import { downloadVCard } from '@/lib/utils/downloadVCard'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

import { useComandaActions } from './useComandaActions'

type SheetView = 'detalii' | 'muta' | 'livreaza' | 'sterge' | 'redeschide' | 'anuleaza'

export interface ComandaSheetProps {
  open: boolean
  /** Referință stabilă (setter sau `useCallback`). */
  onOpenChange: (open: boolean) => void
  comanda: Comanda | null
  clientName: string
  todayIso: string
  canWrite: boolean
  canDelete: boolean
  /** Există coloana `prioritara` (altfel comutatorul nu apare). */
  hasPrioritara: boolean
  /** Pagina închide foaia, apoi deschide formularul (două ferestre suprapuse nu se deschid). */
  onEdit: (comanda: Comanda) => void
}

const VIEW_TITLE: Record<Exclude<SheetView, 'detalii'>, string> = {
  muta: 'Pe ce zi o muți?',
  livreaza: 'Confirmi livrarea?',
  sterge: 'Ștergi comanda?',
  redeschide: 'Redeschizi comanda?',
  anuleaza: 'Anulezi comanda?',
}

/** „Mâine · vin., 20 nov.”; pentru o zi fără nume relativ, data o singură dată. */
function livrareLabel(relative: string, date: string): string {
  return relative === date ? date : `${relative} · ${date}`
}

function errorText(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

/**
 * Foaia unei comenzi: detaliile și tot ce se poate face cu ea (editare, mutare pe altă zi, punere în livrare,
 * livrare directă, încasare, anulare, redeschidere, ștergere). Confirmările sunt în aceeași foaie.
 */
export function ComandaSheet({
  open,
  onOpenChange,
  comanda,
  clientName,
  todayIso,
  canWrite,
  canDelete,
  hasPrioritara,
  onEdit,
}: ComandaSheetProps) {
  const actions = useComandaActions()
  const [view, setView] = useState<SheetView>('detalii')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deliveredKg, setDeliveredKg] = useState('')
  const [payment, setPayment] = useState<ComandaPaymentStatus>('platit')

  // La fiecare deschidere (sau altă comandă) foaia pornește de la detalii.
  const sessionKey = open && comanda ? comanda.id : null
  const [seenKey, setSeenKey] = useState<string | null>(null)
  if (seenKey !== sessionKey) {
    setSeenKey(sessionKey)
    setView('detalii')
    setBusy(null)
    setError(null)
    setDeliveredKg(comanda ? formatNumber(comanda.cantitate_kg) : '')
    setPayment('platit')
  }

  if (!comanda) {
    return (
      <BottomSheet open={false} onOpenChange={onOpenChange} title="Comandă">
        {null}
      </BottomSheet>
    )
  }

  const status = comandaStatus(comanda, todayIso)
  const plata = comandaPlata(comanda)
  const kind = comandaKindLabel(comanda)
  const nota = comandaNota(comanda)
  const phone = phoneForLinks(comanda.telefon)
  const isOpen = comanda.status !== 'livrata' && comanda.status !== 'anulata'
  const inLivrare = comanda.status === 'in_livrare'
  const day = comanda.data_livrare?.slice(0, 10) || null
  const zeroPrice = comanda.order_kind === 'cadou' || comanda.order_kind === 'consum_propriu'

  const close = () => onOpenChange(false)

  const run = async (key: string, work: () => Promise<void>) => {
    if (busy) return
    setBusy(key)
    setError(null)
    try {
      await work()
      hapticSuccess()
    } catch (cause) {
      hapticError()
      const stock = parseStocInsuficient(cause)
      setError(
        stock
          ? `Nu ajunge stocul: lipsesc ${formatKg(Math.max(0, round2(stock.necesarKg - stock.disponibilKg)))}. Notează recoltarea de azi sau mută comanda.`
          : errorText(cause, 'Nu s-a putut face. Verifică internetul și încearcă din nou.'),
      )
      setView('detalii')
    } finally {
      setBusy(null)
    }
  }

  const putInDelivery = () =>
    run('livrare', async () => {
      await actions.update(comanda.id, { status: 'in_livrare' })
      toast.success(`${clientName}: în Livrări`)
      close()
    })

  const takeOutOfDelivery = () =>
    run('scoate', async () => {
      await actions.update(comanda.id, { status: day ? 'programata' : 'noua' })
      toast.success('Scoasă din livrare')
      close()
    })

  const moveTo = (iso: string | null) =>
    run('muta', async () => {
      await actions.update(comanda.id, {
        data_livrare: iso,
        // O comandă fără dată nu poate fi prioritară.
        ...(iso === null && comanda.prioritara && hasPrioritara ? { prioritara: false } : {}),
      })
      toast.success(iso ? `Mutată pe ${weekdayDateRo(iso)}` : 'Mutată la „Fără dată”')
      close()
    })

  const togglePrioritara = () =>
    run('prioritara', async () => {
      await actions.update(comanda.id, { prioritara: !comanda.prioritara })
    })

  const parsedDeliveredKg = parseDecimal(deliveredKg)
  const deliveredValid =
    parsedDeliveredKg !== null && parsedDeliveredKg > 0 && parsedDeliveredKg <= round2(comanda.cantitate_kg)

  const confirmDeliver = () => {
    if (!deliveredValid || parsedDeliveredKg === null) return
    void run('livreaza', async () => {
      const result = await actions.deliver({
        comandaId: comanda.id,
        cantitateLivrataKg: parsedDeliveredKg,
        statusPlata: zeroPrice ? 'platit' : payment,
      })
      toast.success(
        result.remainingOrder
          ? `Livrat ${formatKg(parsedDeliveredKg)}. Au rămas ${formatKg(result.remainingOrder.cantitate_kg)} într-o comandă nouă.`
          : 'Livrată. Vânzarea a fost creată.',
      )
      close()
    })
  }

  const confirmCancel = () =>
    run('anuleaza', async () => {
      await actions.update(comanda.id, { status: 'anulata' })
      toast.success('Comandă anulată')
      close()
    })

  const confirmReopen = () =>
    run('redeschide', async () => {
      await actions.reopen(comanda.id)
      toast.success('Comandă redeschisă')
      close()
    })

  const confirmDelete = () =>
    run('sterge', async () => {
      await actions.remove(comanda.id)
      toast.success('Comandă ștearsă')
      close()
    })

  const markPaid = () =>
    run('incasat', async () => {
      await actions.markPaid(comanda.id)
      toast.success('Marcată ca încasată')
    })

  const saveClient = () =>
    run('client', async () => {
      await actions.saveClientForComanda(comanda.id, {
        nume_client: clientName,
        telefon: comanda.telefon,
        adresa: comanda.locatie_livrare,
      })
      toast.success('Client salvat')
    })

  const backToDetails = (
    <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => setView('detalii')}>
      Înapoi
    </Button>
  )

  let content: React.ReactNode
  if (view === 'muta') {
    content = (
      <div className="space-y-4">
        <CalendarPanel value={day} onChange={(iso) => void moveTo(iso)} min={todayIso} />
        <Button
          type="button"
          variant="neutral"
          size="touch-lg"
          className="w-full"
          loading={busy === 'muta'}
          onClick={() => void moveTo(null)}
        >
          Fără dată
        </Button>
        {backToDetails}
      </div>
    )
  } else if (view === 'livreaza') {
    content = (
      <div className="space-y-4">
        <BigInput
          label="Cât ai livrat (kg)"
          value={deliveredKg}
          onChange={(event) => setDeliveredKg(event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          trailing={<span className={cn('font-bold text-fg-muted', kitText.secondary)}>kg</span>}
          error={
            deliveredKg.trim() !== '' && !deliveredValid
              ? `Scrie o cantitate între 0 și ${formatKg(comanda.cantitate_kg)}.`
              : undefined
          }
          hint={`Comanda are ${formatKg(comanda.cantitate_kg)}. Dacă livrezi mai puțin, restul rămâne într-o comandă nouă.`}
        />
        {zeroPrice ? null : (
          <Segments<ComandaPaymentStatus>
            aria-label="Plata"
            value={payment}
            onValueChange={setPayment}
            options={[
              { value: 'platit', label: 'Încasat' },
              { value: 'neplatit', label: 'Neîncasat' },
            ]}
          />
        )}
        <Button
          type="button"
          variant="primary"
          size="touch-lg"
          className="w-full"
          disabled={!deliveredValid}
          loading={busy === 'livreaza'}
          onClick={confirmDeliver}
        >
          <Check aria-hidden />
          Da, livrat
        </Button>
        {backToDetails}
      </div>
    )
  } else if (view === 'sterge' || view === 'redeschide' || view === 'anuleaza') {
    const confirm =
      view === 'sterge'
        ? {
            text: `Comanda pentru ${clientName} (${formatKg(comanda.cantitate_kg)}) se șterge de tot.`,
            label: 'Șterge comanda',
            onClick: confirmDelete,
          }
        : view === 'redeschide'
          ? {
              text: 'Redeschiderea anulează vânzarea legată de această comandă și pune kilogramele înapoi în stoc.',
              label: 'Redeschide',
              onClick: confirmReopen,
            }
          : {
              text: `Comanda pentru ${clientName} rămâne în listă, la „Anulate”, și nu mai apare pe zile.`,
              label: 'Anulează comanda',
              onClick: confirmCancel,
            }
    content = (
      <div className="space-y-4">
        <p className={cn('text-fg', kitText.base)}>{confirm.text}</p>
        <Button
          type="button"
          variant="danger"
          size="touch-lg"
          className="w-full"
          loading={busy === view}
          onClick={() => void confirm.onClick()}
        >
          {confirm.label}
        </Button>
        {backToDetails}
      </div>
    )
  } else {
    content = (
      <div className="space-y-4">
        {error ? (
          <Notice tone="danger" title="Nu s-a putut face">
            {error}
          </Notice>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {comanda.prioritara ? (
            <StatusPill tone="warning" icon={<Flag aria-hidden />}>
              Prioritară
            </StatusPill>
          ) : null}
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
          {plata ? <StatusPill tone={plata.tone}>{plata.label}</StatusPill> : null}
          {kind ? <StatusPill tone="info">{kind}</StatusPill> : null}
          {comandaDinMagazin(comanda) ? <StatusPill tone="info">Din magazin</StatusPill> : null}
        </div>

        <SummaryList>
          <SummaryRow
            label="Cantitate"
            value={formatKg(comanda.cantitate_kg)}
            amount={zeroPrice ? undefined : formatLei(comanda.total)}
          />
          {zeroPrice ? null : <SummaryRow label="Preț" value={formatLeiKg(comanda.pret_per_kg)} />}
          <SummaryRow
            label="Livrare"
            value={day ? livrareLabel(comandaDayLabel(comanda, todayIso), weekdayDateRo(day)) : 'Fără dată'}
          />
          {comanda.telefon?.trim() ? <SummaryRow label="Telefon" value={comanda.telefon.trim()} /> : null}
        </SummaryList>

        {/* Adresa și nota se citesc întregi, pe câte rânduri au nevoie. */}
        <dl className="space-y-3 px-1">
          <div>
            <dt className={cn('font-medium text-fg-muted', kitText.secondary)}>Adresă</dt>
            <dd className={cn('break-words font-semibold text-fg', kitText.base)}>
              {comanda.locatie_livrare?.trim() || 'Fără adresă'}
            </dd>
          </div>
          {nota ? (
            <div>
              <dt className={cn('font-medium text-fg-muted', kitText.secondary)}>Notă</dt>
              <dd className={cn('whitespace-pre-line break-words font-semibold text-fg', kitText.base)}>{nota}</dd>
            </div>
          ) : null}
        </dl>

        {phone ? (
          <div className="grid grid-cols-2 gap-2.5">
            <a href={`tel:${phone.tel}`} className={buttonVariants({ variant: 'neutral', size: 'touch' })}>
              <Phone aria-hidden />
              Sună
            </a>
            <a
              href={`https://wa.me/${phone.wa}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'neutral', size: 'touch' })}
            >
              <MessageCircle aria-hidden />
              WhatsApp
            </a>
          </div>
        ) : null}

        {canWrite ? (
          <div className="flex flex-col gap-2.5">
            {isOpen && !inLivrare ? (
              <Button
                type="button"
                variant="primary"
                size="touch-lg"
                className="w-full"
                loading={busy === 'livrare'}
                onClick={() => void putInDelivery()}
              >
                <Truck aria-hidden />
                Pune în livrare
              </Button>
            ) : null}
            {inLivrare ? (
              <Link href="/livrari" className={cn(buttonVariants({ variant: 'primary', size: 'touch-lg' }), 'w-full')}>
                <Truck aria-hidden />
                Vezi în Livrări
              </Link>
            ) : null}
            {comanda.status === 'livrata' && plata && !plata.incasata ? (
              <Button
                type="button"
                variant="primary"
                size="touch-lg"
                className="w-full"
                loading={busy === 'incasat'}
                onClick={() => void markPaid()}
              >
                <Check aria-hidden />
                Marchează încasat
              </Button>
            ) : null}

            {isOpen ? (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <Button type="button" variant="neutral" size="touch" onClick={() => onEdit(comanda)}>
                    <Pencil aria-hidden />
                    Editează
                  </Button>
                  <Button type="button" variant="neutral" size="touch" onClick={() => setView('muta')}>
                    <CalendarDays aria-hidden />
                    Mută
                  </Button>
                </div>
                <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => setView('livreaza')}>
                  <Check aria-hidden />
                  Am livrat-o deja
                </Button>
                {hasPrioritara && day && !inLivrare ? (
                  <Button
                    type="button"
                    variant="neutral"
                    size="touch"
                    className="w-full"
                    loading={busy === 'prioritara'}
                    onClick={() => void togglePrioritara()}
                  >
                    <Flag aria-hidden />
                    {comanda.prioritara ? 'Scoate „Prioritară”' : 'Marchează prioritară'}
                  </Button>
                ) : null}
                {inLivrare ? (
                  <Button
                    type="button"
                    variant="neutral"
                    size="touch"
                    className="w-full"
                    loading={busy === 'scoate'}
                    onClick={() => void takeOutOfDelivery()}
                  >
                    <RotateCcw aria-hidden />
                    Scoate din livrare
                  </Button>
                ) : null}
                <Button type="button" variant="quiet" size="touch" className="w-full" onClick={() => setView('anuleaza')}>
                  <XCircle aria-hidden />
                  Anulează comanda
                </Button>
              </>
            ) : null}

            {comanda.status === 'livrata' ? (
              <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => setView('redeschide')}>
                <RotateCcw aria-hidden />
                Redeschide comanda
              </Button>
            ) : null}

            {!comanda.client_id && clientName && comanda.telefon?.trim() ? (
              <Button
                type="button"
                variant="neutral"
                size="touch"
                className="w-full"
                loading={busy === 'client'}
                onClick={() => void saveClient()}
              >
                <UserPlus aria-hidden />
                Salvează în Clienți
              </Button>
            ) : null}
            {comanda.telefon?.trim() ? (
              <Button
                type="button"
                variant="quiet"
                size="touch"
                className="w-full"
                onClick={() => downloadVCard(clientName, comanda.telefon?.trim() ?? '')}
              >
                Salvează contactul în telefon
              </Button>
            ) : null}

            {canDelete ? (
              <Button
                type="button"
                variant="quiet"
                size="touch"
                className="w-full text-danger-text"
                onClick={() => setView('sterge')}
              >
                <Trash2 aria-hidden />
                Șterge
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={view === 'detalii' ? clientName : VIEW_TITLE[view]}
      description={view === 'detalii' ? undefined : `${clientName} · ${formatKg(comanda.cantitate_kg)}`}
    >
      {content}
    </BottomSheet>
  )
}
