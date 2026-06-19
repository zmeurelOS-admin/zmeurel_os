export const FARM_MEMBER_ACCESS_LEVELS = ['read', 'write'] as const

export type FarmMemberAccessLevel = (typeof FARM_MEMBER_ACCESS_LEVELS)[number]

export const FARM_MEMBER_MODULES = [
  'comenzi',
  'livrari',
  'recoltari',
  'clienti',
  'tratamente',
  'culegatori',
  'produse',
  'activitati',
] as const

export type FarmMemberModule = (typeof FARM_MEMBER_MODULES)[number]

export type FarmMemberModuleAccess = {
  module: FarmMemberModule
  level: FarmMemberAccessLevel
}

export const FARM_MEMBER_MODULE_LABELS: Record<FarmMemberModule, string> = {
  comenzi: 'Comenzi',
  livrari: 'Livrări',
  recoltari: 'Recoltări',
  clienti: 'Clienți',
  tratamente: 'Protecție & Nutriție',
  culegatori: 'Culegători',
  produse: 'Produse',
  activitati: 'Activități agricole',
}

export const FARM_MEMBER_MODULE_ROUTES: Record<FarmMemberModule, string[]> = {
  comenzi: ['/comenzi'],
  livrari: ['/livrari'],
  recoltari: ['/recoltari'],
  clienti: ['/clienti', '/clienti-magazin'],
  tratamente: ['/tratamente'],
  culegatori: ['/culegatori'],
  produse: ['/produse'],
  activitati: ['/activitati-agricole'],
}

export const FARM_MEMBER_MODULE_DEFAULT_ROUTE: Record<FarmMemberModule, string> = {
  comenzi: '/comenzi',
  livrari: '/livrari',
  recoltari: '/recoltari',
  clienti: '/clienti',
  tratamente: '/tratamente/conformitate',
  culegatori: '/culegatori',
  produse: '/produse',
  activitati: '/activitati-agricole',
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
    const module = typeof item.module === 'string' ? item.module : ''
    const level = typeof item.level === 'string' ? item.level : ''
    if (!MODULE_SET.has(module) || !LEVEL_SET.has(level)) continue
    byModule.set(module as FarmMemberModule, level as FarmMemberAccessLevel)
  }

  const normalized = FARM_MEMBER_MODULES.flatMap((module) => {
    const level = byModule.get(module)
    return level ? [{ module, level }] : []
  })

  if (normalized.length === 0 && options.legacyFallback) {
    return LEGACY_OPERATOR_ACCESS
  }

  return normalized
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
  if (module === 'tratamente') {
    if (pathname === '/tratamente' || pathname.startsWith('/tratamente/')) return true
    return /^\/parcele\/[^/]+\/tratamente(?:\/|$)/.test(pathname)
  }

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
  return Boolean(getAccessForPath(pathname, access))
}
