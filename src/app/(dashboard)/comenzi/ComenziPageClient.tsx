
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ClipboardList, Loader2, UserRoundPlus } from 'lucide-react'
import { toast } from '@/lib/ui/toast'

import { AppDialog } from '@/components/app/AppDialog'
import { AppShell } from '@/components/app/AppShell'
import { ConfirmDeleteDialog } from '@/components/app/ConfirmDeleteDialog'
import { ErrorState } from '@/components/app/ErrorState'
import { ListSkeletonCard } from '@/components/app/ListSkeleton'
import { PageHeader } from '@/components/app/PageHeader'
import { StickyActionBar } from '@/components/app/StickyActionBar'
import { useMobileScrollRestore } from '@/components/app/useMobileScrollRestore'
import { AddClientDialog } from '@/components/clienti/AddClientDialog'
import AlertCard from '@/components/ui/AlertCard'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import MiniCard from '@/components/ui/MiniCard'
import { SearchField } from '@/components/ui/SearchField'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import StatusBadge from '@/components/ui/StatusBadge'
import { Textarea } from '@/components/ui/textarea'
import { useAddAction } from '@/contexts/AddActionContext'
import { track } from '@/lib/analytics/track'
import { colors, radius, shadows, spacing } from '@/lib/design-tokens'
import { createClienți, getClienți, type Client } from '@/lib/supabase/queries/clienti'
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
import { getStocGlobal } from '@/lib/supabase/queries/stoc'
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

const statusLabelMap: Record<ComandaStatus, string> = {
  noua: 'Nouă',
  confirmata: 'Confirmată',
  programata: 'Programată',
  in_livrare: 'În livrare',
  livrata: 'Livrată',
  anulata: 'Anulată',
}

const statusVariantMap: Record<ComandaStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  noua: 'info',
  confirmata: 'warning',
  programata: 'neutral',
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
  return value.trim().toLowerCase()
}

function canDeliverStatus(status: string): boolean {
  const normalized = normalize(status)
  return normalized === 'confirmata' || normalized === 'noua'
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

function ComenziTabs({
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
  return (
    <div
      style={{
        background: colors.grayLight,
        borderRadius: radius.md,
        padding: 3,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0,1fr))',
        gap: 3,
      }}
    >
      {[
        { key: 'de_livrat' as const, label: `De livrat (${activeCount})` },
        { key: 'livrate' as const, label: `Livrate (${livrateCount})` },
        { key: 'toate' as const, label: 'Toate' },
      ].map((tab) => {
        const isActive = value === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              minHeight: 36,
              borderRadius: radius.md,
              border: 'none',
              background: isActive ? colors.white : 'transparent',
              boxShadow: isActive ? shadows.card : 'none',
              color: isActive ? colors.dark : colors.gray,
              fontSize: 12,
              fontWeight: 700,
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
  isExpanded,
  isDeliverConfirmOpen,
  isDelivering,
  onToggleExpand,
  onEdit,
  onDelete,
  onOpenDeliverConfirm,
  onCancelDeliverConfirm,
  onConfirmDeliver,
  onGoToVanzari,
  onReopen,
}: {
  comanda: Comanda
  clientName: string
  isExpanded: boolean
  isDeliverConfirmOpen: boolean
  isDelivering: boolean
  onToggleExpand: (id: string) => void
  onEdit: (comanda: Comanda) => void
  onDelete: (comanda: Comanda) => void
  onOpenDeliverConfirm: (comanda: Comanda) => void
  onCancelDeliverConfirm: () => void
  onConfirmDeliver: (comanda: Comanda) => void
  onGoToVanzari: () => void
  onReopen: (comanda: Comanda) => void
}) {
  const today = todayIso()
  const delivery = comanda.data_livrare ?? ''
  const isDelivered = comanda.status === 'livrata'
  const isCanceled = comanda.status === 'anulata'
  const isUrgent = !isDelivered && !isCanceled && delivery === today
  const isFuture = !isDelivered && !isCanceled && Boolean(delivery) && delivery > today
  const canDeliver = canDeliverStatus(comanda.status) && !isCanceled
  const phone = (comanda.telefon || '').trim()
  const hasPhone = phone.length > 0
  const isNewPhone = !comanda.client_id && hasPhone
  const icon = isDelivered ? '?' : isUrgent ? '?' : isFuture ? '?' : '?'
  const iconBg = isDelivered ? colors.greenLight : isUrgent ? colors.coralLight : colors.yellowLight
  const whatsappUrl = toWhatsAppUrl(phone)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onToggleExpand(comanda.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onToggleExpand(comanda.id)
        }
      }}
      style={{
        borderRadius: radius.lg,
        border: `1px solid ${colors.grayLight}`,
        borderLeft: isDelivered ? `4px solid ${colors.green}` : undefined,
        background: colors.white,
        boxShadow: shadows.card,
        padding: spacing.md,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.sm }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            background: iconBg,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: colors.dark,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {clientName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                {hasPhone ? (
                  <a
                    href={`tel:${phone}`}
                    onClick={(event) => event.stopPropagation()}
                    style={{ color: colors.primary, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
                  >
                    {phone}
                  </a>
                ) : (
                  <span style={{ color: colors.gray, fontSize: 12 }}>fără telefon</span>
                )}
                {isNewPhone ? <StatusBadge text="NOU" variant="danger" /> : null}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <StatusBadge text={statusLabelMap[comanda.status]} variant={statusVariantMap[comanda.status]} />
              <span style={{ fontSize: 11, color: colors.gray }}>{formatDate(comanda.data_livrare)}</span>
            </div>
          </div>

          <div
            style={{
              marginTop: spacing.sm,
              borderTop: `1px solid ${colors.grayLight}`,
              paddingTop: spacing.sm,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0,1fr)) auto',
              alignItems: 'end',
              gap: spacing.sm,
            }}
          >
            <div>
              <div style={{ fontSize: 10, color: colors.gray }}>CANTITATE</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.dark }}>{formatKg(comanda.cantitate_kg)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: colors.gray }}>PREȚ</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.dark }}>{Number(comanda.pret_per_kg || 0).toFixed(2)} lei/kg</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: colors.gray }}>TOTAL</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.green }}>{formatLei(comanda.total)}</div>
            </div>
            <span
              style={{
                fontSize: 16,
                color: colors.gray,
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                alignSelf: 'center',
              }}
            >
              ▾
            </span>
          </div>

          {canDeliver ? (
            <div style={{ marginTop: spacing.sm }}>
              {isDeliverConfirmOpen ? (
                <div
                  style={{
                    borderRadius: radius.lg,
                    background: colors.grayLight,
                    border: `1px solid ${colors.gray}`,
                    padding: spacing.sm,
                  }}
                >
                  <div style={{ fontSize: 12, color: colors.dark, marginBottom: spacing.sm }}>
                    Confirmi livrarea? Se scad {formatKg(comanda.cantitate_kg)} din stoc.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.sm }}>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onConfirmDeliver(comanda)
                      }}
                      disabled={isDelivering}
                      style={{
                        minHeight: 48,
                        border: 'none',
                        borderRadius: radius.lg,
                        background: colors.green,
                        color: colors.white,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {isDelivering ? 'Se procesează...' : 'Da, livrată!'}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onCancelDeliverConfirm()
                      }}
                      style={{
                        minHeight: 48,
                        border: `1px solid ${colors.gray}`,
                        borderRadius: radius.lg,
                        background: colors.white,
                        color: colors.dark,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Anulează
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpenDeliverConfirm(comanda)
                  }}
                  style={{
                    width: '100%',
                    minHeight: 48,
                    border: 'none',
                    borderRadius: radius.lg,
                    padding: '14px',
                    fontSize: 15,
                    letterSpacing: 0.5,
                    fontWeight: 700,
                    color: colors.white,
                    background: `linear-gradient(90deg, ${colors.primary}, ${colors.primaryLight})`,
                    boxShadow: `0 8px 18px ${colors.primary}66`,
                    cursor: 'pointer',
                  }}
                >
                  MARCHEAZĂ LIVRATĂ
                </button>
              )}
            </div>
          ) : null}

          {isDelivered ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onGoToVanzari()
              }}
              style={{
                marginTop: spacing.sm,
                width: '100%',
                minHeight: 44,
                border: `1px solid ${colors.green}`,
                borderRadius: radius.md,
                background: colors.greenLight,
                color: colors.green,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Vezi vânzarea
            </button>
          ) : null}

          {isExpanded ? (
            <div style={{ marginTop: spacing.sm, borderTop: `1px solid ${colors.grayLight}`, paddingTop: spacing.sm }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: spacing.sm }}>
                <a
                  href={hasPhone ? `tel:${phone}` : undefined}
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    minHeight: 48,
                    borderRadius: radius.md,
                    border: `1px solid ${colors.grayLight}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: colors.dark,
                    textDecoration: 'none',
                    background: colors.white,
                  }}
                >
                  Sună
                </a>
                <a
                  href={whatsappUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  style={{
                    minHeight: 48,
                    borderRadius: radius.md,
                    border: `1px solid ${colors.grayLight}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: colors.dark,
                    textDecoration: 'none',
                    background: colors.white,
                  }}
                >
                  WhatsApp
                </a>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    if (!isDelivered) onEdit(comanda)
                  }}
                  style={{
                    minHeight: 48,
                    border: `1px solid ${colors.grayLight}`,
                    borderRadius: radius.md,
                    background: colors.white,
                    color: colors.dark,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Editează
                </button>
              </div>

              {isDelivered ? (
                <div
                  style={{
                    marginTop: spacing.sm,
                    borderRadius: radius.md,
                    background: colors.greenLight,
                    color: colors.green,
                    fontSize: 12,
                    fontWeight: 600,
                    padding: spacing.sm,
                  }}
                >
                  Livrată și înregistrată în Vânzări
                </div>
              ) : null}

              {isDelivered ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onReopen(comanda)
                  }}
                  style={{
                    marginTop: spacing.sm,
                    minHeight: 44,
                    width: '100%',
                    borderRadius: radius.md,
                    border: `1px solid ${colors.gray}`,
                    background: colors.white,
                    color: colors.dark,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Redeschide
                </button>
              ) : null}

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete(comanda)
                }}
                style={{
                  marginTop: spacing.sm,
                  minHeight: 44,
                  width: '100%',
                  borderRadius: radius.md,
                  border: `1px solid ${colors.coral}`,
                  background: colors.coralLight,
                  color: colors.coral,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Șterge
              </button>
            </div>
          ) : null}
        </div>
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (values: ComandaFormState) => Promise<void>
  saving: boolean
  clienti: Client[]
  mode: 'create' | 'edit'
  initial?: Comanda | null
}) {
  const initialFormState = useMemo<ComandaFormState>(() => {
    if (!initial) return defaultFormState('confirmata')
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
  }, [initial])
  const [form, setForm] = useState<ComandaFormState>(initialFormState)
  const manualName = form.client_nume_manual.trim()
  const selectedClient = clienti.find((client) => client.id === form.client_id)
  const suggestedClientName = manualName || selectedClient?.nume_client || 'Client'
  const canSaveContact = suggestedClientName.trim().length > 0 && form.telefon.trim().length > 0

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
            className="agri-cta h-12 min-w-[132px] rounded-xl bg-[var(--agri-primary)] text-sm text-white hover:bg-emerald-700"
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
        <div className="space-y-1.5">
          <Label>Client existent</Label>
          <Select value={form.client_id || '__none'} onValueChange={(value) => setForm((prev) => ({ ...prev, client_id: value === '__none' ? '' : value }))}>
            <SelectTrigger className="agri-control h-12">
              <SelectValue placeholder="Selectează client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Fără client</SelectItem>
              {clienti.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.nume_client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Nume client manual</Label>
          <Input className="agri-control h-12" value={form.client_nume_manual} onChange={(e) => setForm((prev) => ({ ...prev, client_nume_manual: e.target.value }))} />
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
            <Label>Data comanda</Label>
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
            <Label>Pret per kg</Label>
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
  const pendingDeleteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmDeliverId, setConfirmDeliverId] = useState<string | null>(null)
  const [deliveringId, setDeliveringId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Comanda | null>(null)
  const [deleting, setDeleting] = useState<Comanda | null>(null)
  const [reopening, setReopening] = useState<Comanda | null>(null)
  const [desktopSelectedComandaId, setDesktopSelectedComandaId] = useState<string | null>(null)
  const [contactPrompt, setContactPrompt] = useState<ContactPrompt | null>(null)
  const [clientPrefill, setClientPrefill] = useState<ContactPrompt | null>(null)
  const [addClientOpen, setAddClientOpen] = useState(false)
  const addFromQuery = searchParams.get('add') === '1'

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
      track('comanda_delete', { id: deletedId })
      hapticSuccess()
      toast.success('Comandă ștearsă')
      setDeleting(null)
    },
    onError: (err: Error) => {
      hapticError()
      toast.error(err.message)
      queryClient.invalidateQueries({ queryKey: queryKeys.comenzi })
    },
  })

  const createClientMutation = useMutation({
    mutationFn: createClienți,
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
      hapticSuccess()
      toast('Comandă livrată! Vânzare creată.')

      const delivered = result.deliveredOrder
      const deliveredName = getClientName(delivered, clientMap)
      const deliveredPhone = (delivered.telefon || '').trim()
      if (!delivered.client_id && deliveredPhone) {
        setContactPrompt({ name: deliveredName, phone: deliveredPhone })
      }

      setDeliveringAndConfirm(null, null)
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

  function setDeliveringAndConfirm(delivering: string | null, confirm: string | null) {
    setDeliveringId(delivering)
    setConfirmDeliverId(confirm)
  }

  useEffect(() => {
    return () => {
      Object.values(pendingDeleteTimers.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    if (!addFromQuery) return
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('add')
    const query = nextParams.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [addFromQuery, pathname, router, searchParams])

  useEffect(() => {
    const unregister = registerAddAction(() => setAddOpen(true), 'Adauga comanda')
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

    const timer = setTimeout(() => {
      delete pendingDeleteTimers.current[comandaId]
      delete pendingDeletedItems.current[comandaId]
      deleteMutation.mutate(comandaId)
    }, 5000)

    pendingDeleteTimers.current[comandaId] = timer

    toast('Element șters', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          const pendingTimer = pendingDeleteTimers.current[comandaId]
          if (!pendingTimer) return

          clearTimeout(pendingTimer)
          delete pendingDeleteTimers.current[comandaId]

          const pendingItem = pendingDeletedItems.current[comandaId]
          delete pendingDeletedItems.current[comandaId]
          if (!pendingItem) return

          queryClient.setQueryData<Comanda[]>(queryKeys.comenzi, (current = []) => {
            if (current.some((item) => item.id === comandaId)) return current

            const next = [...current]
            const insertAt = pendingItem.index >= 0 ? Math.min(pendingItem.index, next.length) : next.length
            next.splice(insertAt, 0, pendingItem.item)
            return next
          })
        },
      },
    })
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

  return (
    <AppShell
      header={<PageHeader title="Comenzi" subtitle="Livrări, statusuri și încasări" />}
      bottomBar={
        <StickyActionBar>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--agri-text-muted)]">Active: {formatKg(totalActiveKg)}</p>
            <p className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: colors.greenLight, color: colors.green }}>
              Valoare: {formatLei(totalActiveValue)}
            </p>
          </div>
        </StickyActionBar>
      }
    >
      <div
        className="mx-auto mt-4 w-full max-w-[980px] sm:mt-0 lg:max-w-[1320px]"
        style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md }}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div style={{ border: comenziAzi.length > 0 ? `1px solid ${colors.coral}` : `1px solid ${colors.grayLight}`, borderRadius: radius.xl }}>
            <MiniCard
              icon={comenziAzi.length > 0 ? '🚚' : '📦'}
              value={`${comenziAzi.length}`}
              sub={`${formatKg(kgAzi)}`}
              label="de livrat AZI"
              onClick={() => setFilterAndTab('de_livrat', 'azi')}
            />
          </div>
          <MiniCard
            icon="📋"
            value={`${activeComenzi.length}`}
            sub={`${formatKg(totalActiveKg)} total`}
            label="active total"
            onClick={() => setFilterAndTab('de_livrat', 'active')}
          />
          <MiniCard icon="💰" value={`${formatLeiCompact(totalActiveValue)} RON`} sub="RON valoare" label="valoare" />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <AlertCard
            icon="⚠️"
            label="Restante"
            value={`${comenziRestante.length}`}
            sub="comenzi depășite"
            variant="danger"
            onClick={() => setFilterAndTab('de_livrat', 'restante')}
          />
          <AlertCard
            icon="💸"
            label="Neîncasat"
            value={`${formatLeiCompact(neincasatRon)} RON`}
            sub="RON de colectat"
            variant="warning"
            onClick={() => setFilterAndTab('livrate', 'neincasat')}
          />
          <AlertCard
            icon="📦"
            label="Stoc disp."
            value={formatKg(totalStocDisponibilKg)}
            sub="kg disponibil"
            variant="success"
          />
        </div>

        {showStockWarning ? (
          <AlertCard
            icon="⚠️"
            label="Stoc insuficient"
            value="Stoc insuficient pentru toate comenzile"
            sub={`Disponibil ${formatKg(totalStocDisponibilKg)} / necesar ${formatKg(totalActiveKg)}`}
            variant="warning"
          />
        ) : null}

        <ComenziTabs
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
            <div className="lg:hidden" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: spacing.sm }}>
              {filteredComenzi.map((comanda) => (
                <ComandaCard
                  key={comanda.id}
                  comanda={comanda}
                  clientName={getClientName(comanda, clientMap)}
                  isExpanded={expandedId === comanda.id}
                  isDeliverConfirmOpen={confirmDeliverId === comanda.id}
                  isDelivering={deliveringId === comanda.id}
                  onToggleExpand={(id) => setExpandedId((current) => (current === id ? null : id))}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                  onOpenDeliverConfirm={(item) => setConfirmDeliverId(item.id)}
                  onCancelDeliverConfirm={() => setConfirmDeliverId(null)}
                  onConfirmDeliver={handleConfirmDeliver}
                  onGoToVanzari={() => router.push('/vanzari')}
                  onReopen={setReopening}
                />
              ))}
            </div>

            <div className="hidden lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)] lg:gap-4">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-100 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Data livrare</th>
                      <th className="px-4 py-3 font-semibold">Client</th>
                      <th className="px-4 py-3 font-semibold">Cantitate</th>
                      <th className="px-4 py-3 font-semibold">Valoare</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComenzi.map((comanda) => {
                      const isSelected = desktopSelectedComanda?.id === comanda.id
                      return (
                        <tr
                          key={comanda.id}
                          className={`cursor-pointer border-t border-gray-100 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                          onClick={() => setDesktopSelectedComandaId(comanda.id)}
                        >
                          <td className="px-4 py-3 text-gray-700">{formatDate(comanda.data_livrare || comanda.data_comanda)}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{getClientName(comanda, clientMap)}</td>
                          <td className="px-4 py-3 text-gray-700">{formatKg(Number(comanda.cantitate_kg || 0))}</td>
                          <td className="px-4 py-3 text-gray-900">{formatLei(Number(comanda.total || 0))}</td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              text={statusLabelMap[comanda.status] ?? comanda.status}
                              variant={statusVariantMap[comanda.status] ?? 'neutral'}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Detalii comanda</h3>
                {desktopSelectedComanda ? (
                  <div className="mt-4 space-y-3 text-sm text-gray-700">
                    <p><span className="font-medium text-gray-900">Client:</span> {getClientName(desktopSelectedComanda, clientMap)}</p>
                    <p><span className="font-medium text-gray-900">Telefon:</span> {desktopSelectedComanda.telefon || '-'}</p>
                    <p><span className="font-medium text-gray-900">Data comanda:</span> {formatDate(desktopSelectedComanda.data_comanda)}</p>
                    <p><span className="font-medium text-gray-900">Data livrare:</span> {formatDate(desktopSelectedComanda.data_livrare)}</p>
                    <p><span className="font-medium text-gray-900">Cantitate:</span> {formatKg(Number(desktopSelectedComanda.cantitate_kg || 0))}</p>
                    <p><span className="font-medium text-gray-900">Pret/kg:</span> {formatLei(Number(desktopSelectedComanda.pret_per_kg || 0))}</p>
                    <p><span className="font-medium text-gray-900">Total:</span> {formatLei(Number(desktopSelectedComanda.total || 0))}</p>
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
                          className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
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
                        className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                        onClick={() => setEditing(desktopSelectedComanda)}
                      >
                        Editează
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                        onClick={() => setDeleting(desktopSelectedComanda)}
                      >
                        Șterge
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-gray-600">Selectează o comandă pentru detalii.</p>
                )}
              </aside>
            </div>
          </>
        ) : null}
      </div>

      <ComandaDialog
        key={`create-${addOpen || addFromQuery ? 'open' : 'closed'}`}
        open={addOpen || addFromQuery}
        onOpenChange={setAddOpen}
        saving={createMutation.isPending}
        clienti={clienti}
        mode="create"
        onSave={async (values) => {
          const cantitate = Number(values.cantitate_kg)
          const pret = Number(values.pret_per_kg)
          if (!Number.isFinite(cantitate) || cantitate <= 0) {
            hapticError()
            toast.error('Cantitatea trebuie sa fie mai mare decat 0.')
            return
          }
          if (!Number.isFinite(pret) || pret <= 0) {
            hapticError()
            toast.error('Pretul trebuie sa fie mai mare decat 0.')
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
            toast.error('Cantitatea trebuie sa fie mai mare decat 0.')
            return
          }
          if (!Number.isFinite(pret) || pret <= 0) {
            hapticError()
            toast.error('Pretul trebuie sa fie mai mare decat 0.')
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
            nume_client: data.nume_client,
            telefon: data.telefon || null,
            email: data.email || null,
            adresa: data.adresa || null,
            pret_negociat_lei_kg: data.pret_negociat_lei_kg ? Number(data.pret_negociat_lei_kg) : null,
            observatii: data.observatii || null,
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
        description="Redeschiderea va anula vanzarea asociata ți va restaura stocul aferent livrarii."
        confirmText="Redeschide"
        loading={reopenMutation.isPending}
      />
    </AppShell>
  )
}
