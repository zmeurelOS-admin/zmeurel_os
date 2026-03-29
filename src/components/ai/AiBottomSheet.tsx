'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { formatUnitateDisplayName } from '@/lib/parcele/unitate'
import { createCheltuiala } from '@/lib/supabase/queries/cheltuieli'
import { getClienți } from '@/lib/supabase/queries/clienti'
import { createComanda } from '@/lib/supabase/queries/comenzi'
import { createInvestitie } from '@/lib/supabase/queries/investitii'
import { getParcele, type Parcela } from '@/lib/supabase/queries/parcele'
import { createRecoltare } from '@/lib/supabase/queries/recoltari'
import { queryKeys } from '@/lib/query-keys'
import { toast } from '@/lib/ui/toast'
import { hapticSuccess } from '@/lib/utils/haptic'

// ─── Speech Recognition type shims ───────────────────────────────────────────

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

interface SpeechRecognitionResult {
  readonly [index: number]: { transcript: string; confidence: number }
}

interface SpeechRecognitionResultList {
  readonly [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SheetState = 'idle' | 'listening' | 'processing' | 'answer' | 'form' | 'limit'

interface FormData {
  form: string
  prefillData: Record<string, unknown>
  message: string
}

interface ApiResponse {
  type?: 'answer' | 'form' | 'limit'
  response?: string
  form?: string
  prefill_data?: Record<string, unknown>
  prefill?: Record<string, unknown>
  message?: string
  messagesUsed?: number
  messagesLimit?: number
  error?: string
}

interface HistoryHintPayload {
  previousUserMessage: string
  previousAiMessage: string
}

// ─── Suggestion pills per route ───────────────────────────────────────────────

const SUGGESTIONS: Record<string, string[]> = {
  '/cheltuieli': ['300 lei manoperă ieri', 'Adaugă cheltuială', 'Cât am cheltuit luna asta?'],
  '/investitii': ['1200 lei butași zmeur', 'Pompă irigații 850 lei', 'Adaugă investiție'],
  '/recoltari': ['Recoltat 12kg azi', 'Total recoltat luna asta?', 'Adaugă recoltare'],
  '/activitati-agricole': ['Stropit cu Switch azi', 'Irigat parcela 1', 'Adaugă activitate'],
  '/clienti': ['Telefon client Ionescu', 'Câți clienți activi?'],
  '/culegatori': ['Câți culegători activi?', 'Total kg recoltat azi'],
  '/comenzi': ['Câte comenzi nelivrate?', 'Status comenzi'],
  '/parcele': ['Ce parcele am active?', 'Suprafață totală'],
  '/dashboard': ['Ce trebuie să fac azi?', 'Sumar fermă', 'Alerte active?'],
}

function getSuggestions(pathname: string): string[] {
  for (const [key, pills] of Object.entries(SUGGESTIONS)) {
    if (pathname.includes(key)) return pills
  }
  return ['Ce trebuie să fac azi?', 'Adaugă cheltuială', 'Adaugă recoltare']
}

// ─── Form route builder ───────────────────────────────────────────────────────

export function buildFormUrl(form: string, prefillData: Record<string, unknown>): string | null {
  const params = new URLSearchParams({ openForm: '1' })
  if (form === 'cheltuiala') {
    if (prefillData.id) params.set('edit', String(prefillData.id))
    if (prefillData.suma != null) params.set('suma', String(prefillData.suma))
    if (prefillData.data) params.set('data', String(prefillData.data))
    if (prefillData.categorie) params.set('categorie', String(prefillData.categorie))
    if (prefillData.descriere) params.set('descriere', String(prefillData.descriere))
    return `/cheltuieli?${params}`
  }
  if (form === 'investitie') {
    if (prefillData.id) params.set('edit', String(prefillData.id))
    if (prefillData.suma != null) params.set('suma', String(prefillData.suma))
    if (prefillData.data) params.set('data', String(prefillData.data))
    if (prefillData.categorie) params.set('categorie', String(prefillData.categorie))
    if (prefillData.descriere) params.set('descriere', String(prefillData.descriere))
    return `/investitii?${params}`
  }
  if (form === 'recoltare') {
    if (prefillData.cantitate_kg != null) params.set('cantitate_kg', String(prefillData.cantitate_kg))
    if (prefillData.parcela_id) params.set('parcela_id', String(prefillData.parcela_id))
    if (prefillData.parcela_label) params.set('parcela_label', String(prefillData.parcela_label))
    if (prefillData.parcela) params.set('parcela_label', String(prefillData.parcela))
    if (prefillData.data) params.set('data', String(prefillData.data))
    if (prefillData.calitate) params.set('calitate', String(prefillData.calitate))
    if (prefillData.observatii) params.set('observatii', String(prefillData.observatii))
    return `/recoltari?${params}`
  }
  if (form === 'activitate') {
    if (prefillData.id) params.set('edit', String(prefillData.id))
    if (prefillData.tip) params.set('tip', String(prefillData.tip))
    if (prefillData.parcela_id) params.set('parcela_id', String(prefillData.parcela_id))
    if (prefillData.parcela_label) params.set('parcela_label', String(prefillData.parcela_label))
    if (prefillData.parcela) params.set('parcela_label', String(prefillData.parcela))
    if (prefillData.produs) params.set('produs', String(prefillData.produs))
    if (prefillData.doza) params.set('doza', String(prefillData.doza))
    if (prefillData.data) params.set('data', String(prefillData.data))
    if (prefillData.observatii) params.set('observatii', String(prefillData.observatii))
    return `/activitati-agricole?${params}`
  }
  if (form === 'comanda') {
    if (prefillData.client_id) params.set('client_id', String(prefillData.client_id))
    if (prefillData.client_label) params.set('client_label', String(prefillData.client_label))
    if (prefillData.nume_client) params.set('client_label', String(prefillData.nume_client))
    if (prefillData.telefon) params.set('telefon', String(prefillData.telefon))
    if (prefillData.locatie_livrare) params.set('locatie_livrare', String(prefillData.locatie_livrare))
    if (prefillData.data_livrare) params.set('data_livrare', String(prefillData.data_livrare))
    if (prefillData.cantitate_kg != null) params.set('cantitate_kg', String(prefillData.cantitate_kg))
    if (prefillData.pret_per_kg != null) params.set('pret_per_kg', String(prefillData.pret_per_kg))
    if (prefillData.produs) params.set('produs', String(prefillData.produs))
    if (prefillData.observatii) params.set('observatii', String(prefillData.observatii))
    return `/comenzi?${params}`
  }
  if (form === 'client') {
    if (prefillData.nume_client) params.set('nume_client', String(prefillData.nume_client))
    if (prefillData.telefon) params.set('telefon', String(prefillData.telefon))
    if (prefillData.email) params.set('email', String(prefillData.email))
    if (prefillData.adresa) params.set('adresa', String(prefillData.adresa))
    if (prefillData.observatii) params.set('observatii', String(prefillData.observatii))
    return `/clienti?${params}`
  }
  return null
}

function formLabel(form: string): string {
  const labels: Record<string, string> = {
    cheltuiala: '📉 Cheltuială',
    investitie: '🏗️ Investiție',
    recoltare: '🫐 Recoltare',
    activitate: '🌿 Activitate agricolă',
    comanda: '📦 Comandă',
    client: '👤 Client',
  }
  return labels[form] ?? form
}

const FIELD_LABELS: Record<string, string> = {
  suma: 'Sumă', categorie: 'Categorie', data: 'Data', descriere: 'Descriere',
  parcela: 'Parcelă', parcela_label: 'Parcelă', cantitate_kg: 'Cantitate kg', calitate: 'Calitate',
  tip: 'Tip', produs: 'Produs', doza: 'Doză', pret_per_kg: 'Preț/kg',
  client_label: 'Client',
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? (key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '))
}

function getDisplayPrefillEntries(form: string, prefillData: Record<string, unknown>): Array<[string, unknown]> {
  const hiddenKeys = new Set(['client_id', 'parcela_id', 'nume_client'])
  return Object.entries(prefillData).filter(([key, value]) => {
    if (hiddenKeys.has(key)) return false
    if (form === 'comanda' && key === 'client_label' && prefillData.client_id) return value != null && value !== ''
    if (form === 'recoltare' && key === 'parcela_label' && prefillData.parcela_id) return value != null && value !== ''
    if (form === 'activitate' && key === 'parcela_label' && prefillData.parcela_id) return value != null && value !== ''
    if ((key === 'parcela' && prefillData.parcela_label) || (key === 'nume_client' && prefillData.client_label)) return false
    return value != null && value !== ''
  })
}

// ─── Counter color ────────────────────────────────────────────────────────────

function counterColor(used: number, limit: number): string {
  const ratio = used / limit
  if (ratio >= 0.9) return '#e85d5d'
  if (ratio >= 0.7) return '#f4a261'
  return '#a3c9b8'
}

function normalizeEntityLabel(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getParcelaLabelCandidates(parcela: Parcela): string[] {
  return [
    parcela.nume_parcela,
    formatUnitateDisplayName(parcela.nume_parcela, parcela.tip_unitate, ''),
    parcela.soi_plantat,
    parcela.soi,
    parcela.tip_fruct,
    parcela.cultura,
  ]
    .map((candidate) => normalizeEntityLabel(candidate))
    .filter(Boolean)
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.').trim())
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }
  return null
}

function renderInternalMarkdownLinks(text: string) {
  const linkRegex = /\[([^\]\n]+)\]\((\/[A-Za-z0-9\-._~\/?#\[\]@!$&'()*+,;=:%]*)\)/g
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null = null

  while ((match = linkRegex.exec(text)) !== null) {
    const [fullMatch, label, href] = match
    const start = match.index

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start))
    }

    if (label && href.startsWith('/')) {
      nodes.push(
        <Link
          key={`ai-link-${start}-${href}`}
          href={href}
          style={{ color: 'var(--agri-primary)', textDecoration: 'underline', fontWeight: 600 }}
        >
          {label}
        </Link>
      )
    } else {
      nodes.push(fullMatch)
    }

    lastIndex = start + fullMatch.length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.length > 0 ? nodes : text
}

// ─── Component ────────────────────────────────────────────────────────────────

interface AiBottomSheetProps {
  open: boolean
  onClose: () => void
  variant?: 'sheet' | 'panel'
}

export function AiBottomSheet({ open, onClose, variant = 'sheet' }: AiBottomSheetProps) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [state, setState] = useState<SheetState>('idle')
  const [inputText, setInputText] = useState('')
  const [answerText, setAnswerText] = useState('')
  const [formData, setFormData] = useState<FormData | null>(null)
  const [messagesUsed, setMessagesUsed] = useState<number | null>(null)
  const [messagesLimit, setMessagesLimit] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const conversationIdRef = useRef<string>(`ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
  const historyHintRef = useRef<HistoryHintPayload | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const listeningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load message count on open
  useEffect(() => {
    if (!open) return
    fetch('/api/chat/count')
      .then((r) => r.json())
      .then((d: { messagesUsed?: number; messagesLimit?: number }) => {
        if (d.messagesUsed != null) setMessagesUsed(d.messagesUsed)
        if (d.messagesLimit != null) setMessagesLimit(d.messagesLimit)
      })
      .catch(() => {
        // counter unavailable, degrade gracefully
        setMessagesUsed(null)
        setMessagesLimit(null)
      })
  }, [open])

  useEffect(() => {
    conversationIdRef.current = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    historyHintRef.current = null
  }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setSpeechSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition))
  }, [])

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setState('idle')
      setInputText('')
      setAnswerText('')
      setFormData(null)
      stopListening()
    } else {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const stopListening = useCallback(() => {
    if (listeningTimeoutRef.current) {
      clearTimeout(listeningTimeoutRef.current)
      listeningTimeoutRef.current = null
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* ignore */ }
      recognitionRef.current = null
    }
    setState((current) => (current === 'listening' ? 'idle' : current))
  }, [])

  const startListening = useCallback(() => {
    const SpeechRecognitionCtor =
      typeof window !== 'undefined'
        ? (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null)
        : null
    if (!SpeechRecognitionCtor) return

    setState('listening')

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'ro-RO'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event) => {
      const transcript = (event as SpeechRecognitionEvent).results[0]?.[0]?.transcript || ''
      setInputText(transcript)
      stopListening()
      setState('idle')
      if (transcript.trim()) {
        setTimeout(() => sendMessage(transcript), 100)
      }
    }

    recognition.onerror = (event) => {
      stopListening()
      if (event.error === 'not-allowed') {
        toast.error('Accesul la microfon a fost blocat. Verifică permisiunile browserului.')
      } else if (event.error === 'no-speech') {
        // tăcere — nu afișa eroare
      } else {
        toast.error('Eroare la recunoașterea vocii. Încearcă din nou.')
      }
    }

    recognition.onend = () => {
      stopListening()
    }

    recognitionRef.current = recognition
    listeningTimeoutRef.current = setTimeout(() => {
      stopListening()
      toast.error('Timeout — nu s-a detectat vorbire.')
    }, 15_000)
    recognition.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopListening])

  const counterLabel =
    messagesUsed != null && messagesLimit != null
      ? `${messagesUsed}/${messagesLimit}`
      : '–'

  const counterTextColor =
    messagesUsed != null && messagesLimit != null
      ? counterColor(messagesUsed, messagesLimit)
      : 'var(--agri-text-muted)'

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = (text ?? inputText).trim()
      if (!msg) return

      setState('processing')
      setInputText('')

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: msg,
            pathname,
            conversationId: conversationIdRef.current,
            history: historyHintRef.current,
          }),
        })

        const data: ApiResponse = await res.json()

        if (data.messagesUsed != null) setMessagesUsed(data.messagesUsed)
        if (data.messagesLimit != null) setMessagesLimit(data.messagesLimit)

        if (res.status === 429 || data.type === 'limit') {
          const aiMessage = data.response ?? data.error ?? 'Limită atinsă. Revino mâine!'
          historyHintRef.current = { previousUserMessage: msg, previousAiMessage: aiMessage }
          setAnswerText(aiMessage)
          setState('limit')
          return
        }

        if (!res.ok) {
          const aiMessage = data.error ?? 'Eroare la server. Încearcă din nou.'
          historyHintRef.current = { previousUserMessage: msg, previousAiMessage: aiMessage }
          setAnswerText(aiMessage)
          setState('answer')
          return
        }

        if (data.type === 'form' && data.form) {
          const aiMessage = data.message ?? 'Am pregătit formularul. Verifică și salvează!'
          historyHintRef.current = { previousUserMessage: msg, previousAiMessage: aiMessage }
          setFormData({
            form: data.form,
            prefillData: data.prefill_data ?? data.prefill ?? {},
            message: aiMessage,
          })
          setState('form')
          return
        }

        const aiMessage = data.response ?? ''
        historyHintRef.current = { previousUserMessage: msg, previousAiMessage: aiMessage }
        setAnswerText(aiMessage)
        setState('answer')
      } catch {
        setAnswerText('Eroare de rețea. Verifică conexiunea și încearcă din nou.')
        setState('answer')
      }
    },
    [inputText, pathname]
  )

  const handleNavigateToForm = useCallback((prefillOverride?: Record<string, unknown>) => {
    if (!formData) return
    const url = buildFormUrl(formData.form, prefillOverride ?? formData.prefillData)
    if (url) {
      onClose()
      router.push(url)
    }
  }, [formData, onClose, router])

  const resolveParcelaIdFromPrefill = useCallback(async (prefillData: Record<string, unknown>) => {
    const directParcelaId = String(prefillData.parcela_id ?? '').trim()
    if (directParcelaId) return directParcelaId

    const parcelaHint = String(prefillData.parcela_label ?? prefillData.parcela ?? '').trim()
    if (!parcelaHint) return null

    const normalizedHint = normalizeEntityLabel(parcelaHint)
    if (!normalizedHint) return null

    const parcele = await getParcele()
    const exactMatches = parcele.filter((parcela) => {
      const candidates = [normalizeEntityLabel(parcela.id), ...getParcelaLabelCandidates(parcela)]
      return candidates.some((candidate) => candidate === normalizedHint)
    })
    if (exactMatches.length === 1) return exactMatches[0].id

    const containsMatches = parcele.filter((parcela) => {
      const candidates = getParcelaLabelCandidates(parcela)
      return candidates.some((candidate) => candidate.includes(normalizedHint) || normalizedHint.includes(candidate))
    })

    return containsMatches.length === 1 ? containsMatches[0].id : null
  }, [])

  const resolveClientFromPrefill = useCallback(async (prefillData: Record<string, unknown>) => {
    const directClientId = String(prefillData.client_id ?? '').trim()
    const hintedClientName = String(prefillData.client_label ?? prefillData.nume_client ?? '').trim()
    const normalizedHint = normalizeEntityLabel(hintedClientName)
    const fallbackPhone = String(prefillData.telefon ?? '').trim() || null
    const fallbackPrice = toPositiveNumber(prefillData.pret_per_kg)

    if (!directClientId && !normalizedHint) {
      return {
        clientId: null,
        clientName: '',
        telefon: fallbackPhone,
        pretPerKg: fallbackPrice,
      }
    }

    const clienti = await getClienți()
    const matchedClient =
      clienti.find((client) => client.id === directClientId) ??
      clienti.find((client) => normalizeEntityLabel(client.nume_client) === normalizedHint) ??
      null

    return {
      clientId: matchedClient?.id ?? (directClientId || null),
      clientName: matchedClient?.nume_client ?? hintedClientName,
      telefon: matchedClient?.telefon?.trim() || fallbackPhone,
      pretPerKg: matchedClient?.pret_negociat_lei_kg ?? fallbackPrice,
    }
  }, [])

  const finalizeSuccessfulConfirm = useCallback(() => {
    historyHintRef.current = null
    onClose()
    setState('idle')
    setFormData(null)
  }, [onClose])

  const handleConfirm = useCallback(async () => {
    if (!formData) return
    setConfirming(true)
    try {
      const { form, prefillData } = formData
      const today = new Date().toISOString().split('T')[0]

      if (form === 'cheltuiala') {
        const suma = Number(prefillData.suma)
        if (!suma) { toast.error('Suma lipsă. Deschide formularul.'); handleNavigateToForm(); return }
        await createCheltuiala({
          data: prefillData.data ? String(prefillData.data) : today,
          suma_lei: suma,
          categorie: prefillData.categorie ? String(prefillData.categorie) : undefined,
          descriere: prefillData.descriere ? String(prefillData.descriere) : undefined,
        })
        queryClient.invalidateQueries({ queryKey: queryKeys.cheltuieli })
        hapticSuccess()
        toast.success('Cheltuiala a fost salvată!')

      } else if (form === 'investitie') {
        const suma = Number(prefillData.suma)
        if (!suma || !prefillData.categorie) { toast.error('Date incomplete. Deschide formularul.'); handleNavigateToForm(); return }
        await createInvestitie({
          data: prefillData.data ? String(prefillData.data) : today,
          suma_lei: suma,
          categorie: String(prefillData.categorie),
          descriere: prefillData.descriere ? String(prefillData.descriere) : undefined,
        })
        queryClient.invalidateQueries({ queryKey: queryKeys.investitii })
        hapticSuccess()
        toast.success('Investiția a fost salvată!')

      } else if (form === 'recoltare') {
        const cantitateKg = toPositiveNumber(prefillData.cantitate_kg)
        const parcelaId = await resolveParcelaIdFromPrefill(prefillData)
        const culegatorId = String(prefillData.culegator_id ?? '').trim()
        const prefillWithResolvedParcelaId = parcelaId
          ? { ...prefillData, parcela_id: parcelaId }
          : prefillData

        if (!cantitateKg || !culegatorId) {
          toast('Deschid formularul de recoltare pentru completare finală.')
          handleNavigateToForm(prefillWithResolvedParcelaId)
          return
        }

        if (!parcelaId) {
          toast('Deschid formularul de recoltare pentru alegerea parcelei.')
          handleNavigateToForm(prefillData)
          return
        }

        const result = await createRecoltare({
          data: prefillData.data ? String(prefillData.data) : today,
          parcela_id: parcelaId,
          culegator_id: culegatorId,
          kg_cal1: cantitateKg,
          kg_cal2: 0,
          observatii: prefillData.observatii ? String(prefillData.observatii) : undefined,
        })

        if (!result.success) {
          toast('Deschid formularul de recoltare pentru verificare finală.')
          handleNavigateToForm(prefillWithResolvedParcelaId)
          return
        }

        queryClient.invalidateQueries({ queryKey: queryKeys.recoltari })
        queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal })
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
        queryClient.invalidateQueries({ queryKey: queryKeys.stocuriLocatiiRoot })
        queryClient.invalidateQueries({ queryKey: queryKeys.miscariStoc })
        queryClient.invalidateQueries({ queryKey: queryKeys.cheltuieli })
        hapticSuccess()
        if (result.warning) {
          toast.warning(result.warning)
        } else {
          toast.success('Recoltarea a fost salvată!')
        }

      } else if (form === 'comanda') {
        const cantitateKg = toPositiveNumber(prefillData.cantitate_kg)
        const dataLivrare = String(prefillData.data_livrare ?? '').trim() || today
        const resolvedClient = await resolveClientFromPrefill(prefillData)
        const clientName = resolvedClient.clientName.trim()
        const pretPerKg = toPositiveNumber(resolvedClient.pretPerKg)

        if (!clientName || !cantitateKg || !dataLivrare || !pretPerKg) {
          toast('Deschid formularul de comandă pentru completare finală.')
          handleNavigateToForm()
          return
        }

        await createComanda({
          client_id: resolvedClient.clientId,
          client_nume_manual: resolvedClient.clientId ? null : clientName,
          telefon: resolvedClient.telefon,
          locatie_livrare: prefillData.locatie_livrare ? String(prefillData.locatie_livrare) : null,
          data_comanda: today,
          data_livrare: dataLivrare,
          cantitate_kg: cantitateKg,
          pret_per_kg: pretPerKg,
          status: 'confirmata',
          observatii: prefillData.observatii ? String(prefillData.observatii) : null,
        })
        queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
        queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
        hapticSuccess()
        toast.success('Comanda a fost salvată!')

      } else {
        // activitate / client remain UI-first; unknown forms also fall back to the page dialog
        handleNavigateToForm()
        return
      }

      finalizeSuccessfulConfirm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Eroare la salvare.'
      if (formData.form === 'investitie' || formData.form === 'recoltare' || formData.form === 'comanda') {
        toast.error(`${message} Deschid formularul pentru verificare.`)
        handleNavigateToForm()
      } else {
        toast.error(message)
      }
    } finally {
      setConfirming(false)
    }
  }, [
    finalizeSuccessfulConfirm,
    formData,
    handleNavigateToForm,
    queryClient,
    resolveClientFromPrefill,
    resolveParcelaIdFromPrefill,
  ])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const suggestions = getSuggestions(pathname)
  const isPanel = variant === 'panel'

  if (!open && !isPanel) return null

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: isPanel ? 50 : 80,
          background: isPanel ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.45)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 300ms ease-in-out',
        }}
      />

      {/* Sheet / Panel */}
      <div
        style={{
          position: 'fixed',
          zIndex: isPanel ? 51 : 81,
          background: 'var(--ai-sheet-bg)',
          borderTop: isPanel ? 'none' : '1px solid var(--ai-sheet-border)',
          borderLeft: isPanel ? '1px solid var(--ai-sheet-border)' : 'none',
          borderRadius: isPanel ? '0' : '18px 18px 0 0',
          boxShadow: isPanel ? '-4px 0 32px rgba(0,0,0,0.18)' : '0 -4px 32px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          width: isPanel ? '380px' : '100%',
          maxWidth: isPanel ? 'calc(100vw - 16px)' : '100%',
          height: isPanel ? '100vh' : 'auto',
          maxHeight: isPanel ? '100vh' : '85vh',
          top: isPanel ? 0 : 'auto',
          bottom: 0,
          right: 0,
          left: isPanel ? 'auto' : 0,
          transform: isPanel ? (open ? 'translateX(0)' : 'translateX(100%)') : 'translateY(0)',
          opacity: isPanel ? (open ? 1 : 0) : 1,
          pointerEvents: isPanel ? (open ? 'auto' : 'none') : 'auto',
          transition: 'transform 300ms ease-in-out, opacity 300ms ease-in-out',
        }}
      >
        {!isPanel ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--ai-sheet-border)' }} />
          </div>
        ) : null}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🤖</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--agri-text)' }}>Zmeurel AI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: counterTextColor }}>
              {counterLabel}
            </span>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'var(--ai-sheet-muted)', border: 'none', borderRadius: 20,
                width: 30, height: 30, cursor: 'pointer', fontSize: 14, color: 'var(--ai-sheet-subtle-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--ai-sheet-border)', margin: '0 16px' }} />

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', minHeight: 120 }}>

          {/* Idle: suggestions */}
          {state === 'idle' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--ai-sheet-subtle-text)', marginBottom: 10 }}>Sugestii rapide:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setInputText(s); setTimeout(() => sendMessage(s), 50) }}
                    style={{
                      padding: '6px 12px', borderRadius: 20, fontSize: 13,
                      background: 'var(--ai-sheet-soft)', border: '1px solid var(--ai-sheet-accent-border)',
                      color: 'var(--ai-sheet-accent-text)', cursor: 'pointer', fontWeight: 500,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Listening: wave animation */}
          {state === 'listening' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 12 }}>
                {[0.1, 0.2, 0.3, 0.2, 0.1].map((delay, i) => (
                  <div
                    key={i}
                    style={{
                      width: 4, height: 28, borderRadius: 2,
                      background: 'var(--agri-primary)',
                      animation: `wave 0.8s ease-in-out ${delay}s infinite`,
                    }}
                  />
                ))}
              </div>
              <p style={{ fontSize: 14, color: 'var(--agri-primary)', fontWeight: 600 }}>Ascult...</p>
              <button
                type="button"
                onClick={stopListening}
                style={{
                  marginTop: 12, padding: '6px 16px', borderRadius: 20,
                  background: 'var(--soft-danger-bg)', border: '1px solid var(--soft-danger-border)',
                  color: 'var(--soft-danger-text)', fontSize: 13, cursor: 'pointer',
                }}
              >
                Oprește
              </button>
            </div>
          )}

          {/* Processing: dot bounce */}
          {state === 'processing' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
                {[0, 0.15, 0.3].map((delay, i) => (
                  <div
                    key={i}
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--agri-primary)',
                      animation: `dotBounce 0.8s ease-in-out ${delay}s infinite`,
                    }}
                  />
                ))}
              </div>
              <p style={{ fontSize: 13, color: 'var(--ai-sheet-subtle-text)' }}>Se procesează...</p>
            </div>
          )}

          {/* Answer */}
          {state === 'answer' && (
            <div>
              <div style={{
                background: 'var(--ai-sheet-muted)', borderRadius: 12, padding: '12px 14px',
                fontSize: 14, color: 'var(--agri-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}>
                {renderInternalMarkdownLinks(answerText)}
              </div>
              <button
                type="button"
                onClick={() => { setState('idle'); setAnswerText('') }}
                style={{
                  marginTop: 12, padding: '7px 16px', borderRadius: 20,
                  background: 'var(--ai-sheet-soft)', border: '1px solid var(--ai-sheet-accent-border)',
                  color: 'var(--ai-sheet-accent-text)', fontSize: 13, cursor: 'pointer', fontWeight: 500,
                }}
              >
                ← Altă întrebare
              </button>
            </div>
          )}

          {/* Form prefill card */}
          {state === 'form' && formData && (
            <div>
              {/* Green prefill card */}
              <div style={{
                background: 'linear-gradient(135deg, var(--ai-sheet-soft), var(--agri-surface-muted))',
                borderRadius: 16, padding: 16, marginBottom: 12,
                border: '1.5px solid var(--ai-sheet-accent-border)',
              }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ai-sheet-accent-text)', marginBottom: 10 }}>
                  {formLabel(formData.form)}
                </p>
                <p style={{ fontSize: 13, color: 'var(--ai-sheet-subtle-text)', marginBottom: 12 }}>{formData.message}</p>
                {/* Parsed fields */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {getDisplayPrefillEntries(formData.form, formData.prefillData).map(([k, v]) =>
                    v != null && v !== '' ? (
                      <div
                        key={k}
                        style={{
                          background: 'var(--agri-surface)', borderRadius: 8, padding: '6px 10px', fontSize: 11,
                          border: '1px solid var(--ai-sheet-accent-border)',
                        }}
                      >
                        <span style={{ color: 'var(--ai-sheet-subtle-text)' }}>{fieldLabel(k)}: </span>
                        <span style={{ fontWeight: 700, color: 'var(--agri-text)' }}>{String(v)}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={confirming}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                    background: confirming ? 'rgba(74, 222, 128, 0.45)' : 'var(--agri-primary)',
                    border: 'none', color: 'var(--accent-green-contrast)', cursor: confirming ? 'wait' : 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {confirming ? '...' : '✓ Confirmă'}
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigateToForm()}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 12, fontSize: 14, fontWeight: 600,
                    background: 'var(--ai-sheet-muted)', border: '1px solid var(--ai-sheet-border)',
                    color: 'var(--agri-text)', cursor: 'pointer',
                  }}
                >
                  ✏️ Editează
                </button>
                <button
                  type="button"
                  onClick={() => { setState('idle'); setFormData(null) }}
                  style={{
                    padding: '10px 14px', borderRadius: 12, fontSize: 14,
                    background: 'var(--ai-sheet-muted)', border: '1px solid var(--ai-sheet-border)',
                    color: 'var(--ai-sheet-subtle-text)', cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Limit */}
          {state === 'limit' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>😴</div>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--agri-text)', marginBottom: 6 }}>
                Limită atinsă
              </p>
              <p style={{ fontSize: 13, color: 'var(--ai-sheet-subtle-text)' }}>{answerText}</p>
            </div>
          )}
        </div>

        {/* Input row — visible in idle/answer states */}
        {(state === 'idle' || state === 'answer') && (
          <div style={{
            padding: '10px 16px',
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
            borderTop: '1px solid var(--ai-sheet-border)',
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <input
              ref={inputRef}
              type="search"
              name="ai-chat-input"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-form-type="other"
              inputMode="text"
              aria-autocomplete="none"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Întreabă sau dictează..."
              maxLength={500}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 24,
                border: '1.5px solid var(--ai-sheet-border)', fontSize: 14,
                background: 'var(--ai-sheet-muted)', outline: 'none', color: 'var(--agri-text)',
              }}
            />

            {speechSupported && (
              <button
                type="button"
                onClick={startListening}
                style={{
                  width: 42, height: 42, borderRadius: '50%', border: 'none',
                  background: 'var(--ai-sheet-soft)', cursor: 'pointer', fontSize: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
                aria-label="Dictează"
              >
                🎙️
              </button>
            )}

            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={!inputText.trim()}
                style={{
                  width: 42, height: 42, borderRadius: '50%', border: 'none',
                  background: inputText.trim() ? 'var(--agri-primary)' : 'var(--ai-sheet-border)',
                  cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                  fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: 'var(--accent-green-contrast)',
                  transition: 'background 0.2s',
                }}
              aria-label="Trimite"
            >
              ↑
            </button>
          </div>
        )}
      </div>
    </>
  )
}
