
'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronDown, Search, UserRoundPlus, X } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import { AppDialog } from '@/components/app/AppDialog'
import { ComenziDinMesajSheet } from './ComenziDinMesajSheet'
import { ComandaFormSummary } from '@/components/comenzi/ComandaFormSummary'
import { ComenziSpeedDial } from './ComenziSpeedDial'
import { EditOrderSheet } from '@/components/comenzi/EditOrderSheet'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Button } from '@/components/ui/button'
import { AppDatePicker } from '@/components/ui/app-date-picker'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DesktopToolbar } from '@/components/ui/desktop'
import { SearchField } from '@/components/ui/SearchField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { UnifiedOrderCard } from '@/components/comenzi/UnifiedOrderCard'
import { PaymentStatusToggle } from '@/components/comenzi/PaymentStatusToggle'
import { ViewComandaDialog } from '@/components/comenzi/ViewComandaDialog'
import { useAddAction } from '@/contexts/AddActionContext'
import { useDashboardAuth } from '@/components/app/DashboardAuthContext'
import { track } from '@/lib/analytics/track'
import { spacing } from '@/lib/design-tokens'
import { createClienți, getClienți, type Client, type ClientDuplicateWarning } from '@/lib/supabase/queries/clienti'
import { getSupabase } from '@/lib/supabase/client'
import { getSellableCal1StockSummary } from '@/lib/supabase/queries/miscari-stoc'
import {
  COMANDA_ORDER_KINDS,
  COMENZI_STATUSES,
  createComanda,
  deleteComanda,
  deliverComanda,
  getComenzi,
  getComenziStockSummaryAzi,
  markComandaIncasata,
  reopenComanda,
  type Comanda,
  type ComandaOrderKind,
  type ComandaPaymentStatus,
  type ComandaStatus,
  updateComanda,
} from '@/lib/supabase/queries/comenzi'
import { getTenantId } from '@/lib/tenant/get-tenant'
import { downloadVCard } from '@/lib/utils/downloadVCard'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'
import { normalizePhoneNumber } from '@/lib/utils/normalize-phone'
import { queryKeys } from '@/lib/query-keys'
import {
  calculateViewportDropdownLayout,
  type ViewportDropdownLayout,
} from '@/lib/ui/viewport-dropdown'
import {
  getMagazinGroupOrders,
  isMagazinPublicOrder,
} from '@/lib/comenzi/magazin-groups'
import {
  planOrderClientPersistence,
  resolveExistingClientByPhone,
  type OrderClientPersistencePlan,
} from '@/lib/comenzi/ai-order-client'
import {
  getUnifiedOrderEffectiveDate,
  getComenziOperationalSnapshot,
  KG_PER_CASEROLĂ,
  groupAllOrdersByDeliveryDate,
  isUnifiedOpenStatus,
  mapB2bToUnified,
  type UnifiedOrderItem,
} from '@/lib/comenzi/unified-orders'
import {
  DELIVERY_ZONES,
  type DeliveryZone,
} from '@/lib/shop/delivery-zones'
import { cn } from '@/lib/utils'

type DashboardFilter = 'none' | 'azi' | 'active' | 'restante' | 'viitoare' | 'neincasat'
type TabKey = 'de_livrat' | 'programate' | 'livrate' | 'toate'
type ComenziOrderSort =
  | 'created_at'
  | 'created_at_desc'
  | 'delivery_date'
  | 'delivery_date_desc'
  | 'locality'
  | 'qty_desc'
  | 'total_desc'

type ComenziOrderGroup = {
  date: string | null
  orders: UnifiedOrderItem[]
  totalQty: number
}

const clientiComenziQueryKey = [...queryKeys.clienti, 'comenzi-dialog'] as const

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

async function checkStocPentruInLivrare(kgNecesar: number): Promise<void> {
  const stoc = await getComenziStockSummaryAzi()
  if (stoc.totalStocDisponibilKg < kgNecesar) {
    throw new StocInsuficientError({
      disponibilKg: round2(stoc.totalStocDisponibilKg),
      totalKg: round2(stoc.totalStocCal1Kg),
      inLivrareKg: round2(stoc.rezervatActivKg + stoc.legacyInLivrareKg),
      necesarKg: round2(kgNecesar),
    })
  }
}

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

type StocInsuficientSnapshot = {
  disponibilKg: number
  totalKg: number
  inLivrareKg: number
  necesarKg: number
  selectionCount?: number
}

class StocInsuficientError extends Error {
  snapshot: StocInsuficientSnapshot

  constructor(snapshot: StocInsuficientSnapshot) {
    super(
      `Stoc insuficient: ai doar ${snapshot.disponibilKg.toFixed(1)} kg cal1 disponibili. ` +
        `Comanda cere ${snapshot.necesarKg.toFixed(1)} kg.`,
    )
    this.name = 'StocInsuficientError'
    this.snapshot = snapshot
  }
}

function parseStocInsuficientError(error: unknown): StocInsuficientSnapshot | null {
  const err = error as { message?: string; details?: string; code?: string }
  const details = err.details ?? ''
  const message = err.message ?? ''
  if (err.code !== 'P0001' && !message.includes('STOC_INSUFICIENT') && !details.includes('necesar=')) {
    return null
  }

  const necesar = details.match(/necesar=([0-9]+(?:\.[0-9]+)?)/)
  const disponibil = details.match(/disponibil=([0-9]+(?:\.[0-9]+)?)/)
  return {
    necesarKg: round2(Number(necesar?.[1] ?? 0)),
    disponibilKg: round2(Number(disponibil?.[1] ?? 0)),
    totalKg: 0,
    inLivrareKg: 0,
  }
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

const orderKindLabelMap: Record<ComandaOrderKind, string> = {
  manual: 'Manual',
  cadou: '🎁 Cadou',
  consum_propriu: '🏠 Consum propriu',
}

const PRET_IMPLICIT_LEI_PER_KG = 35

function getComandaPillClassName(active: boolean) {
  return cn(
    'inline-flex min-h-9 items-center justify-center rounded-full border px-3 text-sm font-medium transition md:min-h-8',
    active
      ? 'border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--success-text)]'
      : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-card-muted)]',
  )
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
  order_kind: ComandaOrderKind
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

function getUnifiedSelectionId(item: UnifiedOrderItem): string {
  return `${item.source}-${item.id}`
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

type OrderPhoneConflict = {
  values: ComandaFormState
  existingName: string
}

function findActiveOrderPhoneConflict({
  orders,
  clienti,
  values,
}: {
  orders: Comanda[]
  clienti: Client[]
  values: ComandaFormState
}): OrderPhoneConflict | null {
  const normalizedPhone = normalizePhoneNumber(values.telefon || '')
  if (!normalizedPhone) return null

  const selectedClientName = values.client_id
    ? clienti.find((client) => client.id === values.client_id)?.nume_client ?? ''
    : ''
  const submittedName = normalize(values.client_nume_manual || selectedClientName)
  if (!submittedName) return null
  const clientMap = Object.fromEntries(clienti.map((client) => [client.id, client])) as Record<string, Client>

  const existingOrder = orders.find((order) => {
    if (!['noua', 'confirmata', 'programata', 'in_livrare'].includes(order.status)) return false
    if (normalizePhoneNumber(order.telefon || '') !== normalizedPhone) return false
    return normalize(getClientName(order, clientMap)) !== submittedName
  })

  if (!existingOrder) return null

  return {
    values,
    existingName: getClientName(existingOrder, clientMap),
  }
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
      return (
        getUnifiedOrderEffectiveDate(a).localeCompare(getUnifiedOrderEffectiveDate(b)) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id)
      )
    case 'delivery_date_desc':
      return (
        getUnifiedOrderEffectiveDate(b).localeCompare(getUnifiedOrderEffectiveDate(a)) ||
        b.createdAt.localeCompare(a.createdAt) ||
        a.id.localeCompare(b.id)
      )
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
    const effectiveDate = getUnifiedOrderEffectiveDate(order)
    const current = byDate.get(effectiveDate) ?? []
    current.push(order)
    byDate.set(effectiveDate, current)
  }

  const today = todayIso()

  return [...byDate.entries()]
    .sort(([dateA], [dateB]) => {
      if (sort === 'delivery_date_desc') return dateB.localeCompare(dateA)

      // Restanțele se văd primele, apoi livrările de azi și cele viitoare.
      const priorityA = dateA < today ? 0 : dateA === today ? 1 : 2
      const priorityB = dateB < today ? 0 : dateB === today ? 1 : 2
      return priorityA - priorityB || dateA.localeCompare(dateB)
    })
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

function defaultFormState(status: ComandaStatus = 'noua'): ComandaFormState {
  return {
    client_id: '',
    client_nume_manual: '',
    telefon: '',
    locatie_livrare: '',
    data_comanda: todayIso(),
    data_livrare: todayIso(),
    cantitate_kg: '',
    pret_per_kg: String(PRET_IMPLICIT_LEI_PER_KG),
    order_kind: 'manual',
    status,
    observatii: '',
  }
}

function buildComandaDialogInitialFormState(params: {
  initial?: Comanda | null
  initialCreateValues?: Partial<ComandaFormState> | null
  clienti: Client[]
}): ComandaFormState {
  const { initial, initialCreateValues, clienti } = params
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
        order_kind: initial.order_kind ?? 'manual',
        status: initial.status,
        observatii: initial.observatii ?? '',
      }
    : {
        ...defaultFormState('confirmata'),
        ...(initialCreateValues ?? {}),
      }

  const prefillClientId = baseForm.client_id
  const client = prefillClientId ? clienti.find((item) => item.id === prefillClientId) : undefined
  const isZeroPriceOrder =
    baseForm.order_kind === 'cadou' || baseForm.order_kind === 'consum_propriu'
  const normalizedPrice = isZeroPriceOrder
    ? '0'
    : !initial && !baseForm.pret_per_kg.trim()
      ? String(PRET_IMPLICIT_LEI_PER_KG)
      : baseForm.pret_per_kg

  return {
    ...baseForm,
    client_id: prefillClientId,
    client_nume_manual: prefillClientId ? '' : baseForm.client_nume_manual,
    telefon: client?.telefon || baseForm.telefon,
    locatie_livrare: client?.adresa || baseForm.locatie_livrare,
    pret_per_kg: normalizedPrice,
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
    order_kind: 'manual',
    observatii,
    status: 'confirmata',
  }
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

function PillTabs({
  value,
  onChange,
  onOpenCampaign,
  activeCount,
  scheduledCount,
  livrateCount,
  receivableCount,
  receivableTotal,
  receivablesActive,
  onOpenReceivables,
}: {
  value: TabKey
  onChange: (value: TabKey) => void
  onOpenCampaign: () => void
  activeCount: number
  scheduledCount: number
  livrateCount: number
  receivableCount: number
  receivableTotal: number
  receivablesActive: boolean
  onOpenReceivables: () => void
}) {
  const tabs = [
    { key: 'de_livrat' as const, label: `Active${activeCount > 0 ? ` ${activeCount}` : ''}` },
    { key: 'programate' as const, label: `Progr.${scheduledCount > 0 ? ` ${scheduledCount}` : ''}` },
    { key: 'livrate' as const, label: `Livr.${livrateCount > 0 ? ` ${livrateCount}` : ''}` },
    { key: 'toate' as const, label: 'Toate' },
  ]
  return (
    <ModulePillRow className="grid grid-cols-3 gap-2">
      {tabs.map((tab) => (
        <ModulePillFilterButton
          key={tab.key}
          active={value === tab.key}
          onClick={() => onChange(tab.key)}
          className="inline-flex min-h-11 w-full items-center justify-center whitespace-normal px-2 text-center leading-tight"
        >
          {tab.label}
        </ModulePillFilterButton>
      ))}
      <ModulePillFilterButton
        active={receivablesActive}
        onClick={onOpenReceivables}
        className="inline-flex min-h-11 w-full items-center justify-center whitespace-normal px-2 text-center leading-tight"
      >
        De încasat
        {receivableCount > 0
          ? ` ${receivableCount} · ${formatLeiCompact(receivableTotal)} lei`
          : ''}
      </ModulePillFilterButton>
      <ModulePillFilterButton
        active={false}
        onClick={onOpenCampaign}
        className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 px-2"
      >
        <span aria-hidden="true">🎯</span>
        <span>Campanie</span>
      </ModulePillFilterButton>
    </ModulePillRow>
  )
}

function ComandaDeliveryDialog({
  order,
  pending,
  onConfirm,
  onOpenChange,
}: {
  order: UnifiedOrderItem | null
  pending: boolean
  onConfirm: (quantityKg: number, statusPlata: ComandaPaymentStatus) => void
  onOpenChange: (open: boolean) => void
}) {
  const totalKg = order ? round2(getUnifiedOrderNeedKg(order)) : 0
  const [quantity, setQuantity] = useState(() => String(totalKg || ''))
  const [statusPlata, setStatusPlata] = useState<ComandaPaymentStatus>('platit')
  const deliveredKg = round2(Number(quantity))
  const validQuantity =
    Number.isFinite(deliveredKg) &&
    deliveredKg > 0 &&
    deliveredKg <= totalKg
  const estimatedTotal =
    totalKg > 0 ? round2((Number(order?.totalLei || 0) * deliveredKg) / totalKg) : 0

  return (
    <AlertDialog open={order !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md pb-[max(1rem,env(safe-area-inset-bottom))]">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmă livrarea</AlertDialogTitle>
          <AlertDialogDescription>
            Livrarea creează o singură vânzare pentru cantitatea confirmată. Restul rămâne într-o comandă separată.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="comanda-delivered-quantity">Cantitate livrată</Label>
            <div className="flex items-center gap-2">
              <Input
                id="comanda-delivered-quantity"
                type="number"
                min={0.1}
                max={totalKg}
                step={0.1}
                value={quantity}
                disabled={pending}
                onChange={(event) => setQuantity(event.target.value)}
                className="h-12 tabular-nums"
              />
              <span className="shrink-0 text-sm font-semibold text-[var(--text-secondary)]">kg</span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">
              Din {formatKg(totalKg)} · {formatLei(estimatedTotal)}
            </p>
          </div>

          <PaymentStatusToggle
            value={statusPlata}
            onChange={setStatusPlata}
            disabled={pending}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Anulează</AlertDialogCancel>
          <Button
            type="button"
            disabled={!validQuantity || pending}
            className="min-h-11 bg-[var(--agri-primary)] text-white"
            onClick={() => onConfirm(deliveredKg, statusPlata)}
          >
            {pending ? 'Se salvează...' : 'Marchează livrată'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function UnifiedOrderGroupSection({
  date,
  orderCount,
  quantitySummary,
  necesarKg,
  totalKg,
  showHeader = true,
  scheduledView = false,
  referenceDate,
  children,
}: {
  date: string | null
  orderCount: number
  quantitySummary: string
  necesarKg?: number
  totalKg?: number
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
          month: 'short',
          timeZone: 'UTC',
        }).format(new Date(`${date}T12:00:00.000Z`)).replace(/\./g, '')
      : 'Comenzi'
  const relativeLabel =
    scheduledView && date
      ? getRelativeScheduledLabel(date, referenceDate)
      : null
  const label =
    scheduledView && date
      ? `📅 ${relativeLabel === 'Azi' ? 'Azi' : baseLabel}`
      : baseLabel
  const showNecesarKg =
    typeof necesarKg === 'number' &&
    necesarKg > 0 &&
    typeof totalKg === 'number' &&
    Math.abs(necesarKg - totalKg) >= 0.05

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
          {quantitySummary ? ` · ${quantitySummary}` : ''}
          {showNecesarKg ? ` · ${formatKgOneDecimal(necesarKg)} necesari` : ''}
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
  const diferentaKg = Math.abs(stocDisponibilKg - necesarKg)

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
            Ai nevoie de {formatKgOneDecimal(necesarKg)}, ai disponibil{' '}
            {formatKgOneDecimal(stocDisponibilKg)}.{' '}
            {hasEnoughStock
              ? `Surplus: ${formatKgOneDecimal(diferentaKg)}.`
              : `Lipsesc: ${formatKgOneDecimal(diferentaKg)}.`}
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
      }),
    [clienti, initial, initialCreateValues]
  )
  const initialComboInput = useMemo(
    () => buildComandaDialogInitialComboInput(initialFormState, clienti),
    [clienti, initialFormState]
  )
  const [form, setForm] = useState<ComandaFormState>(initialFormState)
  const [comboInput, setComboInput] = useState(initialComboInput)
  const [comboOpen, setComboOpen] = useState(false)
  const [mobileObservatiiOpen, setMobileObservatiiOpen] = useState(false)
  const [hasEditedManualPrice, setHasEditedManualPrice] = useState(false)
  const comboRef = useRef<HTMLDivElement>(null)
  const comboInputRef = useRef<HTMLInputElement>(null)
  const comboDropdownRef = useRef<HTMLDivElement>(null)
  const [comboDropdownLayout, setComboDropdownLayout] = useState<ViewportDropdownLayout | null>(null)
  const lastManualPriceRef = useRef(
    initialFormState.pret_per_kg && initialFormState.pret_per_kg !== '0'
      ? initialFormState.pret_per_kg
      : String(PRET_IMPLICIT_LEI_PER_KG),
  )

  // Logica vizibilitate câmpuri per tip comandă
  const isCadou = form.order_kind === 'cadou'
  const isManual = form.order_kind === 'manual'
  const showClientFields = isManual || isCadou
  const showDeliveryFields = isManual
  const showPriceField = isManual

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

  const updateComboDropdownLayout = useCallback(() => {
    const input = comboInputRef.current
    if (!input) return

    const rect = input.getBoundingClientRect()
    const visualViewport = window.visualViewport
    const viewportTop = visualViewport?.offsetTop ?? 0
    const viewportLeft = visualViewport?.offsetLeft ?? 0
    setComboDropdownLayout(
      calculateViewportDropdownLayout(rect, {
        top: viewportTop,
        left: viewportLeft,
        height: visualViewport?.height ?? window.innerHeight,
        width: visualViewport?.width ?? window.innerWidth,
        layoutHeight: window.innerHeight,
      }),
    )
  }, [])

  useEffect(() => {
    const handleOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node
      if (!comboRef.current?.contains(target) && !comboDropdownRef.current?.contains(target)) {
        setComboOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleOutsideClick)
    return () => document.removeEventListener('pointerdown', handleOutsideClick)
  }, [])

  useEffect(() => {
    if (!comboOpen) return

    let animationFrame = window.requestAnimationFrame(updateComboDropdownLayout)
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(updateComboDropdownLayout)
    }
    const visualViewport = window.visualViewport
    const resizeObserver = new ResizeObserver(scheduleUpdate)

    if (comboInputRef.current) resizeObserver.observe(comboInputRef.current)
    window.addEventListener('resize', scheduleUpdate)
    window.addEventListener('scroll', scheduleUpdate, true)
    visualViewport?.addEventListener('resize', scheduleUpdate)
    visualViewport?.addEventListener('scroll', scheduleUpdate)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
      window.removeEventListener('scroll', scheduleUpdate, true)
      visualViewport?.removeEventListener('resize', scheduleUpdate)
      visualViewport?.removeEventListener('scroll', scheduleUpdate)
    }
  }, [comboInput, comboOpen, updateComboDropdownLayout])

  const handleCreateOrderKindChange = useCallback(
    (nextOrderKind: ComandaOrderKind) => {
      setForm((prev) => {
        const currentPrice = prev.pret_per_kg.trim()
        if (prev.order_kind === 'manual' && currentPrice && currentPrice !== '0') {
          lastManualPriceRef.current = currentPrice
        }

        const nextIsZeroPrice =
          nextOrderKind === 'cadou' || nextOrderKind === 'consum_propriu'
        const nextManualPrice = nextIsZeroPrice
          ? '0'
          : lastManualPriceRef.current ||
            (!hasEditedManualPrice ? String(PRET_IMPLICIT_LEI_PER_KG) : prev.pret_per_kg)

        return {
          ...prev,
          order_kind: nextOrderKind,
          pret_per_kg: nextManualPrice,
          status: mode === 'create' ? 'confirmata' : prev.status,
        }
      })
    },
    [hasEditedManualPrice, mode],
  )

  const keepMobileFieldVisible = useCallback((element: HTMLElement) => {
    if (!window.matchMedia('(max-width: 767px)').matches) return
    window.setTimeout(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
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
      description={mode === 'edit' ? 'Actualizezi datele comenzii fără să schimbi fluxul existent de client și livrare.' : undefined}
      desktopFormWide
      showCloseButton
      mobileFullHeight
      contentClassName="md:w-[min(96vw,76rem)] md:max-w-none md:max-h-[min(92dvh,54rem)] lg:w-[min(94vw,78rem)]"
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
          <DesktopFormPanel className="space-y-2 md:space-y-2">

            {/* ── 1. Tip comandă — primul câmp ── */}
            <div className="space-y-1">
              <Label>Tip comandă</Label>
              {mode === 'create' ? (
                <div className="flex flex-wrap gap-1.5">
                  {COMANDA_ORDER_KINDS.map((orderKind) => (
                    <button
                      key={orderKind}
                      type="button"
                      aria-pressed={form.order_kind === orderKind}
                      className={getComandaPillClassName(form.order_kind === orderKind)}
                      onClick={() => handleCreateOrderKindChange(orderKind)}
                    >
                      {orderKindLabelMap[orderKind]}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-11 items-center rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 text-sm font-medium text-[var(--text-primary)] md:min-h-10">
                  {orderKindLabelMap[form.order_kind]}
                </div>
              )}
            </div>

            {/* ── 2. Câmpuri client (Manual + Cadou) ── */}
            {showClientFields ? (
              <>
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
                  className={`space-y-1 ${selectedClient ? 'hidden md:block' : ''}`}
                >
                  <Label htmlFor="comanda_client_combo">
                    Client{isCadou ? ' (opțional)' : ''}
                  </Label>
                  <div className="relative">
                    <Input
                      ref={comboInputRef}
                      id="comanda_client_combo"
                      className="agri-control h-10 md:h-9"
                      placeholder={isCadou ? 'Nume beneficiar (opțional)...' : 'Caută după nume sau telefon...'}
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
                    {comboOpen && comboDropdownLayout
                      ? createPortal(
                          <div
                            ref={comboDropdownRef}
                            role="listbox"
                            aria-label="Sugestii clienți"
                            className="pointer-events-auto fixed z-[1100] overflow-y-auto overscroll-contain rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] shadow-[var(--shadow-elevated)]"
                            style={comboDropdownLayout}
                          >
                            {comboFiltered.length === 0 ? (
                              <p className="px-3 py-2 text-sm text-[var(--text-secondary)]">
                                Niciun client găsit
                              </p>
                            ) : (
                              comboFiltered.map((client) => (
                                <button
                                  key={client.id}
                                  type="button"
                                  className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-sm hover:bg-[var(--soft-success-bg)]"
                                  onClick={() => {
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
                                  <span className="font-medium text-[var(--text-primary)]">
                                    {client.nume_client}
                                  </span>
                                  {client.telefon ? (
                                    <span className="text-[var(--text-secondary)]">— {client.telefon}</span>
                                  ) : null}
                                </button>
                              ))
                            )}
                            <button
                              type="button"
                              className="flex w-full items-center gap-1.5 border-t border-[var(--divider)] px-3 py-2.5 text-left text-sm font-medium text-[var(--success-text)] hover:bg-[var(--success-bg)]"
                              onClick={() => {
                                setComboOpen(false)
                                setForm((prev) => ({
                                  ...prev,
                                  client_id: '',
                                  client_nume_manual: comboInput,
                                }))
                              }}
                            >
                              ➕ Client nou — completează manual
                            </button>
                          </div>,
                          document.body,
                        )
                      : null}
                  </div>
                </div>

                {/* Telefon + buton vCard — doar Manual */}
                {showDeliveryFields ? (
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-3 md:gap-y-2">
                    <div className="space-y-1">
                      <Label>Telefon</Label>
                      <Input
                        className="agri-control h-10 md:h-9"
                        value={resolvedPhone}
                        onChange={(e) => setForm((prev) => ({ ...prev, telefon: e.target.value }))}
                      />
                    </div>
                    {isNewClientFlow ? (
                      <div className="space-y-1 md:min-w-[148px]">
                        <Label className="opacity-0">Contact</Label>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-10 w-full whitespace-nowrap rounded-xl px-3 text-xs sm:text-sm md:h-9"
                          disabled={!canSaveContact}
                          onClick={() => saveContactAsVCard(suggestedClientName, resolvedPhone)}
                        >
                          <UserRoundPlus className="h-4 w-4" />
                          Salvează contact
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

              </>
            ) : null}

            {/* ── 3. Cantitate (mereu) + Preț (doar Manual) ── */}
            <div
              className={cn(
                'grid grid-cols-1 gap-2 md:gap-x-3 md:gap-y-2',
                showPriceField && showDeliveryFields
                  ? 'md:grid-cols-3'
                  : showPriceField
                  ? 'md:grid-cols-2'
                  : 'md:grid-cols-1',
              )}
            >
              <div className="space-y-1">
                <Label>Cantitate (kg)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="agri-control h-10 md:h-9"
                  value={form.cantitate_kg}
                  onChange={(e) => setForm((prev) => ({ ...prev, cantitate_kg: e.target.value }))}
                />
              </div>
              {showPriceField ? (
                <div className="space-y-1">
                  <Label>Preț per kg</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    className={cn(
                      'agri-control h-10 md:h-9',
                      mode === 'create' && isManual
                        ? 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] placeholder:text-[var(--status-danger-text)]'
                        : '',
                    )}
                    value={form.pret_per_kg}
                    onChange={(e) => {
                      const nextValue = e.target.value
                      if (mode === 'create') {
                        setHasEditedManualPrice(true)
                        if (nextValue.trim() && nextValue.trim() !== '0') {
                          lastManualPriceRef.current = nextValue
                        }
                      }
                      setForm((prev) => ({ ...prev, pret_per_kg: nextValue }))
                    }}
                  />
                  {mode === 'create' && isManual ? (
                    <p className="text-xs font-medium text-[var(--status-danger-text)]">
                      Implicit {PRET_IMPLICIT_LEI_PER_KG} lei — ajustează dacă e altul.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {showDeliveryFields ? (
                <div className="hidden md:block">
                  <AppDatePicker
                    id="comanda-data-livrare"
                    label="Data livrare"
                    placeholder="Selectează data"
                    value={form.data_livrare}
                    triggerClassName="h-10 md:h-9"
                    onChange={(nextValue) =>
                      setForm((prev) => ({ ...prev, data_livrare: nextValue }))
                    }
                  />
                </div>
              ) : null}
            </div>

            {/* Preview total — doar Manual, mobil */}
            {showPriceField ? (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card-muted)] px-3 py-2.5 text-sm md:hidden">
                <span className="text-[var(--text-secondary)]">
                  {formatKg(previewKg)} × {formatLei(previewPret)}/kg
                </span>
                <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                  Total: {formatLei(previewTotal)}
                </span>
              </div>
            ) : null}

            {/* ── 4. Câmpuri livrare (doar Manual) ── */}
            {showDeliveryFields ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="comanda_locatie">
                    <span>Localitate / Adresă</span>{' '}
                    <span className="text-xs font-normal text-[var(--text-secondary)]">
                      (opțional — știi deja unde livrezi)
                    </span>
                  </Label>
                  <Input
                    id="comanda_locatie"
                    className="agri-control h-10 md:h-9"
                    placeholder="ex: Suceava, str. Unirii 12"
                    value={form.locatie_livrare}
                    onChange={(e) => setForm((prev) => ({ ...prev, locatie_livrare: e.target.value }))}
                  />
                </div>

                {/* Data livrare — mobil */}
                <div className="space-y-1.5 md:hidden">
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
              </>
            ) : null}

            {/* ── 5. Status — Manual: create + edit; Cadou: doar edit ── */}
            {mode === 'edit' ? (
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as ComandaStatus }))}
                >
                  <SelectTrigger className="agri-control h-10 md:h-9">
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
            ) : null}

            {/* ── 6. Observații — mereu vizibil ── */}
            <div className="hidden space-y-1 md:block">
              <Label>Observații</Label>
              <Textarea
                className="agri-control min-h-[2.75rem] md:min-h-[2.25rem]"
                value={form.observatii}
                onFocus={(event) => keepMobileFieldVisible(event.currentTarget)}
                onChange={(e) => setForm((prev) => ({ ...prev, observatii: e.target.value }))}
              />
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
                  className="agri-control min-h-[3rem]"
                  value={form.observatii}
                  onFocus={(event) => keepMobileFieldVisible(event.currentTarget)}
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
  const { memberRole, accessLevel } = useDashboardAuth()
  const isDesktop = useMediaQuery('(min-width: 768px)')
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
  const [orderSort, setOrderSort] = useState<ComenziOrderSort>(() =>
    initialTab === 'programate' ? 'delivery_date' : 'created_at',
  )
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [speedDialOpen, setSpeedDialOpen] = useState(false)
  const [dinMesajOpen, setDinMesajOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Comanda | null>(null)
  const [editingOrder, setEditingOrder] = useState<UnifiedOrderItem | null>(null)
  const [deliveryTarget, setDeliveryTarget] = useState<UnifiedOrderItem | null>(null)
  const [deleting, setDeleting] = useState<Comanda | null>(null)
  const [reopening, setReopening] = useState<Comanda | null>(null)
  const [viewing, setViewing] = useState<Comanda | null>(null)
  const [contactPrompt, setContactPrompt] = useState<ContactPrompt | null>(null)
  const [clientPrefill, setClientPrefill] = useState<ContactPrompt | null>(null)
  const [addClientOpen, setAddClientOpen] = useState(false)
  const [stocInsuficientModal, setStocInsuficientModal] = useState<StocInsuficientSnapshot | null>(null)
  const [orderPhoneConflict, setOrderPhoneConflict] = useState<OrderPhoneConflict | null>(null)
  const [duplicatePhoneFormPatch, setDuplicatePhoneFormPatch] = useState<{ token: number; values: ComandaFormState } | null>(null)
  const isOperator = memberRole === 'operator'
  const canWriteComenzi = !isOperator || accessLevel === 'write'
  const canDeleteComenzi = !isOperator
  const addFromQuery = searchParams.get('add') === '1'
  const openFormFromQuery = hasAiComandaOpenForm(searchParams)
  const queryCreatePrefill = useMemo(
    () => (openFormFromQuery ? parseAiComandaPrefill(searchParams) : null),
    [openFormFromQuery, searchParams]
  )
  const isCreateDialogOpen = canWriteComenzi && (addOpen || addFromQuery || openFormFromQuery)

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

  const guardStocPentruInLivrare = useCallback(async (kgNecesar: number, options?: { selectionCount?: number }) => {
    try {
      await checkStocPentruInLivrare(kgNecesar)
      return true
    } catch (err) {
      if (err instanceof StocInsuficientError) {
        hapticError()
        setStocInsuficientModal({
          ...err.snapshot,
          selectionCount: options?.selectionCount,
        })
        return false
      }
      toast.error(err instanceof Error ? err.message : 'Nu am putut verifica stocul disponibil.')
      return false
    }
  }, [])

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
    queryKey: clientiComenziQueryKey,
    queryFn: getClienți,
  })

  const {
    data: stocSummary = {
      recoltatCal1Kg: 0,
      consumatDefinitivCal1Kg: 0,
      rezervatActivCal1Kg: 0,
      legacyInLivrareFaraRezervareKg: 0,
      stocCal1LedgerKg: 0,
      disponibilCal1Kg: 0,
    },
  } = useQuery({
    queryKey: queryKeys.stocGlobalCal1,
    queryFn: getSellableCal1StockSummary,
  })

  const clientMap = useMemo(() => {
    const map: Record<string, Client> = {}
    clienti.forEach((client) => {
      map[client.id] = client
    })
    return map
  }, [clienti])

  const createAndAttachClientToOrder = useCallback(async (params: {
    comandaId: string
    input: Parameters<typeof createClienți>[0]
  }) => {
    const { comandaId, input } = params

    const createdClient = await createClienți(input)

    const supabase = getSupabase()
    const tenantId = await getTenantId(supabase)
    const { error: updateError } = await supabase
      .from('comenzi')
      .update({ client_id: createdClient.id })
      .eq('id', comandaId)
      .eq('tenant_id', tenantId)

    if (updateError) {
      throw updateError
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
    queryClient.invalidateQueries({ queryKey: clientiComenziQueryKey })
    queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
  }, [queryClient])

  const createMutation = useMutation({
    mutationFn: ({ payload }: { payload: Parameters<typeof createComanda>[0]; clientPersistencePlan: OrderClientPersistencePlan }) =>
      createComanda(payload),
    onSuccess: async (createdComanda, variables) => {
      clearComandaFormQueryParams()
      queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
      queryClient.invalidateQueries({ queryKey: queryKeys.comenziManualInLivrare })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobalCal1 })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocuriLocatiiRoot })
      queryClient.invalidateQueries({ queryKey: queryKeys.miscariStoc })
      track('comanda_add', {
        cantitate: Number(variables.payload.cantitate_kg || 0),
        client_id: variables.payload.client_id ?? null,
      })
      hapticSuccess()
      const matchedClientName = variables.payload.client_id ? clientMap[variables.payload.client_id]?.nume_client ?? '' : ''
      const clientName = (variables.payload.client_nume_manual || matchedClientName || '').trim()
      const phone = (variables.payload.telefon ?? '').trim()
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
      setDuplicatePhoneFormPatch(null)

      if (variables.clientPersistencePlan.action === 'create-new') {
        try {
          await createAndAttachClientToOrder({
            comandaId: createdComanda.id,
            input: variables.clientPersistencePlan.input,
          })
          toast.success('Comanda și clientul au fost salvate.')
        } catch (error) {
          console.error('[comenzi] Clientul nu a putut fi creat după salvarea comenzii.', error)
          toast.warning('Comanda a fost salvată, dar clientul nu a putut fi creat.')
        }
      }
    },
    onError: (err: Error) => {
      hapticError()
      const stockSnapshot = parseStocInsuficientError(err)
      if (stockSnapshot) {
        setStocInsuficientModal(stockSnapshot)
        return
      }
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
    onMutate: async (variables) => {
      if (!variables.payload.status) return { previousComenzi: undefined }

      await queryClient.cancelQueries({ queryKey: queryKeys.comenzi })
      const previousComenzi = queryClient.getQueryData<Comanda[]>(queryKeys.comenzi)
      queryClient.setQueryData<Comanda[]>(queryKeys.comenzi, (current = []) =>
        current.map((comanda) =>
          comanda.id === variables.id
            ? { ...comanda, status: variables.payload.status as ComandaStatus }
            : comanda,
        ),
      )
      return { previousComenzi }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
      queryClient.invalidateQueries({ queryKey: queryKeys.comenziManualInLivrare })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobalCal1 })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocuriLocatiiRoot })
      queryClient.invalidateQueries({ queryKey: queryKeys.miscariStoc })
      track('comanda_edit', { id: variables.id })
      hapticSuccess()
      if (variables.payload.status === 'in_livrare') {
        const movedOrder = comenzi.find((comanda) => comanda.id === variables.id)
        const movedName = movedOrder ? getClientName(movedOrder, clientMap) : 'Comanda'
        toast.success(`${movedName} mutată în Livrări ✓`)
      } else {
        toast.success('Comanda actualizată')
      }
      setEditing(null)
    },
    onError: (err: Error, _variables, context) => {
      if (context?.previousComenzi) {
        queryClient.setQueryData(queryKeys.comenzi, context.previousComenzi)
      }
      hapticError()
      const stockSnapshot = parseStocInsuficientError(err)
      if (stockSnapshot) {
        setStocInsuficientModal(stockSnapshot)
        return
      }
      toast.error(err.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteComanda,
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
      queryClient.invalidateQueries({ queryKey: queryKeys.comenziManualInLivrare })
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
      queryClient.invalidateQueries({ queryKey: clientiComenziQueryKey })
      hapticSuccess()
      toast.success('Client salvat')
      setAddClientOpen(false)
      setClientPrefill(null)
      setContactPrompt(null)
    },
    onError: (err: Error) => {
      hapticError()
      const stockSnapshot = parseStocInsuficientError(err)
      if (stockSnapshot) {
        setStocInsuficientModal(stockSnapshot)
        return
      }
      toast.error(err.message)
    },
  })

  const deliverMutation = useMutation({
    mutationFn: ({
      comandaId,
      cantitateLivrataKg,
      statusPlata,
      dataLivrareRamasa,
    }: {
      comandaId: string
      cantitateLivrataKg: number
      statusPlata: ComandaPaymentStatus
      dataLivrareRamasa: string | null
    }) =>
      deliverComanda({ comandaId, cantitateLivrataKg, statusPlata, dataLivrareRamasa }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
      queryClient.invalidateQueries({ queryKey: queryKeys.comenziManualInLivrare })
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzari })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobal })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocGlobalCal1 })
      queryClient.invalidateQueries({ queryKey: queryKeys.stocuriLocatiiRoot })
      queryClient.invalidateQueries({ queryKey: queryKeys.miscariStoc })
      hapticSuccess()
      toast('Comandă livrată! Vânzare creată.')
      if (result.remainingOrder) {
        toast(
          `Comandă parțială: a rămas ${result.remainingOrder.cantitate_kg} kg — comandă nouă creată.`,
        )
      }
      setDeliveryTarget(null)

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
      const stockSnapshot = parseStocInsuficientError(err)
      if (stockSnapshot) {
        setStocInsuficientModal(stockSnapshot)
        return
      }
      toast.error(err.message)
    },
  })

  const markPaidMutation = useMutation({
    mutationFn: markComandaIncasata,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
      void queryClient.invalidateQueries({ queryKey: queryKeys.vanzari })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      hapticSuccess()
      toast.success('Plata a fost marcată ca încasată.')
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
      queryClient.invalidateQueries({ queryKey: queryKeys.comenziManualInLivrare })
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

  useEffect(() => {
    if (!canWriteComenzi) return
    const unregister = registerAddAction(() => {
      if (isDesktop) {
        setSpeedDialOpen(false)
        setAddOpen(true)
        return
      }
      setSpeedDialOpen(true)
    }, 'Adaugă comandă')
    return unregister
  }, [canWriteComenzi, isDesktop, registerAddAction])

  useEffect(() => {
    const query = search.trim()
    if (!query) return

    const timer = setTimeout(() => {
      track('search', { module: 'comenzi', query })
    }, 500)

    return () => clearTimeout(timer)
  }, [search])

  const scheduleDelete = (comanda: Comanda) => {
    if (!canDeleteComenzi) {
      toast.error('Operatorii nu pot șterge comenzi.')
      return
    }
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
  const manualComenzi = comenzi
  const livrateComenzi = useMemo(
    () => manualComenzi.filter((item) => item.status === 'livrata'),
    [manualComenzi],
  )
  const operationalSnapshot = useMemo(
    () => getComenziOperationalSnapshot(comenzi),
    [comenzi],
  )

  const livrateNeincasate = useMemo(() => {
    return comenzi
      .filter(
        (comanda) =>
          comanda.status === 'livrata' &&
          comanda.linked_vanzare?.status_plata === 'neplatit',
      )
      .map((comanda) => ({
        comanda,
        amount: Number(comanda.total || 0),
      }))
  }, [comenzi])

  const neincasatComandaIds = useMemo(() => new Set(livrateNeincasate.map((item) => item.comanda.id)), [livrateNeincasate])
  const neincasatRon = useMemo(() => livrateNeincasate.reduce((sum, item) => sum + item.amount, 0), [livrateNeincasate])
  const unifiedAllOrders = useMemo(
    () => comenzi.map((item) => mapB2bToUnified(item, clientMap)),
    [clientMap, comenzi],
  )

  const comenziAziCount = useMemo(
    () =>
      unifiedAllOrders.filter(
        (item) =>
          isUnifiedOpenStatus(item.status) &&
          getUnifiedOrderEffectiveDate(item) === today,
      ).length,
    [today, unifiedAllOrders],
  )
  const comenziRestanteCount = useMemo(
    () =>
      unifiedAllOrders.filter(
        (item) =>
          isUnifiedOpenStatus(item.status) &&
          getUnifiedOrderEffectiveDate(item) < today,
      ).length,
    [today, unifiedAllOrders],
  )
  const programateCount = useMemo(
    () =>
      unifiedAllOrders.filter(
        (item) =>
          item.status === 'programata' &&
          Boolean(getUnifiedOrderEffectiveDate(item)),
      ).length,
    [unifiedAllOrders],
  )

  const totalStocDisponibilKg = Number(stocSummary.disponibilCal1Kg || 0)
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
      if (activeTab === 'de_livrat' && item.status !== 'noua' && item.status !== 'confirmata') return false
      if (activeTab === 'programate') {
        if (item.status === 'in_livrare') return false
        if (item.status !== 'programata' || !getUnifiedOrderEffectiveDate(item)) return false
      }
      if (activeTab === 'livrate' && item.status !== 'livrata') return false
      if (
        activeFilter === 'azi' &&
        !(
          isUnifiedOpenStatus(item.status) &&
          getUnifiedOrderEffectiveDate(item) === today
        )
      ) {
        return false
      }
      if (activeFilter === 'active' && !isUnifiedOpenStatus(item.status)) return false
      if (
        activeFilter === 'restante' &&
        !(
          isUnifiedOpenStatus(item.status) &&
          getUnifiedOrderEffectiveDate(item) < today
        )
      ) {
        return false
      }
      if (
        activeFilter === 'viitoare' &&
        !(
          isUnifiedOpenStatus(item.status) &&
          getUnifiedOrderEffectiveDate(item) > today
        )
      ) {
        return false
      }

      if (
        activeFilter === 'neincasat' &&
        !(item.status === 'livrata' && neincasatComandaIds.has(item.id))
      ) return false

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
    if (tab !== 'programate' && orderSort === 'delivery_date_desc') {
      setOrderSort('created_at')
    }
    if (tab === 'de_livrat') setOrderSort('created_at')
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

  const handleConfirmDeliver = (comanda: Comanda) => {
    if (!canWriteComenzi) {
      toast.error('Ai acces doar pentru citire în Comenzi.')
      return
    }
    setDeliveryTarget(mapB2bToUnified(comanda, clientMap))
  }

  const handleDeliveryDialogConfirm = (
    cantitateLivrataKg: number,
    statusPlata: ComandaPaymentStatus,
  ) => {
    if (!deliveryTarget) return

    if (deliveryTarget.b2bComanda) {
      deliverMutation.mutate({
        comandaId: deliveryTarget.b2bComanda.id,
        cantitateLivrataKg,
        statusPlata,
        dataLivrareRamasa: null,
      })
    }
  }

  const handleMarkPaid = async (comandaId: string) => {
    if (!canWriteComenzi) {
      toast.error('Ai acces doar pentru citire în Comenzi.')
      throw new Error('Acces read-only')
    }
    await markPaidMutation.mutateAsync(comandaId)
  }

  const handleB2bStatusChange = async (id: string, status: ComandaStatus) => {
    if (!canWriteComenzi) {
      toast.error('Ai acces doar pentru citire în Comenzi.')
      throw new Error('Acces read-only')
    }
    if (status === 'livrata') {
      const comanda = comenzi.find((row) => row.id === id)
      if (comanda) handleConfirmDeliver(comanda)
      return
    }
    if (status === 'in_livrare') {
      const comanda = comenzi.find((row) => row.id === id)
      const kgNecesar = Number(comanda?.cantitate_kg ?? 0)
      const canContinue = await guardStocPentruInLivrare(kgNecesar)
      if (!canContinue) {
        throw new Error('Stoc insuficient')
      }
    }
    await updateMutation.mutateAsync({ id, payload: { status } })
  }

  const submitNewOrder = async (values: ComandaFormState, allowDifferentName = false) => {
    const cantitate = Number(values.cantitate_kg)
    const zeroPriceOrder = values.order_kind === 'cadou' || values.order_kind === 'consum_propriu'
    const pret = zeroPriceOrder ? 0 : Number(values.pret_per_kg)
    if (!Number.isFinite(cantitate) || cantitate <= 0) {
      hapticError()
      toast.error('Cantitatea trebuie să fie mai mare decât 0.')
      return
    }
    if (!Number.isFinite(pret) || pret < 0 || (!zeroPriceOrder && pret <= 0)) {
      hapticError()
      toast.error(zeroPriceOrder ? 'Prețul nu poate fi negativ.' : 'Prețul trebuie să fie mai mare decât 0.')
      return
    }

    if (values.order_kind === 'consum_propriu') {
      const canContinue = await guardStocPentruInLivrare(cantitate)
      if (!canContinue) return
    }

    if (!allowDifferentName) {
      const phoneConflict = findActiveOrderPhoneConflict({ orders: comenzi, clienti, values })
      if (phoneConflict) {
        hapticError()
        setOrderPhoneConflict(phoneConflict)
        return
      }
    }

    const safeClientMatch = values.client_id || allowDifferentName
      ? null
      : resolveExistingClientByPhone(clienti, values.telefon)
    const resolvedClientId =
      values.client_id || (safeClientMatch?.status === 'existing' ? safeClientMatch.client.id : '')
    const clientPersistencePlan = planOrderClientPersistence({
      clienti,
      clientId: resolvedClientId || null,
      clientName: values.client_nume_manual || '',
      rawPhone: values.telefon || '',
      address: values.locatie_livrare || '',
      saveClientRequested: Boolean(
        values.client_nume_manual.trim() && values.telefon.trim(),
      ),
    })

    if (clientPersistencePlan.action === 'invalid') {
      hapticError()
      toast.error(clientPersistencePlan.message)
      return
    }

    const createdComanda = await createMutation.mutateAsync({
      payload: {
        client_id: resolvedClientId || null,
        client_nume_manual: resolvedClientId ? null : values.client_nume_manual || null,
        telefon: values.telefon || null,
        locatie_livrare: values.locatie_livrare || null,
        data_comanda: values.data_comanda || today,
        data_livrare: values.data_livrare || null,
        cantitate_kg: cantitate,
        pret_per_kg: pret,
        order_kind: values.order_kind,
        status: 'confirmata',
        observatii: values.observatii || null,
      },
      clientPersistencePlan,
    })

    if (values.order_kind === 'consum_propriu' && createdComanda) {
      try {
        await deliverMutation.mutateAsync({
          comandaId: createdComanda.id,
          cantitateLivrataKg: cantitate,
          statusPlata: 'platit',
          dataLivrareRamasa: null,
        })
      } catch {
        toast.error(
          'Comanda a fost creată dar livrarea a eșuat. Găsești comanda în lista de active și o poți livra manual.',
          { duration: 6000 },
        )
      }
    }
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
      header={(
        <PageHeader
          title="Comenzi"
          subtitle="Livrări, statusuri și încasări"
          contentVariant="workspace"
          rightSlot={
            canWriteComenzi ? (
              <button
                type="button"
                onClick={() => {
                  setSpeedDialOpen(false)
                  setDinMesajOpen(true)
                }}
                className="hidden h-8 items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-card)] px-3 text-sm [font-weight:650] text-[var(--text-primary)] transition hover:bg-[var(--surface-card-muted)] md:inline-flex lg:border-white/30 lg:bg-white/14 lg:text-[var(--text-on-accent)] lg:hover:bg-white/24"
              >
                Din mesaj
              </button>
            ) : null
          }
        />
      )}
    >
      <DashboardContentShell variant="workspace" className="mt-2 flex flex-col gap-3 pb-16 pt-3 sm:mt-0 sm:py-3 md:pb-3">
        {(operationalSnapshot.activeTotalCount > 0 || comenziRestanteCount > 0 || neincasatRon > 0 || showStocNecesarCard) ? (
          <div className="space-y-2">
            <ModuleScoreboard className="gap-x-3.5 gap-y-2">
              {operationalSnapshot.activeTotalCount > 0 ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => setFilterAndTab('de_livrat', 'active')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setFilterAndTab('de_livrat', 'active')
                  }}
                >
                  <span className="text-lg font-extrabold text-[var(--agri-text)]">{operationalSnapshot.activeTotalCount}</span>
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

        <PillTabs
          value={activeTab}
          onChange={(value) => {
            setActiveTab(value)
            if (value === 'programate') setOrderSort('delivery_date')
            if (value !== 'programate' && orderSort === 'delivery_date_desc') {
              setOrderSort('created_at')
            }
            if (value === 'de_livrat') setOrderSort('created_at')
            if (value === 'de_livrat' && activeFilter === 'neincasat') setActiveFilter('none')
            if (
              value === 'livrate' &&
              ['azi', 'active', 'restante', 'viitoare'].includes(activeFilter)
            ) {
              setActiveFilter('none')
            }
            if (value === 'programate' && activeFilter === 'neincasat') setActiveFilter('none')
          }}
          onOpenCampaign={() => router.push('/comenzi/campanie')}
          activeCount={operationalSnapshot.activeTotalCount}
          scheduledCount={programateCount}
          livrateCount={livrateComenzi.length}
          receivableCount={livrateNeincasate.length}
          receivableTotal={neincasatRon}
          receivablesActive={activeTab === 'livrate' && activeFilter === 'neincasat'}
          onOpenReceivables={() => setFilterAndTab('livrate', 'neincasat')}
        />

        <DesktopToolbar className="hidden md:flex">
          <SearchField
            containerClassName="w-full max-w-md min-w-[200px]"
            placeholder="Caută după client sau telefon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Caută comenzi (desktop)"
          />
        </DesktopToolbar>

        <div className="space-y-2" data-testid="comenzi-mobile-controls">
          <div className="flex items-center gap-2">
            <Label htmlFor="comenzi-sort" className="shrink-0 text-xs text-[var(--text-secondary)]">
              Sortează:
            </Label>
            <Select
              value={orderSort}
              onValueChange={(value) => setOrderSort(value as ComenziOrderSort)}
            >
              <SelectTrigger id="comenzi-sort" className="h-9 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Dată plasare ↑</SelectItem>
                <SelectItem value="created_at_desc">Dată plasare ↓</SelectItem>
                <SelectItem value="delivery_date">Cel mai apropiat (restanțe primele)</SelectItem>
                {activeTab === 'programate' ? (
                  <SelectItem value="delivery_date_desc">Cel mai îndepărtat</SelectItem>
                ) : null}
                <SelectItem value="locality">Localitate / Zonă</SelectItem>
                <SelectItem value="qty_desc">Cantitate ↓</SelectItem>
                <SelectItem value="total_desc">Total lei ↓</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--text-secondary)] shadow-sm transition active:scale-[0.985] md:hidden"
              aria-label={mobileSearchOpen ? 'Închide căutarea' : 'Deschide căutarea'}
              aria-expanded={mobileSearchOpen}
              onClick={() => {
                if (mobileSearchOpen) setSearch('')
                setMobileSearchOpen((current) => !current)
              }}
            >
              {mobileSearchOpen ? <X className="h-[18px] w-[18px]" aria-hidden /> : <Search className="h-[18px] w-[18px]" aria-hidden />}
            </button>
          </div>
          {mobileSearchOpen ? (
            <div className="min-w-0 animate-in fade-in slide-in-from-right-2 duration-200 md:hidden">
              <SearchField
                autoFocus
                containerClassName="w-full"
                className="h-11"
                placeholder="Client sau telefon..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Caută comenzi"
              />
            </div>
          ) : null}
        </div>

        {isError ? (
          <ErrorState
            title="Eroare"
            message={(error as Error)?.message ?? 'Nu am putut încărca comenzile.'}
          />
        ) : null}
        {isLoading ? <EntityListSkeleton /> : null}

        {!isLoading && !isError && unifiedFiltered.length === 0 ? (
          <ModuleEmptyCard
            emoji="📋"
            title="Nicio comandă încă"
            hint="Adaugă prima comandă sau așteaptă comenzi din magazinul online."
          />
        ) : null}

        {!isLoading && !isError && unifiedFiltered.length > 0 ? (
          <>
            <div className="space-y-5 md:hidden">
              {unifiedGroups.map((group) => {
                const units = new Set(group.orders.map((order) => order.quantityUnit))
                const quantitySummary =
                  units.size === 1
                    ? units.has('kg')
                      ? `${group.totalQty.toLocaleString('ro-RO')} kg`
                      : formatKgOneDecimal(group.totalQty * KG_PER_CASEROLĂ)
                    : ''
                const totalKg = group.orders.reduce(
                  (sum, item) => sum + getUnifiedOrderNeedKg(item),
                  0,
                )
                const necesarKg =
                  activeTab === 'programate'
                    ? totalKg
                    : undefined
                return (
                  <UnifiedOrderGroupSection
                    key={group.date ?? 'unscheduled'}
                    date={group.date}
                    orderCount={group.orders.length}
                    quantitySummary={quantitySummary}
                    necesarKg={necesarKg}
                    totalKg={totalKg}
                    showHeader={showOrderGroupHeaders}
                    scheduledView={activeTab === 'programate'}
                    referenceDate={today}
                  >
                    <div className="space-y-3">
                      {group.orders.map((item) => (
                        <UnifiedOrderCard
                          key={getUnifiedSelectionId(item)}
                          item={item}
                          variant="comenzi"
                          comenziMode={activeTab === 'programate' ? 'programate' : 'active'}
                          disabled={updateMutation.isPending}
                          onOpenB2bDetails={(id) => {
                            const comanda = comenzi.find((row) => row.id === id)
                            if (comanda) setViewing(comanda)
                          }}
                          onB2bStatusChange={handleB2bStatusChange}
                          onMarkPaid={canWriteComenzi ? handleMarkPaid : undefined}
                          onB2bDeliveryDateChange={async (id, data_livrare) => {
                            if (!canWriteComenzi) {
                              toast.error('Ai acces doar pentru citire în Comenzi.')
                              return
                            }
                            await updateMutation.mutateAsync({ id, payload: { data_livrare } })
                          }}
                          onEdit={() => {
                            if (!canWriteComenzi) {
                              toast.error('Ai acces doar pentru citire în Comenzi.')
                              return
                            }
                            setEditingOrder(item)
                          }}
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
                const quantitySummary =
                  units.size === 1
                    ? units.has('kg')
                      ? `${group.totalQty.toLocaleString('ro-RO')} kg`
                      : formatKgOneDecimal(group.totalQty * KG_PER_CASEROLĂ)
                    : ''
                const totalKg = group.orders.reduce(
                  (sum, item) => sum + getUnifiedOrderNeedKg(item),
                  0,
                )
                const necesarKg =
                  activeTab === 'programate'
                    ? totalKg
                    : undefined
                return (
                  <UnifiedOrderGroupSection
                    key={group.date ?? 'unscheduled'}
                    date={group.date}
                    orderCount={group.orders.length}
                    quantitySummary={quantitySummary}
                    necesarKg={necesarKg}
                    totalKg={totalKg}
                    showHeader={showOrderGroupHeaders}
                    scheduledView={activeTab === 'programate'}
                    referenceDate={today}
                  >
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                      {group.orders.map((item) => (
                        <UnifiedOrderCard
                          key={getUnifiedSelectionId(item)}
                          item={item}
                          variant="comenzi"
                          comenziMode={activeTab === 'programate' ? 'programate' : 'active'}
                          compact
                          disabled={updateMutation.isPending}
                          onOpenB2bDetails={(id) => {
                            const comanda = comenzi.find((row) => row.id === id)
                            if (comanda) setViewing(comanda)
                          }}
                          onB2bStatusChange={handleB2bStatusChange}
                          onMarkPaid={canWriteComenzi ? handleMarkPaid : undefined}
                          onB2bDeliveryDateChange={async (id, data_livrare) => {
                            if (!canWriteComenzi) {
                              toast.error('Ai acces doar pentru citire în Comenzi.')
                              return
                            }
                            await updateMutation.mutateAsync({ id, payload: { data_livrare } })
                          }}
                          onEdit={() => {
                            if (!canWriteComenzi) {
                              toast.error('Ai acces doar pentru citire în Comenzi.')
                              return
                            }
                            setEditingOrder(item)
                          }}
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

      {canWriteComenzi ? (
        <ComenziSpeedDial
          open={speedDialOpen}
          onOpenChange={setSpeedDialOpen}
          onNewOrder={() => {
            setAddOpen(true)
          }}
          onFromMessage={() => setDinMesajOpen(true)}
        />
      ) : null}

      {canWriteComenzi ? (
        <ComenziDinMesajSheet
          clienti={clienti}
          open={dinMesajOpen}
          onOpenChange={setDinMesajOpen}
        />
      ) : null}

      {canWriteComenzi && editingOrder ? (
        <EditOrderSheet
          open
          order={editingOrder}
          clienti={clienti}
          onOpenChange={(open) => {
            if (!open) setEditingOrder(null)
          }}
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
            void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
            setEditingOrder(null)
          }}
        />
      ) : null}

      <ComandaDialog
        key={`create-${isCreateDialogOpen ? 'open' : 'closed'}-${duplicatePhoneFormPatch?.token ?? 'base'}`}
        open={canWriteComenzi && isCreateDialogOpen}
        onOpenChange={(open) => {
          if (!canWriteComenzi) return
          if (!open) {
            setAddOpen(false)
            setDuplicatePhoneFormPatch(null)
            clearComandaFormQueryParams()
            return
          }
          setAddOpen(true)
        }}
        saving={createMutation.isPending}
        clienti={clienti}
        mode="create"
        initialCreateValues={duplicatePhoneFormPatch?.values ?? queryCreatePrefill}
        onSave={submitNewOrder}
      />

      <AlertDialog open={Boolean(orderPhoneConflict)} onOpenChange={(open) => !open && setOrderPhoneConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Telefon folosit de alt client</AlertDialogTitle>
            <AlertDialogDescription>
              Există deja o comandă activă pentru „{orderPhoneConflict?.existingName ?? 'client'}” cu același număr.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Button
              type="button"
              onClick={() => {
                if (!orderPhoneConflict) return
                setDuplicatePhoneFormPatch({
                  token: Date.now(),
                  values: {
                    ...orderPhoneConflict.values,
                    client_id: '',
                    client_nume_manual: orderPhoneConflict.existingName,
                  },
                })
                setOrderPhoneConflict(null)
                toast('Am completat numele clientului existent. Verifică și salvează comanda.')
              }}
            >
              Folosește clientul existent ({orderPhoneConflict?.existingName ?? 'Client'})
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const pending = orderPhoneConflict
                setOrderPhoneConflict(null)
                if (pending) void submitNewOrder(pending.values, true)
              }}
            >
              Nu, e o persoană diferită — continuă
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ComandaDialog
        key={`edit-${editing?.id ?? 'none'}-${editing ? 'open' : 'closed'}`}
        open={canWriteComenzi && !!editing}
        onOpenChange={(open) => {
          if (!canWriteComenzi) return
          if (!open) setEditing(null)
        }}
        saving={updateMutation.isPending}
        clienti={clienti}
        mode="edit"
        initial={editing}
        onSave={async (values) => {
          if (!editing) return
          const cantitate = Number(values.cantitate_kg)
          const zeroPriceOrder =
            values.order_kind === 'cadou' || values.order_kind === 'consum_propriu'
          const pret = zeroPriceOrder ? 0 : Number(values.pret_per_kg)
          if (!Number.isFinite(cantitate) || cantitate <= 0) {
            hapticError()
            toast.error('Cantitatea trebuie să fie mai mare decât 0.')
            return
          }
          if (!Number.isFinite(pret) || pret < 0 || (!zeroPriceOrder && pret <= 0)) {
            hapticError()
            toast.error(zeroPriceOrder ? 'Prețul nu poate fi negativ.' : 'Prețul trebuie să fie mai mare decât 0.')
            return
          }

          if (values.status === 'in_livrare') {
            const canContinue = await guardStocPentruInLivrare(cantitate)
            if (!canContinue) {
              return
            }
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
              order_kind: values.order_kind,
              status: values.status,
              observatii: values.observatii || null,
            },
          })
        }}
      />

      <ComandaDeliveryDialog
        key={deliveryTarget ? `${deliveryTarget.source}-${deliveryTarget.id}` : 'closed'}
        order={deliveryTarget}
        pending={deliverMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !deliverMutation.isPending) {
            setDeliveryTarget(null)
          }
        }}
        onConfirm={handleDeliveryDialogConfirm}
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
          if (!canWriteComenzi) return
          setViewing(null)
          handleConfirmDeliver(comanda)
        }}
        onEdit={(comanda) => {
          if (!canWriteComenzi) return
          setViewing(null)
          setEditing(comanda)
        }}
        onDelete={(comanda) => {
          if (!canDeleteComenzi) return
          setViewing(null)
          setDeleting(comanda)
        }}
        readOnlyActions={!canWriteComenzi}
        hideDelete={!canDeleteComenzi}
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
        open={canDeleteComenzi && !!deleting}
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

      <AlertDialog
        open={stocInsuficientModal !== null}
        onOpenChange={(open) => {
          if (!open) setStocInsuficientModal(null)
        }}
      >
        <AlertDialogContent className="max-w-md sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Stoc insuficient</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm leading-relaxed text-[var(--agri-text-muted)]">
                <p>
                  Ai nevoie de{' '}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {formatKgOneDecimal(stocInsuficientModal?.necesarKg ?? 0)}
                  </span>
                  {stocInsuficientModal?.selectionCount && stocInsuficientModal.selectionCount > 1
                    ? ` pentru cele ${stocInsuficientModal.selectionCount} comenzi selectate,`
                    : ','}{' '}
                  dar momentan nu ai această cantitate disponibilă.
                </p>
                <p>
                  Disponibil acum:{' '}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {formatKgOneDecimal(stocInsuficientModal?.disponibilKg ?? 0)}
                  </span>
                  .
                </p>
                <p>Adaugă o recoltare și încearcă din nou.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end">
            <AlertDialogCancel className="w-full sm:w-auto">Am înțeles</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
