export const FARM_MEMBER_ACCESS_LEVELS = ['read', 'write'] as const

export type FarmMemberAccessLevel = (typeof FARM_MEMBER_ACCESS_LEVELS)[number]

export const FARM_MEMBER_MODULES = [
  'parcele',
  'comenzi',
  'livrari',
  'recoltari',
  'clienti',
  'culegatori',
  'produse',
  'activitati',
  'tratamente',
] as const

export type FarmMemberModule = (typeof FARM_MEMBER_MODULES)[number]

export type FarmMemberModuleAccess = {
  module: FarmMemberModule
  level: FarmMemberAccessLevel
}

export const FARM_MEMBER_MODULE_LABELS: Record<FarmMemberModule, string> = {
  parcele: 'Parcele',
  comenzi: 'Comenzi',
  livrari: 'Livrări',
  recoltari: 'Recoltări',
  clienti: 'Clienți',
  culegatori: 'Culegători',
  produse: 'Produse',
  activitati: 'Lucrări',
  tratamente: 'Tratamente',
}

export const FARM_MEMBER_MODULE_ROUTES: Record<FarmMemberModule, string[]> = {
  parcele: ['/parcele'],
  comenzi: ['/comenzi'],
  livrari: ['/livrari'],
  recoltari: ['/recoltari'],
  clienti: ['/clienti', '/clienti-magazin'],
  culegatori: ['/culegatori'],
  produse: ['/produse'],
  // Lucrările (fostele Activități agricole; `/activitati-agricole` redirecționează la `/lucrari`). Cheia rămâne `activitati`.
  activitati: ['/lucrari', '/activitati-agricole'],
  // Tratamentele au dreptul lor (RLS: `operator_can_write('tratamente')`).
  tratamente: ['/tratamente'],
}

export const FARM_MEMBER_MODULE_DEFAULT_ROUTE: Record<FarmMemberModule, string> = {
  parcele: '/parcele',
  comenzi: '/comenzi',
  livrari: '/livrari',
  recoltari: '/recoltari',
  clienti: '/clienti',
  culegatori: '/culegatori',
  produse: '/produse',
  activitati: '/lucrari',
  tratamente: '/tratamente',
}

export const LEGACY_OPERATOR_ACCESS: FarmMemberModuleAccess[] = [
  { module: 'comenzi', level: 'write' },
  { module: 'livrari', level: 'write' },
]

export const OPERATOR_HARD_BLOCKED_ROUTE_PREFIXES = [
  '/settings',
  '/setari',
  '/admin',
  '/administrare',
  '/asociatie',
  '/planuri',
]

/**
 * Pagini ale oricărui operator, indiferent de drepturi: „Mai mult” (de acolo iese din cont pe telefon) și
 * notificările lui. Nu dau acces la date: fiecare modul din ele se verifică separat.
 */
export const OPERATOR_ALWAYS_ALLOWED_ROUTE_PREFIXES = ['/mai-mult', '/notificari']

const MODULE_SET = new Set<string>(FARM_MEMBER_MODULES)
const LEVEL_SET = new Set<string>(FARM_MEMBER_ACCESS_LEVELS)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeFarmMemberAccess(
  value: unknown,
  options: { legacyFallback?: boolean } = {},
): FarmMemberModuleAccess[] {
  if (!Array.isArray(value)) {
    return options.legacyFallback ? LEGACY_OPERATOR_ACCESS : []
  }

  const byModule = new Map<FarmMemberModule, FarmMemberAccessLevel>()
  for (const item of value) {
    if (!isRecord(item)) continue
    const moduleName = typeof item.module === 'string' ? item.module : ''
    const level = typeof item.level === 'string' ? item.level : ''
    if (!MODULE_SET.has(moduleName) || !LEVEL_SET.has(level)) continue
    byModule.set(moduleName as FarmMemberModule, level as FarmMemberAccessLevel)
  }

  const normalized = FARM_MEMBER_MODULES.flatMap((moduleName) => {
    const level = byModule.get(moduleName)
    return level ? [{ module: moduleName, level }] : []
  })

  if (normalized.length === 0 && options.legacyFallback) {
    return LEGACY_OPERATOR_ACCESS
  }

  return normalized
}

/**
 * Refuzul explicit al tratamentelor, păstrat în `modules_access` ca `{ module: 'tratamente', level: 'none' }`.
 * Bazei de date nu-i schimbă nimic (`operator_can_write` citește doar `read` / `write`); îi spune aplicației
 * că proprietarul a ales „Nu”, ca regula de compatibilitate de mai jos să nu mai dea citire.
 */
export const FARM_MEMBER_DENIED_LEVEL = 'none'

function hasExplicitTratamenteDeny(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.some((item) => isRecord(item) && item.module === 'tratamente' && item.level === FARM_MEMBER_DENIED_LEVEL)
  )
}

/**
 * Compatibilitate `activitati` → `tratamente: read`.
 * Până la dreptul separat, `/tratamente` stătea la modulul `activitati`: cine avea Lucrări vedea și Tratamentele.
 * La citirea drepturilor, dacă `tratamente` lipsește și `activitati` e prezent (și nu există refuzul explicit),
 * operatorul primește `tratamente: read`. Rândurile din `farm_members` nu se schimbă.
 */
export function applyTratamenteCompat(
  access: FarmMemberModuleAccess[],
  options: { explicitDeny?: boolean } = {},
): FarmMemberModuleAccess[] {
  if (options.explicitDeny) return access
  const hasActivitati = access.some((item) => item.module === 'activitati')
  const hasTratamente = access.some((item) => item.module === 'tratamente')
  if (!hasActivitati || hasTratamente) return access
  return normalizeFarmMemberAccess([...access, { module: 'tratamente', level: 'read' }])
}

/**
 * Drepturile unui operator așa cum le citește aplicația dintr-un rând salvat (`farm_members` / `farm_invites`):
 * normalizare + regula de compatibilitate pentru tratamente. Folosită de gărzile de rută, Echipa și acceptarea invitației.
 */
export function resolveFarmMemberAccess(
  value: unknown,
  options: { legacyFallback?: boolean } = {},
): FarmMemberModuleAccess[] {
  const access = normalizeFarmMemberAccess(value, options)
  return applyTratamenteCompat(access, { explicitDeny: hasExplicitTratamenteDeny(value) })
}

export type StoredFarmMemberAccessItem =
  | FarmMemberModuleAccess
  | { module: 'tratamente'; level: typeof FARM_MEMBER_DENIED_LEVEL }

/**
 * Ce se scrie în `modules_access`: drepturile alese plus refuzul explicit al tratamentelor
 * când Lucrări e dat și Tratamente nu (altfel, la citire, regula de compatibilitate ar da citire).
 */
export function toStoredFarmMemberAccess(access: FarmMemberModuleAccess[]): StoredFarmMemberAccessItem[] {
  const normalized = normalizeFarmMemberAccess(access)
  const needsDeny =
    normalized.some((item) => item.module === 'activitati') && !normalized.some((item) => item.module === 'tratamente')
  return needsDeny ? [...normalized, { module: 'tratamente', level: FARM_MEMBER_DENIED_LEVEL }] : normalized
}

/** Nivelul unui modul pentru operator (`null` = nu-l vede). */
export function accessLevelForModule(
  access: FarmMemberModuleAccess[] | undefined,
  module: FarmMemberModule,
): FarmMemberAccessLevel | null {
  return (access ?? []).find((item) => item.module === module)?.level ?? null
}

export function parseFarmMemberAccessHeader(value: string | null | undefined): FarmMemberModuleAccess[] {
  if (!value) return []

  const entries = value
    .split(',')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [moduleName, level] = chunk.split(':')
      return { module: moduleName, level }
    })

  return normalizeFarmMemberAccess(entries)
}

export function firstAllowedRoute(access: FarmMemberModuleAccess[]): string {
  return FARM_MEMBER_MODULE_DEFAULT_ROUTE[access[0]?.module ?? 'comenzi']
}

export function isOperatorHardBlockedPath(pathname: string): boolean {
  return OPERATOR_HARD_BLOCKED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function isPathAllowedForModule(pathname: string, module: FarmMemberModule): boolean {
  return FARM_MEMBER_MODULE_ROUTES[module].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function getAccessForPath(
  pathname: string,
  access: FarmMemberModuleAccess[],
): FarmMemberModuleAccess | null {
  return access.find((item) => isPathAllowedForModule(pathname, item.module)) ?? null
}

export function isPathAllowedForAccess(pathname: string, access: FarmMemberModuleAccess[]): boolean {
  if (OPERATOR_ALWAYS_ALLOWED_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true
  }
  return Boolean(getAccessForPath(pathname, access))
}
