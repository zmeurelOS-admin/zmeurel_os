import {
  FARM_MEMBER_MODULE_DEFAULT_ROUTE,
  FARM_MEMBER_MODULE_LABELS,
  isPathAllowedForAccess,
  type FarmMemberModule,
  type FarmMemberModuleAccess,
} from '@/lib/farm-members/access'

/**
 * Navigarea operatorului (promptul 25, partea 5): bara de jos, bara laterală și butonul „+” arată doar modulele
 * pe care operatorul le are pe „Citește” sau „Scrie”. Proprietarul nu trece prin aceste reguli.
 */

export type OperatorTab = {
  module: FarmMemberModule
  label: string
  href: string
  emoji: string
}

/** Câte module încap în bara de jos, lângă „Mai mult” (ca la proprietar: 4 + Mai mult). */
export const OPERATOR_MAX_TABS = 4

/** Ordinea în bara de jos: întâi cele trei din bara proprietarului, apoi restul. Restul rămân în „Mai mult”. */
const OPERATOR_TAB_ORDER: FarmMemberModule[] = [
  'livrari',
  'recoltari',
  'comenzi',
  'parcele',
  'activitati',
  'tratamente',
  'clienti',
  'culegatori',
  'produse',
]

/** Aceleași semne ca în bara proprietarului și în bara laterală. */
const OPERATOR_TAB_EMOJI: Record<FarmMemberModule, string> = {
  livrari: '🚚',
  recoltari: '🧺',
  comenzi: '📦',
  parcele: '🌿',
  activitati: '🌱',
  tratamente: '🧪',
  clienti: '👥',
  culegatori: '👷',
  produse: '🛒',
}

/** Modulele operatorului pentru bara de jos (cel mult 4), în ordinea fixă de mai sus. */
export function operatorTabs(access: FarmMemberModuleAccess[] | undefined): OperatorTab[] {
  const date = new Set(
    (access ?? []).filter((item) => item.level === 'read' || item.level === 'write').map((item) => item.module),
  )
  return OPERATOR_TAB_ORDER.filter((module) => date.has(module))
    .slice(0, OPERATOR_MAX_TABS)
    .map((module) => ({
      module,
      label: FARM_MEMBER_MODULE_LABELS[module],
      href: FARM_MEMBER_MODULE_DEFAULT_ROUTE[module],
      emoji: OPERATOR_TAB_EMOJI[module],
    }))
}

/** O legătură din navigare se arată operatorului doar dacă ruta e într-un modul al lui (sau e mereu permisă). */
export function operatorSeesHref(href: string, access: FarmMemberModuleAccess[] | undefined): boolean {
  const path = href.split(/[?#]/)[0] ?? href
  return isPathAllowedForAccess(path, access ?? [])
}

/** Butonul plutitor „+”: proprietarul mereu; operatorul doar pe modulul unde are „Scrie”. */
export function poateAdaugaPeRuta(memberRole: 'operator' | null | undefined, accessLevel: 'read' | 'write' | null | undefined) {
  return memberRole !== 'operator' || accessLevel === 'write'
}
