
'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronDown, UserRoundPlus } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import { AppDialog } from '@/components/app/AppDialog'
import { ComandaFormSummary } from '@/components/comenzi/ComandaFormSummary'
import { EditOrderSheet } from '@/components/comenzi/EditOrderSheet'
import { DialogFormActions } from '@/components/ui/dialog-form-actions'
import {
  DesktopFormGrid,
  DesktopFormPanel,
  FormDialogSection,
} from '@/components/ui/form-dialog-layout'
import { AppShell } from '@/components/app/AppShell'
import { DashboardContentShell } from '@/components/app/DashboardContentShell'
import {
  ModuleEmptyCard,
  ModulePillFilterButton,
  ModulePillRow,
  ModuleScoreboard,
} from '@/components/app/module-list-chrome'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { ErrorState } from '@/components/app/ErrorState'
import { EntityListSkeleton } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { useMobileScrollRestore } from '@/components/app/useMobileScrollRestore'
import { AddClientDialog } from '@/components/clienti/AddClientDialog'
import { Button } from '@/components/ui/button'
import { AppDatePicker } from '@/components/ui/app-date-picker'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DesktopToolbar } from '@/components/ui/desktop'
import { SearchField } from '@/components/ui/SearchField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ShopOrdersPanel } from '@/components/comenzi/ShopOrdersPanel'
import {
  buildDeliveryLocation,
  deriveDeliverySelection,
  ErpLocalitySelector,
} from '@/components/comenzi/ErpLocalitySelector'
import {
  ComenziSectionPills,
  type ComenziSection,
} from '@/components/comenzi/ComenziSectionPills'
import { UnifiedOrderCard } from '@/components/comenzi/UnifiedOrderCard'
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
import {
  getMagazinGroupOrders,
  isMagazinPublicOrder,
} from '@/lib/comenzi/magazin-groups'
import {
  groupAllOrdersByDeliveryDate,
  isUnifiedOpenStatus,
  mergeUnifiedOrders,
  type UnifiedOrderItem,
} from '@/lib/comenzi/unified-orders'
import type { ShopOrderStatus } from '@/lib/shop/b2c-order-helpers'
import { fetchShopOrders } from '@/lib/shop/shop-orders-queries'
import {
  DELIVERY_ZONES,
  type DeliveryZone,
  type LocalityConfig,
  type VillageConfig,
} from '@/lib/shop/delivery-zones'

type DashboardFilter = 'none' | 'azi' | 'active' | 'restante' | 'viitoare' | 'neincasat'
type TabKey = 'de_livrat' | 'programate' | 'livrate' | 'toate'
type PageSection = ComenziSection
type ComenziOrderSort =
  | 'created_at'
  | 'created_at_desc'
  | 'delivery_date'
  | 'locality'
  | 'qty_desc'
  | 'total_desc'

type ComenziOrderGroup = {
  date: string | null
  orders: UnifiedOrderItem[]
  totalQty: number
}

const KG_PER_CASEROLĂ = 0.5

const ZONE_ORDER: Record<DeliveryZone, number> = {
  zona1: 1,
  zona2: 2,
  zona3: 3,
  zona4: 4,
  ridicare: 5,
}

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
  noua: 'neutral',
  confirmata: 'warning',
  programata: 'warning',
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

function tomorrowIso(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow.toISOString().split('T')[0]
}

function formatCompactDateLabel(value: string): string {
  if (!value) return 'Selectează data'
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  const prefix = value === todayIso() ? 'Azi · ' : ''
  return `${prefix}${parsed.toLocaleDateString('ro-RO')}`
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

function formatKgOneDecimal(value: number): string {
  return `${new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number(value || 0))} kg`
}

function getUnifiedOrderNeedKg(item: UnifiedOrderItem): number {
  return item.quantityUnit === 'kg' ? item.quantity : item.quantity * KG_PER_CASEROLĂ
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

function groupOrdersByCreatedDate(
  orders: UnifiedOrderItem[],
  direction: 'asc' | 'desc',
): ComenziOrderGroup[] {
  const multiplier = direction === 'asc' ? 1 : -1
  const sorted = [...orders].sort(
    (a, b) =>
      multiplier * a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  )
  const byDate = new Map<string, UnifiedOrderItem[]>()

  for (const order of sorted) {
    const date = order.createdAt.slice(0, 10)
    const current = byDate.get(date) ?? []
    current.push(order)
    byDate.set(date, current)
  }

  return [...byDate.entries()]
    .sort(([dateA], [dateB]) => multiplier * dateA.localeCompare(dateB))
    .map(([date, groupedOrders]) => ({
      date,
      orders: groupedOrders,
      totalQty: groupedOrders.reduce((total, order) => total + order.quantity, 0),
    }))
}

function buildComenziOrderGroups(
  orders: UnifiedOrderItem[],
  sort: ComenziOrderSort,
): ComenziOrderGroup[] {
  if (sort === 'created_at' || sort === 'created_at_desc') {
    return groupOrdersByCreatedDate(orders, sort === 'created_at' ? 'asc' : 'desc')
  }

  if (sort === 'delivery_date' || sort === 'locality') {
    return groupAllOrdersByDeliveryDate(orders, sort)
  }

  const sorted = [...orders].sort((a, b) => {
    if (sort === 'qty_desc') {
      return (
        b.quantity - a.quantity ||
        b.totalLei - a.totalLei ||
        b.createdAt.localeCompare(a.createdAt)
      )
    }
    return (
      b.totalLei - a.totalLei ||
      b.quantity - a.quantity ||
      b.createdAt.localeCompare(a.createdAt)
    )
  })

  return [{
    date: null,
    orders: sorted,
    totalQty: sorted.reduce((total, order) => total + order.quantity, 0),
  }]
}

function compareOrdersForSort(
  a: UnifiedOrderItem,
  b: UnifiedOrderItem,
  sort: ComenziOrderSort,
): number {
  switch (sort) {
    case 'created_at':
      return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
    case 'created_at_desc':
      return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
    case 'delivery_date':
      return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
    case 'locality':
      return (
        ZONE_ORDER[a.deliveryZone] - ZONE_ORDER[b.deliveryZone] ||
        a.localityLabel.localeCompare(b.localityLabel, 'ro-RO') ||
        a.createdAt.localeCompare(b.createdAt)
      )
    case 'qty_desc':
      return (
        b.quantity - a.quantity ||
        b.totalLei - a.totalLei ||
        b.createdAt.localeCompare(a.createdAt)
      )
    case 'total_desc':
      return (
        b.totalLei - a.totalLei ||
        b.quantity - a.quantity ||
        b.createdAt.localeCompare(a.createdAt)
      )
    default:
      return 0
  }
}

function buildProgramateGroups(
  orders: UnifiedOrderItem[],
  sort: ComenziOrderSort,
): ComenziOrderGroup[] {
  const byDate = new Map<string, UnifiedOrderItem[]>()

  for (const order of orders) {
    if (!order.deliveryDate) continue
    const current = byDate.get(order.deliveryDate) ?? []
    current.push(order)
    byDate.set(order.deliveryDate, current)
  }

  return [...byDate.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, groupedOrders]) => {
      const sortedOrders = [...groupedOrders].sort((a, b) =>
        compareOrdersForSort(a, b, sort),
      )

      return {
        date,
        orders: sortedOrders,
        totalQty: sortedOrders.reduce((total, order) => total + order.quantity, 0),
      }
    })
}

function canDeliverStatus(status: string): boolean {
  const normalized = normalize(status)
  return ['noua', 'confirmata', 'programata', 'in_livrare'].includes(normalized)
}

function getRelativeScheduledLabel(date: string, referenceDate?: string): string | null {
  const base = referenceDate
    ? new Date(`${referenceDate}T12:00:00.000Z`)
    : new Date()
  const target = new Date(`${date}T12:00:00.000Z`)
  if (Number.isNaN(base.getTime()) || Number.isNaN(target.getTime())) return null

  const start = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate())
  const end = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  const diffDays = Math.round((end - start) / 86_400_000)

  if (diffDays === 0) return 'Azi'
  if (diffDays === 1) return 'Mâine'
  return null
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

function buildComandaDialogInitialFormState(params: {
  initial?: Comanda | null
  initialCreateValues?: Partial<ComandaFormState> | null
  clienti: Client[]
  mode: 'create' | 'edit'
}): ComandaFormState {
  const { initial, initialCreateValues, clienti, mode } = params
  const baseForm: ComandaFormState = initial
    ? {
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
    : {
        ...defaultFormState('confirmata'),
        ...(initialCreateValues ?? {}),
      }

  let prefillClientId = baseForm.client_id
  if (!prefillClientId && mode === 'create' && baseForm.client_nume_manual) {
    prefillClientId = resolveClientIdFromHint(baseForm.client_nume_manual, clienti) ?? ''
  }

  const client = prefillClientId ? clienti.find((item) => item.id === prefillClientId) : undefined

  return {
    ...baseForm,
    client_id: prefillClientId,
    client_nume_manual: prefillClientId ? '' : baseForm.client_nume_manual,
    telefon: client?.telefon || baseForm.telefon,
    locatie_livrare: client?.adresa || baseForm.locatie_livrare,
  }
}

function buildComandaDialogInitialComboInput(form: ComandaFormState, clienti: Client[]): string {
  if (form.client_id) {
    return clienti.find((client) => client.id === form.client_id)?.nume_client ?? ''
  }

  return form.client_nume_manual ?? ''
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
  if (filter === 'programate') return 'programate'
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

function isPaidStatus(status: string | null | undefined): boolean {
  const value = normalize(String(status ?? ''))
  return value.includes('platit') || value.includes('incasat') || value.includes('achitat')
}

function PillTabs({
  value,
  onChange,
  activeCount,
  scheduledCount,
  livrateCount,
}: {
  value: TabKey
  onChange: (value: TabKey) => void
  activeCount: number
  scheduledCount: number
  livrateCount: number
}) {
  const tabs = [
    { key: 'de_livrat' as const, label: `Active${activeCount > 0 ? ` (${activeCount})` : ''}` },
    { key: 'programate' as const, label: `Programate${scheduledCount > 0 ? ` (${scheduledCount})` : ''}` },
    { key: 'livrate' as const, label: `Livrate${livrateCount > 0 ? ` (${livrateCount})` : ''}` },
    { key: 'toate' as const, label: 'Toate' },
  ]
  return (
    <ModulePillRow>
      {tabs.map((tab) => (
        <ModulePillFilterButton
          key={tab.key}
          active={value === tab.key}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </ModulePillFilterButton>
      ))}
    </ModulePillRow>
  )
}

function UnifiedOrderGroupSection({
  date,
  orderCount,
  totalQty,
  quantityLabel,
  necesarKg,
  showHeader = true,
  scheduledView = false,
  referenceDate,
  children,
}: {
  date: string | null
  orderCount: number
  totalQty: number
  quantityLabel: string
  necesarKg?: number
  showHeader?: boolean
  scheduledView?: boolean
  referenceDate?: string
  children: ReactNode
}) {
  const zone = date?.startsWith('zone:') ? (date.slice(5) as DeliveryZone) : null
  const baseLabel = zone
    ? DELIVERY_ZONES[zone].label
    : date
      ? new Intl.DateTimeFormat('ro-RO', {
          day: 'numeric',
          month: 'long',
          timeZone: 'UTC',
        }).format(new Date(`${date}T12:00:00.000Z`))
      : 'Neprogramate'
  const relativeLabel =
    scheduledView && date
      ? getRelativeScheduledLabel(date, referenceDate)
      : null
  const label =
    scheduledView && date
      ? `📅 ${baseLabel}${relativeLabel ? ` · ${relativeLabel}` : ''}`
      : baseLabel

  return (
    <section className={showHeader ? 'space-y-3' : undefined}>
      {showHeader ? (
        <div
          className={`rounded-xl border px-3 py-2 text-sm font-bold ${
            date
              ? 'border-[var(--border-default)] bg-[var(--surface-card-muted)] text-[var(--text-secondary)]'
              : 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
          }`}
        >
          {label} · {orderCount} {orderCount === 1 ? 'comandă' : 'comenzi'}
          {quantityLabel ? ` · ${totalQty.toLocaleString('ro-RO')} ${quantityLabel}` : ''}
          {typeof necesarKg === 'number' && necesarKg > 0 ? ` · ${formatKgOneDecimal(necesarKg)} necesari` : ''}
        </div>
      ) : null}
      {children}
    </section>
  )
}

function StocNecesarCard({
  necesarKg,
  stocDisponibilKg,
}: {
  necesarKg: number
  stocDisponibilKg: number
}) {
  const hasEnoughStock = stocDisponibilKg >= necesarKg

  return (
    <div
      className={`rounded-2xl border px-3 py-2 ${
        hasEnoughStock
          ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)]'
          : 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
            Stoc vs necesar
          </p>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Necesar livrări: {formatKgOneDecimal(necesarKg)}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            Stoc disponibil: {formatKgOneDecimal(stocDisponibilKg)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${
            hasEnoughStock
              ? 'bg-[var(--status-success-bg)] text-[var(--success-text)]'
              : 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
          }`}
        >
          {hasEnoughStock ? '✅ OK' : '⚠️ Sub necesar'}
        </span>
      </div>
    </div>
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
  const initialFormState = useMemo(
    () =>
      buildComandaDialogInitialFormState({
        initial,
        initialCreateValues,
        clienti,
        mode,
      }),
    [clienti, initial, initialCreateValues, mode]
  )
  const initialComboInput = useMemo(
    () => buildComandaDialogInitialComboInput(initialFormState, clienti),
    [clienti, initialFormState]
  )
  const initialDeliverySelection = useMemo(
    () => deriveDeliverySelection(initialFormState.locatie_livrare),
    [initialFormState.locatie_livrare],
  )
  const [form, setForm] = useState<ComandaFormState>(initialFormState)
  const [comboInput, setComboInput] = useState(initialComboInput)
  const [comboOpen, setComboOpen] = useState(false)
  const [mobileObservatiiOpen, setMobileObservatiiOpen] = useState(false)
  const [deliveryModeSel, setDeliveryModeSel] = useState<'livrare' | 'ridicare'>(
    initialDeliverySelection.mode,
  )
  const [localitySel, setLocalitySel] = useState<LocalityConfig | null>(
    initialDeliverySelection.locality,
  )
  const [villageSel, setVillageSel] = useState<VillageConfig | null>(
    initialDeliverySelection.village,
  )
  const [streetSel, setStreetSel] = useState(initialDeliverySelection.street)
  const [blockedDeliveryMessage, setBlockedDeliveryMessage] = useState('')
  const comboRef = useRef<HTMLDivElement>(null)

  const selectedClient = clienti.find((client) => client.id === form.client_id)
  const displayedComboInput = comboInput || (form.client_id ? selectedClient?.nume_client ?? '' : '')
  const resolvedPhone = form.telefon || selectedClient?.telefon || ''
  const resolvedLocation = form.locatie_livrare || selectedClient?.adresa || ''
  const suggestedClientName =
    form.client_nume_manual.trim() || selectedClient?.nume_client || displayedComboInput.trim() || 'Client'
  const canSaveContact = suggestedClientName.trim().length > 0 && resolvedPhone.trim().length > 0
  const isNewClientFlow = !form.client_id && form.client_nume_manual.trim().length > 0
  const previewKg = Number(form.cantitate_kg || 0)
  const previewPret = Number(form.pret_per_kg || 0)
  const previewTotal = Number.isFinite(previewKg) && Number.isFinite(previewPret) ? previewKg * previewPret : 0
  const summaryPhone = resolvedPhone.trim() || '—'
  const summaryLocation = resolvedLocation.trim() || '—'
  const summaryQuantity = Number.isFinite(previewKg) ? formatKg(previewKg) : '—'
  const summaryUnitPrice = Number.isFinite(previewPret) ? formatLei(previewPret) : '—'

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
      title={mode === 'create' ? 'Adaugă comandă' : 'Editează comandă'}
      description={
        mode === 'create'
          ? 'Pregătești rapid o comandă nouă și verifici rezumatul înainte de salvare.'
          : 'Actualizezi datele comenzii fără să schimbi fluxul existent de client și livrare.'
      }
      desktopFormWide
      desktopFormCompact
      showCloseButton
      contentClassName="md:w-[min(96vw,76rem)] md:max-w-none lg:w-[min(94vw,78rem)]"
      footer={
        <DialogFormActions
          className="w-full"
          onCancel={() => onOpenChange(false)}
          onSave={async () => {
            await onSave({
              ...form,
              telefon: resolvedPhone,
              locatie_livrare: resolvedLocation,
            })
          }}
          saving={saving}
          cancelLabel="Anulează"
          saveLabel="Salvează"
        />
      }
    >
      <DesktopFormGrid
        className="md:grid-cols-[minmax(0,1fr)_16.5rem] md:gap-3 lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:gap-3.5 xl:grid-cols-[minmax(0,1fr)_18rem]"
        aside={
          <ComandaFormSummary
            clientName={suggestedClientName}
            phone={summaryPhone}
            location={summaryLocation}
            quantityLabel={summaryQuantity}
            unitPriceLabel={summaryUnitPrice}
            totalLabel={formatLei(previewTotal)}
            statusLabel={statusLabelMap[form.status]}
            statusVariant={statusVariantMap[form.status]}
            notes={form.observatii}
            className="hidden md:block md:rounded-[22px] md:p-3.5 lg:p-4"
          />
        }
      >
        <FormDialogSection>
          <DesktopFormPanel className="space-y-2.5">
            {selectedClient ? (
              <div className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 md:hidden">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden />
                  <span className="truncate font-semibold text-[var(--text-primary)]">
                    {selectedClient.nume_client}
                    {resolvedPhone ? (
                      <span className="font-normal text-[var(--text-secondary)]"> · {resolvedPhone}</span>
                    ) : null}
                  </span>
                </span>
                <button
                  type="button"
                  className="min-h-11 shrink-0 text-sm font-semibold text-[var(--primary)]"
                  onClick={() => {
                    setComboInput('')
                    setComboOpen(true)
                    setForm((prev) => ({ ...prev, client_id: '', client_nume_manual: '' }))
                  }}
                >
                  Schimbă
                </button>
              </div>
            ) : null}

            <div
              ref={comboRef}
              className={`space-y-1.5 ${selectedClient ? 'hidden md:block' : ''}`}
            >
              <Label htmlFor="comanda_client_combo">Client</Label>
              <div className="relative">
                <Input
                  id="comanda_client_combo"
                  className="agri-control h-11 md:h-10"
                  placeholder="Caută după nume sau telefon..."
                  autoComplete="off"
                  value={displayedComboInput}
                  onFocus={() => setComboOpen(true)}
                  onChange={(e) => {
                    const val = e.target.value
                    setComboInput(val)
                    setComboOpen(true)
                    setForm((prev) => ({ ...prev, client_id: '', client_nume_manual: val }))
                  }}
                />
                {comboOpen && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-elevated)]">
                    {comboFiltered.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-[var(--text-secondary)]">
                        Niciun client găsit — completează manual
                      </p>
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
                            const deliverySelection = deriveDeliverySelection(client.adresa ?? '')
                            setDeliveryModeSel(deliverySelection.mode)
                            setLocalitySel(deliverySelection.locality)
                            setVillageSel(deliverySelection.village)
                            setStreetSel(deliverySelection.street)
                            setBlockedDeliveryMessage('')
                            setForm((prev) => ({
                              ...prev,
                              client_id: client.id,
                              client_nume_manual: '',
                              telefon: client.telefon || prev.telefon,
                              locatie_livrare: client.adresa || prev.locatie_livrare,
                            }))
                          }}
                        >
                          <span className="font-medium text-[var(--text-primary)]">{client.nume_client}</span>
                          {client.telefon ? (
                            <span className="text-[var(--text-secondary)]">— {client.telefon}</span>
                          ) : null}
                        </button>
                      ))
                    )}
                    <button
                      type="button"
                      className="flex w-full items-center gap-1.5 border-t border-[var(--divider)] px-3 py-2.5 text-left text-sm font-medium text-[var(--success-text)] hover:bg-[var(--success-bg)]"
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

            <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-3 md:gap-y-2.5">
              <div className="space-y-1.5">
                <Label>Telefon</Label>
                <Input
                  className="agri-control h-11 md:h-10"
                  value={resolvedPhone}
                  onChange={(e) => setForm((prev) => ({ ...prev, telefon: e.target.value }))}
                />
              </div>
              {isNewClientFlow ? (
                <div className="space-y-1.5 md:min-w-[148px]">
                  <Label className="opacity-0">Contact</Label>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full whitespace-nowrap rounded-xl px-3 text-xs sm:text-sm md:h-10"
                    disabled={!canSaveContact}
                    onClick={() => saveContactAsVCard(suggestedClientName, resolvedPhone)}
                  >
                    <UserRoundPlus className="h-4 w-4" />
                    Salvează contact
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Mod livrare</Label>
              <div className="flex gap-2">
                {(['livrare', 'ridicare'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setDeliveryModeSel(mode)
                      setLocalitySel(null)
                      setVillageSel(null)
                      setStreetSel('')
                      setBlockedDeliveryMessage('')
                      const loc = mode === 'ridicare' ? 'Ridicare la fermă (Văratec)' : ''
                      setForm((prev) => ({ ...prev, locatie_livrare: loc }))
                    }}
                    className={`min-h-9 flex-1 rounded-xl border px-3 text-sm font-semibold transition ${
                      deliveryModeSel === mode
                        ? 'border-[var(--primary)] bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]'
                        : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {mode === 'livrare' ? 'Livrare la domiciliu' : 'Ridicare la fermă (Văratec)'}
                  </button>
                ))}
              </div>
            </div>

            {deliveryModeSel === 'livrare' ? (
              <ErpLocalitySelector
                selectedLocality={localitySel}
                selectedVillage={villageSel}
                street={streetSel}
                onSelectLocality={(locality) => {
                  setLocalitySel(locality)
                  setVillageSel(null)
                  setBlockedDeliveryMessage('')
                  const loc = buildDeliveryLocation(locality, null, streetSel)
                  setForm((prev) => ({ ...prev, locatie_livrare: loc }))
                }}
                onSelectVillage={(village) => {
                  setVillageSel(village)
                  setBlockedDeliveryMessage('')
                  const loc = buildDeliveryLocation(localitySel, village, streetSel)
                  setForm((prev) => ({ ...prev, locatie_livrare: loc }))
                }}
                onBlockedVillage={(village) => {
                  setBlockedDeliveryMessage(
                    village.blockedMessage ?? `Nu livrăm în ${village.name}.`,
                  )
                }}
                onStreetChange={(street) => {
                  setStreetSel(street)
                  const loc = buildDeliveryLocation(localitySel, villageSel, street)
                  setForm((prev) => ({ ...prev, locatie_livrare: loc }))
                }}
                blockedMessage={blockedDeliveryMessage}
              />
            ) : null}

            <div className="space-y-2.5 md:hidden">
              <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {formatCompactDateLabel(form.data_comanda)}
                </span>
                <button
                  type="button"
                  className="min-h-11 shrink-0 text-sm font-semibold text-[var(--primary)]"
                  onClick={() => document.getElementById('comanda-data-mobile')?.click()}
                >
                  Schimbă
                </button>
              </div>
              <div className="absolute h-px w-px overflow-hidden">
                <AppDatePicker
                  id="comanda-data-mobile"
                  value={form.data_comanda}
                  onChange={(nextValue) =>
                    setForm((prev) => ({ ...prev, data_comanda: nextValue }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>Data livrare</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Azi', value: todayIso() },
                    { label: 'Mâine', value: tomorrowIso() },
                  ].map((option) => {
                    const selected = form.data_livrare === option.value
                    return (
                      <button
                        key={option.label}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setForm((prev) => ({ ...prev, data_livrare: option.value }))
                        }
                        className={`min-h-11 rounded-xl border px-2 text-sm font-semibold ${
                          selected
                            ? 'border-[var(--primary)] bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]'
                            : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    aria-pressed={
                      Boolean(form.data_livrare) &&
                      form.data_livrare !== todayIso() &&
                      form.data_livrare !== tomorrowIso()
                    }
                    onClick={() => document.getElementById('comanda-data-livrare-mobile')?.click()}
                    className={`min-h-11 rounded-xl border px-2 text-sm font-semibold ${
                      Boolean(form.data_livrare) &&
                      form.data_livrare !== todayIso() &&
                      form.data_livrare !== tomorrowIso()
                        ? 'border-[var(--primary)] bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)] text-[var(--primary)]'
                        : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)]'
                    }`}
                  >
                    Altă dată
                  </button>
                </div>
                {form.data_livrare &&
                form.data_livrare !== todayIso() &&
                form.data_livrare !== tomorrowIso() ? (
                  <p className="text-xs font-medium text-[var(--text-secondary)]">
                    Selectat: {formatDate(form.data_livrare)}
                  </p>
                ) : null}
                <div className="absolute h-px w-px overflow-hidden">
                  <AppDatePicker
                    id="comanda-data-livrare-mobile"
                    value={form.data_livrare}
                    onChange={(nextValue) =>
                      setForm((prev) => ({ ...prev, data_livrare: nextValue }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="hidden grid-cols-2 gap-2.5 md:grid md:gap-x-3 md:gap-y-2.5">
              <AppDatePicker
                id="comanda-data"
                label="Data comandă"
                placeholder="Selectează data"
                value={form.data_comanda}
                triggerClassName="h-11 md:h-10"
                onChange={(nextValue) => setForm((prev) => ({ ...prev, data_comanda: nextValue }))}
              />
              <AppDatePicker
                id="comanda-data-livrare"
                label="Data livrare"
                placeholder="Selectează data"
                value={form.data_livrare}
                triggerClassName="h-11 md:h-10"
                onChange={(nextValue) => setForm((prev) => ({ ...prev, data_livrare: nextValue }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 md:gap-x-3 md:gap-y-2.5">
              <div className="space-y-1.5">
                <Label>Cantitate (kg)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="agri-control h-11 md:h-10"
                  value={form.cantitate_kg}
                  onChange={(e) => setForm((prev) => ({ ...prev, cantitate_kg: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preț per kg</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="agri-control h-11 md:h-10"
                  value={form.pret_per_kg}
                  onChange={(e) => setForm((prev) => ({ ...prev, pret_per_kg: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2.5 text-sm md:hidden">
              <span className="text-[var(--text-secondary)]">
                {formatKg(previewKg)} × {formatLei(previewPret)}/kg
              </span>
              <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                Total: {formatLei(previewTotal)}
              </span>
            </div>

            <div className="grid gap-2.5 md:grid-cols-[minmax(0,11.5rem)_minmax(0,1fr)] md:gap-x-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as ComandaStatus }))}
                >
                  <SelectTrigger className="agri-control h-11 md:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(mode === 'create'
                      ? COMENZI_STATUSES.filter((s) => s === 'noua' || s === 'confirmata' || s === 'in_livrare')
                      : COMENZI_STATUSES
                    ).map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabelMap[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden space-y-1.5 md:block">
                <Label>Observații</Label>
                <Textarea
                  className="agri-control min-h-[3.75rem] md:min-h-[4.25rem]"
                  value={form.observatii}
                  onChange={(e) => setForm((prev) => ({ ...prev, observatii: e.target.value }))}
                />
              </div>
            </div>

            <Collapsible
              open={mobileObservatiiOpen}
              onOpenChange={setMobileObservatiiOpen}
              className="md:hidden"
            >
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-sm font-semibold text-[var(--text-primary)]"
                >
                  Observații
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${mobileObservatiiOpen ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <Textarea
                  className="agri-control min-h-[4.25rem]"
                  value={form.observatii}
                  onChange={(e) => setForm((prev) => ({ ...prev, observatii: e.target.value }))}
                />
              </CollapsibleContent>
            </Collapsible>
          </DesktopFormPanel>
        </FormDialogSection>
      </DesktopFormGrid>
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
  const shopDeliveryRedirectTimer = useRef<number | null>(null)

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
  const [orderSort, setOrderSort] = useState<ComenziOrderSort>(() =>
    initialTab === 'programate' ? 'delivery_date' : 'created_at',
  )
  const [section, setSection] = useState<PageSection>(() =>
    searchParams.get('section') === 'waitlist' ? 'waitlist' : 'comenzi',
  )
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Comanda | null>(null)
  const [editingOrder, setEditingOrder] = useState<UnifiedOrderItem | null>(null)
  const [deleting, setDeleting] = useState<Comanda | null>(null)
  const [reopening, setReopening] = useState<Comanda | null>(null)
  const [viewing, setViewing] = useState<Comanda | null>(null)
  const [contactPrompt, setContactPrompt] = useState<ContactPrompt | null>(null)
  const [clientPrefill, setClientPrefill] = useState<ContactPrompt | null>(null)
  const [addClientOpen, setAddClientOpen] = useState(false)
  const addFromQuery = searchParams.get('add') === '1'
  const openFormFromQuery = hasAiComandaOpenForm(searchParams)
  const queryCreatePrefill = useMemo(
    () => (openFormFromQuery ? parseAiComandaPrefill(searchParams) : null),
    [openFormFromQuery, searchParams]
  )
  const isCreateDialogOpen = addOpen || addFromQuery || openFormFromQuery

  const clearComandaFormQueryParams = useCallback(() => {
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
  }, [pathname, router, searchParams])

  const {
    data: comenzi = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: queryKeys.comenzi,
    queryFn: getComenzi,
  })

  const {
    data: shopOrders = [],
    isLoading: shopOrdersLoading,
    isError: shopOrdersError,
    error: shopOrdersErrorObj,
  } = useQuery({
    queryKey: queryKeys.shopOrders,
    queryFn: fetchShopOrders,
  })

  useMobileScrollRestore({
    storageKey: 'scroll:comenzi',
    ready: !isLoading && !shopOrdersLoading,
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

      setActiveTab('livrate')
      setActiveFilter('none')
    },
    onError: (err: Error) => {
      hapticError()
      toast.error(err.message)
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

  const patchShopOrderMutation = useMutation({
    mutationFn: async (input: {
      id: string
      status?: ShopOrderStatus
      notified_wa?: boolean
      delivery_date?: string | null
    }) => {
      const res = await fetch(`/api/shop/b2c/orders/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.notified_wa !== undefined ? { notified_wa: input.notified_wa } : {}),
          ...(input.delivery_date !== undefined ? { delivery_date: input.delivery_date } : {}),
        }),
      })
      const json = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Actualizare eșuată')
      }
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrders })
      void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrdersInLivrare })
      void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrdersInLivrareCount })

      if (variables.delivery_date !== undefined) {
        toast.success(
          variables.delivery_date
            ? 'Data livrării a fost actualizată'
            : 'Data livrării a fost ștearsă',
        )
      }

      if (variables.status === 'in_livrare') {
        toast('Comanda mutată în livrări 🚚', { duration: 1200 })
        if (shopDeliveryRedirectTimer.current) {
          window.clearTimeout(shopDeliveryRedirectTimer.current)
        }
        shopDeliveryRedirectTimer.current = window.setTimeout(() => {
          router.push('/livrari')
          shopDeliveryRedirectTimer.current = null
        }, 1200)
      }
    },
    onError: (err: Error) => {
      hapticError()
      toast.error(err.message)
    },
  })

  useEffect(
    () => () => {
      if (shopDeliveryRedirectTimer.current) {
        window.clearTimeout(shopDeliveryRedirectTimer.current)
      }
    },
    [],
  )

  useEffect(() => {
    if (section !== 'comenzi') return
    const interval = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrders })
    }, 30_000)
    return () => clearInterval(interval)
  }, [queryClient, section])

  useEffect(() => {
    if (section !== 'comenzi') return
    const unregister = registerAddAction(() => {
      setAddOpen(true)
    }, 'Adaugă comandă')
    return unregister
  }, [registerAddAction, section])

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
  const manualComenzi = useMemo(
    () => comenzi.filter((item) => !isMagazinPublicOrder(item)),
    [comenzi],
  )
  const activeComenzi = useMemo(
    () => manualComenzi.filter((item) => isOpenStatus(item.status)),
    [manualComenzi],
  )
  const livrateComenzi = useMemo(
    () => manualComenzi.filter((item) => item.status === 'livrata'),
    [manualComenzi],
  )
  const preorderShopOrders = useMemo(
    () =>
      shopOrders.filter(
        (item) => item.order_kind === 'preorder' && item.status !== 'anulata',
      ),
    [shopOrders],
  )
  const shopActiveCount = useMemo(
    () => preorderShopOrders.filter((item) => isUnifiedOpenStatus(item.status)).length,
    [preorderShopOrders],
  )
  const shopLivrateCount = useMemo(
    () => preorderShopOrders.filter((item) => item.status === 'livrata').length,
    [preorderShopOrders],
  )

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

  const comenziAziCount = useMemo(
    () =>
      activeComenzi.filter((item) => item.data_livrare === today).length +
      preorderShopOrders.filter(
        (item) => isUnifiedOpenStatus(item.status) && item.delivery_date === today,
      ).length,
    [activeComenzi, preorderShopOrders, today],
  )
  const comenziRestanteCount = useMemo(
    () =>
      activeComenzi.filter(
        (item) => Boolean(item.data_livrare) && item.data_livrare! < today,
      ).length +
      preorderShopOrders.filter(
        (item) =>
          isUnifiedOpenStatus(item.status) &&
          Boolean(item.delivery_date) &&
          item.delivery_date! < today,
      ).length,
    [activeComenzi, preorderShopOrders, today],
  )
  const programateCount = useMemo(
    () =>
      activeComenzi.filter((item) => Boolean(item.data_livrare)).length +
      preorderShopOrders.filter(
        (item) => isUnifiedOpenStatus(item.status) && Boolean(item.delivery_date),
      ).length,
    [activeComenzi, preorderShopOrders],
  )

  const totalStocDisponibilKg = Number(stocGlobal.cal1 || 0) + Number(stocGlobal.cal2 || 0)

  const unifiedAllOrders = useMemo(
    () => mergeUnifiedOrders(manualComenzi, preorderShopOrders, clientMap),
    [clientMap, manualComenzi, preorderShopOrders],
  )

  const necesarKgTotal = useMemo(
    () =>
      unifiedAllOrders.reduce((sum, item) => {
        if (!isUnifiedOpenStatus(item.status) || !item.deliveryDate) return sum
        return sum + getUnifiedOrderNeedKg(item)
      }, 0),
    [unifiedAllOrders],
  )

  const showStocNecesarCard = necesarKgTotal > 0

  const unifiedFiltered = useMemo(() => {
    const term = normalize(search)

    return unifiedAllOrders.filter((item) => {
      if (activeTab === 'de_livrat' && !isUnifiedOpenStatus(item.status)) return false
      if (
        activeTab === 'programate' &&
        !(isUnifiedOpenStatus(item.status) && Boolean(item.deliveryDate))
      ) {
        return false
      }
      if (activeTab === 'livrate' && item.status !== 'livrata') return false
      if (
        activeFilter === 'azi' &&
        !(isUnifiedOpenStatus(item.status) && item.deliveryDate === today)
      ) {
        return false
      }
      if (activeFilter === 'active' && !isUnifiedOpenStatus(item.status)) return false
      if (
        activeFilter === 'restante' &&
        !(
          isUnifiedOpenStatus(item.status) &&
          Boolean(item.deliveryDate) &&
          item.deliveryDate! < today
        )
      ) {
        return false
      }
      if (
        activeFilter === 'viitoare' &&
        !(
          isUnifiedOpenStatus(item.status) &&
          Boolean(item.deliveryDate) &&
          item.deliveryDate! > today
        )
      ) {
        return false
      }

      if (item.source === 'b2b' && item.b2bComanda) {
        const b2b = item.b2bComanda
        if (activeFilter === 'neincasat' && !(b2b.status === 'livrata' && neincasatComandaIds.has(b2b.id))) return false
      } else if (activeFilter === 'neincasat') {
        return false
      }

      if (!term) return true
      const clientName = normalize(item.customerName)
      const phone = normalize(item.phone)
      return clientName.includes(term) || phone.includes(term)
    })
  }, [activeFilter, activeTab, neincasatComandaIds, search, today, unifiedAllOrders])
  const unifiedGroups = useMemo(
    () =>
      activeTab === 'programate'
        ? buildProgramateGroups(unifiedFiltered, orderSort)
        : buildComenziOrderGroups(unifiedFiltered, orderSort),
    [activeTab, orderSort, unifiedFiltered],
  )
  const showOrderGroupHeaders =
    activeTab === 'programate' || (orderSort !== 'qty_desc' && orderSort !== 'total_desc')

  const setFilterAndTab = (tab: TabKey, filter: DashboardFilter) => {
    setActiveTab(tab)
    if (tab === 'programate') setOrderSort('delivery_date')
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
    await deliverMutation.mutateAsync({
      comandaId: comanda.id,
      cantitateLivrataKg: Number(comanda.cantitate_kg || 0),
      plata: 'integral',
      dataLivrareRamasa: null,
    })
  }

  const magazinGroupForViewDialog = useMemo(() => {
    if (!viewing) return []
    return getMagazinGroupOrders(comenzi, viewing)
  }, [comenzi, viewing])

  const magazinGroupTotalViewDialog = useMemo(
    () => magazinGroupForViewDialog.reduce((s, l) => s + Number(l.total || 0), 0),
    [magazinGroupForViewDialog],
  )

  return (
    <AppShell
      header={<PageHeader title="Comenzi" subtitle="Livrări, statusuri și încasări" contentVariant="workspace" />}
      bottomBar={null}
    >
      <DashboardContentShell variant="workspace" className="mt-2 flex flex-col gap-3 py-3 sm:mt-0 sm:py-3">
        <ComenziSectionPills section={section} onSectionChange={setSection} />

        {section === 'waitlist' ? <ShopOrdersPanel /> : null}

        {section === 'comenzi' && (activeComenzi.length + shopActiveCount > 0 || comenziRestanteCount > 0 || neincasatRon > 0 || showStocNecesarCard) ? (
          <div className="space-y-2">
            <ModuleScoreboard className="gap-x-3.5 gap-y-2">
              {activeComenzi.length + shopActiveCount > 0 ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => setFilterAndTab('de_livrat', 'active')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setFilterAndTab('de_livrat', 'active')
                  }}
                >
                  <span className="text-lg font-extrabold text-[var(--agri-text)]">{activeComenzi.length + shopActiveCount}</span>
                  <span className="ml-1 text-[11px] text-[var(--agri-text-muted)]">active</span>
                </span>
              ) : null}
              {comenziAziCount > 0 ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => setFilterAndTab('de_livrat', 'azi')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setFilterAndTab('de_livrat', 'azi')
                  }}
                >
                  <span className="text-base font-bold text-[var(--status-warning-text)]">{comenziAziCount}</span>
                  <span className="ml-1 text-[11px] text-[var(--agri-text-muted)]">azi</span>
                </span>
              ) : null}
              {comenziRestanteCount > 0 ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => setFilterAndTab('de_livrat', 'restante')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setFilterAndTab('de_livrat', 'restante')
                  }}
                >
                  <span className="text-base font-bold text-[var(--status-danger-text)]">{comenziRestanteCount}</span>
                  <span className="ml-1 text-[11px] text-[var(--agri-text-muted)]">restante</span>
                </span>
              ) : null}
              {neincasatRon > 0 ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => setFilterAndTab('livrate', 'neincasat')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setFilterAndTab('livrate', 'neincasat')
                  }}
                >
                  <span className="text-base font-bold text-[var(--status-warning-text)]">{formatLeiCompact(neincasatRon)}</span>
                  <span className="ml-1 text-[11px] text-[var(--agri-text-muted)]">RON neîncasat</span>
                </span>
              ) : null}
              {totalStocDisponibilKg > 0 ? (
                <span>
                  <span className="text-sm font-semibold text-[var(--success-text)]">{formatKg(totalStocDisponibilKg)}</span>
                  <span className="ml-1 text-[11px] text-[var(--agri-text-muted)]">stoc</span>
                </span>
              ) : null}
            </ModuleScoreboard>

            {showStocNecesarCard ? (
              <StocNecesarCard
                necesarKg={necesarKgTotal}
                stocDisponibilKg={totalStocDisponibilKg}
              />
            ) : null}
          </div>
        ) : null}

        {section === 'comenzi' ? (
        <PillTabs
          value={activeTab}
          onChange={(value) => {
            setActiveTab(value)
            if (value === 'programate') setOrderSort('delivery_date')
            if (value === 'de_livrat' && activeFilter === 'neincasat') setActiveFilter('none')
            if (
              value === 'livrate' &&
              ['azi', 'active', 'restante', 'viitoare'].includes(activeFilter)
            ) {
              setActiveFilter('none')
            }
            if (value === 'programate' && activeFilter === 'neincasat') setActiveFilter('none')
          }}
          activeCount={activeComenzi.length + shopActiveCount}
          scheduledCount={programateCount}
          livrateCount={livrateComenzi.length + shopLivrateCount}
        />
        ) : null}

        {section === 'comenzi' ? (
        <SearchField
          containerClassName="md:hidden"
          placeholder="Caută după client sau telefon..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Caută comenzi"
        />
        ) : null}

        {section === 'comenzi' ? (
        <DesktopToolbar className="hidden md:flex">
          <SearchField
            containerClassName="w-full max-w-md min-w-[200px]"
            placeholder="Caută după client sau telefon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Caută comenzi (desktop)"
          />
        </DesktopToolbar>
        ) : null}

        {section === 'comenzi' ? (
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="comenzi-sort" className="shrink-0 text-xs text-[var(--text-secondary)]">
              Sortează:
            </Label>
            <Select
              value={orderSort}
              onValueChange={(value) => setOrderSort(value as ComenziOrderSort)}
            >
              <SelectTrigger id="comenzi-sort" className="h-9 w-full max-w-[15rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Dată plasare ↑</SelectItem>
                <SelectItem value="created_at_desc">Dată plasare ↓</SelectItem>
                <SelectItem value="delivery_date">Dată livrare</SelectItem>
                <SelectItem value="locality">Localitate / Zonă</SelectItem>
                <SelectItem value="qty_desc">Cantitate ↓</SelectItem>
                <SelectItem value="total_desc">Total lei ↓</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {section === 'comenzi' && (isError || shopOrdersError) ? (
          <ErrorState
            title="Eroare"
            message={((error ?? shopOrdersErrorObj) as Error)?.message ?? 'Nu am putut încărca comenzile.'}
          />
        ) : null}
        {section === 'comenzi' && (isLoading || shopOrdersLoading) ? <EntityListSkeleton /> : null}

        {section === 'comenzi' && !isLoading && !shopOrdersLoading && !isError && !shopOrdersError && unifiedFiltered.length === 0 ? (
          <ModuleEmptyCard
            emoji="📋"
            title="Nicio comandă încă"
            hint="Adaugă prima comandă sau așteaptă comenzi din magazinul online."
          />
        ) : null}

        {section === 'comenzi' && !isLoading && !shopOrdersLoading && !isError && !shopOrdersError && unifiedFiltered.length > 0 ? (
          <>
            <div className="space-y-5 md:hidden">
              {unifiedGroups.map((group) => {
                const units = new Set(group.orders.map((order) => order.quantityUnit))
                const quantityLabel =
                  units.size === 1 ? (units.has('kg') ? 'kg' : 'caserole') : ''
                const necesarKg =
                  activeTab === 'programate'
                    ? group.orders.reduce((sum, item) => sum + getUnifiedOrderNeedKg(item), 0)
                    : undefined
                return (
                  <UnifiedOrderGroupSection
                    key={group.date ?? 'unscheduled'}
                    date={group.date}
                    orderCount={group.orders.length}
                    totalQty={group.totalQty}
                    quantityLabel={quantityLabel}
                    necesarKg={necesarKg}
                    showHeader={showOrderGroupHeaders}
                    scheduledView={activeTab === 'programate'}
                    referenceDate={today}
                  >
                    <div className="space-y-3">
                      {group.orders.map((item) => (
                        <UnifiedOrderCard
                          key={`${item.source}-${item.id}`}
                          item={item}
                          disabled={
                            item.source === 'shop'
                              ? patchShopOrderMutation.isPending
                              : updateMutation.isPending
                          }
                          onOpenB2bDetails={(id) => {
                            const comanda = comenzi.find((row) => row.id === id)
                            if (comanda) setViewing(comanda)
                          }}
                          onB2bStatusChange={(id, status) => {
                            if (status === 'livrata') {
                              const comanda = comenzi.find((row) => row.id === id)
                              if (comanda) void handleConfirmDeliver(comanda)
                              return
                            }
                            updateMutation.mutate({ id, payload: { status } })
                          }}
                          onB2bDeliveryDateChange={(id, data_livrare) => {
                            updateMutation.mutate({ id, payload: { data_livrare } })
                          }}
                          onShopStatusChange={(id, status) => {
                            patchShopOrderMutation.mutate({ id, status })
                          }}
                          onShopConfirmedChange={(id, confirmed) => {
                            patchShopOrderMutation.mutate({ id, notified_wa: confirmed })
                          }}
                          onShopNotifiedChange={(id, notified) => {
                            patchShopOrderMutation.mutate({ id, notified_wa: notified })
                          }}
                          onShopDeliveryDateChange={(id, delivery_date) => {
                            patchShopOrderMutation.mutate({ id, delivery_date })
                          }}
                          onEdit={() => setEditingOrder(item)}
                        />
                      ))}
                    </div>
                  </UnifiedOrderGroupSection>
                )
              })}
            </div>

            <div className="hidden space-y-5 md:block">
              {unifiedGroups.map((group) => {
                const units = new Set(group.orders.map((order) => order.quantityUnit))
                const quantityLabel =
                  units.size === 1 ? (units.has('kg') ? 'kg' : 'caserole') : ''
                const necesarKg =
                  activeTab === 'programate'
                    ? group.orders.reduce((sum, item) => sum + getUnifiedOrderNeedKg(item), 0)
                    : undefined
                return (
                  <UnifiedOrderGroupSection
                    key={group.date ?? 'unscheduled'}
                    date={group.date}
                    orderCount={group.orders.length}
                    totalQty={group.totalQty}
                    quantityLabel={quantityLabel}
                    necesarKg={necesarKg}
                    showHeader={showOrderGroupHeaders}
                    scheduledView={activeTab === 'programate'}
                    referenceDate={today}
                  >
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                      {group.orders.map((item) => (
                        <UnifiedOrderCard
                          key={`${item.source}-${item.id}`}
                          item={item}
                          compact
                          disabled={
                            item.source === 'shop'
                              ? patchShopOrderMutation.isPending
                              : updateMutation.isPending
                          }
                          onOpenB2bDetails={(id) => {
                            const comanda = comenzi.find((row) => row.id === id)
                            if (comanda) setViewing(comanda)
                          }}
                          onB2bStatusChange={(id, status) => {
                            if (status === 'livrata') {
                              const comanda = comenzi.find((row) => row.id === id)
                              if (comanda) void handleConfirmDeliver(comanda)
                              return
                            }
                            updateMutation.mutate({ id, payload: { status } })
                          }}
                          onB2bDeliveryDateChange={(id, data_livrare) => {
                            updateMutation.mutate({ id, payload: { data_livrare } })
                          }}
                          onShopStatusChange={(id, status) => {
                            patchShopOrderMutation.mutate({ id, status })
                          }}
                          onShopConfirmedChange={(id, confirmed) => {
                            patchShopOrderMutation.mutate({ id, notified_wa: confirmed })
                          }}
                          onShopNotifiedChange={(id, notified) => {
                            patchShopOrderMutation.mutate({ id, notified_wa: notified })
                          }}
                          onShopDeliveryDateChange={(id, delivery_date) => {
                            patchShopOrderMutation.mutate({ id, delivery_date })
                          }}
                          onEdit={() => setEditingOrder(item)}
                        />
                      ))}
                    </div>
                  </UnifiedOrderGroupSection>
                )
              })}
            </div>

          </>
        ) : null}
      </DashboardContentShell>

      {editingOrder ? (
        <EditOrderSheet
          open
          order={editingOrder}
          clienti={clienti}
          onOpenChange={(open) => {
            if (!open) setEditingOrder(null)
          }}
          onSaved={() => {
            if (editingOrder.source === 'shop') {
              void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrders })
              void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrdersInLivrare })
              void queryClient.invalidateQueries({ queryKey: queryKeys.shopOrdersInLivrareCount })
            } else {
              void queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
              void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
            }
            setEditingOrder(null)
          }}
        />
      ) : null}

      <ComandaDialog
        key={`create-${isCreateDialogOpen ? 'open' : 'closed'}`}
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAddOpen(false)
            clearComandaFormQueryParams()
            return
          }
          setAddOpen(true)
        }}
        saving={createMutation.isPending}
        clienti={clienti}
        mode="create"
        initialCreateValues={queryCreatePrefill}
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
        magazinGroupLines={viewing && isMagazinPublicOrder(viewing) ? magazinGroupForViewDialog : undefined}
        magazinGroupTotal={
          viewing && isMagazinPublicOrder(viewing) && magazinGroupForViewDialog.length > 0
            ? magazinGroupTotalViewDialog
            : undefined
        }
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

