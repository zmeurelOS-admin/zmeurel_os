/**
 * V2 · Navigarea pe 4 zone (mobil): Azi, Câmp, Vânzare, Bani.
 * Fiecare zonă grupează rutele existente; nicio rută nu se schimbă.
 * Sursă unică pentru bara de jos, sub-navigarea din antet și sidebar.
 */

/** Evenimentul cu care antetul deschide meniul fermei (deținut de bara de jos). */
export const OPEN_FARM_MENU_EVENT = 'zmeurel:open-farm-menu'

export type ZoneKey = 'azi' | 'camp' | 'vanzare' | 'bani'

export type ZoneSection = {
  href: string
  label: string
}

export type Zone = {
  key: ZoneKey
  label: string
  /** ruta deschisă la apăsarea tabului */
  href: string
  sections: ZoneSection[]
}

export const ZONES: Zone[] = [
  {
    key: 'azi',
    label: 'Azi',
    href: '/dashboard',
    sections: [
      { href: '/dashboard', label: 'Azi' },
      { href: '/notificari', label: 'Notificări' },
    ],
  },
  {
    key: 'camp',
    label: 'Câmp',
    href: '/recoltari',
    sections: [
      { href: '/recoltari', label: 'Cules' },
      { href: '/activitati-agricole', label: 'Lucrări' },
      { href: '/parcele', label: 'Parcele' },
      { href: '/culegatori', label: 'Culegători' },
    ],
  },
  {
    key: 'vanzare',
    label: 'Vânzare',
    href: '/comenzi',
    sections: [
      { href: '/comenzi', label: 'Comenzi' },
      { href: '/livrari', label: 'Livrări' },
      { href: '/clienti', label: 'Clienți' },
      { href: '/stocuri', label: 'Stoc' },
    ],
  },
  {
    key: 'bani',
    label: 'Bani',
    href: '/vanzari',
    sections: [
      { href: '/vanzari', label: 'Vânzări' },
      { href: '/cheltuieli', label: 'Cheltuieli' },
      { href: '/investitii', label: 'Investiții' },
      { href: '/rapoarte', label: 'Rapoarte' },
    ],
  },
]

function normalize(pathname: string): string {
  return pathname.replace(/\/$/, '') || '/'
}

/** Potrivire pe segment: /clienti nu include /clienti-magazin, /vanzari nu include /vanzari-butasi. */
export function isSectionActive(pathname: string, section: ZoneSection): boolean {
  const path = normalize(pathname)
  return path === section.href || path.startsWith(`${section.href}/`)
}

/** Zona căreia îi aparține ruta curentă; null pentru rute din meniul fermei (setări, produse etc.). */
export function getZoneForPath(pathname: string): Zone | null {
  for (const zone of ZONES) {
    if (zone.sections.some((section) => isSectionActive(pathname, section))) return zone
  }
  return null
}
