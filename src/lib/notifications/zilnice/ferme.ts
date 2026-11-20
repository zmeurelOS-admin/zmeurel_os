/**
 * Ce fermă intră în verificarea zilnică. Funcție pură.
 *
 * Demo-urile se sar. În producție fermele create din „Încearcă demo” (/start) au `is_demo = false`, iar
 * proprietarul are un email `…@demo.zmeurel.local` (cum le recunoaște și bannerul demo, `useDemoBannerVisible`,
 * și curățarea demo-urilor, `src/lib/tenant/demo-cleanup.ts`). Le sărim pe amândouă.
 * Se sar și conturile de test automate (`…@example.test`).
 */

export const DEMO_EMAIL_SUFFIX = '@demo.zmeurel.local'
export const TEST_EMAIL_SUFFIX = '@example.test'

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? '').trim().toLowerCase()
}

export function esteEmailDemo(email: string | null | undefined): boolean {
  return normalizeEmail(email).endsWith(DEMO_EMAIL_SUFFIX)
}

export function esteEmailTest(email: string | null | undefined): boolean {
  return normalizeEmail(email).endsWith(TEST_EMAIL_SUFFIX)
}

export function esteFermaDemo(tenant: { is_demo?: boolean | null }, ownerEmail: string | null | undefined): boolean {
  return tenant.is_demo === true || esteEmailDemo(ownerEmail)
}

/** Fermă care primește verificarea zilnică: nu e demo și nu e cont de test automat. */
export function esteFermaReala(tenant: { is_demo?: boolean | null }, ownerEmail: string | null | undefined): boolean {
  return !esteFermaDemo(tenant, ownerEmail) && !esteEmailTest(ownerEmail)
}
