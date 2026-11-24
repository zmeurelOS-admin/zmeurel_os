'use client'

import type { ReactNode } from 'react'
import {
  Banknote,
  BarChart3,
  Bug,
  CalendarClock,
  ClipboardList,
  CloudLightning,
  FileText,
  FlaskConical,
  Info,
  Mail,
  Package,
  RefreshCw,
  Snowflake,
  Sprout,
  Tag,
  Timer,
  Truck,
  Users,
} from 'lucide-react'

import { kitFocus, kitText } from '@/components/kit'
import { IconBadge, type IconTone } from '@/components/setari/SetariUi'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/supabase'

export type NotificareRand = Database['public']['Tables']['notifications']['Row']

/** Iconița și tonul pe tipul notificării (aceleași în foaia clopoțelului și pe pagina „Notificări”). */
export function iconNotificare(type: string): { icon: ReactNode; tone: IconTone } {
  if (type === 'meteo_grindina') return { icon: <CloudLightning />, tone: 'warning' }
  if (type.startsWith('meteo_')) return { icon: <Snowflake />, tone: 'warning' }
  switch (type) {
    case 'comenzi_maine':
      return { icon: <CalendarClock />, tone: 'info' }
    case 'incasari_restante':
    case 'incasari_peste_30':
      return { icon: <Banknote />, tone: 'warning' }
    case 'order_new':
      return { icon: <ClipboardList />, tone: 'primary' }
    case 'order_status_changed':
      return { icon: <RefreshCw />, tone: 'primary' }
    case 'butasi_delivery_reminder':
      return { icon: <Truck />, tone: 'info' }
    case 'weekly_sales_summary':
      return { icon: <BarChart3 />, tone: 'neutral' }
    case 'tratament_reminder':
    case 'tratament_planificat':
      return { icon: <Timer />, tone: 'warning' }
    case 'plan_tratament':
      return { icon: <Sprout />, tone: 'info' }
    case 'analize_memento':
      return { icon: <FlaskConical />, tone: 'warning' }
    case 'magazie_pe_terminate':
      return { icon: <Package />, tone: 'warning' }
    case 'capcane_verificare':
    case 'capcane_peste_prag':
      return { icon: <Bug />, tone: 'warning' }
    case 'legal_docs_expiring':
    case 'legal_docs_expired':
      return { icon: <FileText />, tone: 'warning' }
    case 'product_listed':
    case 'product_unlisted':
      return { icon: <Tag />, tone: 'neutral' }
    case 'producer_approved':
    case 'producer_suspended':
      return { icon: <Users />, tone: 'neutral' }
    case 'offer_new':
    case 'offer_approved':
    case 'offer_rejected':
      return { icon: <Mail />, tone: 'neutral' }
    default:
      return { icon: <Info />, tone: 'neutral' }
  }
}

export interface RandNotificareProps {
  notificare: NotificareRand
  /** „acum 5 min”, „ieri, 08:00”: calculat de cine afișează lista. */
  ora: string
  onOpen: (notificare: NotificareRand) => void
}

/**
 * Rândul unei notificări (promptul 33: același în foaia clopoțelului și pe pagina „Notificări”): iconița pe tip,
 * titlul, textul (cel mult 3 rânduri), ora și punctul de necitit. Atins, marchează citit și duce la destinație.
 */
export function RandNotificare({ notificare, ora, onOpen }: RandNotificareProps) {
  const necitita = !notificare.read
  const { icon, tone } = iconNotificare(notificare.type)
  return (
    <button
      type="button"
      onClick={() => onOpen(notificare)}
      className={cn(
        'flex min-h-[72px] w-full items-start gap-3 rounded-box border px-3 py-2.5 text-left active:bg-surface-muted',
        kitFocus,
        necitita ? 'border-border-strong bg-primary-soft/40' : 'border-border bg-surface',
      )}
    >
      <IconBadge tone={tone} size="lg">
        {icon}
      </IconBadge>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className={cn('min-w-0 flex-1 text-fg', kitText.base, necitita ? 'font-extrabold' : 'font-semibold')}>{notificare.title}</span>
          <span className={cn('shrink-0 text-fg-subtle', kitText.helper)}>{ora}</span>
        </span>
        {notificare.body ? <span className={cn('line-clamp-3 text-fg-muted', kitText.secondary)}>{notificare.body}</span> : null}
      </span>
      {necitita ? (
        <span className="mt-2 size-2.5 shrink-0 rounded-full bg-primary">
          <span className="sr-only">Necitită</span>
        </span>
      ) : null}
    </button>
  )
}
