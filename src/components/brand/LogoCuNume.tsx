import { APP_NAME, APP_TAGLINE } from '@/lib/brand'
import { cn } from '@/lib/utils'

import { NUME_CU_SLOGAN, NUME_SINGUR, SLOGAN } from './logo-contururi'

interface LogoCuNumeProps {
  /** Cu „Ferma ta, pe telefon. Fără hârtii.” sub nume. */
  cuSlogan?: boolean
  className?: string
}

/**
 * Logo-ul cu nume (semnul + „Caietul Fermei”), după `logo-cu-nume/*.svg`.
 * Semnul e `/icons/icon.svg`, la fel zi și noapte; textul ia culoarea din tokeni (`text-fg`, sloganul `text-fg-muted`),
 * așa că varianta pentru fundal deschis sau închis o alege tema, fără culori scrise în componentă.
 * Înălțimea se dă din `className` (`h-9`, `h-10`), lățimea urmează raportul 507 × 140.
 */
export function LogoCuNume({ cuSlogan = false, className }: LogoCuNumeProps) {
  return (
    <svg
      viewBox="0 0 507 140"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={cuSlogan ? `${APP_NAME}. ${APP_TAGLINE}` : APP_NAME}
      className={cn('block h-9 w-auto shrink-0', className)}
    >
      <image href="/icons/icon.svg" x="6" y="6" width="128" height="128" />
      <path d={cuSlogan ? NUME_CU_SLOGAN : NUME_SINGUR} fill="currentColor" className="text-fg" />
      {cuSlogan ? <path d={SLOGAN} fill="currentColor" className="text-fg-muted" /> : null}
    </svg>
  )
}
