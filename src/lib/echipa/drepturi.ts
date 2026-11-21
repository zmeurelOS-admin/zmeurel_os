import {
  FARM_MEMBER_MODULE_LABELS,
  FARM_MEMBER_MODULES,
  normalizeFarmMemberAccess,
  resolveFarmMemberAccess,
  type FarmMemberModule,
  type FarmMemberModuleAccess,
} from '@/lib/farm-members/access'

/**
 * Logica ecranului Echipa (fără React): ordinea modulelor, ciorna „Nu / Citește / Scrie”,
 * rezumatul „ce poate face” de sub fiecare nume și mesajul de invitație pentru WhatsApp.
 */

export type RolMembru = 'proprietar' | 'operator' | 'livrator'

/** „Nu” = nu vede modulul; `read` = Citește; `write` = Scrie. */
export type NivelModul = 'nu' | 'read' | 'write'

export type CiornaDrepturi = Record<FarmMemberModule, NivelModul>

/** Ordinea din „Ce poate face?” (mockup): întâi ce se face în câmp, apoi vânzarea. */
export const ECHIPA_ORDINE_MODULE: readonly FarmMemberModule[] = [
  'recoltari',
  'activitati',
  'tratamente',
  'comenzi',
  'livrari',
  'clienti',
  'culegatori',
  'parcele',
  'produse',
]

export const NIVEL_ETICHETA: Record<NivelModul, string> = {
  nu: 'Nu',
  read: 'Citește',
  write: 'Scrie',
}

/** Totul pe „Nu”: invitația pornește cu tot oprit. */
export function ciornaGoala(): CiornaDrepturi {
  return FARM_MEMBER_MODULES.reduce((ciorna, module) => {
    ciorna[module] = 'nu'
    return ciorna
  }, {} as CiornaDrepturi)
}

/** Drepturile salvate ale unui operator, ca ciornă (cu regula de compatibilitate pentru tratamente). */
export function ciornaDinAcces(modulesAccess: unknown): CiornaDrepturi {
  const ciorna = ciornaGoala()
  for (const item of resolveFarmMemberAccess(modulesAccess, { legacyFallback: true })) {
    ciorna[item.module] = item.level
  }
  return ciorna
}

/** Ciorna → lista trimisă la API (doar modulele care nu sunt pe „Nu”). */
export function accesDinCiorna(ciorna: CiornaDrepturi): FarmMemberModuleAccess[] {
  return normalizeFarmMemberAccess(
    FARM_MEMBER_MODULES.flatMap((module) => (ciorna[module] === 'nu' ? [] : [{ module, level: ciorna[module] }])),
  )
}

export function areVreunModul(ciorna: CiornaDrepturi): boolean {
  return FARM_MEMBER_MODULES.some((module) => ciorna[module] !== 'nu')
}

function ordonate(access: FarmMemberModuleAccess[]): FarmMemberModuleAccess[] {
  return [...access].sort((a, b) => ECHIPA_ORDINE_MODULE.indexOf(a.module) - ECHIPA_ORDINE_MODULE.indexOf(b.module))
}

/** „Recoltări, Lucrări (scrie) · Tratamente (citește)”; fără module: „fără acces”. */
export function textDrepturi(access: FarmMemberModuleAccess[]): string {
  const lista = ordonate(access)
  const scrie = lista.filter((item) => item.level === 'write').map((item) => FARM_MEMBER_MODULE_LABELS[item.module])
  const citeste = lista.filter((item) => item.level === 'read').map((item) => FARM_MEMBER_MODULE_LABELS[item.module])
  const parti = [
    scrie.length > 0 ? `${scrie.join(', ')} (scrie)` : null,
    citeste.length > 0 ? `${citeste.join(', ')} (citește)` : null,
  ].filter(Boolean)
  return parti.length > 0 ? parti.join(' · ') : 'fără acces'
}

/** Ce poate face un om din echipă, pe scurt (fără rol). */
export function cePoateFace(rol: RolMembru, modulesAccess?: unknown): string {
  if (rol === 'proprietar') return 'tot'
  if (rol === 'livrator') return 'doar Livrări'
  return textDrepturi(resolveFarmMemberAccess(modulesAccess, { legacyFallback: true }))
}

export const ROL_ETICHETA: Record<RolMembru, string> = {
  proprietar: 'Proprietar',
  operator: 'Operator',
  livrator: 'Livrator',
}

/** Rândul de sub nume: „Operator · Recoltări (scrie)”. */
export function randMembru(rol: RolMembru, modulesAccess?: unknown): string {
  return `${ROL_ETICHETA[rol]} · ${cePoateFace(rol, modulesAccess)}`
}

/** Inițialele din cerc: „Ana Pavel” → „AP”, „Ion” → „I”. */
export function initialeNume(nume: string | null | undefined): string {
  const parti = (nume ?? '').trim().split(/\s+/).filter(Boolean)
  if (parti.length === 0) return '?'
  const litere = parti.length === 1 ? parti[0].charAt(0) : `${parti[0].charAt(0)}${parti[parti.length - 1].charAt(0)}`
  return litere.toUpperCase()
}

/** Telefonul pentru wa.me: doar cifre, cu prefixul 40. `null` dacă nu e nimic. */
export function telefonWhatsApp(telefon: string | null | undefined): string | null {
  const cifre = (telefon ?? '').replace(/\D/g, '')
  if (!cifre) return null
  if (cifre.startsWith('40')) return cifre
  if (cifre.startsWith('0040')) return cifre.slice(2)
  return `40${cifre.replace(/^0/, '')}`
}

export function mesajInvitatie(input: { rol: 'operator' | 'livrator'; nume?: string | null; link: string }): string {
  const nume = input.nume?.trim()
  if (input.rol === 'livrator') {
    return `Salut${nume ? ` ${nume}` : ''}! 🚚
Acesta e linkul tău de acces pentru livrările Zmeurel:
${input.link}

Deschide-l pe telefon înainte de fiecare zi de livrări.
— Echipa Zmeurel`
  }
  return `Salut${nume ? ` ${nume}` : ''}!
Ți-am pregătit acces de operator în Zmeurel OS:
${input.link}

Deschide linkul și creează-ți contul pentru a lucra în ferma mea.`
}

/** `https://wa.me/?text=…` (sau `wa.me/<telefon>` când telefonul e scris). */
export function linkWhatsApp(input: {
  rol: 'operator' | 'livrator'
  nume?: string | null
  telefon?: string | null
  link: string
}): string {
  const telefon = telefonWhatsApp(input.telefon)
  const text = encodeURIComponent(mesajInvitatie(input))
  return telefon ? `https://wa.me/${telefon}?text=${text}` : `https://wa.me/?text=${text}`
}

/** Numele din ecranul Echipa pentru proprietar, din email (fără să-l afișeze întreg). */
export function numeProprietar(email: string | null | undefined): string {
  if (!email) return 'Tu'
  if (email.endsWith('@demo.zmeurel.local')) return 'Tu (cont demo)'
  const local = email.split('@')[0] ?? ''
  const nume = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ')
  return nume || 'Tu'
}
