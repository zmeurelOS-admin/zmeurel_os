import { getSupabaseAdmin } from '@/lib/supabase/admin'

import {
  NOTIFICARI_PREFERINTE_IMPLICITE,
  isMissingTableError,
  normalizeazaPreferinte,
  permitePush,
  type NotificariPreferinte,
} from './preferinte'

// `notificari_preferinte` nu e încă în tipurile generate (migrarea o aplică Andrei).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAdmin = any

/**
 * Preferințele unui utilizator, citite cu service role. Nu aruncă niciodată:
 * tabel lipsă, rând lipsă sau orice eroare → valorile implicite (totul pornit, liniște noaptea).
 */
export async function citestePreferinteNotificari(userId: string): Promise<NotificariPreferinte> {
  try {
    const admin = getSupabaseAdmin() as AnyAdmin
    const { data, error } = await admin
      .from('notificari_preferinte')
      .select('tipuri, liniste_noaptea')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      if (!isMissingTableError(error)) {
        console.warn('[notifications] preferințele nu s-au putut citi; folosesc valorile implicite', error.code)
      }
      return NOTIFICARI_PREFERINTE_IMPLICITE
    }
    return normalizeazaPreferinte(data as { tipuri?: unknown; liniste_noaptea?: unknown } | null)
  } catch {
    return NOTIFICARI_PREFERINTE_IMPLICITE
  }
}

/** Pleacă push-ul către acest utilizator, pentru acest tip, acum? */
export async function utilizatorulPermitePush(userId: string, type: string, now: Date = new Date()): Promise<boolean> {
  const preferinte = await citestePreferinteNotificari(userId)
  return permitePush(preferinte, type, now)
}
