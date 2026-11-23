/** Informații furnizor serviciu informatic (Legea 365/2002 art. 5) — draft, fără entitate juridică separată în cod. */

import { APP_HOST, APP_NAME, APP_URL, CONTACT_EMAIL } from '@/lib/brand'

/** Numele constantei e intern (nu se redenumește); valorile vin din `src/lib/brand.ts`. */
export const ZMEUREL_TECH_PLATFORM = {
  productName: APP_NAME,
  websiteLabel: APP_HOST,
  websiteUrl: APP_URL,
  contactEmail: CONTACT_EMAIL,
  /** Placeholder până la formalizare juridică a entității operatoare. */
  operatorLine: `Platformă tehnică: ${APP_NAME} (${APP_HOST}) · Contact: ${CONTACT_EMAIL}`,
} as const
