import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Clock3,
  CalendarClock,
  CircleCheckBig,
  CircleX,
  HelpCircle,
} from 'lucide-react'

export type StandardStatus = 'urgent' | 'in_lucru' | 'programat' | 'finalizat' | 'anulat'

export interface StatusConfigItem {
  label: string
  icon: LucideIcon
  className: string
}

export const STATUS_CONFIG: Record<StandardStatus, StatusConfigItem> = {
  urgent: {
    label: 'Urgent',
    icon: AlertTriangle,
    className: 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]',
  },
  in_lucru: {
    label: 'In lucru',
    icon: Clock3,
    className: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
  },
  programat: {
    label: 'Programat',
    icon: CalendarClock,
    className: 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]',
  },
  finalizat: {
    label: 'Finalizat',
    icon: CircleCheckBig,
    className: 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]',
  },
  anulat: {
    label: 'Anulat',
    icon: CircleX,
    className: 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]',
  },
}

export const CUSTOM_STATUS_FALLBACK: StatusConfigItem = {
  label: 'Status',
  icon: HelpCircle,
  className: 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]',
}

const NORMALIZE_MAP: Record<string, StandardStatus> = {
  urgent: 'urgent',
  critica: 'urgent',
  critic: 'urgent',
  in_lucru: 'in_lucru',
  'in lucru': 'in_lucru',
  activ: 'in_lucru',
  programat: 'programat',
  planificat: 'programat',
  finalizat: 'finalizat',
  finalizata: 'finalizat',
  ok: 'finalizat',
  anulat: 'anulat',
  inactiv: 'anulat',
}

export function resolveStatusKey(status: string): StandardStatus | null {
  const key = status.trim().toLowerCase()
  return NORMALIZE_MAP[key] ?? null
}
