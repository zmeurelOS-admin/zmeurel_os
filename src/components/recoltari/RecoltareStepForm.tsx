'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  Notice,
  NumericKeypad,
  StepForm,
  SuccessScreen,
  keypadValueFrom,
  parseKeypadValue,
  useKeypadFields,
  useStepForm,
  type KeypadKey,
} from '@/components/kit'
import { track } from '@/lib/analytics/track'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { buildHarvestObservatii, getParcelaCropRows } from '@/lib/parcele/crop-config'
import { queryKeys } from '@/lib/query-keys'
import {
  estimatePaymentLei,
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
import {
  calculatePauseStatus,
  getActivitatiAgricole,
  type ActivitateAgricola,
} from '@/lib/supabase/queries/activitati-agricole'
import type { Culegator } from '@/lib/supabase/queries/culegatori'
import type { Parcela } from '@/lib/supabase/queries/parcele'
import { createRecoltare, getRecoltareTotalKg, type Recoltare } from '@/lib/supabase/queries/recoltari'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'

import { RecoltareCulegatorNou, RecoltareCulegatorStep } from './RecoltareCulegatorStep'
import { RECOLTARE_CHOICE_LABEL, RecoltareKgChoice, cropText } from './RecoltareKgChoices'
import { RecoltareKgStep, type RecoltareKgChoiceKey } from './RecoltareKgStep'

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
  /** Referință stabilă (setter sau `useCallback`): altfel se pierde ascultătorul de „înapoi” pe Android. */
  onOpenChange: (open: boolean) => void
  recoltari: readonly Recoltare[]
  parcele: readonly Parcela[]
  culegatori: readonly Culegator[]
  todayIso: string
  /** Ziua cu care pornește formularul (azi sau ziua deschisă în pagină). */
  defaultDate: string
  /** Se aplică o singură dată, la deschidere; „Următorul culegător” nu o reia. */
  prefill?: RecoltareAiPrefill | null
}

const STEPS = ['culegator', 'kg'] as const
const STEPS_WITH_NEW_WORKER = ['culegator', 'culegator-nou', 'kg'] as const
const KG_FIELDS = ['cal1', 'cal2'] as const
const INVALIDATED_AFTER_SAVE = [
  queryKeys.recoltari,
  queryKeys.stocGlobal,
  queryKeys.dashboard,
  queryKeys.stocuriLocatiiRoot,
  queryKeys.miscariStoc,
  queryKeys.cheltuieli,
] as const

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
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

/** Erorile de rețea vin ca text tehnic („TypeError: Failed to fetch”); restul mesajelor rămân cum le dă serverul. */
function readableSaveError(message: string): string {
  if (NETWORK_ERROR.test(message)) {
    return 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează”: recoltarea nu se dublează.'
  }
  return message
}

/** Primul tratament aflat încă în perioada de pauză pe parcela aleasă. Avertizează, nu blochează (ca până acum). */
function findPauseWarning(
  activitati: readonly ActivitateAgricola[],
  parcelaId: string | null,
): { produs: string | null; permisDeLa: string } | null {
  if (!parcelaId) return null
  for (const activitate of activitati) {
    if (activitate.parcela_id !== parcelaId) continue
    const { dataRecoltarePermisa, status } = calculatePauseStatus(activitate.data_aplicare, activitate.timp_pauza_zile)
    if (status !== 'Pauza') continue
    return {
      produs: activitate.produs_utilizat?.trim() || null,
      permisDeLa: new Date(dataRecoltarePermisa).toLocaleDateString('ro-RO'),
    }
  }
  return null
}

/**
 * Adăugarea unei recoltări, pe pași: culegătorul, apoi kilogramele. Salvează direct din pasul 2;
 * ecranul de reușită oferă „Următorul culegător” (formular nou, cheie nouă) sau „Gata”.
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
}: RecoltareStepFormProps) {
  const queryClient = useQueryClient()

  const [addingWorker, setAddingWorker] = useState(false)
  const form = useStepForm({
    steps: addingWorker ? STEPS_WITH_NEW_WORKER : STEPS,
    open,
    analytics: { moduleName: 'recoltari' },
  })
  const fields = useKeypadFields({ fields: KG_FIELDS })

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [choice, setChoice] = useState<RecoltareKgChoiceKey | null>(null)
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
    // poate arunca o randare). De aceea nu „consumă” nimic: același `carry` / `prefill` dă același rezultat.
    const applied = carry ? null : prefill
    const prefillDate = applied && ISO_DAY.test(applied.data) && applied.data <= todayIso ? applied.data : null
    // Kilogramele dictate în chat intră în câmp doar dacă sunt un număr pozitiv care încape în el.
    const prefillKg = applied ? keypadValueFrom(applied.cantitate_kg) : ''
    const hasPrefillKg = (parseKeypadValue(prefillKg) ?? 0) > 0

    setSessionKey(form.clientSyncId)
    setDraft({
      ...EMPTY_DRAFT,
      // „Următorul culegător”: ziua și parcela rămân cele de la cântărirea dinainte.
      date: carry ? carry.date : prefillDate,
      parcelaId: carry ? carry.parcelaId : null,
      note: applied?.observatii ?? '',
      kgFromChat: hasPrefillKg,
      prefill: applied,
    })
    fields.reset()
    if (hasPrefillKg) fields.setValue('cal1', prefillKg)
    setAddingWorker(false)
    setChoice(null)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  // ─── Date pentru pași ───
  const activeCulegatori = useMemo(
    () =>
      culegatori
        .filter((item) => item.status_activ)
        .sort((left, right) => (left.nume_prenume || '').localeCompare(right.nume_prenume || '', 'ro')),
    [culegatori],
  )
  const kgByWorker = useMemo(() => kgByCulegator(recoltariOfDay(recoltari, date)), [recoltari, date])

  const crops = useMemo(() => getParcelaCropRows(parcela), [parcela])
  const crop = crops.find((item) => item.id === draft.cropId) ?? (crops.length === 1 ? crops[0] : null)
  const needsCrop = crops.length > 1

  const kgCal1 = fields.numbers.cal1 ?? 0
  const kgCal2 = draft.withCal2 ? (fields.numbers.cal2 ?? 0) : 0
  const totalKg = kgCal1 + kgCal2
  const tarifLeiKg = culegator && Number.isFinite(Number(culegator.tarif_lei_kg ?? NaN)) ? Number(culegator.tarif_lei_kg) : null
  const paymentLei = estimatePaymentLei(totalKg, tarifLeiKg)

  const { data: activitati = [] } = useQuery({
    queryKey: queryKeys.activitati,
    queryFn: getActivitatiAgricole,
    enabled: open,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  })
  const pauseWarning = findPauseWarning(activitati, parcelaId)

  // ─── Salvarea ───
  const guardRef = useRef<RecoltareSaveGuard | null>(null)
  const liveKeyRef = useRef<string | null>(null)
  useEffect(() => {
    liveKeyRef.current = open ? form.clientSyncId : null
  }, [open, form.clientSyncId])

  const canSave =
    Boolean(culegator) && Boolean(parcela) && totalKg > 0 && tarifLeiKg !== null && (!needsCrop || Boolean(crop)) && !saving

  const save = async () => {
    if (!canSave || !culegator || !parcela) return

    const key = form.clientSyncId
    let guard = guardRef.current
    if (!guard || guard.key !== key) {
      guard = createRecoltareSaveGuard(key)
      guardRef.current = guard
    }
    if (guard.inFlight) return

    const attempt: RecoltareAttempt = {
      culegator_id: culegator.id,
      parcela_id: parcela.id,
      data: date,
      kg_cal1: kgCal1,
      kg_cal2: kgCal2,
    }
    const observatii =
      buildHarvestObservatii(
        draft.note.trim() || undefined,
        crop ? { cropId: crop.id, culture: crop.culture, variety: crop.variety } : null,
      ) || undefined

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
        setSaveError(readableSaveError(outcome.error))
        form.markFailed()
      }
      hapticError()
      return
    }

    const row = outcome.recoltare
    queryClient.setQueryData<Recoltare[]>(queryKeys.recoltari, (previous) =>
      previous && !previous.some((item) => item.id === row.id) ? [row, ...previous] : previous,
    )
    for (const queryKey of INVALIDATED_AFTER_SAVE) {
      void queryClient.invalidateQueries({ queryKey })
    }
    trackEvent('create_recoltare', 'recoltari', { source: 'AddRecoltareDialog' })
    track('recoltare_add', { kg: getRecoltareTotalKg(row), parcela_id: row.parcela_id ?? null })
    hapticSuccess()

    if (stillCurrent) {
      setSaving(false)
      setSaved(outcome)
      form.markSuccess()
    }
  }

  // ─── Navigare ───
  const close = () => onOpenChange(false)

  const nextWorker = () => {
    setCarry({ date: draft.date, parcelaId })
    form.restart()
  }

  const pressKey = (key: KeypadKey) => {
    if (draft.kgFromChat) setDraft((previous) => ({ ...previous, kgFromChat: false }))
    fields.press(key)
  }

  const handleBack = () => {
    if (choice) {
      setChoice(null)
      return true
    }
    if (form.stepKey === 'culegator-nou') setAddingWorker(false)
    return false
  }

  const onKgStep = form.stepKey === 'kg'
  const showChoice = onKgStep && choice !== null

  let content: React.ReactNode = null
  if (form.stepKey === 'culegator') {
    content = (
      <RecoltareCulegatorStep
        culegatori={activeCulegatori}
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
        todayIso={todayIso}
        date={date}
        onDate={(iso) => {
          setDraft((previous) => ({ ...previous, date: iso }))
          setChoice(null)
        }}
        parcele={sortedParcele}
        parcelaId={parcelaId}
        onParcela={(nextParcelaId) => {
          setDraft((previous) => ({
            ...previous,
            parcelaId: nextParcelaId,
            cropId: nextParcelaId === parcelaId ? previous.cropId : null,
          }))
          setChoice(null)
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
      />
    )
  } else if (onKgStep) {
    content = (
      <RecoltareKgStep
        workerName={culegator?.nume_prenume?.trim() || 'Culegător'}
        dateLabel={shortDayLabel(date, todayIso)}
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
        pauseWarning={pauseWarning}
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
      title="Adaugă kilograme"
      description="Alegi culegătorul, apoi scrii kilogramele."
      stepLabel={
        showChoice && choice
          ? RECOLTARE_CHOICE_LABEL[choice]
          : form.stepKey === 'culegator-nou'
            ? 'Culegător nou'
            : undefined
      }
      onBack={handleBack}
      dock={onKgStep && !showChoice ? <NumericKeypad onKey={pressKey} disabled={saving} /> : undefined}
      footer={
        onKgStep && !showChoice
          ? {
              primary: {
                label: saving ? 'Se salvează…' : 'Salvează',
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
              title="Salvat"
              description={`${savedWorkerName} · ${formatKg(getRecoltareTotalKg(saved.recoltare))} · ${formatLei(saved.recoltare.valoare_munca_lei)}`}
              primaryAction={{ label: 'Următorul culegător', onClick: nextWorker }}
              secondaryAction={{ label: 'Gata', onClick: close }}
            />
          </div>
        ) : undefined
      }
    >
      {content}
    </StepForm>
  )
}
