'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { MessageCircle, Phone, ShoppingBasket } from 'lucide-react'

import { BigInput, Button, Notice, StatusPill, SummaryList, SummaryRow, buttonVariants, kitText, parseDecimal } from '@/components/kit'
import { phoneForLinks } from '@/lib/comenzi/display'
import { capitalizeRo, formatKg, formatLei, formatLeiKg, shortDateRo, weekdayDateRo } from '@/lib/format-ro'
import { generateClientId } from '@/lib/offline/generateClientId'
import { queryKeys } from '@/lib/query-keys'
import { adaugaPlataVanzare, setVanzareStatusPlata } from '@/lib/supabase/queries/vanzari'
import { toast } from '@/lib/ui/toast'
import { aplicaPlata } from '@/lib/vanzari/incasari'
import type { VanzareRow } from '@/lib/vanzari/view'
import { cn } from '@/lib/utils'

type SheetView = 'detalii' | 'parte'

/** Vânzările care depind de o plată: registrul, comenzile (statusul plății) și Acasă. */
const PAYMENT_INVALIDATED = [queryKeys.vanzari, queryKeys.comenzi, queryKeys.dashboard] as const

function errorText(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback
}

/**
 * Conținutul foii unei vânzări (promptul 35, §8): starea, încasarea și plata parțială, mutate neschimbate din
 * `VanzariPageClient`. Îl folosesc foaia de pe telefon și fișa din dreapta pe desktop.
 */
export function useVanzareFisa({
  activ,
  vanzare: opened,
  todayIso,
  canWrite,
  vanzariPlataPartiala,
  onClose,
  inPanou = false,
}: {
  activ: boolean
  vanzare: VanzareRow | null
  todayIso: string | null
  canWrite: boolean
  vanzariPlataPartiala: boolean
  onClose: () => void
  /** Fișa de desktop: după o acțiune rămâne deschisă, la detalii. */
  inPanou?: boolean
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [sheetView, setSheetView] = useState<SheetView>('detalii')
  const [parteText, setParteText] = useState('')
  // Cheia plății: una pe deschiderea „Cât a dat acum”, păstrată la reîncercare (nu se adună de două ori).
  const plataIdRef = useRef<string | null>(null)
  const [busy, setBusy] = useState<'incasat' | 'neincasat' | 'parte' | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)


  // La fiecare deschidere (sau altă vânzare) foaia pornește de la detalii.
  const sessionKey = activ && opened ? opened.id : null
  const [seenKey, setSeenKey] = useState<string | null>(null)
  if (seenKey !== sessionKey) {
    setSeenKey(sessionKey)
    setSheetView('detalii')
    setParteText('')
    setSheetError(null)
  }
  const close = () => {
    if (inPanou) setSheetView('detalii')
    onCloseExtern()
  }
  const onCloseExtern = onClose
  const refreshPayments = () => {
    for (const queryKey of PAYMENT_INVALIDATED) void queryClient.invalidateQueries({ queryKey })
  }

  const markStatus = async (row: VanzareRow, status: 'platit' | 'restanta') => {
    if (busy || !todayIso) return
    setBusy(status === 'platit' ? 'incasat' : 'neincasat')
    setSheetError(null)
    try {
      await setVanzareStatusPlata(row.id, status, todayIso)
      toast.success(status === 'platit' ? `Încasat: ${formatLei(row.total)}` : 'Trecută ca neîncasată')
      close()
    } catch (cause) {
      setSheetError(errorText(cause, 'Nu s-a salvat. Verifică internetul și încearcă din nou.'))
    } finally {
      refreshPayments()
      setBusy(null)
    }
  }

  const parteLei = parseDecimal(parteText)
  const plataNoua = opened && parteLei !== null && todayIso ? aplicaPlata(opened, parteLei, todayIso) : null
  const parteValid = plataNoua !== null && plataNoua.ok

  const savePartial = async () => {
    if (busy || !opened || !parteValid || parteLei === null || !todayIso || !plataNoua?.ok) return
    if (!plataIdRef.current) plataIdRef.current = generateClientId()
    setBusy('parte')
    setSheetError(null)
    try {
      await adaugaPlataVanzare({ vanzareId: opened.id, sumaLei: parteLei, dataIso: todayIso, plataId: plataIdRef.current })
      plataIdRef.current = null
      toast.success(
        plataNoua.completeaza
          ? `Încasat tot: ${formatLei(opened.total)}`
          : `A dat ${formatLei(parteLei)} · rest ${formatLei(plataNoua.rest)}`,
      )
      if (plataNoua.completeaza) close()
      else setSheetView('detalii')
    } catch (cause) {
      setSheetError(errorText(cause, 'Nu s-a salvat. Verifică internetul și încearcă din nou.'))
    } finally {
      refreshPayments()
      setBusy(null)
    }
  }

  const phone = opened ? phoneForLinks(opened.telefon) : null

  if (!opened) return null

  const title = sheetView === 'parte' ? 'Cât a dat acum?' : (opened?.clientNume ?? 'Vânzare')
  const description = opened
            ? sheetView === 'parte'
              ? `${opened.clientNume} · total ${formatLei(opened.total)}`
              : `${capitalizeRo(weekdayDateRo(opened.data))} · ${opened.rapida ? 'vânzare rapidă' : opened.comanda_id ? 'din comanda livrată' : 'vânzare directă'}`
            : undefined
  const content = (
          sheetView === 'parte' ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                void savePartial()
              }}
            >
              {sheetError ? (
                <Notice tone="danger" title="Nu s-a salvat">
                  {sheetError}
                </Notice>
              ) : null}
              <BigInput
                label="Cât a dat acum"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="done"
                placeholder="ex. 50"
                value={parteText}
                onChange={(event) => setParteText(event.target.value)}
                trailing={<span className={cn('font-bold text-fg-muted', kitText.base)}>lei</span>}
                error={plataNoua && !plataNoua.ok && parteText.trim() !== '' ? plataNoua.motiv : undefined}
                hint={`A dat până acum: ${formatLei(opened.primit)} · rest ${formatLei(opened.rest)}`}
              />
              {plataNoua?.ok ? (
                <p className={cn('text-fg-muted', kitText.secondary)}>
                  {plataNoua.completeaza
                    ? 'Cu asta a dat tot: vânzarea devine încasată azi.'
                    : `După plată: rest ${formatLei(plataNoua.rest)}. Vânzarea rămâne neîncasată până vine restul.`}
                </p>
              ) : null}
              <Button type="submit" variant="primary" size="touch-lg" className="w-full" loading={busy === 'parte'} disabled={!parteValid}>
                {parteValid && parteLei !== null ? `Notează ${formatLei(parteLei)}` : 'Notează suma'}
              </Button>
              <Button
                type="button"
                variant="neutral"
                size="touch-lg"
                className="w-full"
                onClick={() => {
                  setSheetError(null)
                  setSheetView('detalii')
                }}
              >
                Înapoi
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex">
                <StatusPill tone={opened.incasata ? 'success' : 'warning'}>
                  {opened.incasata
                    ? opened.data_incasare
                      ? `Încasat · ${shortDateRo(opened.data_incasare)}`
                      : 'Încasat'
                    : 'Neîncasat'}
                </StatusPill>
              </div>

              {sheetError ? (
                <Notice tone="danger" title="Nu s-a salvat">
                  {sheetError}
                </Notice>
              ) : null}

              <SummaryList>
                <SummaryRow label="Cantitate" value={formatKg(Number(opened.cantitate_kg) || 0)} />
                <SummaryRow label="Preț" value={formatLeiKg(Number(opened.pret_lei_kg) || 0)} />
                <SummaryRow label="Total" value={formatLei(opened.total)} />
                {!opened.incasata && opened.primit > 0 ? (
                  <>
                    <SummaryRow
                      label="A dat"
                      value={`${formatLei(opened.primit)}${opened.data_incasare_partiala ? ` · ${shortDateRo(opened.data_incasare_partiala)}` : ''}`}
                    />
                    <SummaryRow label="Rest de primit" value={formatLei(opened.rest)} />
                  </>
                ) : null}
              </SummaryList>

              <div className="flex flex-col gap-2.5">
                {canWrite && !opened.incasata ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="touch-lg"
                    className="w-full"
                    loading={busy === 'incasat'}
                    disabled={busy !== null}
                    onClick={() => void markStatus(opened, 'platit')}
                  >
                    Marchează încasat azi
                  </Button>
                ) : null}
                {canWrite && !opened.incasata && vanzariPlataPartiala ? (
                  <Button
                    type="button"
                    variant="neutral"
                    size="touch"
                    className="w-full"
                    disabled={busy !== null}
                    onClick={() => {
                      setSheetError(null)
                      setParteText('')
                      plataIdRef.current = null
                      setSheetView('parte')
                    }}
                  >
                    A dat doar o parte…
                  </Button>
                ) : null}
                {phone ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <a href={`tel:${phone.tel}`} className={cn(buttonVariants({ variant: 'neutral', size: 'touch' }), 'w-full')}>
                      <Phone aria-hidden />
                      Sună clientul
                    </a>
                    <a
                      href={`https://wa.me/${phone.wa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ variant: 'neutral', size: 'touch' }), 'w-full')}
                    >
                      <MessageCircle aria-hidden />
                      WhatsApp
                    </a>
                  </div>
                ) : null}
                {opened.comanda_id && !opened.rapida ? (
                  <Button
                    type="button"
                    variant="neutral"
                    size="touch"
                    className="w-full"
                    onClick={() => {
                      close()
                      router.push('/comenzi?filter=livrate')
                    }}
                  >
                    <ShoppingBasket aria-hidden />
                    Vezi comanda
                  </Button>
                ) : null}
                {canWrite && opened.incasata ? (
                  <Button
                    type="button"
                    variant="quiet"
                    size="touch"
                    className="w-full"
                    loading={busy === 'neincasat'}
                    disabled={busy !== null}
                    onClick={() => void markStatus(opened, 'restanta')}
                  >
                    Marchează neîncasat
                  </Button>
                ) : null}
              </div>
            </div>
          )
  )

  return { title, description, content, view: sheetView }
}
