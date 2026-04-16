export const ASSOCIATION_ORDER_STATUSES = [
  'noua',
  'confirmata',
  'in_livrare',
  'livrata',
  'anulata',
] as const

export type AssociationOrderStatus = (typeof ASSOCIATION_ORDER_STATUSES)[number]

export const ASSOCIATION_ORDER_STATUS_LABELS: Record<AssociationOrderStatus, string> = {
  noua: 'Nouă',
  confirmata: 'Confirmată',
  in_livrare: 'În livrare',
  livrata: 'Livrată',
  anulata: 'Anulată',
}

export const ASSOCIATION_ORDER_STATUS_VARIANTS: Record<
  AssociationOrderStatus,
  'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple'
> = {
  noua: 'neutral',
  confirmata: 'warning',
  in_livrare: 'warning',
  livrata: 'success',
  anulata: 'danger',
}

const ASSOCIATION_ORDER_TRANSITIONS: Record<AssociationOrderStatus, AssociationOrderStatus[]> = {
  noua: ['confirmata', 'anulata'],
  confirmata: ['in_livrare', 'anulata'],
  in_livrare: ['livrata', 'anulata'],
  livrata: [],
  anulata: [],
}

export function isAssociationOrderStatus(value: string | null | undefined): value is AssociationOrderStatus {
  return ASSOCIATION_ORDER_STATUSES.includes((value ?? '').trim().toLowerCase() as AssociationOrderStatus)
}

export function getAllowedAssociationOrderTransitions(status: string | null | undefined): AssociationOrderStatus[] {
  if (!isAssociationOrderStatus(status)) return []
  return ASSOCIATION_ORDER_TRANSITIONS[status]
}

export function canTransitionAssociationOrderStatus(
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!isAssociationOrderStatus(from) || !isAssociationOrderStatus(to)) return false
  if (from === to) return true
  return ASSOCIATION_ORDER_TRANSITIONS[from].includes(to)
}
