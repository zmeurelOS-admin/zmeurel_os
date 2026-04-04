function normalizeStatus(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const STATUS_BADGE_CLASS_MAP: Record<string, string> = {
  // Neutral/info
  noua: 'border border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]',
  inactiv: 'border border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]',

  // Warning/attention
  confirmata: 'border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
  programata: 'border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
  pregatita: 'border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
  in_livrare: 'border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
  avans: 'border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',

  // Success/ok
  livrata: 'border border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
  platit: 'border border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
  achitat: 'border border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
  achitata: 'border border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]',
  activ: 'border border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]',

  // Danger/critical
  anulata: 'border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]',
  restanta: 'border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] font-semibold',
  expirat: 'border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]',
}

export function getStatusBadgeClass(status: string, fallback = 'bg-slate-100 text-slate-700'): string {
  return STATUS_BADGE_CLASS_MAP[normalizeStatus(status)] ?? fallback
}

export const STATUS_BADGE_LAYOUT_CLASS = 'inline-flex items-center gap-1'
