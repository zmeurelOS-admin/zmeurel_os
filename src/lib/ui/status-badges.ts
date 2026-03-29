function normalizeStatus(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const STATUS_BADGE_CLASS_MAP: Record<string, string> = {
  noua: 'bg-blue-100 text-blue-700 dark:border dark:border-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
  confirmata: 'bg-amber-100 text-amber-700 dark:border dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
  programata: 'bg-purple-100 text-purple-700 dark:border dark:border-purple-700 dark:bg-purple-900/45 dark:text-purple-300',
  pregatita: 'bg-purple-100 text-purple-700 dark:border dark:border-purple-700 dark:bg-purple-900/45 dark:text-purple-300',
  in_livrare: 'bg-cyan-100 text-cyan-700 dark:border dark:border-cyan-700 dark:bg-cyan-900/45 dark:text-cyan-300',
  livrata: 'bg-green-100 text-green-700 dark:border dark:border-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
  anulata: 'bg-red-100 text-red-700 dark:border dark:border-red-700 dark:bg-red-900/50 dark:text-red-400',
  avans: 'bg-amber-100 text-amber-700 dark:border dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-400',
  platit: 'bg-green-100 text-green-700 dark:border dark:border-green-700 dark:bg-green-900/50 dark:text-green-400',
  restanta: 'bg-red-500 text-white font-semibold dark:border dark:border-red-700 dark:bg-red-900/50 dark:text-red-400',
  achitat: 'bg-green-100 text-green-700 dark:border dark:border-green-700 dark:bg-green-900/50 dark:text-green-400',
  achitata: 'bg-green-100 text-green-700 dark:border dark:border-green-700 dark:bg-green-900/50 dark:text-green-400',
  activ: 'bg-green-100 text-green-700 dark:border dark:border-green-700 dark:bg-green-900/50 dark:text-green-400',
  inactiv: 'bg-gray-100 text-gray-500 dark:border dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
  expirat: 'bg-red-100 text-red-600 dark:border dark:border-red-700 dark:bg-red-900/50 dark:text-red-400',
}

export function getStatusBadgeClass(status: string, fallback = 'bg-slate-100 text-slate-700'): string {
  return STATUS_BADGE_CLASS_MAP[normalizeStatus(status)] ?? fallback
}

export const STATUS_BADGE_LAYOUT_CLASS = 'inline-flex items-center gap-1'
