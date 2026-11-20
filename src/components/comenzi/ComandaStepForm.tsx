'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import {
  Button,
  Notice,
  NumericKeypad,
  StepForm,
  StepFormTitle,
  SuccessScreen,
  kitText,
  useKeypadFields,
  useStepForm,
} from '@/components/kit'
import { track } from '@/lib/analytics/track'
import { resolveExistingClientByPhone } from '@/lib/comenzi/ai-order-client'
import { CANTITATI_KG, parseStocInsuficient } from '@/lib/comenzi/day-view'
import { comandaClientName } from '@/lib/comenzi/display'
import { formatKg, formatLei, relativeDayRo, round2 } from '@/lib/format-ro'
import { pretPentruClient, usePretStandardStare } from '@/lib/pret-standard'
import { queryKeys } from '@/lib/query-keys'
import type { Client } from '@/lib/supabase/queries/clienti'
import {
  createComanda,
  deliverComanda,
  updateComanda,
  type Comanda,
  type ComandaOrderKind,
  type UpdateComandaInput,
} from '@/lib/supabase/queries/comenzi'
import { downloadVCard } from '@/lib/utils/downloadVCard'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { cn } from '@/lib/utils'

import { ComandaClientNou, ComandaClientStep } from './ComandaClientStep'
import {
  COMANDA_CHOICE_LABEL,
  ComandaCantitateChoice,
  ComandaChoice,
  ComandaDetaliiStep,
  type ComandaChoiceKey,
  type ComandaDateValue,
} from './ComandaDetaliiStep'
import { COMENZI_INVALIDATED } from './useComandaActions'

/** Ce vine prin URL: din chatul AI (`?openForm=1&…`) sau din fișa clientului (`?client=<id>&nou=1`). Text, posibil gol. */
export interface ComandaPrefill {
  clientId: string
  clientName: string
  telefon: string
  adresa: string
  dataLivrare: string
  cantitateKg: string
  pretPerKg: string
  observatii: string
}

export interface ComandaStepFormProps {
  open: boolean
  /** Referință stabilă (setter sau `useCallback`). */
  onOpenChange: (open: boolean) => void
  clienti: readonly Client[]
  comenzi: readonly Comanda[]
  todayIso: string
  /** Există coloana `prioritara`: altfel comutatorul nu apare și câmpul nu se trimite. */
  hasPrioritara: boolean
  /** Se aplică o singură dată, la deschidere; „Încă o comandă” nu o reia. */
  prefill?: ComandaPrefill | null
  /** Comanda editată. Formularul pornește pe detalii, cu valorile salvate. */
  editing?: Comanda | null
}

const STEPS = ['client', 'detalii'] as const
const STEPS_WITH_NEW_CLIENT = ['client', 'client-nou', 'detalii'] as const
const KG_FIELDS = ['kg'] as const
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
const NETWORK_ERROR = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i

interface Draft {
  clientId: string | null
  /** Numele scris de mână (comandă fără client în fișă, nume venit din chat). */
  manualName: string
  telefon: string
  /** `null` = nimic ales. */
  cantitateKg: number | null
  date: ComandaDateValue
  /** `null` = adresa din fișa clientului. */
  adresa: string | null
  /** `null` = prețul implicit (negociat sau standard). */
  pret: number | null
  orderKind: ComandaOrderKind
  nota: string
  prioritara: boolean
}

const EMPTY_DRAFT: Draft = {
  clientId: null,
  manualName: '',
  telefon: '',
  cantitateKg: null,
  date: undefined,
  adresa: null,
  pret: null,
  orderKind: 'manual',
  nota: '',
  prioritara: false,
}

const dayOnly = (value: string | null | undefined) => String(value ?? '').slice(0, 10)

function positiveNumber(text: string): number | null {
  const value = Number(String(text).replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? round2(value) : null
}

/** Clientul unei precompletări: după id, altfel după telefon (doar dacă e unul singur). */
export function resolvePrefillClientId(prefill: ComandaPrefill | null | undefined, clienti: readonly Client[]): string | null {
  if (!prefill) return null
  if (prefill.clientId && clienti.some((client) => client.id === prefill.clientId)) return prefill.clientId
  const match = resolveExistingClientByPhone([...clienti], prefill.telefon)
  return match.status === 'existing' ? match.client.id : null
}

function readableSaveError(cause: unknown, mode: 'create' | 'edit'): string {
  const message = cause instanceof Error ? cause.message : ''
  if (NETWORK_ERROR.test(message)) {
    return mode === 'create'
      ? 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează comanda”: comanda nu se dublează.'
      : 'Nu există conexiune la internet. Când revine, apasă din nou „Salvează modificările”.'
  }
  const stock = parseStocInsuficient(cause)
  if (stock) {
    return `Nu ajunge stocul: lipsesc ${formatKg(Math.max(0, round2(stock.necesarKg - stock.disponibilKg)))}.`
  }
  return message || 'Verifică internetul și încearcă din nou.'
}

/**
 * Comandă nouă sau editare, pe pași: clientul, apoi detaliile. Salvează direct din pasul 2.
 * `comenzi` nu are cheie de idempotență în baza de date: butonul e blocat cât rulează cererea,
 * iar o cheie de formular se trimite o singură dată.
 */
export function ComandaStepForm({
  open,
  onOpenChange,
  clienti,
  comenzi,
  todayIso,
  hasPrioritara,
  prefill = null,
  editing = null,
}: ComandaStepFormProps) {
  const queryClient = useQueryClient()
  const { standard, seIncarca: pretSeIncarca } = usePretStandardStare()
  const mode = editing ? 'edit' : 'create'

  const prefillClientId = editing ? null : resolvePrefillClientId(prefill, clienti)

  const [addingClient, setAddingClient] = useState(false)
  const [clientSeed, setClientSeed] = useState({ nume: '', telefon: '' })
  const form = useStepForm({
    steps: addingClient ? STEPS_WITH_NEW_CLIENT : STEPS,
    open,
    mode,
    initialStep: editing || prefillClientId ? 'detalii' : undefined,
    analytics: { moduleName: 'comenzi' },
  })
  const fields = useKeypadFields({ fields: KG_FIELDS })

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [choice, setChoice] = useState<ComandaChoiceKey | null>(null)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ comanda: Comanda; warning: string | null } | null>(null)

  // ─── O cheie de formular nouă înseamnă o comandă nouă ───
  const [sessionKey, setSessionKey] = useState<string | null>(null)
  // „Încă o comandă”: precompletarea din URL nu se mai aplică.
  const [restarted, setRestarted] = useState(false)
  if (!open && sessionKey !== null) {
    setSessionKey(null)
    setRestarted(false)
  }
  if (open && sessionKey !== form.clientSyncId) {
    // Poate rula de două ori pentru aceeași deschidere: aceleași intrări dau același rezultat.
    setSessionKey(form.clientSyncId)
    fields.reset()

    if (editing) {
      setDraft({
        clientId: editing.client_id,
        manualName: editing.client_nume_manual ?? editing.client_nume ?? '',
        telefon: editing.telefon ?? '',
        cantitateKg: editing.cantitate_kg > 0 ? round2(editing.cantitate_kg) : null,
        date: dayOnly(editing.data_livrare) || null,
        adresa: editing.locatie_livrare ?? '',
        pret: round2(editing.pret_per_kg),
        orderKind: editing.order_kind ?? 'manual',
        nota: editing.observatii ?? '',
        prioritara: editing.prioritara === true,
      })
    } else if (prefill && !restarted) {
      const date = ISO_DAY.test(prefill.dataLivrare) && prefill.dataLivrare >= todayIso ? prefill.dataLivrare : undefined
      setDraft({
        ...EMPTY_DRAFT,
        clientId: prefillClientId,
        manualName: prefill.clientName,
        telefon: prefill.telefon,
        cantitateKg: positiveNumber(prefill.cantitateKg),
        date,
        adresa: prefill.adresa.trim() ? prefill.adresa.trim() : null,
        pret: positiveNumber(prefill.pretPerKg),
        nota: prefill.observatii,
      })
    } else {
      setDraft(EMPTY_DRAFT)
    }

    setAddingClient(false)
    setClientSeed({ nume: '', telefon: '' })
    setChoice(null)
    setConfirmingClose(false)
    setSaving(false)
    setSaveError(null)
    setSaved(null)
  }

  // ─── Valori derivate ───
  const client = clienti.find((item) => item.id === draft.clientId) ?? null
  const clientName = client?.nume_client?.trim() || draft.manualName.trim()
  const pretImplicit = pretPentruClient(client, standard)
  const pretNegociat = pretImplicit.sursa === 'negociat' ? pretImplicit.pret : null
  const pret = draft.pret ?? pretImplicit.pret
  const pretSursa: 'negociat' | 'standard' | 'manual' =
    draft.pret === null
      ? pretImplicit.sursa
      : pretNegociat !== null && draft.pret === pretNegociat
        ? 'negociat'
        : draft.pret === standard.activ
          ? 'standard'
          : 'manual'
  const adresa = draft.adresa ?? client?.adresa ?? ''
  const zeroPrice = draft.orderKind !== 'manual'
  const total = draft.cantitateKg !== null && !zeroPrice ? round2(draft.cantitateKg * pret) : 0
  const prioritara = hasPrioritara && draft.prioritara && Boolean(draft.date)

  const dirty = editing
    ? draft.clientId !== editing.client_id ||
      draft.cantitateKg !== round2(editing.cantitate_kg) ||
      (draft.date ?? null) !== (dayOnly(editing.data_livrare) || null) ||
      adresa.trim() !== (editing.locatie_livrare ?? '').trim() ||
      (!zeroPrice && pret !== round2(editing.pret_per_kg)) ||
      draft.orderKind !== (editing.order_kind ?? 'manual') ||
      draft.nota.trim() !== (editing.observatii ?? '').trim() ||
      prioritara !== (editing.prioritara === true)
    : draft.clientId !== null || draft.cantitateKg !== null

  // ─── Salvarea ───
  const inFlight = useRef(false)
  const sentKeys = useRef(new Map<string, { comanda: Comanda; warning: string | null }>())
  const liveKeyRef = useRef<string | null>(null)
  useEffect(() => {
    liveKeyRef.current = open ? form.clientSyncId : null
  }, [open, form.clientSyncId])

  // Cât setările nu au venit, prețul standard e cel de rezervă: nu se salvează cu el.
  const pretInAsteptare = pretSeIncarca && draft.pret === null && pretImplicit.sursa === 'standard' && !zeroPrice
  const canSave =
    !pretInAsteptare &&
    Boolean(clientName) &&
    draft.cantitateKg !== null &&
    draft.cantitateKg > 0 &&
    draft.date !== undefined &&
    (zeroPrice || pret > 0) &&
    !saving

  const refreshLists = () => {
    for (const queryKey of COMENZI_INVALIDATED) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }

  const save = async () => {
    if (!canSave || draft.cantitateKg === null || inFlight.current) return
    const key = form.clientSyncId

    // Cheia a fost deja salvată (răspunsul a venit după ce ecranul s-a schimbat): nu trimitem a doua oară.
    const alreadySent = sentKeys.current.get(key)
    if (alreadySent && !editing) {
      setSaved(alreadySent)
      form.markSuccess()
      return
    }

    inFlight.current = true
    setSaving(true)
    setSaveError(null)

    const cantitate = draft.cantitateKg
    const common = {
      locatie_livrare: adresa.trim() || null,
      data_livrare: draft.date ?? null,
      cantitate_kg: cantitate,
      pret_per_kg: zeroPrice ? 0 : pret,
      order_kind: draft.orderKind,
      observatii: draft.nota.trim() || null,
      ...(hasPrioritara ? { prioritara } : {}),
    }

    try {
      let comanda: Comanda
      let warning: string | null = null

      if (editing) {
        const clientChanged = draft.clientId !== editing.client_id
        const payload: UpdateComandaInput = {
          ...common,
          ...(clientChanged
            ? {
                client_id: draft.clientId,
                client_nume_manual: draft.clientId ? null : draft.manualName.trim() || null,
                telefon: client?.telefon ?? (draft.telefon.trim() || null),
              }
            : {}),
        }
        comanda = await updateComanda(editing.id, payload)
        track('comanda_edit', { id: editing.id })
      } else {
        comanda = await createComanda({
          ...common,
          client_id: draft.clientId,
          client_nume_manual: draft.clientId ? null : draft.manualName.trim() || null,
          telefon: client?.telefon ?? (draft.telefon.trim() || null),
          data_comanda: todayIso,
          status: 'confirmata',
        })
        track('comanda_add', { cantitate, client_id: draft.clientId })

        if (draft.orderKind === 'consum_propriu') {
          // Consumul propriu nu se livrează: se scade din stoc pe loc.
          try {
            const delivered = await deliverComanda({ comandaId: comanda.id, cantitateLivrataKg: cantitate, statusPlata: 'platit' })
            comanda = delivered.deliveredOrder
          } catch (cause) {
            warning = `Comanda a fost creată, dar scăderea din stoc nu a mers (${readableSaveError(cause, 'create')}) O găsești pe „Azi” și o poți marca livrată de acolo.`
          }
        }
        sentKeys.current.set(key, { comanda, warning })
      }

      queryClient.setQueryData<Comanda[]>(queryKeys.comenzi, (previous) => {
        if (!previous) return previous
        return previous.some((item) => item.id === comanda.id)
          ? previous.map((item) => (item.id === comanda.id ? comanda : item))
          : [comanda, ...previous]
      })
      refreshLists()
      hapticSuccess()

      // Formularul a fost închis sau repornit între timp: rezultatul nu mai aparține ecranului curent.
      if (liveKeyRef.current === key) {
        setSaved({ comanda, warning })
        form.markSuccess()
      }
    } catch (cause) {
      hapticError()
      refreshLists()
      if (liveKeyRef.current === key) {
        setSaveError(readableSaveError(cause, mode))
        form.markFailed()
      }
    } finally {
      inFlight.current = false
      if (liveKeyRef.current === key) setSaving(false)
    }
  }

  // ─── Navigare și închidere ───
  const close = () => onOpenChange(false)

  const closeGuard = () => {
    if (form.done) return false
    if (saving) return true
    if (!dirty) return false
    setConfirmingClose(true)
    return true
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
    if (form.stepKey === 'client-nou') setAddingClient(false)
    return false
  }

  const pickClient = (picked: Client) => {
    // Alt client: prețul și adresa se iau din fișa lui.
    setDraft((previous) =>
      previous.clientId === picked.id ? previous : { ...previous, clientId: picked.id, pret: null, adresa: null },
    )
  }

  const onDetalii = form.stepKey === 'detalii'
  const showChoice = onDetalii && choice !== null && !confirmingClose
  const customKg = fields.numbers.kg

  let content: React.ReactNode = null
  if (confirmingClose) {
    content = (
      <div className="flex min-h-full flex-col justify-center gap-3 py-6 text-center">
        <StepFormTitle>{editing ? 'Renunți la modificări?' : 'Renunți la comandă?'}</StepFormTitle>
        <p className={cn('text-fg-muted', kitText.base)}>
          {editing
            ? 'Comanda rămâne cum era salvată.'
            : clientName
              ? `Comanda pentru ${clientName} nu a fost salvată.`
              : 'Comanda nu a fost salvată.'}
        </p>
        <div className="mt-3 flex flex-col gap-2.5">
          <Button type="button" variant="primary" size="touch-lg" className="w-full" onClick={() => setConfirmingClose(false)}>
            Continuă
          </Button>
          <Button type="button" variant="neutral" size="touch-lg" className="w-full" onClick={close}>
            Renunță
          </Button>
        </div>
      </div>
    )
  } else if (form.stepKey === 'client') {
    content = (
      <ComandaClientStep
        // Căutarea pornește de la numele scris de mână, dacă există (comandă fără client, nume din chat).
        key={`${form.clientSyncId}-${draft.clientId ? '' : draft.manualName}`}
        clienti={clienti}
        comenzi={comenzi}
        initialQuery={draft.clientId ? '' : draft.manualName}
        onPick={(picked) => {
          pickClient(picked)
          form.next()
        }}
        onAddNew={(seed) => {
          setClientSeed({ nume: seed.nume || draft.manualName, telefon: seed.telefon || draft.telefon })
          setAddingClient(true)
          form.next()
        }}
      />
    )
  } else if (form.stepKey === 'client-nou') {
    const finishWith = (picked: Client) => {
      pickClient(picked)
      // Pasul „client nou” iese din listă; indexul rămâne pe locul lui, adică pe detalii.
      setAddingClient(false)
    }
    content = <ComandaClientNou clienti={clienti} seed={clientSeed} onCreated={finishWith} onUseExisting={finishWith} />
  } else if (showChoice && choice === 'cantitate') {
    content = <ComandaCantitateChoice value={fields.values.kg} active />
  } else if (showChoice && choice) {
    content = (
      <ComandaChoice
        choice={choice as Exclude<ComandaChoiceKey, 'cantitate'>}
        todayIso={todayIso}
        date={draft.date}
        onDate={(iso) => {
          setDraft((previous) => ({ ...previous, date: iso }))
          setChoice(null)
        }}
        adresa={adresa}
        adresaClient={client?.adresa ?? null}
        onAdresa={(text) => {
          setDraft((previous) => ({ ...previous, adresa: text }))
          setChoice(null)
        }}
        pretLeiKg={pret}
        pretStandard={standard.activ}
        pretNegociat={pretNegociat}
        orderKind={draft.orderKind}
        onPret={(value) => {
          setDraft((previous) => ({
            ...previous,
            orderKind: value.orderKind,
            // Prețul implicit rămâne „implicit”, ca să urmeze clientul dacă e schimbat.
            pret: value.orderKind !== 'manual' || value.pret === pretImplicit.pret ? null : value.pret,
          }))
          setChoice(null)
        }}
        nota={draft.nota}
        onNota={(text) => {
          setDraft((previous) => ({ ...previous, nota: text }))
          setChoice(null)
        }}
      />
    )
  } else if (onDetalii) {
    content = (
      <ComandaDetaliiStep
        clientName={clientName || 'Client'}
        todayIso={todayIso}
        cantitateKg={draft.cantitateKg}
        onCantitate={(kg) => setDraft((previous) => ({ ...previous, cantitateKg: kg }))}
        date={draft.date}
        onDate={(date) =>
          setDraft((previous) => ({ ...previous, date, prioritara: date === null ? false : previous.prioritara }))
        }
        adresa={adresa}
        pretLeiKg={pret}
        pretSeIncarca={pretInAsteptare}
        pretSursa={pretSursa}
        orderKind={draft.orderKind}
        nota={draft.nota}
        prioritara={hasPrioritara ? prioritara : null}
        onPrioritara={(value) => setDraft((previous) => ({ ...previous, prioritara: value }))}
        onOpenChoice={(next) => {
          if (next === 'cantitate') {
            fields.reset()
            // O cantitate scrisă deja de mână se poate corecta, nu se pornește de la zero.
            const isPreset = draft.cantitateKg !== null && (CANTITATI_KG as readonly number[]).includes(draft.cantitateKg)
            if (draft.cantitateKg !== null && !isPreset) fields.setValue('kg', draft.cantitateKg)
          }
          setChoice(next)
        }}
        saveError={saveError}
      />
    )
  }

  const savedName = saved ? comandaClientName(saved.comanda, new Map(clienti.map((item) => [item.id, item]))) : ''
  const savedPhone = saved?.comanda.telefon?.trim() ?? ''

  return (
    <StepForm
      form={form}
      open={open}
      onOpenChange={onOpenChange}
      closeGuard={closeGuard}
      title={editing ? 'Editează comanda' : 'Comandă nouă'}
      description={editing ? 'Schimbi cantitatea, ziua, adresa, prețul sau clientul.' : 'Alegi clientul, apoi cantitatea și ziua livrării.'}
      stepLabel={
        confirmingClose
          ? 'Nesalvat'
          : showChoice && choice
            ? COMANDA_CHOICE_LABEL[choice]
            : form.stepKey === 'client-nou'
              ? 'Client nou'
              : undefined
      }
      onBack={handleBack}
      dock={
        showChoice && choice === 'cantitate' ? <NumericKeypad onKey={fields.press} aria-label="Tastatură pentru cantitate" /> : undefined
      }
      footer={
        showChoice && choice === 'cantitate'
          ? {
              primary: {
                label: customKg && customKg > 0 ? `Folosește ${formatKg(customKg)}` : 'Scrie cantitatea',
                disabled: !customKg || customKg <= 0,
                onClick: () => {
                  if (!customKg || customKg <= 0) return
                  setDraft((previous) => ({ ...previous, cantitateKg: round2(customKg) }))
                  setChoice(null)
                },
              },
            }
          : onDetalii && !showChoice && !confirmingClose
            ? {
                primary: {
                  label: saving
                    ? 'Se salvează…'
                    : editing
                      ? 'Salvează modificările'
                      : total > 0
                        ? `Salvează comanda · ${formatLei(total)}`
                        : 'Salvează comanda',
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
            {saved.warning ? (
              <Notice tone="warning" title="Salvată, dar stocul nu s-a scăzut">
                {saved.warning}
              </Notice>
            ) : null}
            <SuccessScreen
              className="min-h-0 flex-1"
              title={editing ? 'Modificată' : 'Comandă salvată'}
              description={[
                savedName,
                formatKg(saved.comanda.cantitate_kg),
                relativeDayRo(saved.comanda.data_livrare, todayIso),
                saved.comanda.total > 0 ? formatLei(saved.comanda.total) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              primaryAction={{ label: 'Gata', onClick: close }}
              secondaryAction={
                editing
                  ? undefined
                  : {
                      label: 'Încă o comandă',
                      onClick: () => {
                        setRestarted(true)
                        form.restart()
                      },
                    }
              }
            />
            {!editing && savedName && savedPhone ? (
              <Button type="button" variant="quiet" size="touch" className="w-full" onClick={() => downloadVCard(savedName, savedPhone)}>
                Salvează contactul în telefon
              </Button>
            ) : null}
          </div>
        ) : undefined
      }
    >
      {content}
    </StepForm>
  )
}
