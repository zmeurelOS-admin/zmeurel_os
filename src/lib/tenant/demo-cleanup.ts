/**
 * Curățarea nocturnă a demo-urilor (`/api/cron/demo-tenant-cleanup`): regulile, ca funcții pure.
 *
 * E singurul loc din aplicație care șterge ferme întregi în producție, așa că regula e îngustă:
 * o fermă e demo DOAR dacă emailul proprietarului (din `auth.users`) se termină în `@demo.zmeurel.local`.
 * `tenants.is_demo` / `expires_at` nu decid nimic (în producție sunt `false` / gol la toate demo-urile).
 *
 * Partea care citește și șterge e în `demo-cleanup-server.ts`.
 */
import { esteEmailDemo } from '@/lib/notifications/zilnice/ferme'

export const DEMO_CLEANUP_MIN_AGE_MS = 24 * 60 * 60 * 1000
export const DEMO_CLEANUP_MAX_PER_RUN = 50
export const DEMO_CLEANUP_SAMPLE_EMAILS = 20

export type DemoCleanupMode = 'proba' | 'sterge'

/** `DEMO_CLEANUP_MODE=sterge` șterge; lipsă sau orice altă valoare = probă (doar numără). */
export function demoCleanupMode(raw: string | null | undefined = process.env.DEMO_CLEANUP_MODE): DemoCleanupMode {
  return raw === 'sterge' ? 'sterge' : 'proba'
}

export type TenantPentruCuratare = {
  id: string
  owner_user_id: string | null
  created_at: string | null
  is_demo?: boolean | null
  is_association_approved?: boolean | null
}

export type ProtectiiCuratare = {
  /** `profiles.is_superadmin = true` */
  superadminIds: ReadonlySet<string>
  /** Utilizatori din `association_members` (orice rol). */
  associationMemberIds: ReadonlySet<string>
  /** `DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS` */
  esteProprietarProtejat: (userId: string) => boolean
}

export type MotivProtectie =
  | 'superadmin'
  | 'lista_protejata'
  | 'asociatie'
  | 'mai_multe_ferme'
  | 'prea_noua'
  | 'data_necunoscuta'

export type DemoDeSters = {
  tenantId: string
  ownerUserId: string
  email: string
  createdAt: string
}

export type SelectieDemo = {
  /** De la cea mai veche la cea mai nouă. */
  deSters: DemoDeSters[]
  /** Demo-uri (după email) care nu se șterg, cu motivul. */
  protejate: Array<{ tenantId: string; motiv: MotivProtectie }>
}

export function normalizeazaEmail(email: string | null | undefined): string {
  return String(email ?? '').trim().toLowerCase()
}

function vechimeMs(createdAt: string | null | undefined, acum: Date): number | null {
  if (!createdAt) return null
  const time = Date.parse(createdAt)
  if (!Number.isFinite(time)) return null
  return acum.getTime() - time
}

/**
 * Ce ferme demo se șterg. O fermă intră doar dacă:
 * - are proprietar, iar proprietarul are email care se termină în `@demo.zmeurel.local` (fără majuscule și spații);
 * - `created_at` e mai vechi de 24 h;
 * - proprietarul nu e superadmin, nu e în `DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS`, nu e membru de asociație,
 *   nu mai deține altă fermă (ștergerea utilizatorului ar lua-o și pe aceea, în cascadă);
 * - ferma nu e aprobată în asociație (`is_association_approved`).
 *
 * `tenanti` trebuie să fie lista completă (numărăm fermele fiecărui proprietar).
 */
export function selecteazaDemoDeSters(
  tenanti: readonly TenantPentruCuratare[],
  emailuri: ReadonlyMap<string, string | null | undefined>,
  acum: Date,
  protectii: ProtectiiCuratare,
): SelectieDemo {
  const fermePeProprietar = new Map<string, number>()
  for (const tenant of tenanti) {
    if (!tenant.owner_user_id) continue
    fermePeProprietar.set(tenant.owner_user_id, (fermePeProprietar.get(tenant.owner_user_id) ?? 0) + 1)
  }

  const deSters: DemoDeSters[] = []
  const protejate: SelectieDemo['protejate'] = []

  for (const tenant of tenanti) {
    const ownerUserId = tenant.owner_user_id
    if (!tenant.id || !ownerUserId) continue
    const email = normalizeazaEmail(emailuri.get(ownerUserId))
    if (!email || !esteEmailDemo(email)) continue

    const protejeaza = (motiv: MotivProtectie) => protejate.push({ tenantId: tenant.id, motiv })

    if (protectii.superadminIds.has(ownerUserId)) {
      protejeaza('superadmin')
      continue
    }
    if (protectii.esteProprietarProtejat(ownerUserId)) {
      protejeaza('lista_protejata')
      continue
    }
    if (tenant.is_association_approved === true || protectii.associationMemberIds.has(ownerUserId)) {
      protejeaza('asociatie')
      continue
    }
    if ((fermePeProprietar.get(ownerUserId) ?? 0) > 1) {
      protejeaza('mai_multe_ferme')
      continue
    }
    const vechime = vechimeMs(tenant.created_at, acum)
    if (vechime === null) {
      protejeaza('data_necunoscuta')
      continue
    }
    if (vechime <= DEMO_CLEANUP_MIN_AGE_MS) {
      protejeaza('prea_noua')
      continue
    }

    deSters.push({ tenantId: tenant.id, ownerUserId, email, createdAt: tenant.created_at as string })
  }

  deSters.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  return { deSters, protejate }
}

export function numaraProtejate(protejate: SelectieDemo['protejate']): Partial<Record<MotivProtectie, number>> {
  const contor: Partial<Record<MotivProtectie, number>> = {}
  for (const { motiv } of protejate) contor[motiv] = (contor[motiv] ?? 0) + 1
  return contor
}

// ─── Semnele de fermă reală ────────────────────────────────────────────────────

/**
 * Ce citim din bază, chiar înainte de ștergerea unei ferme, ca s-o reverificăm.
 * `tenant: null` = ferma nu mai există.
 */
export type StareFermaDemo = {
  tenant: { owner_user_id: string | null; created_at: string | null; is_association_approved?: boolean | null } | null
  /** Emailul proprietarului, citit acum din `auth.users` (`getUserById`). */
  ownerEmail: string | null
  ownerSuperadmin: boolean
  ownerProtejat: boolean
  ownerInAsociatie: boolean
  /** Câte ferme deține proprietarul (inclusiv aceasta). */
  fermeAleProprietarului: number
  /** Id-urile din `profiles` cu `tenant_id` = ferma. */
  profileIds: string[]
  /** `user_id` din `farm_members` pentru fermă (`null` = membru al cărui cont a fost șters). */
  membriUserIds: Array<string | null>
  /** Rânduri în `shop_orders` / `shop_order_erp_links` / `association_product_offers` pentru fermă. */
  comenziMagazin: number
  legaturiMagazin: number
  oferteAsociatie: number
}

/**
 * Semnele că ferma NU e un demo de aruncat. Oricare dintre ele oprește toată rularea, fără alte ștergeri:
 * - proprietarul s-a schimbat, emailul lui nu mai e demo (sau lipsește), e superadmin, e protejat, e în asociație;
 * - ferma e aprobată în asociație, e mai nouă de 24 h, proprietarul mai deține altă fermă;
 * - în `profiles` mai e cineva cu `tenant_id` = ferma, în afară de proprietar (indiferent de email);
 * - în `farm_members` e cineva în afară de proprietar;
 * - ferma are comenzi în magazin (`shop_orders`, `shop_order_erp_links`) sau oferte în asociație.
 */
export function semneFermaReala(candidat: DemoDeSters, stare: StareFermaDemo, acum: Date): string[] {
  const semne: string[] = []
  const tenant = stare.tenant
  if (!tenant) return semne

  if (tenant.owner_user_id !== candidat.ownerUserId) semne.push('proprietarul fermei s-a schimbat')
  if (!stare.ownerEmail || !esteEmailDemo(stare.ownerEmail)) semne.push('emailul proprietarului nu mai e demo')
  if (stare.ownerSuperadmin) semne.push('proprietarul e superadmin')
  if (stare.ownerProtejat) semne.push('proprietarul e în DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS')
  if (stare.ownerInAsociatie) semne.push('proprietarul e membru de asociație')
  if (tenant.is_association_approved === true) semne.push('ferma e aprobată în asociație')
  const vechime = vechimeMs(tenant.created_at, acum)
  if (vechime === null || vechime <= DEMO_CLEANUP_MIN_AGE_MS) semne.push('ferma nu e mai veche de 24 h')
  if (stare.fermeAleProprietarului > 1) semne.push('proprietarul mai deține altă fermă')

  const altiInProfiles = stare.profileIds.filter((id) => id !== candidat.ownerUserId).length
  if (altiInProfiles > 0) semne.push(`${altiInProfiles} alți utilizatori în profiles pe fermă`)
  const altiMembri = stare.membriUserIds.filter((id) => id !== candidat.ownerUserId).length
  if (altiMembri > 0) semne.push(`${altiMembri} alți membri în farm_members`)
  if (stare.comenziMagazin > 0) semne.push('ferma are comenzi în magazin')
  if (stare.legaturiMagazin > 0) semne.push('ferma are comenzi din magazin legate de comenzi')
  if (stare.oferteAsociatie > 0) semne.push('ferma are oferte în asociație')

  return semne
}

// ─── Bonurile ──────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function esteTenantIdValid(tenantId: string | null | undefined): tenantId is string {
  return typeof tenantId === 'string' && UUID_RE.test(tenantId)
}

/** O cale din `bonuri` se poate șterge doar dacă e sub `{tenant_id}/` al fermei șterse. */
export function esteCaleBonAFermei(tenantId: string, path: string): boolean {
  if (!esteTenantIdValid(tenantId)) return false
  if (typeof path !== 'string' || path.length <= tenantId.length + 1) return false
  if (!path.startsWith(`${tenantId}/`)) return false
  return !path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
}
