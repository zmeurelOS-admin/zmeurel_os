'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import {
  Button,
  Notice,
  NumericKeypad,
  StepForm,
  StepFormTitle,
  SuccessScreen,
  keypadValueFrom,
  kitText,
  parseKeypadValue,
  useKeypadFields,
  useStepForm,
  type KeypadKey,
} from '@/components/kit'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import {
  buildHarvestObservatii,
  getHarvestCropSelection,
  getHarvestPauseReason,
  getParcelaCropRows,
  stripHiddenAgricultureMetadata,
  type MotivRecoltarePauza,
} from '@/lib/parcele/crop-config'
import { queryKeys } from '@/lib/query-keys'
import {
  estimatePaymentLei,
  tarifPentruPlata,
  formatKg,
  formatLei,
  kgByCulegator,
  lastUsedParcelaId,
  recoltariOfDay,
  shortDayLabel,
  type RecoltareAttempt,
} from '@/lib/recoltari/day-view'
import { resolveRecoltareParcelaId } from '@/lib/recoltari/parcela-link'
import {
  createRecoltareSaveGuard,
  saveRecoltareGuarded,
  type RecoltareSaveGuard,
  type RecoltareSaved,
} from '@/lib/recoltari/save-guard'
import { usePauzeActive } from '@/lib/tratamente/hooks'
import type { Culegator } from '@/lib/supabase/queries/culegatori'
import type { Parcela } from '@/lib/supabase/queries/parcele'
import {
  createRecoltare,
  getRecoltareTotalKg,
  updateRecoltare,
  type Recoltare,
} from '@/lib/supabase/queries/recoltari'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

import { RecoltareCulegatorNou, RecoltareCulegatorStep } from './RecoltareCulegatorStep'
import { RECOLTARE_CHOICE_LABEL, RecoltareKgChoice, cropText } from './RecoltareKgChoices'
import { RecoltareKgStep, type RecoltareKgChoiceKey } from './RecoltareKgStep'
import { RECOLTARE_INVALIDATED } from '@/lib/recoltari/invalidate'

/** Ce vine din chatul AI prin URL (`?openForm=1&…`). Toate sunt text, posibil gol. */
export interface RecoltareAiPrefill {
  parcela_id: string
  parcela_label: string
  cantitate_kg: string
  data: string
  observatii: string
}

export interface RecoltareStepFormProps {
  open: boolean
  /** Referință stabilă (setter sau `useCallback`). */
  onOpenChange: (open: boolean) => void
  recoltari: readonly Recoltare[]
  parcele: readonly Parcela[]
  culegatori: readonly Culegator[]
  todayIso: string
  /** Ziua cu care pornește formularul (azi sau ziua deschisă în pagină). */
  defaultDate: string
  /** Se aplică o singură dată, la deschidere; „Următorul culegător” nu o reia. */
  prefill?: RecoltareAiPrefill | null
  /**
   * Culegătorul ales dinainte (din fișa lui, `/recoltari?culegator=<id>`): formularul pornește direct pe kilograme.
   * „Următorul culegător” revine la alegerea culegătorului.
   */
  initialCulegatorId?: string | null
  /**
   * Recoltarea editată. Cu ea, formularul pornește pe kilograme, cu valorile salvate afișate.
   * Pagina o păstrează până la următoarea deschidere, ca să nu sară conținutul cât se animă închiderea.
   */
  editing?: Recoltare | null
}

const STEPS = ['culegator', 'kg'] as const
const STEPS_WITH_NEW_WORKER = ['culegator', 'culegator-nou', 'kg'] as const
const KG_FIELDS = ['cal1', 'cal2'] as const
const INVALIDATED_AFTER_SAVE = RECOLTARE_INVALIDATED

interface Draft {
  culegatorId: string | null
  /** `null` = ziua implicită. */
  date: string | null
  /** `null` = parcela implicită (ultima folosită). */
  parcelaId: string | null
  cropId: string | null
  note: string
  withCal2: boolean
  kgFromChat: boolean
  /** Precompletarea aplicată acestei înregistrări (parcela ei se rezolvă când se încarcă parcelele). */
  prefill: RecoltareAiPrefill | null
  /** „Recoltez totuși” dintr-o parcelă în pauză: motivul ales (se salvează în `observatii`). */
  motivPauza: MotivRecoltarePauza | null
}

const EMPTY_DRAFT: Draft = {
  culegatorId: null,
  date: null,
  parcelaId: null,
  cropId: null,
  note: '',
  withCal2: false,
  kgFromChat: false,
  prefill: null,
  motivPauza: null,
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

const SERVER_MESSAGES: Record<string, string> = {
  insufficient_stock_after_edit:
    'Nu poți micșora cantitatea: o parte din aceste kilograme e deja vândută sau promisă în comenzi.',
  forbidden_read_only: 'Nu ai drept de scriere pe recoltări.',
}

/** Erorile de rețea și codurile serverului vin ca text tehnic; restul mesajelor rămân cum le dă serverul. */
function readableSaveError(message: string, mode: 'create' | 'edit'): string {
  if (NETWORK_ERROR.test(message)) {
    return mode === 'create'
      ? 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează”: recoltarea nu se dublează.'
      : 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează modificările”.'
  }
  const known = Object.keys(SERVER_MESSAGES).find((code) => message.includes(code))
  return known ? SERVER_MESSAGES[known] : message
}

const dayOnly = (value: string | null | undefined) => String(value ?? '').slice(0, 10)

/**
 * Adăugarea sau editarea unei recoltări, pe pași: culegătorul, apoi kilogramele. Salvează direct din pasul 2.
 * La adăugare, ecranul de reușită oferă „Următorul culegător” (formular nou, cheie nouă) sau „Gata”.
 * Închiderea cu ceva nesalvat cere confirmare.
 */
export function RecoltareStepForm({
  open,
  onOpenChange,
  recoltari,
  parcele,
  culegatori,
  todayIso,
  defaultDate,
  prefill = null,
  initialCulegatorId = null,
  editing = null,
}: RecoltareStepFormProps) {
  const queryClient = useQueryClient()
  const mode = editing ? 'edit' : 'create'

  const [addingWorker, setAddingWorker] = useState(false)
  const form = useStepForm({
    steps: addingWorker ? STEPS_WITH_NEW_WORKER : STEPS,
    open,
    mode,
    initialStep: editing || initialCulegatorId ? 'kg' : undefined,
    analytics: { moduleName: 'recoltari' },
  })
  const fields = useKeypadFields({ fields: KG_FIELDS })

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [choice, setChoice] = useState<RecoltareKgChoiceKey | null>(null)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<RecoltareSaved | null>(null)

  // ─── Valori implicite (derivate, ca să prindă și datele încărcate după deschidere) ───
  const parcelaIds = useMemo(() => new Set(parcele.map((parcela) => parcela.id)), [parcele])
  const sortedParcele = useMemo(
    () => [...parcele].sort((left, right) => Number(right.rol === 'comercial') - Number(left.rol === 'comercial')),
    [parcele],
  )
  const prefillHasParcela = Boolean(draft.prefill?.parcela_id || draft.prefill?.parcela_label)
  const defaultParcelaId = useMemo(() => {
    if (draft.prefill && prefillHasParcela) {
      return resolveRecoltareParcelaId({
        parcelaId: draft.prefill.parcela_id,
        parcelaLabel: draft.prefill.parcela_label,
        parcele: [...parcele],
      })
    }
    const last = lastUsedParcelaId(recoltari, parcelaIds)
    if (last) return last
    const commercial = parcele.filter((parcela) => parcela.rol === 'comercial')
    return commercial.length === 1 ? commercial[0].id : null
  }, [draft.prefill, prefillHasParcela, parcele, parcelaIds, recoltari])

  const date = draft.date ?? defaultDate
  const parcelaId = draft.parcelaId ?? defaultParcelaId
  const parcela = parcele.find((item) => item.id === parcelaId) ?? null
  const culegator = culegatori.find((item) => item.id === draft.culegatorId) ?? null

  // ─── O cheie de idempotență nouă înseamnă o înregistrare nouă ───
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  // Ce rămâne de la o cântărire la următoarea („Următorul culegător”). `null` = deschidere nouă.
  const [carry, setCarry] = useState<{ date: string | null; parcelaId: string | null } | null>(null)
  if (!open && sessionKey !== null) {
    // Închis: păstrăm conținutul cât se animă ieșirea; următoarea deschidere pornește de la zero.
    setSessionKey(null)
    setCarry(null)
  }
  if (open && sessionKey !== form.clientSyncId) {
    // Blocul poate rula de două ori pentru aceeași deschidere (cheia se generează la randare, iar React
    // poate arunca o randare). De aceea nu „consumă” nimic: aceleași intrări dau același rezultat.
    setSessionKey(form.clientSyncId)
    fields.reset()

    if (editing) {
      // Editare: valorile salvate, afișate. Aici nu e propunere, e ce există deja.
      setDraft({
        ...EMPTY_DRAFT,
        culegatorId: editing.culegator_id,
        date: dayOnly(editing.data) || null,
        parcelaId: editing.parcela_id,
        cropId: getHarvestCropSelection(editing.observatii)?.cropId ?? null,
        note: stripHiddenAgricultureMetadata(editing.observatii),
        withCal2: editing.kg_cal2 > 0,
        motivPauza: getHarvestPauseReason(editing.observatii)?.motiv ?? null,
      })
      fields.setValue('cal1', editing.kg_cal1 > 0 ? editing.kg_cal1 : null)
      fields.setValue('cal2', editing.kg_cal2 > 0 ? editing.kg_cal2 : null)
    } else {
      const applied = carry ? null : prefill
      const prefillDate = applied && ISO_DAY.test(applied.data) && applied.data <= todayIso ? applied.data : null
      // Kilogramele dictate în chat intră în câmp doar dacă sunt un număr pozitiv care încape în el.
      const prefillKg = applied ? keypadValueFrom(applied.cantitate_kg) : ''
      const hasPrefillKg = (parseKeypadValue(prefillKg) ?? 0) > 0

      setDraft({
        ...EMPTY_DRAFT,
        // Culegătorul venit din fișa lui se aplică doar primei cântăriri, nu și la „Următorul culegător”.
        culegatorId: carry ? null : initialCulegatorId,
        // „Următorul culegător”: ziua și parcela rămân cele de la cântărirea dinainte.
        date: carry ? carry.date : prefillDate,
        parcelaId: carry ? carry.parcelaId : null,
        note: applied?.observatii ?? '',
        kgFromChat: hasPrefillKg,
        prefill: applied,
      })
      if (hasPrefillKg) fields.setValue('cal1', prefillKg)
    }

    setAddingWorker(false)
    setChoice(null)
    setConfirmingClose(false)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  // ─── Date pentru pași ───
  const workerChoices = useMemo(
    () =>
      culegatori
        // La editare, culegătorul recoltării rămâne în listă chiar dacă între timp a fost dezactivat.
        .filter((item) => item.status_activ || item.id === editing?.culegator_id)
        .sort((left, right) => (left.nume_prenume || '').localeCompare(right.nume_prenume || '', 'ro')),
    [culegatori, editing?.culegator_id],
  )
  const kgByWorker = useMemo(() => kgByCulegator(recoltariOfDay(recoltari, date)), [recoltari, date])

  const crops = useMemo(() => getParcelaCropRows(parcela), [parcela])
  const crop = crops.find((item) => item.id === draft.cropId) ?? (crops.length === 1 ? crops[0] : null)
  const needsCrop = crops.length > 1
  // La editare, pe aceeași parcelă: dacă alegerea salvată nu mai e printre culturile parcelei, se păstrează.
  const savedCrop =
    editing && parcelaId === editing.parcela_id ? getHarvestCropSelection(editing.observatii) : null
  const cropForSave = crop ? { cropId: crop.id, culture: crop.culture, variety: crop.variety } : savedCrop

  const kgCal1 = fields.numbers.cal1 ?? 0
  const kgCal2 = draft.withCal2 ? (fields.numbers.cal2 ?? 0) : 0
  const totalKg = kgCal1 + kgCal2
  const tarifCurent = culegator && Number.isFinite(Number(culegator.tarif_lei_kg ?? NaN)) ? Number(culegator.tarif_lei_kg) : null
  // La editare, cu același culegător, plata rămâne la tariful de atunci (ca pe server).
  const tarifLeiKg = tarifPentruPlata({ culegatorId: draft.culegatorId, tarifCurent, editing })
  const paymentLei = estimatePaymentLei(totalKg, tarifLeiKg)
  const workerName = culegator?.nume_prenume?.trim() || 'Culegător'

  // Pauza după tratament, în ziua recoltării (aplicările noi + activitățile vechi). Doar avertizare.
  const { pauze } = usePauzeActive(date, { enabled: open })
  const pauseWarning = parcelaId ? (pauze.get(parcelaId) ?? null) : null
  // „Recoltez totuși” cere un motiv la o recoltare nouă; la editare, motivul vechi rămâne pe aceeași parcelă.
  const needsPauseReason = pauseWarning !== null && !editing && draft.motivPauza === null

  // ─── Ce s-ar pierde la închidere ───
  const dirty = editing
    ? kgCal1 !== editing.kg_cal1 ||
      kgCal2 !== editing.kg_cal2 ||
      draft.culegatorId !== editing.culegator_id ||
      parcelaId !== editing.parcela_id ||
      date !== dayOnly(editing.data) ||
      draft.note.trim() !== stripHiddenAgricultureMetadata(editing.observatii)
    : totalKg > 0

  // ─── Salvarea ───
  const guardRef = useRef<RecoltareSaveGuard | null>(null)
  const editInFlight = useRef(false)
  const liveKeyRef = useRef<string | null>(null)
  useEffect(() => {
    liveKeyRef.current = open ? form.clientSyncId : null
  }, [open, form.clientSyncId])

  const canSave =
    Boolean(culegator) &&
    Boolean(parcela) &&
    totalKg > 0 &&
    tarifLeiKg !== null &&
    (!needsCrop || Boolean(cropForSave)) &&
    !saving

  const applySaved = (row: Recoltare) => {
    queryClient.setQueryData<Recoltare[]>(queryKeys.recoltari, (previous) => {
      if (!previous) return previous
      return previous.some((item) => item.id === row.id)
        ? previous.map((item) => (item.id === row.id ? row : item))
        : [row, ...previous]
    })
    for (const queryKey of INVALIDATED_AFTER_SAVE) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }

  const save = async () => {
    if (!canSave || !culegator || !parcela) return
    if (needsPauseReason) {
      // Parcela e în pauză: întâi avertismentul, cu „Alege altă parcelă” sau „Recoltez totuși” + motiv.
      setChoice('tratament')
      return
    }

    const key = form.clientSyncId
    const attempt: RecoltareAttempt = {
      culegator_id: culegator.id,
      parcela_id: parcela.id,
      data: date,
      kg_cal1: kgCal1,
      kg_cal2: kgCal2,
    }
    const savedPause = editing && parcelaId === editing.parcela_id ? getHarvestPauseReason(editing.observatii) : null
    const pauzaForSave = draft.motivPauza
      ? {
          motiv: draft.motivPauza,
          panaLa: pauseWarning?.panaLa ?? savedPause?.panaLa ?? null,
          produs: pauseWarning?.produs ?? savedPause?.produs ?? null,
        }
      : null
    const observatii = buildHarvestObservatii(draft.note.trim() || undefined, cropForSave, pauzaForSave) || undefined

    if (editing) {
      if (editInFlight.current) return
      editInFlight.current = true
      setSaving(true)
      setSaveError(null)

      // Text gol, nu `undefined`: așa se poate și șterge o notă existentă.
      const result = await updateRecoltare(editing.id, { ...attempt, observatii: observatii ?? '' })
      editInFlight.current = false
      const stillCurrent = liveKeyRef.current === key

      if (!result.success) {
        if (stillCurrent) {
          setSaving(false)
          setSaveError(readableSaveError(result.error, 'edit'))
        }
        hapticError()
        return
      }

      applySaved(result.data)
      track('recoltare_edit', { id: editing.id })
      hapticSuccess()
      if (stillCurrent) {
        setSaving(false)
        setSaved({ status: 'saved', recoltare: result.data, warning: result.warning, differs: false })
        form.markSuccess()
      }
      return
    }

    let guard = guardRef.current
    if (!guard || guard.key !== key) {
      guard = createRecoltareSaveGuard(key)
      guardRef.current = guard
    }
    if (guard.inFlight) return

    setSaving(true)
    setSaveError(null)

    // Cheia formularului pleacă spre server ca `client_sync_id`: o reîncercare întoarce recoltarea deja creată.
    const outcome = await saveRecoltareGuarded({ guard, attempt, observatii, create: createRecoltare })
    if (outcome.status === 'busy') return

    // Formularul a fost închis sau repornit între timp: rezultatul nu mai aparține ecranului curent.
    const stillCurrent = liveKeyRef.current === key

    if (outcome.status === 'failed') {
      if (stillCurrent) {
        setSaving(false)
        setSaveError(readableSaveError(outcome.error, 'create'))
        form.markFailed()
      }
      hapticError()
      return
    }

    applySaved(outcome.recoltare)
    trackEvent('create_recoltare', 'recoltari', { source: 'AddRecoltareDialog' })
    track('recoltare_add', {
      kg: getRecoltareTotalKg(outcome.recoltare),
      parcela_id: outcome.recoltare.parcela_id ?? null,
    })
    hapticSuccess()

    if (stillCurrent) {
      setSaving(false)
      setSaved(outcome)
      form.markSuccess()
    }
  }

  // ─── Navigare și închidere ───
  const close = () => onOpenChange(false)

  /** X, Esc, „înapoi”: cu ceva nesalvat, întâi întrebăm. Cât se salvează, nu se închide. */
  const closeGuard = () => {
    if (form.done) return false
    if (saving) return true
    if (!dirty) return false
    setConfirmingClose(true)
    return true
  }

  const nextWorker = () => {
    setCarry({ date: draft.date, parcelaId })
    form.restart()
    // Cu un culegător ales dinainte formularul repornește pe kilograme: îl ducem la alegerea culegătorului.
    if (initialCulegatorId) form.goTo('culegator')
  }

  const pressKey = (key: KeypadKey) => {
    if (draft.kgFromChat) setDraft((previous) => ({ ...previous, kgFromChat: false }))
    fields.press(key)
  }

  const handleBack = () => {
    if (confirmingClose) {
      setConfirmingClose(false)
      return true
    }
    if (choice) {
      setChoice(null)
      return true
    }
    if (form.stepKey === 'culegator-nou') setAddingWorker(false)
    return false
  }

  const onKgStep = form.stepKey === 'kg'
  const showChoice = onKgStep && choice !== null && !confirmingClose
  const showKeypad = onKgStep && !showChoice && !confirmingClose

  let content: React.ReactNode = null
  if (confirmingClose) {
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>
          {editing ? 'Renunți la modificări?' : `Renunți la ${formatKg(totalKg)} pentru ${workerName}?`}
        </StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>
          {editing ? 'Recoltarea rămâne cum era salvată.' : 'Kilogramele tastate nu au fost salvate.'}
        </p>
        <div className="mt-3 flex flex-col gap-2.5">
          <Button
            type="button"
            variant="primary"
            size="touch-lg"
            className="w-full"
            onClick={() => setConfirmingClose(false)}
          >
            Continuă
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={close}>
            Renunță
          </Button>
        </div>
      </div>
    )
  } else if (form.stepKey === 'culegator') {
    content = (
      <RecoltareCulegatorStep
        culegatori={workerChoices}
        selectedId={draft.culegatorId}
        kgByWorker={kgByWorker}
        isToday={date === todayIso}
        onPick={(culegatorId) => {
          setDraft((previous) => ({ ...previous, culegatorId }))
          form.next()
        }}
        onAddNew={() => {
          setAddingWorker(true)
          form.next()
        }}
      />
    )
  } else if (form.stepKey === 'culegator-nou') {
    content = (
      <RecoltareCulegatorNou
        onCreated={(created) => {
          setDraft((previous) => ({ ...previous, culegatorId: created.id }))
          // Pasul „culegător nou” iese din listă; indexul rămâne pe locul lui, adică pe kilograme.
          setAddingWorker(false)
        }}
      />
    )
  } else if (showChoice && choice) {
    content = (
      <RecoltareKgChoice
        choice={choice}
        onChoice={setChoice}
        todayIso={todayIso}
        date={date}
        onDate={(iso) => {
          setDraft((previous) => ({ ...previous, date: iso }))
          setChoice(null)
        }}
        parcele={sortedParcele}
        parcelaId={parcelaId}
        parcelaLabel={parcela?.nume_parcela?.trim() || null}
        onParcela={(nextParcelaId) => {
          const changed = nextParcelaId !== parcelaId
          setDraft((previous) => ({
            ...previous,
            parcelaId: nextParcelaId,
            cropId: changed ? null : previous.cropId,
            motivPauza: changed ? null : previous.motivPauza,
          }))
          // O parcelă în pauză: avertismentul apare imediat (la o recoltare nouă, fără motiv ales încă).
          const inPauza = pauze.has(nextParcelaId)
          setChoice(inPauza && !editing && (changed || draft.motivPauza === null) ? 'tratament' : null)
        }}
        crops={crops}
        cropId={crop?.id ?? null}
        onCrop={(cropId) => {
          setDraft((previous) => ({ ...previous, cropId }))
          setChoice(null)
        }}
        note={draft.note}
        onNote={(note) => {
          setDraft((previous) => ({ ...previous, note }))
          setChoice(null)
        }}
        pauseWarning={pauseWarning}
        pauze={pauze}
        motivPauza={draft.motivPauza}
        onMotivPauza={(motivPauza) => {
          setDraft((previous) => ({ ...previous, motivPauza }))
          setChoice(null)
        }}
      />
    )
  } else if (onKgStep) {
    content = (
      <RecoltareKgStep
        workerName={workerName}
        // Cu butonul de avertisment pe același rând, pastila de dată e mai îngustă.
        dateLabel={shortDayLabel(date, todayIso, pauseWarning !== null)}
        parcelaLabel={parcela ? parcela.nume_parcela?.trim() || 'Parcelă fără nume' : null}
        showCrop={needsCrop}
        cropLabel={crop ? cropText(crop) || 'Cultură' : null}
        onOpenChoice={setChoice}
        cal1={fields.values.cal1}
        cal2={fields.values.cal2}
        active={draft.withCal2 ? fields.active : 'cal1'}
        onActivate={fields.setActive}
        withCal2={draft.withCal2}
        onAddCal2={() => {
          setDraft((previous) => ({ ...previous, withCal2: true }))
          fields.setActive('cal2')
        }}
        kgFromChat={draft.kgFromChat}
        tarifLeiKg={tarifLeiKg}
        paymentLei={paymentLei}
        note={draft.note}
        hasPauseWarning={pauseWarning !== null}
        saveError={saveError}
      />
    )
  }

  const savedWorkerName =
    culegatori.find((item) => item.id === saved?.recoltare.culegator_id)?.nume_prenume?.trim() || 'Culegător'

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title={editing ? 'Editează recoltarea' : 'Adaugă kilograme'}
      description={editing ? 'Schimbi kilogramele, data, parcela sau culegătorul.' : 'Alegi culegătorul, apoi scrii kilogramele.'}
      stepLabel={
        confirmingClose
          ? 'Nesalvat'
          : showChoice && choice
            ? RECOLTARE_CHOICE_LABEL[choice]
            : form.stepKey === 'culegator-nou'
              ? 'Culegător nou'
              : undefined
      }
      onBack={handleBack}
      dock={showKeypad ? <NumericKeypad onKey={pressKey} disabled={saving} /> : undefined}
      footer={
        showKeypad
          ? {
              primary: {
                label: saving ? 'Se salvează…' : editing ? 'Salvează modificările' : 'Salvează',
                onClick: () => void save(),
                loading: saving,
                disabled: !canSave,
              },
            }
          : null
      }
      success={
        saved ? (
          <div className="flex min-h-full flex-col gap-3">
            {saved.differs ? (
              <Notice tone="warning" title="S-au salvat valorile de la prima încercare">
                Prima trimitere ajunsese deja la server, iar modificarea făcută după aceea nu s-a aplicat. Corectează
                cântărirea din lista zilei.
              </Notice>
            ) : null}
            {saved.warning ? (
              <Notice tone="warning" title="Salvat, dar manopera nu s-a actualizat">
                {saved.warning}
              </Notice>
            ) : null}
            <SuccessScreen
              className="min-h-0 flex-1"
              title={editing ? 'Modificat' : 'Salvat'}
              description={`${savedWorkerName} · ${formatKg(getRecoltareTotalKg(saved.recoltare))} · ${formatLei(saved.recoltare.valoare_munca_lei)}`}
              primaryAction={
                editing ? { label: 'Gata', onClick: close } : { label: 'Următorul culegător', onClick: nextWorker }
              }
              secondaryAction={editing ? undefined : { label: 'Gata', onClick: close }}
            />
          </div>
        ) : undefined
      }
    >
      {content}
    </StepForm>
  )
}
