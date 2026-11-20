/**
 * Ce fermă intră în verificarea zilnică. Funcție pură.
 *
 * Demo-urile se sar. `demo-tenant-cleanup` le recunoaște după `tenants.is_demo`; în producție însă fermele
 * create din „Încearcă demo” (/start) au `is_demo = false`, iar proprietarul are un email
 * `…@demo.zmeurel.local` (cum le recunoaște și bannerul demo, `useDemoBannerVisible`). Le sărim pe amândouă.
 */

export const DEMO_EMAIL_SUFFIX = '@demo.zmeurel.local'

export function esteEmailDemo(email: string | null | undefined): boolean {
  return String(email ?? '').trim().toLowerCase().endsWith(DEMO_EMAIL_SUFFIX)
}

export function esteFermaDemo(tenant: { is_demo?: boolean | null }, ownerEmail: string | null | undefined): boolean {
  return tenant.is_demo === true || esteEmailDemo(ownerEmail)
}
