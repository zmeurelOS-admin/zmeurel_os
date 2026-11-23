/**
 * Când se verifică un grup și când se schimbă atractantul. Aceleași reguli ca triggerul
 * `capcane_trg_dupa_verificare` din migrarea `20261123100000_capcane.sql`. Funcții pure.
 */
import { adaugaZile, zileIntre } from '@/lib/notifications/zilnice/common'

import { INTERVAL_ATRACTANT_DROSOPHILA, INTERVAL_VERIFICARE_IMPLICIT, type GrupCapcane } from './model'

type GrupScadenta = Pick<
  GrupCapcane,
  'tip' | 'status' | 'data_montare' | 'data_urmatoarea_verificare' | 'interval_verificare_zile' | 'interval_atractant_zile' | 'data_schimb_atractant'
>

/** Ziua următoarei verificări: cea salvată, altfel montarea + intervalul. */
export function dataVerificareUrmatoare(grup: GrupScadenta): string {
  return grup.data_urmatoarea_verificare ?? adaugaZile(grup.data_montare, grup.interval_verificare_zile || INTERVAL_VERIFICARE_IMPLICIT)
}

/** Grupul activ trebuie verificat azi (sau a rămas neverificat de atunci). */
export function verificareScadenta(grup: GrupScadenta, azi: string): boolean {
  return grup.status === 'activa' && dataVerificareUrmatoare(grup) <= azi
}

/** La câte zile se schimbă atractantul: cel salvat, altfel 7 pentru Drosophila; `null` = nu are atractant. */
export function intervalAtractant(grup: Pick<GrupCapcane, 'tip' | 'interval_atractant_zile'>): number | null {
  if (grup.interval_atractant_zile && grup.interval_atractant_zile > 0) return grup.interval_atractant_zile
  return grup.tip === 'drosophila' ? INTERVAL_ATRACTANT_DROSOPHILA : null
}

/** Ziua în care se schimbă atractantul (de la ultima schimbare sau de la montare), sau `null`. */
export function dataSchimbAtractant(grup: GrupScadenta): string | null {
  const interval = intervalAtractant(grup)
  if (!interval) return null
  return adaugaZile(grup.data_schimb_atractant ?? grup.data_montare, interval)
}

export function atractantScadent(grup: GrupScadenta, azi: string): boolean {
  const data = dataSchimbAtractant(grup)
  return grup.status === 'activa' && data !== null && data <= azi
}

/** Câte zile au trecut de la ultima schimbare a atractantului (sau de la montare). */
export function zileDeLaAtractant(grup: Pick<GrupCapcane, 'data_schimb_atractant' | 'data_montare'>, azi: string): number | null {
  return zileIntre(grup.data_schimb_atractant ?? grup.data_montare, azi)
}

/**
 * Ce face triggerul după o verificare: următoarea verificare = ultima verificare + interval; atractantul schimbat
 * mută ziua schimbării. O verificare mai veche decât ultima nu dă înapoi datele.
 */
export function dupaVerificare<G extends GrupScadenta>(grup: G, verificari: ReadonlyArray<{ data: string; atractant_schimbat: boolean }>): G {
  if (verificari.length === 0) return grup
  const ultima = verificari.reduce((max, v) => (v.data > max ? v.data : max), verificari[0].data)
  const cuAtractant = verificari.filter((v) => v.atractant_schimbat).map((v) => v.data)
  const ultimAtractant = cuAtractant.length > 0 ? cuAtractant.reduce((max, zi) => (zi > max ? zi : max)) : null
  return {
    ...grup,
    data_urmatoarea_verificare: adaugaZile(ultima, grup.interval_verificare_zile || INTERVAL_VERIFICARE_IMPLICIT),
    data_schimb_atractant: ultimAtractant ?? grup.data_schimb_atractant,
  }
}
