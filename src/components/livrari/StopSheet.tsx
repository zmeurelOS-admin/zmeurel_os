'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowDownToLine,
  CalendarDays,
  Check,
  Copy,
  MapPin,
  MessageCircle,
  Navigation,
  Pencil,
  Phone,
  PhoneMissed,
  Undo2,
} from 'lucide-react'

import { COMENZI_INVALIDATED, useComandaActions } from '@/components/comenzi/useComandaActions'
import {
  BigInput,
  BigTextarea,
  BottomSheet,
  Button,
  CalendarPanel,
  Notice,
  Segments,
  StatusPill,
  Tile,
  TileGroup,
  ToggleRow,
  addDaysIso,
  buttonVariants,
  kitText,
  parseDecimal,
} from '@/components/kit'
import { parseStocInsuficient } from '@/lib/comenzi/day-view'
import { comandaNota, comandaTelefon, phoneForLinks } from '@/lib/comenzi/display'
import {
  canSendOrderMessage,
  deliveryAnnouncementMessage,
  whatsappMessageUrl,
} from '@/lib/comenzi/whatsapp-messages'
import { formatKg, formatLei, formatNumber, round2, weekdayDateRo } from '@/lib/format-ro'
import { getDevicePosition, type DevicePosition } from '@/lib/livrari/device'
import {
  LOCATION_SAVE_MAX_ACCURACY_M,
  canSaveLocation,
  leiDeIncasat,
  mapsSearchUrl,
  navigateUrl,
  shouldAskLocationUpdate,
  type GeoPoint,
  type NavApp,
} from '@/lib/livrari/route'
import { queryKeys } from '@/lib/query-keys'
import { saveClientLocation, type Client } from '@/lib/supabase/queries/clienti'
import { deliverAndCloneComanda, type Comanda } from '@/lib/supabase/queries/comenzi'
import { adaugaPlataVanzare } from '@/lib/supabase/queries/vanzari'
import { generateClientId } from '@/lib/offline/generateClientId'
import { plataLaLivrare, type PlataLivrare } from '@/lib/livrari/plata'
import { toast } from '@/lib/ui/toast'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

export interface RouteStop {
  comanda: Comanda
  client: Client | null
  name: string
  /** Locația salvată a clientului; `null` = fără locație încă. */
  location: GeoPoint | null
  /** Numărul opririi pe traseu (de la 1). */
  position: number
}

export type StopSheetEntry = 'meniu' | 'livrat' | 'apel'
type SheetView = StopSheetEntry | 'muta' | 'copiaza' | 'locatie'
type Payment = PlataLivrare

export interface StopSheetProps {
  open: boolean
  /** Referință stabilă (setter sau `useCallback`). */
  onOpenChange: (open: boolean) => void
  stop: RouteStop | null
  /** Cu ce se deschide foaia: meniul opririi, confirmarea livrării sau „Cum a fost apelul?”. */
  entry: StopSheetEntry
  todayIso: string
  canWrite: boolean
  /** Există coloanele de locație pe clienți. */
  hasLocatie: boolean
  /** Există coloanele de plată parțială pe vânzări. */
  hasPlataPartiala: boolean
  navApp: NavApp
  /** Ora la care s-a notat „nu a răspuns” azi, pe acest telefon. */
  noAnswerTime: string | null
  onCall: (stop: RouteStop) => void
  onNoAnswer: (comandaId: string, at: Date | null) => void
  onMoveToEnd: (comandaId: string) => void
}

const VIEW_TITLE: Record<Exclude<SheetView, 'meniu'>, string> = {
  livrat: 'Confirmi livrarea?',
  apel: 'Cum a fost apelul?',
  muta: 'Pe ce zi o muți?',
  copiaza: 'Copiază pentru livrarea următoare',
  locatie: 'Livrezi aici și de acum?',
}

type GeoState =
  | { status: 'idle' }
  | { status: 'ok'; position: DevicePosition }
  | { status: 'error'; message: string }

function errorText(cause: unknown): string {
  const stock = parseStocInsuficient(cause)
  if (stock) {
    return `Nu ajunge stocul: lipsesc ${formatKg(Math.max(0, round2(stock.necesarKg - stock.disponibilKg)))}. Notează recoltarea, apoi încearcă din nou.`
  }
  return cause instanceof Error && cause.message ? cause.message : 'Nu s-a putut face. Verifică internetul și încearcă din nou.'
}

/**
 * Foaia unei opriri: meniul ei (⋯), confirmarea livrării, „Cum a fost apelul?”, mutarea pe altă zi,
 * copierea comenzii și întrebarea despre locație. Totul în aceeași foaie, fără ferestre suprapuse.
 */
export function StopSheet({
  open,
  onOpenChange,
  stop,
  entry,
  todayIso,
  canWrite,
  hasLocatie,
  hasPlataPartiala,
  navApp,
  noAnswerTime,
  onCall,
  onNoAnswer,
  onMoveToEnd,
}: StopSheetProps) {
  const actions = useComandaActions()
  const queryClient = useQueryClient()

  const [view, setView] = useState<SheetView>(entry)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Confirmarea livrării
  const [payment, setPayment] = useState<Payment>('cash')
  const [partial, setPartial] = useState(false)
  const [kgText, setKgText] = useState('')
  const [sumaText, setSumaText] = useState('')
  const [sumaEdited, setSumaEdited] = useState(false)
  // Cheia plății primite la livrare: aceeași la reîncercare, alta la următoarea deschidere a foii.
  const [plataId, setPlataId] = useState(() => generateClientId())
  const [saveLocation, setSaveLocation] = useState(false)
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' })
  const [pendingLocation, setPendingLocation] = useState<DevicePosition | null>(null)

  // După apel
  const [noAnswerStep, setNoAnswerStep] = useState(false)
  const [moveToEnd, setMoveToEnd] = useState(true)

  // Mutare / copiere
  const [targetDay, setTargetDay] = useState<string | null>(null)
  const [showCalendar, setShowCalendar] = useState(false)
  const [moveNote, setMoveNote] = useState('')
  const [copyKg, setCopyKg] = useState('')

  const comanda = stop?.comanda ?? null

  // La fiecare deschidere (sau altă oprire) foaia pornește de la intrarea cerută.
  const sessionKey = open && comanda ? `${comanda.id}:${entry}` : null
  const [seenKey, setSeenKey] = useState<string | null>(null)
  if (seenKey !== sessionKey) {
    setSeenKey(sessionKey)
    if (comanda && stop) {
      setView(entry)
      setBusy(null)
      setError(null)
      setPayment('cash')
      setPartial(false)
      setKgText(formatNumber(comanda.cantitate_kg))
      setSumaText(formatNumber(leiDeIncasat(comanda)))
      setSumaEdited(false)
      setPlataId(generateClientId())
      setSaveLocation(hasLocatie && Boolean(stop.client) && stop.location === null)
      setGeo({ status: 'idle' })
      setPendingLocation(null)
      setNoAnswerStep(false)
      setMoveToEnd(true)
      setTargetDay(null)
      setShowCalendar(false)
      setMoveNote('')
      setCopyKg(formatNumber(comanda.cantitate_kg))
    }
  }

  // Poziția se cere doar pe ecranul de confirmare, doar dacă locațiile există și oprirea are client în fișă.
  const wantsPosition = open && view === 'livrat' && hasLocatie && Boolean(stop?.client)
  const geoRequested = useRef<string | null>(null)
  useEffect(() => {
    if (!wantsPosition || !comanda) {
      geoRequested.current = null
      return
    }
    if (geoRequested.current === comanda.id) return
    geoRequested.current = comanda.id
    let cancelled = false
    // Cât răspunsul nu a venit, starea rămâne `idle`, iar ecranul o arată ca „Caut locația…”.
    getDevicePosition()
      .then((position) => {
        if (!cancelled) setGeo({ status: 'ok', position })
      })
      .catch((cause: unknown) => {
        if (!cancelled) setGeo({ status: 'error', message: cause instanceof Error ? cause.message : 'Locația nu e disponibilă.' })
      })
    return () => {
      cancelled = true
    }
  }, [wantsPosition, comanda])

  if (!stop || !comanda) {
    return (
      <BottomSheet open={false} onOpenChange={onOpenChange} title="Oprire">
        {null}
      </BottomSheet>
    )
  }

  const close = () => onOpenChange(false)
  const telefon = comandaTelefon(comanda, stop.client)
  const phone = phoneForLinks(telefon)
  const nota = comandaNota(comanda)
  const zeroPrice = leiDeIncasat(comanda) === 0
  const hasNoAnswer = comanda.last_call_status === 'no_answer'
  const address = comanda.locatie_livrare?.trim() || stop.client?.adresa?.trim() || ''
  const waUrl = canSendOrderMessage(comanda)
    ? whatsappMessageUrl(telefon, deliveryAnnouncementMessage(comanda, stop.name))
    : null

  const run = async (key: string, work: () => Promise<void>) => {
    if (busy) return
    setBusy(key)
    setError(null)
    try {
      await work()
      hapticSuccess()
    } catch (cause) {
      hapticError()
      setError(errorText(cause))
    } finally {
      setBusy(null)
    }
  }

  // ─── Confirmarea livrării ───
  const fullKg = round2(comanda.cantitate_kg)
  const parsedKg = partial ? parseDecimal(kgText) : fullKg
  const kgValid = parsedKg !== null && parsedKg > 0 && parsedKg <= fullKg
  const deliveredKg = kgValid && parsedKg !== null ? round2(parsedKg) : fullKg
  const expectedLei = zeroPrice ? 0 : round2(deliveredKg * (Number(comanda.pret_per_kg) || 0))
  const sumaShown = sumaEdited ? sumaText : formatNumber(expectedLei)
  const parsedSuma = parseDecimal(sumaShown)
  const { sumaValid, receivedLei, paidInFull } = plataLaLivrare({ expectedLei, payment, parsedSuma, zeroPrice })
  const position = geo.status === 'ok' ? geo.position : null
  const positionSaveable = position !== null && canSaveLocation(position.accuracyM)

  const confirmDelivery = () => {
    if (!kgValid || !sumaValid) return
    void run('livrat', async () => {
      const result = await actions.deliver({
        comandaId: comanda.id,
        cantitateLivrataKg: deliveredKg,
        statusPlata: paidInFull ? 'platit' : 'neplatit',
      })

      // „A dat X lei”: doar dacă a dat ceva, mai puțin decât totalul, și baza de date are coloanele.
      let partialNote = ''
      if (!paidInFull && receivedLei > 0) {
        if (hasPlataPartiala && result.vanzare?.id) {
          try {
            await adaugaPlataVanzare({ vanzareId: result.vanzare.id, sumaLei: receivedLei, dataIso: todayIso, plataId })
            partialNote = ` A dat ${formatLei(receivedLei)}, rest ${formatLei(round2(expectedLei - receivedLei))}.`
          } catch {
            partialNote = ' Suma primită nu s-a putut nota; vânzarea e trecută ca neîncasată.'
          }
        } else {
          partialNote = ' Vânzarea e trecută ca neîncasată.'
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.vanzari })
      }

      const remaining = result.remainingOrder
      toast.success(
        `${stop.name}: livrat ${formatKg(deliveredKg)}.${remaining ? ` Au rămas ${formatKg(remaining.cantitate_kg)} într-o comandă nouă.` : ''}${partialNote}`,
      )
      onNoAnswer(comanda.id, null)

      // Locația: doar la cererea fermierului și doar cu GPS precis.
      if (stop.client && position && positionSaveable) {
        if (saveLocation) {
          try {
            await saveClientLocation(stop.client.id, {
              latitudine: position.lat,
              longitudine: position.lng,
              precizieM: position.accuracyM,
            })
            void queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
            toast.success(`Locația lui ${stop.name} a fost salvată.`)
          } catch {
            toast.error('Livrarea e salvată, dar locația nu s-a putut salva.')
          }
        } else if (shouldAskLocationUpdate(stop.location, position, position.accuracyM)) {
          setPendingLocation(position)
          setView('locatie')
          return
        }
      }
      close()
    })
  }

  const updateSavedLocation = () =>
    run('locatie', async () => {
      if (!stop.client || !pendingLocation) return
      await saveClientLocation(stop.client.id, {
        latitudine: pendingLocation.lat,
        longitudine: pendingLocation.lng,
        precizieM: pendingLocation.accuracyM,
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      toast.success(`Locația lui ${stop.name} a fost actualizată.`)
      close()
    })

  // ─── Apel ───
  const markNoAnswer = () =>
    run('apel', async () => {
      await actions.update(comanda.id, { last_call_status: 'no_answer' })
      onNoAnswer(comanda.id, new Date())
      if (moveToEnd) onMoveToEnd(comanda.id)
      toast.success(moveToEnd ? 'Notat: nu a răspuns. Mutată la finalul traseului.' : 'Notat: nu a răspuns.')
      close()
    })

  const markAnswered = () =>
    run('apel', async () => {
      // „A răspuns, merg”: nu se schimbă nimic; doar dispare un marcaj mai vechi de „nu a răspuns”.
      if (hasNoAnswer) {
        await actions.update(comanda.id, { last_call_status: null })
        onNoAnswer(comanda.id, null)
      }
      close()
    })

  const toggleNoAnswer = () =>
    run('no-answer', async () => {
      await actions.update(comanda.id, { last_call_status: hasNoAnswer ? null : 'no_answer' })
      onNoAnswer(comanda.id, hasNoAnswer ? null : new Date())
    })

  // ─── Mutare, copiere, scoatere ───
  const moveToDay = () => {
    if (!targetDay) return
    void run('muta', async () => {
      const note = moveNote.trim()
      await actions.update(comanda.id, {
        data_livrare: targetDay,
        status: 'programata',
        ...(note ? { observatii: [comanda.observatii?.trim(), note].filter(Boolean).join(' · ') } : {}),
      })
      onNoAnswer(comanda.id, null)
      toast.success(`${stop.name}: mutată pe ${weekdayDateRo(targetDay)}. O găsești în Comenzi.`)
      close()
    })
  }

  const parsedCopyKg = parseDecimal(copyKg)
  // „Livrează și copiază” livrează toată comanda: aceleași opțiuni de plată ca livrarea obișnuită.
  const copyExpectedLei = zeroPrice ? 0 : round2(fullKg * (Number(comanda.pret_per_kg) || 0))
  const copySumaShown = sumaEdited ? sumaText : formatNumber(copyExpectedLei)
  const copyPlata = plataLaLivrare({ expectedLei: copyExpectedLei, payment, parsedSuma: parseDecimal(copySumaShown), zeroPrice })
  const copyValid = parsedCopyKg !== null && parsedCopyKg > 0 && targetDay !== null && copyPlata.sumaValid

  const deliverAndCopy = () => {
    if (!copyValid || parsedCopyKg === null || !targetDay) return
    void run('copiaza', async () => {
      await deliverAndCloneComanda({
        comandaId: comanda.id,
        newCantitateKg: parsedCopyKg,
        newDataLivrare: targetDay,
        plata: { statusPlata: copyPlata.statusPlata, sumaPrimitaLei: copyPlata.avansLei, plataId },
      })
      for (const queryKey of COMENZI_INVALIDATED) void queryClient.invalidateQueries({ queryKey })
      void queryClient.invalidateQueries({ queryKey: queryKeys.vanzari })
      onNoAnswer(comanda.id, null)
      const plataNote = copyPlata.paidInFull
        ? ''
        : copyPlata.avansLei > 0
          ? ` A dat ${formatLei(copyPlata.avansLei)}, rest ${formatLei(round2(copyExpectedLei - copyPlata.avansLei))}.`
          : ' Vânzarea e trecută ca neîncasată.'
      toast.success(`${stop.name}: livrată. Comanda nouă e pe ${weekdayDateRo(targetDay)}.${plataNote}`)
      close()
    })
  }

  /** Cash / Transfer / Nu a plătit și suma: aceleași în confirmarea livrării și în „Livrează și copiază”. */
  const paymentControls = (expected: number, shown: string, plata: ReturnType<typeof plataLaLivrare>, partialHint: string) =>
    zeroPrice ? null : (
      <>
        <Segments<Payment>
          aria-label="Cum a plătit"
          value={payment}
          onValueChange={setPayment}
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'transfer', label: 'Transfer' },
            { value: 'neplatit', label: 'Nu a plătit' },
          ]}
        />
        {payment === 'neplatit' ? null : (
          <BigInput
            label="Suma încasată (lei)"
            value={shown}
            onChange={(event) => {
              setSumaEdited(true)
              setSumaText(event.target.value)
            }}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            trailing={<span className={cn('font-bold text-fg-muted', kitText.secondary)}>lei</span>}
            error={!plata.sumaValid ? `Scrie o sumă între 0 și ${formatLei(expected)}.` : undefined}
            hint={!plata.paidInFull && plata.sumaValid ? partialHint : undefined}
          />
        )}
      </>
    )

  const backToOrders = () =>
    run('scoate', async () => {
      await actions.update(comanda.id, { status: 'noua', data_livrare: null })
      onNoAnswer(comanda.id, null)
      toast.success(`${stop.name}: scoasă din traseu. E în Comenzi, la „Fără dată”.`)
      close()
    })

  // ─── Bucăți comune ───
  const errorNotice = error ? (
    <Notice tone="danger" title="Nu s-a putut face">
      {error}
    </Notice>
  ) : null

  const back = (to: SheetView = 'meniu') => (
    <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => setView(to)}>
      Înapoi
    </Button>
  )

  const dayPicker = (
    <div className="space-y-3">
      <TileGroup type="single" columns={3} value={showCalendar ? 'alta' : targetDay} onValueChange={() => undefined} aria-label="Ziua">
        <Tile
          size="sm"
          value={addDaysIso(todayIso, 1)}
          title="Mâine"
          onClick={() => {
            setShowCalendar(false)
            setTargetDay(addDaysIso(todayIso, 1))
          }}
        />
        <Tile
          size="sm"
          value={addDaysIso(todayIso, 2)}
          title="Poimâine"
          onClick={() => {
            setShowCalendar(false)
            setTargetDay(addDaysIso(todayIso, 2))
          }}
        />
        <Tile size="sm" value="alta" title="Altă dată" onClick={() => setShowCalendar(true)} />
      </TileGroup>
      {showCalendar ? (
        <CalendarPanel value={targetDay} onChange={setTargetDay} min={addDaysIso(todayIso, 1)} shortcuts={false} />
      ) : null}
      {targetDay ? (
        <p className={cn('px-1 font-semibold text-fg', kitText.secondary)}>Ziua aleasă: {weekdayDateRo(targetDay)}</p>
      ) : null}
    </div>
  )

  let content: React.ReactNode

  if (view === 'livrat') {
    content = (
      <div className="space-y-4">
        {errorNotice}

        <div className="rounded-box bg-primary-soft p-4">
          <p className={cn('font-medium text-fg-muted', kitText.secondary)}>
            {zeroPrice ? 'Fără bani de încasat' : 'De încasat'}
          </p>
          <p className={cn('font-extrabold text-fg', kitText.screen)}>
            {zeroPrice ? formatKg(deliveredKg) : formatLei(expectedLei)}
          </p>
          <p className={cn('text-fg-muted', kitText.secondary)}>
            {zeroPrice ? stop.name : `${formatKg(deliveredKg)} · ${stop.name}`}
          </p>
        </div>

        {paymentControls(
          expectedLei,
          sumaShown,
          { sumaValid, receivedLei, paidInFull, statusPlata: paidInFull ? 'platit' : 'neplatit', avansLei: 0 },
          hasPlataPartiala
            ? `Vânzarea rămâne neîncasată: a dat ${formatLei(receivedLei)}, rest ${formatLei(round2(expectedLei - receivedLei))}.`
            : 'Mai puțin decât totalul: vânzarea se trece ca neîncasată.',
        )}

        <ToggleRow
          title="Livrare parțială"
          subtitle={partial ? 'Restul rămâne într-o comandă nouă.' : `Toată comanda: ${formatKg(fullKg)}.`}
          checked={partial}
          onCheckedChange={(value) => {
            setPartial(value)
            if (!value) setKgText(formatNumber(fullKg))
          }}
        />
        {partial ? (
          <BigInput
            label="Cât ai livrat (kg)"
            value={kgText}
            onChange={(event) => setKgText(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            enterKeyHint="done"
            trailing={<span className={cn('font-bold text-fg-muted', kitText.secondary)}>kg</span>}
            error={!kgValid ? `Scrie o cantitate între 0 și ${formatKg(fullKg)}.` : undefined}
          />
        ) : null}

        {hasLocatie && stop.client ? (
          <ToggleRow
            icon={<MapPin />}
            title="Salvează locația de aici"
            subtitle={
              geo.status === 'idle'
                ? 'Caut locația…'
                : geo.status === 'error'
                  ? geo.message
                  : position
                    ? positionSaveable
                      ? `Precizie: ±${Math.round(position.accuracyM)} m.`
                      : `Precizie prea slabă (±${Math.round(position.accuracyM)} m). Se salvează doar sub ${LOCATION_SAVE_MAX_ACCURACY_M} m.`
                    : stop.location
                      ? 'Clientul are deja o locație salvată.'
                      : 'Clientul nu are locație încă.'
            }
            checked={saveLocation && positionSaveable}
            disabled={!positionSaveable}
            onCheckedChange={setSaveLocation}
          />
        ) : null}

        <Button
          type="button"
          variant="primary"
          size="touch-lg"
          className="w-full"
          disabled={!kgValid || !sumaValid}
          loading={busy === 'livrat'}
          onClick={confirmDelivery}
        >
          <Check aria-hidden />
          Da, livrat
        </Button>
        {back()}
      </div>
    )
  } else if (view === 'locatie') {
    content = (
      <div className="space-y-4">
        {errorNotice}
        <p className={cn('text-fg', kitText.base)}>
          Ai livrat la peste 150 m de locația salvată a lui {stop.name}. Vrei ca „Navighează” să te aducă de acum aici?
        </p>
        {pendingLocation ? (
          <p className={cn('text-fg-muted', kitText.secondary)}>Precizia locației de acum: ±{Math.round(pendingLocation.accuracyM)} m.</p>
        ) : null}
        <Button
          type="button"
          variant="primary"
          size="touch-lg"
          className="w-full"
          loading={busy === 'locatie'}
          onClick={() => void updateSavedLocation()}
        >
          Da, actualizează
        </Button>
        <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={close}>
          Nu, doar de data asta
        </Button>
      </div>
    )
  } else if (view === 'apel') {
    content = noAnswerStep ? (
      <div className="space-y-4">
        {errorNotice}
        <ToggleRow
          icon={<ArrowDownToLine />}
          title="Mut-o la finalul traseului"
          subtitle="Mai încerci o dată după celelalte opriri."
          checked={moveToEnd}
          onCheckedChange={setMoveToEnd}
        />
        <Button
          type="button"
          variant="primary"
          size="touch-lg"
          className="w-full"
          loading={busy === 'apel'}
          onClick={() => void markNoAnswer()}
        >
          Notează „nu a răspuns”
        </Button>
        <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => setNoAnswerStep(false)}>
          Înapoi
        </Button>
      </div>
    ) : (
      <div className="flex flex-col gap-2.5">
        {errorNotice}
        <Button
          type="button"
          variant="primary"
          size="touch-lg"
          className="w-full"
          loading={busy === 'apel'}
          onClick={() => void markAnswered()}
        >
          <Check aria-hidden />
          A răspuns, merg
        </Button>
        <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => setNoAnswerStep(true)}>
          <PhoneMissed aria-hidden />
          Nu a răspuns
        </Button>
        <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={() => setView('muta')}>
          <CalendarDays aria-hidden />
          Mută pe altă zi
        </Button>
      </div>
    )
  } else if (view === 'muta') {
    content = (
      <div className="space-y-4">
        {errorNotice}
        {dayPicker}
        <BigTextarea
          label="Notă (opțional)"
          value={moveNote}
          onChange={(event) => setMoveNote(event.target.value)}
          rows={2}
          maxLength={300}
          placeholder="ex. e plecat până vineri"
        />
        <Button
          type="button"
          variant="primary"
          size="touch-lg"
          className="w-full"
          disabled={!targetDay}
          loading={busy === 'muta'}
          onClick={moveToDay}
        >
          Mută comanda
        </Button>
        {back()}
      </div>
    )
  } else if (view === 'copiaza') {
    content = (
      <div className="space-y-4">
        {errorNotice}
        <p className={cn('text-fg-muted', kitText.secondary)}>
          Comanda de azi se marchează livrată întreagă ({zeroPrice ? formatKg(fullKg) : `${formatKg(fullKg)} · ${formatLei(copyExpectedLei)}`}), iar una nouă se pune pe ziua aleasă.
        </p>
        {paymentControls(
          copyExpectedLei,
          copySumaShown,
          copyPlata,
          copyPlata.receivedLei > 0
            ? `Vânzarea rămâne neîncasată: a dat ${formatLei(copyPlata.receivedLei)}, rest ${formatLei(round2(copyExpectedLei - copyPlata.receivedLei))}.`
            : 'Vânzarea se trece ca neîncasată.',
        )}
        <BigInput
          label="Cantitatea comenzii noi (kg)"
          value={copyKg}
          onChange={(event) => setCopyKg(event.target.value)}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="done"
          trailing={<span className={cn('font-bold text-fg-muted', kitText.secondary)}>kg</span>}
          error={copyKg.trim() !== '' && (parsedCopyKg === null || parsedCopyKg <= 0) ? 'Scrie cantitatea cu cifre.' : undefined}
        />
        {dayPicker}
        <Button
          type="button"
          variant="primary"
          size="touch-lg"
          className="w-full"
          disabled={!copyValid}
          loading={busy === 'copiaza'}
          onClick={deliverAndCopy}
        >
          <Copy aria-hidden />
          Livrează și copiază
        </Button>
        {back()}
      </div>
    )
  } else {
    const navLabel = navApp === 'waze' ? 'Waze' : 'Navighează'
    content = (
      <div className="space-y-4">
        {errorNotice}

        <div className="flex flex-wrap gap-1.5">
          <StatusPill tone="neutral">{formatKg(comanda.cantitate_kg)}</StatusPill>
          {zeroPrice ? null : <StatusPill tone="info">{formatLei(leiDeIncasat(comanda))} de încasat</StatusPill>}
          {hasNoAnswer ? (
            <StatusPill tone="warning" icon={<PhoneMissed aria-hidden />}>
              {noAnswerTime ? `N-a răspuns · ${noAnswerTime}` : 'N-a răspuns'}
            </StatusPill>
          ) : null}
        </div>

        <dl className="space-y-3 px-1">
          <div>
            <dt className={cn('font-medium text-fg-muted', kitText.secondary)}>Adresă</dt>
            <dd className={cn('break-words font-semibold text-fg', kitText.base)}>{address || 'Fără adresă'}</dd>
          </div>
          {nota ? (
            <div>
              <dt className={cn('font-medium text-fg-muted', kitText.secondary)}>Notă</dt>
              <dd className={cn('whitespace-pre-line break-words font-semibold text-fg', kitText.base)}>{nota}</dd>
            </div>
          ) : null}
        </dl>

        <div className="grid grid-cols-2 gap-2.5">
          <Button type="button" variant="neutral" size="touch" disabled={!phone} onClick={() => onCall(stop)}>
            <Phone aria-hidden />
            Sună
          </Button>
          {stop.location ? (
            <a
              href={navigateUrl(stop.location, navApp)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'neutral', size: 'touch' })}
            >
              <Navigation aria-hidden />
              {navLabel}
            </a>
          ) : (
            <Button type="button" variant="neutral" size="touch" disabled aria-describedby="oprire-fara-locatie">
              <Navigation aria-hidden />
              Navighează
            </Button>
          )}
        </div>
        {stop.location ? null : (
          <p id="oprire-fara-locatie" className={cn('px-1 text-fg-muted', kitText.helper)}>
            Navighează: fără locație încă.
            {hasLocatie ? ' Se salvează la prima livrare, din „Salvează locația de aici”.' : ' Locațiile se activează după actualizarea bazei de date.'}
          </p>
        )}

        {canWrite ? (
          <div className="flex flex-col gap-2.5">
            <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setView('livrat')}>
              <Check aria-hidden />
              Livrat
            </Button>
            <Button
              type="button"
              variant="neutral"
              size="touch"
              className="w-full"
              loading={busy === 'no-answer'}
              onClick={() => void toggleNoAnswer()}
            >
              <PhoneMissed aria-hidden />
              {hasNoAnswer ? 'Șterge „nu a răspuns”' : 'Nu a răspuns'}
            </Button>
            <Button
              type="button"
              variant="neutral"
              size="touch"
              className="w-full"
              onClick={() => {
                onMoveToEnd(comanda.id)
                toast.success(`${stop.name}: mutată la finalul traseului.`)
                close()
              }}
            >
              <ArrowDownToLine aria-hidden />
              Mută la finalul traseului
            </Button>
            <Button type="button" variant="neutral" size="touch" className="w-full" onClick={() => setView('muta')}>
              <CalendarDays aria-hidden />
              Mută pe altă zi
            </Button>
            <Button
              type="button"
              variant="neutral"
              size="touch"
              className="w-full"
              onClick={() => {
                setSumaEdited(false)
                setView('copiaza')
              }}
            >
              <Copy aria-hidden />
              Copiază pentru livrarea următoare
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-2.5">
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'quiet', size: 'touch' }), 'w-full')}
            >
              <MessageCircle aria-hidden />
              Anunță livrarea pe WhatsApp
            </a>
          ) : null}
          {!stop.location && address ? (
            <a
              href={mapsSearchUrl(address)}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: 'quiet', size: 'touch' }), 'w-full')}
            >
              <MapPin aria-hidden />
              Caută adresa pe hartă
            </a>
          ) : null}
          {canWrite ? (
            <>
              <Link
                href={`/comenzi?edit=${comanda.id}`}
                className={cn(buttonVariants({ variant: 'quiet', size: 'touch' }), 'w-full')}
              >
                <Pencil aria-hidden />
                Editează comanda
              </Link>
              <Button
                type="button"
                variant="quiet"
                size="touch"
                className="w-full"
                loading={busy === 'scoate'}
                onClick={() => void backToOrders()}
              >
                <Undo2 aria-hidden />
                Scoate din traseu (înapoi la Comenzi)
              </Button>
            </>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={view === 'meniu' ? `${stop.position}. ${stop.name}` : VIEW_TITLE[view]}
      description={view === 'meniu' ? undefined : `${stop.name} · ${formatKg(comanda.cantitate_kg)}`}
    >
      {content}
    </BottomSheet>
  )
}
