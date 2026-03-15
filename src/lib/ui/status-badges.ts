function normalizeStatus(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const STATUS_BADGE_CLASS_MAP: Record<string, string> = {
  noua: 'bg-blue-100 text-blue-700',
  confirmata: 'bg-amber-100 text-amber-700',
  programata: 'bg-purple-100 text-purple-700',
  pregatita: 'bg-purple-100 text-purple-700',
  in_livrare: 'bg-cyan-100 text-cyan-700',
  livrata: 'bg-green-100 text-green-700',
  anulata: 'bg-red-100 text-red-700',
  avans: 'bg-amber-100 text-amber-700',
  platit: 'bg-green-100 text-green-700',
  restanta: 'bg-red-500 text-white font-semibold',
  achitat: 'bg-green-100 text-green-700',
  achitata: 'bg-green-100 text-green-700',
  activ: 'bg-green-100 text-green-700',
  inactiv: 'bg-gray-100 text-gray-500',
  expirat: 'bg-red-100 text-red-600',
}

export function getStatusBadgeClass(status: string, fallback = 'bg-slate-100 text-slate-700'): string {
  return STATUS_BADGE_CLASS_MAP[normalizeStatus(status)] ?? fallback
}

export const STATUS_BADGE_LAYOUT_CLASS = 'inline-flex items-center gap-1'
