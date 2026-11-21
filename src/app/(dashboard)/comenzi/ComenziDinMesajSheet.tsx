'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

import {
  BigInput,
  BigTextarea,
  BottomSheet,
  Button,
  Notice,
  StatusPill,
  kitText,
  type NoticeTone,
  type StatusTone,
} from '@/components/kit'
import {
  planOrderClientPersistence,
  resolveExistingClientByPhone,
  type ClientMatchSummary,
  type ClientPhoneMatchResult,
} from '@/lib/comenzi/ai-order-client'
import { generateClientId } from '@/lib/offline/generateClientId'
import { queryKeys } from '@/lib/query-keys'
import { createClienți, type ClientTip } from '@/lib/supabase/queries/clienti'
import { createComanda } from '@/lib/supabase/queries/comenzi'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'
import { invalidateDupaComanda } from '@/components/comenzi/useComandaActions'

export type ParsedOrder = {
  nume_client: string | null
  telefon: string | null
  localitate: string | null
  adresa: string | null
  cantitate: number | null
  unitate: 'kg' | 'caserole' | null
  pret_per_kg: number | null
  tip_client: ClientTip
  data_livrare: string | null
  observatii: string | null
  incredere: 'mare' | 'medie' | 'mica'
  campuri_lipsa: string[]
}

type ComenziDinMesajSheetProps = {
  clienti: ClientMatchSummary[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onComandaCreata?: (comandaId: string) => void
}

type ConfidenceUiTone = 'success' | 'warning' | 'danger'

type AiOrderDraft = {
  clientId: string
  clientName: string
  phone: string
  quantityKg: string
  pricePerKg: string
  locality: string
  addressDetails: string
  deliveryDate: string
  notes: string
}

const CLIENT_TIP_LABELS: Record<ClientTip, string> = {
  standard: 'standard',
  patiserie: 'patiserie',
  magazin: 'magazin',
}

const IMPORTANT_MISSING_FIELDS = new Set([
  'nume_client',
  'telefon',
  'localitate',
  'adresa',
  'cantitate',
  'data_livrare',
])

const MISSING_FIELD_LABELS: Record<string, string> = {
  nume_client: 'Lipsește numele clientului',
  telefon: 'Lipsește telefonul',
  localitate: 'Lipsește localitatea',
  adresa: 'Lipsește adresa',
  cantitate: 'Lipsește cantitatea',
  data_livrare: 'Lipsește data la care clientul vrea livrarea',
  observatii: 'Lipsesc observațiile',
}

function defaultDraft(): AiOrderDraft {
  return {
    clientId: '',
    clientName: '',
    phone: '',
    quantityKg: '',
    pricePerKg: '',
    locality: '',
    addressDetails: '',
    deliveryDate: '',
    notes: '',
  }
}

function normalizeClientTip(value: string | null | undefined): ClientTip {
  return value === 'patiserie' || value === 'magazin' ? value : 'standard'
}

function pillToneForTip(tip: ClientTip): StatusTone {
  if (tip === 'patiserie') return 'warning'
  if (tip === 'magazin') return 'info'
  return 'neutral'
}

function cleanPhone(value: string | null): string | null {
  if (!value) return null
  const cleaned = value.replace(/\D/g, '')
  return cleaned || null
}

function getQuantityKgForPrefill(result: ParsedOrder): number | null {
  if (typeof result.cantitate !== 'number') return null
  if (result.unitate === 'caserole') return result.cantitate * 0.5
  if (result.unitate === 'kg') return result.cantitate
  return null
}

function getConfidenceUi(confidence: ParsedOrder['incredere']): {
  badgeLabel: string
  title: string
  description: string
  tone: ConfidenceUiTone
} {
  if (confidence === 'mare') {
    return {
      badgeLabel: 'Încredere mare',
      title: 'AI-ul a extras datele cu încredere mare',
      description: 'Totuși, verifică rapid datele înainte să salvezi comanda.',
      tone: 'success',
    }
  }

  if (confidence === 'mica') {
    return {
      badgeLabel: 'Încredere scăzută',
      title: 'Date incomplete sau nesigure. Completează manual înainte de salvare.',
      description: 'Poți continua, dar verifică atent toate câmpurile importante.',
      tone: 'danger',
    }
  }

  return {
    badgeLabel: 'Verificare necesară',
    title: 'Verifică atent datele extrase',
    description: 'Unele informații pot avea nevoie de corecturi înainte să salvezi comanda.',
    tone: 'warning',
  }
}

function getMissingFieldMessages(fields: string[]): string[] {
  return fields.map((field) => MISSING_FIELD_LABELS[field] ?? `Lipsește ${field.replaceAll('_', ' ')}`)
}

function hasImportantMissingFields(fields: string[]): boolean {
  return fields.some((field) => IMPORTANT_MISSING_FIELDS.has(field))
}

function getClientMatchUi(
  clientMatch: ClientPhoneMatchResult,
): {
  title: string
  description?: string
  tone: ConfidenceUiTone | 'neutral'
} {
  if (clientMatch.status === 'existing') {
    return {
      title: 'Client existent găsit după telefon',
      description: clientMatch.client.nume_client,
      tone: 'success',
    }
  }

  if (clientMatch.status === 'ambiguous') {
    return {
      title: 'Client neclar — verifică manual',
      description: 'Telefonul apare la mai mulți clienți existenți.',
      tone: 'warning',
    }
  }

  return {
    title: 'Client nou / negăsit',
    tone: 'neutral',
  }
}

function noticeTone(tone: ConfidenceUiTone | 'neutral'): NoticeTone {
  return tone === 'neutral' ? 'info' : tone
}

function buildDeliveryLocation(locality: string, addressDetails: string): string | null {
  const trimmedLocality = locality.trim()
  const trimmedAddress = addressDetails.trim()

  if (trimmedAddress && trimmedLocality && !trimmedAddress.toLowerCase().includes(trimmedLocality.toLowerCase())) {
    return `${trimmedAddress}, ${trimmedLocality}`
  }

  return trimmedAddress || trimmedLocality || null
}

function buildDraftFromParsed(
  parsed: ParsedOrder,
  clientMatch: ClientPhoneMatchResult,
): AiOrderDraft {
  const quantityKg = getQuantityKgForPrefill(parsed)

  const clientNegotiatedPrice =
    clientMatch.status === 'existing' && typeof clientMatch.client.pret_negociat_lei_kg === 'number'
      ? clientMatch.client.pret_negociat_lei_kg
      : null

  // Prețul din profilul clientului câștigă față de ce a extras AI-ul.
  const resolvedPrice = clientNegotiatedPrice ?? parsed.pret_per_kg

  return {
    clientId: clientMatch.status === 'existing' ? clientMatch.client.id : '',
    clientName:
      clientMatch.status === 'existing'
        ? clientMatch.client.nume_client
        : parsed.nume_client?.trim() ?? '',
    phone: parsed.telefon?.trim() ?? '',
    quantityKg: typeof quantityKg === 'number' ? String(quantityKg) : '',
    pricePerKg: typeof resolvedPrice === 'number' ? String(resolvedPrice) : '',
    locality: parsed.localitate?.trim() ?? '',
    addressDetails: parsed.adresa?.trim() ?? '',
    deliveryDate: parsed.data_livrare?.trim() ?? '',
    notes: parsed.observatii?.trim() ?? '',
  }
}

/**
 * „Din mesaj”: lipești mesajul clientului (WhatsApp, SMS), datele se extrag și le corectezi înainte de salvare.
 * Logica e cea dinainte de refacerea Comenzilor; s-a schimbat doar înfățișarea (foaie și câmpuri din kit).
 */
export function ComenziDinMesajSheet({
  clienti,
  open,
  onOpenChange,
  onComandaCreata,
}: ComenziDinMesajSheetProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const messageRef = useRef<HTMLTextAreaElement | null>(null)
  const [mesaj, setMesaj] = useState('')
  const [parsed, setParsed] = useState<ParsedOrder | null>(null)
  const [draft, setDraft] = useState<AiOrderDraft>(defaultDraft)
  const [clientMatch, setClientMatch] = useState<ClientPhoneMatchResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  // Cheile de idempotență ale comenzii propuse (și ale clientului nou din mesaj): aceleași cât e deschisă foaia,
  // și la reîncercare, pentru același mesaj. Alt mesaj = altă comandă = alte chei. Se golesc la închidere.
  const cheiPeMesaj = useRef(new Map<string, { comanda: string; client: string }>())
  const cheiCurente = useRef<{ comanda: string; client: string } | null>(null)

  const confidenceUi = useMemo(
    () => (parsed ? getConfidenceUi(parsed.incredere) : null),
    [parsed],
  )
  const missingFieldMessages = useMemo(
    () => (parsed ? getMissingFieldMessages(parsed.campuri_lipsa) : []),
    [parsed],
  )
  const shouldShowManualWarning = useMemo(
    () => (parsed ? parsed.incredere === 'mica' || hasImportantMissingFields(parsed.campuri_lipsa) : false),
    [parsed],
  )
  const clientMatchUi = useMemo(
    () => (clientMatch ? getClientMatchUi(clientMatch) : null),
    [clientMatch],
  )
  // Prețul vine din AI dacă există în extragere și clientul nu are preț negociat în profil.
  const priceFromAi = useMemo(() => {
    if (!parsed?.pret_per_kg) return false
    const clientHasNegotiatedPrice =
      clientMatch?.status === 'existing' &&
      typeof clientMatch.client.pret_negociat_lei_kg === 'number'
    return !clientHasNegotiatedPrice
  }, [parsed, clientMatch])

  const resetSheetState = () => {
    setMesaj('')
    setParsed(null)
    setDraft(defaultDraft())
    setClientMatch(null)
    setParseError(null)
    setFormError(null)
    setIsParsing(false)
    cheiPeMesaj.current.clear()
    cheiCurente.current = null
  }

  useEffect(() => {
    if (!open) return
    const timeoutId = window.setTimeout(() => {
      messageRef.current?.focus()
    }, 80)

    return () => window.clearTimeout(timeoutId)
  }, [open])

  useEffect(() => {
    if (!parsed) {
      setClientMatch(null)
      return
    }

    const nextMatch = resolveExistingClientByPhone(clienti, draft.phone)
    setClientMatch(nextMatch)
    setDraft((current) => {
      if (nextMatch.status === 'existing') {
        const nextPrice =
          current.pricePerKg.trim() ||
          (typeof nextMatch.client.pret_negociat_lei_kg === 'number'
            ? String(nextMatch.client.pret_negociat_lei_kg)
            : '')

        if (
          current.clientId === nextMatch.client.id &&
          current.clientName === nextMatch.client.nume_client &&
          current.pricePerKg === nextPrice
        ) {
          return current
        }

        return {
          ...current,
          clientId: nextMatch.client.id,
          clientName: nextMatch.client.nume_client,
          pricePerKg: nextPrice,
        }
      }

      if (!current.clientId) return current

      return {
        ...current,
        clientId: '',
      }
    })
  }, [clienti, draft.phone, parsed])

  const createOrderMutation = useMutation({
    mutationFn: async (currentDraft: AiOrderDraft) => {
      const quantity = Number(currentDraft.quantityKg)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error('Completează o cantitate validă.')
      }

      const price = Number(currentDraft.pricePerKg)
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('Completează prețul comenzii.')
      }

      const deliveryDate = currentDraft.deliveryDate.trim()
      if (!deliveryDate) {
        throw new Error('Completează data livrării.')
      }

      const deliveryLocation = buildDeliveryLocation(currentDraft.locality, currentDraft.addressDetails)
      if (!deliveryLocation) {
        throw new Error('Completează localitatea sau detaliile de livrare.')
      }

      const resolvedMatch = resolveExistingClientByPhone(clienti, currentDraft.phone)
      if (resolvedMatch.status === 'ambiguous') {
        throw new Error('Telefonul este asociat cu mai mulți clienți. Alege clientul manual din formularul complet.')
      }

      const resolvedClientId = resolvedMatch.status === 'existing' ? resolvedMatch.client.id : null
      const clientPlan = planOrderClientPersistence({
        clienti,
        clientId: resolvedClientId,
        clientName: currentDraft.clientName,
        rawPhone: currentDraft.phone,
        address: deliveryLocation,
        saveClientRequested: true,
        requirePhone: true,
      })

      if (clientPlan.action === 'invalid') {
        throw new Error(clientPlan.message)
      }

      const chei = cheiCurente.current ?? { comanda: generateClientId(), client: generateClientId() }
      cheiCurente.current = chei

      let finalClientId = resolvedClientId
      if (clientPlan.action === 'create-new') {
        // Cu cheie: dacă comanda pică după ce clientul s-a salvat, reîncercarea primește același client.
        const createdClient = await createClienți({ ...clientPlan.input, client_sync_id: chei.client })
        finalClientId = createdClient.id
      }

      if (!finalClientId) {
        throw new Error('Clientul nu a putut fi rezolvat pentru salvarea comenzii.')
      }

      const createdComanda = await createComanda({
        client_id: finalClientId,
        client_nume_manual: null,
        telefon: currentDraft.phone.trim(),
        locatie_livrare: deliveryLocation,
        data_livrare: deliveryDate,
        cantitate_kg: quantity,
        pret_per_kg: price,
        status: 'confirmata',
        observatii: currentDraft.notes.trim() || null,
        // O comandă deja salvată cu această cheie nu se mai creează a doua oară (se întoarce cea existentă).
        client_sync_id: chei.comanda,
      })

      return createdComanda
    },
    onSuccess: (createdComanda) => {
      // O comandă nouă rezervă stoc: aceleași chei ca orice altă comandă, plus clienții (poate fi unul nou).
      invalidateDupaComanda(queryClient)
      void queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      toast.success('Comanda a fost salvată.')
      resetSheetState()
      onOpenChange(false)
      onComandaCreata?.(createdComanda.id)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Nu am putut salva comanda.'
      setFormError(message)
      toast.error(message)
    },
  })

  const handleParse = async () => {
    const text = mesaj.trim()
    if (!text) {
      toast.error('Lipește mesajul clientului înainte de extragere.')
      return
    }

    const chei = cheiPeMesaj.current.get(text) ?? { comanda: generateClientId(), client: generateClientId() }
    cheiPeMesaj.current.set(text, chei)
    cheiCurente.current = chei

    setIsParsing(true)
    setParsed(null)
    setDraft(defaultDraft())
    setClientMatch(null)
    setParseError(null)
    setFormError(null)

    try {
      const response = await fetch('/api/parse-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const json = await response.json()

      if (!response.ok) {
        const errorCode = typeof json?.error?.code === 'string' ? json.error.code : null
        const message =
          errorCode === 'RATE_LIMITED'
            ? 'Ai făcut prea multe încercări. Așteaptă puțin și încearcă din nou.'
            : json?.error?.message ?? json?.error ?? 'Nu am putut extrage datele.'

        throw Object.assign(new Error(message), { code: errorCode })
      }

      const result: ParsedOrder = {
        nume_client: typeof json.nume_client === 'string' ? json.nume_client : null,
        telefon: cleanPhone(typeof json.telefon === 'string' ? json.telefon : null),
        localitate: typeof json.localitate === 'string' ? json.localitate : null,
        adresa: typeof json.adresa === 'string' ? json.adresa : null,
        cantitate: typeof json.cantitate === 'number' ? json.cantitate : null,
        unitate: json.unitate === 'kg' || json.unitate === 'caserole' ? json.unitate : null,
        pret_per_kg: typeof json.pret_per_kg === 'number' && json.pret_per_kg > 0 ? json.pret_per_kg : null,
        tip_client: 'standard',
        data_livrare: typeof json.data_livrare === 'string' ? json.data_livrare : null,
        observatii: typeof json.observatii === 'string' ? json.observatii : null,
        incredere: json.incredere === 'mare' || json.incredere === 'medie' || json.incredere === 'mica'
          ? json.incredere
          : 'medie',
        campuri_lipsa: Array.isArray(json.campuri_lipsa)
          ? json.campuri_lipsa.filter((value: unknown): value is string => typeof value === 'string')
          : [],
      }

      const initialClientMatch = resolveExistingClientByPhone(clienti, result.telefon)
      setParsed(result)
      setClientMatch(initialClientMatch)
      setDraft(buildDraftFromParsed(result, initialClientMatch))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nu am putut extrage datele.'
      console.error('[parse-order] Extragerea datelor a eșuat.', error)
      setParseError(message)
      toast.error(message)
    } finally {
      setIsParsing(false)
    }
  }

  const handleCreateOrder = async () => {
    setFormError(null)
    try {
      await createOrderMutation.mutateAsync(draft)
    } catch {
      // onError deja afișează mesajul și păstrează foaia deschisă pentru corecturi.
    }
  }

  const handleOpenFullForm = () => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('add')
    nextParams.delete('edit')
    nextParams.set('openForm', '1')
    onOpenChange(false)
    resetSheetState()
    router.push(`${pathname}?${nextParams.toString()}`, { scroll: false })
  }

  const handleSheetOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (createOrderMutation.isPending) return
      resetSheetState()
    }

    onOpenChange(nextOpen)
  }

  const existingTip = clientMatch?.status === 'existing' ? normalizeClientTip(clientMatch.client.tip) : null

  return (
    <BottomSheet
      open={open}
      onOpenChange={handleSheetOpenChange}
      title="Din mesaj"
      description="Lipește mesajul clientului, extrage datele și corectează-le aici înainte de salvare."
      footer={
        <div className="flex w-full flex-col gap-2.5">
          {clientMatch?.status === 'ambiguous' ? (
            <Button type="button" variant="neutral" size="touch" className="w-full" onClick={handleOpenFullForm}>
              Deschide formularul complet
            </Button>
          ) : null}
          <Button
            type="button"
            variant="primary"
            size="touch-lg"
            className="w-full"
            disabled={!parsed || isParsing || createOrderMutation.isPending}
            loading={createOrderMutation.isPending}
            onClick={handleCreateOrder}
          >
            {createOrderMutation.isPending ? 'Se salvează...' : 'Creează comanda'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <BigTextarea
          id="order-message-input"
          ref={messageRef}
          label="Mesaj client"
          rows={5}
          value={mesaj}
          onChange={(event) => {
            setMesaj(event.target.value)
            setParsed(null)
            setDraft(defaultDraft())
            setClientMatch(null)
            setParseError(null)
            setFormError(null)
          }}
          placeholder="Lipește mesajul clientului (WhatsApp, SMS, orice...)"
        />

        <Button
          type="button"
          variant="neutral"
          size="touch-lg"
          className="w-full"
          onClick={handleParse}
          disabled={isParsing || createOrderMutation.isPending || !mesaj.trim()}
          loading={isParsing}
        >
          {isParsing ? null : <Search aria-hidden />}
          {isParsing ? 'Se extrag datele...' : 'Extrage datele'}
        </Button>

        {parseError ? <Notice tone="warning" title={parseError} /> : null}

        {parsed ? (
          <div className="space-y-3">
            {confidenceUi ? (
              <Notice tone={noticeTone(confidenceUi.tone)} title={confidenceUi.title}>
                {confidenceUi.description}
                <span className="mt-2 block">
                  <StatusPill tone={confidenceUi.tone}>{confidenceUi.badgeLabel}</StatusPill>
                </span>
              </Notice>
            ) : null}

            {missingFieldMessages.length > 0 ? (
              <Notice tone="warning" title="Mai trebuie completate câteva date">
                <ul className="space-y-1">
                  {missingFieldMessages.map((message) => (
                    <li key={message}>• {message}</li>
                  ))}
                </ul>
              </Notice>
            ) : null}

            {shouldShowManualWarning ? (
              <Notice tone="warning" title="Poți continua, dar verifică și completează câmpurile lipsă." />
            ) : null}

            {clientMatch && clientMatchUi ? (
              <Notice tone={noticeTone(clientMatchUi.tone)} title={clientMatchUi.title}>
                {clientMatchUi.description || existingTip ? (
                  <span className="flex flex-wrap items-center gap-2">
                    {clientMatchUi.description ? <span>{clientMatchUi.description}</span> : null}
                    {existingTip ? (
                      <StatusPill tone={pillToneForTip(existingTip)}>{CLIENT_TIP_LABELS[existingTip]}</StatusPill>
                    ) : null}
                  </span>
                ) : null}
              </Notice>
            ) : null}

            {formError ? <Notice tone="danger" title={formError} /> : null}

            <section className="space-y-3 rounded-box bg-surface-muted p-3">
              <p className={cn('font-bold text-fg', kitText.base)}>Date extrase</p>

              <BigInput
                id="ai-order-client-name"
                label="Client"
                value={draft.clientName}
                readOnly={clientMatch?.status === 'existing'}
                onChange={(event) => setDraft((current) => ({ ...current, clientName: event.target.value }))}
                hint={
                  clientMatch?.status === 'existing' ? 'Numele vine din clientul existent găsit după telefon.' : undefined
                }
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <BigInput
                  id="ai-order-phone"
                  label="Telefon"
                  type="tel"
                  value={draft.phone}
                  onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                />
                <BigInput
                  id="ai-order-quantity"
                  label="Cantitate (kg)"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={draft.quantityKg}
                  onChange={(event) => setDraft((current) => ({ ...current, quantityKg: event.target.value }))}
                  hint={
                    parsed.unitate === 'caserole' && typeof parsed.cantitate === 'number'
                      ? 'Mesajul a fost convertit automat în kg pentru salvare.'
                      : undefined
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <BigInput
                  id="ai-order-price"
                  label="Preț (lei/kg)"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={draft.pricePerKg}
                  onChange={(event) => setDraft((current) => ({ ...current, pricePerKg: event.target.value }))}
                  hint={priceFromAi ? '(extras din mesaj)' : undefined}
                />
                <BigInput
                  id="ai-order-delivery-date"
                  label="Data livrării"
                  type="date"
                  value={draft.deliveryDate}
                  onChange={(event) => setDraft((current) => ({ ...current, deliveryDate: event.target.value }))}
                />
              </div>

              <BigInput
                id="ai-order-locality"
                label="Localitate"
                value={draft.locality}
                onChange={(event) => setDraft((current) => ({ ...current, locality: event.target.value }))}
              />

              <BigTextarea
                id="ai-order-address"
                label="Adresă / detalii livrare"
                rows={3}
                value={draft.addressDetails}
                onChange={(event) => setDraft((current) => ({ ...current, addressDetails: event.target.value }))}
              />

              <BigTextarea
                id="ai-order-notes"
                label="Observații"
                rows={3}
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              />
            </section>
          </div>
        ) : null}
      </div>
    </BottomSheet>
  )
}
