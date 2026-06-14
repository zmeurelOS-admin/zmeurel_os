export type DeliveryZone = 'zona1' | 'zona2' | 'zona3' | 'zona4' | 'ridicare'

export interface VillageConfig {
  name: string
  zone: DeliveryZone
  blocked?: true
  blockedMessage?: string
}

export interface LocalityConfig {
  name: string
  zone: DeliveryZone
  villages?: VillageConfig[]
}

export const DELIVERY_ZONES: Record<
  DeliveryZone,
  {
    minQty: number
    minKg: number
    label: string
    needsConfirmation: boolean
  }
> = {
  zona1: { minQty: 2, minKg: 1, label: 'Zona 1 — Suceava', needsConfirmation: false },
  zona2: { minQty: 4, minKg: 2, label: 'Zona 2', needsConfirmation: false },
  zona3: { minQty: 10, minKg: 5, label: 'Zona 3', needsConfirmation: false },
  zona4: { minQty: 10, minKg: 5, label: 'Altă localitate', needsConfirmation: true },
  ridicare: { minQty: 0, minKg: 0, label: 'Ridicare fermă', needsConfirmation: false },
}

export const LOCALITIES: LocalityConfig[] = [
  { name: 'Suceava', zone: 'zona1' },
  {
    name: 'Salcea',
    zone: 'zona2',
    villages: [
      { name: 'Salcea', zone: 'zona2' },
      { name: 'Văratec', zone: 'zona1' },
      { name: 'Plopeni', zone: 'zona2' },
      {
        name: 'Prelipca',
        zone: 'zona2',
        blocked: true,
        blockedMessage:
          'Nu livrăm în Prelipca. Poți ridica comanda din centrul comunei Salcea (lângă Primărie). Te vom contacta pentru a stabili ora.',
      },
    ],
  },
  {
    name: 'Șcheia',
    zone: 'zona2',
    villages: [
      { name: 'Șcheia', zone: 'zona2' },
      { name: 'Sf. Ilie', zone: 'zona2' },
      { name: 'Mihoveni', zone: 'zona3' },
      { name: 'Boul', zone: 'zona4' },
      { name: 'Ițcanii Vechi', zone: 'zona4' },
    ],
  },
  {
    name: 'Ipotești',
    zone: 'zona2',
    villages: [
      { name: 'Ipotești', zone: 'zona2' },
      { name: 'Lisaura', zone: 'zona2' },
    ],
  },
  { name: 'Dumbrăveni', zone: 'zona2' },
  {
    name: 'Bosanci',
    zone: 'zona3',
    villages: [
      { name: 'Bosanci', zone: 'zona3' },
      { name: 'Cumpărătura', zone: 'zona3' },
    ],
  },
  {
    name: 'Moara',
    zone: 'zona3',
    villages: [
      { name: 'Moara Nica', zone: 'zona3' },
      { name: 'Bulai', zone: 'zona3' },
      { name: 'Vornicenii Mari', zone: 'zona3' },
      { name: 'Vornicenii Mici', zone: 'zona3' },
    ],
  },
  { name: 'Adâncata', zone: 'zona3' },
  {
    name: 'Mitocu Dragomirnei',
    zone: 'zona3',
    villages: [
      { name: 'Mitocu Dragomirnei', zone: 'zona3' },
      { name: 'Dragomirna', zone: 'zona3' },
      { name: 'Lipoveni', zone: 'zona3' },
      { name: 'Mitocași', zone: 'zona3' },
    ],
  },
  { name: 'Pătrăuți', zone: 'zona3' },
  { name: 'Verești', zone: 'zona3' },
]

export function getZoneConfig(zone: DeliveryZone) {
  return DELIVERY_ZONES[zone]
}

export function getZoneMinimumMessage(zone: DeliveryZone, qty: number): string | null {
  if (zone === 'ridicare') return null
  if (zone === 'zona4') return null
  const config = DELIVERY_ZONES[zone]
  if (qty < config.minQty) {
    return `Comanda minimă pentru livrare în ${config.label} este de ${config.minQty} caserole (${config.minKg} kg).`
  }
  return null
}

export function inSuceavaFromZone(zone: DeliveryZone): boolean | null {
  if (zone === 'ridicare') return null
  return zone === 'zona1'
}

export type LocalityResult =
  | { blocked: false; zone: DeliveryZone; displayName: string }
  | { blocked: true; blockedMessage: string; displayName: string }

export function getLocalityZone(city: string, village?: string): LocalityResult {
  const locality = LOCALITIES.find((l) => l.name === city)
  if (!locality) {
    return { blocked: false, zone: 'zona4', displayName: city }
  }

  if (village && locality.villages) {
    const v = locality.villages.find((item) => item.name === village)
    if (v) {
      if (v.blocked) {
        return {
          blocked: true,
          blockedMessage: v.blockedMessage ?? `Nu livrăm în ${v.name}.`,
          displayName: v.name,
        }
      }
      return { blocked: false, zone: v.zone, displayName: v.name }
    }
  }

  return { blocked: false, zone: locality.zone, displayName: village ?? locality.name }
}
