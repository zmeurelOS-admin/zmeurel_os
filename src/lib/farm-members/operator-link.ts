/**
 * Operatorul „din link”: cont Supabase ascuns, fără email real și fără parolă.
 * Partea pură (fără bază de date), folosită și în browser, și în teste.
 *
 * Linkurile operatorului stau toate în `farm_invites`, o singură folosire, 7 zile:
 * - **prima invitație**: `used_by_user_id` gol, `modules_access` cu drepturile date. La deschidere se creează contul.
 * - **reconectarea** („Retrimite linkul”): `used_by_user_id` = utilizatorul ascuns deja existent, pus de la creare,
 *   și `modules_access` gol (drepturile vin din `farm_members`). La deschidere se intră în același utilizator.
 *   Dacă utilizatorul ar fi șters, cheia devine `null` (`on delete set null`), iar `modules_access` gol face linkul
 *   invalid (nu se transformă într-o invitație nouă).
 */

export const HIDDEN_OPERATOR_EMAIL_DOMAIN = 'operator.zmeurel.local'
export const HIDDEN_OPERATOR_EMAIL_SUFFIX = `@${HIDDEN_OPERATOR_EMAIL_DOMAIN}`
export const OPERATOR_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Emailul intern, nerutabil, al unui operator din link. */
export function hiddenOperatorEmail(id: string): string {
  return `op-${id}${HIDDEN_OPERATOR_EMAIL_SUFFIX}`
}

/** `true` pentru conturile ascunse (fără majuscule și spații). Aplicația nu trimite niciodată email la ele. */
export function isHiddenOperatorEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email.trim().toLowerCase().endsWith(HIDDEN_OPERATOR_EMAIL_SUFFIX)
}

/** Scoate adresele ascunse dintr-o listă de destinatari. */
export function withoutHiddenOperatorEmails<T extends string | null | undefined>(emails: T[]): T[] {
  return emails.filter((email) => !isHiddenOperatorEmail(email))
}

export type OperatorAccountKind = 'link' | 'google' | 'parola'

/** Cum intră operatorul: din link (cont ascuns), cu Google sau cu email și parolă. */
export function operatorAccountKind(user: {
  email?: string | null
  app_metadata?: { provider?: string | null; providers?: unknown } | null
  identities?: Array<{ provider?: string | null }> | null
}): OperatorAccountKind {
  if (isHiddenOperatorEmail(user.email)) return 'link'
  const providers = new Set<string>()
  if (user.app_metadata?.provider) providers.add(user.app_metadata.provider)
  if (Array.isArray(user.app_metadata?.providers)) {
    for (const provider of user.app_metadata.providers) if (typeof provider === 'string') providers.add(provider)
  }
  for (const identity of user.identities ?? []) if (identity.provider) providers.add(identity.provider)
  return providers.has('google') ? 'google' : 'parola'
}

export type OperatorLinkRow = {
  id: string
  tenant_id: string
  token: string
  modules_access: unknown
  created_by: string | null
  expires_at: string
  used_at: string | null
  used_by_user_id: string | null
  invitee_name?: string | null
  invitee_phone?: string | null
}

export type OperatorLinkMember = {
  id: string
  name: string
  phone: string | null
  is_active: boolean
  role: string
} | null

export type OperatorLinkProblem = 'not_found' | 'expired' | 'used' | 'no_modules' | 'inactive'

export type OperatorLinkState =
  | { ok: true; kind: 'nou' }
  | { ok: true; kind: 'reconectare'; userId: string }
  | { ok: false; reason: OperatorLinkProblem }

/**
 * Starea unui link, din rândul `farm_invites` (și, la reconectare, rândul operatorului din `farm_members`).
 * `hasModules` = drepturile primei invitații nu sunt goale (calculat cu `resolveFarmMemberAccess`).
 */
export function evaluateOperatorLink(input: {
  row: OperatorLinkRow | null
  hasModules: boolean
  member?: OperatorLinkMember
  now?: number
}): OperatorLinkState {
  const { row } = input
  if (!row) return { ok: false, reason: 'not_found' }
  if (row.used_at) return { ok: false, reason: 'used' }
  const expires = new Date(row.expires_at).getTime()
  if (!Number.isFinite(expires) || expires <= (input.now ?? Date.now())) return { ok: false, reason: 'expired' }

  if (row.used_by_user_id) {
    const member = input.member
    if (!member || !member.is_active || member.role !== 'operator') return { ok: false, reason: 'inactive' }
    return { ok: true, kind: 'reconectare', userId: row.used_by_user_id }
  }

  if (!input.hasModules) return { ok: false, reason: 'no_modules' }
  return { ok: true, kind: 'nou' }
}

/** Numele proprietarului, pentru textele operatorului; `null` când nu se știe (cont demo, fără nume). */
export function ownerDisplayName(user: {
  email?: string | null
  user_metadata?: Record<string, unknown> | null
} | null): string | null {
  if (!user) return null
  const meta = user.user_metadata ?? {}
  for (const key of ['full_name', 'name']) {
    const value = meta[key]
    if (typeof value === 'string' && value.trim().length >= 2) return value.trim().replace(/\s+/g, ' ')
  }
  const email = user.email?.trim().toLowerCase()
  if (!email || email.endsWith('@demo.zmeurel.local') || isHiddenOperatorEmail(email)) return null
  const local = email.split('@')[0] ?? ''
  const nume = local
    .split(/[._-]+/)
    .filter((parte) => /^[a-zăâîșț]+$/i.test(parte))
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ')
  return nume.length >= 2 ? nume : null
}

/** „Cere-i lui Andrei un link nou.” (sau „proprietarului fermei”, când numele nu se știe). */
export function cereLinkNou(owner: string | null): string {
  return owner ? `Cere-i lui ${owner} un link nou.` : 'Cere-i proprietarului fermei un link nou.'
}

/** Confirmarea la ieșirea din cont a operatorului din link (nu mai poate intra fără link nou). */
export function mesajIesireOperatorLink(owner: string | null | undefined): string {
  return `Ca să intri din nou îți trebuie un link nou de la ${owner?.trim() || 'proprietarul fermei'}.`
}
