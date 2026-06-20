'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
  planOrderClientPersistence,
  resolveExistingClientByPhone,
  type ClientMatchSummary,
  type ClientPhoneMatchResult,
} from '@/lib/comenzi/ai-order-client'
import { queryKeys } from '@/lib/query-keys'
import { createClienți, type ClientTip } from '@/lib/supabase/queries/clienti'
import { createComanda } from '@/lib/supabase/queries/comenzi'
import { toast } from '@/lib/ui/toast'

export type ParsedOrder = {
  nume_client: string | null
  telefon: string | null
  localitate: string | null
  adresa: string | null
  cantitate: number | null
  unitate: 'kg' | 'caserole' | null
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

function badgeVariantForTip(tip: ClientTip): 'secondary' | 'warning' | 'info' {
  if (tip === 'patiserie') return 'warning'
  if (tip === 'magazin') return 'info'
  return 'secondary'
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

function getToneClasses(tone: ConfidenceUiTone | 'neutral'): string {
  if (tone === 'success') {
    return 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
  }

  if (tone === 'warning') {
    return 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
  }

  if (tone === 'danger') {
    return 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
  }

  return 'border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)]'
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

  return {
    clientId: clientMatch.status === 'existing' ? clientMatch.client.id : '',
    clientName:
      clientMatch.status === 'existing'
        ? clientMatch.client.nume_client
        : parsed.nume_client?.trim() ?? '',
    phone: parsed.telefon?.trim() ?? '',
    quantityKg: typeof quantityKg === 'number' ? String(quantityKg) : '',
    pricePerKg:
      clientMatch.status === 'existing' && typeof clientMatch.client.pret_negociat_lei_kg === 'number'
        ? String(clientMatch.client.pret_negociat_lei_kg)
        : '',
    locality: parsed.localitate?.trim() ?? '',
    addressDetails: parsed.adresa?.trim() ?? '',
    deliveryDate: parsed.data_livrare?.trim() ?? '',
    notes: parsed.observatii?.trim() ?? '',
  }
}

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

  const resetSheetState = () => {
    setMesaj('')
    setParsed(null)
    setDraft(defaultDraft())
    setClientMatch(null)
    setParseError(null)
    setFormError(null)
    setIsParsing(false)
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

      let finalClientId = resolvedClientId
      if (clientPlan.action === 'create-new') {
        const createdClient = await createClienți(clientPlan.input)
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
      })

      return createdComanda
    },
    onSuccess: (createdComanda) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
      void queryClient.invalidateQueries({ queryKey: queryKeys.comenziManualInLivrare })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
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
      // onError deja afișează mesajul și păstrează sheet-ul deschis pentru corecturi.
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

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[100dvh] max-h-[100dvh] flex-col pb-0 sm:h-auto sm:max-h-[92svh]"
      >
        <SheetHeader>
          <SheetTitle>Din mesaj</SheetTitle>
          <SheetDescription>
            Lipește mesajul clientului, extrage datele și corectează-le direct aici înainte de salvare.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-5 sm:px-5">
          <div className="space-y-2">
            <Label htmlFor="order-message-input">Mesaj client</Label>
            <Textarea
              id="order-message-input"
              ref={messageRef}
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
              className="agri-control min-h-32"
            />
          </div>

          <Button
            type="button"
            className="h-11 w-full"
            onClick={handleParse}
            disabled={isParsing || createOrderMutation.isPending || !mesaj.trim()}
          >
            {isParsing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {isParsing ? 'Se extrag datele...' : '🔍 Extrage datele'}
          </Button>

          {parseError ? (
            <section className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-3 shadow-[var(--shadow-sm)]">
              <p className="text-sm font-semibold text-[var(--status-warning-text)]">{parseError}</p>
            </section>
          ) : null}

          {parsed ? (
            <div className="space-y-3">
              {confidenceUi ? (
                <section className={`rounded-2xl border px-3 py-3 shadow-[var(--shadow-sm)] ${getToneClasses(confidenceUi.tone)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">{confidenceUi.title}</p>
                      <p className="text-xs opacity-90">{confidenceUi.description}</p>
                    </div>
                    <Badge
                      variant={
                        confidenceUi.tone === 'success'
                          ? 'default'
                          : confidenceUi.tone === 'warning'
                            ? 'warning'
                            : 'destructive'
                      }
                    >
                      {confidenceUi.badgeLabel}
                    </Badge>
                  </div>
                </section>
              ) : null}

              {missingFieldMessages.length > 0 ? (
                <section className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-3 shadow-[var(--shadow-sm)]">
                  <p className="text-sm font-semibold text-[var(--status-warning-text)]">
                    Mai trebuie completate câteva date
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--status-warning-text)]">
                    {missingFieldMessages.map((message) => (
                      <li key={message}>• {message}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {shouldShowManualWarning ? (
                <section className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3 py-3 shadow-[var(--shadow-sm)]">
                  <p className="text-sm font-semibold text-[var(--status-warning-text)]">
                    Poți continua, dar verifică și completează câmpurile lipsă.
                  </p>
                </section>
              ) : null}

              {clientMatch && clientMatchUi ? (
                clientMatch.status === 'existing' ? (
                  <div className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${getToneClasses(clientMatchUi.tone)}`}>
                    <div className="min-w-0">
                      <span className="block truncate font-semibold">{clientMatchUi.title}</span>
                      {clientMatchUi.description ? (
                        <span className="block truncate text-xs opacity-80">{clientMatchUi.description}</span>
                      ) : null}
                    </div>
                    <ClientTipBadge tip={normalizeClientTip(clientMatch.client.tip)} />
                  </div>
                ) : (
                  <div className={`rounded-xl border px-3 py-2 text-sm ${getToneClasses(clientMatchUi.tone)}`}>
                    <span className="block font-semibold">{clientMatchUi.title}</span>
                    {clientMatchUi.description ? (
                      <span className="block text-xs opacity-80">{clientMatchUi.description}</span>
                    ) : null}
                  </div>
                )
              ) : null}

              {formError ? (
                <section className="rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-3 shadow-[var(--shadow-sm)]">
                  <p className="text-sm font-semibold text-[var(--status-danger-text)]">{formError}</p>
                </section>
              ) : null}

              <section className="space-y-3 rounded-2xl bg-[var(--surface-card-muted)] p-3 shadow-[var(--shadow-sm)]">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Date extrase</p>

                <div className="space-y-2">
                  <Label htmlFor="ai-order-client-name">Client</Label>
                  <Input
                    id="ai-order-client-name"
                    value={draft.clientName}
                    readOnly={clientMatch?.status === 'existing'}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, clientName: event.target.value }))
                    }
                  />
                  {clientMatch?.status === 'existing' ? (
                    <p className="text-xs text-[var(--text-secondary)]">
                      Numele vine din clientul existent găsit după telefon.
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ai-order-phone">Telefon</Label>
                    <Input
                      id="ai-order-phone"
                      type="tel"
                      value={draft.phone}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, phone: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-order-quantity">Cantitate (kg)</Label>
                    <Input
                      id="ai-order-quantity"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={draft.quantityKg}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, quantityKg: event.target.value }))
                      }
                    />
                    {parsed.unitate === 'caserole' && typeof parsed.cantitate === 'number' ? (
                      <p className="text-xs text-[var(--text-secondary)]">
                        Mesajul a fost convertit automat în kg pentru salvare.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ai-order-price">Preț (lei/kg)</Label>
                    <Input
                      id="ai-order-price"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={draft.pricePerKg}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, pricePerKg: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai-order-delivery-date">Data livrării</Label>
                    <Input
                      id="ai-order-delivery-date"
                      type="date"
                      value={draft.deliveryDate}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, deliveryDate: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-order-locality">Localitate</Label>
                  <Input
                    id="ai-order-locality"
                    value={draft.locality}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, locality: event.target.value }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-order-address">Adresă / detalii livrare</Label>
                  <Textarea
                    id="ai-order-address"
                    rows={3}
                    value={draft.addressDetails}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, addressDetails: event.target.value }))
                    }
                    className="min-h-24"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-order-notes">Observații</Label>
                  <Textarea
                    id="ai-order-notes"
                    rows={3}
                    value={draft.notes}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, notes: event.target.value }))
                    }
                    className="min-h-24"
                  />
                </div>
              </section>
            </div>
          ) : null}
        </div>

        <SheetFooter className="sticky bottom-0">
          <div className="flex w-full flex-col gap-2">
            {clientMatch?.status === 'ambiguous' ? (
              <Button type="button" variant="outline" className="h-11 w-full" onClick={handleOpenFullForm}>
                Deschide formularul complet
              </Button>
            ) : null}
            <Button
              type="button"
              className="h-11 w-full"
              disabled={!parsed || isParsing || createOrderMutation.isPending}
              onClick={handleCreateOrder}
            >
              {createOrderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {createOrderMutation.isPending ? 'Se salvează...' : 'Creează comanda'}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function ClientTipBadge({ tip }: { tip: ClientTip }) {
  return (
    <Badge variant={badgeVariantForTip(tip)} className="shrink-0">
      {CLIENT_TIP_LABELS[tip]}
    </Badge>
  )
}
