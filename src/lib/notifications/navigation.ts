import type { AssociationRole } from '@/lib/association/auth'
import type { Json } from '@/types/supabase'

/** Input minim pentru destinație (rând DB sau payload notificare). */
export type NotificationNavInput = {
  type: string
  data: Json | null
  entity_type?: string | null
  entity_id?: string | null
}

function asDataRecord(data: Json | null): Record<string, unknown> {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>
  }
  return {}
}

/**
 * Destinație navigare după tip notificare, `data` (jsonb) și context utilizator.
 * `associationRole !== null` ⇒ utilizatorul e membru al asociației (orice rol).
 */
export function getNotificationHref(
  notification: NotificationNavInput,
  associationRole: AssociationRole | null,
): string {
  const { type } = notification
  const d = asDataRecord(notification.data)
  const isAssociationMember = associationRole !== null

  switch (type) {
    case 'order_new':
    case 'order_status_changed': {
      const ch = d['channel']
      if (ch === 'association_shop') return '/asociatie/comenzi'
      if (ch === 'farm_shop') return '/comenzi'
      if (isAssociationMember) return '/asociatie/comenzi'
      return '/comenzi'
    }
    case 'product_listed':
    case 'product_unlisted': {
      if (d['navContext'] === 'farmer') return '/produse'
      if (isAssociationMember) return '/asociatie/produse'
      return '/produse'
    }
    case 'producer_approved':
    case 'producer_suspended':
      return '/dashboard'
    case 'offer_new':
      return '/asociatie/oferte'
    case 'offer_approved':
    case 'offer_rejected':
      return '/produse'
    case 'legal_docs_expiring':
    case 'legal_docs_expired':
      return '/settings/documente-legale'
    case 'weekly_sales_summary':
      return '/notificari'
    case 'tratament_reminder':
      return '/tratamente'
    case 'system':
    default:
      return '/dashboard'
  }
}
