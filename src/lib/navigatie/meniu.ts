/**
 * Navigația aplicației, într-un singur loc (promptul 34, §10): bara de jos și „Mai mult” pe telefon, bara laterală pe
 * desktop. Aceleași nume, aceeași ordine, aceleași reguli pentru operator și superadmin. Date pure, fără React.
 */
import { isPathAllowedForAccess, type FarmMemberModuleAccess } from '@/lib/farm-members/access'
import { operatorTabs } from '@/lib/farm-members/nav'
import { SUPPORT_WHATSAPP_URL } from '@/lib/support'

export type IconitaMeniu =
  | 'acasa'
  | 'livrari'
  | 'recoltari'
  | 'comenzi'
  | 'tratamente'
  | 'magazia'
  | 'parcele'
  | 'lucrari'
  | 'stocuri'
  | 'produse'
  | 'butasi'
  | 'rapoarte'
  | 'vanzari'
  | 'cheltuieli'
  | 'investitii'
  | 'clienti'
  | 'culegatori'
  | 'asociatie'
  | 'admin'
  | 'analytics'
  | 'audit'
  | 'kit'
  | 'planuri'
  | 'setari'
  | 'sugestii'
  | 'mai-mult'

export type TonMeniu = 'primary' | 'info' | 'neutral'

export interface IntrareMeniu {
  href: string
  label: string
  iconita: IconitaMeniu
  ton: TonMeniu
  /** Textul de sub nume (rândurile din „Mai mult”). */
  sub?: string
  /** Link în afara aplicației (WhatsApp). */
  extern?: boolean
  /** În „Mai mult”, rând întreg (Tratamente, Magazia), nu placă. */
  rand?: boolean
}

export interface GrupMeniu {
  titlu: string
  intrari: IntrareMeniu[]
}

export interface ContextMeniu {
  memberRole?: 'operator' | null
  memberAccess?: FarmMemberModuleAccess[]
  isSuperAdmin?: boolean
  associationRole?: string | null
}

/** Bara de jos a proprietarului (și începutul barei laterale). */
export const PRINCIPALE: readonly IntrareMeniu[] = [
  { href: '/dashboard', label: 'Acasă', iconita: 'acasa', ton: 'primary' },
  { href: '/livrari', label: 'Livrări', iconita: 'livrari', ton: 'primary' },
  { href: '/recoltari', label: 'Recoltări', iconita: 'recoltari', ton: 'primary' },
  { href: '/comenzi', label: 'Comenzi', iconita: 'comenzi', ton: 'primary' },
]

const ICONITA_MODUL: Record<string, IconitaMeniu> = {
  '/livrari': 'livrari',
  '/recoltari': 'recoltari',
  '/comenzi': 'comenzi',
  '/parcele': 'parcele',
  '/lucrari': 'lucrari',
  '/tratamente': 'tratamente',
  '/clienti': 'clienti',
  '/culegatori': 'culegatori',
  '/produse': 'produse',
}

export const GRUPURI: readonly GrupMeniu[] = [
  {
    titlu: 'Ferma',
    intrari: [
      { href: '/tratamente', label: 'Tratamente', iconita: 'tratamente', ton: 'primary', sub: 'Stropiri, fertirigare, pauză', rand: true },
      { href: '/tratamente/magazie', label: 'Magazia', iconita: 'magazia', ton: 'primary', sub: 'Produsele de tratament și cât mai ai', rand: true },
      { href: '/parcele', label: 'Parcele', iconita: 'parcele', ton: 'primary' },
      { href: '/lucrari', label: 'Lucrări', iconita: 'lucrari', ton: 'primary' },
      { href: '/stocuri', label: 'Stocuri', iconita: 'stocuri', ton: 'primary' },
      { href: '/produse', label: 'Produse', iconita: 'produse', ton: 'primary' },
      { href: '/vanzari-butasi', label: 'Material săditor', iconita: 'butasi', ton: 'primary' },
      { href: '/rapoarte', label: 'Rapoarte', iconita: 'rapoarte', ton: 'primary' },
    ],
  },
  {
    titlu: 'Bani și oameni',
    intrari: [
      { href: '/vanzari', label: 'Vânzări', iconita: 'vanzari', ton: 'info' },
      { href: '/cheltuieli', label: 'Cheltuieli', iconita: 'cheltuieli', ton: 'info' },
      { href: '/investitii', label: 'Investiții', iconita: 'investitii', ton: 'info' },
      { href: '/clienti', label: 'Clienți', iconita: 'clienti', ton: 'neutral' },
      { href: '/culegatori', label: 'Culegători', iconita: 'culegatori', ton: 'neutral' },
    ],
  },
]

export const ADMIN: readonly IntrareMeniu[] = [
  { href: '/admin', label: 'Panou admin', iconita: 'admin', ton: 'neutral' },
  { href: '/admin/analytics', label: 'Analytics global', iconita: 'analytics', ton: 'neutral' },
  { href: '/admin/audit', label: 'Audit', iconita: 'audit', ton: 'neutral' },
  { href: '/admin/kit', label: 'Kit de componente', iconita: 'kit', ton: 'neutral' },
]

export const ASOCIATIE: IntrareMeniu = { href: '/asociatie', label: 'Gustă din Bucovina', iconita: 'asociatie', ton: 'primary', sub: 'Panoul asociației' }

const esteOperator = (ctx: ContextMeniu) => ctx.memberRole === 'operator'

/** Tratamentele (și Magazia) au dreptul lor; parcelele la fel (regulile din „Mai mult”, promptul 25). */
function vedeIntrarea(intrare: IntrareMeniu, ctx: ContextMeniu): boolean {
  if (!esteOperator(ctx)) return true
  const acces = ctx.memberAccess ?? []
  if (intrare.href.startsWith('/tratamente')) return acces.some((item) => item.module === 'tratamente')
  if (intrare.href === '/parcele') return acces.some((item) => item.module === 'parcele')
  return isPathAllowedForAccess(intrare.href, acces)
}

/** Bara de jos: proprietarul, cele 4 principale; operatorul, modulele lui (cel mult 4). „Mai mult” se adaugă separat. */
export function meniuPrincipal(ctx: ContextMeniu): IntrareMeniu[] {
  if (!esteOperator(ctx)) return [...PRINCIPALE]
  return operatorTabs(ctx.memberAccess).map((tab) => ({ href: tab.href, label: tab.label, iconita: ICONITA_MODUL[tab.href] ?? 'comenzi', ton: 'primary' as const }))
}

/**
 * Grupurile „Ferma” și „Bani și oameni”, filtrate pentru operator. `faraPrincipale` (telefon): fără ce e deja în bara
 * de jos a proprietarului (aceeași regulă ca înainte în „Mai mult”).
 */
export function grupuriMeniu(ctx: ContextMeniu, { faraPrincipale = false }: { faraPrincipale?: boolean } = {}): GrupMeniu[] {
  const principale = new Set(PRINCIPALE.map((intrare) => intrare.href))
  return GRUPURI.map((grup) => ({
    ...grup,
    intrari: grup.intrari.filter((intrare) => (!faraPrincipale || !principale.has(intrare.href)) && vedeIntrarea(intrare, ctx)),
  })).filter((grup) => grup.intrari.length > 0)
}

/** Zona superadmin. */
export function meniuAdmin(ctx: ContextMeniu): IntrareMeniu[] {
  return ctx.isSuperAdmin ? [...ADMIN] : []
}

/** Rândurile de la final: „Planul tău” și Setări (nu pentru operator), „Scrie-mi…” (nu pentru superadmin). */
export function meniuFinal(ctx: ContextMeniu): IntrareMeniu[] {
  const randuri: IntrareMeniu[] = []
  if (!esteOperator(ctx)) {
    randuri.push({ href: '/planuri', label: 'Planul tău', iconita: 'planuri', ton: 'primary', sub: 'Gratuit în beta' })
    randuri.push({ href: '/settings', label: 'Setări', iconita: 'setari', ton: 'neutral' })
  }
  if (!ctx.isSuperAdmin) {
    randuri.push({ href: SUPPORT_WHATSAPP_URL, label: 'Scrie-mi o problemă sau o sugestie', iconita: 'sugestii', ton: 'neutral', sub: 'pe WhatsApp', extern: true })
  }
  return randuri
}

/**
 * Intrarea activă pentru o adresă: cea mai lungă potrivire de prefix (pe `/tratamente/magazie` e Magazia, nu
 * Tratamente). Investițiile stau pe pagina Cheltuieli, fila a doua (`/investitii` redirecționează acolo): pe
 * `/cheltuieli?fila=investitii` e activ rândul „Investiții”. `null` = niciuna.
 */
export function hrefActiv(pathname: string, hrefs: readonly string[], search: string = ''): string | null {
  if ((pathname === '/cheltuieli' || pathname.startsWith('/cheltuieli/')) && new URLSearchParams(search).get('fila') === 'investitii' && hrefs.includes('/investitii')) {
    return '/investitii'
  }
  let best: string | null = null
  for (const href of hrefs) {
    if (href.startsWith('http')) continue
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (!best || href.length > best.length) best = href
    }
  }
  return best
}
