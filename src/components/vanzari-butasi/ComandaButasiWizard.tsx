'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Camera,
  Check,
  ChevronLeft,
  Contact,
  ChevronRight,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  Send,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { trackEvent } from '@/lib/analytics/trackEvent'
import { captureReactError } from '@/lib/monitoring/report-error'
import { queryKeys } from '@/lib/query-keys'
import { createClienți, getClienți, type Client } from '@/lib/supabase/queries/clienti'
import { getParcele, type Parcela } from '@/lib/supabase/queries/parcele'
import {
  SURSA_COMANDA_BUTASI_LABELS,
  SURSE_COMANDA_BUTASI,
  createVanzareButasi,
  getVanzariButasi,
  type SursaComandaButasi,
  type VanzareButasi,
} from '@/lib/supabase/queries/vanzari-butasi'
import { toast } from '@/lib/ui/toast'
import { cn } from '@/lib/utils'
import { hapticError, hapticSuccess } from '@/lib/utils/haptic'

// ─── Utilitare dată (ora locală a telefonului) ─────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d: Date, n: number) => {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}
const parseIso = (v: string) => new Date(`${v}T12:00:00`)

function getDates() {
  const now = new Date()
  return {
    today: toIso(now),
    yesterday: toIso(addDays(now, -1)),
    tomorrow: toIso(addDays(now, 1)),
    nextWeek: toIso(addDays(now, 7)),
  }
}

function dayLabel(value: string | null, dates: ReturnType<typeof getDates>): string {
  if (!value) return 'Nu știu încă'
  if (value === dates.today) return 'Azi'
  if (value === dates.yesterday) return 'Ieri'
  if (value === dates.tomorrow) return 'Mâine'
  const d = parseIso(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('ro-RO', { weekday: 'short', day: 'numeric', month: 'short' })
}

const longDay = (value: string) =>
  parseIso(value).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'short' })

const toNumber = (value: string | number) => {
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

const lei = (value: number) =>
  `${(Math.round(value * 100) / 100).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} lei`

const normalize = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

// ─── Agenda telefonului (Contact Picker API — Chrome pe Android) ───────────────

type PickedContact = { name?: string[]; tel?: string[] }
type ContactsManagerLike = {
  select: (props: Array<'name' | 'tel'>, options?: { multiple?: boolean }) => Promise<PickedContact[]>
}

function getContactsManager(): ContactsManagerLike | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null
  const nav = navigator as Navigator & { contacts?: ContactsManagerLike }
  if (!('ContactsManager' in window) || !nav.contacts || typeof nav.contacts.select !== 'function') return null
  return nav.contacts
}

const phoneDigits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '').slice(-9)

// ─── Soiuri din parcelele fermei ───────────────────────────────────────────────

/** Ex.: soi „Maravilla”, sau soi_plantat „Zmeură - Maravilla” → „Maravilla”. */
function soiFromParcela(parcela: Parcela): string | null {
  const raw = (parcela.soi ?? '').trim() || (parcela.soi_plantat ?? '').trim()
  if (!raw) return null
  const parts = raw.split(/\s+[-–]\s+/)
  const value = parts[parts.length - 1]?.trim()
  return value || null
}

// ─── Tipuri ────────────────────────────────────────────────────────────────────

type AvansMode = 'none' | 'half' | 'all' | 'custom'

interface WizardItem {
  soi: string
  qty: string
  price: string
}

interface WizardState {
  idx: number
  sursa: SursaComandaButasi | null
  clientId: string | null
  clientName: string
  phone: string
  items: WizardItem[]
  avansMode: AvansMode | null
  avansCustom: string
  livrare: string | null
  dataComanda: string
  observatii: string
  fromRecap: boolean
  altOpen: boolean
  altName: string
  calendar: 'livrare' | 'data' | null
  done: boolean
}

const initialState = (): WizardState => ({
  idx: 0,
  sursa: null,
  clientId: null,
  clientName: '',
  phone: '',
  items: [],
  avansMode: null,
  avansCustom: '',
  livrare: null,
  dataComanda: getDates().today,
  observatii: '',
  fromRecap: false,
  altOpen: false,
  altName: '',
  calendar: null,
  done: false,
})

const SURSA_ICONS: Record<SursaComandaButasi, LucideIcon> = {
  whatsapp: MessageCircle,
  telefon: Phone,
  messenger: Send,
  instagram: Camera,
  facebook: Users,
  personal: UserRound,
  altul: MoreHorizontal,
}

// ─── Componente mici ───────────────────────────────────────────────────────────

const tileBase =
  'flex min-h-[88px] flex-col items-start justify-between gap-2 rounded-2xl border-2 p-3.5 text-left text-[17px] font-bold transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--agri-primary)_35%,transparent)]'
const tileOn = 'border-[var(--agri-primary)] bg-[var(--agri-primary)] text-[var(--agri-primary-contrast)]'
const tileOff = 'border-[var(--border-default)] bg-[var(--agri-surface)] text-[var(--agri-text)]'

function Tile({
  on,
  onClick,
  children,
  dashed,
  ariaPressed,
}: {
  on?: boolean
  onClick: () => void
  children: ReactNode
  dashed?: boolean
  ariaPressed?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaPressed}
      className={cn(tileBase, on ? tileOn : tileOff, dashed && !on && 'border-dashed text-[var(--text-secondary)]')}
    >
      {children}
    </button>
  )
}

function TileSub({ children, on }: { children: ReactNode; on?: boolean }) {
  return (
    <span className={cn('text-sm font-medium', on ? 'opacity-90' : 'text-[var(--text-secondary)]')}>{children}</span>
  )
}

function StepTitle({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  return (
    <div className="space-y-1">
      {eyebrow ? (
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--agri-primary)]">{eyebrow}</p>
      ) : null}
      <h2 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--agri-text)]">{children}</h2>
    </div>
  )
}

const bigInput =
  'h-14 w-full rounded-2xl border-2 border-[var(--border-default)] bg-[var(--agri-surface)] px-4 text-lg font-semibold text-[var(--agri-text)] outline-none placeholder:font-normal placeholder:text-[var(--text-secondary)] focus:border-[var(--agri-primary)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--agri-primary)_22%,transparent)]'

const stepBtn =
  'h-14 rounded-2xl bg-[var(--agri-surface-muted)] text-lg font-extrabold text-[var(--agri-text)] active:opacity-80'

// ─── Calendar ──────────────────────────────────────────────────────────────────

function CalendarPanel({
  title,
  value,
  min,
  max,
  quick,
  onPick,
  onClose,
}: {
  title: string
  value: string | null
  min?: string
  max?: string
  quick?: Array<{ label: string; value: string }>
  onPick: (value: string) => void
  onClose: () => void
}) {
  const dates = getDates()
  const [view, setView] = useState(() => {
    const d = parseIso(value || dates.today)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const year = view.getFullYear()
  const month = view.getMonth()
  const offset = (new Date(year, month, 1).getDay() + 6) % 7 // luni = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = view.toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-[var(--agri-text)]">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Închide calendarul"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--agri-surface-muted)]"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {quick?.length ? (
        <div className="flex gap-2">
          {quick.map((q) => (
            <button
              key={q.value}
              type="button"
              onClick={() => onPick(q.value)}
              className={cn(
                'h-12 flex-1 rounded-2xl border-2 text-[15px] font-bold',
                value === q.value ? tileOn : tileOff,
              )}
            >
              {q.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setView(new Date(year, month - 1, 1))}
          aria-label="Luna anterioară"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--agri-surface-muted)]"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <p className="text-lg font-bold capitalize text-[var(--agri-text)]">{monthName}</p>
        <button
          type="button"
          onClick={() => setView(new Date(year, month + 1, 1))}
          aria-label="Luna următoare"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--agri-surface-muted)]"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center" aria-hidden>
        {['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'].map((d) => (
          <span key={d} className="py-1 text-[13px] font-semibold text-[var(--text-secondary)]">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const iso = toIso(new Date(year, month, day))
          const disabled = Boolean((min && iso < min) || (max && iso > max))
          const selected = iso === value
          const isToday = iso === dates.today
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onPick(iso)}
              aria-label={new Date(year, month, day).toLocaleDateString('ro-RO', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
              aria-pressed={selected}
              className={cn(
                'h-12 rounded-xl text-[17px] font-semibold text-[var(--agri-text)] disabled:cursor-not-allowed disabled:opacity-30',
                selected && 'bg-[var(--agri-primary)] text-[var(--agri-primary-contrast)]',
                !selected && isToday && 'ring-2 ring-inset ring-[var(--agri-primary)]',
                !selected && !disabled && 'active:bg-[var(--agri-surface-muted)]',
              )}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Wizard ────────────────────────────────────────────────────────────────────

interface ComandaButasiWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ComandaButasiWizard({ open, onOpenChange }: ComandaButasiWizardProps) {
  const queryClient = useQueryClient()
  const [s, setS] = useState<WizardState>(initialState)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dates = getDates()

  const patch = (next: Partial<WizardState>) => setS((prev) => ({ ...prev, ...next }))

  // La fiecare deschidere pornim de la zero (reset în timpul render-ului, fără effect).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setS(initialState())
  }

  useEffect(() => {
    if (open) trackEvent({ eventName: 'open_create_form', moduleName: 'vanzari-butasi', status: 'started' })
  }, [open])

  const { data: clienti = [] } = useQuery({ queryKey: queryKeys.clienti, queryFn: getClienți })
  const { data: vanzari = [] } = useQuery({ queryKey: queryKeys.vanzariButasi, queryFn: getVanzariButasi })
  const { data: parcele = [] } = useQuery({ queryKey: queryKeys.parcele, queryFn: getParcele })
  const [contactsManager] = useState(getContactsManager)

  // Clienți recenți (din comenzile anterioare), soiuri folosite și ultimul preț pe soi.
  const { recentClients, orderCountByClient, soiOptions, lastPriceBySoi } = useMemo(() => {
    const sorted = [...vanzari].sort((a, b) => (b.data_comanda ?? '').localeCompare(a.data_comanda ?? ''))
    const byId = new Map(clienti.map((c) => [c.id, c]))
    const counts = new Map<string, number>()
    const recent: Client[] = []
    const soiCount = new Map<string, { label: string; count: number }>()
    const prices = new Map<string, number>()

    sorted.forEach((order: VanzareButasi) => {
      if (order.client_id) {
        counts.set(order.client_id, (counts.get(order.client_id) ?? 0) + 1)
        const client = byId.get(order.client_id)
        if (client && !recent.some((r) => r.id === client.id)) recent.push(client)
      }
      ;(order.items ?? []).forEach((item) => {
        const key = normalize(item.soi)
        if (!key) return
        const entry = soiCount.get(key)
        if (entry) entry.count += 1
        else soiCount.set(key, { label: item.soi.trim(), count: 1 })
        if (!prices.has(key) && Number(item.pret_unitar) > 0) prices.set(key, Number(item.pret_unitar))
      })
    })

    // Soiurile vin din parcelele fermei (ce cultivi = ce vinzi ca butași). Doar dacă nu există
    // niciun soi pe parcele, cădem pe soiurile folosite în comenzile anterioare.
    const fromParcele: string[] = []
    parcele.forEach((parcela) => {
      if ((parcela.status ?? '').toLowerCase() === 'inactiv') return
      const soi = soiFromParcela(parcela)
      if (soi && !fromParcele.some((existing) => normalize(existing) === normalize(soi))) fromParcele.push(soi)
    })
    fromParcele.sort((a, b) => a.localeCompare(b, 'ro'))

    return {
      recentClients: recent.slice(0, 6),
      orderCountByClient: counts,
      soiOptions: fromParcele.length
        ? fromParcele
        : [...soiCount.values()].sort((a, b) => b.count - a.count).map((e) => e.label).slice(0, 6),
      lastPriceBySoi: prices,
    }
  }, [vanzari, clienti, parcele])

  const steps = useMemo(
    () => ['sursa', 'client', 'soiuri', ...s.items.map((_, i) => `qty-${i}`), 'avans', 'livrare', 'recap'],
    [s.items],
  )
  const stepKey = steps[Math.min(s.idx, steps.length - 1)]

  const total = s.items.reduce((sum, it) => sum + toNumber(it.qty) * toNumber(it.price), 0)
  const avansValue = (() => {
    if (s.avansMode === 'half') return Math.round((total / 2) * 100) / 100
    if (s.avansMode === 'all') return total
    if (s.avansMode === 'custom') return Math.max(0, toNumber(s.avansCustom))
    return 0
  })()
  const avans = Math.min(avansValue, total)
  const rest = Math.max(0, total - avans)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [s.idx, s.calendar, s.done])

  const goTo = (key: string, fromRecap = false) => {
    const i = steps.indexOf(key)
    if (i >= 0) patch({ idx: i, fromRecap, calendar: null })
  }
  const next = () => {
    setS((prev) => {
      if (prev.fromRecap) {
        const recapIdx = ['sursa', 'client', 'soiuri', ...prev.items.map((_, i) => `qty-${i}`), 'avans', 'livrare', 'recap'].indexOf('recap')
        return { ...prev, idx: recapIdx, fromRecap: false }
      }
      return { ...prev, idx: prev.idx + 1 }
    })
  }
  const back = () => {
    if (s.calendar) return patch({ calendar: null })
    if (s.fromRecap) return goTo('recap')
    if (s.idx > 0) patch({ idx: s.idx - 1 })
  }

  const pickFromAgenda = async () => {
    if (!contactsManager) return
    try {
      const [contact] = await contactsManager.select(['name', 'tel'], { multiple: false })
      if (!contact) return
      const name = contact.name?.find((n) => n.trim())?.trim() ?? ''
      const tel = contact.tel?.find((t) => t.trim())?.trim() ?? ''
      const digits = phoneDigits(tel)
      // Dacă omul e deja în lista de clienți (după telefon sau nume), îl folosim pe acela.
      const existing =
        (digits.length >= 6 ? clienti.find((c) => phoneDigits(c.telefon) === digits) : undefined) ??
        (name ? clienti.find((c) => normalize(c.nume_client ?? '') === normalize(name)) : undefined)
      if (existing) {
        patch({ clientId: existing.id, clientName: existing.nume_client, phone: existing.telefon ?? tel })
        next()
        return
      }
      patch({ clientId: null, clientName: name || tel, phone: tel })
    } catch (error) {
      // Utilizatorul a închis agenda sau browserul a refuzat: nu e o eroare de afișat.
      if (error instanceof Error && error.name !== 'AbortError' && error.name !== 'InvalidStateError') {
        toast.error('Nu am putut deschide agenda telefonului.')
      }
    }
  }

  // ── Salvare ──
  const mutation = useMutation({
    mutationFn: async () => {
      const name = s.clientName.trim()
      const phone = s.phone.trim()
      let clientId = s.clientId
      let manualName: string | null = null

      if (!clientId && name) {
        try {
          const saved = await createClienți(
            { nume_client: name, telefon: phone || null },
            {
              onDuplicateWarning: (existing) => {
                toast.warning(`Există deja un client cu nume similar: ${existing.nume_client}.`)
              },
            },
          )
          clientId = saved.id
          queryClient.invalidateQueries({ queryKey: queryKeys.clienti })
        } catch (error) {
          // Comanda nu se pierde: păstrăm numele pe comandă dacă salvarea clientului eșuează.
          captureReactError(error, { component: 'ComandaButasiWizard', tags: { action: 'create_client' } })
          manualName = phone ? `${name} (${phone})` : name
        }
      }

      return createVanzareButasi({
        client_id: clientId,
        client_nume_manual: manualName,
        sursa_comanda: s.sursa,
        status: 'noua',
        data_comanda: s.dataComanda,
        data_livrare_estimata: s.livrare || null,
        observatii: s.observatii.trim() || null,
        avans_suma: avans,
        avans_data: avans > 0 ? s.dataComanda : null,
        items: s.items.map((it) => ({
          soi: it.soi.trim(),
          cantitate: Math.round(toNumber(it.qty)),
          pret_unitar: toNumber(it.price),
        })),
      })
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vanzariButasi })
      trackEvent('butasi_order_created', 'vanzari-butasi', {
        orderId: saved.id,
        status: saved.status,
        total: saved.total_lei,
        sursa: s.sursa,
        flow: 'wizard',
      })
      hapticSuccess()
      patch({ done: true })
    },
    onError: (error: unknown) => {
      captureReactError(error, {
        component: 'ComandaButasiWizard',
        tags: { module: 'vanzari-butasi', action: 'create_order' },
      })
      hapticError()
      toast.error(error instanceof Error && error.message ? error.message : 'Nu am putut salva comanda.')
    },
  })

  // ── Footer ──
  let footer: { label: string; enabled: boolean; action: () => void } | null = null

  // ── Conținut pe pas ──
  let content: ReactNode = null

  if (s.done) {
    content = (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 py-10 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--soft-success-bg)] text-[var(--success-text)]">
          <Check className="h-12 w-12" strokeWidth={2.6} aria-hidden />
        </div>
        <h2 className="text-[26px] font-extrabold tracking-[-0.02em] text-[var(--agri-text)]">Comanda e salvată</h2>
        <p className="max-w-xs text-base text-[var(--text-secondary)]">
          {s.clientName.trim()} · {s.items.map((it) => `${it.soi} ${Math.round(toNumber(it.qty))}`).join(', ')} buc ·{' '}
          {lei(total)}
        </p>
        <div className="mt-4 flex w-full max-w-sm flex-col gap-2.5">
          <button
            type="button"
            onClick={() => setS(initialState())}
            className="h-14 rounded-2xl bg-[var(--agri-primary)] text-lg font-extrabold text-[var(--agri-primary-contrast)]"
          >
            Comandă nouă
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-14 rounded-2xl border-2 border-[var(--border-default)] text-lg font-bold text-[var(--agri-text)]"
          >
            Închide
          </button>
        </div>
      </div>
    )
  } else if (s.calendar === 'livrare') {
    content = (
      <CalendarPanel
        title="Data livrării"
        value={s.livrare}
        min={dates.today}
        onClose={() => patch({ calendar: null })}
        onPick={(value) => {
          setS((prev) => ({ ...prev, livrare: value, calendar: null }))
          next()
        }}
      />
    )
  } else if (s.calendar === 'data') {
    content = (
      <CalendarPanel
        title="Data comenzii"
        value={s.dataComanda}
        max={dates.today}
        quick={[
          { label: 'Azi', value: dates.today },
          { label: 'Ieri', value: dates.yesterday },
        ]}
        onClose={() => patch({ calendar: null })}
        onPick={(value) => patch({ dataComanda: value, calendar: null })}
      />
    )
  } else if (stepKey === 'sursa') {
    content = (
      <div className="space-y-5">
        <StepTitle>De unde e comanda?</StepTitle>
        <div className="grid grid-cols-2 gap-3">
          {SURSE_COMANDA_BUTASI.map((key) => {
            const Icon = SURSA_ICONS[key]
            const on = s.sursa === key
            return (
              <Tile
                key={key}
                on={on}
                ariaPressed={on}
                dashed={key === 'altul'}
                onClick={() => {
                  patch({ sursa: key })
                  next()
                }}
              >
                <Icon className="h-6 w-6" aria-hidden />
                <span>{SURSA_COMANDA_BUTASI_LABELS[key]}</span>
              </Tile>
            )
          })}
        </div>
      </div>
    )
  } else if (stepKey === 'client') {
    const q = normalize(s.clientName)
    const exact = clienti.find((c) => normalize(c.nume_client ?? '') === q)
    const matches = q
      ? clienti.filter((c) => normalize(c.nume_client ?? '').includes(q) || (c.telefon ?? '').replace(/\s/g, '').includes(q.replace(/\s/g, '')))
      : recentClients
    const list = matches.slice(0, 8)
    const name = s.clientName.trim()
    const isNew = Boolean(name) && !s.clientId && !exact

    content = (
      <div className="space-y-4">
        <StepTitle>Cine cumpără?</StepTitle>
        <label htmlFor="wiz_client" className="sr-only">
          Numele clientului
        </label>
        <div className="flex gap-2.5">
          <input
            id="wiz_client"
            className={cn(bigInput, 'min-w-0 flex-1')}
            placeholder="Scrie numele sau telefonul…"
            autoComplete="off"
            value={s.clientName}
            onChange={(e) => patch({ clientName: e.target.value, clientId: null })}
          />
          {contactsManager ? (
            <button
              type="button"
              onClick={pickFromAgenda}
              className="flex h-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-[var(--border-default)] bg-[var(--agri-surface)] px-3 text-[var(--agri-text)] active:bg-[var(--agri-surface-muted)]"
            >
              <Contact className="h-5 w-5" aria-hidden />
              <span className="text-xs font-bold">Agendă</span>
            </button>
          ) : null}
        </div>

        {isNew ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-[var(--success-text)]">
              <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden />
              Client nou — îl salvez în listă
            </p>
            <label htmlFor="wiz_phone" className="block text-[15px] font-semibold text-[var(--agri-text)]">
              Telefon <span className="font-normal text-[var(--text-secondary)]">(opțional)</span>
            </label>
            <input
              id="wiz_phone"
              type="tel"
              inputMode="tel"
              className={bigInput}
              placeholder="07xx xxx xxx"
              value={s.phone}
              onChange={(e) => patch({ phone: e.target.value })}
            />
          </div>
        ) : null}

        {list.length > 0 && !s.clientId ? (
          <div className="space-y-2.5">
            <p className="text-[15px] font-semibold text-[var(--agri-text)]">{q ? 'Clienți găsiți' : 'Clienți recenți'}</p>
            {list.map((client) => {
              const count = orderCountByClient.get(client.id) ?? 0
              const meta = [client.telefon, count ? `${count} ${count === 1 ? 'comandă' : 'comenzi'}` : null]
                .filter(Boolean)
                .join(' · ')
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => {
                    patch({ clientId: client.id, clientName: client.nume_client, phone: client.telefon ?? '' })
                    next()
                  }}
                  className="flex min-h-[68px] w-full items-center gap-3.5 rounded-2xl border-2 border-[var(--border-default)] bg-[var(--agri-surface)] px-4 py-2.5 text-left active:bg-[var(--agri-surface-muted)]"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--agri-surface-muted)] font-extrabold text-[var(--agri-text)]">
                    {(client.nume_client || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[17px] font-bold text-[var(--agri-text)]">{client.nume_client}</span>
                    {meta ? <span className="truncate text-sm text-[var(--text-secondary)]">{meta}</span> : null}
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" aria-hidden />
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    )
    const shortName = name.length > 18 ? `${name.slice(0, 18)}…` : name
    footer = {
      label: name ? `Continuă cu „${shortName}”` : 'Continuă',
      enabled: Boolean(name),
      action: () => {
        if (!s.clientId && exact) {
          patch({ clientId: exact.id, clientName: exact.nume_client, phone: exact.telefon ?? s.phone })
        }
        next()
      },
    }
  } else if (stepKey === 'soiuri') {
    const extra = s.items.map((it) => it.soi).filter((soi) => !soiOptions.some((o) => normalize(o) === normalize(soi)))
    const all = [...soiOptions, ...extra]
    const toggle = (soi: string) => {
      const i = s.items.findIndex((it) => normalize(it.soi) === normalize(soi))
      if (i >= 0) patch({ items: s.items.filter((_, idx) => idx !== i) })
      else {
        const last = lastPriceBySoi.get(normalize(soi))
        patch({ items: [...s.items, { soi, qty: '10', price: last ? String(last) : '' }] })
      }
    }
    const addAlt = () => {
      const value = s.altName.trim()
      if (!value) return
      if (!s.items.some((it) => normalize(it.soi) === normalize(value))) {
        const last = lastPriceBySoi.get(normalize(value))
        patch({ items: [...s.items, { soi: value, qty: '10', price: last ? String(last) : '' }], altName: '', altOpen: false })
      } else patch({ altName: '', altOpen: false })
    }
    content = (
      <div className="space-y-5">
        <StepTitle>Ce soiuri?</StepTitle>
        <p className="-mt-3 text-base text-[var(--text-secondary)]">
          {all.length ? 'Poți alege mai multe' : 'Scrie primul soi — data viitoare îl găsești aici'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {all.map((soi) => {
            const on = s.items.some((it) => normalize(it.soi) === normalize(soi))
            return (
              <Tile key={soi} on={on} ariaPressed={on} onClick={() => toggle(soi)}>
                <span className="line-clamp-2 break-words">{soi}</span>
                <TileSub on={on}>{on ? '✓ ales' : 'atinge ca să alegi'}</TileSub>
              </Tile>
            )
          })}
          <Tile dashed onClick={() => patch({ altOpen: !s.altOpen })}>
            <Plus className="h-6 w-6" aria-hidden />
            <span>{all.length ? 'Alt soi' : 'Adaugă soi'}</span>
          </Tile>
        </div>
        {s.altOpen || !all.length ? (
          <div className="flex gap-2.5">
            <label htmlFor="wiz_alt" className="sr-only">
              Nume soi
            </label>
            <input
              id="wiz_alt"
              autoFocus
              className={cn(bigInput, 'min-w-0 flex-1')}
              placeholder="Nume soi"
              value={s.altName}
              onChange={(e) => patch({ altName: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addAlt()
                }
              }}
            />
            <button
              type="button"
              onClick={addAlt}
              className="h-14 shrink-0 rounded-2xl bg-[var(--agri-text)] px-5 text-base font-bold text-[var(--agri-surface)]"
            >
              Adaugă
            </button>
          </div>
        ) : null}
      </div>
    )
    const n = s.items.length
    footer = {
      label: n ? `Continuă · ${n} ${n === 1 ? 'soi' : 'soiuri'}` : 'Alege cel puțin un soi',
      enabled: n > 0,
      action: () => patch({ idx: 3, fromRecap: false }),
    }
  } else if (stepKey.startsWith('qty-')) {
    const i = Number(stepKey.slice(4))
    const item = s.items[i]
    const setItem = (next: Partial<WizardItem>) =>
      setS((prev) => ({ ...prev, items: prev.items.map((it, idx) => (idx === i ? { ...it, ...next } : it)) }))
    const qty = toNumber(item.qty)
    const price = toNumber(item.price)
    const last = lastPriceBySoi.get(normalize(item.soi))
    content = (
      <div className="space-y-4">
        <StepTitle eyebrow={s.items.length > 1 ? `Soiul ${i + 1} din ${s.items.length}` : undefined}>
          Câte <span className="text-[var(--agri-primary)]">{item.soi}</span>?
        </StepTitle>
        <div className="flex flex-col items-center py-1">
          <label htmlFor="wiz_qty" className="sr-only">
            Bucăți
          </label>
          <input
            id="wiz_qty"
            type="number"
            inputMode="numeric"
            min={1}
            value={item.qty}
            onChange={(e) => setItem({ qty: e.target.value })}
            className="h-20 w-full bg-transparent text-center text-[64px] font-extrabold tracking-[-0.03em] text-[var(--agri-text)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-base font-medium text-[var(--text-secondary)]">bucăți</span>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {[-10, -1, 1, 10].map((d) => (
            <button
              key={d}
              type="button"
              className={cn(stepBtn, d > 0 && 'bg-[color-mix(in_srgb,var(--agri-primary)_14%,var(--agri-surface))]')}
              onClick={() => setItem({ qty: String(Math.max(1, Math.round(qty) + d)) })}
            >
              {d > 0 ? `+${d}` : `−${Math.abs(d)}`}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[50, 100].map((d) => (
            <button
              key={d}
              type="button"
              className={cn(stepBtn, 'bg-[color-mix(in_srgb,var(--agri-primary)_14%,var(--agri-surface))]')}
              onClick={() => setItem({ qty: String(Math.max(1, Math.round(qty) + d)) })}
            >
              +{d}
            </button>
          ))}
        </div>
        <div className="space-y-3 rounded-2xl bg-[var(--agri-surface-muted)] p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex flex-1 flex-col">
              <span className="text-base font-bold text-[var(--agri-text)]">Preț pe bucată</span>
              <span className="text-[13px] text-[var(--text-secondary)]">
                {last ? `ultimul folosit: ${lei(last)}` : 'scrie prețul'}
              </span>
            </div>
            <button
              type="button"
              aria-label="Scade prețul"
              onClick={() => setItem({ price: String(Math.max(0, Math.round((price - 0.5) * 100) / 100)) })}
              className="h-12 w-12 rounded-xl bg-[var(--agri-surface)] text-2xl font-bold text-[var(--agri-text)]"
            >
              −
            </button>
            <label htmlFor="wiz_price" className="sr-only">
              Preț pe bucată, lei
            </label>
            <input
              id="wiz_price"
              type="number"
              inputMode="decimal"
              step="0.5"
              placeholder="0"
              value={item.price}
              onChange={(e) => setItem({ price: e.target.value })}
              className="h-12 w-20 rounded-xl border-2 border-transparent bg-[var(--agri-surface)] text-center text-xl font-bold text-[var(--agri-text)] outline-none focus:border-[var(--agri-primary)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              aria-label="Crește prețul"
              onClick={() => setItem({ price: String(Math.round((price + 0.5) * 100) / 100) })}
              className="h-12 w-12 rounded-xl bg-[var(--agri-surface)] text-2xl font-bold text-[var(--agri-text)]"
            >
              +
            </button>
          </div>
          <div className="flex items-baseline justify-between text-base text-[var(--text-secondary)]">
            <span>{item.soi}</span>
            <span className="text-2xl font-extrabold text-[var(--agri-text)]">{lei(qty * price)}</span>
          </div>
        </div>
      </div>
    )
    const ok = Number.isInteger(qty) && qty > 0 && price > 0
    const isLast = i === s.items.length - 1
    footer = {
      label: !ok ? 'Completează bucăți și preț' : s.fromRecap ? 'Gata' : isLast ? 'Continuă' : 'Următorul soi',
      enabled: ok,
      action: next,
    }
  } else if (stepKey === 'avans') {
    const opts: Array<{ mode: AvansMode; label: string; sub: string }> = [
      { mode: 'none', label: 'Nimic', sub: 'plătește la livrare' },
      { mode: 'half', label: 'Jumătate', sub: lei(Math.round((total / 2) * 100) / 100) },
      { mode: 'all', label: 'Tot', sub: lei(total) },
      { mode: 'custom', label: 'Altă sumă', sub: 'scriu eu' },
    ]
    content = (
      <div className="space-y-5">
        <StepTitle>A dat avans?</StepTitle>
        <div className="flex items-baseline justify-between rounded-2xl bg-[var(--agri-surface-muted)] px-4 py-3.5 text-base text-[var(--text-secondary)]">
          <span>Total comandă</span>
          <span className="text-2xl font-extrabold text-[var(--agri-text)]">{lei(total)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {opts.map((o) => {
            const on = s.avansMode === o.mode
            return (
              <Tile
                key={o.mode}
                on={on}
                ariaPressed={on}
                onClick={() => {
                  patch({ avansMode: o.mode })
                  if (o.mode !== 'custom') next()
                }}
              >
                <span>{o.label}</span>
                <TileSub on={on}>{o.sub}</TileSub>
              </Tile>
            )
          })}
        </div>
        {s.avansMode === 'custom' ? (
          <div className="space-y-2">
            <label htmlFor="wiz_avans" className="block text-[15px] font-semibold text-[var(--agri-text)]">
              Suma primită (lei)
            </label>
            <input
              id="wiz_avans"
              autoFocus
              type="number"
              inputMode="decimal"
              className={bigInput}
              placeholder="0"
              value={s.avansCustom}
              onChange={(e) => patch({ avansCustom: e.target.value })}
            />
          </div>
        ) : null}
      </div>
    )
    if (s.avansMode === 'custom') {
      const v = toNumber(s.avansCustom)
      footer = {
        label: v > total ? 'Avansul depășește totalul' : 'Continuă',
        enabled: v >= 0 && v <= total,
        action: next,
      }
    }
  } else if (stepKey === 'livrare') {
    const custom = Boolean(s.livrare) && s.livrare !== dates.tomorrow && s.livrare !== dates.nextWeek
    content = (
      <div className="space-y-5">
        <StepTitle>Când livrezi?</StepTitle>
        <div className="grid grid-cols-2 gap-3">
          <Tile
            on={s.livrare === ''}
            onClick={() => {
              patch({ livrare: '' })
              next()
            }}
          >
            <span>Nu știu încă</span>
            <TileSub on={s.livrare === ''}>stabilim mai târziu</TileSub>
          </Tile>
          <Tile
            on={s.livrare === dates.tomorrow}
            onClick={() => {
              patch({ livrare: dates.tomorrow })
              next()
            }}
          >
            <span>Mâine</span>
            <TileSub on={s.livrare === dates.tomorrow}>{longDay(dates.tomorrow)}</TileSub>
          </Tile>
          <Tile
            on={s.livrare === dates.nextWeek}
            onClick={() => {
              patch({ livrare: dates.nextWeek })
              next()
            }}
          >
            <span>Peste o săptămână</span>
            <TileSub on={s.livrare === dates.nextWeek}>{longDay(dates.nextWeek)}</TileSub>
          </Tile>
          <Tile on={custom} onClick={() => patch({ calendar: 'livrare' })}>
            <span>Aleg data</span>
            <TileSub on={custom}>{custom && s.livrare ? longDay(s.livrare) : 'din calendar'}</TileSub>
          </Tile>
        </div>
      </div>
    )
  } else if (stepKey === 'recap') {
    const row = (
      key: string,
      label: string,
      value: ReactNode,
      onClick: () => void,
      amount?: string,
    ) => (
      <button
        key={key}
        type="button"
        onClick={onClick}
        className="flex min-h-[64px] w-full items-center gap-3 border-b border-[var(--border-default)] bg-[var(--agri-surface)] px-4 py-3 text-left last:border-b-0 active:bg-[var(--agri-surface-muted)]"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[13px] font-medium text-[var(--text-secondary)]">{label}</span>
          <span className="truncate text-[17px] font-bold text-[var(--agri-text)]">{value}</span>
        </span>
        {amount ? <span className="whitespace-nowrap text-base font-bold text-[var(--agri-text)]">{amount}</span> : null}
        <span className="text-sm font-semibold text-[var(--agri-primary)]">Schimbă</span>
      </button>
    )
    content = (
      <div className="space-y-4">
        <StepTitle>Verifică și salvează</StepTitle>
        <div className="overflow-hidden rounded-2xl border-2 border-[var(--border-default)]">
          {row(
            'client',
            'Client',
            <>
              {s.clientName.trim() || '—'}
              {s.phone.trim() ? (
                <span className="text-sm font-medium text-[var(--text-secondary)]"> · {s.phone.trim()}</span>
              ) : null}
            </>,
            () => goTo('client', true),
          )}
          {row('sursa', 'De unde', s.sursa ? SURSA_COMANDA_BUTASI_LABELS[s.sursa] : '—', () => goTo('sursa', true))}
          {s.items.map((it, i) =>
            row(
              `qty-${i}`,
              it.soi,
              `${Math.round(toNumber(it.qty))} buc × ${lei(toNumber(it.price))}`,
              () => goTo(`qty-${i}`, true),
              lei(toNumber(it.qty) * toNumber(it.price)),
            ),
          )}
          {row('soiuri', 'Soiuri', 'Adaugă sau scoate soiuri', () => goTo('soiuri'))}
          {row('avans', 'Avans', s.avansMode === 'none' || !avans ? 'Fără avans' : lei(avans), () => goTo('avans', true))}
          {row('livrare', 'Livrare', dayLabel(s.livrare || null, dates), () => goTo('livrare', true))}
          {row('data', 'Data comenzii', dayLabel(s.dataComanda, dates), () => patch({ calendar: 'data' }))}
        </div>
        <div className="space-y-2 px-1 text-base text-[var(--text-secondary)]">
          <div className="flex justify-between">
            <span>Total</span>
            <span className="font-bold text-[var(--agri-text)]">{lei(total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Avans</span>
            <span className="font-bold text-[var(--agri-text)]">{lei(avans)}</span>
          </div>
        </div>
        <div
          className={cn(
            'flex items-center justify-between rounded-2xl px-4 py-3.5 text-[17px] font-bold',
            rest === 0
              ? 'bg-[var(--soft-success-bg)] text-[var(--success-text)]'
              : 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
          )}
        >
          <span>{rest === 0 ? 'Achitat integral' : 'Rest de încasat'}</span>
          <span>{rest === 0 ? '✓' : lei(rest)}</span>
        </div>
        <div className="space-y-2">
          <label htmlFor="wiz_obs" className="block text-[15px] font-semibold text-[var(--agri-text)]">
            Observații <span className="font-normal text-[var(--text-secondary)]">(opțional)</span>
          </label>
          <textarea
            id="wiz_obs"
            rows={3}
            placeholder="Adresă, detalii livrare…"
            value={s.observatii}
            onChange={(e) => patch({ observatii: e.target.value })}
            className="w-full resize-none rounded-2xl border-2 border-[var(--border-default)] bg-[var(--agri-surface)] px-4 py-3 text-base text-[var(--agri-text)] outline-none focus:border-[var(--agri-primary)]"
          />
        </div>
      </div>
    )
    footer = {
      label: mutation.isPending ? 'Se salvează…' : `Salvează · ${lei(total)}`,
      enabled: !mutation.isPending && s.items.length > 0 && Boolean(s.clientName.trim()),
      action: () => mutation.mutate(),
    }
  }

  const stepCount = steps.length - 1
  const progress = s.done ? 100 : Math.round((Math.min(s.idx, stepCount) / stepCount) * 100)
  const stepLabel = s.done ? '' : stepKey === 'recap' ? 'Verificare' : `Pasul ${s.idx + 1} din ${stepCount}`
  const canGoBack = !s.done && (s.idx > 0 || Boolean(s.calendar))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        mobileFullHeight
        aria-describedby={undefined}
        className="flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:max-w-none sm:p-0 md:h-[min(90dvh,860px)] md:max-h-[min(90dvh,860px)] md:w-[min(96vw,480px)] md:rounded-[var(--agri-radius-lg)] md:border"
      >
        <DialogTitle className="sr-only">Comandă nouă material săditor</DialogTitle>
        <DialogDescription className="sr-only">Completezi comanda pas cu pas.</DialogDescription>

        <div className="shrink-0 space-y-3 px-4 pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top,0px))]">
          <div className="flex min-h-12 items-center justify-between">
            <button
              type="button"
              onClick={back}
              aria-label="Înapoi"
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full bg-[var(--agri-surface-muted)] text-[var(--agri-text)]',
                !canGoBack && 'invisible',
              )}
            >
              <ChevronLeft className="h-6 w-6" aria-hidden />
            </button>
            <span className="text-sm font-semibold text-[var(--text-secondary)]">{stepLabel}</span>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Închide"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--agri-surface-muted)] text-[var(--agri-text)]"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--agri-surface-muted)]" aria-hidden>
            <div
              className="h-full rounded-full bg-[var(--agri-primary)] transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
          {content}
        </div>

        {footer && !s.calendar && !s.done ? (
          <div className="shrink-0 border-t border-[var(--border-default)] bg-[var(--agri-surface)] px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3">
            <button
              type="button"
              disabled={!footer.enabled}
              onClick={footer.action}
              className="h-14 w-full rounded-2xl bg-[var(--agri-primary)] text-lg font-extrabold text-[var(--agri-primary-contrast)] transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
            >
              {footer.label}
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
