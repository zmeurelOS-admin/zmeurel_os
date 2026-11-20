/**
 * Partea de server a verificării zilnice: fermele reale, deduplicarea și trimiterea.
 * Citește cu service role și doar inserează în `notifications` (prin `createNotificationForTenantOwner`,
 * ca push-ul să treacă prin „Ce primești” și liniștea de noapte). Nu modifică nimic altceva.
 */
import { createNotificationForTenantOwner } from '@/lib/notifications/create'
import type { getSupabaseAdmin } from '@/lib/supabase/admin'

import type { NotificareZilnica } from './common'
import { esteFermaDemo } from './ferme'

type Admin = ReturnType<typeof getSupabaseAdmin>

export function hasValidCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const headerSecret = request.headers.get('x-cron-secret')
  const bearer = request.headers.get('authorization')
  const bearerSecret = bearer?.startsWith('Bearer ') ? bearer.slice(7) : null
  return headerSecret === expected || bearerSecret === expected
}

export type FermaReala = { id: string; ownerUserId: string }

const PAGINA_UTILIZATORI = 1000

/** Emailurile tuturor utilizatorilor (id → email), pentru a recunoaște proprietarii demo. */
async function emailuriUtilizatori(admin: Admin): Promise<Map<string, string>> {
  const emails = new Map<string, string>()
  for (let page = 1; page < 1000; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGINA_UTILIZATORI })
    if (error) throw error
    const users = data?.users ?? []
    for (const user of users) {
      if (user.email) emails.set(user.id, user.email)
    }
    if (users.length < PAGINA_UTILIZATORI) break
  }
  return emails
}

/** Fermele cu proprietar, fără demo-uri. Dacă nu putem deosebi demo-urile, aruncă (nu trimitem nimic). */
export async function citesteFermeleReale(admin: Admin): Promise<FermaReala[]> {
  const { data, error } = await admin.from('tenants').select('id, owner_user_id, is_demo')
  if (error) throw error
  const emails = await emailuriUtilizatori(admin)
  const ferme: FermaReala[] = []
  for (const tenant of (data ?? []) as Array<{ id: string; owner_user_id: string | null; is_demo: boolean | null }>) {
    if (!tenant.owner_user_id) continue
    if (esteFermaDemo(tenant, emails.get(tenant.owner_user_id) ?? null)) continue
    ferme.push({ id: tenant.id, ownerUserId: tenant.owner_user_id })
  }
  return ferme
}

/** Citește toate rândurile unei interogări, în pagini de 1000 (limita PostgREST). */
export async function citesteTot<T>(
  pagina: (de: number, pana: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  const marime = 1000
  for (let de = 0; ; de += marime) {
    const { data, error } = await pagina(de, de + marime - 1)
    if (error) throw error
    const bucata = data ?? []
    rows.push(...bucata)
    if (bucata.length < marime) break
  }
  return rows
}

export type RezultatTrimitere = 'trimisa' | 'dubla' | 'eroare'

/**
 * Trimite notificarea dacă n-a mai plecat una cu aceeași cheie (`data.reminder_key`).
 * Cronul care rulează de două ori în aceeași zi nu trimite de două ori.
 */
export async function trimiteNotificareZilnica(admin: Admin, notificare: NotificareZilnica): Promise<RezultatTrimitere> {
  const { data: existing, error } = await admin
    .from('notifications')
    .select('id')
    .eq('type', notificare.type)
    .eq('data->>reminder_key', notificare.reminderKey)
    .limit(1)
  if (error) throw error
  if ((existing ?? []).length > 0) return 'dubla'

  const id = await createNotificationForTenantOwner(
    notificare.tenantId,
    notificare.type,
    notificare.title,
    notificare.body,
    { ...notificare.data, reminder_key: notificare.reminderKey },
    notificare.entityType,
    notificare.entityId,
    { awaitPush: true },
  )
  return id ? 'trimisa' : 'eroare'
}

export type ContorZilnic = {
  fermeVerificate: number
  trimise: Record<string, number>
  dubluri: number
  erori: number
}

export function contorNou(tipuri: readonly string[]): ContorZilnic {
  return { fermeVerificate: 0, trimise: Object.fromEntries(tipuri.map((tip) => [tip, 0])), dubluri: 0, erori: 0 }
}

export function numara(contor: ContorZilnic, tip: string, rezultat: RezultatTrimitere): void {
  if (rezultat === 'trimisa') contor.trimise[tip] = (contor.trimise[tip] ?? 0) + 1
  else if (rezultat === 'dubla') contor.dubluri += 1
  else contor.erori += 1
}
