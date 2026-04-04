/**
 * Conținut de brand pentru magazinul asociației „Gustă din Bucovina”.
 */

/** Denumire juridică implicită — completată din setări publice când există. */
export const GUSTA_MERCHANT_LEGAL_NAME_DEFAULT = 'Asociația Gustă din Bucovina'

export const gustaAssociationBrand = {
  name: 'Gustă din Bucovina',
  shortName: 'Gustă din Bucovina',
  tagline: 'Produse proaspete din inima Bucovinei',
  description:
    'Rețea de producători locali care aduc pe masa ta fructe, legume și preparate autentice, cu grijă pentru calitate și pentru comunitate.',
  heroDescription:
    'Descoperă oferta asociației: legături directe cu fermierii din Bucovina, trasabilitate simplă și gust de acasă.',

  social: {
    facebookHandle: '@haigustadinbucovina',
    facebookUrl: 'https://www.facebook.com/haigustadinbucovina',
  },

  volantă: {
    title: 'Piața volantă',
    location: 'Suceava, județul Suceava — prezență la târguri și piețe agroalimentare din zonă (detalii actualizate pe pagina noastră).',
    schedule: 'Program săptămânal variabil; urmărește anunțurile pe Facebook pentru standul asociației și orele de deschidere.',
    partner: 'În parteneriat cu Direcția pentru Agricultură Județeană (DAJ) Suceava.',
  },

  values: [
    { key: 'calitate', label: 'Calitate', blurb: 'Selecție riguroasă și respect pentru produsul local.' },
    { key: 'comunitate', label: 'Comunitate', blurb: 'Sprijin pentru producători și legături directe cu cumpărătorii.' },
    { key: 'traditie', label: 'Tradiție', blurb: 'Meșteșug și rețete păstrate din generație în generație.' },
  ] as const,

  /** Platforma nu este comerciant; afișat discret în footer magazin public. */
  platformAttributionLabel: 'Zmeurel OS',
  platformAttributionUrl: 'https://zmeurel.ro',

  stats: [
    { id: 'producers', value: '50+', label: 'producători în rețea' },
    { id: 'categories', value: '7+', label: 'categorii de produse' },
    { id: 'years', value: '4', label: 'ani de tradiție' },
    { id: 'network', value: '200+', label: 'persoane în comunitate' },
  ] as const,
} as const

export type GustaAssociationBrand = typeof gustaAssociationBrand
