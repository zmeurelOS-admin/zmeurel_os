/**
 * Pasul „Verifică capcanele” din cronul de dimineață (`/api/cron/notificari-dimineata`, 05:00 UTC: 8:00 vara,
 * 7:00 iarna, ora României). Pentru o fermă reală: citește (service role, doar `select`) grupurile active; dacă unul
 * e de verificat azi (sau a rămas neverificat), trimite câte o notificare proprietarului și fiecărui operator activ cu
 * „Scrie” pe Tratamente (cheia `capcane:<fermă>:<zi>:<utilizator>`), cu „Atractantul se schimbă azi la N” în același
 * mesaj. Fără migrarea 20261123100000 nu trimite nimic.
 */
import type { getSupabaseAdmin } from '@/lib/supabase/admin'
import { trimiteNotificareUtilizator, type RezultatTrimitere } from '@/lib/notifications/zilnice/server'

import { destinatariMementoCapcane, type MembruFerma } from './destinatari'
import { capcaneDeVerificat, notificareMementoCapcane } from './memento'
import { grupuriActiveFerma } from './server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = ReturnType<typeof getSupabaseAdmin> | any

export async function mementoCapcaneFerma(admin: Admin, ferma: { id: string; ownerUserId: string }, azi: string): Promise<RezultatTrimitere[]> {
  const grupuri = await grupuriActiveFerma(admin, ferma.id)
  if (!grupuri || grupuri.length === 0) return []
  const deVerificat = capcaneDeVerificat(grupuri, azi)
  if (deVerificat.grupuri.length === 0) return []

  const parcelaIds = [...new Set(deVerificat.grupuri.map((grup) => grup.parcela_id))]
  const { data: parcele, error: parceleError } = await admin.from('parcele').select('id,nume_parcela').eq('tenant_id', ferma.id).in('id', parcelaIds)
  if (parceleError) throw parceleError
  const numeParcele = new Map(((parcele ?? []) as Array<{ id: string; nume_parcela: string | null }>).map((p) => [p.id, p.nume_parcela?.trim() || 'Parcelă']))

  const { data: membri, error: membriError } = await admin
    .from('farm_members')
    .select('user_id,role,is_active,modules_access')
    .eq('tenant_id', ferma.id)
    .eq('role', 'operator')
    .eq('is_active', true)
  if (membriError) throw membriError

  const rezultate: RezultatTrimitere[] = []
  for (const userId of destinatariMementoCapcane({ ownerUserId: ferma.ownerUserId, membri: (membri ?? []) as MembruFerma[] })) {
    const notificare = notificareMementoCapcane({ tenantId: ferma.id, userId, azi, grupuri, numeParcele })
    if (notificare) rezultate.push(await trimiteNotificareUtilizator(admin, userId, notificare))
  }
  return rezultate
}
