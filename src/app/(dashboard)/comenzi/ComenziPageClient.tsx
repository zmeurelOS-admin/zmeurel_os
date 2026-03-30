
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ClipboardList, Loader2, Pencil, Trash2, UserRoundPlus } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import { AppDialog } from '@/components/app/AppDialog'
import { AppShell } from '@/components/app/AppShell'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { ErrorState } from '@/components/app/ErrorState'
import { ListSkeletonCard } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { useMobileScrollRestore } from '@/components/app/useMobileScrollRestore'
import { AddClientDialog } from '@/components/clienti/AddClientDialog'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MobileEntityCard } from '@/components/ui/MobileEntityCard'
import { ResponsiveDataView } from '@/components/ui/ResponsiveDataView'
import { SearchField } from '@/components/ui/SearchField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import StatusBadge from '@/components/ui/StatusBadge'
import { Textarea } from '@/components/ui/textarea'
import { ViewComandaDialog } from '@/components/comenzi/ViewComandaDialog'
import { useAddAction } from '@/contexts/AddActionContext'
import { track } from '@/lib/analytics/track'
import { spacing } from '@/lib/design-tokens'
import { createClienți, getClienți, type Client, type ClientDuplicateWarning } from '@/lib/supabase/queries/clienti'
import {
  COMENZI_STATUSES,
  createComanda,
  deleteComanda,
  deliverComanda,
  getComenzi,
  reopenComanda,
  type Comanda,
  type ComandaPlata,
  type ComandaStatus,
  updateComanda,
} from '@/lib/supabase/queries/comenzi'
import { getStocGlobal } from '@/lib/supabase/queries/miscari-stoc'
import { getVanzari } from '@/lib/supabase/queries/vanzari'
import { downloadVCard } from '@/lib/utils/downloadVCard'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { queryKeys } from '@/lib/query-keys'

type DashboardFilter = 'none' | 'azi' | 'active' | 'restante' | 'viitoare' | 'neincasat'
type TabKey = 'de_livrat' | 'livrate' | 'toate'

type ContactPrompt = {
  name: string
  phone: string
}

type CreateClientMutationVariables = {
  input: Parameters<typeof createClienți>[0]
  onDuplicateWarning?: (existing: ClientDuplicateWarning) => void
}

const statusLabelMap: Record<ComandaStatus, string> = {
  noua: 'Nouă',
  confirmata: 'Confirmată',
  programata: 'Programată',
  in_livrare: 'În livrare',
  livrata: 'Livrată',
  anulata: 'Anulată',
}

const statusVariantMap: Record<ComandaStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'> = {
  noua: 'info',
  confirmata: 'warning',
  programata: 'purple',
  in_livrare: 'warning',
  livrata: 'success',
  anulata: 'danger',
}

interface ComandaFormState {
  client_id: string
  client_nume_manual: string
  telefon: string
  locatie_livrare: string
  data_comanda: string
  data_livrare: string
  cantitate_kg: string
  pret_per_kg: string
  status: ComandaStatus
  observatii: string
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('ro-RO')
}

function formatKg(value: number): string {
  return `${Number(value || 0).toFixed(2)} kg`
}

function formatLei(value: number): string {
  return `${Number(value || 0).toFixed(2)} lei`
}

function formatLeiCompact(value: number): string {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 }).format(Math.round(Number(value || 0)))
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizeForExactHintMatch(value: string): string {
  return value.trim().toLowerCase()
}

function canDeliverStatus(status: string): boolean {
  const normalized = normalize(status)
  return ['noua', 'confirmata', 'programata', 'in_livrare'].includes(normalized)
}

function isOpenStatus(status: ComandaStatus): boolean {
  return status !== 'livrata' && status !== 'anulata'
}

function defaultFormState(status: ComandaStatus = 'noua'): ComandaFormState {
  return {
    client_id: '',
    client_nume_manual: '',
    telefon: '',
    locatie_livrare: '',
    data_comanda: todayIso(),
    data_livrare: todayIso(),
    cantitate_kg: '',
    pret_per_kg: '',
    status,
    observatii: '',
  }
}

export function hasAiComandaOpenForm(searchParams: Pick<URLSearchParams, 'get'>): boolean {
  return searchParams.get('openForm') === '1'
}

export function parseAiComandaPrefill(searchParams: Pick<URLSearchParams, 'get'>): Partial<ComandaFormState> | null {
  if (!hasAiComandaOpenForm(searchParams)) return null

  const clientId = searchParams.get('client_id')?.trim() ?? ''
  const numeClient = (searchParams.get('client_label') ?? searchParams.get('nume_client') ?? '').trim()
  const telefon = searchParams.get('telefon')?.trim() ?? ''
  const locatieLivrare = searchParams.get('locatie_livrare')?.trim() ?? ''
  const dataLivrare = searchParams.get('data_livrare')?.trim() ?? ''
  const cantitateKg = searchParams.get('cantitate_kg')?.trim() ?? ''
  const pretPerKg = searchParams.get('pret_per_kg')?.trim() ?? ''
  const observatii = searchParams.get('observatii')?.trim() ?? ''

  return {
    client_id: clientId,
    client_nume_manual: numeClient,
    telefon,
    locatie_livrare: locatieLivrare,
    data_livrare: dataLivrare || todayIso(),
    cantitate_kg: cantitateKg,
    pret_per_kg: pretPerKg,
    observatii,
    status: 'confirmata',
  }
}

function resolveClientIdFromHint(hint: string, clienti: Client[]): string | null {
  const normalizedHint = normalizeForExactHintMatch(hint)
  if (!normalizedHint) return null

  const exact = clienti.filter((client) => normalizeForExactHintMatch(client.nume_client ?? '') === normalizedHint)
  if (exact.length === 1) return exact[0].id
  return null
}

function getClientName(comanda: Comanda, clientMap: Record<string, Client>): string {
  if (comanda.client_id && clientMap[comanda.client_id]) {
    return clientMap[comanda.client_id].nume_client
  }
  return comanda.client_nume || comanda.client_nume_manual || 'Client manual'
}

function mapInitialFilterFromQuery(filter: string | null): DashboardFilter {
  if (filter === 'azi' || filter === 'viitoare' || filter === 'restante') return filter
  if (filter === 'active') return 'active'
  return 'none'
}

function mapInitialTabFromQuery(filter: string | null): TabKey {
  if (filter === 'livrate') return 'livrate'
  if (filter === 'toate') return 'toate'
  return 'de_livrat'
}

function saveContactAsVCard(name: string, phone: string) {
  const trimmedName = name.trim()
  const trimmedPhone = phone.trim()
  if (!trimmedName || !trimmedPhone) return
  downloadVCard(trimmedName, trimmedPhone)
}

function toPhoneDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\s+/g, '').replace(/[^\d]/g, '')
}

function toWhatsAppUrl(phone: string | null | undefined): string {
  const digits = toPhoneDigits(phone)
  if (!digits) return ''
  if (digits.startsWith('40')) return `https://wa.me/${digits}`
  if (digits.startsWith('0')) return `https://wa.me/40${digits.slice(1)}`
  return `https://wa.me/4${digits}`
}

function isPaidStatus(status: string | null | undefined): boolean {
  const value = normalize(String(status ?? ''))
  return value.includes('platit') || value.includes('incasat')
}

function getComandaIcon(isDelivered: boolean, isUrgent: boolean, isFuture: boolean): string {
  if (isDelivered) return '✅'
  if (isUrgent) return '🚚'
  if (isFuture) return '🗓️'
  return '📦'
}

function statusToneForMobileCard(status: ComandaStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'anulata') return 'danger'
  if (status === 'livrata') return 'neutral'
  if (status === 'programata' || status === 'in_livrare') return 'success'
  return 'warning'
}

function PillTabs({
  value,
  onChange,
  activeCount,
  livrateCount,
}: {
  value: TabKey
  onChange: (value: TabKey) => void
  activeCount: number
  livrateCount: number
}) {
  const tabs = [
    { key: 'de_livrat' as const, label: `Active${activeCount > 0 ? ` (${activeCount})` : ''}` },
    { key: 'livrate' as const, label: `Livrate${livrateCount > 0 ? ` (${livrateCount})` : ''}` },
    { key: 'toate' as const, label: 'Toate' },
  ]
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {tabs.map((tab) => {
        const isActive = value === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 20,
              border: `1px solid ${isActive ? 'var(--pill-active-border)' : 'var(--pill-inactive-border)'}`,
              background: isActive ? 'var(--pill-active-bg)' : 'var(--pill-inactive-bg)',
              color: isActive ? 'var(--pill-active-text)' : 'var(--pill-inactive-text)',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

function ComandaCard({
  comanda,
  clientName,
  onOpenDetails,
}: {
  comanda: Comanda
  clientName: string
  onOpenDetails: (comanda: Comanda) => void
}) {
  const cantitateKg = Number(comanda.cantitate_kg || 0)
  const total = Number(comanda.total || cantitateKg * Number(comanda.pret_per_kg || 0))
  const produsDetails = (comanda.observatii ?? '').trim()
  const subtitle = [formatKg(cantitateKg), produsDetails || null].filter(Boolean).join(' · ') || formatKg(cantitateKg)

  return (
    <MobileEntityCard
      title={clientName}
      value={`${formatLeiCompact(total)} lei`}
      secondary={subtitle}
      status={
        <StatusBadge
          text={statusLabelMap[comanda.status] ?? comanda.status}
          variant={statusVariantMap[comanda.status] ?? 'neutral'}
        />
      }
      onClick={() => onOpenDetails(comanda)}
    />
  )
}

function ComandaDialog({
  open,
  onOpenChange,
  onSave,
  saving,
  clienti,
  mode,
  initial,
  initialCreateValues,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (values: ComandaFormState) => Promise<void>
  saving: boolean
  clienti: Client[]
  mode: 'create' | 'edit'
  initial?: Comanda | null
  initialCreateValues?: Partial<ComandaFormState> | null
}) {
  const initialFormState = useMemo<ComandaFormState>(() => {
    if (!initial) {
      return {
        ...defaultFormState('confirmata'),
        ...(initialCreateValues ?? {}),
      }
    }
    return {
      client_id: initial.client_id ?? '',
      client_nume_manual: initial.client_nume_manual ?? '',
      telefon: initial.telefon ?? '',
      locatie_livrare: initial.locatie_livrare ?? '',
      data_comanda: initial.data_comanda ?? todayIso(),
      data_livrare: initial.data_livrare ?? todayIso(),
      cantitate_kg: String(initial.cantitate_kg ?? ''),
      pret_per_kg: String(initial.pret_per_kg ?? ''),
      status: initial.status,
      observatii: initial.observatii ?? '',
    }
  }, [initial, initialCreateValues])
  const [form, setForm] = useState<ComandaFormState>(initialFormState)
  const [comboInput, setComboInput] = useState('')
  const [comboOpen, setComboOpen] = useState(false)
  const comboRef = useRef<HTMLDivElement>(null)

  const selectedClient = clienti.find((client) => client.id === form.client_id)
  const suggestedClientName = form.client_nume_manual.trim() || selectedClient?.nume_client || 'Client'
  const canSaveContact = suggestedClientName.trim().length > 0 && form.telefon.trim().length > 0

  useEffect(() => {
    if (!open) {
      setComboInput('')
      setComboOpen(false)
      setForm(initialFormState)
    } else {
      let prefillClientId = initialFormState.client_id
      if (!prefillClientId && mode === 'create' && initialFormState.client_nume_manual) {
        prefillClientId = resolveClientIdFromHint(initialFormState.client_nume_manual, clienti) ?? ''
      }
      if (prefillClientId) {
        const client = clienti.find((c) => c.id === prefillClientId)
        setComboInput(client?.nume_client ?? '')
        setForm((prev) => ({
          ...prev,
          client_id: prefillClientId,
          client_nume_manual: '',
          telefon: client?.telefon || prev.telefon,
          locatie_livrare: client?.adresa || prev.locatie_livrare,
        }))
      } else {
        setComboInput(initialFormState.client_nume_manual ?? '')
        setForm(initialFormState)
      }
    }
  }, [open, initialFormState, clienti, mode])

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(event.target as Node)) {
        setComboOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const comboFiltered = useMemo(() => {
    const term = normalize(comboInput)
    if (!term || term.length < 2) return clienti.slice(0, 30)
    return clienti.filter((c) =>
      normalize(c.nume_client ?? '').includes(term) ||
      normalize(c.telefon ?? '').includes(term)
    )
  }, [comboInput, clienti])

  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? 'Adaugă comanda' : 'Editează comanda'}
      footer={
        <div className="flex justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="agri-cta h-12 min-w-[132px] rounded-xl text-sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Anulează
          </Button>
          <Button
            type="button"
            className="agri-cta h-12 min-w-[132px] rounded-xl bg-[var(--agri-primary)] text-sm text-white hover:bg-emerald-700 dark:bg-green-700 dark:text-white dark:hover:bg-green-600"
            disabled={saving}
            onClick={async () => {
              await onSave(form)
            }}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Se salvează...
              </>
            ) : (
              'Salvează'
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Single client combobox — replaces the old search + select + manual-name triple */}
        <div className="space-y-1.5" ref={comboRef}>
          <Label htmlFor="comanda_client_combo">Client</Label>
          <div className="relative">
            <Input
              id="comanda_client_combo"
              className="agri-control h-12"
              placeholder="Caută după nume sau telefon..."
              autoComplete="off"
              value={comboInput}
              onFocus={() => setComboOpen(true)}
              onChange={(e) => {
                const val = e.target.value
                setComboInput(val)
                setComboOpen(true)
                setForm((prev) => ({ ...prev, client_id: '', client_nume_manual: val }))
              }}
            />
            {comboOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)] shadow-lg">
                {comboFiltered.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-[var(--agri-text-muted)]">Niciun client găsit — completează manual</p>
                ) : (
                  comboFiltered.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-sm hover:bg-[var(--soft-success-bg)]"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setComboInput(client.nume_client)
                        setComboOpen(false)
                        setForm((prev) => ({
                          ...prev,
                          client_id: client.id,
                          client_nume_manual: '',
                          telefon: client.telefon || prev.telefon,
                          locatie_livrare: client.adresa || prev.locatie_livrare,
                        }))
                      }}
                    >
                      <span className="font-medium text-[var(--agri-text)]">{client.nume_client}</span>
                      {client.telefon ? <span className="text-[var(--agri-text-muted)]">— {client.telefon}</span> : null}
                    </button>
                  ))
                )}
                <button
                  type="button"
                  className="flex w-full items-center gap-1.5 border-t border-[var(--agri-border)] px-3 py-2.5 text-left text-sm font-medium text-[var(--soft-success-text)] hover:bg-[var(--soft-success-bg)]"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setComboOpen(false)
                    setForm((prev) => ({ ...prev, client_id: '', client_nume_manual: comboInput }))
                  }}
                >
                  ➕ Client nou — completează manual
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Telefon</Label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input className="agri-control h-12" value={form.telefon} onChange={(e) => setForm((prev) => ({ ...prev, telefon: e.target.value }))} />
            <Button
              type="button"
              variant="outline"
              className="h-12 whitespace-nowrap rounded-xl px-3 text-xs sm:text-sm"
              disabled={!canSaveContact}
              onClick={() => saveContactAsVCard(suggestedClientName, form.telefon)}
            >
              <UserRoundPlus className="h-4 w-4" />
              Salvează contact
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Locație livrare</Label>
          <Input className="agri-control h-12" value={form.locatie_livrare} onChange={(e) => setForm((prev) => ({ ...prev, locatie_livrare: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Data comandă</Label>
            <Input type="date" className="agri-control h-12" value={form.data_comanda} onChange={(e) => setForm((prev) => ({ ...prev, data_comanda: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Data livrare</Label>
            <Input type="date" className="agri-control h-12" value={form.data_livrare} onChange={(e) => setForm((prev) => ({ ...prev, data_livrare: e.target.value }))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Cantitate (kg)</Label>
            <Input type="number" min="0" step="0.01" className="agri-control h-12" value={form.cantitate_kg} onChange={(e) => setForm((prev) => ({ ...prev, cantitate_kg: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Preț per kg</Label>
            <Input type="number" min="0" step="0.01" className="agri-control h-12" value={form.pret_per_kg} onChange={(e) => setForm((prev) => ({ ...prev, pret_per_kg: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as ComandaStatus }))}>
            <SelectTrigger className="agri-control h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMENZI_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabelMap[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Observații</Label>
          <Textarea className="agri-control" value={form.observatii} onChange={(e) => setForm((prev) => ({ ...prev, observatii: e.target.value }))} />
        </div>
      </div>
    </AppDialog>
  )
}

function ContactSavePromptDialog({
  open,
  contact,
  onCopy,
  onAddClient,
  onDismiss,
}: {
  open: boolean
  contact: ContactPrompt | null
  onCopy: () => void
  onAddClient: () => void
  onDismiss: () => void
}) {
  return (
    <AppDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onDismiss()
      }}
      title="Salvezi numărul?"
      description={contact ? `${contact.name} — ${contact.phone}` : undefined}
      footer={
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: spacing.sm, width: '100%' }}>
          <Button type="button" className="h-12" onClick={onCopy}>
            Salvează contact
          </Button>
          <Button type="button" variant="outline" className="h-12" onClick={onAddClient}>
            + Adaugă ca client
          </Button>
          <Button type="button" variant="ghost" className="h-11" onClick={onDismiss}>
            Nu acum
          </Button>
        </div>
      }
    >
      <div />
    </AppDialog>
  )
}

export function ComenziPageClient() {
  const queryClient = useQueryClient()
  const { registerAddAction } = useAddAction()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pendingDeletedItems = useRef<Record<string, { item: Comanda; index: number }>>({})

  const [search, setSearch] = useState('')
  const initialFilter = useMemo<DashboardFilter>(() => {
    if (typeof window === 'undefined') return 'none'
    const filterParam = new URLSearchParams(window.location.search).get('filter')
    return mapInitialFilterFromQuery(filterParam)
  }, [])
  const initialTab = useMemo<TabKey>(() => {
    if (typeof window === 'undefined') return 'de_livrat'
    const filterParam = new URLSearchParams(window.location.search).get('filter')
    return mapInitialTabFromQuery(filterParam)
  }, [])

  const [activeFilter, setActiveFilter] = useState<DashboardFilter>(initialFilter)
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [deliveringId, setDeliveringId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [createPrefill, setCreatePrefill] = useState<Partial<ComandaFormState> | null>(null)
  const [editing, setEditing] = useState<Comanda | null>(null)
  const [deleting, setDeleting] = useState<Comanda | null>(null)
  const [reopening, setReopening] = useState<Comanda | null>(null)
  const [viewing, setViewing] = useState<Comanda | null>(null)
  const [desktopSelectedComandaId, setDesktopSelectedComandaId] = useState<string | null>(null)
  const [contactPrompt, setContactPrompt] = useState<ContactPrompt | null>(null)
  const [clientPrefill, setClientPrefill] = useState<ContactPrompt | null>(null)
  const [addClientOpen, setAddClientOpen] = useState(false)
  const addFromQuery = searchParams.get('add') === '1'
  const openFormFromQuery = hasAiComandaOpenForm(searchParams)

  const clearComandaFormQueryParams = () => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('add')
    nextParams.delete('openForm')
    nextParams.delete('edit')
    nextParams.delete('nume_client')
    nextParams.delete('client_id')
    nextParams.delete('client_label')
    nextParams.delete('telefon')
    nextParams.delete('cantitate_kg')
    nextParams.delete('pret_per_kg')
    nextParams.delete('data_livrare')
    nextParams.delete('produs')
    nextParams.delete('observatii')
    nextParams.delete('locatie_livrare')
    nextParams.delete('sursa')
    const query = nextParams.toString()
    const nextUrl = query ? `${pathname}?${query}` : pathname

    if (typeof window !== 'undefined') {
      const currentUrl = `${window.location.pathname}${window.location.search}`
      if (currentUrl !== nextUrl) {
        window.history.replaceState(window.history.state, '', nextUrl)
      }
    }

    router.replace(nextUrl, { scroll: false })
  }

  const {
    data: comenzi = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.comenzi,
    queryFn: getComenzi,
  })

  useMobileScrollRestore({
    storageKey: 'scroll:comenzi',
    ready: !isLoading,
  })

  const { data: clienti = [] } = useQuery({
    queryKey: queryKeys.clienti,
    queryFn: getClienți,
  })

  const { data: vanzari = [] } = useQuery({
    queryKey: queryKeys.vanzari,
    queryFn: getVanzari,
  })

  const { data: stocGlobal = { cal1: 0, cal2: 0 } } = useQuery({
    queryKey: queryKeys.stocGlobal,
    queryFn: getStocGlobal,
  })

  const clientMap = useMemo(() => {
    const map: Record<string, Client> = {}
    clienti.forEach((client) => {
      map[client.id] = client
    })
    return map
  }, [clienti])

  const createMutation = useMutation({
    mutationFn: createComanda,
    onSuccess: (_, variables) => {
      clearComandaFormQueryParams()
      queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      track('comanda_add', {
        cantitate: Number(variables.cantitate_kg || 0),
        client_id: variables.client_id ?? null,
      })
      hapticSuccess()
      const matchedClientName = variables.client_id ? clientMap[variables.client_id]?.nume_client ?? '' : ''
      const clientName = (variables.client_nume_manual || matchedClientName || '').trim()
      const phone = (variables.telefon ?? '').trim()
      const canSaveContactFromToast = clientName.length > 0 && phone.length > 0

      toast('Comanda a fost salvată', {
        action: canSaveContactFromToast
          ? {
              label: 'Salvează clientul în telefon',
              onClick: () => saveContactAsVCard(clientName, phone),
            }
          : undefined,
      })
      setAddOpen(false)
      setCreatePrefill(null)
    },
    onError: (err: Error) => {
      hapticError()
      toast.error(err.message)
    },
  })

  const restorePendingDeleteItem = (comandaId: string) => {
    const pendingItem = pendingDeletedItems.current[comandaId]
    if (!pendingItem) return

    delete pendingDeletedItems.current[comandaId]
    queryClient.setQueryData<Comanda[]>(queryKeys.comenzi, (current = []) => {
      if (current.some((item) => item.id === comandaId)) return current

      const next = [...current]
      const insertAt = pendingItem.index >= 0 ? Math.min(pendingItem.index, next.length) : next.length
      next.splice(insertAt, 0, pendingItem.item)
      return next
    })
  }

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateComanda>[1] }) => updateComanda(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      track('comanda_edit', { id: variables.id })
      hapticSuccess()
      toast.success('Comanda actualizată')
      setEditing(null)
    },
    onError: (err: Error) => {
      hapticError()
      toast.error(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteComanda,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzari })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobalCal1 })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocuriLocatiiRoot })
      queryClient.invalidateQueries({ queryKey: queryKeys.miscariStoc })
      delete pendingDeletedItems.current[deletedId]
      track('comanda_delete', { id: deletedId })
      hapticSuccess()
      toast.success('Comandă ștearsă')
      setDeleting(null)
    },
    onError: (err: Error, deletedId) => {
      restorePendingDeleteItem(deletedId)
      hapticError()
      toast.error(err.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
    },
  })

  const createClientMutation = useMutation({
    mutationFn: ({ input, onDuplicateWarning }: CreateClientMutationVariables) =>
      createClienți(input, { onDuplicateWarning }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
      hapticSuccess()
      toast.success('Client salvat')
      setAddClientOpen(false)
      setClientPrefill(null)
      setContactPrompt(null)
    },
    onError: (err: Error) => {
      hapticError()
      toast.error(err.message)
    },
  })

  const deliverMutation = useMutation({
    mutationFn: ({ comandaId, cantitateLivrataKg, plata, dataLivrareRamasa }: { comandaId: string; cantitateLivrataKg: number; plata: ComandaPlata; dataLivrareRamasa: string | null }) =>
      deliverComanda({ comandaId, cantitateLivrataKg, plata, dataLivrareRamasa }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzari })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobalCal1 })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocuriLocatiiRoot })
      queryClient.invalidateQueries({ queryKey: queryKeys.miscariStoc })
      hapticSuccess()
      toast('Comandă livrată! Vânzare creată.')

      const delivered = result.deliveredOrder
      const deliveredName = getClientName(delivered, clientMap)
      const deliveredPhone = (delivered.telefon || '').trim()
      if (!delivered.client_id && deliveredPhone) {
        setContactPrompt({ name: deliveredName, phone: deliveredPhone })
      }

      setDeliveringAndConfirm(null)
      setActiveTab('livrate')
      setActiveFilter('none')
    },
    onError: (err: Error) => {
      hapticError()
      toast.error(err.message)
      setDeliveringId(null)
    },
  })

  const reopenMutation = useMutation({
    mutationFn: reopenComanda,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzari })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobalCal1 })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocuriLocatiiRoot })
      queryClient.invalidateQueries({ queryKey: queryKeys.miscariStoc })
      hapticSuccess()
      toast.success('Comandă redeschisă')
      setReopening(null)
    },
    onError: (err: Error) => {
      hapticError()
      toast.error(err.message)
      setReopening(null)
    },
  })

  function setDeliveringAndConfirm(delivering: string | null) {
    setDeliveringId(delivering)
  }

  useEffect(() => {
    if (!addFromQuery) return
    setCreatePrefill(null)
    setAddOpen(true)
    clearComandaFormQueryParams()
  }, [addFromQuery, pathname, router, searchParams])

  useEffect(() => {
    if (!openFormFromQuery) return
    setCreatePrefill(parseAiComandaPrefill(searchParams))
    clearComandaFormQueryParams()
    setAddOpen(true)
  }, [openFormFromQuery, pathname, router, searchParams])

  useEffect(() => {
    const unregister = registerAddAction(() => {
      setCreatePrefill(null)
      setAddOpen(true)
    }, 'Adaugă comandă')
    return unregister
  }, [registerAddAction])

  useEffect(() => {
    const query = search.trim()
    if (!query) return

    const timer = setTimeout(() => {
      track('search', { module: 'comenzi', query })
    }, 500)

    return () => clearTimeout(timer)
  }, [search])

  const scheduleDelete = (comanda: Comanda) => {
    const comandaId = comanda.id
    const currentItems = queryClient.getQueryData<Comanda[]>(queryKeys.comenzi) ?? []
    const deleteIndex = currentItems.findIndex((item) => item.id === comandaId)

    pendingDeletedItems.current[comandaId] = { item: comanda, index: deleteIndex }
    queryClient.setQueryData<Comanda[]>(queryKeys.comenzi, (current = []) =>
      current.filter((item) => item.id !== comandaId)
    )
    deleteMutation.mutate(comandaId)
  }

  const today = todayIso()
  const activeComenzi = useMemo(() => comenzi.filter((item) => isOpenStatus(item.status)), [comenzi])
  const livrateComenzi = useMemo(() => comenzi.filter((item) => item.status === 'livrata'), [comenzi])

  const vanzareById = useMemo(() => {
    const map = new Map<string, (typeof vanzari)[number]>()
    vanzari.forEach((item) => {
      map.set(item.id, item)
    })
    return map
  }, [vanzari])

  const vanzareByComandaId = useMemo(() => {
    const map = new Map<string, (typeof vanzari)[number]>()
    vanzari.forEach((item) => {
      if (item.comanda_id) map.set(item.comanda_id, item)
    })
    return map
  }, [vanzari])

  const livrateNeincasate = useMemo(() => {
    return livrateComenzi
      .map((comanda) => {
        const sale =
          (comanda.linked_vanzare_id ? vanzareById.get(comanda.linked_vanzare_id) : undefined) ??
          vanzareByComandaId.get(comanda.id)
        if (!sale) return null
        if (isPaidStatus(sale.status_plata)) return null
        return {
          comanda,
          amount: Number(sale.cantitate_kg || 0) * Number(sale.pret_lei_kg || 0),
        }
      })
      .filter((item): item is { comanda: Comanda; amount: number } => Boolean(item))
  }, [livrateComenzi, vanzareByComandaId, vanzareById])

  const neincasatComandaIds = useMemo(() => new Set(livrateNeincasate.map((item) => item.comanda.id)), [livrateNeincasate])
  const neincasatRon = useMemo(() => livrateNeincasate.reduce((sum, item) => sum + item.amount, 0), [livrateNeincasate])

  const comenziAzi = useMemo(
    () => activeComenzi.filter((item) => item.data_livrare === today),
    [activeComenzi, today]
  )
  const comenziViitoare = useMemo(
    () => activeComenzi.filter((item) => Boolean(item.data_livrare) && item.data_livrare! > today),
    [activeComenzi, today]
  )
  const comenziRestante = useMemo(
    () => activeComenzi.filter((item) => Boolean(item.data_livrare) && item.data_livrare! < today),
    [activeComenzi, today]
  )

  const kgAzi = comenziAzi.reduce((sum, item) => sum + Number(item.cantitate_kg || 0), 0)
  const kgViitoare = comenziViitoare.reduce((sum, item) => sum + Number(item.cantitate_kg || 0), 0)
  const totalActiveKg = activeComenzi.reduce((sum, item) => sum + Number(item.cantitate_kg || 0), 0)
  const totalActiveValue = activeComenzi.reduce((sum, item) => sum + Number(item.total || 0), 0)

  const totalStocDisponibilKg = Number(stocGlobal.cal1 || 0) + Number(stocGlobal.cal2 || 0)
  const showStockWarning = totalStocDisponibilKg < totalActiveKg

  const listSource = useMemo(() => {
    if (activeTab === 'de_livrat') return activeComenzi
    if (activeTab === 'livrate') return livrateComenzi
    return comenzi
  }, [activeComenzi, activeTab, comenzi, livrateComenzi])

  const filteredComenzi = useMemo(() => {
    const term = normalize(search)

    return listSource.filter((item) => {
      if (activeFilter === 'azi' && !(isOpenStatus(item.status) && item.data_livrare === today)) return false
      if (activeFilter === 'active' && !isOpenStatus(item.status)) return false
      if (activeFilter === 'restante' && !(isOpenStatus(item.status) && Boolean(item.data_livrare) && item.data_livrare! < today)) return false
      if (activeFilter === 'viitoare' && !(isOpenStatus(item.status) && Boolean(item.data_livrare) && item.data_livrare! > today)) return false
      if (activeFilter === 'neincasat' && !(item.status === 'livrata' && neincasatComandaIds.has(item.id))) return false

      if (!term) return true
      const clientName = normalize(getClientName(item, clientMap))
      const phone = normalize(item.telefon || '')
      return clientName.includes(term) || phone.includes(term)
    })
  }, [activeFilter, clientMap, listSource, neincasatComandaIds, search, today])

  const comenziLoadingSkeleton = (
    <div className="grid grid-cols-1 gap-3 lg:gap-4 xl:gap-5">
      {Array.from({ length: 4 }).map((_, index) => (
        <ListSkeletonCard key={index} className="min-h-[146px] sm:min-h-[208px]" />
      ))}
    </div>
  )

  const setFilterAndTab = (tab: TabKey, filter: DashboardFilter) => {
    setActiveTab(tab)
    setActiveFilter(filter)
  }

  const handleCopyContact = async () => {
    if (!contactPrompt?.phone) return
    try {
      await navigator.clipboard.writeText(contactPrompt.phone)
      toast('Număr copiat! Adaugă-l în contacte.')
    } catch {
      window.open(`tel:${contactPrompt.phone}`, '_self')
    }
  }

  const handleConfirmDeliver = async (comanda: Comanda) => {
    setDeliveringId(comanda.id)
    await deliverMutation.mutateAsync({
      comandaId: comanda.id,
      cantitateLivrataKg: Number(comanda.cantitate_kg || 0),
      plata: 'integral',
      dataLivrareRamasa: null,
    })
  }

  const desktopSelectedComanda =
    filteredComenzi.find((item) => item.id === desktopSelectedComandaId) ??
    filteredComenzi[0] ??
    null
  const desktopColumns = useMemo<ColumnDef<Comanda>[]>(() => [
    {
      id: 'data',
      header: 'Data',
      accessorFn: (row) => row.data_livrare || row.data_comanda,
      cell: ({ row }) => formatDate(row.original.data_livrare || row.original.data_comanda),
      meta: {
        searchValue: (row: Comanda) => row.data_livrare || row.data_comanda,
      },
    },
    {
      id: 'client',
      header: 'Client',
      accessorFn: (row) => getClientName(row, clientMap),
      cell: ({ row }) => <span className="font-medium">{getClientName(row.original, clientMap)}</span>,
      meta: {
        searchValue: (row: Comanda) => getClientName(row, clientMap),
      },
    },
    {
      id: 'produse',
      header: 'Produse',
      accessorFn: () => 1,
      cell: () => '1',
      meta: {
        searchValue: () => '1',
      },
    },
    {
      accessorKey: 'cantitate_kg',
      header: 'Cantitate totală',
      cell: ({ row }) => formatKg(Number(row.original.cantitate_kg || 0)),
      meta: {
        searchValue: (row: Comanda) => row.cantitate_kg,
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          text={statusLabelMap[row.original.status] ?? row.original.status}
          variant={statusVariantMap[row.original.status] ?? 'neutral'}
        />
      ),
      meta: {
        searchValue: (row: Comanda) => statusLabelMap[row.status] ?? row.status,
      },
    },
    {
      id: 'actions',
      header: 'Acțiuni',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Editează comanda"
            onClick={(event) => {
              event.stopPropagation()
              setEditing(row.original)
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Șterge comanda"
            onClick={(event) => {
              event.stopPropagation()
              setDeleting(row.original)
            }}
          >
            <Trash2 className="h-4 w-4 text-[var(--soft-danger-text)]" />
          </Button>
        </div>
      ),
      meta: {
        searchable: false,
        sticky: 'right',
        headerClassName: 'w-[104px] text-right',
        cellClassName: 'w-[104px] text-right',
      },
    },
  ], [clientMap])

  return (
    <AppShell
      header={<PageHeader title="Comenzi" subtitle="Livrări, statusuri și încasări" />}
      bottomBar={null}
    >
      <div
        className="mx-auto mt-3 w-full max-w-[980px] sm:mt-0 lg:max-w-[1320px]"
        style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md }}
      >
        {activeComenzi.length > 0 || comenziRestante.length > 0 || neincasatRon > 0 ? (
          <div
            style={{
              background: 'var(--agri-surface)',
              borderRadius: 12,
              padding: '10px 14px',
              border: '1px solid var(--agri-border)',
              display: 'flex',
              alignItems: 'baseline',
              gap: 14,
              flexWrap: 'wrap',
            }}
          >
            {activeComenzi.length > 0 ? (
              <span
                role="button"
                tabIndex={0}
                onClick={() => setFilterAndTab('de_livrat', 'active')}
                onKeyDown={(e) => { if (e.key === 'Enter') setFilterAndTab('de_livrat', 'active') }}
                style={{ cursor: 'pointer' }}
              >
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--agri-text)' }}>{activeComenzi.length}</span>
                <span style={{ fontSize: 11, color: 'var(--agri-text-muted)', marginLeft: 3 }}>active</span>
              </span>
            ) : null}
            {comenziAzi.length > 0 ? (
              <span
                role="button"
                tabIndex={0}
                onClick={() => setFilterAndTab('de_livrat', 'azi')}
                onKeyDown={(e) => { if (e.key === 'Enter') setFilterAndTab('de_livrat', 'azi') }}
                style={{ cursor: 'pointer' }}
              >
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--status-warning-text)' }}>{comenziAzi.length}</span>
                <span style={{ fontSize: 11, color: 'var(--agri-text-muted)', marginLeft: 3 }}>azi</span>
              </span>
            ) : null}
            {comenziRestante.length > 0 ? (
              <span
                role="button"
                tabIndex={0}
                onClick={() => setFilterAndTab('de_livrat', 'restante')}
                onKeyDown={(e) => { if (e.key === 'Enter') setFilterAndTab('de_livrat', 'restante') }}
                style={{ cursor: 'pointer' }}
              >
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--status-danger-text)' }}>{comenziRestante.length}</span>
                <span style={{ fontSize: 11, color: 'var(--agri-text-muted)', marginLeft: 3 }}>restante</span>
              </span>
            ) : null}
            {neincasatRon > 0 ? (
              <span
                role="button"
                tabIndex={0}
                onClick={() => setFilterAndTab('livrate', 'neincasat')}
                onKeyDown={(e) => { if (e.key === 'Enter') setFilterAndTab('livrate', 'neincasat') }}
                style={{ cursor: 'pointer' }}
              >
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--status-warning-text)' }}>{formatLeiCompact(neincasatRon)}</span>
                <span style={{ fontSize: 11, color: 'var(--agri-text-muted)', marginLeft: 3 }}>RON neîncasat</span>
              </span>
            ) : null}
            {totalStocDisponibilKg > 0 ? (
              <span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--value-positive)' }}>{formatKg(totalStocDisponibilKg)}</span>
                <span style={{ fontSize: 11, color: 'var(--agri-text-muted)', marginLeft: 3 }}>stoc</span>
              </span>
            ) : null}
          </div>
        ) : null}

        <PillTabs
          value={activeTab}
          onChange={(value) => {
            setActiveTab(value)
            if (value === 'de_livrat' && activeFilter === 'neincasat') setActiveFilter('none')
            if (value === 'livrate' && ['azi', 'active', 'restante', 'viitoare'].includes(activeFilter)) setActiveFilter('none')
          }}
          activeCount={activeComenzi.length}
          livrateCount={livrateComenzi.length}
        />

        <SearchField
          containerClassName="md:hidden"
          placeholder="Caută după client sau telefon..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Caută comenzi"
        />

        {isError ? <ErrorState title="Eroare" message={(error as Error).message} /> : null}
        {isLoading ? comenziLoadingSkeleton : null}

        {!isLoading && !isError && filteredComenzi.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-16 w-16" />}
            title="Nicio comandă încă"
            description="Adaugă prima comandă pentru a începe"
          />
        ) : null}

        {!isLoading && !isError && filteredComenzi.length > 0 ? (
          <>
            <div className="md:grid md:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)] md:gap-4">
              <ResponsiveDataView
                columns={desktopColumns}
                data={filteredComenzi}
                getRowId={(row) => row.id}
                searchPlaceholder="Caută în comenzi..."
                emptyMessage="Nu am găsit comenzi pentru filtrele curente."
                desktopContainerClassName="md:min-w-0"
                onDesktopRowClick={(row) => setDesktopSelectedComandaId(row.id)}
                isDesktopRowSelected={(row) => desktopSelectedComanda?.id === row.id}
                renderCard={(comanda) => (
                  <ComandaCard
                    comanda={comanda}
                    clientName={getClientName(comanda, clientMap)}
                    onOpenDetails={(item) => setViewing(item)}
                  />
                )}
              />

              <aside className="hidden rounded-2xl border border-[var(--agri-border)] bg-[var(--agri-surface)] p-4 shadow-sm md:block">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--agri-text-muted)]">Detalii comandă</h3>
                {desktopSelectedComanda ? (
                  <div className="mt-4 space-y-3 text-sm text-[var(--agri-text-muted)]">
                    <p><span className="font-medium text-[var(--agri-text)]">Client:</span> {getClientName(desktopSelectedComanda, clientMap)}</p>
                    <p><span className="font-medium text-[var(--agri-text)]">Telefon:</span> {desktopSelectedComanda.telefon || '-'}</p>
                    <p><span className="font-medium text-[var(--agri-text)]">Data comandă:</span> {formatDate(desktopSelectedComanda.data_comanda)}</p>
                    <p><span className="font-medium text-[var(--agri-text)]">Data livrare:</span> {formatDate(desktopSelectedComanda.data_livrare)}</p>
                    <p><span className="font-medium text-[var(--agri-text)]">Cantitate:</span> {formatKg(Number(desktopSelectedComanda.cantitate_kg || 0))}</p>
                    <p><span className="font-medium text-[var(--agri-text)]">Preț/kg:</span> {formatLei(Number(desktopSelectedComanda.pret_per_kg || 0))}</p>
                    <p><span className="font-medium text-[var(--agri-text)]">Total:</span> {formatLei(Number(desktopSelectedComanda.total || 0))}</p>
                    <div>
                      <StatusBadge
                        text={statusLabelMap[desktopSelectedComanda.status] ?? desktopSelectedComanda.status}
                        variant={statusVariantMap[desktopSelectedComanda.status] ?? 'neutral'}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {canDeliverStatus(desktopSelectedComanda.status) && desktopSelectedComanda.status !== 'anulata' ? (
                        <button
                          type="button"
                          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-green-700 dark:text-white dark:hover:bg-green-600"
                          disabled={deliveringId === desktopSelectedComanda.id}
                          onClick={() => {
                            void handleConfirmDeliver(desktopSelectedComanda)
                          }}
                        >
                          {deliveringId === desktopSelectedComanda.id ? 'Se livrează...' : 'Marchează livrată'}
                        </button>
                      ) : null}
                      {desktopSelectedComanda.status === 'livrata' ? (
                        <button
                          type="button"
                          className="rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                          onClick={() => setReopening(desktopSelectedComanda)}
                        >
                          Redeschide
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-md border border-[var(--agri-border)] px-3 py-2 text-xs font-semibold text-[var(--agri-text)] hover:bg-[var(--agri-surface-muted)]"
                        onClick={() => setEditing(desktopSelectedComanda)}
                      >
                        Editează
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-[var(--soft-danger-border)] px-3 py-2 text-xs font-semibold text-[var(--soft-danger-text)] hover:bg-[var(--soft-danger-bg)]"
                        onClick={() => setDeleting(desktopSelectedComanda)}
                      >
                        Șterge
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[var(--agri-text-muted)]">Selectează o comandă pentru detalii.</p>
                )}
              </aside>
            </div>
          </>
        ) : null}
      </div>

      <ComandaDialog
        key={`create-${addOpen ? 'open' : 'closed'}`}
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open)
          if (!open) {
            setCreatePrefill(null)
            clearComandaFormQueryParams()
          }
        }}
        saving={createMutation.isPending}
        clienti={clienti}
        mode="create"
        initialCreateValues={createPrefill}
        onSave={async (values) => {
          const cantitate = Number(values.cantitate_kg)
          const pret = Number(values.pret_per_kg)
          if (!Number.isFinite(cantitate) || cantitate <= 0) {
            hapticError()
            toast.error('Cantitatea trebuie să fie mai mare decât 0.')
            return
          }
          if (!Number.isFinite(pret) || pret <= 0) {
            hapticError()
            toast.error('Prețul trebuie să fie mai mare decât 0.')
            return
          }

          await createMutation.mutateAsync({
            client_id: values.client_id || null,
            client_nume_manual: values.client_nume_manual || null,
            telefon: values.telefon || null,
            locatie_livrare: values.locatie_livrare || null,
            data_comanda: values.data_comanda || today,
            data_livrare: values.data_livrare || null,
            cantitate_kg: cantitate,
            pret_per_kg: pret,
            status: values.status,
            observatii: values.observatii || null,
          })
        }}
      />

      <ComandaDialog
        key={`edit-${editing?.id ?? 'none'}-${editing ? 'open' : 'closed'}`}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        saving={updateMutation.isPending}
        clienti={clienti}
        mode="edit"
        initial={editing}
        onSave={async (values) => {
          if (!editing) return
          const cantitate = Number(values.cantitate_kg)
          const pret = Number(values.pret_per_kg)
          if (!Number.isFinite(cantitate) || cantitate <= 0) {
            hapticError()
            toast.error('Cantitatea trebuie să fie mai mare decât 0.')
            return
          }
          if (!Number.isFinite(pret) || pret <= 0) {
            hapticError()
            toast.error('Prețul trebuie să fie mai mare decât 0.')
            return
          }

          await updateMutation.mutateAsync({
            id: editing.id,
            payload: {
              client_id: values.client_id || null,
              client_nume_manual: values.client_nume_manual || null,
              telefon: values.telefon || null,
              locatie_livrare: values.locatie_livrare || null,
              data_comanda: values.data_comanda || today,
              data_livrare: values.data_livrare || null,
              cantitate_kg: cantitate,
              pret_per_kg: pret,
              status: values.status,
              observatii: values.observatii || null,
            },
          })
        }}
      />

      <ViewComandaDialog
        open={!!viewing}
        onOpenChange={(open) => {
          if (!open) setViewing(null)
        }}
        comanda={viewing}
        clientName={viewing ? getClientName(viewing, clientMap) : 'Client'}
        clientTelefon={viewing?.telefon}
        canDeliver={Boolean(viewing) && canDeliverStatus(viewing!.status) && viewing!.status !== 'anulata'}
        onDeliver={(comanda) => {
          setViewing(null)
          void handleConfirmDeliver(comanda)
        }}
        onEdit={(comanda) => {
          setViewing(null)
          setEditing(comanda)
        }}
        onDelete={(comanda) => {
          setViewing(null)
          setDeleting(comanda)
        }}
      />

      <ContactSavePromptDialog
        open={!!contactPrompt}
        contact={contactPrompt}
        onCopy={handleCopyContact}
        onAddClient={() => {
          if (contactPrompt) setClientPrefill(contactPrompt)
          setAddClientOpen(true)
          setContactPrompt(null)
        }}
        onDismiss={() => setContactPrompt(null)}
      />

      <AddClientDialog
        open={addClientOpen}
        onOpenChange={setAddClientOpen}
        initialValues={{
          nume_client: clientPrefill?.name ?? '',
          telefon: clientPrefill?.phone ?? '',
        }}
        onSubmit={async (data) => {
          await createClientMutation.mutateAsync({
            input: {
              nume_client: data.nume_client,
              telefon: data.telefon || null,
              email: data.email || null,
              adresa: data.adresa || null,
              pret_negociat_lei_kg: data.pret_negociat_lei_kg ? Number(data.pret_negociat_lei_kg) : null,
              observatii: data.observatii || null,
            },
            onDuplicateWarning: (existing) => {
              toast.warning(`Un client cu un nume similar există deja: ${existing.nume_client}. Continui.`)
            },
          })
        }}
      />

      <ConfirmDeleteDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        onConfirm={() => {
          if (!deleting) return
          scheduleDelete(deleting)
          setDeleting(null)
        }}
        itemType="Comanda"
        itemName={deleting ? `${getClientName(deleting, clientMap)} - ${formatDate(deleting.data_livrare)}` : 'Comanda selectată'}
        description={`Ștergi comanda pentru ${deleting ? getClientName(deleting, clientMap) : 'client'} din ${deleting ? formatDate(deleting.data_livrare) : 'data necunoscută'}?`}
        loading={deleteMutation.isPending}
      />

      <ConfirmDeleteDialog
        open={!!reopening}
        onOpenChange={(open) => {
          if (!open) setReopening(null)
        }}
        onConfirm={() => {
          if (!reopening) return
          reopenMutation.mutate(reopening.id)
        }}
        itemType="Comanda"
        itemName={reopening ? getClientName(reopening, clientMap) : 'Comanda livrată'}
        title="Confirmi redeschiderea?"
        description="Redeschiderea va anula vânzarea asociată și va restaura stocul aferent livrării."
        confirmText="Redeschide"
        loading={reopenMutation.isPending}
      />
    </AppShell>
  )
}


